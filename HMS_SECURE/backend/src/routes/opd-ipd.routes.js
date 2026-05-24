const express = require('express');
const { OpdRecord, IpdAdmission, NursingNote, Patient, Doctor, Bed, Appointment, Billing, Prescription } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { createNotification } = require('../utils/notifications');

const router = express.Router();
router.use(verifyToken, attachTenant);

async function withNames(req, rows) {
  const plain = rows.map(r => r.toJSON ? r.toJSON() : r);
  const patientIds = [...new Set(plain.map(x => x.patient_id).filter(Boolean))];
  const doctorIds = [...new Set(plain.map(x => x.doctor_id).filter(Boolean))];
  const patients = await Patient.find(tenantFilter(req, {
    $or: [
      { id: { $in: patientIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { patient_id: { $in: patientIds } },
    ],
  })).lean();
  const doctors = await Doctor.find(tenantFilter(req, {
    $or: [
      { id: { $in: doctorIds.map(Number).filter(n => !Number.isNaN(n)) } },
      { doctor_id: { $in: doctorIds } },
    ],
  })).lean();
  const pm = Object.fromEntries([...patients.map(p => [String(p.id), p.full_name]), ...patients.map(p => [String(p.patient_id), p.full_name])]);
  const dm = Object.fromEntries([...doctors.map(d => [String(d.id), d.full_name]), ...doctors.map(d => [String(d.doctor_id), d.full_name])]);
  return plain.map(x => ({ ...x, patient_name: pm[String(x.patient_id)], doctor_name: dm[String(x.doctor_id)] }));
}

function cleanPrescriptionItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => ({
      medicine_name: String(item.medicine_name || '').trim(),
      dosage: String(item.dosage || '').trim(),
      frequency: String(item.frequency || '').trim(),
      duration: String(item.duration || '').trim(),
      instructions: String(item.instructions || '').trim(),
    }))
    .filter((item) => item.medicine_name || item.dosage || item.frequency || item.duration || item.instructions);
}

async function createConsultationBilling(req, payload, doctor) {
  if (!req.body.generate_bill) return null;

  const consultationFee = Number(req.body.consultation_fee ?? doctor?.consultation_fee ?? 0) || 0;
  const discount = Number(req.body.discount || 0) || 0;
  const gstPercent = Number(req.body.gst_percent || 0) || 0;
  const subtotal = consultationFee;
  const gst_amount = subtotal * gstPercent / 100;
  const total_amount = Math.max(0, subtotal + gst_amount - discount);
  const paid_amount = Number(req.body.paid_amount || 0) || 0;
  const payment_status = paid_amount >= total_amount ? 'paid' : paid_amount > 0 ? 'partial' : 'pending';

  return Billing.create(tenantCreateData(req, {
    patient_id: payload.patient_id,
    doctor_id: payload.doctor_id,
    appointment_id: payload.appointment_id,
    consultation_fee: consultationFee,
    subtotal,
    gst_percent: gstPercent,
    gst_amount,
    discount,
    total_amount,
    paid_amount,
    payment_status,
    billing_date: new Date(),
    invoice_number: `INV-${Date.now()}`,
    source: 'opd_consultation',
    notes: req.body.billing_notes || 'Auto-generated from OPD consultation',
  }));
}

router.post('/opd/register', requirePermission('opd.create'), asyncHandler(async (req, res) => {
  const r = await OpdRecord.create(tenantCreateData(req, req.body));
  res.status(201).json({ message: 'OPD record created successfully', opdId: r.id });
}));

router.get('/opd', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  res.json(await withNames(req, await OpdRecord.find(tenantFilter(req)).sort({ id: -1 })));
}));

router.get('/opd/consultations', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.appointment_id) filter.appointment_id = Number(req.query.appointment_id);
  if (req.query.patient_id) filter.patient_id = req.query.patient_id;
  if (req.query.doctor_id) filter.doctor_id = req.query.doctor_id;
  res.json(await withNames(req, await OpdRecord.find(filter).sort({ id: -1 })));
}));

router.post('/opd/consultations', requirePermission('opd.create'), asyncHandler(async (req, res) => {
  const appointmentId = Number(req.body.appointment_id || 0);
  const appointment = appointmentId ? await Appointment.findOne(tenantFilter(req, { id: appointmentId })).lean() : null;
  const patientId = req.body.patient_id || appointment?.patient_id;
  const doctorId = req.body.doctor_id || appointment?.doctor_id;

  if (!patientId || !doctorId) return res.status(400).json({ message: 'patient_id and doctor_id are required' });

  const doctor = await Doctor.findOne({
    $and: [
      tenantFilter(req),
      { $or: [{ id: Number(doctorId) || -1 }, { doctor_id: String(doctorId) }] },
    ],
  }).lean();

  const prescriptionItems = cleanPrescriptionItems(req.body.prescriptions);
  const payload = {
    appointment_id: appointmentId || null,
    patient_id: patientId,
    doctor_id: doctorId,
    visit_date: req.body.visit_date || appointment?.appointment_date || new Date().toISOString().slice(0, 10),
    chief_complaint: req.body.chief_complaint || '',
    vitals: req.body.vitals || {},
    diagnosis: req.body.diagnosis || '',
    clinical_notes: req.body.clinical_notes || '',
    treatment_plan: req.body.treatment_plan || '',
    follow_up_date: req.body.follow_up_date || null,
    status: req.body.status || 'completed',
    prescriptions: prescriptionItems,
  };

  const r = await OpdRecord.create(tenantCreateData(req, payload));

  let prescription = null;
  if (prescriptionItems.length) {
    prescription = await Prescription.create(tenantCreateData(req, {
      appointment_id: appointmentId || null,
      opd_id: r.id,
      patient_id: patientId,
      doctor_id: doctorId,
      prescription_number: `RX-${Date.now()}`,
      visit_date: payload.visit_date,
      diagnosis: payload.diagnosis,
      medicines: prescriptionItems,
      follow_up_date: payload.follow_up_date,
      notes: req.body.prescription_notes || '',
      status: 'active',
    }));
  }

  const bill = await createConsultationBilling(req, payload, doctor);

  if (appointmentId) {
    const set = payload.status === 'completed'
      ? { status: 'completed', completed_at: new Date(), opd_id: r.id, prescription_id: prescription?.id || null, billing_id: bill?.id || null }
      : { status: 'in_consultation', consultation_started_at: new Date(), opd_id: r.id };
    await Appointment.updateOne(tenantFilter(req, { id: appointmentId }), { $set: set });
  }

  await createNotification(req, {
    title: 'OPD consultation saved',
    message: `Consultation saved for patient ${patientId}.`,
    type: 'opd',
    severity: 'success',
    module: 'opd',
    entity_type: 'opd_record',
    entity_id: r.id,
    target_path: '/appointments',
  });

  if (prescription) {
    await createNotification(req, {
      title: 'Prescription generated',
      message: `Prescription ${prescription.prescription_number} generated.`,
      type: 'prescription',
      severity: 'info',
      module: 'pharmacy',
      entity_type: 'prescription',
      entity_id: prescription.id,
      target_path: '/pharmacy',
    });
  }

  if (bill) {
    await createNotification(req, {
      title: 'Billing generated',
      message: `Invoice ${bill.invoice_number} generated for ₹${bill.total_amount || 0}.`,
      type: 'billing',
      severity: 'info',
      module: 'billing',
      entity_type: 'billing',
      entity_id: bill.id,
      target_path: '/billing',
    });
  }

  res.status(201).json({
    message: 'OPD consultation saved',
    opdId: r.id,
    prescriptionId: prescription?.id || null,
    billingId: bill?.id || null,
    invoice_number: bill?.invoice_number || null,
    total_amount: bill?.total_amount || null,
  });
}));

router.get('/prescriptions', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.appointment_id) filter.appointment_id = Number(req.query.appointment_id);
  if (req.query.patient_id) filter.patient_id = req.query.patient_id;
  if (req.query.doctor_id) filter.doctor_id = req.query.doctor_id;
  res.json(await withNames(req, await Prescription.find(filter).sort({ id: -1 })));
}));

router.post('/ipd/admit', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const r = await IpdAdmission.create(tenantCreateData(req, { ...req.body, admission_date: req.body.admission_date || new Date(), status: 'admitted' }));
  if (req.body.bed_id) await Bed.updateOne(tenantFilter(req, { id: Number(req.body.bed_id) }), { $set: { status: 'occupied' } });
  res.status(201).json({ message: 'Patient admitted successfully', ipdId: r.id });
}));

router.get('/ipd', requirePermission('ipd.view'), asyncHandler(async (req, res) => {
  res.json(await withNames(req, await IpdAdmission.find(tenantFilter(req)).sort({ id: -1 })));
}));

router.post('/ipd/nursing-notes', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const r = await NursingNote.create(tenantCreateData(req, { ...req.body, vitals: req.body.vitals || null }));
  res.status(201).json({ message: 'Nursing note added', id: r.id });
}));

router.post('/ipd/discharge', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  await IpdAdmission.updateOne(tenantFilter(req, { id: Number(req.body.ipd_id) }), { $set: { status: 'discharged', discharge_date: req.body.discharge_date || new Date(), discharge_summary: req.body.discharge_summary || null } });
  res.json({ message: 'Patient discharged successfully' });
}));

module.exports = router;
