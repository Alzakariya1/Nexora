const express = require('express');
const { CommunicationLog, Appointment, Patient, Doctor } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter } = require('../middleware/tenant');
const { auditEvent, csvEscape } = require('../utils/audit');
const { CHANNELS, channelEnabled, queueCommunication } = require('../utils/communication');

const router = express.Router();
router.use(verifyToken, attachTenant);

router.get('/communications/summary', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const [total, queued, sent, failed, skipped] = await Promise.all([
    CommunicationLog.countDocuments(tenantFilter(req)),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'queued' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'sent' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'failed' })),
    CommunicationLog.countDocuments(tenantFilter(req, { status: 'skipped' })),
  ]);
  res.json({
    total, queued, sent, failed, skipped,
    channels: CHANNELS.map((channel) => ({ channel, enabled: channelEnabled(channel) })),
  });
}));

router.get('/communications/logs', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.channel && req.query.channel !== 'all') query.channel = req.query.channel;
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  const rows = await CommunicationLog.find(tenantFilter(req, query)).sort({ id: -1 }).limit(Math.min(Number(req.query.limit || 100), 500));
  res.json(rows);
}));

router.post('/communications/send', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const channels = Array.isArray(req.body.channels) && req.body.channels.length ? req.body.channels : [req.body.channel || 'in_app'];
  const logs = [];
  for (const channel of channels) {
    logs.push(await queueCommunication(req, { ...req.body, channel }));
  }
  await auditEvent({ req, action: `Queued communication: ${req.body.title || 'Untitled'}`, module_name: 'communications', entity_type: req.body.entity_type || 'communication', entity_id: logs.map((x) => x.id).join(',') });
  res.status(201).json({ message: 'Communication queued', logs });
}));

router.post('/communications/appointment-reminders', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const channels = Array.isArray(req.body.channels) && req.body.channels.length ? req.body.channels : ['in_app'];
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
    for (const channel of channels) {
      logs.push(await queueCommunication(req, {
        channel,
        recipient_type: 'patient',
        recipient_id: appointment.patient_id,
        recipient_name: patient.full_name || appointment.patient_name || 'Patient',
        recipient_contact: channel === 'email' ? patient.email : patient.phone,
        title: 'Appointment reminder',
        message: `Reminder: appointment on ${appointment.appointment_date} at ${appointment.appointment_time || '-'} with ${doctor.full_name || 'doctor'}. Token: ${appointment.token_number || '-'}`,
        module: 'appointments',
        entity_type: 'appointment',
        entity_id: appointment.id,
      }));
    }
  }
  await auditEvent({ req, action: `Queued appointment reminders for ${date}`, module_name: 'communications', entity_type: 'appointment', entity_id: date, new_value: { appointments: appointments.length, logs: logs.length } });
  res.json({ message: 'Appointment reminders processed', appointments: appointments.length, logs });
}));

router.post('/communications/:id/mark-sent', requirePermission('communication.manage'), asyncHandler(async (req, res) => {
  const row = await CommunicationLog.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'sent', sent_at: new Date(), provider_message_id: req.body.provider_message_id || null } }, { new: true });
  if (!row) return res.status(404).json({ message: 'Communication log not found' });
  await auditEvent({ req, action: 'Marked communication as sent', module_name: 'communications', entity_type: 'communication_log', entity_id: row.id });
  res.json({ message: 'Communication marked sent', row });
}));

router.get('/communications/export.csv', requirePermission('communication.view'), asyncHandler(async (req, res) => {
  const rows = await CommunicationLog.find(tenantFilter(req)).sort({ id: -1 }).limit(2000).lean();
  const header = ['id','channel','recipient_type','recipient_name','recipient_contact','title','module','status','created_at','sent_at'];
  const csv = [header.join(',')].concat(rows.map((r) => header.map((key) => csvEscape(r[key])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="communication-logs.csv"');
  res.send(csv);
}));

module.exports = router;
