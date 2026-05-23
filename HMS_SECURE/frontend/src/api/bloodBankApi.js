import api from './client';

export const bloodBankApi = {
  dashboard: () => api.get('/blood-bank/dashboard'),
  donors: (params = {}) => api.get('/blood-bank/donors', { params }),
  createDonor: (payload) => api.post('/blood-bank/donors', payload),
  updateDonor: (id, payload) => api.patch(`/blood-bank/donors/${id}`, payload),
  units: (params = {}) => api.get('/blood-bank/units', { params }),
  createUnit: (payload) => api.post('/blood-bank/units', payload),
  updateUnit: (id, payload) => api.patch(`/blood-bank/units/${id}`, payload),
  requisitions: (params = {}) => api.get('/blood-bank/requisitions', { params }),
  createRequisition: (payload) => api.post('/blood-bank/requisitions', payload),
  approveRequisition: (id) => api.post(`/blood-bank/requisitions/${id}/approve`),
  rejectRequisition: (id, payload) => api.post(`/blood-bank/requisitions/${id}/reject`, payload),
  crossMatches: (params = {}) => api.get('/blood-bank/cross-matches', { params }),
  createCrossMatch: (payload) => api.post('/blood-bank/cross-matches', payload),
  updateCrossMatch: (id, payload) => api.patch(`/blood-bank/cross-matches/${id}`, payload),
  reservations: (params = {}) => api.get('/blood-bank/reservations', { params }),
  createReservation: (payload) => api.post('/blood-bank/reservations', payload),
  releaseReservation: (id) => api.post(`/blood-bank/reservations/${id}/release`),
  issues: (params = {}) => api.get('/blood-bank/issues', { params }),
  createIssue: (payload) => api.post('/blood-bank/issues', payload),
  stockReport: () => api.get('/blood-bank/reports/stock'),
};
