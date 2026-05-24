import api from './client';

export const emrApi = {
  patients: () => api.get('/emr/patients'),
  summary: (patientId) => api.get(`/emr/patients/${patientId}/summary`),
  create: (payload) => api.post('/emr/records', payload),
  update: (id, payload) => api.put(`/emr/records/${id}`, payload),
  delete: (id) => api.delete(`/emr/records/${id}`),
};
