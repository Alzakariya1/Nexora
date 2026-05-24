const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { Hospital } = require('../models');
const { DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');
const {
  PLAN_DEFINITIONS,
  getPlanId,
  getHospitalSubscription,
  mergePlanLimits,
  normalizePlanModules,
  normalizePlanFeatureFlags,
} = require('../utils/subscription');

const router = express.Router();
const VALID_SUBSCRIPTION_STATUS = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];
const VALID_BILLING_CYCLE = ['monthly', 'quarterly', 'yearly'];

function subscriptionPayload(body = {}, current = {}) {
  return {
    ...(current || {}),
    status: VALID_SUBSCRIPTION_STATUS.includes(body.status) ? body.status : (current?.status || 'active'),
    billing_cycle: VALID_BILLING_CYCLE.includes(body.billing_cycle) ? body.billing_cycle : (current?.billing_cycle || 'monthly'),
    renewal_date: body.renewal_date ?? current?.renewal_date ?? null,
    next_billing_date: body.next_billing_date ?? current?.next_billing_date ?? null,
    trial_start_date: body.trial_start_date ?? current?.trial_start_date ?? null,
    trial_end_date: body.trial_end_date ?? current?.trial_end_date ?? null,
    cancelled_at: body.cancelled_at ?? current?.cancelled_at ?? null,
    suspended_at: body.suspended_at ?? current?.suspended_at ?? null,
    notes: body.notes ?? current?.notes ?? '',
    updated_at: new Date(),
  };
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

router.get('/subscription/plans', verifyToken, (req, res) => {
  res.json(Object.values(PLAN_DEFINITIONS));
});

router.get('/subscription/current', verifyToken, asyncHandler(async (req, res) => {
  const hospitalId = Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID);
  res.json(await getHospitalSubscription(hospitalId));
}));

router.get('/tenants/:id/subscription', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  res.json(await getHospitalSubscription(Number(req.params.id)));
}));

router.patch('/tenants/:id/subscription', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.params.id);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

  const plan = getPlanId(req.body.plan || hospital.plan || 'clinic');
  const subscription = subscriptionPayload(req.body, hospital.subscription || {});

  const planLimits = mergePlanLimits(plan, req.body.plan_limits || hospital.plan_limits || {});
  hospital.plan = plan;
  hospital.plan_limits = planLimits;
  hospital.subscription = subscription;
  hospital.enabled_modules = normalizePlanModules(plan, hospital.enabled_modules);
  hospital.feature_flags = normalizePlanFeatureFlags(plan, hospital.feature_flags);
  await hospital.save();

  await auditEvent({
    req,
    userId: req.user.id,
    hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID),
    action: `Updated subscription for hospital ${hospital.name}`,
    module_name: 'subscription',
    entity_type: 'hospital',
    entity_id: hospital.id,
    new_value: { plan, plan_limits: planLimits, subscription },
  });

  res.json({ message: 'Subscription updated successfully', subscription: await getHospitalSubscription(hospitalId) });
}));


router.patch('/tenants/:id/lifecycle', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.params.id);
  const hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

  const action = String(req.body.action || '').toLowerCase();
  const current = hospital.subscription || {};
  let update = {};
  if (action === 'activate') update = { status: 'active', suspended_at: null, cancelled_at: null };
  else if (action === 'suspend') update = { status: 'suspended', suspended_at: new Date(), notes: req.body.notes ?? current.notes ?? '' };
  else if (action === 'trial') update = { status: 'trial', trial_start_date: req.body.trial_start_date || new Date().toISOString().slice(0, 10), trial_end_date: req.body.trial_end_date || addDays(14), suspended_at: null, cancelled_at: null };
  else if (action === 'cancel') update = { status: 'cancelled', cancelled_at: new Date(), notes: req.body.notes ?? current.notes ?? '' };
  else return res.status(400).json({ message: 'Invalid lifecycle action' });

  hospital.subscription = subscriptionPayload(update, current);
  if (['activate', 'trial'].includes(action)) hospital.status = 'active';
  if (['suspend', 'cancel'].includes(action)) hospital.status = action === 'suspend' ? 'suspended' : 'inactive';
  await hospital.save();

  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Tenant ${action}: ${hospital.name}`, module_name: 'subscription', entity_type: 'hospital', entity_id: hospital.id, new_value: { action, subscription: hospital.subscription, status: hospital.status } });
  res.json({ message: `Tenant ${action} action completed`, subscription: await getHospitalSubscription(hospitalId) });
}));

module.exports = router;
