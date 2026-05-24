import api from './client';

export const emrApi = {
  patients: () => api.get('/emr/patients'),
  summary: (patientId) => api.get(`/emr/patients/${patientId}/summary`),
  create: (payload) => api.post('/emr/records', payload),
  update: (id, payload) => api.put(`/emr/records/${id}`, payload),
  delete: (id) => api.delete(`/emr/records/${id}`),
  consultations: (params = {}) => api.get('/opd/consultations', { params }),
  getConsultation: (id) => api.get(`/opd/consultations/${id}`),
  updateConsultation: (id, payload) => api.put(`/opd/consultations/${id}`, payload),
  finalizeConsultation: (id, payload = {}) => api.patch(`/opd/consultations/${id}/finalize`, payload),
  archiveConsultation: (id, reason) => api.delete(`/opd/consultations/${id}`, { data: { reason } }),
};
