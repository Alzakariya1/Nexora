const express = require('express');
const {
  NursingNote,
  NursingVital,
  MedicationAdministration,
  NursingHandoverNote,
  NursingCarePlan,
  NursingShiftTask,
  IpdAdmission,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());
const toNum = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));
const toDate = (value) => (value ? new Date(value) : undefined);
const allowedMedStatuses = new Set(['scheduled', 'administered', 'withheld', 'missed', 'cancelled']);
const allowedCareStatuses = new Set(['active', 'reviewed', 'completed', 'cancelled']);
const allowedTaskStatuses = new Set(['open', 'in_progress', 'completed', 'cancelled']);
const allowedPriorities = new Set(['low', 'normal', 'high', 'urgent']);

async function audit(req, action, entity_type, entity_id, new_value = {}) {
  await auditEvent({ req, action, module_name: 'nursing', entity_type, entity_id, new_value, status: 'success', severity: 'info' });
}

async function ensureAdmission(req, ipdAdmissionId) {
  if (!ipdAdmissionId) return null;
  const admission = await IpdAdmission.findOne(tenantFilter(req, { id: Number(ipdAdmissionId) })).lean();
  return admission;
}

function listFilter(req) {
  const filter = tenantFilter(req, {});
  if (req.query.patient_id) filter.patient_id = clean(req.query.patient_id);
  if (req.query.ipd_admission_id) filter.ipd_admission_id = Number(req.query.ipd_admission_id);
  if (req.query.status) filter.status = clean(req.query.status).toLowerCase();
  return filter;
}

router.get('/nursing/dashboard', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const base = tenantFilter(req, {});
  const [activeAdmissions, openTasks, overdueTasks, scheduledMeds, administeredToday, vitalsToday, activeCarePlans, handovers] = await Promise.all([
    IpdAdmission.countDocuments(tenantFilter(req, { status: { $in: ['admitted', 'active'] } })),
    NursingShiftTask.countDocuments(tenantFilter(req, { status: { $in: ['open', 'in_progress'] } })),
    NursingShiftTask.countDocuments(tenantFilter(req, { status: { $in: ['open', 'in_progress'] }, due_at: { $lt: new Date() } })),
    MedicationAdministration.countDocuments(tenantFilter(req, { status: 'scheduled' })),
    MedicationAdministration.countDocuments(tenantFilter(req, { status: 'administered', administered_at: { $gte: new Date(new Date().toISOString().slice(0, 10)) } })),
    NursingVital.countDocuments(tenantFilter(req, { recorded_at: { $gte: new Date(new Date().toISOString().slice(0, 10)) } })),
    NursingCarePlan.countDocuments(tenantFilter(req, { status: 'active' })),
    NursingHandoverNote.find(base).sort({ id: -1 }).limit(10).lean(),
  ]);
  res.json({ activeAdmissions, openTasks, overdueTasks, scheduledMeds, administeredToday, vitalsToday, activeCarePlans, recentHandovers: handovers });
}));

router.get('/nursing/vitals', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await NursingVital.find(listFilter(req)).sort({ recorded_at: -1, id: -1 }).limit(200).lean());
}));

router.post('/nursing/vitals', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const admission = await ensureAdmission(req, body.ipd_admission_id);
  if (body.ipd_admission_id && !admission) return res.status(404).json({ message: 'IPD admission not found for this tenant' });
  const payload = tenantCreateData(req, {
    patient_id: clean(body.patient_id || admission?.patient_id),
    ipd_admission_id: body.ipd_admission_id ? Number(body.ipd_admission_id) : undefined,
    recorded_at: toDate(body.recorded_at) || new Date(),
    temperature: toNum(body.temperature), pulse: toNum(body.pulse), respiratory_rate: toNum(body.respiratory_rate),
    blood_pressure_systolic: toNum(body.blood_pressure_systolic), blood_pressure_diastolic: toNum(body.blood_pressure_diastolic),
    spo2: toNum(body.spo2), pain_score: toNum(body.pain_score), gcs_score: toNum(body.gcs_score),
    notes: clean(body.notes), recorded_by: req.user?.id,
  });
  if (!payload.patient_id) return res.status(400).json({ message: 'patient_id is required' });
  const vital = await NursingVital.create(payload);
  await audit(req, 'nursing.vital.created', 'NursingVital', vital.id, { patient_id: vital.patient_id });
  res.status(201).json(vital);
}));

router.get('/nursing/medications', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await MedicationAdministration.find(listFilter(req)).sort({ scheduled_at: 1, id: -1 }).limit(200).lean());
}));

router.post('/nursing/medications', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const admission = await ensureAdmission(req, body.ipd_admission_id);
  if (body.ipd_admission_id && !admission) return res.status(404).json({ message: 'IPD admission not found for this tenant' });
  const status = allowedMedStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'scheduled';
  const payload = tenantCreateData(req, {
    patient_id: clean(body.patient_id || admission?.patient_id), ipd_admission_id: body.ipd_admission_id ? Number(body.ipd_admission_id) : undefined,
    medication_name: clean(body.medication_name), dose: clean(body.dose), route: clean(body.route), frequency: clean(body.frequency),
    scheduled_at: toDate(body.scheduled_at), administered_at: toDate(body.administered_at), status,
    withheld_reason: clean(body.withheld_reason), notes: clean(body.notes), administered_by: body.administered_by ? Number(body.administered_by) : undefined, created_by: req.user?.id,
  });
  if (!payload.patient_id || !payload.medication_name) return res.status(400).json({ message: 'patient_id and medication_name are required' });
  const med = await MedicationAdministration.create(payload);
  await audit(req, 'nursing.medication.created', 'MedicationAdministration', med.id, { patient_id: med.patient_id, status: med.status });
  res.status(201).json(med);
}));

router.patch('/nursing/medications/:id/administer', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const status = allowedMedStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'administered';
  const med = await MedicationAdministration.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), {
    status,
    administered_at: status === 'administered' ? (toDate(body.administered_at) || new Date()) : undefined,
    withheld_reason: clean(body.withheld_reason),
    notes: clean(body.notes),
    administered_by: req.user?.id,
    updated_by: req.user?.id,
  }, { new: true });
  if (!med) return res.status(404).json({ message: 'Medication administration record not found' });
  await audit(req, 'nursing.medication.administered', 'MedicationAdministration', med.id, { status: med.status });
  res.json(med);
}));

router.get('/nursing/handovers', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await NursingHandoverNote.find(listFilter(req)).sort({ id: -1 }).limit(200).lean());
}));

router.post('/nursing/handovers', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const note = await NursingHandoverNote.create(tenantCreateData(req, {
    patient_id: clean(body.patient_id), ipd_admission_id: body.ipd_admission_id ? Number(body.ipd_admission_id) : undefined,
    shift: clean(body.shift), handover_from: req.user?.id, handover_to: body.handover_to ? Number(body.handover_to) : undefined,
    situation: clean(body.situation), background: clean(body.background), assessment: clean(body.assessment), recommendation: clean(body.recommendation),
    pending_tasks: Array.isArray(body.pending_tasks) ? body.pending_tasks : [], created_by: req.user?.id,
  }));
  await audit(req, 'nursing.handover.created', 'NursingHandoverNote', note.id, { patient_id: note.patient_id });
  res.status(201).json(note);
}));

router.get('/nursing/care-plans', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await NursingCarePlan.find(listFilter(req)).sort({ id: -1 }).limit(200).lean());
}));

router.post('/nursing/care-plans', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const status = allowedCareStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'active';
  const plan = await NursingCarePlan.create(tenantCreateData(req, {
    patient_id: clean(body.patient_id), ipd_admission_id: body.ipd_admission_id ? Number(body.ipd_admission_id) : undefined,
    diagnosis: clean(body.diagnosis), goals: Array.isArray(body.goals) ? body.goals : [], interventions: Array.isArray(body.interventions) ? body.interventions : [],
    evaluation_notes: clean(body.evaluation_notes), status, started_at: toDate(body.started_at) || new Date(), reviewed_at: toDate(body.reviewed_at), created_by: req.user?.id,
  }));
  await audit(req, 'nursing.care_plan.created', 'NursingCarePlan', plan.id, { patient_id: plan.patient_id, status: plan.status });
  res.status(201).json(plan);
}));

router.patch('/nursing/care-plans/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = allowedCareStatuses.has(clean(updates.status).toLowerCase()) ? clean(updates.status).toLowerCase() : 'active';
  if (updates.reviewed_at) updates.reviewed_at = toDate(updates.reviewed_at);
  const plan = await NursingCarePlan.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!plan) return res.status(404).json({ message: 'Care plan not found' });
  await audit(req, 'nursing.care_plan.updated', 'NursingCarePlan', plan.id, { status: plan.status });
  res.json(plan);
}));

router.get('/nursing/tasks', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await NursingShiftTask.find(listFilter(req)).sort({ due_at: 1, id: -1 }).limit(200).lean());
}));

router.post('/nursing/tasks', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const status = allowedTaskStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'open';
  const priority = allowedPriorities.has(clean(body.priority).toLowerCase()) ? clean(body.priority).toLowerCase() : 'normal';
  const task = await NursingShiftTask.create(tenantCreateData(req, {
    patient_id: clean(body.patient_id), ipd_admission_id: body.ipd_admission_id ? Number(body.ipd_admission_id) : undefined,
    title: clean(body.title), task_type: clean(body.task_type), priority, due_at: toDate(body.due_at), status,
    assigned_to: body.assigned_to ? Number(body.assigned_to) : undefined, notes: clean(body.notes), created_by: req.user?.id,
  }));
  if (!task.title) return res.status(400).json({ message: 'title is required' });
  await audit(req, 'nursing.task.created', 'NursingShiftTask', task.id, { status: task.status, priority: task.priority });
  res.status(201).json(task);
}));

router.patch('/nursing/tasks/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = allowedTaskStatuses.has(clean(updates.status).toLowerCase()) ? clean(updates.status).toLowerCase() : 'open';
  if (updates.priority) updates.priority = allowedPriorities.has(clean(updates.priority).toLowerCase()) ? clean(updates.priority).toLowerCase() : 'normal';
  if (updates.due_at) updates.due_at = toDate(updates.due_at);
  if (updates.status === 'completed' && !updates.completed_at) { updates.completed_at = new Date(); updates.completed_by = req.user?.id; }
  const task = await NursingShiftTask.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!task) return res.status(404).json({ message: 'Shift task not found' });
  await audit(req, 'nursing.task.updated', 'NursingShiftTask', task.id, { status: task.status });
  res.json(task);
}));

module.exports = router;
