const express = require('express');
const crypto = require('crypto');
const { ApiKey, IntegrationLog, WebhookSubscription, WebhookEvent, Patient, Appointment, LabTest, RadiologyTest, Billing, Prescription } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);
const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const code = (p) => `${p}-${Date.now()}`;
async function log(req, data) { return IntegrationLog.create(tenantCreateData(req, { ip_address: req.ip, ...data })); }
function patientToFhir(p){ return { resourceType:'Patient', id:String(p.id), identifier:[{system:'hms:patient_id',value:p.patient_id}], name:[{text:p.full_name}], telecom:[{system:'phone',value:p.phone},{system:'email',value:p.email}].filter(x=>x.value), gender:(p.gender||'').toLowerCase(), birthDate:p.dob||'', address:p.address?[{text:p.address}]:[] }; }
function appointmentToEncounter(a){ return { resourceType:'Encounter', id:String(a.id), status:a.status||'planned', class:{code:a.appointment_type||'OPD'}, subject:{reference:`Patient/${a.patient_id||''}`}, participant:[{individual:{reference:`Practitioner/${a.doctor_id||''}`}}], period:{start:[a.appointment_date,a.appointment_time].filter(Boolean).join('T')} }; }
function labToObservation(t){ return { resourceType:'Observation', id:String(t.id), status:t.approval_status==='approved'?'final':'preliminary', code:{text:t.test_name||t.template_name||'Lab Observation'}, subject:{reference:`Patient/${t.patient_id||''}`}, valueString:t.result_summary||'', component:(t.parameters||[]).map(x=>({code:{text:x.name}, valueString:x.value, referenceRange:x.normal_range?[{text:x.normal_range}]:[]})) }; }
function diagnosticReport(x,type='lab'){ return { resourceType:'DiagnosticReport', id:String(x.id), status:x.approval_status==='approved'?'final':'preliminary', code:{text:x.test_name||x.study_name||type}, subject:{reference:`Patient/${x.patient_id||''}`}, result:type==='lab'?[{reference:`Observation/${x.id}`}]:[], media:x.pacs_viewer_url?[{link:{url:x.pacs_viewer_url}}]:[], extension:[{url:'hms:dicomStudyId', valueString:x.dicom_study_id||''}] }; }
function invoiceToFhir(b){ return { resourceType:'Invoice', id:String(b.id), status:b.status||'issued', subject:{reference:`Patient/${b.patient_id||''}`}, totalGross:{value:b.total_amount||b.amount||0, currency:'INR'} }; }
function medReq(p){ return { resourceType:'MedicationRequest', id:String(p.id), status:p.status||'active', subject:{reference:`Patient/${p.patient_id||''}`}, medicationCodeableConcept:{text:p.medicine_name||p.medicine||'Medication'}, dosageInstruction:p.dosage?[{text:p.dosage}]:[] }; }

router.get('/integration/summary', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
 const [keys, logs, hooks, events] = await Promise.all([ApiKey.countDocuments(tenantFilter(req)), IntegrationLog.find(tenantFilter(req)).sort({created_at:-1}).limit(10).lean(), WebhookSubscription.countDocuments(tenantFilter(req)), WebhookEvent.find(tenantFilter(req)).sort({created_at:-1}).limit(10).lean()]);
 res.json({ keys, webhooks:hooks, recent_logs:logs, recent_events:events });
}));
router.get('/integration/api-keys', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json(await ApiKey.find(tenantFilter(req)).sort({created_at:-1}))));
router.post('/integration/api-keys', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{ const raw=`hms_${crypto.randomBytes(24).toString('hex')}`; const doc=await ApiKey.create(tenantCreateData(req,{key_id:code('KEY'), name:req.body.name||'Integration key', key_hash:hash(raw), key_preview:`${raw.slice(0,8)}...${raw.slice(-4)}`, scopes:req.body.scopes||['fhir.read'], expires_at:req.body.expires_at||null, created_by:req.user?.id})); res.status(201).json({ ...doc.toJSON(), api_key: raw }); }));
router.patch('/integration/api-keys/:id', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json(await ApiKey.findOneAndUpdate(tenantFilter(req,{id:Number(req.params.id)}),{$set:req.body},{new:true}))));
router.get('/integration/logs', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json(await IntegrationLog.find(tenantFilter(req)).sort({created_at:-1}).limit(200))));
router.post('/integration/logs', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.status(201).json(await IntegrationLog.create(tenantCreateData(req,{...req.body, ip_address:req.ip})))));
router.get('/integration/webhooks', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json(await WebhookSubscription.find(tenantFilter(req)).sort({created_at:-1}))));
router.post('/integration/webhooks', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{ const payload={...req.body}; if(payload.endpoint_url && !payload.target_url) payload.target_url=payload.endpoint_url; if(payload.event_types && !payload.events) payload.events=payload.event_types; if(typeof payload.events==='string') payload.events=payload.events.split(',').map(x=>x.trim()).filter(Boolean); res.status(201).json(await WebhookSubscription.create(tenantCreateData(req,{...payload, created_by:req.user?.id}))); }));
router.post('/integration/webhook-events', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.status(201).json(await WebhookEvent.create(tenantCreateData(req,req.body)))));
router.get('/fhir/Patient', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{ const data=(await Patient.find(tenantFilter(req)).limit(100).lean()).map(patientToFhir); await log(req,{resource_type:'Patient',method:'GET',endpoint:'/fhir/Patient'}); res.json({resourceType:'Bundle',type:'searchset',entry:data.map(resource=>({resource}))}); }));
router.get('/fhir/Encounter', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json({resourceType:'Bundle',type:'searchset',entry:(await Appointment.find(tenantFilter(req)).limit(100).lean()).map(x=>({resource:appointmentToEncounter(x)}))})));
router.get('/fhir/Observation', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json({resourceType:'Bundle',type:'searchset',entry:(await LabTest.find(tenantFilter(req)).limit(100).lean()).map(x=>({resource:labToObservation(x)}))})));
router.get('/fhir/DiagnosticReport', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{ const labs=await LabTest.find(tenantFilter(req)).limit(50).lean(); const rads=await RadiologyTest.find(tenantFilter(req)).limit(50).lean(); res.json({resourceType:'Bundle',type:'searchset',entry:[...labs.map(x=>({resource:diagnosticReport(x,'lab')})),...rads.map(x=>({resource:diagnosticReport(x,'radiology')}))]}); }));
router.get('/fhir/Invoice', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json({resourceType:'Bundle',type:'searchset',entry:(await Billing.find(tenantFilter(req)).limit(100).lean()).map(x=>({resource:invoiceToFhir(x)}))})));
router.get('/fhir/MedicationRequest', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>res.json({resourceType:'Bundle',type:'searchset',entry:(await Prescription.find(tenantFilter(req)).limit(100).lean()).map(x=>({resource:medReq(x)}))})));
module.exports = router;
