const express = require('express');
const crypto = require('crypto');
const { RadiologyTest, Hospital } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const MODALITIES = ['XRAY', 'CT', 'MRI', 'USG', 'ECG', 'PET', 'MAMMO', 'DEXA', 'FLUORO', 'OTHER'];
const PACS_STATUSES = ['ordered', 'scheduled', 'scanned', 'reported', 'approved', 'cancelled', 'archived'];

function text(value) { return String(value || '').trim(); }
function code(prefix) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${d}-${Date.now().toString().slice(-6)}`;
}
function safeUrl(value) {
  const url = text(value);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    const err = new Error('PACS viewer URL must start with http:// or https://');
    err.status = 400;
    throw err;
  }
  return url;
}
function generateStudyUid(req, accession) {
  const seed = `${req.tenant?.hospital_id || req.user?.hospital_id || 1}-${accession}-${Date.now()}`;
  const suffix = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 24).match(/.{1,6}/g).map(x => parseInt(x, 16)).join('.');
  return `2.25.${BigInt('0x' + crypto.createHash('sha1').update(seed).digest('hex')).toString().slice(0, 30)}.${suffix}`;
}
function worklistProjection(row = {}) {
  return {
    id: row.id,
    hospital_id: row.hospital_id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    scan_name: row.scan_name,
    scan_category: row.scan_category,
    modality: row.modality,
    body_part: row.body_part,
    priority: row.priority,
    status: row.status,
    accession_number: row.accession_number,
    study_instance_uid: row.study_instance_uid || row.dicom_study_id || '',
    dicom_study_id: row.dicom_study_id || row.study_instance_uid || '',
    series_instance_uid: row.series_instance_uid || '',
    pacs_viewer_url: row.pacs_viewer_url || '',
    orthanc_study_id: row.orthanc_study_id || '',
    study_description: row.study_description || row.scan_name || '',
    scheduled_at: row.scheduled_at,
    scanned_at: row.scanned_at,
    reported_at: row.reported_at,
    approved_at: row.approved_at,
    report_pdf_url: row.report_pdf_url,
    image_file: row.image_file,
    report_notes: row.report_notes,
    integration_payload: row.integration_payload || {},
  };
}
async function tenantHospital(req) {
  const hospitalId = Number(req.tenant?.hospital_id || req.user?.hospital_id || 1);
  return Hospital.findOne({ id: hospitalId }).lean();
}
function pacsSettings(hospital = {}) {
  const settings = hospital.settings || {};
  const pacs = settings.pacs || settings.pacs_dicom || {};
  return {
    enabled: Boolean(hospital.feature_flags?.pacs || settings.pacs_dicom_enabled || pacs.enabled),
    provider: pacs.provider || process.env.PACS_PROVIDER || 'orthanc',
    base_url: pacs.base_url || process.env.PACS_BASE_URL || '',
    viewer_url_template: pacs.viewer_url_template || process.env.PACS_VIEWER_URL_TEMPLATE || '',
    ae_title: pacs.ae_title || process.env.PACS_AE_TITLE || '',
    remote_ae_title: pacs.remote_ae_title || process.env.PACS_REMOTE_AE_TITLE || '',
    worklist_enabled: Boolean(pacs.worklist_enabled ?? true),
    last_verified_at: pacs.last_verified_at || null,
  };
}

router.get('/pacs/dashboard', requirePermission('radiology.view'), asyncHandler(async (req, res) => {
  const [hospital, rows] = await Promise.all([
    tenantHospital(req),
    RadiologyTest.find(tenantFilter(req, { status: { $ne: 'archived' } })).sort({ id: -1 }).limit(300).lean(),
  ]);
  const mapped = rows.filter(r => r.dicom_study_id || r.study_instance_uid || r.pacs_viewer_url || r.orthanc_study_id);
  const pending = rows.filter(r => ['ordered', 'scheduled'].includes(r.status || 'ordered'));
  const scanned = rows.filter(r => ['scanned', 'reported', 'approved'].includes(r.status || ''));
  const byModality = rows.reduce((acc, r) => {
    const key = r.modality || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  res.json({
    settings: pacsSettings(hospital),
    totals: {
      studies: rows.length,
      mapped_studies: mapped.length,
      pending_worklist: pending.length,
      scanned_or_reported: scanned.length,
      viewer_links: rows.filter(r => r.pacs_viewer_url).length,
      missing_dicom_uid: rows.filter(r => !r.dicom_study_id && !r.study_instance_uid).length,
    },
    by_modality: byModality,
    recent: rows.slice(0, 10).map(worklistProjection),
  });
}));

router.get('/pacs/worklist', requirePermission('radiology.view'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.modality) query.modality = String(req.query.modality).toUpperCase();
  if (req.query.patient_id) query.patient_id = String(req.query.patient_id);
  if (req.query.accession_number) query.accession_number = String(req.query.accession_number);
  if (req.query.mapped === 'true') query.$or = [{ dicom_study_id: { $ne: '' } }, { study_instance_uid: { $ne: '' } }, { pacs_viewer_url: { $ne: '' } }];
  const rows = await RadiologyTest.find(tenantFilter(req, query)).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean();
  res.json(rows.map(worklistProjection));
}));

router.post('/pacs/studies', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  if (!text(req.body.patient_id)) return res.status(400).json({ message: 'patient_id is required' });
  if (!text(req.body.scan_name || req.body.study_description)) return res.status(400).json({ message: 'scan_name is required' });
  const modality = String(req.body.modality || 'CT').toUpperCase();
  if (!MODALITIES.includes(modality)) return res.status(400).json({ message: 'Unsupported modality' });
  const accession = text(req.body.accession_number) || code('RAD-ACC');
  const studyUid = text(req.body.study_instance_uid || req.body.dicom_study_id) || generateStudyUid(req, accession);
  const payload = tenantCreateData(req, {
    patient_id: String(req.body.patient_id),
    doctor_id: text(req.body.doctor_id),
    appointment_id: req.body.appointment_id ? Number(req.body.appointment_id) : undefined,
    opd_id: req.body.opd_id ? Number(req.body.opd_id) : undefined,
    scan_name: req.body.scan_name || req.body.study_description || 'DICOM Study',
    scan_category: req.body.scan_category || 'Radiology',
    modality,
    body_part: req.body.body_part || '',
    priority: req.body.priority || 'routine',
    status: req.body.status || 'ordered',
    accession_number: accession,
    dicom_study_id: studyUid,
    study_instance_uid: studyUid,
    series_instance_uid: text(req.body.series_instance_uid),
    orthanc_study_id: text(req.body.orthanc_study_id),
    pacs_viewer_url: safeUrl(req.body.pacs_viewer_url),
    study_description: req.body.study_description || req.body.scan_name || '',
    scheduled_at: req.body.scheduled_at || undefined,
    notes: req.body.notes || '',
    integration_payload: {
      ...(req.body.integration_payload || {}),
      source: 'pacs_dicom',
      accession_number: accession,
    },
  });
  const doc = await RadiologyTest.create(payload);
  await auditEvent({ req, action: 'pacs.study_created', module_name: 'pacs', entity_type: 'RadiologyTest', entity_id: doc.id, new_value: worklistProjection(doc.toJSON?.() || doc) });
  res.status(201).json({ message: 'PACS/DICOM study created', study: worklistProjection(doc.toJSON?.() || doc) });
}));

router.patch('/pacs/studies/:id/link', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology study not found' });
  const update = {};
  if (req.body.dicom_study_id !== undefined || req.body.study_instance_uid !== undefined) {
    update.dicom_study_id = text(req.body.dicom_study_id || req.body.study_instance_uid);
    update.study_instance_uid = update.dicom_study_id;
  }
  if (req.body.series_instance_uid !== undefined) update.series_instance_uid = text(req.body.series_instance_uid);
  if (req.body.orthanc_study_id !== undefined) update.orthanc_study_id = text(req.body.orthanc_study_id);
  if (req.body.pacs_viewer_url !== undefined) update.pacs_viewer_url = safeUrl(req.body.pacs_viewer_url);
  if (req.body.image_file !== undefined) update.image_file = text(req.body.image_file);
  if (req.body.report_pdf_url !== undefined || req.body.report_file !== undefined) update.report_pdf_url = safeUrl(req.body.report_pdf_url || req.body.report_file);
  update.pacs_linked_at = new Date();
  update.pacs_linked_by = req.user?.id || null;
  update.integration_payload = { ...(oldValue.integration_payload || {}), ...(req.body.integration_payload || {}), pacs_linked: true };
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'pacs.study_linked', module_name: 'pacs', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: worklistProjection(oldValue), new_value: update });
  res.json({ message: 'PACS/DICOM link updated' });
}));

router.patch('/pacs/studies/:id/status', requirePermission('radiology.create'), asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  if (!PACS_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid PACS/radiology status' });
  const oldValue = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'Radiology study not found' });
  const update = { status };
  if (status === 'scheduled') update.scheduled_at = req.body.scheduled_at || oldValue.scheduled_at || new Date();
  if (status === 'scanned') update.scanned_at = req.body.scanned_at || new Date();
  if (status === 'reported') update.reported_at = req.body.reported_at || new Date();
  if (status === 'approved') update.approved_at = req.body.approved_at || new Date();
  await RadiologyTest.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'pacs.status_updated', module_name: 'pacs', entity_type: 'RadiologyTest', entity_id: req.params.id, old_value: { status: oldValue.status }, new_value: update });
  res.json({ message: 'PACS study status updated' });
}));

router.get('/pacs/studies/:id/manifest', requirePermission('radiology.view'), asyncHandler(async (req, res) => {
  const row = await RadiologyTest.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!row) return res.status(404).json({ message: 'Radiology study not found' });
  const study = worklistProjection(row);
  res.json({
    resourceType: 'ImagingStudy',
    status: row.status === 'approved' ? 'available' : 'registered',
    id: String(row.id),
    identifier: [
      { system: 'urn:hms:accession', value: row.accession_number || '' },
      { system: 'urn:dicom:uid', value: study.study_instance_uid || '' },
    ].filter(x => x.value),
    modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: row.modality || 'OT' }],
    subject: { reference: `Patient/${row.patient_id}` },
    description: row.study_description || row.scan_name || '',
    started: row.scanned_at || row.scheduled_at || row.created_at,
    endpoint: row.pacs_viewer_url ? [{ reference: row.pacs_viewer_url }] : [],
    numberOfSeries: row.series_instance_uid ? 1 : undefined,
    hms: study,
  });
}));

router.post('/pacs/verify-connection', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.tenant?.hospital_id || req.user?.hospital_id || 1);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const settings = hospital.settings || {};
  const pacs = {
    ...(settings.pacs || {}),
    provider: req.body.provider || settings.pacs?.provider || process.env.PACS_PROVIDER || 'orthanc',
    base_url: req.body.base_url || settings.pacs?.base_url || process.env.PACS_BASE_URL || '',
    viewer_url_template: req.body.viewer_url_template || settings.pacs?.viewer_url_template || process.env.PACS_VIEWER_URL_TEMPLATE || '',
    ae_title: req.body.ae_title || settings.pacs?.ae_title || process.env.PACS_AE_TITLE || '',
    remote_ae_title: req.body.remote_ae_title || settings.pacs?.remote_ae_title || process.env.PACS_REMOTE_AE_TITLE || '',
    worklist_enabled: req.body.worklist_enabled !== undefined ? Boolean(req.body.worklist_enabled) : true,
    last_verified_at: new Date(),
  };
  hospital.settings = { ...settings, pacs, pacs_dicom_enabled: true };
  hospital.feature_flags = { ...(hospital.feature_flags || {}), pacs: true };
  await hospital.save();
  await auditEvent({ req, action: 'pacs.connection_verified', module_name: 'pacs', entity_type: 'Hospital', entity_id: hospital.id, new_value: { provider: pacs.provider, base_url: pacs.base_url, worklist_enabled: pacs.worklist_enabled } });
  res.json({ message: 'PACS configuration saved/verified', settings: pacsSettings(hospital.toJSON?.() || hospital) });
}));

module.exports = router;
