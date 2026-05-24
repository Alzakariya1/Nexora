require('dotenv').config();
const { connectDB } = require('../src/config/db');
const { Doctor, Patient, Appointment, AppointmentTokenCounter } = require('../src/models');

function datePrefix(date) {
  return String(date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
}

function suffix(token) {
  const raw = String(token || '');
  const last = raw.includes('-') ? raw.split('-').pop() : raw;
  const n = Number(String(last || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main() {
  await connectDB();
  const doctors = await Doctor.find({}).lean();
  const patients = await Patient.find({}).lean();
  const doctorByAny = new Map();
  const patientByAny = new Map();

  for (const d of doctors) {
    if (d.id) doctorByAny.set(String(d.id), String(d.id));
    if (d.doctor_id) doctorByAny.set(String(d.doctor_id), String(d.id || d.doctor_id));
  }
  for (const p of patients) {
    if (p.id) patientByAny.set(String(p.id), String(p.id));
    if (p.patient_id) patientByAny.set(String(p.patient_id), String(p.id || p.patient_id));
  }

  const appts = await Appointment.find({ status: { $ne: 'archived' } }).sort({ appointment_date: 1, id: 1 });
  const counters = new Map();
  let updated = 0;

  for (const appt of appts) {
    const set = {};
    const d = doctorByAny.get(String(appt.doctor_id || ''));
    const p = patientByAny.get(String(appt.patient_id || ''));
    if (d && String(appt.doctor_id) !== d) set.doctor_id = d;
    if (p && String(appt.patient_id) !== p) set.patient_id = p;

    const prefix = datePrefix(appt.appointment_date);
    const key = `${appt.hospital_id || 1}:${appt.appointment_date || ''}`;
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    const desiredToken = `${prefix}-${String(next).padStart(3, '0')}`;
    if (appt.token_number !== desiredToken) set.token_number = desiredToken;
    if (Number(appt.token_sequence || 0) !== next) set.token_sequence = next;

    if (Object.keys(set).length) {
      await Appointment.updateOne({ _id: appt._id }, { $set: set });
      updated += 1;
    }
  }

  let counterUpdated = 0;
  for (const [key, seq] of counters.entries()) {
    const [hospitalId, appointmentDate] = key.split(':');
    await AppointmentTokenCounter.findOneAndUpdate(
      { hospital_id: Number(hospitalId || 1), appointment_date: appointmentDate },
      { $set: { hospital_id: Number(hospitalId || 1), appointment_date: appointmentDate, seq } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    counterUpdated += 1;
  }

  console.log(`Stabilization complete. Appointments updated: ${updated}. Token counters synced: ${counterUpdated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Stabilization failed:', err);
  process.exit(1);
});
