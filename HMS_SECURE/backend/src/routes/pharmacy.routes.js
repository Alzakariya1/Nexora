const express = require('express');
const { Medicine, PharmacySale, Prescription } = require('../models');
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

async function createMedicine(req, res) {
  const payload = normalizeMedicinePayload(req.body);
  if (!payload.name) return res.status(400).json({ message: 'Medicine name is required' });

  const duplicate = await Medicine.findOne(tenantFilter(req, {
    name: payload.name,
    batch_number: payload.batch_number || '',
  }));
  if (duplicate) return res.status(409).json({ message: 'Medicine with same batch already exists' });

  const r = await Medicine.create(tenantCreateData(req, payload));
  res.status(201).json({ message: 'Medicine added successfully', medicineId: r.id });
}

router.post('/medicines', requirePermission('pharmacy.create'), asyncHandler(createMedicine));
router.post('/add-medicine', requirePermission('pharmacy.create'), asyncHandler(createMedicine));

router.get('/medicines', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  const rows = await Medicine.find(filter).sort({ id: -1 });
  res.json(rows.map(publicMedicine));
}));

router.put('/medicines/:id', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const payload = normalizeMedicinePayload(req.body);
  if (!payload.name) return res.status(400).json({ message: 'Medicine name is required' });
  const r = await Medicine.findOneAndUpdate(
    tenantFilter(req, { id: Number(req.params.id) }),
    { $set: payload },
    { new: true },
  );
  if (!r) return res.status(404).json({ message: 'Medicine not found' });
  res.json({ message: 'Medicine updated', medicine: publicMedicine(r) });
}));

router.patch('/medicines/:id/stock', requirePermission('pharmacy.stock.manage'), asyncHandler(async (req, res) => {
  const med = await Medicine.findOne(tenantFilter(req, { id: Number(req.params.id) }));
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
  res.json({ message: 'Stock updated', medicine: publicMedicine(med) });
}));

router.get('/low-stock', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const limit = number(req.query.limit, 10);
  const rows = await Medicine.find(tenantFilter(req)).sort({ quantity: 1 }).lean();
  res.json(rows.map(publicMedicine).filter((m) => number(m.quantity) <= number(m.low_stock_threshold, limit)));
}));

async function createSale(req, res) {
  const b = req.body;
  const med = await Medicine.findOne(tenantFilter(req, { id: Number(b.medicine_id) }));
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
    const med = await Medicine.findOne(tenantFilter(req, { id: Number(item.medicine_id) }));
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
  await createNotification(req, { title: 'Prescription dispensed', message: `${created.length} medicine item(s) dispensed.`, type: 'pharmacy', severity: 'success', module: 'pharmacy', entity_type: 'prescription', entity_id: prescription.id, target_path: '/pharmacy' });
  res.status(201).json({ message: 'Prescription dispensed', sales: created.length, total_amount: created.reduce((s, x) => s + number(x.total_amount), 0) });
}));

router.get('/summary', requirePermission('pharmacy.view'), asyncHandler(async (req, res) => {
  const meds = (await Medicine.find(tenantFilter(req)).lean()).map(publicMedicine);
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

module.exports = router;
