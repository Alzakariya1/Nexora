import api from './client';

export const pacsApi = {
  dashboard: () => api.get('/pacs/dashboard'),
  worklist: (params) => api.get('/pacs/worklist', { params }),
  createStudy: (payload) => api.post('/pacs/studies', payload),
  linkStudy: (id, payload) => api.patch(`/pacs/studies/${id}/link`, payload),
  updateStatus: (id, status, payload = {}) => api.patch(`/pacs/studies/${id}/status`, { status, ...payload }),
  manifest: (id) => api.get(`/pacs/studies/${id}/manifest`),
  verifyConnection: (payload) => api.post('/pacs/verify-connection', payload),
};
