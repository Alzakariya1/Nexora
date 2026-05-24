const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission, allowRoles } = require('../middleware/auth');
const { Hospital, CustomerSuccessNote, RenewalWorkflow, AuditLog } = require('../models');

const router = express.Router();

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 75;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function renewalRisk(renewalDate, healthScore = 75) {
  const days = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (healthScore < 45 || days < 15) return 'high';
  if (healthScore < 70 || days < 45) return 'medium';
  return 'low';
}

async function audit(req, action, details = {}) {
  try {
    await AuditLog.create({
      hospital_id: Number(details.hospital_id || req.user?.hospital_id || 1),
      user_id: req.user?.id,
      action,
      module: 'saas_customer_success',
      details,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    });
  } catch (_err) {}
}

router.get('/saas/customer-success/overview', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const [hospitals, openNotes, renewals] = await Promise.all([
    Hospital.find().select('id name hospital_code status plan subscription').lean(),
    CustomerSuccessNote.find({ status: { $ne: 'closed' } }).sort({ next_follow_up_at: 1 }).limit(100).lean(),
    RenewalWorkflow.find().sort({ renewal_date: 1 }).limit(100).lean(),
  ]);

  const byHospital = Object.fromEntries(hospitals.map((h) => [Number(h.id), h]));
  const upcomingRenewals = renewals.map((r) => ({
    ...r,
    hospital: byHospital[Number(r.hospital_id)] || null,
    risk_level: r.risk_level || renewalRisk(r.renewal_date, r.health_score),
  }));

  res.json({
    summary: {
      tenants: hospitals.length,
      open_success_notes: openNotes.length,
      high_risk_renewals: upcomingRenewals.filter((r) => r.risk_level === 'high').length,
      upcoming_renewals: upcomingRenewals.length,
    },
    openNotes,
    upcomingRenewals,
  });
}));

router.post('/saas/customer-success/notes', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.body.hospital_id);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Tenant not found' });
  if (!req.body.title) return res.status(400).json({ message: 'title is required' });

  const note = await CustomerSuccessNote.create({
    hospital_id: hospitalId,
    title: String(req.body.title).trim(),
    note: req.body.note || '',
    category: req.body.category || 'general',
    priority: req.body.priority || 'medium',
    status: req.body.status || 'open',
    next_follow_up_at: req.body.next_follow_up_at ? new Date(req.body.next_follow_up_at) : undefined,
    created_by: req.user?.id,
  });
  await audit(req, 'customer_success_note_created', { hospital_id: hospitalId, note_id: note.id, title: note.title });
  res.status(201).json(note);
}));

router.patch('/saas/customer-success/notes/:id', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const note = await CustomerSuccessNote.findOne({ id: Number(req.params.id) });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  ['title', 'note', 'category', 'priority', 'status'].forEach((key) => {
    if (req.body[key] !== undefined) note[key] = req.body[key];
  });
  if (req.body.next_follow_up_at !== undefined) note.next_follow_up_at = req.body.next_follow_up_at ? new Date(req.body.next_follow_up_at) : undefined;
  if (req.body.status === 'closed' && !note.closed_at) note.closed_at = new Date();
  await note.save();
  await audit(req, 'customer_success_note_updated', { hospital_id: note.hospital_id, note_id: note.id, status: note.status });
  res.json(note);
}));

router.post('/saas/renewals', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.body.hospital_id);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Tenant not found' });
  if (!req.body.renewal_date) return res.status(400).json({ message: 'renewal_date is required' });

  const healthScore = clampScore(req.body.health_score);
  const workflow = await RenewalWorkflow.create({
    hospital_id: hospitalId,
    renewal_date: new Date(req.body.renewal_date),
    stage: req.body.stage || 'upcoming',
    owner_id: req.body.owner_id,
    health_score: healthScore,
    risk_level: req.body.risk_level || renewalRisk(req.body.renewal_date, healthScore),
    action_items: Array.isArray(req.body.action_items) ? req.body.action_items : [],
    last_touch_at: req.body.last_touch_at ? new Date(req.body.last_touch_at) : undefined,
    notes: req.body.notes || '',
  });
  await audit(req, 'renewal_workflow_created', { hospital_id: hospitalId, renewal_id: workflow.id, risk_level: workflow.risk_level });
  res.status(201).json(workflow);
}));

router.patch('/saas/renewals/:id', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const workflow = await RenewalWorkflow.findOne({ id: Number(req.params.id) });
  if (!workflow) return res.status(404).json({ message: 'Renewal workflow not found' });
  ['stage', 'risk_level', 'notes'].forEach((key) => {
    if (req.body[key] !== undefined) workflow[key] = req.body[key];
  });
  if (req.body.health_score !== undefined) workflow.health_score = clampScore(req.body.health_score);
  if (req.body.renewal_date !== undefined) workflow.renewal_date = new Date(req.body.renewal_date);
  if (req.body.action_items !== undefined) workflow.action_items = Array.isArray(req.body.action_items) ? req.body.action_items : [];
  if (req.body.last_touch_at !== undefined) workflow.last_touch_at = req.body.last_touch_at ? new Date(req.body.last_touch_at) : undefined;
  if (!req.body.risk_level) workflow.risk_level = renewalRisk(workflow.renewal_date, workflow.health_score);
  await workflow.save();
  await audit(req, 'renewal_workflow_updated', { hospital_id: workflow.hospital_id, renewal_id: workflow.id, stage: workflow.stage, risk_level: workflow.risk_level });
  res.json(workflow);
}));

module.exports = router;
