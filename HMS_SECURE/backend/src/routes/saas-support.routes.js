const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission, allowRoles } = require('../middleware/auth');
const { Hospital, SupportTicket, AuditLog } = require('../models');

const router = express.Router();
const PRIORITY_SLA = { low: 72, medium: 24, high: 8, critical: 4 };
const VALID_STATUS = new Set(['open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed']);

function slaHours(priority, requested) {
  const n = Number(requested);
  if (Number.isFinite(n) && n > 0 && n <= 720) return Math.round(n);
  return PRIORITY_SLA[String(priority || 'medium').toLowerCase()] || 24;
}
function dueDate(hours) { return new Date(Date.now() + hours * 60 * 60 * 1000); }
function isBreached(ticket) { return !['resolved','closed'].includes(ticket.status) && ticket.sla_due_at && new Date(ticket.sla_due_at).getTime() < Date.now(); }
async function audit(req, action, details = {}) {
  try { await AuditLog.create({ hospital_id: Number(details.hospital_id || req.user?.hospital_id || 1), user_id: req.user?.id, action, module: 'saas_support', details, ip: req.ip, user_agent: req.get('user-agent') }); } catch (_err) {}
}

router.get('/saas/support/overview', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const [hospitals, tickets] = await Promise.all([
    Hospital.find().select('id name hospital_code status plan subscription').lean(),
    SupportTicket.find().sort({ sla_due_at: 1, created_at: -1 }).limit(200).lean(),
  ]);
  const byHospital = Object.fromEntries(hospitals.map((h) => [Number(h.id), h]));
  const enriched = tickets.map((t) => ({ ...t, hospital: byHospital[Number(t.hospital_id)] || null, sla_breached: isBreached(t) }));
  res.json({
    summary: {
      tenants: hospitals.length,
      open_tickets: enriched.filter((t) => !['resolved','closed'].includes(t.status)).length,
      escalated_tickets: enriched.filter((t) => t.escalated || t.status === 'escalated').length,
      sla_breached: enriched.filter((t) => t.sla_breached).length,
    },
    tickets: enriched,
  });
}));

router.post('/saas/support/tickets', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.body.hospital_id);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Tenant not found' });
  if (!req.body.subject) return res.status(400).json({ message: 'subject is required' });
  const priority = req.body.priority || 'medium';
  const hours = slaHours(priority, req.body.sla_hours);
  const ticket = await SupportTicket.create({
    hospital_id: hospitalId,
    ticket_no: `SUP-${hospitalId}-${Date.now()}`,
    subject: String(req.body.subject).trim(),
    description: req.body.description || '',
    category: req.body.category || 'general',
    priority,
    status: VALID_STATUS.has(req.body.status) ? req.body.status : 'open',
    sla_hours: hours,
    sla_due_at: req.body.sla_due_at ? new Date(req.body.sla_due_at) : dueDate(hours),
    assigned_to: req.body.assigned_to,
    created_by: req.user?.id,
  });
  await audit(req, 'support_ticket_created', { hospital_id: hospitalId, ticket_id: ticket.id, ticket_no: ticket.ticket_no, priority: ticket.priority });
  res.status(201).json(ticket);
}));

router.patch('/saas/support/tickets/:id', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({ id: Number(req.params.id) });
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });
  ['subject','description','category','priority','assigned_to','resolution_notes'].forEach((key) => { if (req.body[key] !== undefined) ticket[key] = req.body[key]; });
  if (req.body.status !== undefined) {
    if (!VALID_STATUS.has(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
    ticket.status = req.body.status;
    if (['resolved','closed'].includes(ticket.status) && !ticket.closed_at) ticket.closed_at = new Date();
  }
  if (req.body.sla_hours !== undefined) ticket.sla_hours = slaHours(ticket.priority, req.body.sla_hours);
  if (req.body.sla_due_at !== undefined) ticket.sla_due_at = req.body.sla_due_at ? new Date(req.body.sla_due_at) : undefined;
  if (req.body.comment) ticket.comments.push({ note: String(req.body.comment), user_id: req.user?.id, created_at: new Date() });
  ticket.last_response_at = new Date();
  await ticket.save();
  await audit(req, 'support_ticket_updated', { hospital_id: ticket.hospital_id, ticket_id: ticket.id, status: ticket.status });
  res.json({ ...ticket.toJSON(), sla_breached: isBreached(ticket) });
}));

router.post('/saas/support/tickets/:id/escalate', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({ id: Number(req.params.id) });
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });
  ticket.escalated = true;
  ticket.escalated_at = new Date();
  ticket.status = 'escalated';
  if (req.body.comment) ticket.comments.push({ note: String(req.body.comment), user_id: req.user?.id, type: 'escalation', created_at: new Date() });
  await ticket.save();
  await audit(req, 'support_ticket_escalated', { hospital_id: ticket.hospital_id, ticket_id: ticket.id, ticket_no: ticket.ticket_no });
  res.json(ticket);
}));

module.exports = router;
