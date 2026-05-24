const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { Hospital, User, Patient, Doctor, Appointment, Medicine, Billing } = require('../models');
const { PLAN_DEFINITIONS, getHospitalSubscription } = require('../utils/subscription');
const { csvEscape } = require('../utils/audit');

const router = express.Router();

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function pct(used = 0, limit = 0) {
  if (!limit || Number(limit) <= 0) return 0;
  return Math.min(999, Math.round((Number(used || 0) / Number(limit || 1)) * 100));
}

async function tenantUsage(hospital) {
  const hospitalId = Number(hospital.id);
  const [users, patients, doctors, appointmentsThisMonth, medicines, revenueRows] = await Promise.all([
    User.countDocuments({ hospital_id: hospitalId }),
    Patient.countDocuments({ hospital_id: hospitalId }),
    Doctor.countDocuments({ hospital_id: hospitalId }),
    Appointment.countDocuments({ hospital_id: hospitalId, created_at: { $gte: monthStart() } }),
    Medicine.countDocuments({ hospital_id: hospitalId }),
    Billing.find({ hospital_id: hospitalId }).select('total_amount paid_amount amount status').lean(),
  ]);

  const limits = hospital.plan_limits || PLAN_DEFINITIONS[hospital.plan || 'clinic']?.limits || {};
  const revenue = revenueRows.reduce((sum, row) => sum + Number(row.paid_amount ?? row.total_amount ?? row.amount ?? 0), 0);
  const usage = {
    users,
    patients,
    doctors,
    appointments_per_month: appointmentsThisMonth,
    medicines,
  };

  const limitHealth = Object.fromEntries(Object.entries(usage).map(([key, value]) => [key, {
    used: value,
    limit: Number(limits[key] || 0),
    percent: pct(value, limits[key]),
  }]));

  const warnings = [];
  for (const [key, item] of Object.entries(limitHealth)) {
    if (item.limit && item.percent >= 90) warnings.push(`${key} usage is ${item.percent}%`);
  }
  if ((hospital.subscription?.status || 'active') !== 'active') warnings.push(`subscription is ${hospital.subscription?.status || 'unknown'}`);
  if (hospital.status !== 'active') warnings.push(`tenant status is ${hospital.status}`);

  return { usage, limitHealth, revenue, warnings };
}

router.get('/saas/overview', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const hospitals = await Hospital.find().sort({ id: -1 }).lean();
  const tenantRows = await Promise.all(hospitals.map(async (hospital) => {
    const subscription = await getHospitalSubscription(Number(hospital.id));
    const metrics = await tenantUsage(hospital);
    return {
      id: hospital.id,
      hospital_code: hospital.hospital_code,
      name: hospital.name,
      type: hospital.type,
      status: hospital.status,
      plan: hospital.plan || 'clinic',
      subscription: hospital.subscription || {},
      enabled_modules_count: Array.isArray(hospital.enabled_modules) ? hospital.enabled_modules.length : 0,
      feature_flags_count: Object.values(hospital.feature_flags || {}).filter(Boolean).length,
      plan_summary: subscription.plan,
      ...metrics,
    };
  }));

  const planBreakdown = tenantRows.reduce((acc, row) => {
    acc[row.plan] = (acc[row.plan] || 0) + 1;
    return acc;
  }, {});

  const statusBreakdown = tenantRows.reduce((acc, row) => {
    const key = row.subscription?.status || row.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const monthlyRecurringRevenue = tenantRows.reduce((sum, row) => {
    const price = PLAN_DEFINITIONS[row.plan]?.monthly_price_inr || 0;
    return row.subscription?.status === 'active' ? sum + price : sum;
  }, 0);

  res.json({
    summary: {
      total_tenants: tenantRows.length,
      active_tenants: tenantRows.filter((row) => row.status === 'active').length,
      suspended_tenants: tenantRows.filter((row) => ['suspended', 'past_due'].includes(row.subscription?.status)).length,
      monthly_recurring_revenue: monthlyRecurringRevenue,
      total_revenue_recorded: tenantRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      plan_breakdown: planBreakdown,
      status_breakdown: statusBreakdown,
    },
    tenants: tenantRows,
    plans: Object.values(PLAN_DEFINITIONS),
  });
}));

router.get('/saas/tenants/export.csv', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const hospitals = await Hospital.find().sort({ id: -1 }).lean();
  const rows = await Promise.all(hospitals.map(async (hospital) => {
    const metrics = await tenantUsage(hospital);
    return [
      hospital.id,
      hospital.hospital_code || '',
      hospital.name || '',
      hospital.plan || '',
      hospital.status || '',
      hospital.subscription?.status || '',
      metrics.usage.users,
      metrics.usage.patients,
      metrics.usage.doctors,
      metrics.usage.appointments_per_month,
      metrics.usage.medicines,
      metrics.revenue,
      metrics.warnings.join('; '),
    ];
  }));
  const header = ['hospital_id', 'hospital_code', 'name', 'plan', 'tenant_status', 'subscription_status', 'users', 'patients', 'doctors', 'appointments_this_month', 'medicines', 'recorded_revenue', 'warnings'];
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=saas-tenants-export.csv');
  res.send(csv);
}));

module.exports = router;
