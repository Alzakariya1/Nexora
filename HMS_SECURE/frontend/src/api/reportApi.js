import api from './client';

export const reportApi = {
  getPatientAppointmentReports: (params = {}) => api.get('/reports/patients-appointments', { params }),
  getRevenueBillingReports: (params = {}) => api.get('/reports/revenue-billing', { params }),
  getPharmacyLabIpdReports: (params = {}) => api.get('/reports/pharmacy-lab-ipd', { params }),
  getExecutiveCommandCenter: (params = {}) => api.get('/reports/executive-command-center', { params }),
};
