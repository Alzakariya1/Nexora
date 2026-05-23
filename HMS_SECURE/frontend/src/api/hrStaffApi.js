import api from './client';

export const hrStaffApi = {
  dashboard: (params = {}) => api.get('/hr-staff/dashboard', { params }),
  staff: (params = {}) => api.get('/hr-staff/staff', { params }),
  createStaff: (payload) => api.post('/hr-staff/staff', payload),
  updateStaff: (id, payload) => api.patch(`/hr-staff/staff/${id}`, payload),
  attendance: (params = {}) => api.get('/hr-staff/attendance', { params }),
  markAttendance: (payload) => api.post('/hr-staff/attendance', payload),
  updateAttendance: (id, payload) => api.patch(`/hr-staff/attendance/${id}`, payload),
  rosters: (params = {}) => api.get('/hr-staff/rosters', { params }),
  createRoster: (payload) => api.post('/hr-staff/rosters', payload),
  updateRoster: (id, payload) => api.patch(`/hr-staff/rosters/${id}`, payload),
  leaves: (params = {}) => api.get('/hr-staff/leaves', { params }),
  createLeave: (payload) => api.post('/hr-staff/leaves', payload),
  reviewLeave: (id, payload) => api.post(`/hr-staff/leaves/${id}/review`, payload),
  payrollExports: () => api.get('/hr-staff/payroll-exports'),
  createPayrollExport: (payload) => api.post('/hr-staff/payroll-exports', payload),
  payrollExport: (id) => api.get(`/hr-staff/payroll-exports/${id}`),
};
