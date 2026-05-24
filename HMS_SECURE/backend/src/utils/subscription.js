const { Hospital, User, Patient, Doctor, Appointment, Medicine } = require('../models');
const { DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');

const PLAN_DEFINITIONS = {
  clinic: {
    id: 'clinic',
    name: 'Clinic Plan',
    description: 'For single clinics and small practices.',
    monthly_price_inr: 2999,
    limits: {
      users: 8,
      patients: 1500,
      doctors: 5,
      appointments_per_month: 1200,
      medicines: 250,
      branches: 1,
      storage_gb: 5,
    },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'billing', 'profile', 'configuration'],
    features: {
      audit_compliance: true,
      whatsapp_sms: false,
      insurance_tpa: false,
      fhir: false,
      hl7: false,
      pacs: false,
      erp: false,
      biometric: false,
      abdm_abha: false,
      two_factor_auth: false,
    },
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital Plan',
    description: 'For small and mid-size hospitals with operational modules.',
    monthly_price_inr: 9999,
    limits: {
      users: 50,
      patients: 25000,
      doctors: 50,
      appointments_per_month: 15000,
      medicines: 5000,
      branches: 3,
      storage_gb: 100,
    },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'beds', 'lab', 'radiology', 'pharmacy', 'billing', 'profile', 'auditSecurity', 'configuration'],
    features: {
      audit_compliance: true,
      whatsapp_sms: true,
      insurance_tpa: true,
      fhir: false,
      hl7: false,
      pacs: false,
      erp: false,
      biometric: false,
      abdm_abha: true,
      two_factor_auth: false,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    description: 'For multi-branch and enterprise hospitals requiring advanced integrations.',
    monthly_price_inr: 24999,
    limits: {
      users: 500,
      patients: 500000,
      doctors: 500,
      appointments_per_month: 200000,
      medicines: 50000,
      branches: 50,
      storage_gb: 1000,
    },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'beds', 'lab', 'radiology', 'pharmacy', 'billing', 'profile', 'auditSecurity', 'configuration', 'tenants'],
    features: {
      audit_compliance: true,
      whatsapp_sms: true,
      insurance_tpa: true,
      fhir: true,
      hl7: true,
      pacs: true,
      erp: true,
      biometric: true,
      abdm_abha: true,
      two_factor_auth: true,
    },
  },
};

function getPlanId(input) {
  return PLAN_DEFINITIONS[input] ? input : 'clinic';
}

function getPlan(planId) {
  return PLAN_DEFINITIONS[getPlanId(planId)];
}

function getAllowedModules(planId) {
  return getPlan(planId).modules;
}

function getAllowedFeatures(planId) {
  return getPlan(planId).features;
}

function normalizePlanModules(planId, modules = []) {
  const allowed = new Set(getAllowedModules(planId));
  const selected = Array.isArray(modules) && modules.length ? modules : getAllowedModules(planId);
  const clean = Array.from(new Set(selected.filter((moduleId) => allowed.has(moduleId))));
  return clean.length ? clean : getAllowedModules(planId);
}

function normalizePlanFeatureFlags(planId, flags = {}) {
  const allowed = getAllowedFeatures(planId);
  const result = {};
  for (const key of Object.keys(allowed)) {
    result[key] = Boolean(allowed[key] && flags && flags[key]);
  }
  // Always keep audit compliance on when the plan allows it.
  if (allowed.audit_compliance) result.audit_compliance = true;
  return result;
}

function mergePlanLimits(planId, customLimits = {}) {
  const base = getPlan(planId).limits;
  const merged = { ...base };
  for (const [key, value] of Object.entries(customLimits || {})) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) merged[key] = parsed;
  }
  return merged;
}

async function getHospitalSubscription(hospitalId = DEFAULT_HOSPITAL_ID) {
  const hospital = await Hospital.findOne({ id: Number(hospitalId || DEFAULT_HOSPITAL_ID) }).lean();
  const planId = getPlanId(hospital?.plan || 'clinic');
  const plan = getPlan(planId);
  const limits = mergePlanLimits(planId, hospital?.plan_limits || {});
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const [users, patients, doctors, appointmentsThisMonth, medicines] = await Promise.all([
    User.countDocuments({ hospital_id: Number(hospitalId) }),
    Patient.countDocuments({ hospital_id: Number(hospitalId) }),
    Doctor.countDocuments({ hospital_id: Number(hospitalId) }),
    Appointment.countDocuments({ hospital_id: Number(hospitalId), created_at: { $gte: since } }),
    Medicine.countDocuments({ hospital_id: Number(hospitalId) }),
  ]);
  const usage = {
    users,
    patients,
    doctors,
    appointments_per_month: appointmentsThisMonth,
    medicines,
    branches: 1,
    storage_gb: 0,
  };
  const checks = Object.keys(limits).reduce((acc, key) => {
    acc[key] = { used: Number(usage[key] || 0), limit: Number(limits[key] || 0), exceeded: Number(limits[key] || 0) > 0 && Number(usage[key] || 0) >= Number(limits[key] || 0) };
    return acc;
  }, {});
  return {
    hospital_id: Number(hospitalId),
    hospital_name: hospital?.name || 'Default Hospital',
    plan: planId,
    plan_name: plan.name,
    description: plan.description,
    monthly_price_inr: plan.monthly_price_inr,
    status: hospital?.subscription?.status || 'active',
    renewal_date: hospital?.subscription?.renewal_date || null,
    limits,
    usage,
    checks,
    allowed_modules: getAllowedModules(planId),
    allowed_features: getAllowedFeatures(planId),
  };
}

async function ensureWithinLimit(hospitalId, limitKey, increment = 1) {
  const subscription = await getHospitalSubscription(hospitalId);
  const limit = Number(subscription.limits?.[limitKey] || 0);
  if (!limit) return { ok: true, subscription };
  const used = Number(subscription.usage?.[limitKey] || 0);
  if (used + Number(increment || 0) > limit) {
    return {
      ok: false,
      subscription,
      message: `${subscription.plan_name} limit reached for ${limitKey.replaceAll('_', ' ')}. Upgrade the plan or increase custom limits.`,
    };
  }
  return { ok: true, subscription };
}

module.exports = {
  PLAN_DEFINITIONS,
  getPlan,
  getPlanId,
  getAllowedModules,
  getAllowedFeatures,
  normalizePlanModules,
  normalizePlanFeatureFlags,
  mergePlanLimits,
  getHospitalSubscription,
  ensureWithinLimit,
};
