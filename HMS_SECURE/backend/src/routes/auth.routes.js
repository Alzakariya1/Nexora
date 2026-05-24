const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Hospital } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, allowRoles, requirePermission, getUserPermissions } = require('../middleware/auth');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { DEFAULT_HOSPITAL_ID, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent, loginHistoryEvent } = require('../utils/audit');
const { ensureWithinLimit } = require('../utils/subscription');
const router = express.Router();
const VALID_ROLES = ['super_admin', 'admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'pharmacist', 'lab_technician', 'patient'];
const VALID_STATUS = ['active', 'inactive'];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
function validatePassword(password) { const min = Number(process.env.PASSWORD_MIN_LENGTH || 8); return (!password || String(password).length < min) ? `Password must be at least ${min} characters` : null; }

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
            enabled_modules: ['dashboard', 'patients', 'doctors', 'appointments', 'beds', 'lab', 'radiology', 'pharmacy', 'billing', 'profile'],
            feature_flags: { audit_compliance: true },
        });
    }
    return hospital;
}

async function audit(req, userId, action, module_name = 'auth', hospital_id = DEFAULT_HOSPITAL_ID, extra = {}) { await auditEvent({ req, userId, action, module_name, hospital_id, ...extra }); }
const signToken = (user, hospital = null) => jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name, hospital_id: Number(user.hospital_id || process.env.DEFAULT_HOSPITAL_ID || 1), tenant_db_name: hospital?.tenant_db_name || user.tenant_db_name || null, permissions: getUserPermissions(user) }, process.env.JWT_SECRET || 'dev_secret_change_me', { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
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
  const ok = await bcrypt.compare(String(password), user.password || '');
  if (!ok) {
    await loginHistoryEvent({ req, user, email, status: 'failed', reason: 'invalid_password' });
    await audit(req, user.id, `Failed login for ${email}`, 'security', user.hospital_id, { status: 'failed', severity: 'warning' });
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (!user.hospital_id) user.hospital_id = DEFAULT_HOSPITAL_ID;
  const hospital = await Hospital.findOne({ id: Number(user.hospital_id || DEFAULT_HOSPITAL_ID) });
  if (user.role !== 'super_admin' && hospital && hospital.status !== 'active') {
    await loginHistoryEvent({ req, user, email, status: 'blocked', reason: 'inactive_hospital' });
    await audit(req, user.id, `Blocked login for inactive hospital ${hospital.name}`, 'security', user.hospital_id, { status: 'blocked', severity: 'warning' });
    return res.status(403).json({ message: 'This hospital account is inactive or archived. Contact platform admin.' });
  }
  user.last_login_at = new Date();
  await user.save();
  await loginHistoryEvent({ req, user, email, status: 'success', reason: 'login_success' });
  await audit(req, user.id, 'User logged in', 'auth', user.hospital_id, { entity_type: 'user', entity_id: user.id });
  const outUser = publicUser(user); outUser.tenant_db_name = hospital?.tenant_db_name || null; outUser.tenant_storage_mode = hospital?.tenant_db_name ? 'database-per-tenant' : 'shared-database'; res.json({ message: 'Login successful', token: signToken(user, hospital), user: outUser });
}));
router.post('/register', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => createUser(req, res)));
router.post('/forgot-password', asyncHandler(async (req, res) => { const email = normalizeEmail(req.body.email); if (!email) return res.status(400).json({ message: 'Email is required' }); const rawToken = crypto.randomBytes(32).toString('hex'); const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex'); await User.updateOne({ email, status: 'active' }, { $set: { reset_token: tokenHash, reset_token_expires: new Date(Date.now() + 30 * 60 * 1000) } }); res.json({ message: 'Reset token generated. Configure SMTP before production.', resetToken: rawToken }); }));
router.post('/reset-password', asyncHandler(async (req, res) => { const { token, password } = req.body; if (!token || !password) return res.status(400).json({ message: 'Token and password are required' }); const err = validatePassword(password); if (err) return res.status(400).json({ message: err }); const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex'); const user = await User.findOne({ reset_token: tokenHash, reset_token_expires: { $gt: new Date() }, status: 'active' }); if (!user) return res.status(400).json({ message: 'Invalid or expired token' }); user.password = await bcrypt.hash(String(password), BCRYPT_ROUNDS); user.reset_token = null; user.reset_token_expires = null; user.password_changed_at = new Date(); await user.save(); res.json({ message: 'Password reset successfully' }); }));
router.get('/me', verifyToken, asyncHandler(async (req, res) => res.json(publicUser(await User.findOne({ id: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) })))));
router.get('/permissions', verifyToken, asyncHandler(async (req, res) => res.json({ role: req.user.role, permissions: getUserPermissions(req.user), rolePermissions: ROLE_PERMISSIONS })));
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

    await audit(req, req.user.id, 'Changed password', 'security', req.user.hospital_id, { entity_type: 'user', entity_id: req.user.id });
    res.json({ message: 'Admin password changed successfully. Please login again.' });
}));
router.get('/users', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => res.json((await User.find(req.user.role === 'super_admin' ? {} : { hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) }).sort({ id: -1 })).map(publicUser))));
async function createUser(req, res) {
    const { full_name, password, role = 'receptionist', phone, status = 'active', profile_image, bio, permissions } = req.body;
    const hospital_id = Number((req.user?.role === 'super_admin' && req.body.hospital_id) || req.user?.hospital_id || DEFAULT_HOSPITAL_ID);
    const email = normalizeEmail(req.body.email);
    if (!full_name || !email || !password) return res.status(400).json({ message: 'full_name, email and password are required' });
    const err = validatePassword(password);
    if (err) return res.status(400).json({ message: err });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already exists' });
    const limitCheck = await ensureWithinLimit(hospital_id, 'users', 1);
    if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });
    const u = await User.create({
        full_name, email, hospital_id, password: await bcrypt.hash(String(password), BCRYPT_ROUNDS), role, phone: phone || null, status, profile_image: profile_image || '',
        bio: bio || '', permissions: Array.isArray(permissions) ? permissions : [], password_changed_at: new Date()
    });
    if (req.user) await audit(req, req.user.id, `Created user ${email}`, 'users', hospital_id, { entity_type: 'user', entity_id: u.id, new_value: publicUser(u) });
    res.status(201).json({ message: 'User registered successfully', userId: u.id });
}
router.post('/users', verifyToken, requirePermission('admin.users.manage'), asyncHandler(createUser));
router.patch('/users/:id', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => { const allowed = ['full_name', 'email', 'role', 'phone', 'status', 'profile_image', 'bio', 'permissions']; const update = {}; for (const k of allowed) { if (k in req.body) update[k] = k === 'email' ? normalizeEmail(req.body[k]) : req.body[k]; } if (update.role && !VALID_ROLES.includes(update.role)) return res.status(400).json({ message: 'Invalid role' }); if (update.status && !VALID_STATUS.includes(update.status)) return res.status(400).json({ message: 'Invalid status' }); if (req.body.password) { const err = validatePassword(req.body.password); if (err) return res.status(400).json({ message: err }); update.password = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS); update.password_changed_at = new Date(); } await User.updateOne(req.user.role === 'super_admin' ? { id: Number(req.params.id) } : { id: Number(req.params.id), hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) }, { $set: update }); await audit(req, req.user.id, `Updated user ${req.params.id}`, 'users', req.user.hospital_id, { entity_type: 'user', entity_id: req.params.id, new_value: update }); res.json({ message: 'User updated' }); }));
router.delete('/users/:id', verifyToken, requirePermission('admin.users.manage'), asyncHandler(async (req, res) => { await User.deleteOne(req.user.role === 'super_admin' ? { id: Number(req.params.id) } : { id: Number(req.params.id), hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID) }); await audit(req, req.user.id, `Deleted user ${req.params.id}`, 'users', req.user.hospital_id, { entity_type: 'user', entity_id: req.params.id, status: 'deleted' }); res.json({ message: 'User deleted' }); }));
module.exports = router;
