const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  Hospital,
  TenantBackup,
  TenantRestoreRequest,
  TenantDataExport,
  TenantDisasterRecoveryLog,
  Patient,
  Doctor,
  Appointment,
  Billing,
  Medicine,
  LabTest,
  RadiologyTest,
  IpdAdmission,
  AuditLog,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission, allowRoles } = require('../middleware/auth');
const { auditEvent } = require('../utils/audit');
const {
  buildTenantDbName,
  ensureTenantDatabase,
  listTenantConnectionStatus,
  sanitizeDbName,
  uriForDb,
} = require('../config/tenantDb');

const router = express.Router();
router.use(verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'));

const BACKUP_DIR = process.env.TENANT_BACKUP_DIR || path.join(__dirname, '../../backups/tenants');
const EXPORT_DIR = process.env.TENANT_EXPORT_DIR || path.join(__dirname, '../../exports/tenants');
const EXPORT_TTL_DAYS = Number(process.env.TENANT_EXPORT_TTL_DAYS || 7);
const BACKUP_RETENTION_DAYS = Number(process.env.TENANT_BACKUP_RETENTION_DAYS || 30);

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function safeDate() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function addDays(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 0)); return d; }
function publicHospital(h) {
  const x = h?.toJSON ? h.toJSON() : { ...(h || {}) };
  return x;
}
function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}
function buildManifest({ filePath, fileName, recordCounts = {}, generatedBy, purpose }) {
  const exists = filePath && fs.existsSync(filePath);
  return {
    manifest_version: 'phase4n-continuation-v1',
    purpose,
    file_name: fileName,
    size_bytes: exists ? fs.statSync(filePath).size : 0,
    checksum_sha256: exists ? sha256File(filePath) : '',
    record_counts: recordCounts,
    generated_at: new Date().toISOString(),
    generated_by: generatedBy,
  };
}
function restoreApprovalReady(body = {}) {
  const checklist = body.approval_checklist || {};
  return Boolean(checklist.business_approval && checklist.technical_approval && checklist.rollback_plan_reviewed && checklist.backup_verified);
}
function safeExportFileName(hospital) {
  const code = String(hospital.hospital_code || `H${hospital.id}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return `${code}_tenant_export_${safeDate()}.json`;
}
function compactUser(req) {
  return { id: req.user?.id, role: req.user?.role, email: req.user?.email };
}

async function getHospitalOr404(hospitalId, res) {
  const hospital = await Hospital.findOne({ id: Number(hospitalId) }).lean();
  if (!hospital) {
    res.status(404).json({ message: 'Hospital not found' });
    return null;
  }
  return hospital;
}

async function createDrLog({ req, hospital, event_type, status = 'open', severity = 'info', summary, details = {}, related_backup_id, related_restore_request_id, related_export_id }) {
  const log = await TenantDisasterRecoveryLog.create({
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    event_type,
    status,
    severity,
    summary,
    details,
    related_backup_id,
    related_restore_request_id,
    related_export_id,
    created_by: req.user?.id,
  });
  await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: summary, module_name: 'tenant_disaster_recovery', entity_type: 'tenant_disaster_recovery_log', entity_id: log.id, new_value: log.toJSON ? log.toJSON() : log });
  return log;
}

async function tenantExportPayload(hospital) {
  const hospitalId = Number(hospital.id);
  const [patients, doctors, appointments, billings, medicines, labTests, radiologyTests, ipdAdmissions] = await Promise.all([
    Patient.find({ hospital_id: hospitalId }).lean(),
    Doctor.find({ hospital_id: hospitalId }).lean(),
    Appointment.find({ hospital_id: hospitalId }).lean(),
    Billing.find({ hospital_id: hospitalId }).lean(),
    Medicine.find({ hospital_id: hospitalId }).lean(),
    LabTest.find({ hospital_id: hospitalId }).lean(),
    RadiologyTest.find({ hospital_id: hospitalId }).lean(),
    IpdAdmission.find({ hospital_id: hospitalId }).lean(),
  ]);
  const collections = { patients, doctors, appointments, billings, medicines, lab_tests: labTests, radiology_tests: radiologyTests, ipd_admissions: ipdAdmissions };
  return {
    metadata: {
      export_version: 'phase4n-v1',
      generated_at: new Date().toISOString(),
      hospital: { id: hospital.id, code: hospital.hospital_code, name: hospital.name, tenant_db_name: hospital.tenant_db_name || null },
      record_counts: Object.fromEntries(Object.entries(collections).map(([key, rows]) => [key, rows.length])),
    },
    collections,
  };
}

router.get('/tenant-databases/overview', asyncHandler(async (_req, res) => {
  const hospitals = await Hospital.find().sort({ id: -1 }).lean();
  const [backups, restoreRequests, exports, drLogs] = await Promise.all([
    TenantBackup.find().sort({ id: -1 }).limit(20).lean(),
    TenantRestoreRequest.find().sort({ id: -1 }).limit(20).lean(),
    TenantDataExport.find().sort({ id: -1 }).limit(20).lean(),
    TenantDisasterRecoveryLog.find().sort({ id: -1 }).limit(20).lean(),
  ]);
  const status = await listTenantConnectionStatus();
  const summary = {
    total_hospitals: hospitals.length,
    isolated_databases: hospitals.filter((h) => h.tenant_db_name).length,
    shared_database_hospitals: hospitals.filter((h) => !h.tenant_db_name).length,
    latest_backups: backups.length,
    restore_requests_open: restoreRequests.filter((r) => ['requested', 'approved', 'scheduled', 'running'].includes(r.status)).length,
    exports_ready: exports.filter((e) => e.status === 'completed').length,
    dr_events_open: drLogs.filter((l) => l.status === 'open').length,
  };
  res.json({ summary, hospitals, backups, restore_requests: restoreRequests, exports, disaster_recovery_logs: drLogs, connection_status: status });
}));

router.post('/tenant-databases/:hospitalId/provision', asyncHandler(async (req, res) => {
  const hospital = await Hospital.findOne({ id: Number(req.params.hospitalId) });
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const requested = sanitizeDbName(req.body.tenant_db_name);
  const dbName = requested || hospital.tenant_db_name || buildTenantDbName({ hospital_code: hospital.hospital_code, id: hospital.id, name: hospital.name });
  await ensureTenantDatabase(dbName);
  hospital.tenant_db_name = dbName;
  hospital.tenant_db_status = 'active';
  hospital.tenant_db_created_at = hospital.tenant_db_created_at || new Date();
  await hospital.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: `Provisioned tenant database ${dbName}`, module_name: 'tenant_database', entity_type: 'hospital', entity_id: hospital.id });
  res.json({ message: 'Tenant database provisioned', hospital: publicHospital(hospital), tenant_db_name: dbName });
}));

router.post('/tenant-databases/:hospitalId/backup', asyncHandler(async (req, res) => {
  const hospital = await getHospitalOr404(req.params.hospitalId, res);
  if (!hospital) return;
  const dbName = sanitizeDbName(hospital.tenant_db_name);
  if (!dbName) return res.status(400).json({ message: 'This hospital is still using shared database mode. Provision a tenant DB first.' });
  ensureDir(BACKUP_DIR);
  const fileName = `${dbName}_${safeDate()}.archive.gz`;
  const backupPath = path.join(BACKUP_DIR, fileName);
  const backup = await TenantBackup.create({
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    tenant_db_name: dbName,
    backup_type: req.body.backup_type || 'manual',
    status: 'queued',
    storage_provider: 'local',
    backup_path: backupPath,
    file_name: fileName,
    retention_until: addDays(req.body.retention_days || BACKUP_RETENTION_DAYS),
    requested_by: req.user.id,
    notes: req.body.notes || '',
  });

  const drLog = await createDrLog({ req, hospital, event_type: 'backup_queued', status: 'open', severity: 'info', related_backup_id: backup.id, summary: `Queued tenant backup for ${dbName}`, details: { backup_id: backup.id, file_name: fileName, requested_by: compactUser(req) } });
  await TenantBackup.updateOne({ id: backup.id }, { $set: { disaster_recovery_log_id: drLog.id } });

  const args = [`--uri=${uriForDb(dbName)}`, `--archive=${backupPath}`, '--gzip'];
  const child = spawn(process.env.MONGODUMP_BIN || 'mongodump', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('spawn', async () => {
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: 'running', started_at: new Date() } });
  });
  child.on('error', async (err) => {
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: 'failed', verification_status: 'failed', error_message: err.message, completed_at: new Date() } });
    await TenantDisasterRecoveryLog.updateOne({ id: drLog.id }, { $set: { status: 'open', severity: 'critical', summary: `Tenant backup failed to start for ${dbName}`, details: { error: err.message } } });
  });
  child.on('close', async (code) => {
    const ok = code === 0 && fs.existsSync(backupPath);
    const size = ok ? fs.statSync(backupPath).size : 0;
    const checksum = ok ? sha256File(backupPath) : '';
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: ok ? 'completed' : 'failed', verification_status: ok ? 'pending' : 'failed', size_bytes: size, checksum_sha256: checksum, manifest: ok ? buildManifest({ filePath: backupPath, fileName, generatedBy: compactUser({ user: { id: backup.requested_by, role: 'system' } }), purpose: 'tenant_backup' }) : {}, completed_at: new Date(), error_message: ok ? '' : (stderr || `mongodump exited with ${code}`) } });
    await TenantDisasterRecoveryLog.updateOne({ id: drLog.id }, { $set: { status: ok ? 'resolved' : 'open', severity: ok ? 'info' : 'critical', resolved_at: ok ? new Date() : null, summary: ok ? `Tenant backup completed for ${dbName}` : `Tenant backup failed for ${dbName}`, details: { backup_id: backup.id, size_bytes: size, checksum_sha256: checksum, error: ok ? '' : stderr } } });
  });

  await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: `Queued tenant backup for ${dbName}`, module_name: 'tenant_backup', entity_type: 'tenant_backup', entity_id: backup.id });
  res.status(202).json({ message: 'Tenant backup queued', backup: { ...(backup.toJSON ? backup.toJSON() : backup), disaster_recovery_log_id: drLog.id } });
}));

router.get('/tenant-databases/backups', asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.hospital_id) q.hospital_id = Number(req.query.hospital_id);
  if (req.query.status) q.status = String(req.query.status);
  res.json(await TenantBackup.find(q).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean());
}));

router.post('/tenant-databases/backups/:id/verify', asyncHandler(async (req, res) => {
  const backup = await TenantBackup.findOne({ id: Number(req.params.id) });
  if (!backup) return res.status(404).json({ message: 'Backup not found' });
  const hospital = await Hospital.findOne({ id: Number(backup.hospital_id) }).lean();
  const exists = backup.backup_path && fs.existsSync(backup.backup_path);
  const checksum = exists ? sha256File(backup.backup_path) : '';
  const checksumMatches = exists && (!backup.checksum_sha256 || backup.checksum_sha256 === checksum);
  backup.verified_at = exists && checksumMatches ? new Date() : null;
  backup.verified_by = req.user.id;
  backup.verification_status = exists && checksumMatches ? 'verified' : 'failed';
  backup.status = exists && checksumMatches && backup.status === 'completed' ? 'verified' : backup.status;
  backup.error_message = exists ? (checksumMatches ? backup.error_message : 'Backup checksum mismatch') : 'Backup file is missing on server storage';
  if (checksum && !backup.checksum_sha256) backup.checksum_sha256 = checksum;
  await backup.save();
  if (hospital) await createDrLog({ req, hospital, event_type: 'backup_verification', status: exists && checksumMatches ? 'resolved' : 'open', severity: exists && checksumMatches ? 'info' : 'critical', related_backup_id: backup.id, summary: exists && checksumMatches ? 'Backup verification passed' : 'Backup verification failed', details: { exists, checksum_matches: checksumMatches, file_name: backup.file_name } });
  res.json({ message: exists && checksumMatches ? 'Backup file verified' : 'Backup verification failed', backup, exists, checksum_matches: checksumMatches });
}));

router.post('/tenant-databases/backups/:id/restore-requests', asyncHandler(async (req, res) => {
  const backup = await TenantBackup.findOne({ id: Number(req.params.id) }).lean();
  if (!backup) return res.status(404).json({ message: 'Backup not found' });
  if (!['completed', 'verified'].includes(backup.status)) return res.status(400).json({ message: 'Only completed or verified backups can be used for restore requests' });
  const hospital = await getHospitalOr404(backup.hospital_id, res);
  if (!hospital) return;
  const restore = await TenantRestoreRequest.create({
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    tenant_db_name: backup.tenant_db_name,
    backup_id: backup.id,
    restore_scope: req.body.restore_scope || 'full_tenant',
    status: 'requested',
    priority: req.body.priority || 'normal',
    requested_by: req.user.id,
    target_environment: req.body.target_environment || 'staging',
    dry_run_required: req.body.dry_run_required !== false,
    approval_checklist: req.body.approval_checklist || {},
    rollback_plan: req.body.rollback_plan || '',
    reason: req.body.reason || '',
    notes: req.body.notes || '',
  });
  const drLog = await createDrLog({ req, hospital, event_type: 'restore_request', status: 'open', severity: restore.priority === 'urgent' ? 'high' : 'warning', related_backup_id: backup.id, related_restore_request_id: restore.id, summary: `Restore request created for backup ${backup.id}`, details: { restore_id: restore.id, target_environment: restore.target_environment, dry_run_required: restore.dry_run_required } });
  await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: `Restore request created for backup ${backup.id}`, module_name: 'tenant_restore', entity_type: 'tenant_restore_request', entity_id: restore.id, new_value: restore.toJSON ? restore.toJSON() : restore });
  res.status(201).json({ message: 'Restore request created. Actual restore remains gated for manual approval/runbook execution.', restore_request: restore, disaster_recovery_log_id: drLog.id });
}));

router.get('/tenant-databases/restore-requests', asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.hospital_id) q.hospital_id = Number(req.query.hospital_id);
  if (req.query.status) q.status = String(req.query.status);
  res.json(await TenantRestoreRequest.find(q).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean());
}));

router.patch('/tenant-databases/restore-requests/:id', asyncHandler(async (req, res) => {
  const restore = await TenantRestoreRequest.findOne({ id: Number(req.params.id) });
  if (!restore) return res.status(404).json({ message: 'Restore request not found' });
  const allowed = ['approved', 'scheduled', 'running', 'completed', 'rejected', 'cancelled', 'failed'];
  if (req.body.status && !allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid restore status' });
  if (req.body.approval_checklist !== undefined) restore.approval_checklist = req.body.approval_checklist || {};
  if (req.body.status === 'approved' && !restoreApprovalReady({ approval_checklist: restore.approval_checklist })) {
    return res.status(400).json({ message: 'Restore approval checklist incomplete', required: ['business_approval', 'technical_approval', 'rollback_plan_reviewed', 'backup_verified'] });
  }
  const prev = restore.toJSON ? restore.toJSON() : { ...restore };
  if (req.body.status) restore.status = req.body.status;
  if (req.body.notes !== undefined) restore.notes = req.body.notes;
  if (req.body.scheduled_at !== undefined) restore.scheduled_at = req.body.scheduled_at;
  if (req.body.error_message !== undefined) restore.error_message = req.body.error_message;
  if (restore.status === 'approved' && !restore.approved_at) { restore.approved_at = new Date(); restore.approved_by = req.user.id; }
  if (restore.status === 'running' && !restore.started_at) restore.started_at = new Date();
  if (['completed', 'failed', 'cancelled', 'rejected'].includes(restore.status) && !restore.completed_at) restore.completed_at = new Date();
  await restore.save();
  const hospital = await Hospital.findOne({ id: Number(restore.hospital_id) }).lean();
  if (hospital) await createDrLog({ req, hospital, event_type: 'restore_status', status: ['completed', 'cancelled', 'rejected'].includes(restore.status) ? 'resolved' : 'open', severity: restore.status === 'failed' ? 'critical' : 'info', related_restore_request_id: restore.id, related_backup_id: restore.backup_id, summary: `Restore request ${restore.id} status changed to ${restore.status}`, details: { previous_status: prev.status, new_status: restore.status } });
  await auditEvent({ req, userId: req.user.id, hospital_id: restore.hospital_id, action: `Restore request ${restore.id} updated`, module_name: 'tenant_restore', entity_type: 'tenant_restore_request', entity_id: restore.id, old_value: prev, new_value: restore.toJSON ? restore.toJSON() : restore });
  res.json({ message: 'Restore request updated', restore_request: restore });
}));

router.post('/tenant-databases/:hospitalId/export', asyncHandler(async (req, res) => {
  const hospital = await getHospitalOr404(req.params.hospitalId, res);
  if (!hospital) return;
  ensureDir(EXPORT_DIR);
  const fileName = safeExportFileName(hospital);
  const exportPath = path.join(EXPORT_DIR, fileName);
  const exportRow = await TenantDataExport.create({
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    export_type: req.body.export_type || 'tenant_data',
    export_format: 'json',
    status: 'running',
    requested_by: req.user.id,
    requested_by_role: req.user.role,
    file_name: fileName,
    export_path: exportPath,
    filters: req.body.filters || {},
    expires_at: addDays(req.body.expires_in_days || EXPORT_TTL_DAYS),
    notes: req.body.notes || '',
  });
  try {
    const payload = await tenantExportPayload(hospital);
    const body = JSON.stringify(payload, null, 2);
    fs.writeFileSync(exportPath, body);
    const checksum = sha256File(exportPath);
    exportRow.status = 'completed';
    exportRow.size_bytes = Buffer.byteLength(body);
    exportRow.record_counts = payload.metadata.record_counts;
    exportRow.checksum_sha256 = checksum;
    exportRow.manifest = buildManifest({ filePath: exportPath, fileName, recordCounts: payload.metadata.record_counts, generatedBy: compactUser(req), purpose: 'tenant_data_export' });
    exportRow.completed_at = new Date();
    await exportRow.save();
    await createDrLog({ req, hospital, event_type: 'tenant_export', status: 'resolved', severity: 'info', related_export_id: exportRow.id, summary: `Tenant data export completed for hospital ${hospital.id}`, details: { export_id: exportRow.id, record_counts: exportRow.record_counts, file_name: fileName } });
    await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: `Tenant data export completed for hospital ${hospital.id}`, module_name: 'tenant_export', entity_type: 'tenant_data_export', entity_id: exportRow.id, new_value: exportRow.toJSON ? exportRow.toJSON() : exportRow });
    res.status(201).json({ message: 'Tenant data export completed', export: exportRow, download_endpoint: `/api/tenant-databases/exports/${exportRow.id}/download` });
  } catch (error) {
    exportRow.status = 'failed';
    exportRow.error_message = error.message;
    await exportRow.save();
    await createDrLog({ req, hospital, event_type: 'tenant_export', status: 'open', severity: 'critical', related_export_id: exportRow.id, summary: `Tenant data export failed for hospital ${hospital.id}`, details: { error: error.message } });
    throw error;
  }
}));

router.get('/tenant-databases/exports', asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.hospital_id) q.hospital_id = Number(req.query.hospital_id);
  if (req.query.status) q.status = String(req.query.status);
  res.json(await TenantDataExport.find(q).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean());
}));

router.get('/tenant-databases/exports/:id/manifest', asyncHandler(async (req, res) => {
  const exportRow = await TenantDataExport.findOne({ id: Number(req.params.id) }).lean();
  if (!exportRow) return res.status(404).json({ message: 'Export not found' });
  if (exportRow.status !== 'completed') return res.status(400).json({ message: 'Export is not ready' });
  res.json({ export_id: exportRow.id, checksum_sha256: exportRow.checksum_sha256, manifest: exportRow.manifest || {}, expires_at: exportRow.expires_at });
}));

router.get('/tenant-databases/exports/:id/download', asyncHandler(async (req, res) => {
  const exportRow = await TenantDataExport.findOne({ id: Number(req.params.id) });
  if (!exportRow) return res.status(404).json({ message: 'Export not found' });
  if (exportRow.status !== 'completed') return res.status(400).json({ message: 'Export is not ready for download' });
  if (exportRow.expires_at && new Date(exportRow.expires_at) < new Date()) return res.status(410).json({ message: 'Export has expired' });
  if (!exportRow.export_path || !fs.existsSync(exportRow.export_path)) return res.status(404).json({ message: 'Export file is missing on server storage' });
  exportRow.downloaded_at = new Date();
  await exportRow.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: exportRow.hospital_id, action: `Tenant data export ${exportRow.id} downloaded`, module_name: 'tenant_export', entity_type: 'tenant_data_export', entity_id: exportRow.id });
  res.download(exportRow.export_path, exportRow.file_name || path.basename(exportRow.export_path));
}));

router.get('/tenant-databases/disaster-recovery-logs', asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.hospital_id) q.hospital_id = Number(req.query.hospital_id);
  if (req.query.event_type) q.event_type = String(req.query.event_type);
  if (req.query.status) q.status = String(req.query.status);
  res.json(await TenantDisasterRecoveryLog.find(q).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean());
}));

module.exports = router;
