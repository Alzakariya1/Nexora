const express = require('express');
const {
  ClinicalRecord,
  Patient,
  Appointment,
  OpdRecord,
  Prescription,
  LabTest,
  RadiologyTest,
  Billing,
  IpdAdmission,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');

const router = express.Router();
router.use(verifyToken, attachTenant);

const RECORD_TYPES = ['soap', 'allergy', 'condition', 'medication_history', 'surgical_history', 'family_history', 'immunization', 'clinical_note'];
const STATUSES = ['active', 'inactive', 'resolved', 'archived'];

function patientKeys(patientOrId) {
  const keys = [];
  if (!patientOrId) return keys;
  if (typeof patientOrId === 'object') {
    if (patientOrId.patient_id) keys.push(String(patientOrId.patient_id));
    if (patientOrId.id) keys.push(String(patientOrId.id));
  } else {
    keys.push(String(patientOrId));
  }
  return [...new Set(keys.filter(Boolean))];
}

function patientRecordFilter(req, patientOrId) {
  const keys = patientKeys(patientOrId);
  return tenantFilter(req, { patient_id: { $in: keys } });
}

async function buildClinicalSummary(req, patientId) {
  const patient = await Patient.findOne(tenantFilter(req, { id: Number(patientId) })).lean()
    || await Patient.findOne(tenantFilter(req, { patient_id: String(patientId) })).lean();
  if (!patient) return null;
  const filter = patientRecordFilter(req, patient);
  const [records, appointments, opd, prescriptions, labs, radiology, bills, admissions] = await Promise.all([
    ClinicalRecord.find(filter).sort({ record_date: -1, id: -1 }).lean(),
    Appointment.find(filter).sort({ appointment_date: -1, appointment_time: -1 }).limit(10).lean(),
    OpdRecord.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
    Prescription.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
    LabTest.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
    RadiologyTest.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
    Billing.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
    IpdAdmission.find(filter).sort({ created_at: -1, id: -1 }).limit(10).lean(),
  ]);
  const byType = records.reduce((acc, r) => {
    const key = r.record_type || 'clinical_note';
    acc[key] = acc[key] || [];
    acc[key].push(r);
    return acc;
  }, {});
  const activeAllergies = records.filter((r) => r.record_type === 'allergy' && r.status === 'active');
  const activeConditions = records.filter((r) => r.record_type === 'condition' && r.status === 'active');
  const activeMedications = records.filter((r) => r.record_type === 'medication_history' && r.status === 'active');
  const timeline = [
    ...records.map((r) => ({ type: r.record_type, title: r.title || r.diagnosis || 'Clinical record', date: r.record_date || r.created_at, status: r.status, payload: r })),
    ...appointments.map((r) => ({ type: 'appointment', title: r.appointment_type || 'Appointment', date: `${r.appointment_date || ''} ${r.appointment_time || ''}`.trim() || r.created_at, status: r.status, payload: r })),
    ...opd.map((r) => ({ type: 'opd', title: r.diagnosis || 'OPD consultation', date: r.visit_date || r.created_at, status: r.status, payload: r })),
    ...prescriptions.map((r) => ({ type: 'prescription', title: r.prescription_number || 'Prescription', date: r.created_at, status: r.status, payload: r })),
    ...labs.map((r) => ({ type: 'lab', title: r.test_name || 'Lab test', date: r.created_at, status: r.test_status, payload: r })),
    ...radiology.map((r) => ({ type: 'radiology', title: r.scan_name || 'Radiology', date: r.created_at, status: r.status, payload: r })),
    ...bills.map((r) => ({ type: 'billing', title: r.invoice_number || 'Bill', date: r.billing_date || r.created_at, status: r.payment_status || r.status, payload: r })),
    ...admissions.map((r) => ({ type: 'ipd', title: 'IPD admission', date: r.admission_date || r.created_at, status: r.status, payload: r })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return {
    patient,
    summary: {
      clinicalRecords: records.length,
      activeAllergies: activeAllergies.length,
      activeConditions: activeConditions.length,
      activeMedications: activeMedications.length,
      appointments: appointments.length,
      consultations: opd.length,
      prescriptions: prescriptions.length,
      labs: labs.length,
      radiology: radiology.length,
      bills: bills.length,
      admissions: admissions.length,
    },
    records,
    byType,
    activeAllergies,
    activeConditions,
    activeMedications,
    timeline,
  };
}

router.get('/emr/patients', requirePermission('emr.view'), asyncHandler(async (req, res) => {
  const patients = await Patient.find(tenantFilter(req)).sort({ id: -1 }).limit(200).lean();
  res.json(patients);
}));

router.get('/emr/patients/:id/summary', requirePermission('emr.view'), asyncHandler(async (req, res) => {
  const data = await buildClinicalSummary(req, req.params.id);
  if (!data) return res.status(404).json({ message: 'Patient not found' });
  res.json(data);
}));

router.post('/emr/records', requirePermission('emr.create'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.patient_id) return res.status(400).json({ message: 'patient_id is required' });
  const record_type = RECORD_TYPES.includes(body.record_type) ? body.record_type : 'clinical_note';
  const status = STATUSES.includes(body.status) ? body.status : 'active';
  const record = await ClinicalRecord.create(tenantCreateData(req, {
    patient_id: String(body.patient_id),
    doctor_id: body.doctor_id || req.user?.id || '',
    appointment_id: body.appointment_id || null,
    opd_id: body.opd_id || null,
    record_type,
    title: body.title || record_type.replaceAll('_', ' '),
    chief_complaint: body.chief_complaint || '',
    subjective: body.subjective || '',
    objective: body.objective || '',
    assessment: body.assessment || '',
    plan: body.plan || '',
    diagnosis: body.diagnosis || '',
    severity: body.severity || '',
    onset_date: body.onset_date || '',
    status,
    notes: body.notes || '',
    recorded_by: req.user?.id,
    record_date: body.record_date || new Date(),
    vitals: body.vitals || {},
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  }));
  auditEvent({ req, action: `Created EMR ${record_type} record`, module_name: 'emr', entity_type: 'clinical_record', entity_id: record.id, new_value: record });
  createNotification(req, {
    title: 'EMR record added',
    message: `${record.title || record_type} saved for patient ${record.patient_id}`,
    type: 'emr',
    module: 'emr',
    entity_type: 'clinical_record',
    entity_id: String(record.id),
  });
  res.status(201).json({ message: 'Clinical record saved', record });
}));

router.put('/emr/records/:id', requirePermission('emr.edit'), asyncHandler(async (req, res) => {
  const existing = await ClinicalRecord.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing) return res.status(404).json({ message: 'Clinical record not found' });
  const allowed = ['title', 'chief_complaint', 'subjective', 'objective', 'assessment', 'plan', 'diagnosis', 'severity', 'onset_date', 'status', 'notes', 'record_date', 'vitals', 'attachments'];
  const update = {};
  allowed.forEach((key) => { if (key in req.body) update[key] = req.body[key]; });
  await ClinicalRecord.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  auditEvent({ req, action: 'Updated EMR record', module_name: 'emr', entity_type: 'clinical_record', entity_id: req.params.id, old_value: existing.toJSON ? existing.toJSON() : existing, new_value: update });
  res.json({ message: 'Clinical record updated' });
}));

router.delete('/emr/records/:id', requirePermission('emr.delete'), asyncHandler(async (req, res) => {
  const existing = await ClinicalRecord.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing) return res.status(404).json({ message: 'Clinical record not found' });
  await ClinicalRecord.deleteOne(tenantFilter(req, { id: Number(req.params.id) }));
  auditEvent({ req, action: 'Deleted EMR record', module_name: 'emr', entity_type: 'clinical_record', entity_id: req.params.id, old_value: existing });
  res.json({ message: 'Clinical record deleted' });
}));

module.exports = router;
