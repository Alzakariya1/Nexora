const express = require('express');
const bcrypt = require('bcryptjs');
const { Hospital, User, AuditLog } = require('../models');
const multer = require('multer');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');
const { getPlan, getAllowedModules, getAllowedFeatures, normalizePlanModules, normalizePlanFeatureFlags, mergePlanLimits, ensureWithinLimit } = require('../utils/subscription');

const router = express.Router();

const DEFAULT_MODULES = ['dashboard', 'patients', 'doctors', 'appointments', 'beds', 'lab', 'radiology', 'pharmacy', 'billing', 'profile', 'auditSecurity', 'configuration', 'tenants'];
const ALLOWED_MODULES = new Set(DEFAULT_MODULES);
const FEATURE_FLAGS = ['fhir', 'hl7', 'pacs', 'biometric', 'insurance_tpa', 'erp', 'whatsapp_sms', 'abdm_abha', 'two_factor_auth', 'audit_compliance'];
const DEFAULT_FEATURE_FLAGS = FEATURE_FLAGS.reduce((acc, key) => { acc[key] = key === 'audit_compliance'; return acc; }, {});

const VALID_TENANT_TYPES = ['hospital', 'clinic', 'diagnostic_center', 'nursing_home'];
const VALID_PLANS = ['clinic', 'hospital', 'enterprise'];
const VALID_STATUSES = ['active', 'inactive', 'archived'];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 8);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

function fileToDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

async function uploadBufferToCloudinary(file, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, uploadResult) => error ? reject(error) : resolve(uploadResult));
    stream.end(file.buffer);
  });
}

async function safelyDestroyCloudinary(publicId, resourceType = 'auto') {
  if (!publicId || !hasCloudinaryConfig()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.warn('Cloudinary cleanup skipped:', error?.message || error);
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePassword(password) {
  return (!password || String(password).length < PASSWORD_MIN_LENGTH)
    ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    : null;
}

function sanitizeHospitalCode(code) {
  const clean = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return clean || undefined;
}

function validateTenantPayload(payload) {
  if (!payload.name || !String(payload.name).trim()) return 'Hospital name is required';
  if (payload.type && !VALID_TENANT_TYPES.includes(payload.type)) return 'Invalid hospital type';
  if (payload.plan && !VALID_PLANS.includes(payload.plan)) return 'Invalid hospital plan';
  if (payload.status && !VALID_STATUSES.includes(payload.status)) return 'Invalid hospital status';
  return null;
}

async function buildInitialAdminPayload(req, hospitalId) {
  const admin = req.body.initial_admin || {};
  const fullName = String(admin.full_name || req.body.admin_full_name || '').trim();
  const email = normalizeEmail(admin.email || req.body.admin_email);
  const password = admin.password || req.body.admin_password;
  const phone = admin.phone || req.body.admin_phone || '';

  if (!fullName && !email && !password && !phone) return null;
  if (!fullName || !email || !password) {
    const err = new Error('Admin full name, email and password are required when creating a hospital admin');
    err.status = 400;
    throw err;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    const err = new Error(passwordError);
    err.status = 400;
    throw err;
  }
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Admin email already exists');
    err.status = 409;
    throw err;
  }

  return {
    full_name: fullName,
    email,
    hospital_id: Number(hospitalId),
    password: await bcrypt.hash(String(password), BCRYPT_ROUNDS),
    role: 'hospital_admin',
    phone: phone || null,
    status: 'active',
    profile_image: '',
    bio: '',
    permissions: [],
    password_changed_at: new Date(),
  };
}

function publicUser(user) {
  if (!user) return null;
  const x = user?.toJSON ? user.toJSON() : { ...user };
  delete x.password;
  delete x.reset_token;
  delete x.reset_token_expires;
  return x;
}

function publicHospital(hospital) {
  const raw = hospital?.toObject ? hospital.toObject() : (hospital?.toJSON ? hospital.toJSON() : { ...(hospital || {}) });
  const x = { ...raw };
  if (raw?._id) x.mongo_id = String(raw._id);
  delete x._id;
  if (!x.id) x.id = DEFAULT_HOSPITAL_ID;
  if (!x.name) x.name = process.env.DEFAULT_HOSPITAL_NAME || 'Default Hospital';
  x.plan = x.plan || 'enterprise';
  x.plan_limits = mergePlanLimits(x.plan, x.plan_limits || {});
  x.subscription = { status: 'active', billing_cycle: 'monthly', renewal_date: null, notes: '', ...(x.subscription || {}) };
  if (!Array.isArray(x.enabled_modules) || !x.enabled_modules.length) x.enabled_modules = getAllowedModules(x.plan);
  x.enabled_modules = normalizePlanModules(x.plan, x.enabled_modules);
  x.feature_flags = normalizePlanFeatureFlags(x.plan, x.feature_flags);
  if (!x.branding) x.branding = {};
  x.branding = {
    logo_url: '',
    logo_public_id: '',
    primary_color: '#0f172a',
    secondary_color: '#2563eb',
    ...(x.branding || {}),
  };
  if (!x.settings) x.settings = {};
  x.settings = {
    address: '',
    city: '',
    state: '',
    country: 'India',
    phone: '',
    email: '',
    website: '',
    gst_number: '',
    registration_number: '',
    uhid_prefix: '',
    bill_prefix: '',
    prescription_prefix: '',
    lab_report_prefix: '',
    ...(x.settings || {}),
  };
  return x;
}

function isMongoObjectId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || ''));
}

async function findHospitalByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (isMongoObjectId(raw)) return Hospital.findById(raw);
  const numericId = Number(raw);
  if (Number.isFinite(numericId)) return Hospital.findOne({ id: numericId });
  return Hospital.findOne({ hospital_code: sanitizeHospitalCode(raw) });
}

async function findConflictingHospitalCode(code, currentMongoId = null) {
  if (!code) return null;
  const conflict = await Hospital.findOne({ hospital_code: code });
  if (!conflict) return null;
  if (currentMongoId && String(conflict._id) === String(currentMongoId)) return null;
  return conflict;
}

async function auditTenantAction(req, action) {
  await AuditLog.create({
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    user_id: req.user.id,
    action,
    module_name: 'tenants',
  });
}

async function ensureHospital(id = DEFAULT_HOSPITAL_ID) {
  let hospital = await Hospital.findOne({ id: Number(id) });
  if (!hospital && Number(id) === DEFAULT_HOSPITAL_ID) {
    hospital = await Hospital.create({
      id: DEFAULT_HOSPITAL_ID,
      hospital_code: 'DEFAULT',
      name: process.env.DEFAULT_HOSPITAL_NAME || 'Default Hospital',
      type: 'hospital',
      status: 'active',
      plan: 'enterprise',
      enabled_modules: DEFAULT_MODULES,
      feature_flags: DEFAULT_FEATURE_FLAGS,
    });
  }
  if (hospital && Number(id) === DEFAULT_HOSPITAL_ID && (!Array.isArray(hospital.enabled_modules) || !hospital.enabled_modules.length)) {
    hospital.enabled_modules = DEFAULT_MODULES;
    await hospital.save();
  }
  return hospital;
}

function sanitizeModules(modules, plan = 'enterprise') {
  return normalizePlanModules(plan, modules);
}

function sanitizeFeatureFlags(featureFlags, plan = 'enterprise') {
  return normalizePlanFeatureFlags(plan, featureFlags);
}

router.get('/tenant/modules', verifyToken, requirePermission('hospital.manage'), (_req, res) => {
  res.json(DEFAULT_MODULES);
});

router.get('/tenant/features', verifyToken, requirePermission('hospital.manage'), (_req, res) => {
  res.json({ features: FEATURE_FLAGS, defaults: DEFAULT_FEATURE_FLAGS });
});

router.get('/tenant/me', verifyToken, asyncHandler(async (req, res) => {
  const hospitalId = Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID);
  const hospital = await ensureHospital(hospitalId);
  res.json(publicHospital(hospital));
}));

router.get('/tenants', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const hospitals = await Hospital.find().sort({ id: -1 });
  res.json(hospitals.map(publicHospital));
}));

router.post('/tenants', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const payload = {
    hospital_code: sanitizeHospitalCode(req.body.hospital_code),
    name: String(req.body.name || '').trim(),
    type: req.body.type || 'hospital',
    status: req.body.status || 'active',
    plan: req.body.plan || 'enterprise',
    plan_limits: mergePlanLimits(req.body.plan || 'enterprise', req.body.plan_limits || {}),
    subscription: { status: req.body.subscription?.status || 'active', billing_cycle: req.body.subscription?.billing_cycle || 'monthly', renewal_date: req.body.subscription?.renewal_date || null, notes: req.body.subscription?.notes || '' },
    enabled_modules: sanitizeModules(req.body.enabled_modules, req.body.plan || 'enterprise'),
    feature_flags: sanitizeFeatureFlags(req.body.feature_flags, req.body.plan || 'enterprise'),
    branding: req.body.branding || {},
    settings: req.body.settings || {},
  };

  const payloadError = validateTenantPayload(payload);
  if (payloadError) return res.status(400).json({ message: payloadError });
  if (payload.hospital_code && await findConflictingHospitalCode(payload.hospital_code)) {
    return res.status(409).json({ message: `Hospital code ${payload.hospital_code} already exists. Use Edit Hospital from the row menu, or choose a different hospital code.` });
  }

  let hospital;
  try {
    hospital = await Hospital.create(payload);
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.hospital_code) {
      return res.status(409).json({ message: `Hospital code ${payload.hospital_code || err.keyValue?.hospital_code || ''} already exists. Use Edit Hospital from the row menu, or choose a different hospital code.` });
    }
    throw err;
  }
  let adminUser = null;

  try {
    const adminPayload = await buildInitialAdminPayload(req, hospital.id);
    if (adminPayload) {
      const limitCheck = await ensureWithinLimit(hospital.id, 'users', 1);
      if (!limitCheck.ok) {
        const err = new Error(limitCheck.message);
        err.status = 402;
        throw err;
      }
      adminUser = await User.create(adminPayload);
    }
  } catch (err) {
    await Hospital.deleteOne({ id: hospital.id });
    throw err;
  }

  await AuditLog.create({
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    user_id: req.user.id,
    action: adminUser
      ? `Created hospital ${hospital.name} with admin ${adminUser.email}`
      : `Created hospital ${hospital.name}`,
    module_name: 'tenants',
  });

  res.status(201).json({
    message: adminUser ? 'Hospital and admin user created successfully' : 'Hospital created successfully',
    hospital: publicHospital(hospital),
    admin_user: publicUser(adminUser),
  });
}));

router.patch('/tenants/:id', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const existingHospital = await findHospitalByIdentifier(req.params.id);
  if (!existingHospital) return res.status(404).json({ message: 'Hospital not found' });
  const nextPlan = req.body.plan || existingHospital.plan || 'enterprise';
  const allowed = ['name', 'type', 'status', 'plan', 'enabled_modules', 'feature_flags', 'branding', 'settings', 'plan_limits', 'subscription'];
  const update = {};
  for (const key of allowed) {
    if (!(key in req.body)) continue;
    if (key === 'enabled_modules') update[key] = sanitizeModules(req.body[key], nextPlan);
    else if (key === 'feature_flags') update[key] = sanitizeFeatureFlags(req.body[key], nextPlan);
    else if (key === 'plan_limits') update[key] = mergePlanLimits(nextPlan, req.body[key]);
    else if (key === 'subscription') update[key] = { ...(existingHospital.subscription || {}), ...(req.body[key] || {}), updated_at: new Date() };
    else update[key] = req.body[key];
  }
  if ('plan' in update && !('enabled_modules' in update)) update.enabled_modules = sanitizeModules(existingHospital.enabled_modules, nextPlan);
  if ('plan' in update && !('feature_flags' in update)) update.feature_flags = sanitizeFeatureFlags(existingHospital.feature_flags, nextPlan);
  if ('plan' in update && !('plan_limits' in update)) update.plan_limits = mergePlanLimits(nextPlan, existingHospital.plan_limits || {});

  if ('hospital_code' in req.body) {
    const code = sanitizeHospitalCode(req.body.hospital_code);
    if (code) {
      const existing = await findConflictingHospitalCode(code, existingHospital._id);
      if (existing) return res.status(409).json({ message: `Hospital code ${code} already exists. Choose a different code.` });
      update.hospital_code = code;
    }
  }

  const validationTarget = { ...update, name: update.name || 'ok' };
  const payloadError = validateTenantPayload(validationTarget);
  if (payloadError) return res.status(400).json({ message: payloadError });

  let hospital;
  try {
    hospital = await Hospital.findByIdAndUpdate(existingHospital._id, { $set: update }, { new: true });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.hospital_code) {
      return res.status(409).json({ message: `Hospital code ${update.hospital_code || err.keyValue?.hospital_code || ''} already exists. Choose a different code.` });
    }
    throw err;
  }
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  await auditTenantAction(req, `Updated hospital ${hospital.name}`);
  res.json(publicHospital(hospital));
}));

router.get('/tenants/:id/admins', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospital = await findHospitalByIdentifier(req.params.id);
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const hospitalId = Number(hospital.id);
  const admins = await User.find({ hospital_id: hospitalId, role: { $in: ['hospital_admin', 'admin'] } }).sort({ id: -1 });
  res.json(admins.map(publicUser));
}));

router.post('/tenants/:id/admins', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospital = await findHospitalByIdentifier(req.params.id);
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const hospitalId = Number(hospital.id);

  const adminPayload = await buildInitialAdminPayload(req, hospitalId);
  if (!adminPayload) return res.status(400).json({ message: 'Admin full name, email and password are required' });
  const limitCheck = await ensureWithinLimit(hospitalId, 'users', 1);
  if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });

  const adminUser = await User.create(adminPayload);
  await AuditLog.create({
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    user_id: req.user.id,
    action: `Created admin ${adminUser.email} for hospital ${hospital.name}`,
    module_name: 'tenants',
  });

  res.status(201).json({ message: 'Hospital admin created successfully', admin_user: publicUser(adminUser) });
}));

router.post('/tenants/:id/logo', verifyToken, requirePermission('hospital.manage'), upload.single('logo'), asyncHandler(async (req, res) => {
  const hospital = await findHospitalByIdentifier(req.params.id);
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const hospitalId = Number(hospital.id);
  if (!req.file) return res.status(400).json({ message: 'Logo file is required' });
  if (!ALLOWED_LOGO_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Only JPG, PNG, WEBP, and SVG logos are allowed' });
  }

  const currentBranding = hospital.branding || {};
  await safelyDestroyCloudinary(currentBranding.logo_public_id, 'image');

  let logoUrl;
  let logoPublicId = '';
  let logoStorage = 'database';
  if (hasCloudinaryConfig()) {
    const result = await uploadBufferToCloudinary(req.file, {
      folder: `hms/hospital-logos/${hospitalId}`,
      resource_type: 'image',
      public_id: `logo-${Date.now()}`,
    });
    logoUrl = result.secure_url;
    logoPublicId = result.public_id;
    logoStorage = 'cloudinary';
  } else {
    logoUrl = fileToDataUrl(req.file);
  }

  hospital.branding = {
    ...(hospital.branding || {}),
    logo_url: logoUrl,
    logo_public_id: logoPublicId,
    logo_storage: logoStorage,
  };
  await hospital.save();

  await AuditLog.create({
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    user_id: req.user.id,
    action: `Updated logo for hospital ${hospital.name}`,
    module_name: 'tenants',
  });

  res.json({ message: logoStorage === 'cloudinary' ? 'Hospital logo uploaded successfully' : 'Hospital logo saved successfully. Cloudinary is not configured, so the file was stored in MongoDB.', hospital: publicHospital(hospital) });
}));

router.delete('/tenants/:id', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospital = await findHospitalByIdentifier(req.params.id);
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const hospitalId = Number(hospital.id);
  if (hospitalId === DEFAULT_HOSPITAL_ID) {
    return res.status(400).json({ message: 'Default hospital cannot be archived' });
  }
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Only super admin can archive hospitals' });
  }

  hospital.status = 'archived';
  hospital.is_deleted = true;
  hospital.archived_at = new Date();
  hospital.archived_by = req.user.id;
  await hospital.save();

  await AuditLog.create({
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    user_id: req.user.id,
    action: `Archived hospital ${hospital.name}`,
    module_name: 'tenants',
  });

  res.json({ message: 'Hospital archived safely', hospital: publicHospital(hospital) });
}));

module.exports = router;
