const express = require('express');
const {
  ConsentForm,
  IncidentReport,
  SopDocument,
  ComplianceChecklist,
  BackupVerification,
  AuditLog,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent, csvEscape } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const esc = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const todayId = (prefix) => `${prefix}-${Date.now()}`;

function textQuery(req, fields = []) {
  const query = tenantFilter(req);
  if (req.query.status) query.status = req.query.status;
  if (req.query.department) query.department = req.query.department;
  if (req.query.q) {
    const rx = new RegExp(esc(req.query.q), 'i');
    query.$or = fields.map((field) => ({ [field]: rx }));
  }
  return query;
}

async function createAndAudit(req, res, Model, payload, meta) {
  const row = await Model.create(tenantCreateData(req, { ...payload, created_by: req.user.id }));
  await auditEvent({ req, action: `${meta.label} created`, module_name: 'compliance', entity_type: meta.entity, entity_id: row.id, new_value: row.toJSON ? row.toJSON() : row });
  res.status(201).json(row);
}

async function updateAndAudit(req, res, Model, id, payload, meta) {
  const oldRow = await Model.findOne(tenantFilter(req, { id: Number(id) })).lean();
  if (!oldRow) return res.status(404).json({ message: `${meta.label} not found` });
  const row = await Model.findOneAndUpdate(tenantFilter(req, { id: Number(id) }), { $set: payload }, { new: true }).lean();
  await auditEvent({ req, action: `${meta.label} updated`, module_name: 'compliance', entity_type: meta.entity, entity_id: id, old_value: oldRow, new_value: row });
  res.json(row);
}

router.get('/compliance/summary', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const [consents, signedConsents, incidentsOpen, incidentsHigh, sopsApproved, checklistTotal, checklistCompliant, backupFailed, auditExports] = await Promise.all([
    ConsentForm.countDocuments(tenantFilter(req)),
    ConsentForm.countDocuments(tenantFilter(req, { status: 'signed' })),
    IncidentReport.countDocuments(tenantFilter(req, { status: { $ne: 'closed' } })),
    IncidentReport.countDocuments(tenantFilter(req, { severity: { $in: ['high', 'critical'] }, status: { $ne: 'closed' } })),
    SopDocument.countDocuments(tenantFilter(req, { status: 'approved' })),
    ComplianceChecklist.countDocuments(tenantFilter(req)),
    ComplianceChecklist.countDocuments(tenantFilter(req, { status: 'compliant' })),
    BackupVerification.countDocuments(tenantFilter(req, { status: { $in: ['failed', 'partial'] } })),
    AuditLog.countDocuments(tenantFilter(req, { module_name: 'compliance_export' })),
  ]);
  const complianceScore = checklistTotal ? Math.round((checklistCompliant / checklistTotal) * 100) : 0;
  res.json({ consents, signedConsents, incidentsOpen, incidentsHigh, sopsApproved, checklistTotal, checklistCompliant, complianceScore, backupFailed, auditExports });
}));

router.get('/compliance/consents', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const rows = await ConsentForm.find(textQuery(req, ['consent_number', 'patient_id', 'patient_name', 'title', 'consent_type'])).sort({ id: -1 }).limit(500).lean();
  res.json(rows);
}));

router.post('/compliance/consents', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await createAndAudit(req, res, ConsentForm, { consent_number: req.body.consent_number || todayId('CONS'), ...req.body }, { label: 'Consent form', entity: 'consent_form' });
}));

router.put('/compliance/consents/:id', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await updateAndAudit(req, res, ConsentForm, req.params.id, req.body, { label: 'Consent form', entity: 'consent_form' });
}));

router.post('/compliance/consents/:id/sign', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await updateAndAudit(req, res, ConsentForm, req.params.id, { status: 'signed', signed_by: req.body.signed_by, relationship: req.body.relationship, witness_name: req.body.witness_name, digital_signature: req.body.digital_signature, signed_at: new Date() }, { label: 'Consent form signed', entity: 'consent_form' });
}));

router.get('/compliance/incidents', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const query = textQuery(req, ['incident_number', 'incident_type', 'department', 'location', 'patient_name', 'description']);
  if (req.query.severity) query.severity = req.query.severity;
  const rows = await IncidentReport.find(query).sort({ id: -1 }).limit(500).lean();
  res.json(rows);
}));

router.post('/compliance/incidents', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await createAndAudit(req, res, IncidentReport, { incident_number: req.body.incident_number || todayId('INC'), ...req.body }, { label: 'Incident report', entity: 'incident_report' });
}));

router.put('/compliance/incidents/:id', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.status === 'closed' && !payload.closed_at) payload.closed_at = new Date();
  await updateAndAudit(req, res, IncidentReport, req.params.id, payload, { label: 'Incident report', entity: 'incident_report' });
}));

router.get('/compliance/sops', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const rows = await SopDocument.find(textQuery(req, ['sop_number', 'title', 'department', 'category', 'owner_name'])).sort({ id: -1 }).limit(500).lean();
  res.json(rows);
}));

router.post('/compliance/sops', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await createAndAudit(req, res, SopDocument, { sop_number: req.body.sop_number || todayId('SOP'), ...req.body }, { label: 'SOP document', entity: 'sop_document' });
}));

router.put('/compliance/sops/:id', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.status === 'approved' && !payload.approved_at) payload.approved_at = new Date();
  await updateAndAudit(req, res, SopDocument, req.params.id, payload, { label: 'SOP document', entity: 'sop_document' });
}));

router.get('/compliance/checklists', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const query = textQuery(req, ['checklist_code', 'standard', 'title', 'department', 'category', 'owner_name']);
  if (req.query.standard) query.standard = req.query.standard;
  const rows = await ComplianceChecklist.find(query).sort({ id: -1 }).limit(700).lean();
  res.json(rows);
}));

router.post('/compliance/checklists', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await createAndAudit(req, res, ComplianceChecklist, { checklist_code: req.body.checklist_code || todayId('NABH'), ...req.body }, { label: 'Compliance checklist item', entity: 'compliance_checklist' });
}));

router.put('/compliance/checklists/:id', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await updateAndAudit(req, res, ComplianceChecklist, req.params.id, { ...req.body, last_reviewed_at: new Date() }, { label: 'Compliance checklist item', entity: 'compliance_checklist' });
}));

router.post('/compliance/checklists/seed-nabh', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  const defaults = [
    ['NABH-COP-001', 'Care of Patients', 'Consent forms are documented for procedures', 'Clinical'],
    ['NABH-HIC-001', 'Hospital Infection Control', 'Incident reporting and corrective action tracking is active', 'Quality'],
    ['NABH-ROM-001', 'Responsibilities of Management', 'SOP documents have owner, version and review date', 'Administration'],
    ['NABH-FMS-001', 'Facility Management', 'Backup and restore verification is recorded', 'IT'],
    ['NABH-AAC-001', 'Access Assessment Continuity', 'Audit exports are available for regulatory review', 'Administration'],
  ];
  for (const [code, category, title, department] of defaults) {
    await ComplianceChecklist.findOneAndUpdate(
      tenantFilter(req, { checklist_code: code }),
      { $setOnInsert: tenantCreateData(req, { checklist_code: code, standard: 'NABH', category, title, department, status: 'pending', priority: 'high', created_by: req.user.id }) },
      { upsert: true, new: true }
    );
  }
  await auditEvent({ req, action: 'Seeded NABH checklist defaults', module_name: 'compliance', entity_type: 'compliance_checklist' });
  res.json({ message: 'NABH checklist defaults ensured' });
}));

router.get('/compliance/backups', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const rows = await BackupVerification.find(textQuery(req, ['verification_number', 'backup_type', 'storage_location', 'verified_by', 'issue_found'])).sort({ id: -1 }).limit(500).lean();
  res.json(rows);
}));

router.post('/compliance/backups', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await createAndAudit(req, res, BackupVerification, { verification_number: req.body.verification_number || todayId('BKP'), ...req.body }, { label: 'Backup verification', entity: 'backup_verification' });
}));

router.put('/compliance/backups/:id', requirePermission('compliance.manage'), asyncHandler(async (req, res) => {
  await updateAndAudit(req, res, BackupVerification, req.params.id, req.body, { label: 'Backup verification', entity: 'backup_verification' });
}));

router.get('/compliance/export/:type', requirePermission('compliance.view'), asyncHandler(async (req, res) => {
  const map = {
    consents: { Model: ConsentForm, headers: ['id', 'consent_number', 'patient_id', 'patient_name', 'consent_type', 'title', 'status', 'signed_by', 'signed_at', 'created_at'] },
    incidents: { Model: IncidentReport, headers: ['id', 'incident_number', 'incident_type', 'severity', 'status', 'incident_date', 'department', 'location', 'patient_name', 'reported_by', 'created_at'] },
    sops: { Model: SopDocument, headers: ['id', 'sop_number', 'title', 'department', 'category', 'version', 'status', 'effective_date', 'review_date', 'approved_by', 'created_at'] },
    checklists: { Model: ComplianceChecklist, headers: ['id', 'checklist_code', 'standard', 'title', 'department', 'category', 'status', 'priority', 'due_date', 'owner_name', 'last_reviewed_at'] },
    backups: { Model: BackupVerification, headers: ['id', 'verification_number', 'backup_type', 'backup_date', 'restore_test_date', 'status', 'storage_location', 'verified_by', 'next_test_due', 'created_at'] },
  };
  const cfg = map[req.params.type];
  if (!cfg) return res.status(400).json({ message: 'Invalid export type' });
  const rows = await cfg.Model.find(tenantFilter(req)).sort({ id: -1 }).limit(5000).lean();
  const csv = [cfg.headers.join(',')].concat(rows.map(row => cfg.headers.map(h => csvEscape(row[h])).join(','))).join('\n');
  await auditEvent({ req, action: `Compliance export: ${req.params.type}`, module_name: 'compliance_export', entity_type: req.params.type, status: 'success' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=compliance-${req.params.type}-${Date.now()}.csv`);
  res.send(csv);
}));

module.exports = router;
