const express = require('express');
const crypto = require('crypto');
const { ApiKey, IntegrationLog, WebhookSubscription, WebhookEvent, Patient, Appointment, LabTest, RadiologyTest, Billing, Prescription } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);
const FHIR_VERSION = '4.0.1';
const SUPPORTED_FHIR_RESOURCES = ['Patient', 'Encounter', 'Observation', 'DiagnosticReport', 'MedicationRequest', 'Invoice'];
const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const code = (p) => `${p}-${Date.now()}`;
async function log(req, data) { return IntegrationLog.create(tenantCreateData(req, { ip_address: req.ip, system: 'fhir', ...data })); }
function asDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}
function clean(obj) {
  if (Array.isArray(obj)) return obj.map(clean).filter((x) => x !== undefined && x !== null && !(typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 0));
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)));
}
function ref(type, id) { return id ? `${type}/${String(id)}` : undefined; }
function bundle(resources, selfUrl, total = resources.length) {
  return clean({
    resourceType: 'Bundle',
    type: 'searchset',
    total,
    timestamp: new Date().toISOString(),
    link: [{ relation: 'self', url: selfUrl }],
    entry: resources.map((resource) => ({ fullUrl: `${selfUrl}/${resource.resourceType}/${resource.id}`, resource })),
  });
}
function patientToFhir(p) {
  return clean({
    resourceType: 'Patient',
    id: String(p.id),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Patient'], lastUpdated: asDate(p.updated_at || p.created_at) },
    identifier: [
      { system: 'urn:hms:patient-id', value: p.patient_id || String(p.id) },
      p.insurance_policy_number ? { system: 'urn:hms:insurance-policy', value: p.insurance_policy_number } : null,
    ],
    active: p.status !== 'archived' && !p.deleted_at,
    name: [{ use: 'official', text: p.full_name, family: p.full_name?.split(' ').slice(-1)[0], given: p.full_name?.split(' ').slice(0, -1) }],
    telecom: [{ system: 'phone', value: p.phone, use: 'mobile' }, { system: 'email', value: p.email }],
    gender: ['male', 'female', 'other', 'unknown'].includes(String(p.gender || '').toLowerCase()) ? String(p.gender).toLowerCase() : 'unknown',
    birthDate: p.dob,
    address: p.address ? [{ text: p.address }] : [],
    contact: p.emergency_contact_name || p.emergency_contact_phone ? [{ name: { text: p.emergency_contact_name }, telecom: [{ system: 'phone', value: p.emergency_contact_phone }] }] : [],
    extension: [{ url: 'urn:hms:blood-group', valueString: p.blood_group }, { url: 'urn:hms:tenant-hospital-id', valueInteger: p.hospital_id }],
  });
}
function appointmentToEncounter(a) {
  const statusMap = { scheduled: 'planned', checked_in: 'arrived', in_consultation: 'in-progress', completed: 'finished', cancelled: 'cancelled', no_show: 'cancelled' };
  return clean({
    resourceType: 'Encounter',
    id: String(a.id),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Encounter'], lastUpdated: asDate(a.updated_at || a.created_at) },
    identifier: [{ system: 'urn:hms:appointment-id', value: a.appointment_uid || String(a.id) }],
    status: statusMap[a.status] || 'planned',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: String(a.appointment_type || 'OPD').toUpperCase() },
    subject: { reference: ref('Patient', a.patient_id) },
    participant: [{ individual: { reference: ref('Practitioner', a.doctor_id) } }],
    period: { start: asDate(a.checked_in_at || [a.appointment_date, a.appointment_time].filter(Boolean).join('T')), end: asDate(a.completed_at || a.cancelled_at) },
    reasonCode: a.notes ? [{ text: a.notes }] : [],
  });
}
function labToObservation(t) {
  const status = ['approved', 'completed', 'reported'].includes(t.test_status || t.approval_status) ? 'final' : 'preliminary';
  return clean({
    resourceType: 'Observation',
    id: String(t.id),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Observation'], lastUpdated: asDate(t.updated_at || t.created_at) },
    identifier: [{ system: 'urn:hms:lab-accession', value: t.accession_number || t.sample_barcode || String(t.id) }],
    status,
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
    code: { text: t.test_name || t.template_name || 'Lab Observation' },
    subject: { reference: ref('Patient', t.patient_id) },
    performer: t.doctor_id ? [{ reference: ref('Practitioner', t.doctor_id) }] : [],
    effectiveDateTime: asDate(t.completed_at || t.approved_at || t.created_at),
    valueString: t.result_summary || t.interpretation || t.report_notes,
    component: (t.result_parameters || t.parameters || []).map((x) => clean({ code: { text: x.name || x.parameter }, valueString: x.value || x.result, unit: x.unit, referenceRange: (x.normal_range || x.reference_range) ? [{ text: x.normal_range || x.reference_range }] : [] })),
  });
}
function diagnosticReport(x, type = 'lab') {
  const isLab = type === 'lab';
  const status = ['approved', 'completed', 'reported'].includes(x.test_status || x.status || x.approval_status) ? 'final' : 'preliminary';
  return clean({
    resourceType: 'DiagnosticReport',
    id: `${type}-${x.id}`,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'], lastUpdated: asDate(x.updated_at || x.created_at) },
    identifier: [{ system: isLab ? 'urn:hms:lab-report' : 'urn:hms:radiology-report', value: x.accession_number || x.dicom_study_id || String(x.id) }],
    status,
    category: [{ text: isLab ? 'Laboratory' : 'Radiology' }],
    code: { text: x.test_name || x.scan_name || x.study_name || type },
    subject: { reference: ref('Patient', x.patient_id) },
    result: isLab ? [{ reference: ref('Observation', x.id) }] : [],
    effectiveDateTime: asDate(x.completed_at || x.approved_at || x.reported_at || x.created_at),
    performer: x.doctor_id || x.radiologist_id ? [{ reference: ref('Practitioner', x.doctor_id || x.radiologist_id) }] : [],
    conclusion: x.interpretation || x.impression || x.findings || x.report_notes,
    presentedForm: (x.report_pdf_url || x.report_file) ? [{ url: x.report_pdf_url || x.report_file, title: `${x.test_name || x.scan_name || type} report` }] : [],
    media: x.pacs_viewer_url ? [{ comment: 'PACS viewer', link: { url: x.pacs_viewer_url } }] : [],
    extension: [{ url: 'urn:hms:dicom-study-id', valueString: x.dicom_study_id }],
  });
}
function invoiceToFhir(b) {
  return clean({
    resourceType: 'Invoice',
    id: String(b.id),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Invoice'], lastUpdated: asDate(b.updated_at || b.created_at) },
    identifier: [{ system: 'urn:hms:invoice-number', value: b.invoice_number || String(b.id) }],
    status: ['paid', 'balanced'].includes(b.payment_status || b.status) ? 'balanced' : ['cancelled', 'void'].includes(b.status) ? 'cancelled' : 'issued',
    subject: { reference: ref('Patient', b.patient_id) },
    date: asDate(b.billing_date || b.created_at),
    participant: b.doctor_id ? [{ actor: { reference: ref('Practitioner', b.doctor_id) } }] : [],
    lineItem: (b.items || []).map((item, idx) => clean({ sequence: idx + 1, chargeItemCodeableConcept: { text: item.name || item.description || item.service_name }, priceComponent: [{ type: 'base', amount: { value: Number(item.amount || item.total || item.price || 0), currency: 'INR' } }] })),
    totalGross: { value: Number(b.total_amount || b.amount || 0), currency: 'INR' },
    totalNet: { value: Number((b.total_amount || b.amount || 0) - (b.discount || 0)), currency: 'INR' },
    paymentTerms: b.payment_status,
  });
}
function medReq(p) {
  const meds = Array.isArray(p.medicines) ? p.medicines : Array.isArray(p.items) ? p.items : [p].filter((x) => x.medicine_name || x.medicine || x.drug_name);
  return meds.map((m, idx) => clean({
    resourceType: 'MedicationRequest',
    id: `${p.id}-${idx + 1}`,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/MedicationRequest'], lastUpdated: asDate(p.updated_at || p.created_at) },
    identifier: [{ system: 'urn:hms:prescription-number', value: p.prescription_number || String(p.id) }],
    status: p.status || 'active',
    intent: 'order',
    subject: { reference: ref('Patient', p.patient_id) },
    requester: { reference: ref('Practitioner', p.doctor_id) },
    authoredOn: asDate(p.created_at),
    medicationCodeableConcept: { text: m.medicine_name || m.medicine || m.drug_name || 'Medication' },
    dosageInstruction: [{ text: [m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).join(' | ') || p.dosage }],
  }));
}
function validateFhirResource(resource) {
  const issues = [];
  if (!resource || typeof resource !== 'object') issues.push('Resource must be an object.');
  if (!resource.resourceType) issues.push('resourceType is required.');
  if (resource.resourceType && !SUPPORTED_FHIR_RESOURCES.includes(resource.resourceType)) issues.push(`Unsupported resourceType: ${resource.resourceType}`);
  if (!resource.id) issues.push('id is required for export traceability.');
  if (resource.resourceType === 'Bundle' && !Array.isArray(resource.entry)) issues.push('Bundle.entry must be an array.');
  return { valid: issues.length === 0, issues };
}
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
router.get('/fhir/metadata', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  await log(req,{resource_type:'CapabilityStatement',method:'GET',endpoint:'/fhir/metadata'});
  res.json(clean({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    fhirVersion: FHIR_VERSION,
    format: ['json'],
    implementation: { description: 'Enterprise HMS tenant-scoped FHIR R4 export foundation' },
    rest: [{ mode: 'server', resource: SUPPORTED_FHIR_RESOURCES.map((type) => ({ type, interaction: [{ code: 'search-type' }, { code: 'read' }] })) }],
  }));
}));

router.post('/fhir/validate', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const resource = req.body || {};
  const result = validateFhirResource(resource);
  await log(req,{resource_type: resource.resourceType || 'Unknown', method:'POST', endpoint:'/fhir/validate', status: result.valid ? 'success' : 'failed', message: result.issues.join('; ')});
  res.status(result.valid ? 200 : 400).json({ ...result, fhirVersion: FHIR_VERSION });
}));

router.get('/fhir/Patient', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const rows = await Patient.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.min(Number(req.query._count || 100), 200)).lean();
  const resources = rows.map(patientToFhir);
  await log(req,{resource_type:'Patient',method:'GET',endpoint:'/fhir/Patient', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
router.get('/fhir/Patient/:id', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const doc = await Patient.findOne(tenantFilter(req, { $or: [{ id: Number(req.params.id) }, { patient_id: req.params.id }] })).lean();
  if (!doc) return res.status(404).json({ message: 'FHIR Patient resource not found.' });
  const resource = patientToFhir(doc);
  await log(req,{resource_type:'Patient',method:'GET',endpoint:'/fhir/Patient/:id', status:'success'});
  res.json(resource);
}));
router.get('/fhir/Encounter', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const rows = await Appointment.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.min(Number(req.query._count || 100), 200)).lean();
  const resources = rows.map(appointmentToEncounter);
  await log(req,{resource_type:'Encounter',method:'GET',endpoint:'/fhir/Encounter', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
router.get('/fhir/Encounter/:id', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const doc = await Appointment.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!doc) return res.status(404).json({ message: 'FHIR Encounter resource not found.' });
  await log(req,{resource_type:'Encounter',method:'GET',endpoint:'/fhir/Encounter/:id', status:'success'});
  res.json(appointmentToEncounter(doc));
}));
router.get('/fhir/Observation', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const rows = await LabTest.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.min(Number(req.query._count || 100), 200)).lean();
  const resources = rows.map(labToObservation);
  await log(req,{resource_type:'Observation',method:'GET',endpoint:'/fhir/Observation', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
router.get('/fhir/Observation/:id', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const doc = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!doc) return res.status(404).json({ message: 'FHIR Observation resource not found.' });
  await log(req,{resource_type:'Observation',method:'GET',endpoint:'/fhir/Observation/:id', status:'success'});
  res.json(labToObservation(doc));
}));
router.get('/fhir/DiagnosticReport', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const limit = Math.min(Number(req.query._count || 100), 200);
  const [labs, rads] = await Promise.all([
    LabTest.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.ceil(limit/2)).lean(),
    RadiologyTest.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.floor(limit/2)).lean(),
  ]);
  const resources = [...labs.map(x=>diagnosticReport(x,'lab')),...rads.map(x=>diagnosticReport(x,'radiology'))];
  await log(req,{resource_type:'DiagnosticReport',method:'GET',endpoint:'/fhir/DiagnosticReport', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
router.get('/fhir/Invoice', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const rows = await Billing.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.min(Number(req.query._count || 100), 200)).lean();
  const resources = rows.map(invoiceToFhir);
  await log(req,{resource_type:'Invoice',method:'GET',endpoint:'/fhir/Invoice', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
router.get('/fhir/MedicationRequest', requirePermission('configuration.manage'), asyncHandler(async(req,res)=>{
  const rows = await Prescription.find(tenantFilter(req)).sort({created_at:-1}).limit(Math.min(Number(req.query._count || 100), 200)).lean();
  const resources = rows.flatMap(medReq);
  await log(req,{resource_type:'MedicationRequest',method:'GET',endpoint:'/fhir/MedicationRequest', status:'success', response_count: resources.length});
  res.json(bundle(resources, `${req.protocol}://${req.get('host')}${req.originalUrl}`, resources.length));
}));
module.exports = router;
