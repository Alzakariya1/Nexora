const express = require('express');
const { Medicine, PharmacySale, Prescription } = require('../models');
const { auditEvent } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { createLowStockNotification, createNotification } = require('../utils/notifications');

const router = express.Router();
router.use(verifyToken, attachTenant);

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMedicinePayload(body = {}) {
  const quantity = number(body.quantity ?? body.stock, 0);
  const sellingPrice = number(body.selling_price ?? body.price, 0);
  return {
    name: String(body.name || '').trim(),
    generic_name: body.generic_name || '',
    category: body.category || '',
    batch_number: body.batch_number || '',
    vendor: body.vendor || '',
    expiry_date: body.expiry_date || '',
    quantity,
    stock: quantity,
    low_stock_threshold: number(body.low_stock_threshold, 10),
    cost_price: number(body.cost_price, 0),
    selling_price: sellingPrice,
    price: sellingPrice,
    unit: body.unit || 'pcs',
    status: body.status || 'active',
  };
}

function publicMedicine(med) {
  const plain = med?.toJSON ? med.toJSON() : med;
  const quantity = number(plain.quantity ?? plain.stock, 0);
  const threshold = number(plain.low_stock_threshold, 10);
  return {
    ...plain,
    quantity,
    stock: quantity,
    available_stock: quantity,
    stock_status: quantity <= 0 ? 'out_of_stock' : quantity <= threshold ? 'low_stock' : 'in_stock',
  };
}

function activeMedicineFilter(req, extra = {}) {
  return tenantFilter(req, { status: { $ne: 'archived' }, is_archived: { $ne: true }, ...extra });
}

function validateMedicinePayload(payload) {
  const errors = [];
  if (!payload.name) errors.push('Medicine name is required');
  ['quantity', 'stock', 'low_stock_threshold', 'cost_price', 'selling_price', 'price'].forEach((field) => {
    if (payload[field] !== undefined && Number(payload[field]) < 0) errors.push(`${field} cannot be negative`);
  });
  if (payload.expiry_date && Number.isNaN(new Date(payload.expiry_date).getTime())) errors.push('Invalid expiry_date');
  return errors;
}

function validateSalePayload(body = {}) {
  const errors = [];
  if (!body.medicine_id) errors.push('medicine_id is required');
  if (number(body.quantity, 0) <= 0) errors.push('quantity must be greater than zero');
  if (body.selling_price !== undefined && body.selling_price !== '' && Number(body.selling_price) < 0) errors.push('selling_price cannot be negative');
  return errors;
}

async function createMedicine(req, res) {
  const payload = normalizeMedicinePayload(req.body);
  const errors = validateMedicinePayload(payload);
  if (errors.length) return res.status(400).json({ message: 'Medicine validation failed', errors });

  const duplicate = await Medicine.findOne(activeMedicineFilter(req, {
    name: payload.name,
    batch_number: payload.batch_number || '',
  }));
  if (duplicate) return res.status(409).json({ message: 'Medicine with same batch already exists' });

  const r = await Medicine.create(tenantCreateData(req, payload));
  await auditEvent({ req, action: 'pharmacy.medicine_created', module_name: 'pharmacy', entity_type: 'Medicine', entity_id: r.id, new_value: payload });
  res.status(201).json({ message: 'Medicine added successfully', medicineId: r.id, medicine: publicMedicine(r) });
}

router.post('/medicines', requirePermission('pharmacy.create'), asyncHandler(createMedicine));
router.post('/add-medicine', requirePermission('pharmacy.create'), asyncHandler(createMedicine));

router.get('/medicines', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const filter = req.query.status === 'archived' ? tenantFilter(req, { status: 'archived' }) : activeMedicineFilter(req);
  if (req.query.status && !['all', 'archived'].includes(req.query.status)) filter.status = req.query.status;
  const rows = await Medicine.find(filter).sort({ id: -1 });
  res.json(rows.map(publicMedicine));
}));

router.put('/medicines/:id', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const payload = normalizeMedicinePayload(req.body);
  const errors = validateMedicinePayload(payload);
  if (errors.length) return res.status(400).json({ message: 'Medicine validation failed', errors });
  const existing = await Medicine.findOne(activeMedicineFilter(req, { id: Number(req.params.id) }));
  if (!existing) return res.status(404).json({ message: 'Medicine not found' });
  if ((payload.name !== existing.name || payload.batch_number !== existing.batch_number)) {
    const duplicate = await Medicine.findOne(activeMedicineFilter(req, { name: payload.name, batch_number: payload.batch_number || '', id: { $ne: existing.id } }));
    if (duplicate) return res.status(409).json({ message: 'Medicine with same batch already exists' });
  }
  Object.assign(existing, payload);
  await existing.save();
  await auditEvent({ req, action: 'pharmacy.medicine_updated', module_name: 'pharmacy', entity_type: 'Medicine', entity_id: existing.id, old_value: existing.toJSON ? existing.toJSON() : null, new_value: payload });
  res.json({ message: 'Medicine updated', medicine: publicMedicine(existing) });
}));

router.delete('/medicines/:id', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const med = await Medicine.findOne(activeMedicineFilter(req, { id: Number(req.params.id) }));
  if (!med) return res.status(404).json({ message: 'Medicine not found' });
  med.status = 'archived';
  med.is_archived = true;
  med.archived_at = new Date();
  med.archive_reason = req.body?.reason || req.query.reason || 'Archived from pharmacy module';
  await med.save();
  await auditEvent({ req, action: 'pharmacy.medicine_archived', module_name: 'pharmacy', entity_type: 'Medicine', entity_id: med.id, old_value: publicMedicine(med), new_value: { reason: med.archive_reason } });
  res.json({ message: 'Medicine archived', medicineId: med.id });
}));

router.patch('/medicines/:id/stock', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const med = await Medicine.findOne(activeMedicineFilter(req, { id: Number(req.params.id) }));
  if (!med) return res.status(404).json({ message: 'Medicine not found' });

  const mode = req.body.mode || 'add';
  const qty = Math.abs(number(req.body.quantity, 0));
  if (!qty) return res.status(400).json({ message: 'Quantity is required' });

  const current = number(med.quantity ?? med.stock, 0);
  const next = mode === 'remove' ? current - qty : current + qty;
  if (next < 0) return res.status(400).json({ message: 'Insufficient stock' });

  med.quantity = next;
  med.stock = next;
  med.last_stock_note = req.body.note || '';
  med.last_stock_updated_at = new Date();
  await med.save();
  await createLowStockNotification(req, med);
  await auditEvent({ req, action: 'pharmacy.stock_adjusted', module_name: 'pharmacy', entity_type: 'Medicine', entity_id: med.id, old_value: { quantity: current }, new_value: { quantity: next, mode, adjustment: qty, note: med.last_stock_note } });
  res.json({ message: 'Stock updated', medicine: publicMedicine(med) });
}));

router.get('/low-stock', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const limit = number(req.query.limit, 10);
  const rows = await Medicine.find(activeMedicineFilter(req)).sort({ quantity: 1 }).lean();
  res.json(rows.map(publicMedicine).filter((m) => number(m.quantity) <= number(m.low_stock_threshold, limit)));
}));

async function createSale(req, res) {
  const b = req.body;
  const errors = validateSalePayload(b);
  if (errors.length) return res.status(400).json({ message: 'Sale validation failed', errors });
  const med = await Medicine.findOne(activeMedicineFilter(req, { id: Number(b.medicine_id) }));
  if (!med) return res.status(404).json({ message: 'Medicine not found' });

  const qty = Math.abs(number(b.quantity, 0));
  if (!qty) return res.status(400).json({ message: 'Quantity is required' });

  const current = number(med.quantity ?? med.stock, 0);
  if (current < qty) return res.status(400).json({ message: 'Insufficient stock' });

  const sellingPrice = number(b.selling_price ?? med.selling_price ?? med.price, 0);
  const total = qty * sellingPrice;
  const r = await PharmacySale.create(tenantCreateData(req, {
    ...b,
    sale_number: `PH-${Date.now()}`,
    medicine_id: med.id,
    medicine_name: med.name,
    quantity: qty,
    selling_price: sellingPrice,
    total_amount: total,
    sale_type: b.prescription_id ? 'prescription' : 'direct',
    sold_at: new Date(),
  }));

  med.quantity = current - qty;
  med.stock = med.quantity;
  await med.save();
  await createLowStockNotification(req, med);
  await auditEvent({ req, action: 'pharmacy.sale_created', module_name: 'pharmacy', entity_type: 'PharmacySale', entity_id: r.id, new_value: { sale: r, remaining_stock: med.quantity } });
  await createNotification(req, { title: 'Pharmacy sale completed', message: `${qty} ${med.unit || 'unit'} of ${med.name} sold.`, type: 'pharmacy', severity: 'success', module: 'pharmacy', entity_type: 'pharmacy_sale', entity_id: r.id, target_path: '/pharmacy' });
  res.status(201).json({ message: 'Sale completed', saleId: r.id, total_amount: total, remaining_stock: med.quantity });
}

router.post('/sale', requirePermission('pharmacy.stock.manage'), asyncHandler(createSale));
router.post('/sales', requirePermission('pharmacy.stock.manage'), asyncHandler(createSale));

router.get('/sales', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.prescription_id) filter.prescription_id = Number(req.query.prescription_id);
  if (req.query.patient_id) filter.patient_id = req.query.patient_id;
  res.json(await PharmacySale.find(filter).sort({ id: -1 }).limit(Number(req.query.limit || 100)));
}));

router.post('/dispense-prescription', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOne(tenantFilter(req, { id: Number(req.body.prescription_id) })).lean();
  if (!prescription) return res.status(404).json({ message: 'Prescription not found' });

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ message: 'At least one medicine item is required' });

  const created = [];
  for (const item of items) {
    const med = await Medicine.findOne(activeMedicineFilter(req, { id: Number(item.medicine_id) }));
    if (!med) return res.status(404).json({ message: `Medicine not found: ${item.medicine_id}` });
    const qty = Math.abs(number(item.quantity, 0));
    if (!qty) return res.status(400).json({ message: 'Quantity is required for each medicine' });
    const current = number(med.quantity ?? med.stock, 0);
    if (current < qty) return res.status(400).json({ message: `Insufficient stock for ${med.name}` });
    const sellingPrice = number(item.selling_price ?? med.selling_price ?? med.price, 0);
    const sale = await PharmacySale.create(tenantCreateData(req, {
      sale_number: `PH-${Date.now()}-${med.id}`,
      medicine_id: med.id,
      medicine_name: med.name,
      prescription_id: prescription.id,
      patient_id: prescription.patient_id,
      doctor_id: prescription.doctor_id,
      quantity: qty,
      selling_price: sellingPrice,
      total_amount: qty * sellingPrice,
      sale_type: 'prescription',
      sold_at: new Date(),
    }));
    med.quantity = current - qty;
    med.stock = med.quantity;
    await med.save();
    await createLowStockNotification(req, med);
    created.push(sale);
  }

  await Prescription.updateOne(tenantFilter(req, { id: prescription.id }), { $set: { pharmacy_status: 'dispensed', dispensed_at: new Date() } });
  await auditEvent({ req, action: 'pharmacy.prescription_dispensed', module_name: 'pharmacy', entity_type: 'Prescription', entity_id: prescription.id, new_value: { sales: created.map((x) => x.id), total_amount: created.reduce((sum, x) => sum + number(x.total_amount), 0) } });
  await createNotification(req, { title: 'Prescription dispensed', message: `${created.length} medicine item(s) dispensed.`, type: 'pharmacy', severity: 'success', module: 'pharmacy', entity_type: 'prescription', entity_id: prescription.id, target_path: '/pharmacy' });
  res.status(201).json({ message: 'Prescription dispensed', sales: created.length, total_amount: created.reduce((s, x) => s + number(x.total_amount), 0) });
}));

router.get('/summary', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const meds = (await Medicine.find(activeMedicineFilter(req)).lean()).map(publicMedicine);
  const sales = await PharmacySale.find(tenantFilter(req)).lean();
  const totalUnits = meds.reduce((s, m) => s + number(m.quantity), 0);
  const lowStock = meds.filter((m) => number(m.quantity) <= number(m.low_stock_threshold, 10));
  const expired = meds.filter((m) => m.expiry_date && m.expiry_date < new Date().toISOString().slice(0, 10));
  res.json({
    stock: { medicines: meds.length, units: totalUnits, lowStock: lowStock.length, expired: expired.length },
    sales: { revenue: sales.reduce((s, x) => s + number(x.total_amount), 0), sales: sales.length },
    lowStock: lowStock.slice(0, 10),
  });
}));

function isExpired(med) {
  return med.expiry_date && new Date(med.expiry_date) < new Date();
}

router.get('/expiry-alerts', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const days = Math.max(1, number(req.query.days, 90));
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const rows = await Medicine.find(activeMedicineFilter(req)).lean();
  const alerts = rows.map(publicMedicine).filter((m) => m.expiry_date && new Date(m.expiry_date) <= until)
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  res.json({ days, count: alerts.length, alerts });
}));

router.post('/purchase-receive', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const payload = normalizeMedicinePayload({ ...req.body, quantity: number(req.body.quantity, 0) });
  const errors = validateMedicinePayload(payload);
  if (number(payload.quantity, 0) <= 0) errors.push('quantity must be greater than zero');
  if (errors.length) return res.status(400).json({ message: 'Purchase receive validation failed', errors });

  let med = await Medicine.findOne(activeMedicineFilter(req, { name: payload.name, batch_number: payload.batch_number || '' }));
  const before = med ? number(med.quantity ?? med.stock, 0) : 0;
  if (med) {
    med.quantity = before + number(payload.quantity, 0);
    med.stock = med.quantity;
    med.cost_price = payload.cost_price;
    med.selling_price = payload.selling_price || med.selling_price;
    med.price = med.selling_price;
    med.vendor = payload.vendor || med.vendor;
    med.expiry_date = payload.expiry_date || med.expiry_date;
    med.last_grn_number = req.body.grn_number || `GRN-${Date.now()}`;
    med.last_received_at = new Date();
    await med.save();
  } else {
    med = await Medicine.create(tenantCreateData(req, {
      ...payload,
      last_grn_number: req.body.grn_number || `GRN-${Date.now()}`,
      last_received_at: new Date(),
    }));
  }
  await auditEvent({ req, action: 'pharmacy.purchase_received', module_name: 'pharmacy', entity_type: 'Medicine', entity_id: med.id, old_value: { quantity: before }, new_value: { quantity: med.quantity, grn_number: med.last_grn_number, vendor: med.vendor } });
  res.status(201).json({ message: 'Purchase stock received', medicine: publicMedicine(med), grn_number: med.last_grn_number });
}));

router.post('/sales/:id/return', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const sale = await PharmacySale.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!sale) return res.status(404).json({ message: 'Sale not found' });
  if (sale.status === 'returned') return res.status(409).json({ message: 'Sale already returned' });
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Return reason is required' });
  const qty = Math.abs(number(req.body.quantity || sale.quantity, 0));
  if (!qty || qty > number(sale.quantity, 0)) return res.status(400).json({ message: 'Invalid return quantity' });
  const med = await Medicine.findOne(activeMedicineFilter(req, { id: Number(sale.medicine_id) }));
  if (med) {
    med.quantity = number(med.quantity ?? med.stock, 0) + qty;
    med.stock = med.quantity;
    await med.save();
  }
  sale.returned_quantity = qty;
  sale.return_reason = reason;
  sale.returned_at = new Date();
  sale.status = qty === number(sale.quantity, 0) ? 'returned' : 'partially_returned';
  await sale.save();
  await auditEvent({ req, action: 'pharmacy.sale_returned', module_name: 'pharmacy', entity_type: 'PharmacySale', entity_id: sale.id, new_value: { quantity: qty, reason, medicine_id: sale.medicine_id } });
  res.json({ message: 'Sale return recorded', sale, restored_stock: med ? med.quantity : null });
}));

router.get('/controlled-register', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const rows = await Medicine.find(activeMedicineFilter(req)).lean();
  const controlled = rows.map(publicMedicine).filter((m) => m.is_controlled || /narcotic|controlled|schedule/i.test(`${m.category} ${m.name}`));
  res.json({ count: controlled.length, medicines: controlled });
}));

module.exports = router;
