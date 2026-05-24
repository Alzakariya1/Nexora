const express = require('express');
const { LabTestTemplate, LabTest, RadiologyTest, Patient, Doctor, OpdRecord } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { createNotification } = require('../utils/notifications');
const { auditEvent } = require('../utils/audit');
const { normalizeClinicalReferences } = require('../utils/refResolver');

const router = express.Router();
router.use(verifyToken, attachTenant);

const LAB_STATUSES = ['ordered', 'sample_collected', 'received', 'processing', 'result_entered', 'verified', 'approved', 'completed', 'rejected', 'cancelled', 'archived'];
const RAD_STATUSES = ['ordered', 'scheduled', 'scanned', 'reported', 'approved', 'cancelled', 'archived'];

function text(value) { return String(value || '').trim(); }
function requireFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (!text(value)) {
      const err = new Error(`${key.replaceAll('_', ' ')} is required`);
      err.status = 400;
      throw err;
    }
  }
}
function patientOrderFilter(req, query = {}) {
  return tenantFilter(req, { ...query, test_status: { $ne: 'archived' } });
}
function radiologyOrderFilter(req, query = {}) {
  return tenantFilter(req, { ...query, status: { $ne: 'archived' } });
}

function code(prefix) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${d}-${Date.now().toString().slice(-6)}`;
}

async function withNames(req, rows) {
  const plain = rows.map(r => r.toJSON ? r.toJSON() : r);
  const patientIds = [...new Set(plain.map(x => x.patient_id).filter(Boolean))];
  const doctorIds = [...new Set(plain.map(x => x.doctor_id).filter(Boolean))];

  const patients = patientIds.length ? await Patient.find(tenantFilter(req, {
    $or: [
      { id: { $in: patientIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { patient_id: { $in: patientIds } },
    ],
  })).lean() : [];

  const doctors = doctorIds.length ? await Doctor.find(tenantFilter(req, {
    $or: [
      { id: { $in: doctorIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { doctor_id: { $in: doctorIds } },
    ],
  })).lean() : [];

  const pm = Object.fromEntries([...patients.map(p => [String(p.id), p.full_name]), ...patients.map(p => [String(p.patient_id), p.full_name])]);
  const dm = Object.fromEntries([...doctors.map(d => [String(d.id), d.full_name]), ...doctors.map(d => [String(d.doctor_id), d.full_name])]);
  return plain.map(x => ({ ...x, patient_name: pm[String(x.patient_id)], doctor_name: dm[String(x.doctor_id)] }));
}


function isCriticalParameter(p = {}) {
  const flag = String(p.flag || '').toLowerCase();
  const value = Number(p.result_value ?? p.value);
  const criticalLow = p.critical_low !== undefined ? Number(p.critical_low) : undefined;
  const criticalHigh = p.critical_high !== undefined ? Number(p.critical_high) : undefined;
  return flag === 'critical' || (!Number.isNaN(value) && ((criticalLow !== undefined && value < criticalLow) || (criticalHigh !== undefined && value > criticalHigh)));
}
function tatHours(row = {}) {
  const start = row.sample_collected_at || row.created_at;
  const end = row.approved_at || row.completed_at || row.updated_at;
  if (!start || !end) return null;
  const hours = (new Date(end) - new Date(start)) / 36e5;
  return Number.isFinite(hours) ? Number(hours.toFixed(2)) : null;
}

function parameterRows(body) {
  if (Array.isArray(body.parameters)) return body.parameters;
  if (Array.isArray(body.result_parameters)) return body.result_parameters;
  return [];
}

async function buildLabPayload(req, overrides = {}) {
  requireFields({ patient_id: req.body.patient_id || req.body.appointment_id, test_name: req.body.test_name || req.body.name || req.body.test || req.body.template_id });
  const { normalized } = await normalizeClinicalReferences(req, req.body, { requirePatient: true, requireDoctor: false });
  const templateId = req.body.template_id ? Number(req.body.template_id) : undefined;
  const template = templateId ? await LabTestTemplate.findOne(tenantFilter(req, { id: templateId })).lean() : null;
  const baseParameters = parameterRows(req.body).length ? parameterRows(req.body) : (template?.parameters || []);
  return tenantCreateData(req, {
    patient_id: normalized.patient_id,
    patient_uid: normalized.patient_uid,
    patient_name: normalized.patient_name,
    doctor_id: normalized.doctor_id || '',
    doctor_name: normalized.doctor_name || '',
    appointment_id: normalized.appointment_id,
    opd_id: req.body.opd_id ? Number(req.body.opd_id) : undefined,
    template_id: templateId,
    test_name: req.body.test_name || template?.test_name || req.body.name || req.body.test || 'Lab Test',
    test_category: req.body.test_category || template?.test_category || req.body.category || 'General',
    sample_type: req.body.sample_type || template?.sample_type || 'Blood',
    sample_barcode: req.body.sample_barcode || code('LAB-SMP'),
    accession_number: req.body.accession_number || code('LAB-ACC'),
    machine_order_id: req.body.machine_order_id || '',
    priority: req.body.priority || 'routine',
    test_status: req.body.test_status || 'ordered',
    result_parameters: baseParameters.map(p => ({ ...p, result_value: p.result_value || '', flag: p.flag || 'normal' })),
    notes: req.body.notes || '',
    ...overrides,
  });
}

async function cleanRadPayload(req, overrides = {}) {
  requireFields({ patient_id: req.body.patient_id || req.body.appointment_id, scan_name: req.body.scan_name || req.body.name || req.body.scan });
  const { normalized } = await normalizeClinicalReferences(req, req.body, { requirePatient: true, requireDoctor: false });
  return tenantCreateData(req, {
    patient_id: normalized.patient_id,
    patient_uid: normalized.patient_uid,
    patient_name: normalized.patient_name,
    doctor_id: normalized.doctor_id || '',
    doctor_name: normalized.doctor_name || '',
    appointment_id: normalized.appointment_id,
    opd_id: req.body.opd_id ? Number(req.body.opd_id) : undefined,
    scan_name: req.body.scan_name || req.body.name || req.body.scan || 'Radiology Scan',
    scan_category: req.body.scan_category || req.body.category || 'General',
    modality: req.body.modality || 'XRAY',
    body_part: req.body.body_part || '',
    priority: req.body.priority || 'routine',
    status: req.body.status || 'ordered',
    accession_number: req.body.accession_number || code('RAD-ACC'),
    dicom_study_id: req.body.dicom_study_id || '',
    pacs_viewer_url: req.body.pacs_viewer_url || '',
    radiologist_id: req.body.radiologist_id || '',
    radiologist_name: req.body.radiologist_name || '',
    technician_name: req.body.technician_name || '',
    notes: req.body.notes || '',
    ...overrides,
  });
}

router.get('/lab/templates', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  res.json(await LabTestTemplate.find(tenantFilter(req)).sort({ id: -1 }));
}));

router.post('/lab/templates', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  requireFields({ test_name: req.body.test_name });
  const doc = await LabTestTemplate.create(tenantCreateData(req, {
    template_code: req.body.template_code || code('TPL'),
    test_name: req.body.test_name,
    test_category: req.body.test_category || 'General',
    sample_type: req.body.sample_type || 'Blood',
    container: req.body.container || '',
    turnaround_hours: Number(req.body.turnaround_hours || 24),
    price: Number(req.body.price || 0),
    machine_code: req.body.machine_code || '',
    loinc_code: req.body.loinc_code || '',
    method: req.body.method || '',
    parameters: parameterRows(req.body),
    report_template: req.body.report_template || '',
    status: req.body.status || 'active',
  }));
  await auditEvent({ req, action: 'lab.template_created', module_name: 'lab', entity_type: 'LabTestTemplate', entity_id: doc.id, new_value: doc.toJSON?.() || doc });
  res.status(201).json({ message: 'Lab template created', templateId: doc.id, template: doc });
}));

router.put('/lab/templates/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (update.turnaround_hours !== undefined) update.turnaround_hours = Number(update.turnaround_hours || 0);
  if (update.price !== undefined) update.price = Number(update.price || 0);
  const oldValue = await LabTestTemplate.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  await LabTestTemplate.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'lab.template_updated', module_name: 'lab', entity_type: 'LabTestTemplate', entity_id: req.params.id, old_value: oldValue, new_value: update });
  res.json({ message: 'Lab template updated' });
}));

router.post('/lab/tests', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const r = await LabTest.create(await buildLabPayload(req));
  await auditEvent({ req, action: 'lab.order_created', module_name: 'lab', entity_type: 'LabTest', entity_id: r.id, new_value: r.toJSON?.() || r });
  await createNotification(req, { title: 'Lab order created', message: `${r.test_name} ordered with barcode ${r.sample_barcode}.`, type: 'lab', severity: 'info', module: 'lab', entity_type: 'lab_test', entity_id: r.id, target_path: '/labs' });
  res.status(201).json({ message: 'Lab order created', labTestId: r.id, sample_barcode: r.sample_barcode, accession_number: r.accession_number });
}));

router.post('/lab/book-test', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const r = await LabTest.create(await buildLabPayload(req));
  await auditEvent({ req, action: 'lab.order_created', module_name: 'lab', entity_type: 'LabTest', entity_id: r.id, new_value: r.toJSON?.() || r });
  res.status(201).json({ message: 'Lab order created', labTestId: r.id, sample_barcode: r.sample_barcode });
}));

router.patch('/lab/tests/:id/status', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const status = req.body.test_status || req.body.status;
  if (!LAB_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid lab status' });
  const update = { test_status: status };
  if (status === 'sample_collected') update.sample_collected_at = req.body.sample_collected_at || new Date();
  if (status === 'received') update.received_at = req.body.received_at || new Date();
  if (status === 'processing') update.processing_started_at = req.body.processing_started_at || new Date();
  if (status === 'completed') update.completed_at = req.body.completed_at || new Date();
  if (status === 'verified') { update.verified_at = new Date(); update.verified_by = req.body.verified_by || req.user?.full_name || req.user?.email || 'Verified User'; }
  if (status === 'approved') { update.approved_at = new Date(); update.approved_by = req.body.approved_by || req.user?.full_name || req.user?.email || 'Approved User'; }
  if (status === 'rejected') { update.rejected_at = new Date(); update.rejected_by = req.user?.full_name || req.user?.email || 'Lab User'; update.rejection_reason = req.body.rejection_reason || req.body.reason || 'Sample/result rejected'; }
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'lab.status_updated', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: { test_status: oldValue.test_status }, new_value: update });
  res.json({ message: 'Lab status updated' });
}));

router.patch('/lab/sample-collected/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: 'sample_collected', sample_collected_at: new Date(), collected_by: req.body.collected_by || req.user?.full_name || req.user?.email || '' } });
  res.json({ message: 'Sample marked as collected' });
}));

router.patch('/lab/tests/:id/results', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: {
    test_status: req.body.test_status || 'result_entered',
    result_parameters: parameterRows(req.body),
    critical_alert: parameterRows(req.body).some(isCriticalParameter),
    critical_alert_at: parameterRows(req.body).some(isCriticalParameter) ? new Date() : undefined,
    entered_at: new Date(),
    entered_by: req.user?.full_name || req.user?.email || 'Lab User',
    interpretation: req.body.interpretation || '',
    report_notes: req.body.report_notes || '',
    machine_order_id: req.body.machine_order_id || '',
    integration_payload: req.body.integration_payload || {},
  } });
  await auditEvent({ req, action: 'lab.result_saved', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: oldValue, new_value: { result_parameters: parameterRows(req.body), report_notes: req.body.report_notes || '', tat_hours: tatHours({ ...oldValue, approved_at: new Date() }) } });
  res.json({ message: 'Lab result saved' });
}));


router.patch('/lab/tests/:id/verify', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  if (!['result_entered', 'processing', 'completed'].includes(oldValue.test_status)) return res.status(400).json({ message: 'Only resulted/processing/completed lab orders can be verified' });
  const update = { test_status: 'verified', verified_at: new Date(), verified_by: req.body.verified_by || req.user?.full_name || req.user?.email || 'Verified User', verification_notes: req.body.verification_notes || '' };
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'lab.result_verified', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: { test_status: oldValue.test_status }, new_value: update });
  res.json({ message: 'Lab result verified' });
}));

router.patch('/lab/tests/:id/reject-sample', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const reason = text(req.body.reason || req.body.rejection_reason);
  if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  const update = { test_status: 'rejected', rejected_at: new Date(), rejected_by: req.user?.full_name || req.user?.email || 'Lab User', rejection_reason: reason };
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'lab.sample_rejected', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: { test_status: oldValue.test_status }, new_value: update, severity: 'warning' });
  await createNotification(req, { title: 'Lab sample rejected', message: `Lab sample #${req.params.id} rejected: ${reason}`, type: 'lab', severity: 'warning', module: 'lab', entity_type: 'lab_test', entity_id: req.params.id, target_path: '/labs' });
  res.json({ message: 'Lab sample rejected' });
}));

router.patch('/lab/tests/:id/approve', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: 'approved', approved_at: new Date(), approved_by: req.body.approved_by || req.user?.full_name || req.user?.email || 'Approved User', report_pdf_url: req.body.report_pdf_url || '', report_notes: req.body.report_notes || '' } });
  await auditEvent({ req, action: 'lab.report_approved', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: oldValue, new_value: { test_status: 'approved', approved_by: req.body.approved_by || req.user?.full_name || req.user?.email || 'Approved User' } });
  await createNotification(req, { title: 'Lab report approved', message: `Lab report #${req.params.id} approved.`, type: 'lab', severity: 'success', module: 'lab', entity_type: 'lab_test', entity_id: req.params.id, target_path: '/labs' });
  res.json({ message: 'Lab report approved' });
}));

router.patch('/lab/upload-report/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const oldValue = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Lab order not found' });
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: req.body.test_status || 'completed', completed_at: new Date(), report_file: req.body.report_file || null, report_pdf_url: req.body.report_pdf_url || req.body.report_file || null, report_notes: req.body.report_notes || null } });
  await auditEvent({ req, action: 'lab.report_uploaded', module_name: 'lab', entity_type: 'LabTest', entity_id: req.params.id, old_value: oldValue, new_value: { report_pdf_url: req.body.report_pdf_url || req.body.report_file || null } });
  res.json({ message: 'Lab report uploaded' });
}));

router.get('/lab/tests', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.test_status = req.query.status;
  if (req.query.patient_id) query.patient_id = String(req.query.patient_id);
  const filter = req.query.include_archived === 'true' ? tenantFilter(req, query) : patientOrderFilter(req, query);
  res.json(await withNames(req, await LabTest.find(filter).sort({ id: -1 })));
}));


router.get('/lab/tat-summary', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  const rows = await LabTest.find(patientOrderFilter(req)).sort({ id: -1 }).limit(500).lean();
  const completed = rows.map(r => tatHours(r)).filter(v => v !== null);
  const avg_tat_hours = completed.length ? Number((completed.reduce((a,b)=>a+b,0)/completed.length).toFixed(2)) : 0;
  res.json({ total_orders: rows.length, pending_orders: rows.filter(r => !['approved','completed','cancelled','rejected'].includes(r.test_status)).length, critical_alerts: rows.filter(r => r.critical_alert).length, rejected_samples: rows.filter(r => r.test_status === 'rejected').length, avg_tat_hours });
}));

router.get('/lab/machine-api/orders', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  const rows = await LabTest.find(tenantFilter(req, { test_status: { $in: ['ordered', 'sample_collected', 'received'] } })).sort({ id: -1 }).limit(100).lean();
  res.json(rows.map(x => ({ order_id: x.id, accession_number: x.accession_number, sample_barcode: x.sample_barcode, test_name: x.test_name, sample_type: x.sample_type, parameters: x.result_parameters || [] })));
}));

router.post('/radiology/tests', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const r = await RadiologyTest.create(await cleanRadPayload(req));
  await auditEvent({ req, action: 'radiology.order_created', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: r.id, new_value: r.toJSON?.() || r });
  await createNotification(req, { title: 'Radiology order created', message: `${r.scan_name} ordered.`, type: 'radiology', severity: 'info', module: 'radiology', entity_type: 'radiology_test', entity_id: r.id, target_path: '/labs' });
  res.status(201).json({ message: 'Radiology order created', scanId: r.id, accession_number: r.accession_number });
}));

router.post('/radiology/book-scan', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const r = await RadiologyTest.create(await cleanRadPayload(req));
  await auditEvent({ req, action: 'radiology.order_created', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: r.id, new_value: r.toJSON?.() || r });
  res.status(201).json({ message: 'Radiology order created', scanId: r.id });
}));

router.patch('/radiology/tests/:id/status', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!RAD_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid radiology status' });
  const update = { status };
  if (status === 'scheduled') update.scheduled_at = req.body.scheduled_at || new Date();
  if (status === 'scanned') update.scanned_at = new Date();
  if (status === 'reported') update.reported_at = new Date();
  if (status === 'approved') update.approved_at = new Date();
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology order not found' });
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'radiology.status_updated', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: { status: oldValue.status }, new_value: update });
  res.json({ message: 'Radiology status updated' });
}));

router.patch('/radiology/tests/:id/report', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology order not found' });
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: {
    status: req.body.status || 'reported',
    reported_at: new Date(),
    dicom_study_id: req.body.dicom_study_id || '',
    pacs_viewer_url: req.body.pacs_viewer_url || '',
    radiologist_id: req.body.radiologist_id || '',
    radiologist_name: req.body.radiologist_name || '',
    technician_name: req.body.technician_name || '',
    findings: req.body.findings || '',
    impression: req.body.impression || '',
    recommendation: req.body.recommendation || '',
    image_file: req.body.image_file || '',
    report_file: req.body.report_file || '',
    report_pdf_url: req.body.report_pdf_url || req.body.report_file || '',
    report_notes: req.body.report_notes || '',
    integration_payload: req.body.integration_payload || {},
  } });
  await auditEvent({ req, action: 'radiology.report_saved', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: oldValue, new_value: { findings: req.body.findings || '', impression: req.body.impression || '', report_file: req.body.report_file || '' } });
  res.json({ message: 'Radiology report saved' });
}));

router.patch('/radiology/tests/:id/approve', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology order not found' });
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'approved', approved_at: new Date(), report_pdf_url: req.body.report_pdf_url || '', report_notes: req.body.report_notes || '' } });
  await auditEvent({ req, action: 'radiology.report_approved', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: oldValue, new_value: { status: 'approved' } });
  await createNotification(req, { title: 'Radiology report approved', message: `Radiology report #${req.params.id} approved.`, type: 'radiology', severity: 'success', module: 'radiology', entity_type: 'radiology_test', entity_id: req.params.id, target_path: '/labs' });
  res.json({ message: 'Radiology report approved' });
}));

router.patch('/radiology/upload-report/:id', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology order not found' });
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'reported', reported_at: new Date(), image_file: req.body.image_file || null, report_file: req.body.report_file || null, report_pdf_url: req.body.report_pdf_url || req.body.report_file || null, report_notes: req.body.report_notes || null, dicom_study_id: req.body.dicom_study_id || '', pacs_viewer_url: req.body.pacs_viewer_url || '' } });
  await auditEvent({ req, action: 'radiology.report_uploaded', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: oldValue, new_value: { report_pdf_url: req.body.report_pdf_url || req.body.report_file || null } });
  res.json({ message: 'Radiology report uploaded' });
}));

router.get('/radiology/tests', requirePermission('radiology.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.patient_id) query.patient_id = String(req.query.patient_id);
  const filter = req.query.include_archived === 'true' ? tenantFilter(req, query) : radiologyOrderFilter(req, query);
  res.json(await withNames(req, await RadiologyTest.find(filter).sort({ id: -1 })));
}));


router.delete('/lab/tests/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const lab = await LabTest.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!lab) return res.status(404).json({ message: 'Lab order not found' });
  const oldValue = lab.toJSON ? lab.toJSON() : lab;
  lab.test_status = 'archived';
  lab.archived_at = new Date();
  lab.archived_by = req.user?.id || null;
  lab.archive_reason = req.body?.reason || req.query?.reason || 'Archived by user';
  await lab.save();
  await auditEvent({ req, action: 'lab.order_archived', module_name: 'lab', entity_type: 'LabTest', entity_id: lab.id, old_value: oldValue, new_value: { test_status: 'archived', archive_reason: lab.archive_reason }, severity: 'warning' });
  res.json({ message: 'Lab order archived' });
}));

router.delete('/radiology/tests/:id', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const rad = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!rad) return res.status(404).json({ message: 'Radiology order not found' });
  const oldValue = rad.toJSON ? rad.toJSON() : rad;
  rad.status = 'archived';
  rad.archived_at = new Date();
  rad.archived_by = req.user?.id || null;
  rad.archive_reason = req.body?.reason || req.query?.reason || 'Archived by user';
  await rad.save();
  await auditEvent({ req, action: 'radiology.order_archived', module_name: 'radiology', entity_type: 'RadiologyTest', entity_id: rad.id, old_value: oldValue, new_value: { status: 'archived', archive_reason: rad.archive_reason }, severity: 'warning' });
  res.json({ message: 'Radiology order archived' });
}));

router.post('/opd/:id/orders', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const opd = await OpdRecord.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!opd) return res.status(404).json({ message: 'OPD record not found' });
  const labOrders = [];
  const radiologyOrders = [];
  for (const item of req.body.lab_orders || []) {
    const fakeReq = { ...req, body: { ...item, patient_id: String(opd.patient_id || req.body.patient_id || ''), doctor_id: String(opd.doctor_id || req.body.doctor_id || ''), appointment_id: opd.appointment_id, opd_id: opd.id } };
    labOrders.push(await LabTest.create(await buildLabPayload(fakeReq)));
  }
  for (const item of req.body.radiology_orders || []) {
    radiologyOrders.push(await RadiologyTest.create(tenantCreateData(req, {
      patient_id: String(opd.patient_id || req.body.patient_id || ''),
      doctor_id: String(opd.doctor_id || req.body.doctor_id || ''),
      appointment_id: opd.appointment_id,
      opd_id: opd.id,
      scan_name: item.scan_name || item.name || 'Radiology Scan',
      scan_category: item.scan_category || item.category || 'General',
      modality: item.modality || 'XRAY',
      body_part: item.body_part || '',
      priority: item.priority || 'routine',
      status: 'ordered',
      accession_number: code('RAD-ACC'),
      dicom_study_id: item.dicom_study_id || '',
      pacs_viewer_url: item.pacs_viewer_url || '',
      notes: item.notes || '',
    })));
  }
  await createNotification(req, { title: 'Clinical orders created', message: `${labOrders.length} lab and ${radiologyOrders.length} radiology order(s) created from OPD.`, type: 'clinical_order', severity: 'info', module: 'opd', entity_type: 'opd_record', entity_id: opd.id, target_path: '/labs' });
  res.status(201).json({ message: 'Clinical orders created', lab_order_ids: labOrders.map(x => x.id), radiology_order_ids: radiologyOrders.map(x => x.id) });
}));

module.exports = router;
