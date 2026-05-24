const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { DemoRequest, SalesActivity, SaaSPlan } = require('../models');

const router = express.Router();

const DEFAULT_PLANS = [
  { id: 'clinic', name: 'Starter Clinic', price: '₹2,999/mo', audience: 'Single clinics and small OPD practices', modules: ['Patients', 'Doctors', 'Appointments', 'Billing', 'Patient Portal'] },
  { id: 'hospital', name: 'Professional Hospital', price: '₹9,999/mo', audience: 'Hospitals needing OPD/IPD, lab, pharmacy and inventory', modules: ['OPD/IPD', 'Lab/Radiology', 'Pharmacy', 'Inventory', 'Analytics'] },
  { id: 'enterprise', name: 'Enterprise Hospital', price: '₹24,999/mo', audience: 'Multi-branch hospitals and chains', modules: ['Compliance', 'FHIR APIs', 'Command Center', 'Multi-tenant Admin', 'Priority Support'] },
];

function safeEmail(value) { return String(value || '').trim().toLowerCase(); }
function safePhone(value) { return String(value || '').trim(); }

router.get('/public/marketing', asyncHandler(async (_req, res) => {
  const custom = await SaaSPlan.find({ is_active: { $ne: false } }).sort({ monthly_price_inr: 1 }).lean();
  res.json({
    product: {
      name: process.env.PRODUCT_NAME || 'Nexora HMS',
      headline: 'Cloud hospital management software for clinics, hospitals and diagnostic centers',
      subheadline: 'Manage patients, appointments, EMR, billing, pharmacy, inventory, lab, radiology, compliance, analytics and integrations from one SaaS platform.',
      primary_cta: 'Book a Demo',
      secondary_cta: 'View Pricing',
    },
    plans: custom.length ? custom.map((p) => ({ id: p.plan_id || p.id, name: p.name, price: `₹${Number(p.monthly_price_inr || 0).toLocaleString('en-IN')}/mo`, audience: p.description || p.support_level, modules: p.modules || [] })) : DEFAULT_PLANS,
    highlights: [
      'Multi-tenant hospital SaaS architecture',
      'Patient, doctor, appointment and EMR workflows',
      'Pharmacy, inventory, purchase order and supplier billing',
      'Advanced LIS/RIS with barcode, DICOM and PACS-ready fields',
      'NABH/compliance center with audit logs and SOP tracking',
      'FHIR-like API foundation for enterprise integration readiness',
    ],
  });
}));

router.post('/public/demo-requests', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = safeEmail(req.body.email);
  const phone = safePhone(req.body.phone);
  const organization = String(req.body.organization || '').trim();
  if (!name || !email || !organization) return res.status(400).json({ message: 'Name, email and organization are required' });
  const row = await DemoRequest.create({
    name,
    email,
    phone,
    organization,
    organization_type: req.body.organization_type || 'hospital',
    city: req.body.city || '',
    staff_size: req.body.staff_size || '',
    interest: Array.isArray(req.body.interest) ? req.body.interest : String(req.body.interest || '').split(',').map((x) => x.trim()).filter(Boolean),
    preferred_demo_date: req.body.preferred_demo_date || null,
    message: req.body.message || '',
    source: req.body.source || 'website',
    status: 'new',
  });
  res.status(201).json({ message: 'Demo request received', id: row.id });
}));

router.get('/sales/demo-requests', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  res.json(await DemoRequest.find().sort({ id: -1 }).limit(200).lean());
}));

router.patch('/sales/demo-requests/:id', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const allowed = ['status', 'assigned_to', 'notes', 'preferred_demo_date', 'follow_up_at'];
  const update = {};
  for (const key of allowed) if (key in req.body) update[key] = req.body[key];
  await DemoRequest.updateOne({ id: Number(req.params.id) }, { $set: update });
  res.json({ message: 'Demo request updated' });
}));

router.post('/sales/activities', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const activity = await SalesActivity.create({
    demo_request_id: Number(req.body.demo_request_id || 0) || null,
    activity_type: req.body.activity_type || 'note',
    subject: req.body.subject || '',
    notes: req.body.notes || '',
    outcome: req.body.outcome || '',
    next_follow_up_at: req.body.next_follow_up_at || null,
    created_by: req.user.id,
  });
  res.status(201).json({ message: 'Sales activity saved', id: activity.id });
}));

router.get('/sales/assets', verifyToken, requirePermission('hospital.manage'), (_req, res) => {
  res.json({
    demo_flow: [
      'Create a new patient and upload patient documents',
      'Book appointment and show queue status',
      'Doctor adds EMR notes and prescription',
      'Create lab/radiology order and approve report',
      'Dispense medicine with batch/expiry awareness',
      'Generate bill and record payment',
      'Open Command Center and compliance/audit view',
      'Show SaaS Control Center: plan, tenant and license status',
    ],
    objection_answers: [
      { question: 'Can each hospital data stay separate?', answer: 'Yes. The platform is designed around hospital/tenant isolation and SaaS-level controls.' },
      { question: 'Can we start with only OPD?', answer: 'Yes. Plans and modules can be enabled gradually as the hospital grows.' },
      { question: 'Is it integration-ready?', answer: 'FHIR-like endpoints, webhook foundation, DICOM/PACS fields and API key controls are already prepared.' },
    ],
    checklist: [
      'Confirm prospect type and size',
      'Confirm current pain points',
      'Demo patient-to-billing workflow',
      'Show plan and pricing fit',
      'Schedule pilot onboarding call',
    ],
  });
});

module.exports = router;
