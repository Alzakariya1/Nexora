import api from './client';

export const communicationApi = {
  summary: () => api.get('/communications/summary'),
  logs: (params = {}) => api.get('/communications/logs', { params }),
  due: (params = {}) => api.get('/communications/due', { params }),
  send: (payload) => api.post('/communications/send', payload),
  appointmentReminders: (payload) => api.post('/communications/appointment-reminders', payload),
  paymentDueReminders: (payload) => api.post('/communications/payment-due-reminders', payload),
  markSent: (id, payload = {}) => api.post(`/communications/${id}/mark-sent`, payload),
  markFailed: (id, payload = {}) => api.post(`/communications/${id}/mark-failed`, payload),
  retry: (id, payload = {}) => api.post(`/communications/${id}/retry`, payload),
  providerCallback: (payload = {}) => api.post('/communications/provider-callback', payload),
  templates: (params = {}) => api.get('/communications/templates', { params }),
  saveTemplate: (payload) => api.post('/communications/templates', payload),
  approveTemplate: (id, payload = {}) => api.patch(`/communications/templates/${id}/approve`, payload),
  rules: () => api.get('/communications/rules'),
  saveRule: (payload) => api.post('/communications/rules', payload),
  updateRule: (id, payload) => api.patch(`/communications/rules/${id}`, payload),
  exportCsv: () => api.get('/communications/export.csv', { responseType: 'blob' }),
};
