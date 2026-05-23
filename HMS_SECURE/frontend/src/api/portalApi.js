import api from "./client";

export const portalApi = {
  patient: (params = {}) => api.get("/portal/patient", { params }),
  patientProfile: (params = {}) => api.get("/portal/patient/profile", { params }),
  patientAppointments: (params = {}) => api.get("/portal/patient/appointments", { params }),
  patientPrescriptions: (params = {}) => api.get("/portal/patient/prescriptions", { params }),
  patientReports: (params = {}) => api.get("/portal/patient/reports", { params }),
  patientBills: (params = {}) => api.get("/portal/patient/bills", { params }),
  patientDocuments: (params = {}) => api.get("/portal/patient/documents", { params }),
  doctor: (params = {}) => api.get("/portal/doctor", { params }),
  doctorQueue: (params = {}) => api.get("/portal/doctor/queue", { params }),
  doctorPatients: (params = {}) => api.get("/portal/doctor/patients", { params }),
  doctorEmr: (params = {}) => api.get("/portal/doctor/emr", { params }),
  doctorResults: (params = {}) => api.get("/portal/doctor/results", { params }),
  doctorFollowUps: (params = {}) => api.get("/portal/doctor/follow-ups", { params }),
};
