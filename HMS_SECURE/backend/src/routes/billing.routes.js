const express = require('express');
const PDFDocument = require('pdfkit');
const { Billing, Patient } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);

async function addPatient(req, rows) {
  const plain = rows.map(r => r.toJSON ? r.toJSON() : r);
  const patientIds = [...new Set(plain.map(x => x.patient_id).filter(Boolean))];
  const patients = await Patient.find(tenantFilter(req, {
    $or: [
      { id: { $in: patientIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { patient_id: { $in: patientIds } },
    ],
  })).lean();
  const pm = Object.fromEntries([
    ...patients.map(p => [String(p.id), p]),
    ...patients.map(p => [String(p.patient_id), p]),
  ]);
  return plain.map(x => ({ ...x, patient_name: pm[String(x.patient_id)]?.full_name, phone: pm[String(x.patient_id)]?.phone }));
}

function buildInvoicePayload(req) {
  const b = req.body || {};
  const lineItems = Array.isArray(b.items) ? b.items : [];
  const itemTotal = lineItems.reduce((sum, item) => sum + (Number(item.amount || item.total || 0) || 0), 0);
  const legacySubtotal = ['consultation_fee', 'room_charges', 'icu_charges', 'lab_charges', 'medicine_charges', 'nursing_charges', 'ambulance_charges']
    .reduce((s, k) => s + Number(b[k] || 0), 0);
  const rawAmount = Number(b.total_amount || b.amount || 0);
  const subtotal = itemTotal || legacySubtotal || rawAmount;
  const gst_amount = Number(b.gst_amount || (subtotal * Number(b.gst_percent || 0) / 100));
  const discount = Number(b.discount || 0);
  const total_amount = Math.max(0, Number(b.total_amount || (subtotal + gst_amount - discount)) || 0);
  const paid_amount = Math.max(0, Number(b.paid_amount || 0));
  const due_amount = Math.max(0, total_amount - paid_amount);
  const payment_status = b.payment_status || b.status || (paid_amount >= total_amount && total_amount > 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending');
  const invoice_number = b.invoice_number || `INV-${Date.now()}`;
  return tenantCreateData(req, {
    ...b,
    invoice_number,
    items: lineItems,
    amount: total_amount,
    subtotal,
    gst_amount,
    discount,
    total_amount,
    paid_amount,
    due_amount,
    status: payment_status,
    payment_status,
    billing_date: b.billing_date ? new Date(b.billing_date) : new Date(),
  });
}

async function createInvoice(req, res) {
  const payload = buildInvoicePayload(req);
  const r = await Billing.create(payload);
  res.status(201).json({
    message: 'Invoice created',
    billingId: r.id,
    invoice_number: payload.invoice_number,
    total_amount: payload.total_amount,
    payment_status: payload.payment_status,
  });
}

router.post('/', requirePermission('billing.create'), asyncHandler(createInvoice));
router.post('/create', requirePermission('billing.create'), asyncHandler(createInvoice));

router.get('/all', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  res.json(await addPatient(req, await Billing.find(tenantFilter(req)).sort({ id: -1 })));
}));

router.get('/summary', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const bills = await Billing.find(tenantFilter(req)).lean();
  const totalBilling = bills.reduce((s, b) => s + Number(b.total_amount || b.amount || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
  res.json({ invoices: bills.length, totalBilling, totalPaid, dueAmount: totalBilling - totalPaid });
}));

router.get('/invoice/:id/pdf', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const rows = await addPatient(req, await Billing.find(tenantFilter(req, { id: Number(req.params.id) })));
  const bill = rows[0];
  if (!bill) return res.status(404).json({ message: 'Invoice not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${bill.invoice_number}.pdf`);
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(20).text('Hospital Invoice', { align: 'center' });
  doc.moveDown();
  Object.entries(bill).forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v ?? ''}`));
  doc.end();
}));

router.get('/revenue-summary', requirePermission('billing.view'), asyncHandler(async (req, res) => {
  const bills = await Billing.find(tenantFilter(req)).lean();
  const grouped = {};
  bills.forEach(b => {
    const d = new Date(b.billing_date || b.created_at || Date.now()).toISOString().slice(0, 10);
    grouped[d] = (grouped[d] || 0) + Number(b.paid_amount || 0);
  });
  res.json(Object.entries(grouped).map(([date, revenue]) => ({ date, revenue })));
}));

module.exports = router;
