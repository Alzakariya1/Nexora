const express = require('express');
const { OpdRecord, IpdAdmission, NursingNote, Patient, Doctor, Bed, Appointment, Billing, Prescription, ClinicalRecord } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { createNotification } = require('../utils/notifications');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const FINAL_STATUSES = new Set(['completed', 'finalized', 'locked']);

function toText(value) {
  return String(value || '').trim();
}

function cleanStringArray(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  if (typeof value === 'string') return value.split('\n').map(toText).filter(Boolean);
  return [];
}

function cleanPrescriptionItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => ({
      medicine_name: toText(item.medicine_name),
      dosage: toText(item.dosage),
      frequency: toText(item.frequency),
      duration: toText(item.duration),
      instructions: toText(item.instructions),
    }))
    .filter((item) => item.medicine_name || item.dosage || item.frequency || item.duration || item.instructions);
}

function cleanInvestigationOrders(value = []) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => ({
      type: ['lab', 'radiology'].includes(item.type) ? item.type : 'lab',
      name: toText(item.name || item.test_name || item.scan_name),
      priority: toText(item.priority || 'routine'),
      notes: toText(item.notes),
    }))
    .filter((item) => item.name);
}

function normalizeVitals(vitals = {}) {
  return {
    bp: toText(vitals.bp),
    pulse: toText(vitals.pulse),
    temperature: toText(vitals.temperature),
    spo2: toText(vitals.spo2),
    weight: toText(vitals.weight),
    height: toText(vitals.height),
    respiratory_rate: toText(vitals.respiratory_rate),
    pain_score: toText(vitals.pain_score),
  };
}

function validateConsultationInput(body, { requireBasics = true } = {}) {
  const errors = [];
  if (requireBasics && !body.patient_id && !body.appointment_id) errors.push('patient_id or appointment_id is required');
  if (requireBasics && !body.doctor_id && !body.appointment_id) errors.push('doctor_id or appointment_id is required');
  if (requireBasics && !toText(body.chief_complaint)) errors.push('chief_complaint is required');
  if (requireBasics && !toText(body.diagnosis || body.assessment || body.final_diagnosis || body.provisional_diagnosis)) errors.push('diagnosis or assessment is required');
  const followUp = body.follow_up_date;
  if (followUp && Number.isNaN(new Date(followUp).getTime())) errors.push('follow_up_date is invalid');
  return errors;
}

function buildOpdPayload(req, appointment, doctorId, patientId) {
  const status = req.body.status || 'completed';
  const finalized = Boolean(req.body.finalize || req.body.is_finalized || FINAL_STATUSES.has(status));
  return {
    appointment_id: Number(req.body.appointment_id || 0) || null,
    patient_id: String(patientId),
    doctor_id: String(doctorId),
    visit_date: req.body.visit_date || appointment?.appointment_date || new Date().toISOString().slice(0, 10),
    chief_complaint: toText(req.body.chief_complaint),
    history_present_illness: toText(req.body.history_present_illness),
    past_history: toText(req.body.past_history),
    medication_history: toText(req.body.medication_history),
    surgical_history: toText(req.body.surgical_history),
    family_history: toText(req.body.family_history),
    allergies: cleanStringArray(req.body.allergies),
    vitals: normalizeVitals(req.body.vitals || {}),
    examination_findings: toText(req.body.examination_findings || req.body.objective),
    diagnosis: toText(req.body.diagnosis || req.body.final_diagnosis || req.body.provisional_diagnosis),
    provisional_diagnosis: toText(req.body.provisional_diagnosis),
    final_diagnosis: toText(req.body.final_diagnosis || req.body.diagnosis),
    diagnosis_code: toText(req.body.diagnosis_code),
    clinical_notes: toText(req.body.clinical_notes),
    treatment_plan: toText(req.body.treatment_plan || req.body.plan),
    advice: toText(req.body.advice),
    referral_notes: toText(req.body.referral_notes),
    investigation_orders: cleanInvestigationOrders(req.body.investigation_orders),
    follow_up_date: req.body.follow_up_date || null,
    status,
    is_finalized: finalized,
    locked_at: finalized ? new Date() : null,
    finalized_by: finalized ? req.user?.id : null,
    prescriptions: cleanPrescriptionItems(req.body.prescriptions),
  };
}

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
  auditEvent({ req, action: 'Registered OPD visit', module_name: 'opd', entity_type: 'opd_record', entity_id: r.id, new_value: r });
  res.status(201).json({ message: 'OPD record created successfully', opdId: r.id });
}));

router.get('/opd', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  res.json(await withNames(req, await OpdRecord.find(tenantFilter(req, { status: { $ne: 'archived' } })).sort({ id: -1 })));
}));

router.get('/opd/consultations', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req, { status: { $ne: 'archived' } });
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
  const validationErrors = validateConsultationInput({ ...req.body, patient_id: patientId, doctor_id: doctorId });
  if (validationErrors.length) return res.status(400).json({ message: validationErrors.join(', '), errors: validationErrors });

  const doctor = await Doctor.findOne({
    $and: [
      tenantFilter(req),
      { $or: [{ id: Number(doctorId) || -1 }, { doctor_id: String(doctorId) }] },
    ],
  }).lean();

  const payload = buildOpdPayload(req, appointment, doctorId, patientId);
  const prescriptionItems = payload.prescriptions;
  const r = await OpdRecord.create(tenantCreateData(req, payload));
  auditEvent({ req, action: 'Created OPD consultation', module_name: 'opd', entity_type: 'opd_record', entity_id: r.id, new_value: r });

  await ClinicalRecord.create(tenantCreateData(req, {
    patient_id: String(patientId),
    doctor_id: String(doctorId),
    appointment_id: payload.appointment_id,
    opd_id: r.id,
    record_type: 'soap',
    title: `OPD consultation - ${payload.visit_date}`,
    chief_complaint: payload.chief_complaint,
    subjective: payload.history_present_illness || payload.clinical_notes,
    objective: payload.examination_findings,
    assessment: payload.diagnosis,
    plan: payload.treatment_plan || payload.advice,
    diagnosis: payload.diagnosis,
    status: 'active',
    notes: payload.clinical_notes,
    recorded_by: req.user?.id,
    record_date: payload.visit_date || new Date(),
    vitals: payload.vitals,
  }));

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
    auditEvent({ req, action: 'Generated prescription from OPD', module_name: 'opd', entity_type: 'prescription', entity_id: prescription.id, new_value: prescription });
  }

  const bill = await createConsultationBilling(req, payload, doctor);
  if (bill) auditEvent({ req, action: 'Generated OPD consultation bill', module_name: 'billing', entity_type: 'billing', entity_id: bill.id, new_value: bill });

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

router.get('/opd/consultations/:id', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  const record = await OpdRecord.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!record || record.status === 'archived') return res.status(404).json({ message: 'OPD consultation not found' });
  res.json(record);
}));

router.put('/opd/consultations/:id', requirePermission('opd.create'), asyncHandler(async (req, res) => {
  const existing = await OpdRecord.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'OPD consultation not found' });
  const oldValue = existing.toJSON ? existing.toJSON() : existing;
  if (existing.is_finalized || existing.locked_at || FINAL_STATUSES.has(existing.status)) {
    if (!toText(req.body.edit_reason)) return res.status(400).json({ message: 'edit_reason is required for finalized consultation edits' });
  }
  const allowed = [
    'chief_complaint', 'history_present_illness', 'past_history', 'medication_history', 'surgical_history', 'family_history',
    'allergies', 'vitals', 'examination_findings', 'diagnosis', 'provisional_diagnosis', 'final_diagnosis', 'diagnosis_code',
    'clinical_notes', 'treatment_plan', 'advice', 'referral_notes', 'investigation_orders', 'follow_up_date', 'prescriptions', 'status'
  ];
  const update = {};
  allowed.forEach((key) => {
    if (!(key in req.body)) return;
    if (key === 'vitals') update[key] = normalizeVitals(req.body[key]);
    else if (key === 'allergies') update[key] = cleanStringArray(req.body[key]);
    else if (key === 'investigation_orders') update[key] = cleanInvestigationOrders(req.body[key]);
    else if (key === 'prescriptions') update[key] = cleanPrescriptionItems(req.body[key]);
    else update[key] = req.body[key];
  });
  if (toText(req.body.edit_reason)) {
    update.last_edit_reason = toText(req.body.edit_reason);
    update.last_edited_by = req.user?.id;
    update.last_edited_at = new Date();
  }
  await OpdRecord.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  auditEvent({ req, action: 'Updated OPD consultation', module_name: 'opd', entity_type: 'opd_record', entity_id: req.params.id, old_value: oldValue, new_value: update });
  res.json({ message: 'OPD consultation updated' });
}));

router.patch('/opd/consultations/:id/finalize', requirePermission('opd.create'), asyncHandler(async (req, res) => {
  const existing = await OpdRecord.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'OPD consultation not found' });
  const oldValue = existing.toJSON ? existing.toJSON() : existing;
  const update = {
    status: 'completed',
    is_finalized: true,
    locked_at: existing.locked_at || new Date(),
    finalized_by: existing.finalized_by || req.user?.id,
    finalize_notes: toText(req.body.finalize_notes),
  };
  await OpdRecord.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  if (existing.appointment_id) {
    await Appointment.updateOne(tenantFilter(req, { id: Number(existing.appointment_id) }), { $set: { status: 'completed', completed_at: new Date(), opd_id: existing.id } });
  }
  auditEvent({ req, action: 'Finalized OPD consultation', module_name: 'opd', entity_type: 'opd_record', entity_id: req.params.id, old_value: oldValue, new_value: update });
  res.json({ message: 'OPD consultation finalized' });
}));

router.delete('/opd/consultations/:id', requirePermission('opd.create'), asyncHandler(async (req, res) => {
  const existing = await OpdRecord.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'OPD consultation not found' });
  if (!toText(req.body?.reason || req.query.reason)) return res.status(400).json({ message: 'Archive reason is required' });
  const update = { status: 'archived', archived_at: new Date(), archived_by: req.user?.id, archive_reason: toText(req.body?.reason || req.query.reason) };
  await OpdRecord.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  auditEvent({ req, action: 'Archived OPD consultation', module_name: 'opd', entity_type: 'opd_record', entity_id: req.params.id, old_value: existing, new_value: update });
  res.json({ message: 'OPD consultation archived' });
}));

router.get('/prescriptions', requirePermission('opd.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.appointment_id) filter.appointment_id = Number(req.query.appointment_id);
  if (req.query.patient_id) filter.patient_id = req.query.patient_id;
  if (req.query.doctor_id) filter.doctor_id = req.query.doctor_id;
  res.json(await withNames(req, await Prescription.find(filter).sort({ id: -1 })));
}));


const IPD_ACTIVE_STATUSES = new Set(['admission_requested', 'admitted', 'under_treatment', 'discharge_initiated', 'billing_pending']);
const BED_OCCUPIED_STATUSES = new Set(['occupied', 'admitted']);

function validateIpdAdmission(body) {
  const errors = [];
  if (!body.patient_id) errors.push('patient_id is required');
  if (!body.bed_id && !body.bed_number) errors.push('bed_id or bed_number is required');
  if (!toText(body.admission_type)) errors.push('admission_type is required');
  if (!toText(body.primary_consultant_id || body.doctor_id || body.consultant_id)) errors.push('primary consultant/doctor is required');
  if (body.admission_date && Number.isNaN(new Date(body.admission_date).getTime())) errors.push('admission_date is invalid');
  return errors;
}

async function findIpdBed(req, body = {}) {
  const bedFilter = body.bed_id
    ? { id: Number(body.bed_id) }
    : { bed_number: String(body.bed_number || '').trim(), ...(body.ward ? { ward: String(body.ward).trim() } : {}) };
  return Bed.findOne(tenantFilter(req, bedFilter));
}

async function releaseBed(req, bedId, reason = 'released') {
  if (!bedId) return;
  await Bed.updateOne(tenantFilter(req, { id: Number(bedId) }), { $set: { status: 'available', patient_id: null, ipd_id: null, last_release_reason: reason, released_at: new Date() } });
}

async function occupyBed(req, bed, admission, reason = 'occupied') {
  if (!bed) return;
  await Bed.updateOne(tenantFilter(req, { id: Number(bed.id) }), {
    $set: {
      status: 'occupied',
      patient_id: String(admission.patient_id),
      ipd_id: Number(admission.id),
      last_occupied_reason: reason,
      occupied_at: new Date(),
    },
  });
}

async function enrichIpdRows(req, rows) {
  const plain = await withNames(req, rows);
  const bedIds = [...new Set(plain.map((x) => Number(x.bed_id)).filter(Boolean))];
  const beds = bedIds.length ? await Bed.find(tenantFilter(req, { id: { $in: bedIds } })).lean() : [];
  const bm = Object.fromEntries(beds.map((b) => [String(b.id), b]));
  return plain.map((x) => {
    const bed = bm[String(x.bed_id)] || {};
    return { ...x, ward: x.ward || bed.ward, bed_number: x.bed_number || bed.bed_number, bed_status: bed.status };
  });
}

router.post('/ipd/admit', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const validationErrors = validateIpdAdmission(req.body);
  if (validationErrors.length) return res.status(400).json({ message: validationErrors.join(', '), errors: validationErrors });

  const patientId = String(req.body.patient_id);
  const patient = await Patient.findOne({
    $and: [
      tenantFilter(req),
      { $or: [{ id: Number(patientId) || -1 }, { patient_id: patientId }] },
    ],
  }).lean();
  if (!patient) return res.status(404).json({ message: 'Patient not found for admission' });

  const activeAdmission = await IpdAdmission.findOne(tenantFilter(req, { patient_id: { $in: [patientId, String(patient.id), String(patient.patient_id)] }, status: { $in: [...IPD_ACTIVE_STATUSES] } })).lean();
  if (activeAdmission) return res.status(409).json({ message: 'Patient already has an active IPD admission', ipdId: activeAdmission.id });

  const bed = await findIpdBed(req, req.body);
  if (!bed) return res.status(404).json({ message: 'Bed not found' });
  if (BED_OCCUPIED_STATUSES.has(String(bed.status || '').toLowerCase())) return res.status(409).json({ message: 'Selected bed is already occupied' });

  const payload = {
    ...req.body,
    patient_id: patientId,
    patient_uid: patient.patient_id || patientId,
    patient_name: patient.full_name,
    doctor_id: String(req.body.primary_consultant_id || req.body.doctor_id || req.body.consultant_id),
    primary_consultant_id: String(req.body.primary_consultant_id || req.body.doctor_id || req.body.consultant_id),
    bed_id: Number(bed.id),
    bed_number: bed.bed_number,
    ward: bed.ward,
    admission_date: req.body.admission_date || new Date(),
    admission_type: toText(req.body.admission_type),
    admission_reason: toText(req.body.admission_reason),
    diagnosis: toText(req.body.diagnosis),
    status: req.body.status === 'admission_requested' ? 'admission_requested' : 'admitted',
    bed_history: [{ bed_id: bed.id, ward: bed.ward, bed_number: bed.bed_number, action: 'allocated', at: new Date(), by: req.user?.id }],
  };

  const r = await IpdAdmission.create(tenantCreateData(req, payload));
  await occupyBed(req, bed, r, 'ipd_admission');
  auditEvent({ req, action: 'Admitted IPD patient', module_name: 'ipd', entity_type: 'ipd_admission', entity_id: r.id, new_value: r });
  res.status(201).json({ message: 'Patient admitted successfully', ipdId: r.id, admission: r });
}));

router.get('/ipd', requirePermission('ipd.view'), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req, { status: { $ne: 'archived' } });
  if (req.query.patient_id) filter.patient_id = String(req.query.patient_id);
  if (req.query.status) filter.status = req.query.status;
  res.json(await enrichIpdRows(req, await IpdAdmission.find(filter).sort({ admission_date: -1, id: -1 })));
}));

router.patch('/ipd/:id/status', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const existing = await IpdAdmission.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'IPD admission not found' });
  const status = toText(req.body.status);
  const allowed = ['admission_requested', 'admitted', 'under_treatment', 'discharge_initiated', 'billing_pending'];
  if (!allowed.includes(status)) return res.status(400).json({ message: `Invalid IPD status. Use: ${allowed.join(', ')}` });
  const update = { status, status_note: toText(req.body.note), status_updated_at: new Date(), status_updated_by: req.user?.id };
  await IpdAdmission.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update, $push: { status_history: { status, note: update.status_note, at: new Date(), by: req.user?.id } } });
  auditEvent({ req, action: 'Updated IPD status', module_name: 'ipd', entity_type: 'ipd_admission', entity_id: req.params.id, old_value: existing, new_value: update });
  res.json({ message: 'IPD status updated' });
}));

router.patch('/ipd/:id/transfer-bed', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const existing = await IpdAdmission.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'IPD admission not found' });
  if (!toText(req.body.reason)) return res.status(400).json({ message: 'Transfer reason is required' });
  const newBed = await findIpdBed(req, req.body);
  if (!newBed) return res.status(404).json({ message: 'New bed not found' });
  if (Number(newBed.id) === Number(existing.bed_id)) return res.status(400).json({ message: 'Patient is already allocated to this bed' });
  if (BED_OCCUPIED_STATUSES.has(String(newBed.status || '').toLowerCase())) return res.status(409).json({ message: 'New bed is already occupied' });

  await releaseBed(req, existing.bed_id, 'ipd_transfer');
  const update = { bed_id: Number(newBed.id), bed_number: newBed.bed_number, ward: newBed.ward, last_transfer_reason: toText(req.body.reason), last_transferred_at: new Date(), last_transferred_by: req.user?.id };
  await IpdAdmission.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update, $push: { bed_history: { bed_id: newBed.id, ward: newBed.ward, bed_number: newBed.bed_number, action: 'transferred', reason: update.last_transfer_reason, at: new Date(), by: req.user?.id } } });
  await occupyBed(req, newBed, { id: existing.id, patient_id: existing.patient_id }, 'ipd_transfer');
  auditEvent({ req, action: 'Transferred IPD bed', module_name: 'ipd', entity_type: 'ipd_admission', entity_id: req.params.id, old_value: existing, new_value: update });
  res.json({ message: 'Bed transfer completed' });
}));

router.post('/ipd/nursing-notes', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  if (!req.body.ipd_id) return res.status(400).json({ message: 'ipd_id is required' });
  const admission = await IpdAdmission.findOne(tenantFilter(req, { id: Number(req.body.ipd_id), status: { $ne: 'archived' } })).lean();
  if (!admission) return res.status(404).json({ message: 'IPD admission not found for nursing note' });
  const r = await NursingNote.create(tenantCreateData(req, {
    ...req.body,
    patient_id: admission.patient_id,
    ipd_id: Number(req.body.ipd_id),
    note_date: req.body.note_date || new Date(),
    vitals: req.body.vitals || null,
    status: 'active',
  }));
  auditEvent({ req, action: 'Added IPD nursing note', module_name: 'ipd', entity_type: 'nursing_note', entity_id: r.id, new_value: r });
  res.status(201).json({ message: 'Nursing note added', id: r.id });
}));

router.get('/ipd/:id/nursing-notes', requirePermission('ipd.view'), asyncHandler(async (req, res) => {
  res.json(await NursingNote.find(tenantFilter(req, { ipd_id: Number(req.params.id), status: { $ne: 'archived' } })).sort({ note_date: -1, id: -1 }));
}));

router.post('/ipd/discharge', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  if (!req.body.ipd_id) return res.status(400).json({ message: 'ipd_id is required' });
  if (!toText(req.body.discharge_summary)) return res.status(400).json({ message: 'discharge_summary is required' });
  const existing = await IpdAdmission.findOne(tenantFilter(req, { id: Number(req.body.ipd_id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'IPD admission not found' });
  const update = {
    status: 'discharged',
    discharge_date: req.body.discharge_date || new Date(),
    discharge_summary: toText(req.body.discharge_summary),
    discharge_advice: toText(req.body.discharge_advice),
    final_diagnosis: toText(req.body.final_diagnosis || existing.diagnosis),
    discharged_by: req.user?.id,
  };
  await IpdAdmission.updateOne(tenantFilter(req, { id: Number(req.body.ipd_id) }), { $set: update, $push: { status_history: { status: 'discharged', note: 'Patient discharged', at: new Date(), by: req.user?.id } } });
  await releaseBed(req, existing.bed_id, 'ipd_discharge');
  auditEvent({ req, action: 'Discharged IPD patient', module_name: 'ipd', entity_type: 'ipd_admission', entity_id: req.body.ipd_id, old_value: existing, new_value: update });
  res.json({ message: 'Patient discharged successfully' });
}));

router.delete('/ipd/:id', requirePermission('ipd.create'), asyncHandler(async (req, res) => {
  const existing = await IpdAdmission.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!existing || existing.status === 'archived') return res.status(404).json({ message: 'IPD admission not found' });
  if (!toText(req.body?.reason || req.query.reason)) return res.status(400).json({ message: 'Archive reason is required' });
  const update = { status: 'archived', archived_at: new Date(), archived_by: req.user?.id, archive_reason: toText(req.body?.reason || req.query.reason) };
  await IpdAdmission.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await releaseBed(req, existing.bed_id, 'ipd_archive');
  auditEvent({ req, action: 'Archived IPD admission', module_name: 'ipd', entity_type: 'ipd_admission', entity_id: req.params.id, old_value: existing, new_value: update });
  res.json({ message: 'IPD admission archived' });
}));

module.exports = router;
