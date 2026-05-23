import api from './client';

export const emergencyApi = {
  dashboard: () => api.get('/emergency/dashboard'),
  cases: (params = {}) => api.get('/emergency/cases', { params }),
  createCase: (payload) => api.post('/emergency/cases', payload),
  updateCase: (id, payload) => api.patch(`/emergency/cases/${id}`, payload),
  addTriage: (id, payload) => api.post(`/emergency/cases/${id}/triage`, payload),
  triageNotes: (id) => api.get(`/emergency/cases/${id}/triage`),
  addClinicalNote: (id, payload) => api.post(`/emergency/cases/${id}/clinical-note`, payload),
  clinicalNotes: (id) => api.get(`/emergency/cases/${id}/clinical-notes`),
  createTransfer: (id, payload) => api.post(`/emergency/cases/${id}/transfer`, payload),
  transfers: (params = {}) => api.get('/emergency/transfers', { params }),
  updateTransfer: (id, payload) => api.patch(`/emergency/transfers/${id}`, payload),
  linkBilling: (id, payload) => api.post(`/emergency/cases/${id}/billing-link`, payload),
};
