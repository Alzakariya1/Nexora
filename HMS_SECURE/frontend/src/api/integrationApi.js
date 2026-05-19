import api from './client';
export const integrationApi = {
  summary: () => api.get('/integration/summary'),
  keys: () => api.get('/integration/api-keys'),
  createKey: (payload) => api.post('/integration/api-keys', payload),
  updateKey: (id, payload) => api.patch(`/integration/api-keys/${id}`, payload),
  logs: () => api.get('/integration/logs'),
  createLog: (payload) => api.post('/integration/logs', payload),
  webhooks: () => api.get('/integration/webhooks'),
  createWebhook: (payload) => api.post('/integration/webhooks', payload),
  createWebhookEvent: (payload) => api.post('/integration/webhook-events', payload),
  fhir: (resource) => api.get(`/fhir/${resource}`),
};
