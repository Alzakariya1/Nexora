const express = require('express');
const { OTBooking, SurgeryNote, AnaesthesiaNote, PostOpNote, OTInventoryUsage, Patient, Doctor } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const allowedStatuses = new Set(['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']);
const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());

async function audit(req, action, entity_type, entity_id, new_value = {}) {
  await auditEvent({ req, action, module_name: 'ot_surgery', entity_type, entity_id, new_value, status: 'success', severity: 'info' });
}

router.get('/ot/bookings', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req, {});
  if (req.query.status) filter.status = clean(req.query.status).toLowerCase();
  if (req.query.from || req.query.to) {
    filter.scheduled_date = {};
    if (req.query.from) filter.scheduled_date.$gte = clean(req.query.from).slice(0, 10);
    if (req.query.to) filter.scheduled_date.$lte = clean(req.query.to).slice(0, 10);
  }
  const bookings = await OTBooking.find(filter).sort({ scheduled_date: -1, start_time: 1, id: -1 }).lean();
  res.json(bookings);
}));

router.post('/ot/bookings', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const status = allowedStatuses.has(clean(body.status).toLowerCase()) ? clean(body.status).toLowerCase() : 'scheduled';
  const payload = tenantCreateData(req, {
    patient_id: clean(body.patient_id), doctor_id: clean(body.doctor_id), ot_room: clean(body.ot_room),
    surgery_type: clean(body.surgery_type), procedure_name: clean(body.procedure_name), scheduled_date: clean(body.scheduled_date).slice(0, 10),
    start_time: clean(body.start_time), end_time: clean(body.end_time), priority: clean(body.priority) || 'routine',
    status, diagnosis: clean(body.diagnosis), notes: clean(body.notes), billing_id: body.billing_id ? Number(body.billing_id) : undefined,
    surgeon_team: Array.isArray(body.surgeon_team) ? body.surgeon_team : [], created_by: req.user?.id,
  });
  if (!payload.patient_id || !payload.doctor_id || !payload.procedure_name || !payload.scheduled_date) {
    return res.status(400).json({ message: 'patient_id, doctor_id, procedure_name and scheduled_date are required' });
  }
  const booking = await OTBooking.create(payload);
  await audit(req, 'ot.booking.created', 'OTBooking', booking.id, { id: booking.id, status: booking.status });
  res.status(201).json(booking);
}));

router.patch('/ot/bookings/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = allowedStatuses.has(clean(updates.status).toLowerCase()) ? clean(updates.status).toLowerCase() : 'scheduled';
  const booking = await OTBooking.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!booking) return res.status(404).json({ message: 'OT booking not found' });
  await audit(req, 'ot.booking.updated', 'OTBooking', booking.id, { id: booking.id, status: booking.status });
  res.json(booking);
}));

router.post('/ot/bookings/:id/surgery-note', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const booking = await OTBooking.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!booking) return res.status(404).json({ message: 'OT booking not found' });
  const note = await SurgeryNote.create(tenantCreateData(req, { ...req.body, ot_booking_id: booking.id, patient_id: booking.patient_id, doctor_id: booking.doctor_id, created_by: req.user?.id }));
  await audit(req, 'ot.surgery_note.created', 'SurgeryNote', note.id, { ot_booking_id: booking.id });
  res.status(201).json(note);
}));

router.post('/ot/bookings/:id/anaesthesia-note', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const booking = await OTBooking.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!booking) return res.status(404).json({ message: 'OT booking not found' });
  const note = await AnaesthesiaNote.create(tenantCreateData(req, { ...req.body, ot_booking_id: booking.id, patient_id: booking.patient_id, created_by: req.user?.id }));
  await audit(req, 'ot.anaesthesia_note.created', 'AnaesthesiaNote', note.id, { ot_booking_id: booking.id });
  res.status(201).json(note);
}));

router.post('/ot/bookings/:id/post-op-note', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const booking = await OTBooking.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!booking) return res.status(404).json({ message: 'OT booking not found' });
  const note = await PostOpNote.create(tenantCreateData(req, { ...req.body, ot_booking_id: booking.id, patient_id: booking.patient_id, created_by: req.user?.id }));
  await audit(req, 'ot.post_op_note.created', 'PostOpNote', note.id, { ot_booking_id: booking.id });
  res.status(201).json(note);
}));

router.post('/ot/bookings/:id/inventory-usage', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const booking = await OTBooking.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!booking) return res.status(404).json({ message: 'OT booking not found' });
  const usage = await OTInventoryUsage.create(tenantCreateData(req, { ...req.body, ot_booking_id: booking.id, quantity: Number(req.body.quantity || 0), created_by: req.user?.id }));
  await audit(req, 'ot.inventory_usage.created', 'OTInventoryUsage', usage.id, { ot_booking_id: booking.id, item_id: usage.item_id });
  res.status(201).json(usage);
}));

router.get('/ot/dashboard', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const bookings = await OTBooking.find(tenantFilter(req, { scheduled_date: { $gte: req.query.from || today, $lte: req.query.to || today } })).lean();
  const byStatus = bookings.reduce((acc, b) => { acc[b.status || 'scheduled'] = (acc[b.status || 'scheduled'] || 0) + 1; return acc; }, {});
  res.json({ total: bookings.length, byStatus, upcoming: bookings.filter(b => ['scheduled','postponed'].includes(b.status)).slice(0, 10) });
}));

module.exports = router;
