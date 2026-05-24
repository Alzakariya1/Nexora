const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard.view', 'analytics.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.delete', 'patient.document.manage',
    'doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete', 'doctor.document.manage',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'appointment.status.update',
    'portal.patient.view', 'portal.doctor.view',
    'emr.view', 'emr.create', 'emr.edit', 'emr.delete',
    'bed.view', 'bed.create', 'bed.status.update',
    'opd.view', 'opd.create', 'ipd.view', 'ipd.create',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit',
    'admin.profile.manage', 'admin.users.manage',
    'notification.view', 'notification.manage', 'communication.view', 'communication.manage',
    'audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage', 'hospital.manage',
  ],
  hospital_admin: [
    'dashboard.view', 'analytics.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.delete', 'patient.document.manage',
    'doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete', 'doctor.document.manage',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'appointment.status.update',
    'portal.patient.view', 'portal.doctor.view',
    'emr.view', 'emr.create', 'emr.edit', 'emr.delete',
    'bed.view', 'bed.create', 'bed.status.update',
    'opd.view', 'opd.create', 'ipd.view', 'ipd.create',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit',
    'admin.profile.manage', 'admin.users.manage',
    'notification.view', 'notification.manage', 'communication.view', 'communication.manage',
    'audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage',
  ],
  doctor: [
    'dashboard.view', 'patient.view',
    'appointment.view', 'appointment.status.update', 'portal.doctor.view',
    'opd.view', 'opd.create', 'ipd.view',
    'emr.view', 'emr.create', 'emr.edit',
    'lab.view', 'radiology.view',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  nurse: [
    'dashboard.view', 'patient.view', 'patient.edit',
    'bed.view', 'bed.status.update',
    'appointment.view',
    'opd.view', 'ipd.view', 'ipd.create',
    'emr.view', 'emr.create',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  receptionist: [
    'dashboard.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.document.manage',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete',
    'portal.patient.view', 'portal.doctor.view',
    'emr.view',
    'bed.view', 'opd.view', 'opd.create',
    'billing.view', 'billing.create',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  pharmacist: [
    'dashboard.view', 'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  lab_technician: [
    'dashboard.view', 'lab.view', 'lab.create', 'radiology.view', 'radiology.create',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  accountant: [
    'dashboard.view', 'billing.view', 'billing.create', 'billing.edit',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  patient: [
    'dashboard.view', 'appointment.view', 'portal.patient.view', 'emr.view', 'billing.view',
    'admin.profile.manage', 'notification.view',
  ],
};

function normalizePermissions(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean).map(String);
  return [];
}

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function getUserPermissions(user = {}) {
  const rolePermissions = getRolePermissions(user.role);
  const customPermissions = normalizePermissions(user.permissions);
  return Array.from(new Set([...rolePermissions, ...customPermissions]));
}

function hasPermission(user = {}, permission) {
  if (!permission) return false;
  const permissions = getUserPermissions(user);
  if (permissions.includes('*')) return true;
  if (Array.isArray(permission)) return permission.some((p) => permissions.includes(p));
  return permissions.includes(permission);
}

module.exports = {
  ROLE_PERMISSIONS,
  getRolePermissions,
  getUserPermissions,
  hasPermission,
};
