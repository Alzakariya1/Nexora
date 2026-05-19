import api from './client';
export const enterpriseFeatureApi = {
  summary: (feature) => api.get(`/enterprise-features/${feature}/summary`),
  records: (feature, params = {}) => api.get(`/enterprise-features/${feature}/records`, { params }),
  create: (feature, payload) => api.post(`/enterprise-features/${feature}/records`, payload),
  update: (feature, id, payload) => api.patch(`/enterprise-features/${feature}/records/${id}`, payload),
  remove: (feature, id) => api.delete(`/enterprise-features/${feature}/records/${id}`),
  setEnabled: (feature, enabled) => api.put(`/enterprise-features/${feature}/enabled`, { enabled }),
};
