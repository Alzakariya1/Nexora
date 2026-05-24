const express = require('express');
const {
  Patient,
  Doctor,
  DoctorSchedule,
  Appointment,
  OpdRecord,
  Prescription,
  Billing,
  LabTest,
  RadiologyTest,
  IpdAdmission,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../middleware/auth');
const { attachTenant, tenantFilter } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const STAFF_PORTAL_ROLES = ['super_admin', 'admin', 'hospital_admin', 'receptionist', 'nurse'];
const DOCTOR_PORTAL_ROLES = ['doctor', 'portal_doctor'];
const PATIENT_PORTAL_ROLES = ['patient', 'portal_patient'];

function isStaff(user) {
  return STAFF_PORTAL_ROLES.includes(user?.role);
}

function isPatientPortalUser(user) {
  return PATIENT_PORTAL_ROLES.includes(user?.role);
}

function isDoctorPortalUser(user) {
  return DOCTOR_PORTAL_ROLES.includes(user?.role);
}

function cleanId(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function identityFilter(entity, field) {
  const values = [entity?.[field], entity?.id].map(cleanId).filter(Boolean);
  const numericValues = values.map(Number).filter((n) => Number.isFinite(n));
  return { $or: [{ [field]: { $in: values } }, { [field]: { $in: numericValues } }] };
}

function byDateDesc(a, b) {
  const da = new Date(a.date || a.appointment_date || a.visit_date || a.created_at || 0).getTime();
  const db = new Date(b.date || b.appointment_date || b.visit_date || b.created_at || 0).getTime();
  return db - da;
}

function redactPatient(patient = {}) {
  if (!patient) return null;
  const clone = JSON.parse(JSON.stringify(patient));
  delete clone.deleted_at;
  delete clone.deleted_by;
  return clone;
}

function redactClinicalRecord(record = {}) {
  const clone = JSON.parse(JSON.stringify(record));
  delete clone.internal_notes;
  delete clone.deleted_by;
  delete clone.deleted_at;
  delete clone.archive_reason;
  delete clone.last_edit_reason;
  return clone;
}

function billBalance(bill = {}) {
  const due = Number(bill.due_amount ?? 0);
  if (Number.isFinite(due) && due > 0) return due;
  const total = Number(bill.total_amount ?? bill.amount ?? 0);
  const paid = Number(bill.paid_amount ?? 0);
  return Math.max(total - paid, 0);
}

function documentUrl(doc = {}) {
  return doc.file_url || doc.report_pdf_url || doc.report_file || doc.image_file || doc.pacs_viewer_url || null;
}

function normalizePortalDocument(doc = {}, source = 'document') {
  return {
    source,
    title: doc.title || doc.test_name || doc.scan_name || doc.file_name || doc.invoice_number || 'Document',
    category: doc.category || doc.document_type || doc.test_category || doc.scan_category || source,
    status: doc.status || doc.test_status || doc.payment_status || 'available',
    uploaded_at: doc.uploaded_at || doc.approved_at || doc.completed_at || doc.reported_at || doc.billing_date || doc.created_at || null,
    file_name: doc.file_name || doc.invoice_number || null,
    file_type: doc.file_type || null,
    file_size: doc.file_size || null,
    url: documentUrl(doc),
    open_allowed: Boolean(documentUrl(doc)),
    record_id: doc.id || null,
  };
}

function denyPatientSpoof(req, res) {
  auditEvent({
    req,
    action: 'Patient portal patient_id override denied',
    module_name: 'patient_portal',
    status: 'denied',
    severity: 'warning',
    metadata: { requested_patient_id: req.query.patient_id || req.params.patient_id || null },
  });
  return res.status(403).json({ message: 'Patient portal users can view only their own linked patient record.' });
}

function denyDoctorSpoof(req, res) {
  auditEvent({
    req,
    action: 'Doctor portal doctor_id override denied',
    module_name: 'doctor_portal',
    status: 'denied',
    severity: 'warning',
    metadata: { requested_doctor_id: req.query.doctor_id || req.params.doctor_id || null },
  });
  return res.status(403).json({ message: 'Doctor portal users can view only their own linked doctor workspace.' });
}

async function findPatientForUser(req, res = null) {
  const queryPatientId = cleanId(req.query.patient_id);
  const canPick = isStaff(req.user);
  if (queryPatientId && !canPick) {
    if (res) denyPatientSpoof(req, res);
    return null;
  }

  const lookup = [];
  if (canPick && queryPatientId) {
    lookup.push({ id: Number(queryPatientId) }, { patient_id: String(queryPatientId) });
  }
  lookup.push(
    { email: req.user.email },
    { user_id: req.user.id },
    { patient_user_id: req.user.id },
    { portal_user_id: req.user.id },
    { phone: req.user.phone },
  );
  return Patient.findOne(tenantFilter(req, { $or: lookup.filter((item) => Object.values(item)[0]) })).lean();
}

async function findDoctorForUser(req, res = null) {
  const queryDoctorId = cleanId(req.query.doctor_id);
  const canPick = isStaff(req.user);
  if (queryDoctorId && !canPick) {
    if (res) denyDoctorSpoof(req, res);
    return null;
  }

  const lookup = [];
  if (canPick && queryDoctorId) {
    lookup.push({ id: Number(queryDoctorId) }, { doctor_id: String(queryDoctorId) });
  }
  lookup.push(
    { email: req.user.email },
    { user_id: req.user.id },
    { doctor_user_id: req.user.id },
    { portal_user_id: req.user.id },
    { phone: req.user.phone },
  );
  return Doctor.findOne(tenantFilter(req, { $or: lookup.filter((item) => Object.values(item)[0]) })).lean();
}

async function loadPatientPortalPayload(req, res) {
  const patient = await findPatientForUser(req, res);
  if (!patient) {
    return {
      patient: null,
      message: 'No patient profile is linked to this login yet. Match the patient email/phone/user ID with the login user, or select a patient as authorized staff.',
      appointments: [], prescriptions: [], bills: [], labReports: [], radiologyReports: [], admissions: [], documents: [], timeline: [], summary: {}, access: {}
    };
  }

  const filter = tenantFilter(req, identityFilter(patient, 'patient_id'));
  const [appointments, prescriptions, bills, labReports, radiologyReports, admissions, opdRecords] = await Promise.all([
    Appointment.find(filter).sort({ appointment_date: -1, appointment_time: -1, id: -1 }).limit(80).lean(),
    Prescription.find(filter).sort({ created_at: -1, id: -1 }).limit(80).lean(),
    Billing.find(filter).sort({ billing_date: -1, created_at: -1, id: -1 }).limit(80).lean(),
    LabTest.find(filter).sort({ created_at: -1, id: -1 }).limit(80).lean(),
    RadiologyTest.find(filter).sort({ created_at: -1, id: -1 }).limit(80).lean(),
    IpdAdmission.find(filter).sort({ admission_date: -1, id: -1 }).limit(30).lean(),
    OpdRecord.find(filter).sort({ visit_date: -1, created_at: -1, id: -1 }).limit(80).lean(),
  ]);

  const safePatient = redactPatient(patient);
  const safeAppointments = appointments.map(redactClinicalRecord);
  const safePrescriptions = prescriptions.map(redactClinicalRecord);
  const safeBills = bills.map(redactClinicalRecord);
  const safeLabReports = labReports.map(redactClinicalRecord);
  const safeRadiologyReports = radiologyReports.map(redactClinicalRecord);
  const safeAdmissions = admissions.map(redactClinicalRecord);
  const safeOpdRecords = opdRecords.map(redactClinicalRecord);

  const documentVault = [
    ...(safePatient.documents || []).map((doc) => normalizePortalDocument(doc, 'patient_document')),
    ...safeLabReports.filter((x) => documentUrl(x)).map((doc) => normalizePortalDocument(doc, 'lab_report')),
    ...safeRadiologyReports.filter((x) => documentUrl(x)).map((doc) => normalizePortalDocument(doc, 'radiology_report')),
    ...safeBills.map((doc) => normalizePortalDocument({ ...doc, file_name: doc.invoice_number || `Bill #${doc.id}` }, 'bill_receipt')),
  ].sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));

  const timeline = [
    ...safeAppointments.map((x) => ({ type: 'appointment', title: x.appointment_type || 'Appointment', status: x.status, date: x.appointment_date || x.created_at, payload: x })),
    ...safeOpdRecords.map((x) => ({ type: 'opd', title: x.final_diagnosis || x.provisional_diagnosis || 'OPD Consultation', status: x.status, date: x.visit_date || x.created_at, payload: x })),
    ...safePrescriptions.map((x) => ({ type: 'prescription', title: x.prescription_number || 'Prescription', status: x.status, date: x.created_at, payload: x })),
    ...safeBills.map((x) => ({ type: 'billing', title: x.invoice_number || 'Bill', status: x.payment_status || x.status, date: x.billing_date || x.created_at, payload: x })),
    ...safeLabReports.map((x) => ({ type: 'lab', title: x.test_name || 'Lab Test', status: x.test_status, date: x.created_at, payload: x })),
    ...safeRadiologyReports.map((x) => ({ type: 'radiology', title: x.scan_name || 'Radiology Scan', status: x.status, date: x.created_at, payload: x })),
    ...documentVault.map((x) => ({ type: 'document', title: x.title, status: x.status || x.category, date: x.uploaded_at, payload: x })),
  ].sort(byDateDesc).slice(0, 120);

  const pendingBills = safeBills.filter((b) => ['pending', 'unpaid', 'partial'].includes(String(b.payment_status || b.status || '').toLowerCase()) || billBalance(b) > 0);
  const reportReady = [...safeLabReports, ...safeRadiologyReports].filter((r) => documentUrl(r) || ['completed', 'approved', 'reported'].includes(String(r.test_status || r.status || '').toLowerCase()));
  const upcoming = safeAppointments.filter((a) => ['scheduled', 'checked_in', 'in_consultation'].includes(a.status || 'scheduled'));

  auditEvent({
    req,
    action: 'Patient portal viewed',
    module_name: 'patient_portal',
    entity_type: 'patient',
    entity_id: safePatient.id || safePatient.patient_id,
    metadata: { self_service: isPatientPortalUser(req.user), staff_view: isStaff(req.user), selected_patient: Boolean(req.query.patient_id) },
  });

  return {
    patient: safePatient,
    appointments: safeAppointments,
    prescriptions: safePrescriptions,
    bills: safeBills,
    labReports: safeLabReports,
    radiologyReports: safeRadiologyReports,
    admissions: safeAdmissions,
    opdRecords: safeOpdRecords,
    documents: safePatient.documents || [],
    documentVault,
    timeline,
    access: {
      self_service: isPatientPortalUser(req.user),
      staff_view: isStaff(req.user),
      own_data_only: !isStaff(req.user),
      downloadable_documents: documentVault.filter((d) => d.open_allowed).length,
    },
    summary: {
      appointments: safeAppointments.length,
      upcomingAppointments: upcoming.length,
      prescriptions: safePrescriptions.length,
      bills: safeBills.length,
      pendingBills: pendingBills.length,
      outstandingAmount: pendingBills.reduce((sum, b) => sum + billBalance(b), 0),
      labReports: safeLabReports.length,
      radiologyReports: safeRadiologyReports.length,
      readyReports: reportReady.length,
      admissions: safeAdmissions.length,
      opdVisits: safeOpdRecords.length,
      documents: documentVault.length,
    },
  };
}

router.get('/portal/patient', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json(payload);
}));

router.get('/portal/patient/profile', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ patient: payload.patient, access: payload.access, summary: payload.summary });
}));

router.get('/portal/patient/appointments', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ appointments: payload.appointments, upcoming: payload.appointments.filter((a) => ['scheduled', 'checked_in', 'in_consultation'].includes(a.status || 'scheduled')), summary: payload.summary });
}));

router.get('/portal/patient/prescriptions', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ prescriptions: payload.prescriptions, opdRecords: payload.opdRecords, summary: payload.summary });
}));

router.get('/portal/patient/reports', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ labReports: payload.labReports, radiologyReports: payload.radiologyReports, documentVault: payload.documentVault.filter((d) => ['lab_report', 'radiology_report'].includes(d.source)), summary: payload.summary });
}));

router.get('/portal/patient/bills', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ bills: payload.bills, outstandingAmount: payload.summary.outstandingAmount, pendingBills: payload.summary.pendingBills });
}));

router.get('/portal/patient/documents', asyncHandler(async (req, res) => {
  const payload = await loadPatientPortalPayload(req, res);
  if (!res.headersSent) res.json({ documents: payload.documentVault, access: payload.access });
}));


function patientIdentityValuesFromRecords(records = []) {
  return [...new Set(records.map((r) => cleanId(r.patient_id)).filter(Boolean))];
}

function doctorAccessSummary(req, doctor) {
  return {
    self_service: isDoctorPortalUser(req.user),
    staff_view: isStaff(req.user),
    own_data_only: !isStaff(req.user),
    selected_doctor: Boolean(req.query.doctor_id),
    doctor_id: doctor?.doctor_id || doctor?.id || null,
  };
}

function getRecordDate(value = {}) {
  return value.appointment_date || value.visit_date || value.follow_up_date || value.completed_at || value.approved_at || value.created_at || null;
}

async function loadDoctorPortalPayload(req, res) {
  const doctor = await findDoctorForUser(req, res);
  if (!doctor) {
    return {
      doctor: null,
      message: 'No doctor profile is linked to this login yet. Match the doctor email/phone with the login user or select a doctor as authorized staff.',
      todayAppointments: [], upcomingAppointments: [], activeQueue: [], assignedPatients: [], consultations: [], labOrders: [], radiologyOrders: [], followUps: [], recentResults: [], schedule: null, summary: {}, access: {}
    };
  }

  const filter = tenantFilter(req, identityFilter(doctor, 'doctor_id'));
  const today = new Date().toISOString().slice(0, 10);
  const [appointments, consultations, labOrders, radiologyOrders, schedule] = await Promise.all([
    Appointment.find(filter).sort({ appointment_date: 1, appointment_time: 1, id: 1 }).limit(180).lean(),
    OpdRecord.find(filter).sort({ visit_date: -1, created_at: -1, id: -1 }).limit(120).lean(),
    LabTest.find(filter).sort({ created_at: -1, id: -1 }).limit(100).lean(),
    RadiologyTest.find(filter).sort({ created_at: -1, id: -1 }).limit(100).lean(),
    DoctorSchedule.findOne(tenantFilter(req, { $or: [{ doctor_ref_id: doctor.id }, { doctor_id: String(doctor.doctor_id || doctor.id) }] })).lean(),
  ]);

  const safeDoctor = redactClinicalRecord(doctor);
  const safeAppointments = appointments.map(redactClinicalRecord);
  const safeConsultations = consultations.map(redactClinicalRecord);
  const safeLabOrders = labOrders.map(redactClinicalRecord);
  const safeRadiologyOrders = radiologyOrders.map(redactClinicalRecord);

  const patientIds = patientIdentityValuesFromRecords([...safeAppointments, ...safeConsultations, ...safeLabOrders, ...safeRadiologyOrders]);
  const patientLookup = patientIds.length ? await Patient.find(tenantFilter(req, { patient_id: { $in: patientIds } })).select('id patient_id full_name age gender phone email blood_group status').limit(150).lean() : [];
  const patientMap = new Map(patientLookup.map((p) => [cleanId(p.patient_id), redactPatient(p)]));

  const todayAppointments = safeAppointments.filter((a) => a.appointment_date === today);
  const upcomingAppointments = safeAppointments.filter((a) => String(a.appointment_date || '') >= today).slice(0, 50);
  const activeQueue = todayAppointments.filter((a) => ['scheduled', 'checked_in', 'in_consultation'].includes(a.status || 'scheduled'));
  const completedToday = todayAppointments.filter((a) => a.status === 'completed');
  const followUps = safeConsultations
    .filter((c) => c.follow_up_date && String(c.follow_up_date) >= today)
    .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)))
    .slice(0, 50);
  const recentResults = [...safeLabOrders, ...safeRadiologyOrders]
    .filter((r) => documentUrl(r) || ['completed', 'approved', 'reported'].includes(String(r.test_status || r.status || '').toLowerCase()))
    .sort(byDateDesc)
    .slice(0, 60);
  const assignedPatients = patientIds.map((pid) => {
    const patient = patientMap.get(pid) || { patient_id: pid, full_name: pid };
    const patientAppointments = safeAppointments.filter((a) => cleanId(a.patient_id) === pid);
    const patientConsultations = safeConsultations.filter((c) => cleanId(c.patient_id) === pid);
    const lastVisit = [...patientAppointments, ...patientConsultations].sort(byDateDesc)[0];
    return {
      ...patient,
      last_visit_date: getRecordDate(lastVisit),
      upcoming_appointments: patientAppointments.filter((a) => String(a.appointment_date || '') >= today).length,
      consultations: patientConsultations.length,
    };
  }).sort((a, b) => new Date(b.last_visit_date || 0) - new Date(a.last_visit_date || 0));

  const timeline = [
    ...safeAppointments.map((x) => ({ type: 'appointment', title: x.patient_name || x.patient_id || 'Appointment', status: x.status, date: x.appointment_date || x.created_at, patient_id: x.patient_id, payload: x })),
    ...safeConsultations.map((x) => ({ type: 'consultation', title: x.final_diagnosis || x.provisional_diagnosis || x.chief_complaint || 'Consultation', status: x.status, date: x.visit_date || x.created_at, patient_id: x.patient_id, payload: x })),
    ...safeLabOrders.map((x) => ({ type: 'lab', title: x.test_name || 'Lab Order', status: x.test_status || x.status, date: x.completed_at || x.created_at, patient_id: x.patient_id, payload: x })),
    ...safeRadiologyOrders.map((x) => ({ type: 'radiology', title: x.scan_name || 'Radiology Order', status: x.status, date: x.completed_at || x.created_at, patient_id: x.patient_id, payload: x })),
  ].sort(byDateDesc).slice(0, 120);

  auditEvent({
    req,
    action: 'Doctor portal viewed',
    module_name: 'doctor_portal',
    entity_type: 'doctor',
    entity_id: safeDoctor.id || safeDoctor.doctor_id,
    metadata: { self_service: isDoctorPortalUser(req.user), staff_view: isStaff(req.user), selected_doctor: Boolean(req.query.doctor_id), assigned_patients: assignedPatients.length },
  });

  return {
    doctor: safeDoctor,
    schedule,
    todayAppointments,
    upcomingAppointments,
    activeQueue,
    completedToday,
    assignedPatients,
    consultations: safeConsultations,
    labOrders: safeLabOrders,
    radiologyOrders: safeRadiologyOrders,
    followUps,
    recentResults,
    timeline,
    certificates: safeDoctor.certificates || [],
    access: doctorAccessSummary(req, safeDoctor),
    summary: {
      today: todayAppointments.length,
      waiting: todayAppointments.filter((a) => a.status === 'checked_in').length,
      inConsultation: todayAppointments.filter((a) => a.status === 'in_consultation').length,
      completed: completedToday.length,
      upcoming: upcomingAppointments.length,
      assignedPatients: assignedPatients.length,
      consultations: safeConsultations.length,
      followUps: followUps.length,
      labOrders: safeLabOrders.length,
      radiologyOrders: safeRadiologyOrders.length,
      readyResults: recentResults.length,
    },
  };
}

router.get('/portal/doctor', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json(payload);
}));

router.get('/portal/doctor/queue', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json({ todayAppointments: payload.todayAppointments, activeQueue: payload.activeQueue, upcomingAppointments: payload.upcomingAppointments, summary: payload.summary, access: payload.access });
}));

router.get('/portal/doctor/patients', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json({ assignedPatients: payload.assignedPatients, summary: payload.summary, access: payload.access });
}));

router.get('/portal/doctor/emr', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json({ consultations: payload.consultations, timeline: payload.timeline.filter((item) => ['consultation', 'appointment'].includes(item.type)), summary: payload.summary, access: payload.access });
}));

router.get('/portal/doctor/results', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json({ labOrders: payload.labOrders, radiologyOrders: payload.radiologyOrders, recentResults: payload.recentResults, summary: payload.summary, access: payload.access });
}));

router.get('/portal/doctor/follow-ups', asyncHandler(async (req, res) => {
  const payload = await loadDoctorPortalPayload(req, res);
  if (!res.headersSent) res.json({ followUps: payload.followUps, summary: payload.summary, access: payload.access });
}));

module.exports = router;
