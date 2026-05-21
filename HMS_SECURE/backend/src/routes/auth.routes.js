const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Hospital, AuthSession } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, allowRoles, requirePermission, getUserPermissions } = require('../middleware/auth');
const { ROLE_PERMISSIONS, ALL_PERMISSIONS, buildPermissionCatalog, getRolePermissions } = require('../config/permissions');
const { DEFAULT_HOSPITAL_ID, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent, loginHistoryEvent } = require('../utils/audit');
const { ensureWithinLimit } = require('../utils/subscription');
const router = express.Router();
const VALID_ROLES = ['super_admin', 'admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'pharmacist', 'lab_technician', 'patient'];
const VALID_STATUS = ['active', 'inactive'];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const MANAGEABLE_ROLES = {
  super_admin: VALID_ROLES,
  admin: VALID_ROLES.filter((r) => r !== 'super_admin'),
  hospital_admin: VALID_ROLES.filter((r) => !['super_admin', 'admin'].includes(r)),
};
const canManageRole = (actorRole, targetRole) => Boolean(MANAGEABLE_ROLES[actorRole]?.includes(targetRole));
const normalizeCustomPermissions = (permissions = [], actor = {}, targetRole = null) => {
  if (!Array.isArray(permissions)) return [];
  const requested = Array.from(new Set(permissions.map(String).filter((p) => ALL_PERMISSIONS.includes(p))));
  const actorPerms = getUserPermissions(actor);
  const grantable = actorPerms.includes('*') ? requested : requested.filter((p) => actorPerms.includes(p));
  const targetBase = new Set(getRolePermissions(targetRole || actor.role));
  return grantable.filter((p) => !targetBase.has(p));
};
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const durationMs = (value, fallbackMs) => {
  const raw = String(value || '').trim();
  if (!raw) return fallbackMs;
  const m = raw.match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = (m[2] || 'ms').toLowerCase();
  return n * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] || 1);
};
function validatePassword(password) {
  const min = Number(process.env.PASSWORD_MIN_LENGTH || 8);
  const value = String(password || '');
  if (value.length < min) return `Password must be at least ${min} characters`;
  if ((process.env.PASSWORD_REQUIRE_COMPLEXITY || 'false') === 'true') {
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
      return 'Password must include uppercase, lowercase, number and special character';
    }
  }
  return null;
}
const accessTokenTtl = () => process.env.JWT_EXPIRES_IN || '8h';
const refreshTokenTtlMs = () => durationMs(process.env.REFRESH_TOKEN_EXPIRES_IN || '7d', 7 * 86400000);
const lockThreshold = () => Number(process.env.LOGIN_LOCK_ATTEMPTS || 5);
const lockMs = () => durationMs(process.env.LOGIN_LOCK_DURATION || '15m', 15 * 60000);
async function createAuthSession(req, user, hospital) {
  const sessionId = crypto.randomUUID();
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const now = new Date();
  await AuthSession.create({
    user_id: user.id,
    hospital_id: Number(user.hospital_id || DEFAULT_HOSPITAL_ID),
    session_id: sessionId,
    refresh_token_hash: hashToken(refreshToken),
    user_agent: req.get('user-agent') || '',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    status: 'active',
    expires_at: new Date(now.getTime() + refreshTokenTtlMs()),
    last_used_at: now,
  });
  return { sessionId, refreshToken, token: signToken(user, hospital, sessionId) };
}


async function ensureDefaultHospital() {
    const defaultId = DEFAULT_HOSPITAL_ID;
    let hospital = await Hospital.findOne({ id: defaultId });
    if (!hospital) {
        hospital = await Hospital.create({
            id: defaultId,
            hospital_code: 'DEFAULT',
            name: process.env.DEFAULT_HOSPITAL_NAME || 'Default Hospital',
            type: 'hospital',
            status: 'active',
            plan: 'enterprise',
            enabled_modules: ['dashboard', 'patients', 'doctors', 'appointments', 'beds', 'ipd', 'lab', 'radiology', 'pharmacy', 'billing', 'profile'],
            feature_flags: { audit_compliance: true },
        });
    }
    return hospital;
}

async function audit(req, userId, action, module_name = 'auth', hospital_id = DEFAULT_HOSPITAL_ID, extra = {}) { await auditEvent({ req, userId, action, module_name, hospital_id, ...extra }); }
const signToken = (user, hospital = null, sessionId = null) => jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name, hospital_id: Number(user.hospital_id || process.env.DEFAULT_HOSPITAL_ID || 1), tenant_db_name: hospital?.tenant_db_name || user.tenant_db_name || null, session_id: sessionId, permissions: getUserPermissions(user) }, process.env.JWT_SECRET || 'dev_secret_change_me', { expiresIn: accessTokenTtl() });
const publicUser = (u) => { const x = u.toJSON ? u.toJSON() : { ...u }; delete x.password; delete x.reset_token; delete x.reset_token_expires; x.hospital_id = Number(x.hospital_id || process.env.DEFAULT_HOSPITAL_ID || 1); x.tenant_db_name = x.tenant_db_name || null; x.permissions = getUserPermissions(x); return x; };
router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  await ensureDefaultHospital();
  const user = await User.findOne({ email, status: 'active' }).lean(false);
  if (!user) {
    await loginHistoryEvent({ req, email, status: 'failed', reason: 'user_not_found_or_inactive' });
    await audit(req, null, `Failed login for ${email}`, 'security', DEFAULT_HOSPITAL_ID, { status: 'failed', severity: 'warning' });
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (user.locked_until && user.locked_until > new Date()) {
    await loginHistoryEvent({ req, user, email, status: 'blocked', reason: 'account_locked' });
    await audit(req, user.id, `Blocked login for locked account ${email}`, 'security', user.hospital_id, { status: 'blocked', severity: 'warning' });
    return res.status(423).json({ message: 'Account temporarily locked because of multiple failed login attempts. Try again later or contact admin.' });
  }
  const ok = await bcrypt.compare(String(password), user.password || '');
  if (!ok) {
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const update = { failed_login_attempts: attempts, last_failed_login_at: new Date() };
    if (attempts >= lockThreshold()) update.locked_until = new Date(Date.now() + lockMs());
    await User.updateOne({ id: user.id }, { $set: update });
    await loginHistoryEvent({ req, user, email, status: attempts >= lockThreshold() ? 'blocked' : 'failed', reason: 'invalid_password' });
    await audit(req, user.id, `Failed login for ${email}`, 'security', user.hospital_id, { status: attempts >= lockThreshold() ? 'blocked' : 'failed', severity: 'warning', new_value: { failed_login_attempts: attempts, locked_until: update.locked_until || null } });
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (!user.hospital_id) user.hospital_id = DEFAULT_HOSPITAL_ID;
  const hospital = await Hospital.findOne({ id: Number(user.hospital_id || DEFAULT_HOSPITAL_ID) });
  if (user.role !== 'super_admin' && hospital && !['active', 'trial'].includes(hospital.status)) {
    await loginHistoryEvent({ req, user, email, status: 'blocked', reason: 'inactive_hospital' });
    await audit(req, user.id, `Blocked login for inactive hospital ${hospital.name}`, 'security', user.hospital_id, { status: 'blocked', severity: 'warning' });
    return res.status(403).json({ message: 'This hospital account is not active. Contact platform admin.' });
  }
  user.last_login_at = new Date();
  user.failed_login_attempts = 0;
  user.locked_until = null;
  await user.save();
  await loginHistoryEvent({ req, user, email, status: 'success', reason: 'login_success' });
  await audit(req, user.id, 'User logged in', 'auth', user.hospital_id, { entity_type: 'user', entity_id: user.id });
  const session = await createAuthSession(req, user, hospital);
  const outUser = publicUser(user); outUser.tenant_db_name = hospital?.tenant_db_name || null; outUser.tenant_storage_mode = hospital?.tenant_db_name ? 'database-per-tenant' : 'shared-database'; res.json({ message: 'Login successful', token: session.token, refreshToken: session.refreshToken, session_id: session.sessionId, user: outUser });
}));

router.post('/refresh-token', asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });
  const session = await AuthSession.findOne({ refresh_token_hash: hashToken(refreshToken), status: 'active' });
  if (!session || (session.expires_at && session.expires_at < new Date())) {
    if (session) await AuthSession.updateOne({ id: session.id }, { $set: { status: 'expired', revoked_at: new Date() } });
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
  const user = await User.findOne({ id: session.user_id, status: 'active' });
  if (!user) return res.status(401).json({ message: 'User inactive. Please login again.' });
  const hospital = await Hospital.findOne({ id: Number(user.hospital_id || DEFAULT_HOSPITAL_ID) });
  if (user.role !== 'super_admin' && hospital && !['active', 'trial'].includes(hospital.status)) {
    await AuthSession.updateOne({ id: session.id }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: user.id } });
    return res.status(403).json({ message: 'This hospital account is not active. Contact platform admin.' });
  }
  const newRefreshToken = crypto.randomBytes(48).toString('hex');
  await AuthSession.updateOne({ id: session.id }, { $set: { refresh_token_hash: hashToken(newRefreshToken), last_used_at: new Date(), expires_at: new Date(Date.now() + refreshTokenTtlMs()) } });
  await audit(req, user.id, 'Refreshed auth session', 'security', user.hospital_id, { entity_type: 'auth_session', entity_id: session.id });
  res.json({ token: signToken(user, hospital, session.session_id), refreshToken: newRefreshToken, user: publicUser(user) });
}));
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
  if (req.user.session_id) await AuthSession.updateOne({ session_id: req.user.session_id, user_id: req.user.id }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: req.user.id } });
  await audit(req, req.user.id, 'User logged out', 'security', req.user.hospital_id, { entity_type: 'auth_session', entity_id: req.user.session_id });
  res.json({ message: 'Logged out successfully' });
}));
router.post('/logout-all', verifyToken, asyncHandler(async (req, res) => {
  const result = await AuthSession.updateMany({ user_id: req.user.id, status: 'active' }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: req.user.id } });
  await audit(req, req.user.id, 'Logged out from all devices', 'security', req.user.hospital_id, { entity_type: 'user', entity_id: req.user.id, new_value: { revoked_sessions: result.modifiedCount || 0 } });
  res.json({ message: 'Logged out from all devices', revoked_sessions: result.modifiedCount || 0 });
}));
router.get('/sessions', verifyToken, asyncHandler(async (req, res) => {
  const rows = await AuthSession.find({ user_id: req.user.id }).sort({ last_used_at: -1, created_at: -1 }).limit(20).lean();
  res.json(rows.map((s) => ({ id: s.id, session_id: s.session_id, status: s.status, ip: s.ip, user_agent: s.user_agent, last_used_at: s.last_used_at, expires_at: s.expires_at, current: s.session_id === req.user.session_id })));
}));

router.post('/register', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => createUser(req, res)));
router.post('/forgot-password', asyncHandler(async (req, res) => { const email = normalizeEmail(req.body.email); if (!email) return res.status(400).json({ message: 'Email is required' }); const rawToken = crypto.randomBytes(32).toString('hex'); const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex'); await User.updateOne({ email, status: 'active' }, { $set: { reset_token: tokenHash, reset_token_expires: new Date(Date.now() + 30 * 60 * 1000) } }); const response = { message: 'If this email exists, password reset instructions will be sent when SMTP is configured.' }; if (process.env.NODE_ENV !== 'production') response.resetToken = rawToken; res.json(response); }));
router.post('/reset-password', asyncHandler(async (req, res) => { const { token, password } = req.body; if (!token || !password) return res.status(400).json({ message: 'Token and password are required' }); const err = validatePassword(password); if (err) return res.status(400).json({ message: err }); const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex'); const user = await User.findOne({ reset_token: tokenHash, reset_token_expires: { $gt: new Date() }, status: 'active' }); if (!user) return res.status(400).json({ message: 'Invalid or expired token' }); user.password = await bcrypt.hash(String(password), BCRYPT_ROUNDS); user.reset_token = null; user.reset_token_expires = null; user.password_changed_at = new Date(); await user.save(); await AuthSession.updateMany({ user_id: user.id, status: 'active' }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: user.id } }); await audit(req, user.id, 'Password reset and sessions revoked', 'security', user.hospital_id, { entity_type: 'user', entity_id: user.id }); res.json({ message: 'Password reset successfully' }); }));
router.get('/me', verifyToken, asyncHandler(async (req, res) => res.json(publicUser(await User.findOne({ id: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) })))));
router.get('/permissions', verifyToken, asyncHandler(async (req, res) => res.json({ role: req.user.role, permissions: getUserPermissions(req.user), rolePermissions: ROLE_PERMISSIONS, allPermissions: ALL_PERMISSIONS, catalog: buildPermissionCatalog(req.user), manageableRoles: MANAGEABLE_ROLES[req.user.role] || [] })));
router.get('/roles', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => {
  const manageableRoles = MANAGEABLE_ROLES[req.user.role] || [];
  res.json({
    roles: manageableRoles.map((role) => ({ role, basePermissions: getRolePermissions(role), effectivePermissions: getRolePermissions(role) })),
    catalog: buildPermissionCatalog(req.user),
  });
}));
router.put('/me', verifyToken, asyncHandler(async (req, res) => {
    const allowed = ['full_name', 'profile_image', 'bio'];
    const update = {};

    allowed.forEach(k => {
        if (k in req.body) update[k] = req.body[k];
    });

    await User.updateOne({ id: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) }, { $set: update });
    await audit(req, req.user.id, 'Updated own profile', 'profile', req.user.hospital_id, { entity_type: 'user', entity_id: req.user.id, new_value: update });
    const user = await User.findOne({ id: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) });
    res.json({ message: 'Profile updated', user: publicUser(user) });
}));

router.put('/change-password', verifyToken, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Old password and new password are required' });
    }

    const user = await User.findOne({ email: req.user.email, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) });

    if (!user) return res.status(404).json({ message: 'Admin user not found' });

    const ok = await bcrypt.compare(String(oldPassword), user.password || '');
    if (!ok) return res.status(400).json({ message: 'Old password is incorrect' });

    const err = validatePassword(newPassword);
    if (err) return res.status(400).json({ message: err });

    const hashed = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);

    const result = await User.updateOne(
        { email: req.user.email, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) },
        {
            $set: {
                password: hashed,
                password_changed_at: new Date()
            }
        }
    );

    if (result.modifiedCount === 0) {
        return res.status(500).json({ message: 'Password not updated in database' });
    }

    await AuthSession.updateMany({ user_id: req.user.id, status: 'active' }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: req.user.id } });
    await audit(req, req.user.id, 'Changed password and revoked sessions', 'security', req.user.hospital_id, { entity_type: 'user', entity_id: req.user.id });
    res.json({ message: 'Password changed successfully. Please login again.' });
}));
router.get('/users', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => {
    const filter = req.user.role === 'super_admin' ? {} : { hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) };
    const users = await User.find(filter).sort({ id: -1 });
    res.json(users.map(publicUser));
}));

router.get('/users/:id', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => {
    const filter = req.user.role === 'super_admin' ? { id: Number(req.params.id) } : { id: Number(req.params.id), hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) };
    const found = await User.findOne(filter);
    if (!found) return res.status(404).json({ message: 'User not found' });
    res.json(publicUser(found));
}));
async function createUser(req, res) {
    const { full_name, password, role = 'receptionist', phone, status = 'active', profile_image, bio, permissions } = req.body;
    const hospital_id = Number((req.user?.role === 'super_admin' && req.body.hospital_id) || req.user?.hospital_id || DEFAULT_HOSPITAL_ID);
    const email = normalizeEmail(req.body.email);
    if (!full_name || !email || !password) return res.status(400).json({ message: 'full_name, email and password are required' });
    const err = validatePassword(password);
    if (err) return res.status(400).json({ message: err });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!canManageRole(req.user?.role || 'admin', role)) return res.status(403).json({ message: 'You cannot create this role' });
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already exists' });
    const limitCheck = await ensureWithinLimit(hospital_id, 'users', 1);
    if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });
    const u = await User.create({
        full_name, email, hospital_id, password: await bcrypt.hash(String(password), BCRYPT_ROUNDS), role, phone: phone || null, status, profile_image: profile_image || '',
        bio: bio || '', permissions: normalizeCustomPermissions(permissions, req.user || { role: 'super_admin' }, role), password_changed_at: new Date()
    });
    if (req.user) await audit(req, req.user.id, `Created user ${email}`, 'users', hospital_id, { entity_type: 'user', entity_id: u.id, new_value: publicUser(u) });
    res.status(201).json({ message: 'User registered successfully', user: publicUser(u), userId: u.id });
}
router.post('/users', verifyToken, requirePermission('admin.users.manage'), asyncHandler(createUser));
router.patch('/users/:id', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    const filter = req.user.role === 'super_admin' ? { id: targetId } : { id: targetId, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) };
    const target = await User.findOne(filter);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.id === req.user.id && ('status' in req.body || 'role' in req.body)) {
        return res.status(400).json({ message: 'You cannot change your own role or status' });
    }
    const allowed = ['full_name', 'email', 'role', 'phone', 'status', 'profile_image', 'bio', 'permissions'];
    const update = {};
    for (const k of allowed) {
        if (k in req.body) update[k] = k === 'email' ? normalizeEmail(req.body[k]) : req.body[k];
    }
    if (update.email) {
        const existing = await User.findOne({ email: update.email, id: { $ne: targetId } });
        if (existing) return res.status(409).json({ message: 'Email already exists' });
    }
    if (update.role) {
        if (!VALID_ROLES.includes(update.role)) return res.status(400).json({ message: 'Invalid role' });
        if (!canManageRole(req.user.role, update.role) || !canManageRole(req.user.role, target.role)) return res.status(403).json({ message: 'You cannot assign or manage this role' });
    }
    if (update.status && !VALID_STATUS.includes(update.status)) return res.status(400).json({ message: 'Invalid status' });
    if ('permissions' in update && !canManageRole(req.user.role, target.role)) return res.status(403).json({ message: 'You cannot manage permissions for this role' });
    if ('permissions' in update) update.permissions = normalizeCustomPermissions(update.permissions, req.user, update.role || target.role);
    if (req.body.password) {
        const err = validatePassword(req.body.password);
        if (err) return res.status(400).json({ message: err });
        update.password = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);
        update.password_changed_at = new Date();
    }
    await User.updateOne(filter, { $set: update });
    await audit(req, req.user.id, `Updated user ${targetId}`, 'users', target.hospital_id, { entity_type: 'user', entity_id: targetId, old_value: publicUser(target), new_value: update });
    const refreshed = await User.findOne(filter);
    res.json({ message: 'User updated', user: publicUser(refreshed) });
}));

router.delete('/users/:id', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) return res.status(400).json({ message: 'You cannot deactivate your own account' });
    const filter = req.user.role === 'super_admin' ? { id: targetId } : { id: targetId, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) };
    const target = await User.findOne(filter);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!canManageRole(req.user.role, target.role)) return res.status(403).json({ message: 'You cannot deactivate this role' });
    const reason = String(req.body?.reason || req.query?.reason || 'Deactivated by admin').trim();
    await User.updateOne(filter, { $set: { status: 'inactive', deleted_at: new Date(), deleted_by: req.user.id, deactivation_reason: reason } });
    await audit(req, req.user.id, `Deactivated user ${targetId}`, 'users', target.hospital_id, { entity_type: 'user', entity_id: targetId, old_value: publicUser(target), new_value: { status: 'inactive', reason }, status: 'deactivated' });
    res.json({ message: 'User deactivated' });
}));
module.exports = router;
