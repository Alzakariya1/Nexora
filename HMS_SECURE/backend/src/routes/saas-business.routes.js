const express = require('express');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { Hospital, User, SaaSPlan } = require('../models');
const { DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');
const { buildTenantDbName, ensureTenantDatabase } = require('../config/tenantDb');
const {
  PLAN_DEFINITIONS,
  getPlanId,
  mergePlanLimits,
  normalizePlanModules,
  normalizePlanFeatureFlags,
  getHospitalSubscription,
} = require('../utils/subscription');

const router = express.Router();
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const VALID_CYCLES = ['monthly', 'quarterly', 'yearly'];
const VALID_SUBSCRIPTION_STATUS = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];
const VALID_TENANT_TYPES = ['hospital', 'clinic', 'diagnostic_center', 'nursing_home'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function publicUser(user) {
  if (!user) return null;
  const x = user.toJSON ? user.toJSON() : { ...user };
  delete x.password;
  delete x.reset_token;
  delete x.reset_token_expires;
  return x;
}

function normalizePlanBody(body = {}, existing = {}) {
  const planId = String(body.id || body.plan_id || existing.plan_id || existing.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (!planId) {
    const err = new Error('Plan id is required');
    err.status = 400;
    throw err;
  }
  const monthlyPrice = Number(body.monthly_price_inr ?? existing.monthly_price_inr ?? 0);
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    const err = new Error('Valid monthly price is required');
    err.status = 400;
    throw err;
  }
  return {
    plan_id: planId,
    id: planId,
    name: String(body.name || existing.name || planId).trim(),
    description: String(body.description ?? existing.description ?? ''),
    monthly_price_inr: monthlyPrice,
    billing_cycles: Array.isArray(body.billing_cycles) && body.billing_cycles.length
      ? body.billing_cycles.filter((x) => VALID_CYCLES.includes(x))
      : (existing.billing_cycles || ['monthly', 'yearly']),
    trial_days: Number(body.trial_days ?? existing.trial_days ?? 14),
    support_level: body.support_level || existing.support_level || 'standard',
    limits: { ...(existing.limits || {}), ...(body.limits || {}) },
    modules: Array.isArray(body.modules) ? body.modules : (existing.modules || []),
    features: { ...(existing.features || {}), ...(body.features || {}) },
    is_active: body.is_active === undefined ? (existing.is_active !== false) : Boolean(body.is_active),
  };
}

async function planRows() {
  const defaults = Object.values(PLAN_DEFINITIONS).map((p) => ({ ...p, plan_id: p.id, source: 'system', is_active: true, billing_cycles: ['monthly', 'quarterly', 'yearly'], trial_days: p.id === 'enterprise' ? 0 : 14, support_level: p.id === 'enterprise' ? 'priority' : 'standard' }));
  const custom = await SaaSPlan.find().sort({ id: -1 }).lean();
  const customMap = new Map(custom.map((p) => [p.plan_id || p.id, { ...p, id: p.plan_id || p.id, source: 'custom' }]));
  return defaults.map((p) => customMap.get(p.id) || p).concat(custom.filter((p) => !PLAN_DEFINITIONS[p.plan_id || p.id]).map((p) => ({ ...p, id: p.plan_id || p.id, source: 'custom' })));
}

router.get('/saas/business/plans', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  res.json(await planRows());
}));

router.post('/saas/business/plans', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const payload = normalizePlanBody(req.body);
  const existing = await SaaSPlan.findOne({ plan_id: payload.plan_id });
  if (existing) return res.status(409).json({ message: 'Plan id already exists. Use update instead.' });
  const plan = await SaaSPlan.create(payload);
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Created SaaS plan ${payload.plan_id}`, module_name: 'saas_plans', entity_type: 'saas_plan', entity_id: plan.id, new_value: plan.toJSON() });
  res.status(201).json({ message: 'SaaS plan created', plan });
}));

router.patch('/saas/business/plans/:planId', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const planId = String(req.params.planId || '').trim().toLowerCase();
  const existing = await SaaSPlan.findOne({ plan_id: planId }) || (PLAN_DEFINITIONS[planId] ? null : undefined);
  if (existing === undefined) return res.status(404).json({ message: 'Plan not found' });
  const payload = normalizePlanBody(req.body, existing || { ...PLAN_DEFINITIONS[planId], plan_id: planId });
  const plan = await SaaSPlan.findOneAndUpdate({ plan_id: planId }, { $set: payload }, { upsert: true, new: true });
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Updated SaaS plan ${planId}`, module_name: 'saas_plans', entity_type: 'saas_plan', entity_id: plan.id, new_value: plan.toJSON() });
  res.json({ message: 'SaaS plan updated', plan });
}));

router.get('/saas/license/status', verifyToken, asyncHandler(async (req, res) => {
  const hospitalId = Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID);
  const hospital = await Hospital.findOne({ id: hospitalId }).lean();
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const sub = await getHospitalSubscription(hospitalId);
  const status = hospital.subscription?.status || sub.status || 'active';
  const trialEnd = hospital.subscription?.trial_end_date;
  const licenseExpiry = hospital.subscription?.license_expiry || hospital.subscription?.renewal_date || hospital.subscription?.next_billing_date;
  const today = new Date().toISOString().slice(0, 10);
  const blocked = ['suspended', 'cancelled'].includes(status) || (status === 'trial' && trialEnd && trialEnd < today) || (licenseExpiry && licenseExpiry < today && status !== 'active');
  const warnings = [];
  if (status === 'trial' && trialEnd) warnings.push(`Trial ends on ${trialEnd}`);
  if (licenseExpiry) warnings.push(`License date: ${licenseExpiry}`);
  Object.entries(sub.checks || {}).forEach(([key, item]) => {
    if (item.limit && item.used >= item.limit * 0.9) warnings.push(`${key} usage is close to limit`);
  });
  res.json({ hospital_id: hospitalId, hospital_name: hospital.name, status, blocked, trial_end_date: trialEnd || null, license_expiry: licenseExpiry || null, subscription: sub, warnings });
}));

router.post('/saas/onboarding/hospitals', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Hospital name is required' });
  const code = sanitizeCode(req.body.hospital_code || `HOSP${Date.now()}`);
  if (await Hospital.findOne({ hospital_code: code })) return res.status(409).json({ message: `Hospital code ${code} already exists` });
  const plan = getPlanId(req.body.plan || 'clinic');
  const trialDays = Number(req.body.trial_days ?? 14);
  const status = req.body.trial === false ? 'active' : 'trial';
  const type = VALID_TENANT_TYPES.includes(req.body.type) ? req.body.type : 'hospital';
  const subscription = {
    status: VALID_SUBSCRIPTION_STATUS.includes(req.body.subscription_status) ? req.body.subscription_status : status,
    billing_cycle: VALID_CYCLES.includes(req.body.billing_cycle) ? req.body.billing_cycle : 'monthly',
    trial_start_date: status === 'trial' ? new Date().toISOString().slice(0, 10) : null,
    trial_end_date: status === 'trial' ? addDays(trialDays) : null,
    renewal_date: status === 'active' ? addDays(30) : null,
    next_billing_date: status === 'active' ? addDays(30) : null,
    license_expiry: status === 'trial' ? addDays(trialDays) : addDays(30),
    notes: req.body.notes || 'Created from SaaS onboarding flow',
  };
  const createIsolatedDb = req.body.create_tenant_db !== false;
  const tenantDbName = createIsolatedDb ? buildTenantDbName({ hospital_code: code, name }) : null;
  if (tenantDbName) await ensureTenantDatabase(tenantDbName);

  const hospital = await Hospital.create({
    hospital_code: code,
    tenant_db_name: tenantDbName,
    tenant_db_status: tenantDbName ? 'active' : 'shared',
    tenant_db_created_at: tenantDbName ? new Date() : null,
    name,
    type,
    status: 'active',
    plan,
    plan_limits: mergePlanLimits(plan, req.body.plan_limits || {}),
    subscription,
    enabled_modules: normalizePlanModules(plan, req.body.enabled_modules || []),
    feature_flags: normalizePlanFeatureFlags(plan, req.body.feature_flags || {}),
    settings: req.body.settings || {},
    branding: req.body.branding || {},
  });

  let adminUser = null;
  const adminEmail = normalizeEmail(req.body.admin_email || req.body.initial_admin?.email);
  const adminPassword = req.body.admin_password || req.body.initial_admin?.password;
  const adminName = String(req.body.admin_full_name || req.body.initial_admin?.full_name || '').trim();
  if (adminEmail || adminPassword || adminName) {
    if (!adminEmail || !adminPassword || !adminName) {
      await Hospital.deleteOne({ id: hospital.id });
      return res.status(400).json({ message: 'Admin name, email and password are required for onboarding admin' });
    }
    if (await User.findOne({ email: adminEmail })) {
      await Hospital.deleteOne({ id: hospital.id });
      return res.status(409).json({ message: 'Admin email already exists' });
    }
    adminUser = await User.create({
      full_name: adminName,
      email: adminEmail,
      password: await bcrypt.hash(String(adminPassword), BCRYPT_ROUNDS),
      hospital_id: hospital.id,
      tenant_db_name: tenantDbName || null,
      role: 'hospital_admin',
      status: 'active',
      phone: req.body.admin_phone || req.body.initial_admin?.phone || '',
      password_changed_at: new Date(),
    });
  }

  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Onboarded hospital ${name}`, module_name: 'saas_onboarding', entity_type: 'hospital', entity_id: hospital.id, new_value: { hospital: hospital.toJSON(), admin_user: publicUser(adminUser) } });
  res.status(201).json({ message: 'Hospital onboarded successfully', hospital, admin_user: publicUser(adminUser), tenant_db_name: tenantDbName, storage_mode: tenantDbName ? 'database-per-tenant' : 'shared-database', license: await getHospitalSubscription(hospital.id) });
}));

router.get('/saas/onboarding/checklist', verifyToken, requirePermission('hospital.manage'), (_req, res) => {
  res.json({
    checklist: [
      'Create hospital tenant with unique hospital code',
      'Attach Starter/Professional/Enterprise plan',
      'Create first hospital admin user',
      'Verify trial/license expiry date',
      'Confirm enabled modules match selected plan',
      'Run tenant isolation smoke test before pilot',
      'Generate first subscription invoice after trial/activation',
    ],
  });
});

module.exports = router;
