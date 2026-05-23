const express = require('express');
const crypto = require('crypto');
const { Billing, EnterpriseFeatureRecord, IntegrationLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const FEATURE = 'erp_tally';
const DEFAULT_LEDGER_MAP = {
  sales_ledger: 'Hospital Sales',
  tax_ledger: 'GST Output',
  cash_ledger: 'Cash',
  bank_ledger: 'Bank',
  receivable_ledger: 'Patient Receivables',
  discount_ledger: 'Discount Allowed',
  refund_ledger: 'Refunds',
};
const EXPORT_FORMATS = ['json', 'xml', 'csv'];

function money(value) {
  const n = Number(value || 0);
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function safeText(value = '') {
  return String(value ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function exportHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function asDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function dateRangeQuery(req) {
  const q = {};
  const from = asDate(req.query.from);
  const to = asDate(req.query.to);
  if (from || to) {
    q.$or = [
      { billing_date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } },
      { created_at: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } },
    ];
  }
  return q;
}

function resolvePaymentLedger(bill, map = DEFAULT_LEDGER_MAP) {
  const mode = String(bill.payment_mode || '').toLowerCase();
  if (mode.includes('cash')) return map.cash_ledger || DEFAULT_LEDGER_MAP.cash_ledger;
  if (mode.includes('bank') || mode.includes('card') || mode.includes('upi') || mode.includes('online')) return map.bank_ledger || DEFAULT_LEDGER_MAP.bank_ledger;
  return map.receivable_ledger || DEFAULT_LEDGER_MAP.receivable_ledger;
}

function billToVoucher(bill, ledgerMap = DEFAULT_LEDGER_MAP) {
  const total = money(bill.total_amount || bill.amount || 0);
  const paid = money(bill.paid_amount || 0);
  const due = money(bill.due_amount || Math.max(0, total - paid));
  const gst = money(bill.gst_amount || 0);
  const discount = money(bill.discount || 0);
  const refund = money(bill.refund_amount || 0);
  const voucherDate = bill.billing_date || bill.created_at || new Date();
  const lines = [
    { ledger: ledgerMap.sales_ledger || DEFAULT_LEDGER_MAP.sales_ledger, type: 'credit', amount: money(total - gst + discount) },
  ];
  if (gst > 0) lines.push({ ledger: ledgerMap.tax_ledger || DEFAULT_LEDGER_MAP.tax_ledger, type: 'credit', amount: gst });
  if (discount > 0) lines.push({ ledger: ledgerMap.discount_ledger || DEFAULT_LEDGER_MAP.discount_ledger, type: 'debit', amount: discount });
  if (paid > 0) lines.push({ ledger: resolvePaymentLedger(bill, ledgerMap), type: 'debit', amount: paid });
  if (due > 0) lines.push({ ledger: ledgerMap.receivable_ledger || DEFAULT_LEDGER_MAP.receivable_ledger, type: 'debit', amount: due });
  if (refund > 0) lines.push({ ledger: ledgerMap.refund_ledger || DEFAULT_LEDGER_MAP.refund_ledger, type: 'debit', amount: refund });

  return {
    voucher_type: refund > 0 ? 'Payment/Refund' : 'Sales',
    voucher_number: bill.invoice_number || `BILL-${bill.id}`,
    bill_id: bill.id,
    date: new Date(voucherDate).toISOString().slice(0, 10),
    patient_id: bill.patient_id || '',
    doctor_id: bill.doctor_id || '',
    service_type: bill.service_type || bill.billing_type || 'hospital_service',
    payment_mode: bill.payment_mode || 'not_recorded',
    totals: { total, paid, due, gst, discount, refund },
    ledger_entries: lines.filter((x) => x.amount > 0),
    narration: `HMS invoice export for ${bill.invoice_number || bill.id}`,
  };
}

function toCsv(vouchers) {
  const rows = [['Voucher No','Date','Type','Ledger','Entry Type','Amount','Patient ID','Payment Mode','Narration']];
  vouchers.forEach((v) => v.ledger_entries.forEach((l) => rows.push([
    v.voucher_number, v.date, v.voucher_type, l.ledger, l.type, l.amount, v.patient_id, v.payment_mode, v.narration,
  ])));
  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function toTallyXml(vouchers) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>${vouchers.map((v) => `<TALLYMESSAGE><VOUCHER VCHTYPE="${safeText(v.voucher_type)}" ACTION="Create"><DATE>${v.date.replace(/-/g, '')}</DATE><VOUCHERNUMBER>${safeText(v.voucher_number)}</VOUCHERNUMBER><NARRATION>${safeText(v.narration)}</NARRATION>${v.ledger_entries.map((l) => `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${safeText(l.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${l.type === 'debit' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${l.type === 'debit' ? '-' : ''}${money(l.amount)}</AMOUNT></ALLLEDGERENTRIES.LIST>`).join('')}</VOUCHER></TALLYMESSAGE>`).join('')}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

async function getLedgerMap(req) {
  const rec = await EnterpriseFeatureRecord.findOne(tenantFilter(req, { feature_key: FEATURE, record_type: 'ledger_mapping', status: 'active' })).sort({ updated_at: -1 }).lean();
  return { ...DEFAULT_LEDGER_MAP, ...(rec?.payload || {}) };
}

router.get('/erp-tally/summary', requirePermission(['erp.view', 'erp.manage', 'billing.view', 'configuration.manage']), asyncHandler(async (req, res) => {
  const invoiceQuery = tenantFilter(req, { ...dateRangeQuery(req), is_archived: { $ne: true } });
  const [invoiceCount, paidAgg, dueAgg, mappings, exports, failedExports] = await Promise.all([
    Billing.countDocuments(invoiceQuery),
    Billing.aggregate([{ $match: invoiceQuery }, { $group: { _id: null, total: { $sum: { $ifNull: ['$paid_amount', 0] } } } }]),
    Billing.aggregate([{ $match: invoiceQuery }, { $group: { _id: null, total: { $sum: { $ifNull: ['$due_amount', 0] } } } }]),
    EnterpriseFeatureRecord.countDocuments(tenantFilter(req, { feature_key: FEATURE, record_type: 'ledger_mapping' })),
    IntegrationLog.countDocuments(tenantFilter(req, { system: FEATURE, method: 'EXPORT' })),
    IntegrationLog.countDocuments(tenantFilter(req, { system: FEATURE, method: 'EXPORT', status: 'failed' })),
  ]);
  res.json({
    invoice_count: invoiceCount,
    collected_amount: money(paidAgg[0]?.total),
    outstanding_amount: money(dueAgg[0]?.total),
    ledger_mappings: mappings,
    export_count: exports,
    failed_exports: failedExports,
    formats: EXPORT_FORMATS,
  });
}));

router.get('/erp-tally/ledger-mapping', requirePermission(['erp.view', 'erp.manage', 'billing.view', 'configuration.manage']), asyncHandler(async (req, res) => {
  const records = await EnterpriseFeatureRecord.find(tenantFilter(req, { feature_key: FEATURE, record_type: 'ledger_mapping' })).sort({ created_at: -1 }).lean();
  res.json({ default_mapping: DEFAULT_LEDGER_MAP, records, active_mapping: await getLedgerMap(req) });
}));

router.post('/erp-tally/ledger-mapping', requirePermission(['erp.manage', 'billing.edit', 'configuration.manage']), asyncHandler(async (req, res) => {
  const payload = { ...DEFAULT_LEDGER_MAP, ...(req.body || {}) };
  const doc = await EnterpriseFeatureRecord.create(tenantCreateData(req, {
    feature_key: FEATURE,
    record_type: 'ledger_mapping',
    title: req.body?.title || 'ERP/Tally Ledger Mapping',
    status: 'active',
    payload,
    created_by: req.user?.id,
    updated_by: req.user?.id,
  }));
  await auditEvent({ req, action: 'ERP/Tally ledger mapping saved', module_name: FEATURE, entity_type: 'ledger_mapping', entity_id: doc.id, new_value: doc });
  res.status(201).json(doc);
}));

router.get('/erp-tally/export/preview', requirePermission(['erp.view', 'erp.manage', 'billing.view', 'configuration.manage']), asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 500);
  const ledgerMap = await getLedgerMap(req);
  const bills = await Billing.find(tenantFilter(req, { ...dateRangeQuery(req), is_archived: { $ne: true } })).sort({ billing_date: -1, created_at: -1 }).limit(limit).lean();
  const vouchers = bills.map((bill) => billToVoucher(bill, ledgerMap));
  const manifest = {
    format: req.query.format && EXPORT_FORMATS.includes(req.query.format) ? req.query.format : 'json',
    voucher_count: vouchers.length,
    source: 'billing',
    generated_at: new Date().toISOString(),
    checksum: exportHash(vouchers),
    ledger_map: ledgerMap,
  };
  res.json({ manifest, vouchers });
}));

router.post('/erp-tally/export', requirePermission(['erp.manage', 'billing.edit', 'configuration.manage']), asyncHandler(async (req, res) => {
  const format = EXPORT_FORMATS.includes(req.body?.format) ? req.body.format : 'json';
  const ledgerMap = { ...(await getLedgerMap(req)), ...(req.body?.ledger_mapping || {}) };
  const query = tenantFilter(req, { ...dateRangeQuery({ query: req.body || {} }), is_archived: { $ne: true } });
  const bills = await Billing.find(query).sort({ billing_date: -1, created_at: -1 }).limit(Math.min(Number(req.body?.limit || 500), 2000)).lean();
  const vouchers = bills.map((bill) => billToVoucher(bill, ledgerMap));
  const payload = format === 'xml' ? toTallyXml(vouchers) : format === 'csv' ? toCsv(vouchers) : vouchers;
  const manifest = { format, voucher_count: vouchers.length, checksum: exportHash(vouchers), generated_at: new Date().toISOString(), source: 'billing' };
  const log = await IntegrationLog.create(tenantCreateData(req, {
    system: FEATURE,
    direction: 'outbound',
    resource_type: 'Voucher',
    method: 'EXPORT',
    endpoint: '/api/erp-tally/export',
    status: 'success',
    request_payload: { format, from: req.body?.from, to: req.body?.to, limit: req.body?.limit },
    response_payload: { manifest },
  }));
  await auditEvent({ req, action: 'ERP/Tally voucher export generated', module_name: FEATURE, entity_type: 'integration_log', entity_id: log.id, new_value: manifest });
  res.json({ manifest: { ...manifest, export_log_id: log.id }, payload });
}));

router.get('/erp-tally/export/:id/manifest', requirePermission(['erp.view', 'erp.manage', 'billing.view', 'configuration.manage']), asyncHandler(async (req, res) => {
  const log = await IntegrationLog.findOne(tenantFilter(req, { system: FEATURE, id: Number(req.params.id) })).lean();
  if (!log) return res.status(404).json({ message: 'ERP/Tally export log not found' });
  res.json({ export_log_id: log.id, manifest: log.response_payload?.manifest || {}, status: log.status, created_at: log.created_at });
}));

module.exports = router;
