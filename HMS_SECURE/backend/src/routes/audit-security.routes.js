const express = require('express');
const { AuditLog, SecuritySetting, User, LoginHistory } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData, DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');
const { auditEvent, csvEscape } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const DEFAULT_SECURITY_SETTINGS = [
  { setting_key: 'password_min_length', setting_value: '8', category: 'password', description: 'Minimum password length required for users.' },
  { setting_key: 'session_timeout_minutes', setting_value: '480', category: 'session', description: 'Recommended session timeout in minutes.' },
  { setting_key: 'max_failed_login_attempts', setting_value: '5', category: 'login', description: 'Recommended failed login threshold before admin review.' },
  { setting_key: 'audit_retention_days', setting_value: '365', category: 'audit', description: 'Recommended retention period for audit logs.' },
  { setting_key: 'require_strong_passwords', setting_value: 'true', category: 'password', description: 'Require strong password policy for all users.' },
  { setting_key: 'two_factor_auth_enabled', setting_value: 'false', category: 'security', description: '2FA readiness flag for future authenticator/SMS OTP flow.' },
];

function buildAuditQuery(req) {
  const query = tenantFilter(req);
  if (req.query.module) query.module_name = req.query.module;
  if (req.query.status) query.status = req.query.status;
  if (req.query.user_id) query.user_id = Number(req.query.user_id);
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ action: rx }, { module_name: rx }, { entity_type: rx }, { path: rx }];
  }
  return query;
}

router.get('/audit-logs', requirePermission('audit.view'), asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 300), 1000);
  const rows = await AuditLog.find(buildAuditQuery(req)).sort({ id: -1 }).limit(limit).lean();
  const users = await User.find(tenantFilter(req, { id: { $in: [...new Set(rows.map(x => x.user_id).filter(Boolean))] } })).lean();
  const um = Object.fromEntries(users.map(u => [u.id, u.full_name]));
  res.json(rows.map(r => ({ ...r, user_name: um[r.user_id] || 'System' })));
}));

router.get('/audit-logs/export', requirePermission('audit.view'), asyncHandler(async (req, res) => {
  const rows = await AuditLog.find(buildAuditQuery(req)).sort({ id: -1 }).limit(5000).lean();
  const headers = ['id', 'created_at', 'user_id', 'user_role', 'action', 'module_name', 'entity_type', 'entity_id', 'status', 'severity', 'ip_address', 'method', 'path'];
  const csv = [headers.join(',')].concat(rows.map(row => headers.map(h => csvEscape(row[h])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
  res.send(csv);
}));

router.get('/security/login-history', requirePermission('security.manage'), asyncHandler(async (req, res) => {
  const query = tenantFilter(req);
  if (req.query.status) query.status = req.query.status;
  if (req.query.email) query.email = new RegExp(String(req.query.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await LoginHistory.find(query).sort({ logged_at: -1 }).limit(500).lean();
  res.json(rows);
}));

router.get('/security/summary', requirePermission('security.manage'), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [auditCount, failedLogins, deniedActions, activeUsers, settingsCount] = await Promise.all([
    AuditLog.countDocuments(tenantFilter(req)),
    LoginHistory.countDocuments(tenantFilter(req, { status: { $in: ['failed', 'blocked'] }, logged_at: { $gte: since } })),
    AuditLog.countDocuments(tenantFilter(req, { status: 'denied', created_at: { $gte: since } })),
    User.countDocuments(req.user.role === 'super_admin' ? {} : { hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), status: 'active' }),
    SecuritySetting.countDocuments(tenantFilter(req)),
  ]);
  res.json({ auditCount, failedLogins24h: failedLogins, deniedActions24h: deniedActions, activeUsers, settingsCount });
}));

router.post('/audit-logs', asyncHandler(async (req, res) => {
  await auditEvent({
    req,
    action: req.body.action,
    module_name: req.body.module_name || 'manual',
    entity_type: req.body.entity_type || null,
    entity_id: req.body.entity_id || null,
    status: req.body.status || 'success',
    severity: req.body.severity || 'info',
    new_value: req.body.details || null,
  });
  res.status(201).json({ message: 'Audit log created' });
}));

router.get('/security-settings', requirePermission('security.manage'), asyncHandler(async (req, res) => {
  res.json(await SecuritySetting.find(tenantFilter(req)).sort({ category: 1, setting_key: 1 }).lean());
}));

router.post('/security-settings/defaults', requirePermission('security.manage'), asyncHandler(async (req, res) => {
  for (const setting of DEFAULT_SECURITY_SETTINGS) {
    await SecuritySetting.findOneAndUpdate(
      tenantFilter(req, { setting_key: setting.setting_key }),
      { $setOnInsert: tenantCreateData(req, setting) },
      { upsert: true, new: true }
    );
  }
  await auditEvent({ req, action: 'Seeded default security settings', module_name: 'security', entity_type: 'security_settings' });
  res.json({ message: 'Default security settings ensured' });
}));

router.put('/security-settings/:key', requirePermission('security.manage'), asyncHandler(async (req, res) => {
  const existing = await SecuritySetting.findOne(tenantFilter(req, { setting_key: req.params.key })).lean();
  await SecuritySetting.findOneAndUpdate(
    tenantFilter(req, { setting_key: req.params.key }),
    {
      $set: tenantCreateData(req, {
        setting_key: req.params.key,
        setting_value: String(req.body.value ?? ''),
        description: req.body.description || existing?.description || '',
        category: req.body.category || existing?.category || 'general',
        updated_by: req.user.id,
      })
    },
    { upsert: true, new: true }
  );
  await auditEvent({
    req,
    action: `Security setting updated: ${req.params.key}`,
    module_name: 'security',
    entity_type: 'security_setting',
    entity_id: req.params.key,
    old_value: existing,
    new_value: { setting_key: req.params.key, setting_value: req.body.value, description: req.body.description, category: req.body.category },
  });
  res.json({ message: 'Security setting saved' });
}));

module.exports = router;
