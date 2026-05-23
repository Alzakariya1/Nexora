const express = require('express');
const {
  EmergencyCase,
  EmergencyTriageNote,
  EmergencyClinicalNote,
  EmergencyTransfer,
  Patient,
  Billing,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());
const toBool = (value) => value === true || value === 'true' || value === 1 || value === '1';
const toNum = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));
const toDate = (value) => (value ? new Date(value) : undefined);
const caseStatuses = new Set(['registered', 'triaged', 'under_treatment', 'observation', 'admitted', 'transferred', 'discharged', 'referred', 'death', 'closed']);
const triageCategories = new Set(['red', 'orange', 'yellow', 'green', 'blue']);
const transferStatuses = new Set(['requested', 'accepted', 'completed', 'cancelled']);

function normalizeStatus(value, fallback = 'registered') {
  const v = clean(value).toLowerCase();
  return caseStatuses.has(v) ? v : fallback;
}
function normalizeTriage(value, fallback = 'green') {
  const v = clean(value).toLowerCase();
  return triageCategories.has(v) ? v : fallback;
}
async function audit(req, action, entity_type, entity_id, new_value = {}) {
  await auditEvent({ req, action, module_name: 'emergency', entity_type, entity_id, new_value, status: 'success', severity: 'info' });
}
function listFilter(req) {
  const q = {};
  if (req.query.status) q.status = clean(req.query.status).toLowerCase();
  if (req.query.triage_category) q.triage_category = normalizeTriage(req.query.triage_category);
  if (req.query.patient_id) q.patient_id = clean(req.query.patient_id);
  return tenantFilter(req, q);
}
function emergencyUid() {
  return `ER-${Date.now().toString(36).toUpperCase()}`;
}

router.get('/emergency/dashboard', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const base = tenantFilter(req);
  const today = new Date(); today.setHours(0,0,0,0);
  const [activeCases, todayCases, redOrange, mlcCases, pendingTransfers, dischargedToday] = await Promise.all([
    EmergencyCase.countDocuments({ ...base, status: { $in: ['registered', 'triaged', 'under_treatment', 'observation'] } }),
    EmergencyCase.countDocuments({ ...base, arrival_at: { $gte: today } }),
    EmergencyCase.countDocuments({ ...base, triage_category: { $in: ['red', 'orange'] }, status: { $nin: ['closed', 'discharged', 'transferred'] } }),
    EmergencyCase.countDocuments({ ...base, mlc_required: true, status: { $nin: ['closed'] } }),
    EmergencyTransfer.countDocuments({ ...base, status: { $in: ['requested', 'accepted'] } }),
    EmergencyCase.countDocuments({ ...base, status: { $in: ['discharged', 'closed'] }, closed_at: { $gte: today } }),
  ]);
  const recent = await EmergencyCase.find(base).sort({ id: -1 }).limit(8).lean();
  res.json({ activeCases, todayCases, criticalQueue: redOrange, mlcCases, pendingTransfers, dischargedToday, recent });
}));

router.get('/emergency/cases', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await EmergencyCase.find(listFilter(req)).sort({ id: -1 }).limit(200).lean());
}));

router.post('/emergency/cases', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const patientId = clean(body.patient_id);
  let patient = null;
  if (patientId) patient = await Patient.findOne(tenantFilter(req, { patient_id: patientId })).lean();
  const payload = tenantCreateData(req, {
    emergency_uid: clean(body.emergency_uid) || emergencyUid(),
    patient_id: patientId || undefined,
    patient_name: clean(body.patient_name) || patient?.full_name || '',
    age: toNum(body.age) ?? patient?.age,
    gender: clean(body.gender) || patient?.gender || '',
    phone: clean(body.phone) || patient?.phone || '',
    arrival_mode: clean(body.arrival_mode),
    arrival_at: toDate(body.arrival_at) || new Date(),
    chief_complaint: clean(body.chief_complaint),
    triage_category: normalizeTriage(body.triage_category),
    triage_score: toNum(body.triage_score),
    vitals: body.vitals && typeof body.vitals === 'object' ? body.vitals : {},
    mlc_required: toBool(body.mlc_required),
    mlc_number: clean(body.mlc_number),
    police_informed: toBool(body.police_informed),
    assigned_doctor_id: clean(body.assigned_doctor_id),
    bed_id: toNum(body.bed_id),
    status: normalizeStatus(body.status),
    disposition: clean(body.disposition),
    notes: clean(body.notes),
    created_by: req.user?.id,
  });
  if (!payload.patient_name && !payload.patient_id) return res.status(400).json({ message: 'patient_name or patient_id is required' });
  if (!payload.chief_complaint) return res.status(400).json({ message: 'chief_complaint is required' });
  const record = await EmergencyCase.create(payload);
  await audit(req, 'emergency.case.created', 'EmergencyCase', record.id, { emergency_uid: record.emergency_uid, triage_category: record.triage_category });
  res.status(201).json(record);
}));

router.patch('/emergency/cases/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = normalizeStatus(updates.status, 'under_treatment');
  if (updates.triage_category) updates.triage_category = normalizeTriage(updates.triage_category);
  if (updates.arrival_at) updates.arrival_at = toDate(updates.arrival_at);
  if (updates.closed_at) updates.closed_at = toDate(updates.closed_at);
  if (['discharged', 'referred', 'death', 'closed', 'transferred', 'admitted'].includes(updates.status) && !updates.closed_at) {
    updates.closed_at = new Date(); updates.closed_by = req.user?.id;
  }
  const record = await EmergencyCase.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!record) return res.status(404).json({ message: 'Emergency case not found' });
  await audit(req, 'emergency.case.updated', 'EmergencyCase', record.id, { status: record.status, triage_category: record.triage_category });
  res.json(record);
}));

router.post('/emergency/cases/:id/triage', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const emergencyCase = await EmergencyCase.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!emergencyCase) return res.status(404).json({ message: 'Emergency case not found' });
  const category = normalizeTriage(body.triage_category, emergencyCase.triage_category || 'green');
  const note = await EmergencyTriageNote.create(tenantCreateData(req, {
    emergency_case_id: emergencyCase.id,
    patient_id: emergencyCase.patient_id,
    triage_category: category,
    triage_score: toNum(body.triage_score),
    vitals: body.vitals && typeof body.vitals === 'object' ? body.vitals : {},
    red_flags: Array.isArray(body.red_flags) ? body.red_flags.map(clean).filter(Boolean) : [],
    notes: clean(body.notes),
    recorded_by: req.user?.id,
  }));
  emergencyCase.triage_category = category;
  emergencyCase.triage_score = note.triage_score;
  emergencyCase.vitals = note.vitals;
  emergencyCase.status = 'triaged';
  emergencyCase.updated_by = req.user?.id;
  await emergencyCase.save();
  await audit(req, 'emergency.triage.recorded', 'EmergencyTriageNote', note.id, { emergency_case_id: emergencyCase.id, triage_category: category });
  res.status(201).json({ case: emergencyCase, triage: note });
}));

router.get('/emergency/cases/:id/triage', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await EmergencyTriageNote.find(tenantFilter(req, { emergency_case_id: Number(req.params.id) })).sort({ id: -1 }).lean());
}));

router.post('/emergency/cases/:id/clinical-note', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const emergencyCase = await EmergencyCase.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!emergencyCase) return res.status(404).json({ message: 'Emergency case not found' });
  const note = await EmergencyClinicalNote.create(tenantCreateData(req, {
    emergency_case_id: emergencyCase.id,
    patient_id: emergencyCase.patient_id,
    assessment: clean(body.assessment),
    diagnosis: clean(body.diagnosis),
    treatment_given: clean(body.treatment_given),
    orders: Array.isArray(body.orders) ? body.orders : [],
    follow_up_plan: clean(body.follow_up_plan),
    created_by: req.user?.id,
  }));
  await EmergencyCase.updateOne(tenantFilter(req, { id: emergencyCase.id }), { $set: { status: 'under_treatment', updated_by: req.user?.id } });
  await audit(req, 'emergency.clinical_note.created', 'EmergencyClinicalNote', note.id, { emergency_case_id: emergencyCase.id });
  res.status(201).json(note);
}));

router.get('/emergency/cases/:id/clinical-notes', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await EmergencyClinicalNote.find(tenantFilter(req, { emergency_case_id: Number(req.params.id) })).sort({ id: -1 }).lean());
}));

router.post('/emergency/cases/:id/transfer', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const emergencyCase = await EmergencyCase.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!emergencyCase) return res.status(404).json({ message: 'Emergency case not found' });
  const transfer = await EmergencyTransfer.create(tenantCreateData(req, {
    emergency_case_id: emergencyCase.id,
    patient_id: emergencyCase.patient_id,
    transfer_type: clean(body.transfer_type) || 'ipd',
    target_department: clean(body.target_department),
    target_bed_id: toNum(body.target_bed_id),
    reason: clean(body.reason),
    handover_notes: clean(body.handover_notes),
    status: transferStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'requested',
    requested_by: req.user?.id,
  }));
  await EmergencyCase.updateOne(tenantFilter(req, { id: emergencyCase.id }), { $set: { status: 'transferred', disposition: transfer.transfer_type, updated_by: req.user?.id, closed_at: new Date(), closed_by: req.user?.id } });
  await audit(req, 'emergency.transfer.requested', 'EmergencyTransfer', transfer.id, { emergency_case_id: emergencyCase.id, transfer_type: transfer.transfer_type });
  res.status(201).json(transfer);
}));

router.patch('/emergency/transfers/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = transferStatuses.has(clean(updates.status).toLowerCase()) ? clean(updates.status).toLowerCase() : 'requested';
  if (updates.status === 'completed' && !updates.completed_at) { updates.completed_at = new Date(); updates.completed_by = req.user?.id; }
  const transfer = await EmergencyTransfer.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!transfer) return res.status(404).json({ message: 'Emergency transfer not found' });
  await audit(req, 'emergency.transfer.updated', 'EmergencyTransfer', transfer.id, { status: transfer.status });
  res.json(transfer);
}));

router.get('/emergency/transfers', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req, req.query.status ? { status: clean(req.query.status).toLowerCase() } : {});
  res.json(await EmergencyTransfer.find(filter).sort({ id: -1 }).limit(200).lean());
}));

router.post('/emergency/cases/:id/billing-link', requirePermission(['billing.edit', 'billing.create']), asyncHandler(async (req, res) => {
  const emergencyCase = await EmergencyCase.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!emergencyCase) return res.status(404).json({ message: 'Emergency case not found' });
  const billingId = toNum(req.body?.billing_id);
  if (!billingId) return res.status(400).json({ message: 'billing_id is required' });
  const bill = await Billing.findOne(tenantFilter(req, { id: billingId })).lean();
  if (!bill) return res.status(404).json({ message: 'Billing record not found' });
  emergencyCase.billing_id = billingId;
  emergencyCase.updated_by = req.user?.id;
  await emergencyCase.save();
  await audit(req, 'emergency.billing.linked', 'EmergencyCase', emergencyCase.id, { billing_id: billingId });
  res.json(emergencyCase);
}));

module.exports = router;
