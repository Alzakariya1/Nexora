require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/db');
const {
  Patient,
  Appointment,
  Billing,
  LabTest,
  RadiologyTest,
  IpdAdmission,
  PharmacySale,
  ClinicalRecord,
  InsuranceClaim,
  NursingNote,
} = require('../src/models');

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function publicPatientId(patient) {
  return clean(patient?.id || patient?.patient_id || patient?.patient_uid);
}

function storageFromUrl(url) {
  if (!url) return '';
  return String(url).startsWith('data:') ? 'database' : 'cloudinary';
}

async function updateCollectionReferences(Model, modelName, patientMap) {
  if (!Model?.find) return 0;
  const rows = await Model.find({ patient_id: { $exists: true, $ne: null } });
  let fixes = 0;
  for (const row of rows) {
    const current = clean(row.patient_id);
    const patient = patientMap.get(current);
    if (!patient) continue;
    const normalized = publicPatientId(patient);
    if (normalized && current !== normalized) {
      await Model.updateOne({ _id: row._id }, { $set: { patient_id: normalized } });
      fixes += 1;
    }
  }
  return fixes;
}

async function main() {
  await connectDB();

  const patients = await Patient.find({});
  const patientMap = new Map();
  let normalizedPatients = 0;
  let duplicateWarnings = 0;
  const patientIdUniq = new Set();

  for (const patient of patients) {
    const update = {};
    const hospitalId = Number(patient.hospital_id || 1);
    const patientId = clean(patient.patient_id);
    const uniqKey = `${hospitalId}::${patientId}`;

    if (patientId && patientIdUniq.has(uniqKey)) duplicateWarnings += 1;
    if (patientId) patientIdUniq.add(uniqKey);

    if (!patient.patient_uid) update.patient_uid = `PAT-${patient.id || Date.now()}`;
    if (!Array.isArray(patient.documents)) update.documents = [];
    else {
      const docs = patient.documents.map((doc) => ({
        title: clean(doc.title) || clean(doc.file_name) || 'Patient Document',
        category: clean(doc.category) || 'medical',
        document_type: clean(doc.document_type) || 'Other',
        notes: clean(doc.notes),
        file_name: clean(doc.file_name) || clean(doc.title) || 'document',
        file_type: clean(doc.file_type),
        file_size: Number(doc.file_size || 0),
        file_url: doc.file_url || '',
        file_public_id: doc.file_public_id || '',
        storage: clean(doc.storage) || storageFromUrl(doc.file_url) || 'database',
        uploaded_at: doc.uploaded_at || patient.created_at || new Date(),
      }));
      if (JSON.stringify(docs) !== JSON.stringify(patient.documents)) update.documents = docs;
    }

    if (patient.profile_image_url && !patient.profile_image_storage) {
      update.profile_image_storage = storageFromUrl(patient.profile_image_url) || 'database';
    }

    if (Object.keys(update).length) {
      await Patient.updateOne({ _id: patient._id }, { $set: update });
      normalizedPatients += 1;
    }

    [patient.id, patient.patient_id, patient.patient_uid, patient._id].filter(Boolean).forEach((v) => {
      patientMap.set(clean(v), patient);
    });
  }

  const referenceFixes = {};
  const collections = [
    [Appointment, 'appointments'],
    [Billing, 'billing'],
    [LabTest, 'lab_tests'],
    [RadiologyTest, 'radiology_tests'],
    [IpdAdmission, 'ipd_admissions'],
    [PharmacySale, 'pharmacy_sales'],
    [ClinicalRecord, 'clinical_records'],
    [InsuranceClaim, 'insurance_claims'],
    [NursingNote, 'nursing_notes'],
  ];

  for (const [Model, name] of collections) {
    referenceFixes[name] = await updateCollectionReferences(Model, name, patientMap);
  }

  console.log(JSON.stringify({ ok: true, normalizedPatients, duplicateWarnings, referenceFixes }, null, 2));
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Phase 5 patient consistency repair failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
