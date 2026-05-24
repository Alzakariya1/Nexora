require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/db');
const { Appointment, Doctor, Patient, AppointmentTokenCounter } = require('../src/models');

function publicDoctorId(doctor) {
  return String(doctor?.id || doctor?.doctor_id || '').trim();
}

function publicPatientId(patient) {
  return String(patient?.id || patient?.patient_id || '').trim();
}

function parseSeq(token) {
  const suffix = String(token || '').split('-').pop();
  const n = Number(String(suffix || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function tokenFor(date, seq) {
  const key = String(date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `${key}-${String(seq).padStart(3, '0')}`;
}

async function main() {
  await connectDB();

  const doctors = await Doctor.find({}).lean();
  const patients = await Patient.find({}).lean();

  const doctorMap = new Map();
  for (const d of doctors) {
    [d.id, d.doctor_id, d._id].filter(Boolean).forEach((v) => doctorMap.set(String(v), d));
  }

  const patientMap = new Map();
  for (const p of patients) {
    [p.id, p.patient_id, p._id].filter(Boolean).forEach((v) => patientMap.set(String(v), p));
  }

  const appointments = await Appointment.find({ status: { $ne: 'archived' } }).sort({ appointment_date: 1, id: 1 });
  let referenceFixes = 0;
  for (const appt of appointments) {
    const doctor = doctorMap.get(String(appt.doctor_id || ''));
    const patient = patientMap.get(String(appt.patient_id || ''));
    const updates = {};
    if (doctor && String(appt.doctor_id || '') !== publicDoctorId(doctor)) updates.doctor_id = publicDoctorId(doctor);
    if (patient && String(appt.patient_id || '') !== publicPatientId(patient)) updates.patient_id = publicPatientId(patient);
    if (Object.keys(updates).length) {
      await Appointment.updateOne({ _id: appt._id }, { $set: updates });
      referenceFixes += 1;
    }
  }

  const refreshed = await Appointment.find({ status: { $ne: 'archived' } }).sort({ appointment_date: 1, id: 1 });
  const grouped = new Map();
  for (const appt of refreshed) {
    const hospitalId = Number(appt.hospital_id || 1);
    const date = String(appt.appointment_date || new Date().toISOString().slice(0, 10));
    const key = `${hospitalId}::${date}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(appt);
  }

  let tokenFixes = 0;
  for (const [key, rows] of grouped.entries()) {
    rows.sort((a, b) => {
      const seqA = Number(a.token_sequence || 0) || parseSeq(a.token_number) || Number(a.id || 0);
      const seqB = Number(b.token_sequence || 0) || parseSeq(b.token_number) || Number(b.id || 0);
      return seqA - seqB || String(a.appointment_time || '').localeCompare(String(b.appointment_time || '')) || Number(a.id || 0) - Number(b.id || 0);
    });

    const [hospitalIdText, date] = key.split('::');
    const hospital_id = Number(hospitalIdText || 1);
    let seq = 1;
    for (const row of rows) {
      const expectedToken = tokenFor(date, seq);
      if (row.token_sequence !== seq || row.token_number !== expectedToken) {
        await Appointment.updateOne({ _id: row._id }, { $set: { token_sequence: seq, token_number: expectedToken } });
        tokenFixes += 1;
      }
      seq += 1;
    }

    await AppointmentTokenCounter.findOneAndUpdate(
      { hospital_id, appointment_date: date },
      { $set: { seq: rows.length } },
      { upsert: true, new: true }
    );
  }

  console.log(JSON.stringify({ ok: true, referenceFixes, tokenFixes, groups: grouped.size }, null, 2));
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Phase 3 consistency repair failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
