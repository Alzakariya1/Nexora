const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { Hospital, SaaSInvoice, SaaSPayment, SaaSPaymentIntent } = require('../models');
const { PLAN_DEFINITIONS, getPlanId } = require('../utils/subscription');
const { auditEvent, csvEscape } = require('../utils/audit');
const { DEFAULT_HOSPITAL_ID } = require('../middleware/tenant');

const router = express.Router();
const VALID_INVOICE_STATUS = ['draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled'];
const VALID_PAYMENT_MODES = ['manual', 'cash', 'bank_transfer', 'upi', 'card', 'cheque', 'payment_gateway'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function periodFor(cycle = 'monthly') {
  const start = new Date();
  const end = new Date(start);
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else if (cycle === 'quarterly') end.setMonth(end.getMonth() + 3);
  else end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return { period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10) };
}

function cycleMultiplier(cycle = 'monthly') {
  if (cycle === 'yearly') return 12;
  if (cycle === 'quarterly') return 3;
  return 1;
}


function makePaymentLink(invoice, intent) {
  const base = process.env.SAAS_PAYMENT_RETURN_URL || process.env.FRONTEND_URL || 'https://nexora-hms.local';
  return `${String(base).replace(/\/$/, '')}/pay/saas-invoice/${invoice.invoice_number}?intent=${intent.payment_link_id}`;
}

async function markOverdueInvoices(req = null) {
  const today = todayStr();
  const rows = await SaaSInvoice.find({ status: { $in: ['pending', 'partial'] }, due_date: { $lt: today }, balance_amount: { $gt: 0 } });
  for (const invoice of rows) {
    const oldValue = invoice.toJSON();
    invoice.status = 'overdue';
    await invoice.save();
    if (req?.user) {
      await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Marked SaaS invoice overdue ${invoice.invoice_number}`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, old_value: oldValue, new_value: invoice.toJSON() });
    }
  }
  return rows.length;
}

function invoiceStatus(total, paid, currentStatus = 'pending', dueDate = null) {
  if (currentStatus === 'cancelled' || currentStatus === 'draft') return currentStatus;
  const t = Number(total || 0);
  const p = Number(paid || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (dueDate && new Date(dueDate) < new Date(todayStr())) return 'overdue';
  return 'pending';
}

async function invoiceSummary() {
  const invoices = await SaaSInvoice.find().lean();
  return invoices.reduce((acc, inv) => {
    acc.total_invoices += 1;
    acc.total_billed += Number(inv.total_amount || 0);
    acc.total_collected += Number(inv.paid_amount || 0);
    acc.total_due += Number(inv.balance_amount || 0);
    acc.by_status[inv.status || 'pending'] = (acc.by_status[inv.status || 'pending'] || 0) + 1;
    return acc;
  }, { total_invoices: 0, total_billed: 0, total_collected: 0, total_due: 0, by_status: {} });
}

async function invoicePayload(invoice) {
  const payments = await SaaSPayment.find({ invoice_id: invoice.id }).sort({ id: -1 }).lean();
  return { ...invoice, payments };
}

router.get('/saas/billing/summary', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  res.json(await invoiceSummary());
}));

router.get('/saas/invoices', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.hospital_id) query.hospital_id = Number(req.query.hospital_id);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  const invoices = await SaaSInvoice.find(query).sort({ id: -1 }).lean();
  const withPayments = await Promise.all(invoices.map(invoicePayload));
  res.json(withPayments);
}));

router.post('/saas/invoices/generate', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.body.hospital_id);
  const hospital = await Hospital.findOne({ id: hospitalId }).lean();
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

  const plan = getPlanId(req.body.plan || hospital.plan || 'clinic');
  const planDef = PLAN_DEFINITIONS[plan];
  const cycle = req.body.billing_cycle || hospital.subscription?.billing_cycle || 'monthly';
  const period = {
    period_start: req.body.period_start || periodFor(cycle).period_start,
    period_end: req.body.period_end || periodFor(cycle).period_end,
  };
  const subtotal = Number(req.body.subtotal ?? (planDef.monthly_price_inr * cycleMultiplier(cycle)));
  const taxAmount = Number(req.body.tax_amount || 0);
  const discountAmount = Number(req.body.discount_amount || 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const paidAmount = Number(req.body.paid_amount || 0);
  const invoiceNumber = req.body.invoice_number || `SAAS-${hospitalId}-${Date.now()}`;
  const status = invoiceStatus(totalAmount, paidAmount, req.body.status || 'pending', req.body.due_date || addDays(period.period_start, 7));

  const invoice = await SaaSInvoice.create({
    hospital_id: hospitalId,
    hospital_name: hospital.name,
    plan,
    plan_name: planDef.name,
    invoice_number: invoiceNumber,
    billing_cycle: cycle,
    ...period,
    due_date: req.body.due_date || addDays(period.period_start, 7),
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance_amount: Math.max(0, totalAmount - paidAmount),
    status,
    notes: req.body.notes || '',
    created_by: req.user.id,
  });

  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Generated SaaS invoice ${invoice.invoice_number}`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, new_value: invoice.toJSON() });
  res.status(201).json({ message: 'SaaS invoice generated', invoice: await invoicePayload(invoice.toJSON()) });
}));

router.patch('/saas/invoices/:id/status', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const invoice = await SaaSInvoice.findOne({ id: Number(req.params.id) });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = invoice.toJSON();
  if (!VALID_INVOICE_STATUS.includes(req.body.status)) return res.status(400).json({ message: 'Invalid invoice status' });
  invoice.status = req.body.status;
  if (req.body.notes !== undefined) invoice.notes = req.body.notes;
  if (invoice.status !== 'cancelled' && invoice.status !== 'draft') invoice.status = invoiceStatus(invoice.total_amount, invoice.paid_amount, invoice.status, invoice.due_date);
  await invoice.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Updated SaaS invoice status ${invoice.invoice_number}`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, old_value: oldValue, new_value: invoice.toJSON() });
  res.json({ message: 'Invoice status updated', invoice: await invoicePayload(invoice.toJSON()) });
}));

router.post('/saas/invoices/:id/payments', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const invoice = await SaaSInvoice.findOne({ id: Number(req.params.id) });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.status === 'cancelled') return res.status(400).json({ message: 'Cannot record payment on a cancelled invoice' });
  const amount = Number(req.body.amount || 0);
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount is required' });
  const mode = VALID_PAYMENT_MODES.includes(req.body.payment_mode) ? req.body.payment_mode : 'manual';

  const payment = await SaaSPayment.create({
    hospital_id: invoice.hospital_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_number: req.body.payment_number || `PAY-${invoice.hospital_id}-${Date.now()}`,
    amount,
    payment_date: req.body.payment_date || todayStr(),
    payment_mode: mode,
    transaction_id: req.body.transaction_id || '',
    received_by: req.user.id,
    notes: req.body.notes || '',
  });

  invoice.paid_amount = Number(invoice.paid_amount || 0) + amount;
  invoice.balance_amount = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
  invoice.status = invoiceStatus(invoice.total_amount, invoice.paid_amount, 'pending', invoice.due_date);
  await invoice.save();

  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Recorded SaaS payment ${payment.payment_number}`, module_name: 'saas_billing', entity_type: 'saas_payment', entity_id: payment.id, new_value: { payment: payment.toJSON(), invoice: invoice.toJSON() } });
  res.status(201).json({ message: 'Payment recorded', invoice: await invoicePayload(invoice.toJSON()), payment });
}));


router.post('/saas/invoices/mark-overdue', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const updated = await markOverdueInvoices(req);
  res.json({ message: 'Overdue invoice scan completed', updated });
}));

router.post('/saas/invoices/:id/payment-link', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const invoice = await SaaSInvoice.findOne({ id: Number(req.params.id) });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.status === 'cancelled' || invoice.status === 'paid') return res.status(400).json({ message: 'Payment link is only available for unpaid active invoices' });
  const amount = Number(req.body.amount || invoice.balance_amount || invoice.total_amount || 0);
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required for payment link' });
  const gateway = req.body.gateway || process.env.SAAS_PAYMENT_GATEWAY || 'manual_gateway_ready';
  const paymentLinkId = req.body.payment_link_id || `plink_${invoice.hospital_id}_${Date.now()}`;
  const intent = await SaaSPaymentIntent.create({
    hospital_id: invoice.hospital_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    gateway,
    payment_link_id: paymentLinkId,
    amount,
    currency: req.body.currency || 'INR',
    status: 'pending',
    expires_at: req.body.expires_at || addDays(todayStr(), 3),
    customer_email: req.body.customer_email || '',
    customer_phone: req.body.customer_phone || '',
    notes: req.body.notes || '',
    created_by: req.user.id,
  });
  intent.payment_link_url = req.body.payment_link_url || makePaymentLink(invoice, intent);
  await intent.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Created SaaS payment link ${intent.payment_link_id}`, module_name: 'saas_billing', entity_type: 'saas_payment_intent', entity_id: intent.id, new_value: intent.toJSON() });
  res.status(201).json({ message: 'Payment link created', intent });
}));

router.get('/saas/payment-intents', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.invoice_id) query.invoice_id = Number(req.query.invoice_id);
  if (req.query.hospital_id) query.hospital_id = Number(req.query.hospital_id);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  res.json(await SaaSPaymentIntent.find(query).sort({ id: -1 }).limit(100).lean());
}));

router.post('/saas/payment-intents/:id/confirm', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const intent = await SaaSPaymentIntent.findOne({ id: Number(req.params.id) });
  if (!intent) return res.status(404).json({ message: 'Payment intent not found' });
  if (intent.status === 'paid') return res.status(400).json({ message: 'Payment intent already paid' });
  const invoice = await SaaSInvoice.findOne({ id: intent.invoice_id });
  if (!invoice) return res.status(404).json({ message: 'Linked invoice not found' });
  const payment = await SaaSPayment.create({
    hospital_id: invoice.hospital_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_number: req.body.payment_number || `PAY-${invoice.hospital_id}-${Date.now()}`,
    amount: Number(req.body.amount || intent.amount || 0),
    payment_date: req.body.payment_date || todayStr(),
    payment_mode: 'payment_gateway',
    transaction_id: req.body.transaction_id || intent.transaction_id || intent.payment_link_id,
    received_by: req.user.id,
    notes: req.body.notes || `Payment confirmed from ${intent.gateway}` ,
  });
  invoice.paid_amount = Number(invoice.paid_amount || 0) + Number(payment.amount || 0);
  invoice.balance_amount = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
  invoice.status = invoiceStatus(invoice.total_amount, invoice.paid_amount, 'pending', invoice.due_date);
  await invoice.save();
  intent.status = 'paid';
  intent.paid_at = todayStr();
  intent.transaction_id = payment.transaction_id;
  await intent.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Confirmed SaaS gateway payment ${intent.payment_link_id}`, module_name: 'saas_billing', entity_type: 'saas_payment_intent', entity_id: intent.id, new_value: { intent: intent.toJSON(), payment: payment.toJSON(), invoice: invoice.toJSON() } });
  res.json({ message: 'Gateway payment confirmed', invoice: await invoicePayload(invoice.toJSON()), payment, intent });
}));

router.get('/saas/invoices/export.csv', verifyToken, requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const rows = await SaaSInvoice.find().sort({ id: -1 }).lean();
  const header = ['invoice_id', 'invoice_number', 'hospital_id', 'hospital_name', 'plan', 'billing_cycle', 'period_start', 'period_end', 'due_date', 'total_amount', 'paid_amount', 'balance_amount', 'status'];
  const csv = [header, ...rows.map((r) => [r.id, r.invoice_number, r.hospital_id, r.hospital_name, r.plan, r.billing_cycle, r.period_start, r.period_end, r.due_date, r.total_amount, r.paid_amount, r.balance_amount, r.status])].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=saas-subscription-invoices.csv');
  res.send(csv);
}));

module.exports = router;
