const express = require('express');
const { LabTestTemplate, LabTest, RadiologyTest, Patient, Doctor, OpdRecord } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { createNotification } = require('../utils/notifications');

const router = express.Router();
router.use(verifyToken, attachTenant);

const LAB_STATUSES = ['ordered', 'sample_collected', 'received', 'processing', 'result_entered', 'approved', 'completed', 'cancelled'];
const RAD_STATUSES = ['ordered', 'scheduled', 'scanned', 'reported', 'approved', 'cancelled'];

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

function parameterRows(body) {
  if (Array.isArray(body.parameters)) return body.parameters;
  if (Array.isArray(body.result_parameters)) return body.result_parameters;
  return [];
}

async function buildLabPayload(req, overrides = {}) {
  const templateId = req.body.template_id ? Number(req.body.template_id) : undefined;
  const template = templateId ? await LabTestTemplate.findOne(tenantFilter(req, { id: templateId })).lean() : null;
  const baseParameters = parameterRows(req.body).length ? parameterRows(req.body) : (template?.parameters || []);
  return tenantCreateData(req, {
    patient_id: req.body.patient_id,
    doctor_id: req.body.doctor_id,
    appointment_id: req.body.appointment_id ? Number(req.body.appointment_id) : undefined,
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

function cleanRadPayload(req, overrides = {}) {
  return tenantCreateData(req, {
    patient_id: req.body.patient_id,
    doctor_id: req.body.doctor_id,
    appointment_id: req.body.appointment_id ? Number(req.body.appointment_id) : undefined,
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
  res.status(201).json({ message: 'Lab template created', templateId: doc.id, template: doc });
}));

router.put('/lab/templates/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (update.turnaround_hours !== undefined) update.turnaround_hours = Number(update.turnaround_hours || 0);
  if (update.price !== undefined) update.price = Number(update.price || 0);
  await LabTestTemplate.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  res.json({ message: 'Lab template updated' });
}));

router.post('/lab/tests', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const r = await LabTest.create(await buildLabPayload(req));
  await createNotification(req, { title: 'Lab order created', message: `${r.test_name} ordered with barcode ${r.sample_barcode}.`, type: 'lab', severity: 'info', module: 'lab', entity_type: 'lab_test', entity_id: r.id, target_path: '/labs' });
  res.status(201).json({ message: 'Lab order created', labTestId: r.id, sample_barcode: r.sample_barcode, accession_number: r.accession_number });
}));

router.post('/lab/book-test', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  const r = await LabTest.create(await buildLabPayload(req));
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
  if (status === 'approved') { update.approved_at = new Date(); update.approved_by = req.body.approved_by || req.user?.full_name || req.user?.email || 'Approved User'; }
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  res.json({ message: 'Lab status updated' });
}));

router.patch('/lab/sample-collected/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: 'sample_collected', sample_collected_at: new Date(), collected_by: req.body.collected_by || req.user?.full_name || req.user?.email || '' } });
  res.json({ message: 'Sample marked as collected' });
}));

router.patch('/lab/tests/:id/results', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: {
    test_status: req.body.test_status || 'result_entered',
    result_parameters: parameterRows(req.body),
    interpretation: req.body.interpretation || '',
    report_notes: req.body.report_notes || '',
    machine_order_id: req.body.machine_order_id || '',
    integration_payload: req.body.integration_payload || {},
  } });
  res.json({ message: 'Lab result saved' });
}));

router.patch('/lab/tests/:id/approve', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: 'approved', approved_at: new Date(), approved_by: req.body.approved_by || req.user?.full_name || req.user?.email || 'Approved User', report_pdf_url: req.body.report_pdf_url || '', report_notes: req.body.report_notes || '' } });
  await createNotification(req, { title: 'Lab report approved', message: `Lab report #${req.params.id} approved.`, type: 'lab', severity: 'success', module: 'lab', entity_type: 'lab_test', entity_id: req.params.id, target_path: '/labs' });
  res.json({ message: 'Lab report approved' });
}));

router.patch('/lab/upload-report/:id', requirePermission('lab.create'), asyncHandler(async (req, res) => {
  await LabTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { test_status: req.body.test_status || 'completed', completed_at: new Date(), report_file: req.body.report_file || null, report_pdf_url: req.body.report_pdf_url || req.body.report_file || null, report_notes: req.body.report_notes || null } });
  res.json({ message: 'Lab report uploaded' });
}));

router.get('/lab/tests', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.test_status = req.query.status;
  res.json(await withNames(req, await LabTest.find(tenantFilter(req, query)).sort({ id: -1 })));
}));

router.get('/lab/machine-api/orders', requirePermission('lab.view'), asyncHandler(async (req, res) => {
  const rows = await LabTest.find(tenantFilter(req, { test_status: { $in: ['ordered', 'sample_collected', 'received'] } })).sort({ id: -1 }).limit(100).lean();
  res.json(rows.map(x => ({ order_id: x.id, accession_number: x.accession_number, sample_barcode: x.sample_barcode, test_name: x.test_name, sample_type: x.sample_type, parameters: x.result_parameters || [] })));
}));

router.post('/radiology/tests', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const r = await RadiologyTest.create(cleanRadPayload(req));
  await createNotification(req, { title: 'Radiology order created', message: `${r.scan_name} ordered.`, type: 'radiology', severity: 'info', module: 'radiology', entity_type: 'radiology_test', entity_id: r.id, target_path: '/labs' });
  res.status(201).json({ message: 'Radiology order created', scanId: r.id, accession_number: r.accession_number });
}));

router.post('/radiology/book-scan', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const r = await RadiologyTest.create(cleanRadPayload(req));
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
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  res.json({ message: 'Radiology status updated' });
}));

router.patch('/radiology/tests/:id/report', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
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
  res.json({ message: 'Radiology report saved' });
}));

router.patch('/radiology/tests/:id/approve', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'approved', approved_at: new Date(), report_pdf_url: req.body.report_pdf_url || '', report_notes: req.body.report_notes || '' } });
  await createNotification(req, { title: 'Radiology report approved', message: `Radiology report #${req.params.id} approved.`, type: 'radiology', severity: 'success', module: 'radiology', entity_type: 'radiology_test', entity_id: req.params.id, target_path: '/labs' });
  res.json({ message: 'Radiology report approved' });
}));

router.patch('/radiology/upload-report/:id', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: 'reported', reported_at: new Date(), image_file: req.body.image_file || null, report_file: req.body.report_file || null, report_pdf_url: req.body.report_pdf_url || req.body.report_file || null, report_notes: req.body.report_notes || null, dicom_study_id: req.body.dicom_study_id || '', pacs_viewer_url: req.body.pacs_viewer_url || '' } });
  res.json({ message: 'Radiology report uploaded' });
}));

router.get('/radiology/tests', requirePermission('radiology.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  res.json(await withNames(req, await RadiologyTest.find(tenantFilter(req, query)).sort({ id: -1 })));
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
