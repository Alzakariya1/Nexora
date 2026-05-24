export function cleanId(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function getDoctorPublicId(doctor = {}) {
  // Prefer the business/public doctor_id for API calls.
  // Numeric database id can collide across tenants or become stale in UI state,
  // which can make document uploads hit /doctors/2/documents and return Doctor not found.
  return cleanId(doctor.doctor_id || doctor.public_id || doctor.id || doctor._id);
}

export function getPatientPublicId(patient = {}) {
  return cleanId(patient.public_id || patient.id || patient.patient_id);
}

export function findDoctorByAnyId(doctors = [], identifier) {
  const id = cleanId(identifier);
  if (!id) return null;
  return doctors.find((doctor) => {
    const values = [doctor.doctor_id, doctor.public_id, doctor.id, doctor._id].map(cleanId).filter(Boolean);
    return values.includes(id);
  }) || null;
}

export function findPatientByAnyId(patients = [], identifier) {
  const id = cleanId(identifier);
  if (!id) return null;
  return patients.find((patient) => {
    const values = [patient.public_id, patient.id, patient.patient_id, patient._id].map(cleanId).filter(Boolean);
    return values.includes(id);
  }) || null;
}

export function normalizeAppointmentForApi(appointment = {}, doctors = [], patients = []) {
  const doctor = findDoctorByAnyId(doctors, appointment.doctor_id);
  const patient = findPatientByAnyId(patients, appointment.patient_id);

  return {
    ...appointment,
    doctor_id: doctor ? getDoctorPublicId(doctor) : cleanId(appointment.doctor_id),
    patient_id: patient ? getPatientPublicId(patient) : cleanId(appointment.patient_id),
  };
}
