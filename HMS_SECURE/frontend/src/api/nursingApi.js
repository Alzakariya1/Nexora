import api from './client';

export const nursingApi = {
  dashboard: () => api.get('/nursing/dashboard'),
  vitals: (params = {}) => api.get('/nursing/vitals', { params }),
  createVital: (payload) => api.post('/nursing/vitals', payload),
  medications: (params = {}) => api.get('/nursing/medications', { params }),
  createMedication: (payload) => api.post('/nursing/medications', payload),
  administerMedication: (id, payload) => api.patch(`/nursing/medications/${id}/administer`, payload),
  handovers: (params = {}) => api.get('/nursing/handovers', { params }),
  createHandover: (payload) => api.post('/nursing/handovers', payload),
  carePlans: (params = {}) => api.get('/nursing/care-plans', { params }),
  createCarePlan: (payload) => api.post('/nursing/care-plans', payload),
  updateCarePlan: (id, payload) => api.patch(`/nursing/care-plans/${id}`, payload),
  tasks: (params = {}) => api.get('/nursing/tasks', { params }),
  createTask: (payload) => api.post('/nursing/tasks', payload),
  updateTask: (id, payload) => api.patch(`/nursing/tasks/${id}`, payload),
};
