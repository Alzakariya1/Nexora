const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Hospital, TenantBackup } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { auditEvent } = require('../utils/audit');
const {
  buildTenantDbName,
  ensureTenantDatabase,
  listTenantConnectionStatus,
  sanitizeDbName,
  uriForDb,
} = require('../config/tenantDb');

const router = express.Router();
router.use(verifyToken, requirePermission('hospital.manage'));

const BACKUP_DIR = process.env.TENANT_BACKUP_DIR || path.join(__dirname, '../../backups/tenants');
function ensureBackupDir() { fs.mkdirSync(BACKUP_DIR, { recursive: true }); }
function safeDate() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function publicHospital(h) {
  const x = h?.toJSON ? h.toJSON() : { ...(h || {}) };
  return x;
}

router.get('/tenant-databases/overview', asyncHandler(async (_req, res) => {
  const hospitals = await Hospital.find().sort({ id: -1 }).lean();
  const backups = await TenantBackup.find().sort({ id: -1 }).limit(20).lean();
  const status = await listTenantConnectionStatus();
  const summary = {
    total_hospitals: hospitals.length,
    isolated_databases: hospitals.filter((h) => h.tenant_db_name).length,
    shared_database_hospitals: hospitals.filter((h) => !h.tenant_db_name).length,
    latest_backups: backups.length,
  };
  res.json({ summary, hospitals, backups, connection_status: status });
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
  const hospital = await Hospital.findOne({ id: Number(req.params.hospitalId) }).lean();
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const dbName = sanitizeDbName(hospital.tenant_db_name);
  if (!dbName) return res.status(400).json({ message: 'This hospital is still using shared database mode. Provision a tenant DB first.' });
  ensureBackupDir();
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
    requested_by: req.user.id,
    notes: req.body.notes || '',
  });

  const args = [`--uri=${uriForDb(dbName)}`, `--archive=${backupPath}`, '--gzip'];
  const child = spawn(process.env.MONGODUMP_BIN || 'mongodump', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('spawn', async () => {
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: 'running', started_at: new Date() } });
  });
  child.on('error', async (err) => {
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: 'failed', error_message: err.message, completed_at: new Date() } });
  });
  child.on('close', async (code) => {
    const ok = code === 0 && fs.existsSync(backupPath);
    const size = ok ? fs.statSync(backupPath).size : 0;
    await TenantBackup.updateOne({ id: backup.id }, { $set: { status: ok ? 'completed' : 'failed', size_bytes: size, completed_at: new Date(), error_message: ok ? '' : (stderr || `mongodump exited with ${code}`) } });
  });

  await auditEvent({ req, userId: req.user.id, hospital_id: hospital.id, action: `Queued tenant backup for ${dbName}`, module_name: 'tenant_backup', entity_type: 'tenant_backup', entity_id: backup.id });
  res.status(202).json({ message: 'Tenant backup queued', backup });
}));

router.get('/tenant-databases/backups', asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.hospital_id) q.hospital_id = Number(req.query.hospital_id);
  res.json(await TenantBackup.find(q).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean());
}));

router.post('/tenant-databases/backups/:id/verify', asyncHandler(async (req, res) => {
  const backup = await TenantBackup.findOne({ id: Number(req.params.id) });
  if (!backup) return res.status(404).json({ message: 'Backup not found' });
  const exists = backup.backup_path && fs.existsSync(backup.backup_path);
  backup.verified_at = exists ? new Date() : null;
  backup.status = exists && backup.status === 'completed' ? 'verified' : backup.status;
  backup.error_message = exists ? backup.error_message : 'Backup file is missing on server storage';
  await backup.save();
  res.json({ message: exists ? 'Backup file verified' : 'Backup file missing', backup, exists });
}));

module.exports = router;
