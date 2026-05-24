require('dotenv').config();
const connectDB = require('../src/config/db');
const { Patient, Doctor, LabTest, RadiologyTest, Billing, PharmacySale } = require('../src/models');

const clean = (value) => String(value ?? '').trim();
const numeric = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function candidates(value) {
  const raw = clean(value);
  const n = numeric(raw);
  const list = [];
  if (n !== null) list.push({ id: n });
  if (raw) list.push({ patient_id: raw }, { patient_uid: raw });
  return list;
}

function doctorCandidates(value) {
  const raw = clean(value);
  const n = numeric(raw);
  const list = [];
  if (n !== null) list.push({ id: n });
  if (raw) list.push({ doctor_id: raw });
  return list;
}

async function resolvePatient(value, hospitalId) {
  const or = candidates(value);
  if (!or.length) return null;
  return Patient.findOne({ hospital_id: hospitalId, $or: or }).lean();
}

async function resolveDoctor(value, hospitalId) {
  const or = doctorCandidates(value);
  if (!or.length) return null;
  return Doctor.findOne({ hospital_id: hospitalId, $or: or }).lean();
}

async function repairCollection(Model, name, statusField) {
  const rows = await Model.find({}).lean();
  let scanned = 0;
  let repaired = 0;
  let missingPatient = 0;
  let missingDoctor = 0;

  for (const row of rows) {
    scanned += 1;
    const set = {};
    const hospitalId = row.hospital_id || 1;
    const patient = await resolvePatient(row.patient_id || row.patient_uid, hospitalId);
    if (patient) {
      const canonicalPatientId = clean(patient.id || patient.patient_id || patient.patient_uid);
      if (clean(row.patient_id) !== canonicalPatientId) set.patient_id = canonicalPatientId;
      if (!clean(row.patient_uid) && patient.patient_uid) set.patient_uid = patient.patient_uid;
      if (!clean(row.patient_name) && patient.full_name) set.patient_name = patient.full_name;
    } else if (row.patient_id) {
      missingPatient += 1;
    }

    const doctor = await resolveDoctor(row.doctor_id, hospitalId);
    if (doctor) {
      const canonicalDoctorId = clean(doctor.id || doctor.doctor_id);
      if (clean(row.doctor_id) !== canonicalDoctorId) set.doctor_id = canonicalDoctorId;
      if (!clean(row.doctor_name) && doctor.full_name) set.doctor_name = doctor.full_name;
    } else if (row.doctor_id) {
      missingDoctor += 1;
    }

    if (statusField && !clean(row[statusField])) set[statusField] = 'ordered';

    if (Object.keys(set).length) {
      await Model.updateOne({ _id: row._id }, { $set: set });
      repaired += 1;
    }
  }

  return { name, scanned, repaired, missingPatient, missingDoctor };
}

async function main() {
  await connectDB();
  const results = [];
  results.push(await repairCollection(LabTest, 'lab_tests', 'test_status'));
  results.push(await repairCollection(RadiologyTest, 'radiology_tests', 'status'));
  results.push(await repairCollection(Billing, 'billing', null));
  results.push(await repairCollection(PharmacySale, 'pharmacy_sales', null));
  console.table(results);
  console.log('Phase 6 clinical module consistency completed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Phase 6 clinical consistency failed:', error);
  process.exit(1);
});
