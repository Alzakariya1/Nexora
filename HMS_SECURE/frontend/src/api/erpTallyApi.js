import api from './client';

export const erpTallyApi = {
  summary: (params = {}) => api.get('/erp-tally/summary', { params }),
  ledgerMapping: () => api.get('/erp-tally/ledger-mapping'),
  saveLedgerMapping: (payload) => api.post('/erp-tally/ledger-mapping', payload),
  previewExport: (params = {}) => api.get('/erp-tally/export/preview', { params }),
  runExport: (payload) => api.post('/erp-tally/export', payload),
  manifest: (id) => api.get(`/erp-tally/export/${id}/manifest`),
};
