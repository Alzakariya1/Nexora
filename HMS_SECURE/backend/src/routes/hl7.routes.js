const express = require('express');
const crypto = require('crypto');
const { HL7Message, Patient, Appointment, LabTest, RadiologyTest, IntegrationLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const field = (v = '') => String(v ?? '').replace(/[|^~\\&\r\n]/g, ' ').trim();
const ts = () => new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const uid = (prefix = 'HL7') => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const ack = (controlId, code = 'AA', text = 'Accepted') => [`MSH|^~\\&|HMS|HOSPITAL|CLIENT|CLIENT|${ts()}||ACK|${uid('ACK')}|P|2.5`, `MSA|${code}|${field(controlId)}|${field(text)}`].join('\r');

function parseHL7(raw = '') {
  const lines = String(raw || '').split(/\r?\n|\r/).map(x => x.trim()).filter(Boolean);
  const segments = lines.map(line => {
    const [name, ...fields] = line.split('|');
    return { name, fields };
  });
  const msh = segments.find(s => s.name === 'MSH');
  const pid = segments.find(s => s.name === 'PID');
  const obr = segments.find(s => s.name === 'OBR');
  const obx = segments.filter(s => s.name === 'OBX');
  const type = msh?.fields?.[7] || '';
  const [message_type, trigger_event] = String(type).split('^');
  return {
    message_type: message_type || type || 'UNKNOWN',
    trigger_event: trigger_event || '',
    control_id: msh?.fields?.[8] || uid('CTRL'),
    patient_identifier: pid?.fields?.[2] || pid?.fields?.[3] || '',
    patient_name: pid?.fields?.[4] || '',
    order_identifier: obr?.fields?.[1] || obr?.fields?.[2] || '',
    observations: obx.map(x => ({ set_id: x.fields[0], value_type: x.fields[1], code: x.fields[2], value: x.fields[4], units: x.fields[5], reference_range: x.fields[6], abnormal_flag: x.fields[7] })),
    segments,
  };
}

function patientSegment(p = {}) {
  return `PID|1||${field(p.patient_id || p.id)}||${field(p.full_name || 'Unknown')}||${field(p.dob || '')}|${field(String(p.gender || '').slice(0,1).toUpperCase())}|||${field(p.address || '')}||${field(p.phone || '')}||${field(p.email || '')}`;
}
function appointmentToADT(a = {}, p = {}) {
  const controlId = uid('ADT');
  const msgType = a.status === 'checked_in' ? 'ADT^A04' : a.status === 'admitted' ? 'ADT^A01' : 'ADT^A08';
  return [`MSH|^~\\&|HMS|${field(a.hospital_id || p.hospital_id || 1)}|EXT|CLIENT|${ts()}||${msgType}|${controlId}|P|2.5`, patientSegment(p), `PV1|1|O|${field(a.department || '')}|||${field(a.doctor_id || '')}|||||||||||${field(a.id || '')}`].join('\r');
}
function appointmentToORM(a = {}, p = {}) {
  const controlId = uid('ORM');
  return [`MSH|^~\\&|HMS|${field(a.hospital_id || p.hospital_id || 1)}|EXT|CLIENT|${ts()}||ORM^O01|${controlId}|P|2.5`, patientSegment(p), `ORC|NW|${field(a.id || '')}|||||^^^${field(a.appointment_date || '')}^${field(a.appointment_time || '')}`, `OBR|1|${field(a.id || '')}||${field(a.appointment_type || 'CONSULT')}^${field(a.notes || 'Consultation')}|||${field(a.appointment_date || '')}`].join('\r');
}
function labToORU(t = {}, p = {}) {
  const controlId = uid('ORU');
  const components = Array.isArray(t.result_parameters) ? t.result_parameters : [];
  const obx = components.length ? components.map((x, i) => `OBX|${i+1}|ST|${field(x.name || x.parameter || 'Result')}||${field(x.value || x.result || '')}|${field(x.unit || '')}|${field(x.normal_range || x.reference_range || '')}|||F`) : [`OBX|1|ST|${field(t.test_name || 'Result')}||${field(t.result_summary || t.interpretation || t.report_notes || '')}|||||F`];
  return [`MSH|^~\\&|HMS|${field(t.hospital_id || p.hospital_id || 1)}|EXT|CLIENT|${ts()}||ORU^R01|${controlId}|P|2.5`, patientSegment(p), `OBR|1|${field(t.id || '')}|${field(t.accession_number || '')}|${field(t.test_name || 'Lab Test')}|||${field(t.created_at || '')}`, ...obx].join('\r');
}
function validateType(type) {
  const supported = ['ADT^A01', 'ADT^A04', 'ADT^A08', 'ORM^O01', 'ORU^R01'];
  return supported.includes(type);
}
async function writeIntegrationLog(req, data) {
  return IntegrationLog.create(tenantCreateData(req, { system: 'hl7', ip_address: req.ip, ...data }));
}

router.get('/hl7/summary', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  const [total, queued, sent, failed, recent] = await Promise.all([
    HL7Message.countDocuments(filter), HL7Message.countDocuments({ ...filter, status: 'queued' }), HL7Message.countDocuments({ ...filter, status: 'sent' }), HL7Message.countDocuments({ ...filter, status: 'failed' }), HL7Message.find(filter).sort({ created_at: -1 }).limit(25).lean(),
  ]);
  res.json({ total, queued, sent, failed, recent });
}));

router.get('/hl7/messages', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req, req.query.status ? { status: req.query.status } : {});
  res.json(await HL7Message.find(filter).sort({ created_at: -1 }).limit(200));
}));

router.post('/hl7/parse', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const parsed = parseHL7(req.body.raw_message || req.body.message || '');
  await writeIntegrationLog(req, { direction: 'inbound', resource_type: parsed.message_type, method: 'POST', endpoint: '/hl7/parse', status: 'success', request_payload: { control_id: parsed.control_id } });
  res.json({ valid: Boolean(parsed.message_type), parsed });
}));

router.post('/hl7/generate', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const type = req.body.message_type || 'ADT^A04';
  if (!validateType(type)) return res.status(400).json({ message: 'Unsupported HL7 message type.', supported: ['ADT^A01','ADT^A04','ADT^A08','ORM^O01','ORU^R01'] });
  let raw = '';
  let patient = null;
  if (req.body.patient_id) patient = await Patient.findOne(tenantFilter(req, { id: Number(req.body.patient_id) })).lean();
  if (type.startsWith('ADT')) raw = appointmentToADT(req.body, patient || req.body.patient || {});
  if (type === 'ORM^O01') raw = appointmentToORM(req.body, patient || req.body.patient || {});
  if (type === 'ORU^R01') raw = labToORU(req.body, patient || req.body.patient || {});
  res.json({ message_type: type, raw_message: raw, parsed: parseHL7(raw) });
}));

router.post('/hl7/messages', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const raw = req.body.raw_message || req.body.message || '';
  const parsed = raw ? parseHL7(raw) : { message_type: (req.body.message_type || 'ADT'), trigger_event: (req.body.trigger_event || '').replace('^',''), control_id: req.body.control_id || uid('CTRL') };
  const canonicalType = parsed.trigger_event ? `${parsed.message_type}^${parsed.trigger_event}` : req.body.message_type;
  const doc = await HL7Message.create(tenantCreateData(req, {
    message_uid: uid('MSG'), message_type: canonicalType || parsed.message_type, trigger_event: parsed.trigger_event, control_id: parsed.control_id,
    direction: req.body.direction || 'outbound', status: req.body.status || 'queued', patient_id: req.body.patient_id, appointment_id: req.body.appointment_id, lab_test_id: req.body.lab_test_id,
    source_module: req.body.source_module || 'integration', endpoint: req.body.endpoint, raw_message: raw, parsed_payload: parsed, queued_at: new Date(), created_by: req.user?.id,
  }));
  await writeIntegrationLog(req, { direction: doc.direction, resource_type: doc.message_type, method: 'POST', endpoint: '/hl7/messages', status: doc.status, request_payload: { id: doc.id, control_id: doc.control_id } });
  auditEvent({ req, action: 'HL7 message queued', module_name: 'integration', status: 'success', severity: 'info', metadata: { id: doc.id, message_type: doc.message_type } });
  res.status(201).json(doc);
}));

router.post('/hl7/messages/:id/ack', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const msg = await HL7Message.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!msg) return res.status(404).json({ message: 'HL7 message not found.' });
  const code = req.body.ack_code || 'AA';
  msg.ack_code = code;
  msg.ack_message = req.body.ack_message || (code === 'AA' ? 'Accepted' : 'Rejected');
  msg.status = code === 'AA' ? 'sent' : 'failed';
  msg.sent_at = code === 'AA' ? new Date() : msg.sent_at;
  msg.failed_at = code !== 'AA' ? new Date() : msg.failed_at;
  await msg.save();
  res.json({ message: msg, ack: ack(msg.control_id, code, msg.ack_message) });
}));

router.post('/hl7/messages/:id/retry', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const msg = await HL7Message.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!msg) return res.status(404).json({ message: 'HL7 message not found.' });
  if (msg.retry_count >= msg.max_retries) return res.status(400).json({ message: 'Maximum retries reached.' });
  msg.retry_count += 1;
  msg.status = 'queued';
  msg.next_retry_at = new Date(Date.now() + Math.min(60, msg.retry_count * 15) * 60 * 1000);
  msg.last_error = req.body.last_error || msg.last_error;
  await msg.save();
  res.json(msg);
}));

router.post('/hl7/adt/from-appointment/:id', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const a = await Appointment.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!a) return res.status(404).json({ message: 'Appointment not found.' });
  const p = await Patient.findOne(tenantFilter(req, { id: Number(a.patient_id) })).lean();
  const raw = appointmentToADT(a, p || {});
  req.body.raw_message = raw; req.body.message_type = parseHL7(raw).message_type;
  const parsed = parseHL7(raw);
  const doc = await HL7Message.create(tenantCreateData(req, { message_uid: uid('MSG'), message_type: 'ADT^' + parsed.trigger_event, trigger_event: parsed.trigger_event, control_id: parsed.control_id, direction: 'outbound', status: 'queued', appointment_id: a.id, patient_id: a.patient_id, source_module: 'appointments', raw_message: raw, parsed_payload: parsed, queued_at: new Date(), created_by: req.user?.id }));
  res.status(201).json(doc);
}));

router.post('/hl7/orm/from-appointment/:id', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const a = await Appointment.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!a) return res.status(404).json({ message: 'Appointment not found.' });
  const p = await Patient.findOne(tenantFilter(req, { id: Number(a.patient_id) })).lean();
  const raw = appointmentToORM(a, p || {}); const parsed = parseHL7(raw);
  const doc = await HL7Message.create(tenantCreateData(req, { message_uid: uid('MSG'), message_type: 'ORM^O01', trigger_event: 'O01', control_id: parsed.control_id, direction: 'outbound', status: 'queued', appointment_id: a.id, patient_id: a.patient_id, source_module: 'appointments', raw_message: raw, parsed_payload: parsed, queued_at: new Date(), created_by: req.user?.id }));
  res.status(201).json(doc);
}));

router.post('/hl7/oru/from-lab/:id', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const lab = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!lab) return res.status(404).json({ message: 'Lab test not found.' });
  const p = await Patient.findOne(tenantFilter(req, { id: Number(lab.patient_id) })).lean();
  const raw = labToORU(lab, p || {}); const parsed = parseHL7(raw);
  const doc = await HL7Message.create(tenantCreateData(req, { message_uid: uid('MSG'), message_type: 'ORU^R01', trigger_event: 'R01', control_id: parsed.control_id, direction: 'outbound', status: 'queued', lab_test_id: lab.id, patient_id: lab.patient_id, source_module: 'lab', raw_message: raw, parsed_payload: parsed, queued_at: new Date(), created_by: req.user?.id }));
  res.status(201).json(doc);
}));

module.exports = router;
