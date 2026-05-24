const express = require('express');
const { CommunicationLog, CommunicationTemplate, CommunicationRule, Appointment, Patient, Doctor, Billing } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent, csvEscape } = require('../utils/audit');
const { CHANNELS, FINAL_STATUSES, channelEnabled, normalizeChannel, queueCommunication, nextRetryDate } = require('../utils/communication');

const router = express.Router();
router.use(verifyToken, attachTenant);

function activeChannels(input) {
  const list = Array.isArray(input) && input.length ? input : ['in_app'];
  return Array.from(new Set(list.map(normalizeChannel)));
}

function dateOnly(value) {
  return String(value || new Date().toISOString().slice(0, 10)).slice(0, 10);
}

router.get('/communications/summary', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const [total, queued, sent, delivered, read, failed, skipped, templates, rules, due] = await Promise.all([
    CommunicationLog.countDocuments(tenantFilter(req)),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'queued' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'sent' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'delivered' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'read' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'failed' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'skipped' })),
    CommunicationTemplate.countDocuments(tenantFilter(req)),
    CommunicationRule.countDocuments(tenantFilter(req, { is_active: true })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'queued', $or: [{ scheduled_for: { $exists: false } }, { scheduled_for: null }, { scheduled_for: { $lte: new Date() } }] })),
  ]);
  res.json({
    total, queued, sent, delivered, read, failed, skipped, templates, activeRules: rules, due,
    channels: CHANNELS.map((channel) => ({ channel, enabled: channelEnabled(channel) })),
  });
}));

router.get('/communications/logs', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.channel && req.query.channel !== 'all') query.channel = normalizeChannel(req.query.channel);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  if (req.query.module && req.query.module !== 'all') query.module = req.query.module;
  const rows = await CommunicationLog.find(tenantFilter(req, query)).sort({ id: -1 }).limit(Math.min(Number(req.query.limit || 100), 500));
  res.json(rows);
}));

router.post('/communications/send', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  if (!String(req.body.title || req.body.template_key || '').trim()) return res.status(400).json({ message: 'Title or approved template key is required' });
  if (!String(req.body.message || req.body.template_key || '').trim()) return res.status(400).json({ message: 'Message or approved template key is required' });
  const channels = activeChannels(req.body.channels || [req.body.channel]);
  const logs = [];
  for (const channel of channels) logs.push(await queueCommunication(req, { ...req.body, channel }));
  await auditEvent({ req, action: `Queued communication: ${req.body.title || req.body.template_key || 'Untitled'}`, module_name: 'communications', entity_type: req.body.entity_type || 'communication', entity_id: logs.map((x) => x.id).join(',') });
  res.status(201).json({ message: 'Communication queued', logs });
}));

router.get('/communications/templates', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.channel && req.query.channel !== 'all') query.channel = normalizeChannel(req.query.channel);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  const rows = await CommunicationTemplate.find(tenantFilter(req, query)).sort({ id: -1 }).limit(300);
  res.json(rows);
}));

router.post('/communications/templates', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const template_key = String(req.body.template_key || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  if (!template_key) return res.status(400).json({ message: 'Template key is required' });
  const channel = normalizeChannel(req.body.channel);
  const payload = tenantCreateData(req, {
    template_key,
    name: req.body.name || template_key,
    channel,
    category: req.body.category || 'general',
    title_template: req.body.title_template || req.body.title || '',
    message_template: req.body.message_template || req.body.message || '',
    variables: Array.isArray(req.body.variables) ? req.body.variables.map(String) : [],
    provider_template_id: req.body.provider_template_id || null,
    language: req.body.language || 'en',
    status: req.body.status || 'draft',
    approval_notes: req.body.approval_notes || '',
    created_by: req.user?.id || null,
    updated_by: req.user?.id || null,
  });
  const row = await CommunicationTemplate.findOneAndUpdate(tenantFilter(req, { template_key, channel }), { $set: payload, $inc: { version: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  await auditEvent({ req, action: `Upserted communication template ${template_key}`, module_name: 'communications', entity_type: 'communication_template', entity_id: row.id });
  res.status(201).json({ message: 'Template saved', template: row });
}));

router.patch('/communications/templates/:id/approve', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const row = await CommunicationTemplate.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'approved', approval_notes: req.body.approval_notes || '', updated_by: req.user?.id || null }, $inc: { version: 1 } }, { new: true });
  if (!row) return res.status(404).json({ message: 'Template not found' });
  await auditEvent({ req, action: 'Approved communication template', module_name: 'communications', entity_type: 'communication_template', entity_id: row.id });
  res.json({ message: 'Template approved', template: row });
}));

router.get('/communications/rules', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const rows = await CommunicationRule.find(tenantFilter(req)).sort({ id: -1 }).limit(300);
  res.json(rows);
}));

router.post('/communications/rules', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const event_type = String(req.body.event_type || '').trim();
  if (!event_type) return res.status(400).json({ message: 'Event type is required' });
  const row = await CommunicationRule.create(tenantCreateData(req, {
    name: req.body.name || event_type,
    event_type,
    channels: activeChannels(req.body.channels),
    template_key: req.body.template_key || null,
    offset_minutes: Number(req.body.offset_minutes || 0),
    is_active: req.body.is_active !== false,
    audience: req.body.audience || 'patient',
    module: req.body.module || 'system',
    conditions: req.body.conditions || {},
    created_by: req.user?.id || null,
    updated_by: req.user?.id || null,
  }));
  await auditEvent({ req, action: `Created communication rule ${event_type}`, module_name: 'communications', entity_type: 'communication_rule', entity_id: row.id });
  res.status(201).json({ message: 'Rule saved', rule: row });
}));

router.patch('/communications/rules/:id', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const update = { ...req.body, updated_by: req.user?.id || null };
  if (req.body.channels) update.channels = activeChannels(req.body.channels);
  const row = await CommunicationRule.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), { $set: update }, { new: true });
  if (!row) return res.status(404).json({ message: 'Rule not found' });
  await auditEvent({ req, action: 'Updated communication rule', module_name: 'communications', entity_type: 'communication_rule', entity_id: row.id });
  res.json({ message: 'Rule updated', rule: row });
}));

router.post('/communications/appointment-reminders', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const date = dateOnly(req.body.date);
  const channels = activeChannels(req.body.channels);
  const appointments = await Appointment.find(tenantFilter(req, { appointment_date: date, status: { $in: ['scheduled', 'checked_in'] } })).lean();
  const patientIds = [...new Set(appointments.map((a) => a.patient_id).filter(Boolean))];
  const doctorIds = [...new Set(appointments.map((a) => a.doctor_id).filter(Boolean))];
  const [patients, doctors] = await Promise.all([
    Patient.find(tenantFilter(req, { patient_id: { $in: patientIds } })).lean(),
    Doctor.find(tenantFilter(req, { doctor_id: { $in: doctorIds } })).lean(),
  ]);
  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, p]));
  const doctorMap = Object.fromEntries(doctors.map((d) => [d.doctor_id, d]));
  const logs = [];
  for (const appointment of appointments) {
    const patient = patientMap[appointment.patient_id] || {};
    const doctor = doctorMap[appointment.doctor_id] || {};
    const variables = { patient, doctor, appointment };
    for (const channel of channels) {
      logs.push(await queueCommunication(req, {
        channel,
        template_key: req.body.template_key || 'appointment_reminder',
        variables,
        recipient_type: 'patient',
        recipient_id: appointment.patient_id,
        recipient_name: patient.full_name || appointment.patient_name || 'Patient',
        recipient_contact: channel === 'email' ? patient.email : patient.phone,
        title: 'Appointment reminder',
        message: `Reminder: appointment on ${appointment.appointment_date} at ${appointment.appointment_time || '-'} with ${doctor.full_name || 'doctor'}. Token: ${appointment.token_number || '-'}`,
        module: 'appointments',
        entity_type: 'appointment',
        entity_id: appointment.id,
        consent_checked: true,
      }));
    }
  }
  await auditEvent({ req, action: `Queued appointment reminders for ${date}`, module_name: 'communications', entity_type: 'appointment', entity_id: date, new_value: { appointments: appointments.length, logs: logs.length } });
  res.json({ message: 'Appointment reminders processed', appointments: appointments.length, logs });
}));

router.post('/communications/payment-due-reminders', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const channels = activeChannels(req.body.channels);
  const bills = await Billing.find(tenantFilter(req, { status: { $in: ['unpaid', 'partial', 'pending'] } })).sort({ id: -1 }).limit(200).lean();
  const patientIds = [...new Set(bills.map((b) => b.patient_id).filter(Boolean))];
  const patients = await Patient.find(tenantFilter(req, { patient_id: { $in: patientIds } })).lean();
  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, p]));
  const logs = [];
  for (const bill of bills) {
    const patient = patientMap[bill.patient_id] || {};
    const due = Number(bill.total_amount || bill.amount || 0) - Number(bill.paid_amount || 0);
    if (due <= 0) continue;
    for (const channel of channels) logs.push(await queueCommunication(req, {
      channel,
      template_key: req.body.template_key || 'payment_due',
      variables: { patient, bill, due },
      recipient_type: 'patient',
      recipient_id: bill.patient_id,
      recipient_name: patient.full_name || bill.patient_name || 'Patient',
      recipient_contact: channel === 'email' ? patient.email : patient.phone,
      title: 'Payment due reminder',
      message: `Payment reminder: bill ${bill.bill_number || bill.id} has outstanding amount ${due}.`,
      module: 'billing',
      entity_type: 'bill',
      entity_id: bill.id,
      consent_checked: true,
    }));
  }
  await auditEvent({ req, action: 'Queued payment due reminders', module_name: 'communications', entity_type: 'billing', new_value: { bills: bills.length, logs: logs.length } });
  res.json({ message: 'Payment reminders processed', bills: bills.length, logs });
}));

router.get('/communications/due', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const rows = await CommunicationLog.find(tenantFilter(req, { status: 'queued', $or: [{ scheduled_for: { $exists: false } }, { scheduled_for: null }, { scheduled_for: { $lte: new Date() } }] })).sort({ id: 1 }).limit(Math.min(Number(req.query.limit || 100), 500));
  res.json(rows);
}));

router.post('/communications/:id/mark-sent', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const row = await CommunicationLog.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id), status: { $in: ['queued', 'failed'] } }), { $set: { status: 'sent', sent_at: new Date(), provider_message_id: req.body.provider_message_id || null, provider_status: 'sent', error_message: null } }, { new: true });
  if (!row) return res.status(404).json({ message: 'Queued communication log not found' });
  await auditEvent({ req, action: 'Marked communication as sent', module_name: 'communications', entity_type: 'communication_log', entity_id: row.id });
  res.json({ message: 'Communication marked sent', row });
}));

router.post('/communications/:id/mark-failed', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const row = await CommunicationLog.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'failed', error_message: req.body.error_message || 'Delivery failed', next_retry_at: nextRetryDate(req.body.retry_count), provider_status: 'failed' } }, { new: true });
  if (!row) return res.status(404).json({ message: 'Communication log not found' });
  await auditEvent({ req, action: 'Marked communication as failed', module_name: 'communications', entity_type: 'communication_log', entity_id: row.id });
  res.json({ message: 'Communication marked failed', row });
}));

router.post('/communications/:id/retry', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const existing = await CommunicationLog.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing) return res.status(404).json({ message: 'Communication log not found' });
  if (FINAL_STATUSES.includes(existing.status) && existing.status !== 'skipped') return res.status(400).json({ message: 'Finalized communication cannot be retried' });
  existing.status = channelEnabled(existing.channel) ? 'queued' : 'skipped';
  existing.retry_count = Number(existing.retry_count || 0) + 1;
  existing.next_retry_at = null;
  existing.error_message = existing.status === 'skipped' ? `${String(existing.channel).toUpperCase()} provider is not configured.` : null;
  await existing.save();
  await auditEvent({ req, action: 'Retried communication', module_name: 'communications', entity_type: 'communication_log', entity_id: existing.id });
  res.json({ message: 'Communication retry queued', row: existing });
}));

router.post('/communications/provider-callback', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const provider_message_id = req.body.provider_message_id || req.body.message_id;
  if (!provider_message_id) return res.status(400).json({ message: 'provider_message_id is required' });
  const statusMap = { delivered: 'delivered', read: 'read', sent: 'sent', failed: 'failed' };
  const status = statusMap[String(req.body.status || '').toLowerCase()] || 'sent';
  const update = { provider_status: req.body.status, provider_payload: req.body, status };
  if (status === 'delivered') update.delivered_at = new Date();
  if (status === 'read') update.read_at = new Date();
  if (status === 'sent') update.sent_at = new Date();
  if (status === 'failed') update.error_message = req.body.error_message || 'Provider callback marked failed';
  const row = await CommunicationLog.findOneAndUpdate(tenantFilter(req, { provider_message_id }), { $set: update }, { new: true });
  if (!row) return res.status(404).json({ message: 'Provider message not found' });
  await auditEvent({ req, action: `Communication provider callback ${status}`, module_name: 'communications', entity_type: 'communication_log', entity_id: row.id });
  res.json({ message: 'Provider callback recorded', row });
}));

router.get('/communications/export.csv', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const rows = await CommunicationLog.find(tenantFilter(req)).sort({ id: -1 }).limit(2000).lean();
  const header = ['id','channel','recipient_type','recipient_name','recipient_contact','title','template_key','module','status','provider_status','retry_count','scheduled_for','created_at','sent_at','delivered_at','read_at'];
  const csv = [header.join(',')].concat(rows.map((r) => header.map((key) => csvEscape(r[key])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="communication-logs.csv"');
  res.send(csv);
}));

module.exports = router;
