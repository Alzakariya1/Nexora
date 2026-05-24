const express = require('express');
const PDFDocument = require('pdfkit');
const { Billing, Patient, InsuranceClaim } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { auditEvent } = require('../utils/audit');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);

const PAYMENT_STATUSES = new Set(['pending', 'partial', 'paid', 'cancelled', 'refunded', 'advance', 'credit']);
const PAYMENT_MODES = new Set(['cash', 'card', 'upi', 'bank', 'bank_transfer', 'insurance', 'corporate_credit', 'other']);
const SERVICE_TYPES = new Set(['opd', 'ipd', 'lab', 'radiology', 'pharmacy', 'procedure', 'package', 'advance', 'refund', 'insurance', 'corporate', 'other']);

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function activeBillingFilter(req, extra = {}) {
  return tenantFilter(req, { is_archived: { $ne: true }, ...extra });
}

function validateInvoicePayload(body = {}, { partial = false } = {}) {
  const errors = [];
  const patientId = String(body.patient_id || '').trim();
  if (!partial && !patientId) errors.push('patient_id is required');

  const numericFields = ['consultation_fee', 'consultation_charges', 'room_charges', 'icu_charges', 'lab_charges', 'medicine_charges', 'nursing_charges', 'ambulance_charges', 'amount', 'subtotal', 'gst_amount', 'gst_percent', 'discount', 'total_amount', 'paid_amount', 'refund_amount', 'advance_amount'];
  numericFields.forEach((field) => {
    if (body[field] !== undefined && body[field] !== '' && Number(body[field]) < 0) errors.push(`${field} cannot be negative`);
  });

  if (body.payment_status && !PAYMENT_STATUSES.has(String(body.payment_status).toLowerCase())) errors.push('Invalid payment_status');
  if (body.status && !PAYMENT_STATUSES.has(String(body.status).toLowerCase())) errors.push('Invalid status');
  if (body.payment_mode && !PAYMENT_MODES.has(String(body.payment_mode).toLowerCase())) errors.push('Invalid payment_mode');
  if (body.service_type && !SERVICE_TYPES.has(String(body.service_type).toLowerCase())) errors.push('Invalid service_type');
  if (body.discount && Number(body.discount) > 0 && !String(body.discount_reason || '').trim()) errors.push('discount_reason is required when discount is applied');
  if (body.refund_amount && Number(body.refund_amount) > 0 && !String(body.refund_reason || '').trim()) errors.push('refund_reason is required when refund is applied');
  if (body.billing_type && !['opd','ipd','lab','radiology','pharmacy','package','advance','refund','insurance','corporate','other'].includes(String(body.billing_type).toLowerCase())) errors.push('Invalid billing_type');

  const total = Number(body.total_amount || body.amount || 0);
  const paid = Number(body.paid_amount || 0);
  if (!partial && total <= 0 && !Array.isArray(body.items)) errors.push('total_amount or line items are required');
  if (paid > total && total > 0) errors.push('paid_amount cannot be greater than total_amount');

  return errors;
}

async function addPatient(req, rows) {
  const plain = rows.map(r => r.toJSON ? r.toJSON() : r);
  const patientIds = [...new Set(plain.map(x => x.patient_id).filter(Boolean))];
  if (!patientIds.length) return plain;
  const patients = await Patient.find(tenantFilter(req, {
    $or: [
      { id: { $in: patientIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { patient_id: { $in: patientIds } },
      { patient_uid: { $in: patientIds } },
    ],
  })).lean();
  const pm = Object.fromEntries([
    ...patients.map(p => [String(p.id), p]),
    ...patients.map(p => [String(p.patient_id), p]),
    ...patients.map(p => [String(p.patient_uid), p]),
  ]);
  return plain.map(x => ({ ...x, patient_name: pm[String(x.patient_id)]?.full_name, phone: pm[String(x.patient_id)]?.phone }));
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const quantity = money(item.quantity || 1);
    const rate = money(item.rate || item.price || item.amount || 0);
    const total = money(item.total || item.amount || quantity * rate);
    return {
      service_type: item.service_type || 'other',
      description: item.description || item.name || `Item ${index + 1}`,
      quantity,
      rate,
      amount: total,
    };
  }).filter(item => item.amount >= 0);
}

function buildInvoicePayload(req, existing = null) {
  const b = req.body || {};
  const items = normalizeItems(b.items);
  const itemTotal = items.reduce((sum, item) => sum + money(item.amount), 0);
  const legacySubtotal = ['consultation_fee', 'consultation_charges', 'room_charges', 'icu_charges', 'lab_charges', 'medicine_charges', 'nursing_charges', 'ambulance_charges']
    .reduce((s, k) => s + money(b[k]), 0);
  const rawAmount = money(b.total_amount || b.amount || existing?.total_amount || existing?.amount || 0);
  const subtotal = money(itemTotal || legacySubtotal || rawAmount);
  const gst_amount = money(b.gst_amount || (subtotal * Number(b.gst_percent || 0) / 100));
  const discount = money(b.discount || 0);
  const total_amount = money(Math.max(0, Number(b.total_amount || (subtotal + gst_amount - discount)) || 0));
  const paid_amount = money(Math.min(Number(b.paid_amount || 0), total_amount));
  const due_amount = money(Math.max(0, total_amount - paid_amount));
  const requestedStatus = String(b.payment_status || b.status || '').toLowerCase();
  const payment_status = requestedStatus && PAYMENT_STATUSES.has(requestedStatus)
    ? requestedStatus
    : (paid_amount >= total_amount && total_amount > 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending');
  const payment_mode = b.payment_mode ? String(b.payment_mode).toLowerCase() : existing?.payment_mode || 'cash';
  const invoice_number = String(b.invoice_number || existing?.invoice_number || `INV-${Date.now()}`).trim();

  return tenantCreateData(req, {
    ...b,
    invoice_number,
    patient_id: String(b.patient_id || existing?.patient_id || '').trim(),
    doctor_id: b.doctor_id || existing?.doctor_id || '',
    service_type: b.service_type || existing?.service_type || 'opd',
    items,
    amount: total_amount,
    subtotal,
    gst_amount,
    discount,
    discount_reason: b.discount_reason || existing?.discount_reason || '',
    total_amount,
    paid_amount,
    due_amount,
    status: payment_status,
    payment_status,
    payment_mode,
    transaction_id: b.transaction_id || existing?.transaction_id || '',
    billing_type: b.billing_type || existing?.billing_type || b.service_type || existing?.service_type || 'opd',
    visit_type: b.visit_type || existing?.visit_type || '',
    admission_id: b.admission_id || existing?.admission_id || null,
    appointment_id: b.appointment_id || existing?.appointment_id || null,
    claim_id: b.claim_id || existing?.claim_id || null,
    corporate_name: b.corporate_name || existing?.corporate_name || '',
    insurance_provider: b.insurance_provider || existing?.insurance_provider || '',
    approval_status: b.approval_status || existing?.approval_status || (discount > 0 ? 'pending_approval' : 'not_required'),
    refund_amount: money(b.refund_amount || existing?.refund_amount || 0),
    refund_reason: b.refund_reason || existing?.refund_reason || '',
    advance_amount: money(b.advance_amount || existing?.advance_amount || 0),
    notes: b.notes || existing?.notes || '',
    billing_date: b.billing_date ? new Date(b.billing_date) : (existing?.billing_date || new Date()),
  });
}

async function createInvoice(req, res) {
  const errors = validateInvoicePayload(req.body);
  if (errors.length) return res.status(400).json({ message: 'Billing validation failed', errors });
  const payload = buildInvoicePayload(req);
  const r = await Billing.create(payload);
  await auditEvent({ req, action: 'billing.invoice_created', module_name: 'billing', entity_type: 'Billing', entity_id: r.id, new_value: payload });
  res.status(201).json({
    message: 'Invoice created',
    data: r,
    billingId: r.id,
    invoice_number: payload.invoice_number,
    total_amount: payload.total_amount,
    paid_amount: payload.paid_amount,
    due_amount: payload.due_amount,
    payment_status: payload.payment_status,
  });
}

router.post('/', requirePermission('billing.create'), asyncHandler(createInvoice));
router.post('/create', requirePermission('billing.create'), asyncHandler(createInvoice));

router.get('/all', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  res.json(await addPatient(req, await Billing.find(activeBillingFilter(req)).sort({ id: -1 })));
}));

router.get('/summary', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const bills = await Billing.find(activeBillingFilter(req)).lean();
  const totalBilling = money(bills.reduce((s, b) => s + Number(b.total_amount || b.amount || 0), 0));
  const totalPaid = money(bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0));
  const dueAmount = money(bills.reduce((s, b) => s + Number(b.due_amount || Math.max(0, Number(b.total_amount || b.amount || 0) - Number(b.paid_amount || 0))), 0));
  const byStatus = bills.reduce((acc, b) => {
    const status = b.payment_status || b.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  res.json({ invoices: bills.length, totalBilling, totalPaid, dueAmount, byStatus });
}));

router.get('/revenue-summary', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const bills = await Billing.find(activeBillingFilter(req)).lean();
  const grouped = {};
  bills.forEach(b => {
    if (['cancelled', 'refunded'].includes(String(b.payment_status || b.status || '').toLowerCase())) return;
    const d = new Date(b.billing_date || b.created_at || Date.now()).toISOString().slice(0, 10);
    grouped[d] = money((grouped[d] || 0) + Number(b.paid_amount || 0));
  });
  res.json(Object.entries(grouped).map(([date, revenue]) => ({ date, revenue })));
}));

router.get('/:id', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const rows = await addPatient(req, await Billing.find(activeBillingFilter(req, { id: Number(req.params.id) })));
  if (!rows[0]) return res.status(404).json({ message: 'Invoice not found' });
  res.json(rows[0]);
}));

router.put('/:id', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  if (['cancelled', 'refunded'].includes(String(bill.payment_status || bill.status || '').toLowerCase())) {
    return res.status(409).json({ message: 'Cancelled/refunded invoice cannot be edited. Create an adjustment or new invoice.' });
  }
  const errors = validateInvoicePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: 'Billing validation failed', errors });
  const oldValue = bill.toJSON();
  const payload = buildInvoicePayload(req, bill);
  Object.assign(bill, payload);
  await bill.save();
  await auditEvent({ req, action: 'billing.invoice_updated', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: payload });
  res.json({ message: 'Invoice updated', data: bill });
}));

router.patch('/:id/payment', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const paidAmount = money(req.body.paid_amount ?? bill.paid_amount);
  const total = money(bill.total_amount || bill.amount || 0);
  if (paidAmount < 0 || paidAmount > total) return res.status(400).json({ message: 'Invalid paid_amount' });
  const oldValue = bill.toJSON();
  bill.paid_amount = paidAmount;
  bill.due_amount = money(Math.max(0, total - paidAmount));
  const requestedStatus = String(req.body.payment_status || '').toLowerCase();
  bill.payment_status = requestedStatus && PAYMENT_STATUSES.has(requestedStatus)
    ? requestedStatus
    : (paidAmount >= total && total > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending');
  bill.status = bill.payment_status;
  if (req.body.payment_mode) bill.payment_mode = String(req.body.payment_mode).toLowerCase();
  if (req.body.transaction_id !== undefined) bill.transaction_id = req.body.transaction_id;
  if (req.body.notes !== undefined) bill.notes = req.body.notes;
  bill.last_payment_at = new Date();
  await bill.save();
  await auditEvent({ req, action: 'billing.payment_updated', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON() });
  res.json({ message: 'Payment updated', data: bill });
}));

router.patch('/:id/cancel', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || req.body.cancel_reason || '').trim();
  if (reason.length < 3) return res.status(400).json({ message: 'Cancellation reason is required' });
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = bill.toJSON();
  bill.payment_status = 'cancelled';
  bill.status = 'cancelled';
  bill.cancel_reason = reason;
  bill.cancelled_at = new Date();
  bill.cancelled_by = req.user?.id || null;
  await bill.save();
  await auditEvent({ req, action: 'billing.invoice_cancelled', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON(), severity: 'warning' });
  res.json({ message: 'Invoice cancelled', data: bill });
}));

router.delete('/:id', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || req.query?.reason || '').trim();
  if (reason.length < 3) return res.status(400).json({ message: 'Archive reason is required' });
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = bill.toJSON();
  bill.is_archived = true;
  bill.archived_at = new Date();
  bill.archived_by = req.user?.id || null;
  bill.archive_reason = reason;
  await bill.save();
  await auditEvent({ req, action: 'billing.invoice_archived', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON(), severity: 'warning' });
  res.json({ message: 'Invoice archived', data: bill });
}));


router.post('/:id/advance', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const amount = money(req.body.amount || req.body.advance_amount);
  if (amount <= 0) return res.status(400).json({ message: 'Valid advance amount is required' });
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = bill.toJSON();
  bill.advance_amount = money(Number(bill.advance_amount || 0) + amount);
  bill.paid_amount = money(Number(bill.paid_amount || 0) + amount);
  const total = money(bill.total_amount || bill.amount || 0);
  bill.due_amount = money(Math.max(0, total - bill.paid_amount));
  bill.payment_status = bill.paid_amount >= total && total > 0 ? 'paid' : 'partial';
  bill.status = bill.payment_status;
  bill.payment_mode = req.body.payment_mode || bill.payment_mode || 'cash';
  bill.transaction_id = req.body.transaction_id || bill.transaction_id || '';
  bill.last_payment_at = new Date();
  await bill.save();
  await auditEvent({ req, action: 'billing.advance_recorded', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON() });
  res.json({ message: 'Advance recorded', data: bill });
}));

router.post('/:id/refund', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const amount = money(req.body.amount || req.body.refund_amount);
  const reason = String(req.body.reason || req.body.refund_reason || '').trim();
  if (amount <= 0) return res.status(400).json({ message: 'Valid refund amount is required' });
  if (reason.length < 3) return res.status(400).json({ message: 'Refund reason is required' });
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  if (amount > Number(bill.paid_amount || 0)) return res.status(400).json({ message: 'Refund cannot exceed paid amount' });
  const oldValue = bill.toJSON();
  bill.refund_amount = money(Number(bill.refund_amount || 0) + amount);
  bill.refund_reason = reason;
  bill.paid_amount = money(Number(bill.paid_amount || 0) - amount);
  const total = money(bill.total_amount || bill.amount || 0);
  bill.due_amount = money(Math.max(0, total - bill.paid_amount));
  bill.payment_status = bill.paid_amount <= 0 ? 'refunded' : 'partial';
  bill.status = bill.payment_status;
  bill.refunded_at = new Date();
  bill.refunded_by = req.user?.id || null;
  await bill.save();
  await auditEvent({ req, action: 'billing.refund_recorded', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON(), severity: 'warning' });
  res.json({ message: 'Refund recorded', data: bill });
}));

router.patch('/:id/discount-approval', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const approvalStatus = String(req.body.approval_status || req.body.status || '').toLowerCase();
  if (!['approved', 'rejected', 'pending_approval'].includes(approvalStatus)) return res.status(400).json({ message: 'Invalid approval_status' });
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const oldValue = bill.toJSON();
  bill.approval_status = approvalStatus;
  bill.approval_reason = req.body.reason || req.body.approval_reason || bill.approval_reason || '';
  bill.approved_by = approvalStatus === 'approved' ? (req.user?.id || null) : bill.approved_by;
  bill.approved_at = approvalStatus === 'approved' ? new Date() : bill.approved_at;
  await bill.save();
  await auditEvent({ req, action: 'billing.discount_approval_updated', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: bill.toJSON() });
  res.json({ message: 'Discount approval updated', data: bill });
}));

router.post('/:id/insurance-claim', requirePermission('billing.edit'), asyncHandler(async (req, res) => {
  const bill = await Billing.findOne(activeBillingFilter(req, { id: Number(req.params.id) }));
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  const claim = await InsuranceClaim.create(tenantCreateData(req, {
    patient_id: bill.patient_id,
    billing_id: bill.id,
    invoice_number: bill.invoice_number,
    insurance_provider: req.body.insurance_provider || bill.insurance_provider || '',
    tpa_name: req.body.tpa_name || '',
    policy_number: req.body.policy_number || '',
    claim_number: req.body.claim_number || `CLM-${Date.now()}`,
    claim_type: req.body.claim_type || 'cashless',
    claim_amount: money(req.body.claim_amount || bill.due_amount || bill.total_amount || 0),
    approved_amount: money(req.body.approved_amount || 0),
    status: req.body.status || 'preauth_initiated',
    notes: req.body.notes || '',
  }));
  const oldValue = bill.toJSON();
  bill.claim_id = claim.id;
  bill.payment_mode = 'insurance';
  bill.billing_type = 'insurance';
  await bill.save();
  await auditEvent({ req, action: 'billing.insurance_claim_linked', module_name: 'billing', entity_type: 'Billing', entity_id: bill.id, old_value: oldValue, new_value: { bill: bill.toJSON(), claim } });
  res.status(201).json({ message: 'Insurance claim linked', data: claim, bill });
}));

router.get('/invoice/:id/pdf', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const rows = await addPatient(req, await Billing.find(activeBillingFilter(req, { id: Number(req.params.id) })));
  const bill = rows[0];
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${bill.invoice_number || `invoice-${bill.id}`}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(20).text('Hospital Invoice', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice: ${bill.invoice_number || bill.id}`);
  doc.text(`Patient: ${bill.patient_name || bill.patient_id || '-'}`);
  doc.text(`Date: ${bill.billing_date ? new Date(bill.billing_date).toLocaleDateString('en-IN') : '-'}`);
  doc.text(`Payment Status: ${bill.payment_status || bill.status || 'pending'}`);
  doc.moveDown();
  if (Array.isArray(bill.items) && bill.items.length) {
    doc.fontSize(13).text('Items');
    bill.items.forEach((item, index) => doc.fontSize(11).text(`${index + 1}. ${item.description || item.name || 'Service'} - Qty ${item.quantity || 1} - ₹${item.amount || item.total || 0}`));
    doc.moveDown();
  }
  doc.fontSize(12).text(`Subtotal: ₹${bill.subtotal || 0}`);
  doc.text(`GST/Tax: ₹${bill.gst_amount || 0}`);
  doc.text(`Discount: ₹${bill.discount || 0}`);
  doc.text(`Total: ₹${bill.total_amount || bill.amount || 0}`);
  doc.text(`Paid: ₹${bill.paid_amount || 0}`);
  doc.text(`Due: ₹${bill.due_amount || 0}`);
  if (bill.notes) doc.moveDown().text(`Notes: ${bill.notes}`);
  doc.end();
}));


module.exports = router;
