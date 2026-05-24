const express = require('express');
const { Patient, Doctor, DoctorSchedule, Appointment, OpdRecord, Prescription, Billing, LabTest, RadiologyTest, IpdAdmission } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../middleware/auth');
const { attachTenant, tenantFilter } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);

function isStaff(user) {
  return ['super_admin', 'admin', 'hospital_admin', 'receptionist', 'nurse'].includes(user?.role);
}

function identityFilter(entity, field) {
  const values = [entity?.[field], entity?.id].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  const stringValues = values.map((v) => String(v));
  const numericValues = values.map(Number).filter((n) => Number.isFinite(n));
  return { $or: [{ [field]: { $in: stringValues } }, { [field]: { $in: numericValues } }] };
}

function byDateDesc(a, b) {
  const da = new Date(a.date || a.appointment_date || a.visit_date || a.created_at || 0).getTime();
  const db = new Date(b.date || b.appointment_date || b.visit_date || b.created_at || 0).getTime();
  return db - da;
}

async function findPatientForUser(req) {
  const queryPatientId = req.query.patient_id;
  const canPick = isStaff(req.user);
  const lookup = [];
  if (canPick && queryPatientId) {
    lookup.push({ id: Number(queryPatientId) }, { patient_id: String(queryPatientId) });
  }
  lookup.push(
    { email: req.user.email },
    { user_id: req.user.id },
    { patient_user_id: req.user.id },
    { phone: req.user.phone },
  );
  return Patient.findOne(tenantFilter(req, { $or: lookup.filter((item) => Object.values(item)[0]) })).lean();
}

async function findDoctorForUser(req) {
  const queryDoctorId = req.query.doctor_id;
  const canPick = isStaff(req.user) || ['doctor'].includes(req.user?.role);
  const lookup = [];
  if (canPick && queryDoctorId) {
    lookup.push({ id: Number(queryDoctorId) }, { doctor_id: String(queryDoctorId) });
  }
  lookup.push(
    { email: req.user.email },
    { user_id: req.user.id },
    { doctor_user_id: req.user.id },
    { phone: req.user.phone },
  );
  return Doctor.findOne(tenantFilter(req, { $or: lookup.filter((item) => Object.values(item)[0]) })).lean();
}

router.get('/portal/patient', asyncHandler(async (req, res) => {
  const patient = await findPatientForUser(req);
  if (!patient) {
    return res.json({
      patient: null,
      message: 'No patient profile is linked to this login yet. Match the patient email/phone with the login user or select a patient as staff.',
      appointments: [], prescriptions: [], bills: [], labReports: [], radiologyReports: [], admissions: [], documents: [], timeline: [], summary: {}
    });
  }

  const filter = tenantFilter(req, identityFilter(patient, 'patient_id'));
  const [appointments, prescriptions, bills, labReports, radiologyReports, admissions, opdRecords] = await Promise.all([
    Appointment.find(filter).sort({ appointment_date: -1, appointment_time: -1, id: -1 }).limit(50).lean(),
    Prescription.find(filter).sort({ created_at: -1, id: -1 }).limit(50).lean(),
    Billing.find(filter).sort({ billing_date: -1, created_at: -1, id: -1 }).limit(50).lean(),
    LabTest.find(filter).sort({ created_at: -1, id: -1 }).limit(50).lean(),
    RadiologyTest.find(filter).sort({ created_at: -1, id: -1 }).limit(50).lean(),
    IpdAdmission.find(filter).sort({ admission_date: -1, id: -1 }).limit(20).lean(),
    OpdRecord.find(filter).sort({ visit_date: -1, created_at: -1, id: -1 }).limit(50).lean(),
  ]);

  const timeline = [
    ...appointments.map((x) => ({ type: 'appointment', title: x.appointment_type || 'Appointment', status: x.status, date: x.appointment_date || x.created_at, payload: x })),
    ...opdRecords.map((x) => ({ type: 'opd', title: 'OPD Consultation', status: x.status, date: x.visit_date || x.created_at, payload: x })),
    ...prescriptions.map((x) => ({ type: 'prescription', title: x.prescription_number || 'Prescription', status: x.status, date: x.created_at, payload: x })),
    ...bills.map((x) => ({ type: 'billing', title: x.invoice_number || 'Bill', status: x.payment_status || x.status, date: x.billing_date || x.created_at, payload: x })),
    ...labReports.map((x) => ({ type: 'lab', title: x.test_name || 'Lab Test', status: x.test_status, date: x.created_at, payload: x })),
    ...radiologyReports.map((x) => ({ type: 'radiology', title: x.scan_name || 'Radiology Scan', status: x.status, date: x.created_at, payload: x })),
    ...(patient.documents || []).map((x) => ({ type: 'document', title: x.title || x.file_name || 'Document', status: x.document_type, date: x.uploaded_at, payload: x })),
  ].sort(byDateDesc).slice(0, 80);

  res.json({
    patient,
    appointments,
    prescriptions,
    bills,
    labReports,
    radiologyReports,
    admissions,
    documents: patient.documents || [],
    timeline,
    summary: {
      appointments: appointments.length,
      prescriptions: prescriptions.length,
      bills: bills.length,
      pendingBills: bills.filter((b) => ['pending', 'unpaid', 'partial'].includes(String(b.payment_status || b.status || '').toLowerCase())).length,
      labReports: labReports.length,
      radiologyReports: radiologyReports.length,
      documents: (patient.documents || []).length,
    },
  });
}));

router.get('/portal/doctor', asyncHandler(async (req, res) => {
  const doctor = await findDoctorForUser(req);
  if (!doctor) {
    return res.json({
      doctor: null,
      message: 'No doctor profile is linked to this login yet. Match the doctor email/phone with the login user or select a doctor as staff.',
      todayAppointments: [], upcomingAppointments: [], consultations: [], labOrders: [], radiologyOrders: [], schedule: null, summary: {}
    });
  }

  const filter = tenantFilter(req, identityFilter(doctor, 'doctor_id'));
  const today = new Date().toISOString().slice(0, 10);
  const [appointments, consultations, labOrders, radiologyOrders, schedule] = await Promise.all([
    Appointment.find(filter).sort({ appointment_date: 1, appointment_time: 1, id: 1 }).limit(100).lean(),
    OpdRecord.find(filter).sort({ visit_date: -1, created_at: -1, id: -1 }).limit(50).lean(),
    LabTest.find(filter).sort({ created_at: -1, id: -1 }).limit(50).lean(),
    RadiologyTest.find(filter).sort({ created_at: -1, id: -1 }).limit(50).lean(),
    DoctorSchedule.findOne(tenantFilter(req, { $or: [{ doctor_ref_id: doctor.id }, { doctor_id: String(doctor.doctor_id || doctor.id) }] })).lean(),
  ]);

  const todayAppointments = appointments.filter((a) => a.appointment_date === today);
  const upcomingAppointments = appointments.filter((a) => String(a.appointment_date || '') >= today).slice(0, 30);
  const activeQueue = todayAppointments.filter((a) => ['scheduled', 'checked_in', 'in_consultation'].includes(a.status || 'scheduled'));

  res.json({
    doctor,
    schedule,
    todayAppointments,
    upcomingAppointments,
    activeQueue,
    consultations,
    labOrders,
    radiologyOrders,
    certificates: doctor.certificates || [],
    summary: {
      today: todayAppointments.length,
      waiting: todayAppointments.filter((a) => a.status === 'checked_in').length,
      inConsultation: todayAppointments.filter((a) => a.status === 'in_consultation').length,
      completed: todayAppointments.filter((a) => a.status === 'completed').length,
      consultations: consultations.length,
      labOrders: labOrders.length,
      radiologyOrders: radiologyOrders.length,
    },
  });
}));

module.exports = router;
