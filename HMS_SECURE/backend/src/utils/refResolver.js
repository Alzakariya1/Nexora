const mongoose = require('mongoose');
const { Patient, Doctor, Appointment } = require('../models');
const { tenantFilter } = require('../middleware/tenant');

function clean(value) {
  return String(value ?? '').trim();
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(clean(value)) && /^[a-fA-F0-9]{24}$/.test(clean(value));
}

function identityLookup(identifier, customField) {
  const raw = clean(identifier);
  const numeric = Number(raw);
  const or = [];
  if (raw && Number.isFinite(numeric)) or.push({ id: numeric });
  if (raw && customField) or.push({ [customField]: raw });
  if (raw && isObjectId(raw)) or.push({ _id: raw });
  return or.length ? { $or: or } : null;
}

function publicPatientId(patient) {
  return clean(patient?.id || patient?.patient_id || patient?.patient_uid);
}

function publicDoctorId(doctor) {
  return clean(doctor?.id || doctor?.doctor_id);
}

async function resolvePatient(req, identifier, { required = true, includeArchived = false } = {}) {
  const lookup = identityLookup(identifier, 'patient_id');
  if (!lookup) {
    if (!required) return null;
    const err = new Error('Valid patient_id is required');
    err.status = 400;
    throw err;
  }
  const active = includeArchived ? {} : { status: { $ne: 'archived' }, deleted_at: { $exists: false } };
  const patient = await Patient.findOne({ $and: [tenantFilter(req), active, lookup] }).lean();
  if (!patient && required) {
    const err = new Error(`Patient not found for identifier: ${clean(identifier)}`);
    err.status = 404;
    throw err;
  }
  return patient;
}

async function resolveDoctor(req, identifier, { required = false, includeArchived = false } = {}) {
  const lookup = identityLookup(identifier, 'doctor_id');
  if (!lookup) {
    if (!required) return null;
    const err = new Error('Valid doctor_id is required');
    err.status = 400;
    throw err;
  }
  const active = includeArchived ? {} : { status: { $ne: 'archived' }, deleted_at: { $exists: false } };
  const doctor = await Doctor.findOne({ $and: [tenantFilter(req), active, lookup] }).lean();
  if (!doctor && required) {
    const err = new Error(`Doctor not found for identifier: ${clean(identifier)}`);
    err.status = 404;
    throw err;
  }
  return doctor;
}

async function resolveAppointment(req, identifier, { required = false } = {}) {
  const raw = clean(identifier);
  if (!raw) {
    if (!required) return null;
    const err = new Error('Valid appointment_id is required');
    err.status = 400;
    throw err;
  }
  const numeric = Number(raw);
  const query = Number.isFinite(numeric) ? { id: numeric } : isObjectId(raw) ? { _id: raw } : null;
  if (!query) {
    if (!required) return null;
    const err = new Error('Valid appointment_id is required');
    err.status = 400;
    throw err;
  }
  const appointment = await Appointment.findOne(tenantFilter(req, query)).lean();
  if (!appointment && required) {
    const err = new Error(`Appointment not found for identifier: ${raw}`);
    err.status = 404;
    throw err;
  }
  return appointment;
}

async function normalizeClinicalReferences(req, body = {}, { requirePatient = true, requireDoctor = false, allowAppointmentHydration = true } = {}) {
  const normalized = { ...body };
  const appointment = allowAppointmentHydration && body.appointment_id
    ? await resolveAppointment(req, body.appointment_id, { required: false })
    : null;

  const patient = await resolvePatient(req, body.patient_id || appointment?.patient_id, { required: requirePatient });
  const doctor = await resolveDoctor(req, body.doctor_id || appointment?.doctor_id, { required: requireDoctor });

  if (patient) {
    normalized.patient_id = publicPatientId(patient);
    normalized.patient_uid = patient.patient_uid || normalized.patient_uid || '';
    normalized.patient_name = patient.full_name || patient.name || normalized.patient_name || '';
  }
  if (doctor) {
    normalized.doctor_id = publicDoctorId(doctor);
    normalized.doctor_name = doctor.full_name || doctor.name || normalized.doctor_name || '';
  }
  if (appointment) {
    normalized.appointment_id = appointment.id;
  } else if (body.appointment_id) {
    const n = Number(body.appointment_id);
    normalized.appointment_id = Number.isFinite(n) ? n : undefined;
  }
  return { normalized, patient, doctor, appointment };
}

module.exports = {
  clean,
  identityLookup,
  publicPatientId,
  publicDoctorId,
  resolvePatient,
  resolveDoctor,
  resolveAppointment,
  normalizeClinicalReferences,
};
