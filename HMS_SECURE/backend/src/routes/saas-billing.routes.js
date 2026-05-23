const express = require('express');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission, allowRoles } = require('../middleware/auth');
const { Hospital, SaaSPlan, SaaSInvoice, SaaSPayment, SaaSSettlement, SaaSPaymentIntent, SaaSPaymentWebhook, CommunicationLog } = require('../models');
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

function invoiceDueDays(subscription = {}) {
  const days = Number(subscription.invoice_due_days ?? process.env.SAAS_INVOICE_DUE_DAYS ?? 7);
  return Number.isFinite(days) && days >= 0 ? days : 7;
}

function nextBillingDateFrom(periodEnd, cycle = 'monthly') {
  const d = periodEnd ? new Date(periodEnd) : new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isBillableTenant(hospital) {
  const status = String(hospital.status || 'active');
  const subStatus = String(hospital.subscription?.status || 'active');
  return ['active', 'trial'].includes(status) && ['active', 'trial', 'past_due'].includes(subStatus);
}

async function hasOpenInvoiceForPeriod(hospitalId, periodStart, periodEnd) {
  return SaaSInvoice.findOne({
    hospital_id: Number(hospitalId),
    period_start: periodStart,
    period_end: periodEnd,
    status: { $ne: 'cancelled' },
  }).lean();
}

async function createSaaSInvoiceForHospital({ req, hospital, runId, override = {} }) {
  const plan = getPlanId(override.plan || hospital.plan || 'clinic');
  const planDef = PLAN_DEFINITIONS[plan];
  const cycle = override.billing_cycle || hospital.subscription?.billing_cycle || 'monthly';
  const period = {
    period_start: override.period_start || todayStr(),
    period_end: override.period_end || periodFor(cycle).period_end,
  };
  const existing = await hasOpenInvoiceForPeriod(hospital.id, period.period_start, period.period_end);
  if (existing) return { skipped: true, reason: 'invoice_already_exists_for_period', invoice: existing };

  const subtotal = Number(override.subtotal ?? (planDef.monthly_price_inr * cycleMultiplier(cycle)));
  const taxAmount = Number(override.tax_amount || 0);
  const discountAmount = Number(override.discount_amount || 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const paidAmount = Number(override.paid_amount || 0);
  const dueDate = override.due_date || addDays(period.period_start, invoiceDueDays(hospital.subscription));
  const invoiceNumber = override.invoice_number || `SAAS-${hospital.id}-${Date.now()}`;
  const invoice = await SaaSInvoice.create({
    hospital_id: Number(hospital.id),
    hospital_name: hospital.name,
    plan,
    plan_name: planDef.name,
    invoice_number: invoiceNumber,
    billing_cycle: cycle,
    ...period,
    due_date: dueDate,
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance_amount: Math.max(0, totalAmount - paidAmount),
    status: invoiceStatus(totalAmount, paidAmount, override.status || 'pending', dueDate),
    notes: override.notes || 'Auto-generated SaaS subscription invoice',
    auto_generated: true,
    generated_run_id: runId || `run-${Date.now()}`,
    next_reminder_at: dueDate,
    created_by: req?.user?.id,
  });

  const nextBillingDate = nextBillingDateFrom(period.period_end, cycle);
  await Hospital.updateOne({ id: Number(hospital.id) }, { $set: { 'subscription.next_billing_date': nextBillingDate, 'subscription.last_invoice_id': invoice.id, 'subscription.last_invoice_number': invoice.invoice_number, 'subscription.updated_at': new Date() } });
  if (req?.user) {
    await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Auto-generated SaaS invoice ${invoice.invoice_number}`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, new_value: invoice.toJSON() });
  }
  return { skipped: false, invoice };
}

function dunningStageFor(invoice, daysOverdue) {
  if (daysOverdue >= Number(process.env.SAAS_SUSPEND_AFTER_DAYS || 30)) return 'suspended';
  if (daysOverdue >= Number(process.env.SAAS_SUSPENSION_WARNING_DAYS || 14)) return 'suspension_warning';
  if (daysOverdue >= Number(process.env.SAAS_PAST_DUE_DAYS || 7)) return 'past_due';
  return 'reminder';
}

function daysBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
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



function gatewaySecret(gateway) {
  const key = `SAAS_${String(gateway || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}_WEBHOOK_SECRET`;
  return process.env[key] || process.env.SAAS_PAYMENT_WEBHOOK_SECRET || '';
}

function stablePayloadString(payload = {}) {
  return JSON.stringify(payload || {});
}

function verifyWebhookSignature({ gateway, payload, signature }) {
  const secret = gatewaySecret(gateway);
  if (!secret) return { ok: false, reason: 'webhook_secret_not_configured' };
  if (!signature) return { ok: false, reason: 'missing_signature' };
  const body = stablePayloadString(payload);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const normalized = String(signature).replace(/^sha256=/i, '').trim();
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(normalized, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}

function normalizeGatewayPayload(gateway, body = {}) {
  const data = body.data || body.payload || body;
  const eventId = body.event_id || body.id || data.event_id || data.id || data.transaction_id || data.payment_id;
  const paymentLinkId = data.payment_link_id || data.paymentLinkId || data.order_id || data.intent_id || body.payment_link_id;
  const invoiceNumber = data.invoice_number || data.invoiceNumber || body.invoice_number || data.notes?.invoice_number;
  const transactionId = data.transaction_id || data.transactionId || data.payment_id || data.paymentId || body.transaction_id;
  const rawStatus = String(data.status || body.status || body.event || body.type || '').toLowerCase();
  const eventType = body.event_type || body.type || body.event || rawStatus || 'payment_event';
  const paid = ['paid', 'captured', 'success', 'succeeded', 'payment.captured', 'payment_success'].includes(rawStatus) || String(eventType).toLowerCase().includes('paid') || String(eventType).toLowerCase().includes('captured');
  const failed = ['failed', 'cancelled', 'canceled', 'expired'].includes(rawStatus) || String(eventType).toLowerCase().includes('fail');
  return {
    gateway: String(gateway || body.gateway || data.gateway || 'manual_gateway_ready'),
    event_id: String(eventId || `${gateway || 'gateway'}-${Date.now()}`),
    event_type: String(eventType),
    payment_link_id: paymentLinkId ? String(paymentLinkId) : '',
    invoice_number: invoiceNumber ? String(invoiceNumber) : '',
    transaction_id: transactionId ? String(transactionId) : '',
    amount: Number(data.amount_paid ?? data.amount ?? body.amount ?? 0),
    currency: String(data.currency || body.currency || 'INR').toUpperCase(),
    outcome: paid ? 'paid' : (failed ? 'failed' : 'ignored'),
  };
}

async function recalculateInvoiceFromPayments(invoice) {
  const rows = await SaaSPayment.find({ invoice_id: Number(invoice.id) }).lean();
  const paid = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  invoice.paid_amount = paid;
  invoice.balance_amount = Math.max(0, Number(invoice.total_amount || 0) - paid);
  invoice.status = invoiceStatus(invoice.total_amount, invoice.paid_amount, invoice.status, invoice.due_date);
  if (invoice.status === 'paid') {
    invoice.dunning_stage = 'none';
    invoice.next_reminder_at = '';
  }
  await invoice.save();
  return { invoice, payments: rows };
}

async function applyGatewayPayment({ req = null, normalized, webhookDoc = null, actorId = null }) {
  let intent = null;
  if (normalized.payment_link_id) intent = await SaaSPaymentIntent.findOne({ payment_link_id: normalized.payment_link_id });
  let invoice = intent ? await SaaSInvoice.findOne({ id: Number(intent.invoice_id) }) : null;
  if (!invoice && normalized.invoice_number) invoice = await SaaSInvoice.findOne({ invoice_number: normalized.invoice_number });
  if (!invoice) return { processed: false, status: 'failed', message: 'Linked invoice not found' };
  if (invoice.status === 'cancelled') return { processed: false, status: 'ignored', message: 'Invoice is cancelled' };

  if (intent && intent.status === 'paid') {
    return { processed: false, status: 'duplicate', message: 'Payment intent already marked paid', invoice, intent };
  }
  const existingPayment = normalized.transaction_id ? await SaaSPayment.findOne({ hospital_id: invoice.hospital_id, transaction_id: normalized.transaction_id }) : null;
  if (existingPayment) {
    return { processed: false, status: 'duplicate', message: 'Transaction already recorded', invoice, intent, payment: existingPayment };
  }

  if (normalized.outcome !== 'paid') {
    if (intent && ['failed', 'expired', 'cancelled'].includes(normalized.outcome)) {
      intent.status = normalized.outcome;
      await intent.save();
    }
    return { processed: false, status: 'ignored', message: `Webhook outcome ${normalized.outcome} does not create payment`, invoice, intent };
  }

  const amount = Number(normalized.amount || intent?.amount || invoice.balance_amount || 0);
  if (!amount || amount <= 0) return { processed: false, status: 'failed', message: 'Payment amount missing or invalid', invoice, intent };

  const payment = await SaaSPayment.create({
    hospital_id: invoice.hospital_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_number: `GW-${invoice.hospital_id}-${Date.now()}`,
    amount,
    payment_date: todayStr(),
    payment_mode: 'payment_gateway',
    gateway: normalized.gateway,
    transaction_id: normalized.transaction_id || normalized.event_id,
    gateway_fee: calculateGatewayFee(amount, normalized.gateway),
    net_amount: Math.max(0, amount - calculateGatewayFee(amount, normalized.gateway)),
    received_by: actorId || null,
    notes: `Gateway webhook ${normalized.gateway} / ${normalized.event_type}`,
  });
  await recalculateInvoiceFromPayments(invoice);
  if (intent) {
    intent.status = 'paid';
    intent.paid_at = todayStr();
    intent.transaction_id = payment.transaction_id;
    await intent.save();
  }
  if (webhookDoc) {
    webhookDoc.hospital_id = invoice.hospital_id;
    webhookDoc.invoice_id = invoice.id;
    webhookDoc.invoice_number = invoice.invoice_number;
  }
  if (req?.user) {
    await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Reconciled SaaS gateway webhook ${normalized.event_id}`, module_name: 'saas_billing', entity_type: 'saas_payment_webhook', entity_id: webhookDoc?.id, new_value: { webhook: webhookDoc?.toJSON?.(), payment: payment.toJSON(), invoice: invoice.toJSON() } });
  }
  return { processed: true, status: 'processed', message: 'Gateway payment reconciled', invoice, intent, payment };
}

async function invoicePayload(invoice) {
  const payments = await SaaSPayment.find({ invoice_id: invoice.id }).sort({ id: -1 }).lean();
  return { ...invoice, payments };
}


const PROVIDER_DEFINITIONS = {
  manual_gateway_ready: { id: 'manual_gateway_ready', name: 'Manual / Gateway-ready', mode: 'manual', fee_percent: 0, fixed_fee: 0, configured: true },
  razorpay: { id: 'razorpay', name: 'Razorpay', mode: 'live_adapter_ready', fee_percent: Number(process.env.SAAS_RAZORPAY_FEE_PERCENT || 2), fixed_fee: Number(process.env.SAAS_RAZORPAY_FIXED_FEE || 0), configured: Boolean(process.env.SAAS_RAZORPAY_KEY_ID) },
  stripe: { id: 'stripe', name: 'Stripe', mode: 'live_adapter_ready', fee_percent: Number(process.env.SAAS_STRIPE_FEE_PERCENT || 2.9), fixed_fee: Number(process.env.SAAS_STRIPE_FIXED_FEE || 0), configured: Boolean(process.env.SAAS_STRIPE_SECRET_KEY) },
  payu: { id: 'payu', name: 'PayU', mode: 'live_adapter_ready', fee_percent: Number(process.env.SAAS_PAYU_FEE_PERCENT || 2), fixed_fee: Number(process.env.SAAS_PAYU_FIXED_FEE || 0), configured: Boolean(process.env.SAAS_PAYU_MERCHANT_KEY) },
};

function providerConfig(gateway = 'manual_gateway_ready') {
  const id = String(gateway || 'manual_gateway_ready').toLowerCase();
  return PROVIDER_DEFINITIONS[id] || { id, name: id, mode: 'custom_adapter_ready', fee_percent: Number(process.env.SAAS_DEFAULT_GATEWAY_FEE_PERCENT || 0), fixed_fee: 0, configured: Boolean(gatewaySecret(id)) };
}

function calculateGatewayFee(amount, gateway) {
  const provider = providerConfig(gateway);
  const value = Number(amount || 0);
  const fee = (value * Number(provider.fee_percent || 0) / 100) + Number(provider.fixed_fee || 0);
  return Math.round(fee * 100) / 100;
}

function buildProviderPaymentLink(invoice, intent) {
  const provider = providerConfig(intent.gateway);
  if (provider.id === 'razorpay' && process.env.SAAS_RAZORPAY_PAYMENT_PAGE_URL) return `${process.env.SAAS_RAZORPAY_PAYMENT_PAGE_URL.replace(/\/$/, '')}?invoice=${encodeURIComponent(invoice.invoice_number)}&intent=${encodeURIComponent(intent.payment_link_id)}&amount=${encodeURIComponent(intent.amount)}`;
  if (provider.id === 'stripe' && process.env.SAAS_STRIPE_PAYMENT_PAGE_URL) return `${process.env.SAAS_STRIPE_PAYMENT_PAGE_URL.replace(/\/$/, '')}?client_reference_id=${encodeURIComponent(intent.payment_link_id)}`;
  if (provider.id === 'payu' && process.env.SAAS_PAYU_PAYMENT_PAGE_URL) return `${process.env.SAAS_PAYU_PAYMENT_PAGE_URL.replace(/\/$/, '')}?invoice=${encodeURIComponent(invoice.invoice_number)}&txnid=${encodeURIComponent(intent.payment_link_id)}`;
  return makePaymentLink(invoice, intent);
}

async function settlementSummary({ gateway = 'all', from, to } = {}) {
  const query = { payment_mode: 'payment_gateway' };
  if (gateway && gateway !== 'all') query.gateway = gateway;
  if (from || to) {
    query.payment_date = {};
    if (from) query.payment_date.$gte = from;
    if (to) query.payment_date.$lte = to;
  }
  const payments = await SaaSPayment.find(query).lean();
  const grouped = payments.reduce((acc, payment) => {
    const key = payment.gateway || 'manual_gateway_ready';
    if (!acc[key]) acc[key] = { gateway: key, payment_count: 0, gross_amount: 0, gateway_fee: 0, net_amount: 0, unsettled_count: 0, settled_count: 0, disputed_count: 0 };
    const row = acc[key];
    row.payment_count += 1;
    row.gross_amount += Number(payment.amount || 0);
    row.gateway_fee += Number(payment.gateway_fee || 0);
    row.net_amount += Number(payment.net_amount || (Number(payment.amount || 0) - Number(payment.gateway_fee || 0)));
    const status = payment.settlement_status || 'unsettled';
    row[`${status}_count`] = Number(row[`${status}_count`] || 0) + 1;
    return acc;
  }, {});
  const by_gateway = Object.values(grouped).map((row) => ({ ...row, gross_amount: Math.round(row.gross_amount * 100) / 100, gateway_fee: Math.round(row.gateway_fee * 100) / 100, net_amount: Math.round(row.net_amount * 100) / 100 }));
  return by_gateway.reduce((acc, row) => {
    acc.payment_count += row.payment_count;
    acc.gross_amount += row.gross_amount;
    acc.gateway_fee += row.gateway_fee;
    acc.net_amount += row.net_amount;
    acc.unsettled_count += row.unsettled_count || 0;
    acc.settled_count += row.settled_count || 0;
    acc.disputed_count += row.disputed_count || 0;
    return acc;
  }, { payment_count: 0, gross_amount: 0, gateway_fee: 0, net_amount: 0, unsettled_count: 0, settled_count: 0, disputed_count: 0, by_gateway });
}



router.post('/saas/payment-webhooks/:gateway', asyncHandler(async (req, res) => {
  const gateway = req.params.gateway || req.body.gateway || 'manual_gateway_ready';
  const signature = req.headers['x-saas-signature'] || req.headers['x-razorpay-signature'] || req.headers['x-gateway-signature'];
  const normalized = normalizeGatewayPayload(gateway, req.body || {});
  const verification = verifyWebhookSignature({ gateway: normalized.gateway, payload: req.body || {}, signature });
  const idempotencyKey = `${normalized.gateway}:${normalized.event_id}`;

  let webhook = null;
  try {
    webhook = await SaaSPaymentWebhook.create({
      hospital_id: DEFAULT_HOSPITAL_ID,
      gateway: normalized.gateway,
      event_id: normalized.event_id,
      event_type: normalized.event_type,
      payment_link_id: normalized.payment_link_id,
      transaction_id: normalized.transaction_id,
      invoice_number: normalized.invoice_number,
      amount: normalized.amount,
      currency: normalized.currency,
      status: verification.ok ? 'verified' : 'failed',
      signature_verified: verification.ok,
      idempotency_key: idempotencyKey,
      payload: req.body || {},
      error: verification.ok ? '' : verification.reason,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await SaaSPaymentWebhook.findOne({ idempotency_key: idempotencyKey }).lean();
      return res.status(200).json({ message: 'Duplicate webhook ignored', duplicate: true, status: existing?.status || 'duplicate' });
    }
    throw error;
  }

  if (!verification.ok) {
    return res.status(401).json({ message: 'Webhook signature verification failed', reason: verification.reason });
  }

  const result = await applyGatewayPayment({ normalized, webhookDoc: webhook });
  webhook.status = result.status;
  webhook.error = result.processed ? '' : result.message;
  webhook.processed_at = new Date();
  if (result.invoice) {
    webhook.hospital_id = result.invoice.hospital_id;
    webhook.invoice_id = result.invoice.id;
    webhook.invoice_number = result.invoice.invoice_number;
  }
  await webhook.save();

  res.json({ message: result.message, processed: result.processed, status: webhook.status, invoice_id: result.invoice?.id || null, invoice_number: result.invoice?.invoice_number || null });
}));

router.get('/saas/payment-webhooks', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.gateway && req.query.gateway !== 'all') query.gateway = req.query.gateway;
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  if (req.query.invoice_id) query.invoice_id = Number(req.query.invoice_id);
  if (req.query.hospital_id) query.hospital_id = Number(req.query.hospital_id);
  res.json(await SaaSPaymentWebhook.find(query).sort({ id: -1 }).limit(100).lean());
}));

router.post('/saas/invoices/:id/reconcile', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const invoice = await SaaSInvoice.findOne({ id: Number(req.params.id) });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = invoice.toJSON();
  const result = await recalculateInvoiceFromPayments(invoice);
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Reconciled SaaS invoice ${invoice.invoice_number}`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, old_value: oldValue, new_value: invoice.toJSON() });
  res.json({ message: 'Invoice reconciled from recorded payments', invoice: await invoicePayload(result.invoice.toJSON()), payment_count: result.payments.length });
}));


function monthsAhead(periods = 6) {
  const rows = [];
  const base = new Date();
  for (let i = 0; i < Number(periods || 6); i += 1) {
    const d = new Date(base);
    d.setMonth(base.getMonth() + i);
    rows.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }) });
  }
  return rows;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return daysBetween(todayStr(), dateStr);
}

function planMonthlyPrice(planId, customPlans = []) {
  const clean = String(planId || 'clinic');
  const custom = customPlans.find((p) => String(p.plan_id || p.id) === clean);
  if (custom) return Number(custom.monthly_price_inr || 0);
  return Number(PLAN_DEFINITIONS[getPlanId(clean)]?.monthly_price_inr || 0);
}

function tenantChurnSignal({ tenant, outstanding = 0, overdueCount = 0, maxUsage = 0 }) {
  const status = String(tenant.status || 'active');
  const subStatus = String(tenant.subscription?.status || 'active');
  const expiryDays = daysUntil(tenant.subscription?.renewal_date || tenant.subscription?.trial_end_date || tenant.license_expiry);
  const reasons = [];
  let score = 0;
  if (['suspended', 'inactive', 'archived'].includes(status)) { score += 35; reasons.push(`tenant ${status}`); }
  if (['past_due', 'suspended', 'cancelled'].includes(subStatus)) { score += 30; reasons.push(`subscription ${subStatus}`); }
  if (overdueCount > 0) { score += Math.min(25, overdueCount * 10); reasons.push(`${overdueCount} overdue invoice${overdueCount > 1 ? 's' : ''}`); }
  if (outstanding > 0) { score += Math.min(20, Math.ceil(outstanding / 10000)); reasons.push('open dues'); }
  if (Number.isFinite(expiryDays) && expiryDays !== null && expiryDays <= 15) { score += 15; reasons.push(`renewal due in ${expiryDays} day${expiryDays === 1 ? '' : 's'}`); }
  if (maxUsage >= 90) { score += 10; reasons.push('near plan limit'); }
  const risk_score = Math.min(score, 100);
  const risk_level = risk_score >= 70 ? 'high' : risk_score >= 35 ? 'medium' : risk_score > 0 ? 'low' : 'stable';
  return { risk_score, risk_level, reasons };
}

async function subscriptionAnalyticsPayload() {
  const [tenants, invoices, payments, plans] = await Promise.all([
    Hospital.find().sort({ id: 1 }).lean(),
    SaaSInvoice.find().lean(),
    SaaSPayment.find().lean(),
    SaaSPlan.find({ is_active: true }).lean().catch(() => []),
  ]);
  const activeTenants = tenants.filter((t) => ['active', 'trial'].includes(String(t.status || 'active')) && !['cancelled', 'suspended'].includes(String(t.subscription?.status || 'active')));
  const mrr = activeTenants.reduce((sum, tenant) => {
    const price = planMonthlyPrice(tenant.plan, plans);
    const cycle = String(tenant.subscription?.billing_cycle || 'monthly');
    const normalized = cycle === 'yearly' ? price : cycle === 'quarterly' ? price : price;
    return sum + normalized;
  }, 0);
  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const totalCollected = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balance_amount || 0), 0);
  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue' || (inv.balance_amount > 0 && inv.due_date && inv.due_date < todayStr()));
  const overdueByTenant = overdueInvoices.reduce((acc, inv) => {
    acc[inv.hospital_id] = (acc[inv.hospital_id] || 0) + 1;
    return acc;
  }, {});
  const outstandingByTenant = invoices.reduce((acc, inv) => {
    acc[inv.hospital_id] = (acc[inv.hospital_id] || 0) + Number(inv.balance_amount || 0);
    return acc;
  }, {});
  const usageMaxByTenant = Object.fromEntries(tenants.map((tenant) => {
    const checks = tenant.limitHealth || tenant.subscription?.checks || {};
    const max = Math.max(...Object.values(checks).map((item) => Number(item?.percent || 0)), 0);
    return [tenant.id, max];
  }));
  const churn_risk = tenants.map((tenant) => {
    const signal = tenantChurnSignal({ tenant, outstanding: outstandingByTenant[tenant.id] || 0, overdueCount: overdueByTenant[tenant.id] || 0, maxUsage: usageMaxByTenant[tenant.id] || 0 });
    return {
      hospital_id: tenant.id,
      hospital_name: tenant.name,
      plan: tenant.plan || 'clinic',
      subscription_status: tenant.subscription?.status || 'active',
      outstanding_amount: outstandingByTenant[tenant.id] || 0,
      overdue_invoices: overdueByTenant[tenant.id] || 0,
      max_usage_percent: usageMaxByTenant[tenant.id] || 0,
      ...signal,
    };
  }).sort((a, b) => b.risk_score - a.risk_score);
  const forecastMonths = monthsAhead(6);
  const forecast = forecastMonths.map((row, index) => {
    const conservativeRetention = Math.max(0.88, 1 - (index * 0.015));
    return {
      month: row.key,
      label: row.label,
      projected_mrr: Math.round(mrr * conservativeRetention),
      projected_arr: Math.round(mrr * conservativeRetention * 12),
      active_tenants: activeTenants.length,
    };
  });
  const atRiskMrr = churn_risk.filter((row) => ['high', 'medium'].includes(row.risk_level)).reduce((sum, row) => sum + planMonthlyPrice(row.plan, plans), 0);
  return {
    generated_at: new Date().toISOString(),
    metrics: {
      active_tenants: activeTenants.length,
      total_tenants: tenants.length,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      at_risk_mrr: Math.round(atRiskMrr),
      total_billed: Math.round(totalBilled),
      total_collected: Math.round(totalCollected),
      total_outstanding: Math.round(totalOutstanding),
      collection_rate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
      overdue_invoice_count: overdueInvoices.length,
      high_risk_tenants: churn_risk.filter((row) => row.risk_level === 'high').length,
    },
    forecast,
    churn_risk,
    notes: [
      'Forecast is rule-based and uses current active plan pricing; it is safe for operational planning, not accounting recognition.',
      'Churn risk uses subscription status, overdue invoices, outstanding dues, renewal proximity and plan-limit pressure.',
    ],
  };
}


router.get('/saas/analytics/subscriptions', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  res.json(await subscriptionAnalyticsPayload());
}));

router.get('/saas/billing/summary', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const base = await invoiceSummary();
  base.settlements = await settlementSummary();
  res.json(base);
}));

router.get('/saas/invoices', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.hospital_id) query.hospital_id = Number(req.query.hospital_id);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  const invoices = await SaaSInvoice.find(query).sort({ id: -1 }).lean();
  const withPayments = await Promise.all(invoices.map(invoicePayload));
  res.json(withPayments);
}));

router.post('/saas/invoices/generate', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const hospitalId = Number(req.body.hospital_id);
  const hospital = await Hospital.findOne({ id: hospitalId }).lean();
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  const result = await createSaaSInvoiceForHospital({ req, hospital, runId: req.body.run_id || `manual-${Date.now()}`, override: req.body || {} });
  if (result.skipped) return res.status(409).json({ message: 'Invoice already exists for this billing period', reason: result.reason, invoice: await invoicePayload(result.invoice) });
  res.status(201).json({ message: 'SaaS invoice generated', invoice: await invoicePayload(result.invoice.toJSON()) });
}));

router.post('/saas/invoices/generate-due', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const today = req.body.billing_date || todayStr();
  const runId = req.body.run_id || `billing-${today}-${Date.now()}`;
  const query = { status: { $in: ['active', 'trial'] } };
  if (req.body.hospital_id) query.id = Number(req.body.hospital_id);
  const hospitals = await Hospital.find(query).lean();
  const results = [];
  for (const hospital of hospitals) {
    if (!isBillableTenant(hospital)) {
      results.push({ hospital_id: hospital.id, skipped: true, reason: 'tenant_not_billable' });
      continue;
    }
    const nextBilling = hospital.subscription?.next_billing_date || today;
    if (!req.body.force && nextBilling > today) {
      results.push({ hospital_id: hospital.id, skipped: true, reason: 'next_billing_date_not_due', next_billing_date: nextBilling });
      continue;
    }
    const result = await createSaaSInvoiceForHospital({ req, hospital, runId, override: { billing_cycle: hospital.subscription?.billing_cycle, period_start: today, notes: 'Auto-generated due subscription invoice' } });
    results.push({ hospital_id: hospital.id, skipped: result.skipped, reason: result.reason || null, invoice_number: result.invoice?.invoice_number, invoice_id: result.invoice?.id });
  }
  res.json({ message: 'Due invoice generation completed', run_id: runId, results });
}));

router.post('/saas/invoices/dunning-scan', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const today = req.body.scan_date || todayStr();
  const reminderInterval = Number(req.body.reminder_interval_days || process.env.SAAS_DUNNING_INTERVAL_DAYS || 3);
  const invoices = await SaaSInvoice.find({ status: { $in: ['pending', 'partial', 'overdue'] }, due_date: { $lt: today }, balance_amount: { $gt: 0 } });
  const results = [];
  for (const invoice of invoices) {
    const oldValue = invoice.toJSON();
    const daysOverdue = Math.max(0, daysBetween(invoice.due_date, today));
    const stage = dunningStageFor(invoice, daysOverdue);
    invoice.status = 'overdue';
    invoice.dunning_stage = stage;
    invoice.reminder_count = Number(invoice.reminder_count || 0) + 1;
    invoice.last_reminder_at = today;
    invoice.next_reminder_at = addDays(today, reminderInterval);
    invoice.dunning_notes = req.body.notes || `Dunning scan: ${daysOverdue} day(s) overdue`;
    await invoice.save();

    const hospital = await Hospital.findOne({ id: invoice.hospital_id });
    if (hospital) {
      const subscription = { ...(hospital.subscription || {}) };
      if (stage === 'past_due' && subscription.status !== 'suspended') subscription.status = 'past_due';
      if (stage === 'suspended') { subscription.status = 'suspended'; hospital.status = 'suspended'; subscription.suspended_at = new Date(); subscription.suspension_reason = 'Auto-suspended by SaaS dunning policy'; }
      subscription.dunning_stage = stage;
      subscription.last_dunning_at = today;
      subscription.updated_at = new Date();
      hospital.subscription = subscription;
      await hospital.save();
    }

    await CommunicationLog.create({
      hospital_id: Number(invoice.hospital_id),
      channel: req.body.channel || 'in_app',
      recipient_type: 'tenant_admin',
      recipient_id: String(invoice.hospital_id),
      recipient_name: invoice.hospital_name,
      title: `Subscription payment reminder: ${invoice.invoice_number}`,
      message: `Invoice ${invoice.invoice_number} is ${daysOverdue} day(s) overdue. Outstanding amount: ${invoice.balance_amount}.`,
      module: 'saas_billing',
      entity_type: 'saas_invoice',
      entity_id: String(invoice.id),
      status: 'queued',
    });

    await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Dunning updated SaaS invoice ${invoice.invoice_number} (${stage})`, module_name: 'saas_billing', entity_type: 'saas_invoice', entity_id: invoice.id, old_value: oldValue, new_value: invoice.toJSON() });
    results.push({ invoice_id: invoice.id, invoice_number: invoice.invoice_number, hospital_id: invoice.hospital_id, stage, days_overdue: daysOverdue, reminder_count: invoice.reminder_count });
  }
  res.json({ message: 'Dunning scan completed', updated: results.length, results });
}));

router.patch('/saas/invoices/:id/status', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
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

router.post('/saas/invoices/:id/payments', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
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


router.post('/saas/invoices/mark-overdue', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const updated = await markOverdueInvoices(req);
  res.json({ message: 'Overdue invoice scan completed', updated });
}));

router.post('/saas/invoices/:id/payment-link', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const invoice = await SaaSInvoice.findOne({ id: Number(req.params.id) });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.status === 'cancelled' || invoice.status === 'paid') return res.status(400).json({ message: 'Payment link is only available for unpaid active invoices' });
  const amount = Number(req.body.amount || invoice.balance_amount || invoice.total_amount || 0);
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required for payment link' });
  const gateway = providerConfig(req.body.gateway || process.env.SAAS_PAYMENT_GATEWAY || 'manual_gateway_ready').id;
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
  intent.payment_link_url = req.body.payment_link_url || buildProviderPaymentLink(invoice, intent);
  await intent.save();
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Created SaaS payment link ${intent.payment_link_id}`, module_name: 'saas_billing', entity_type: 'saas_payment_intent', entity_id: intent.id, new_value: intent.toJSON() });
  res.status(201).json({ message: 'Payment link created', intent });
}));

router.get('/saas/payment-intents', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.invoice_id) query.invoice_id = Number(req.query.invoice_id);
  if (req.query.hospital_id) query.hospital_id = Number(req.query.hospital_id);
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  res.json(await SaaSPaymentIntent.find(query).sort({ id: -1 }).limit(100).lean());
}));

router.post('/saas/payment-intents/:id/confirm', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
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
    gateway: intent.gateway || 'manual_gateway_ready',
    transaction_id: req.body.transaction_id || intent.transaction_id || intent.payment_link_id,
    gateway_fee: calculateGatewayFee(Number(req.body.amount || intent.amount || 0), intent.gateway),
    net_amount: Math.max(0, Number(req.body.amount || intent.amount || 0) - calculateGatewayFee(Number(req.body.amount || intent.amount || 0), intent.gateway)),
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



router.get('/saas/payment-gateways/providers', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  res.json(Object.values(PROVIDER_DEFINITIONS).map((provider) => ({ ...provider, webhook_configured: Boolean(gatewaySecret(provider.id)) })));
}));

router.get('/saas/settlements/summary', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  res.json(await settlementSummary({ gateway: req.query.gateway || 'all', from: req.query.from, to: req.query.to }));
}));

router.get('/saas/settlements', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.gateway && req.query.gateway !== 'all') query.gateway = req.query.gateway;
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  res.json(await SaaSSettlement.find(query).sort({ id: -1 }).limit(100).lean());
}));

router.post('/saas/settlements/reconcile', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const gateway = providerConfig(req.body.gateway || 'manual_gateway_ready').id;
  const from = req.body.from_date || todayStr();
  const to = req.body.to_date || todayStr();
  const settlementReference = req.body.settlement_reference || `SET-${gateway}-${Date.now()}`;
  const payments = await SaaSPayment.find({
    payment_mode: 'payment_gateway',
    gateway,
    settlement_status: req.body.include_settled ? { $in: ['unsettled', 'settled'] } : 'unsettled',
    payment_date: { $gte: from, $lte: to },
  });
  if (!payments.length) return res.status(404).json({ message: 'No unsettled gateway payments found for the selected period' });

  const gross = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const fee = payments.reduce((sum, payment) => sum + Number(payment.gateway_fee || 0), 0);
  const net = payments.reduce((sum, payment) => sum + Number(payment.net_amount || (Number(payment.amount || 0) - Number(payment.gateway_fee || 0))), 0);
  const settlement = await SaaSSettlement.create({
    settlement_number: `SETTLE-${Date.now()}`,
    gateway,
    settlement_reference: settlementReference,
    settlement_date: req.body.settlement_date || todayStr(),
    from_date: from,
    to_date: to,
    gross_amount: Math.round(gross * 100) / 100,
    gateway_fee: Math.round(fee * 100) / 100,
    net_amount: Math.round(net * 100) / 100,
    payment_count: payments.length,
    status: req.body.status || 'settled',
    notes: req.body.notes || '',
    created_by: req.user.id,
  });
  for (const payment of payments) {
    payment.settlement_status = settlement.status === 'disputed' ? 'disputed' : 'settled';
    payment.settlement_reference = settlement.settlement_reference;
    payment.settled_at = settlement.settlement_date;
    await payment.save();
  }
  await auditEvent({ req, userId: req.user.id, hospital_id: Number(req.user.hospital_id || DEFAULT_HOSPITAL_ID), action: `Reconciled SaaS settlement ${settlement.settlement_reference}`, module_name: 'saas_billing', entity_type: 'saas_settlement', entity_id: settlement.id, new_value: { settlement: settlement.toJSON(), payment_ids: payments.map((p) => p.id) } });
  res.status(201).json({ message: 'Gateway settlement reconciled', settlement, payment_count: payments.length });
}));

router.get('/saas/settlements/export.csv', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const rows = await SaaSSettlement.find().sort({ id: -1 }).lean();
  const header = ['settlement_id', 'settlement_reference', 'gateway', 'settlement_date', 'from_date', 'to_date', 'gross_amount', 'gateway_fee', 'net_amount', 'payment_count', 'status'];
  const csv = [header, ...rows.map((r) => [r.id, r.settlement_reference, r.gateway, r.settlement_date, r.from_date, r.to_date, r.gross_amount, r.gateway_fee, r.net_amount, r.payment_count, r.status])].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=saas-gateway-settlements.csv');
  res.send(csv);
}));

router.get('/saas/invoices/export.csv', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (_req, res) => {
  const rows = await SaaSInvoice.find().sort({ id: -1 }).lean();
  const header = ['invoice_id', 'invoice_number', 'hospital_id', 'hospital_name', 'plan', 'billing_cycle', 'period_start', 'period_end', 'due_date', 'total_amount', 'paid_amount', 'balance_amount', 'status'];
  const csv = [header, ...rows.map((r) => [r.id, r.invoice_number, r.hospital_id, r.hospital_name, r.plan, r.billing_cycle, r.period_start, r.period_end, r.due_date, r.total_amount, r.paid_amount, r.balance_amount, r.status])].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=saas-subscription-invoices.csv');
  res.send(csv);
}));

module.exports = router;
