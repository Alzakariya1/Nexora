import api from './client';

export const communicationApi = {
  summary: () => api.get('/communications/summary'),
  logs: (params = {}) => api.get('/communications/logs', { params }),
  send: (payload) => api.post('/communications/send', payload),
  appointmentReminders: (payload) => api.post('/communications/appointment-reminders', payload),
  markSent: (id, payload = {}) => api.post(`/communications/${id}/mark-sent`, payload),
  exportCsv: () => api.get('/communications/export.csv', { responseType: 'blob' }),
};
