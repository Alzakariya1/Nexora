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
    'opd.view', 'opd.create', 'ipd.view', 'ipd.create', 'clinical.view', 'clinical.manage',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
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
    'opd.view', 'opd.create', 'ipd.view', 'ipd.create', 'clinical.view', 'clinical.manage',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
    'admin.profile.manage', 'admin.users.manage',
    'notification.view', 'notification.manage', 'communication.view', 'communication.manage',
    'audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage',
  ],
  doctor: [
    'dashboard.view', 'patient.view',
    'appointment.view', 'appointment.status.update', 'portal.doctor.view',
    'opd.view', 'opd.create', 'ipd.view', 'clinical.view', 'clinical.manage',
    'emr.view', 'emr.create', 'emr.edit',
    'lab.view', 'radiology.view',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  nurse: [
    'dashboard.view', 'patient.view', 'patient.edit',
    'bed.view', 'bed.status.update',
    'appointment.view',
    'opd.view', 'ipd.view', 'ipd.create', 'clinical.view', 'clinical.manage',
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
    'dashboard.view', 'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
    'admin.profile.manage', 'notification.view', 'communication.view',
  ],
  patient: [
    'dashboard.view', 'appointment.view', 'portal.patient.view', 'emr.view', 'billing.view',
    'admin.profile.manage', 'notification.view',
  ],
};

const PERMISSION_LABELS = {
  'dashboard.view': 'View Dashboard',
  'analytics.view': 'View Analytics / Command Center',
  'patient.view': 'View Patients',
  'patient.create': 'Create Patients',
  'patient.edit': 'Edit Patients',
  'patient.delete': 'Archive Patients',
  'patient.document.manage': 'Manage Patient Documents',
  'doctor.view': 'View Doctors',
  'doctor.create': 'Create Doctors',
  'doctor.edit': 'Edit Doctors',
  'doctor.delete': 'Archive Doctors',
  'doctor.document.manage': 'Manage Doctor Documents',
  'appointment.view': 'View Appointments',
  'appointment.create': 'Create Appointments',
  'appointment.edit': 'Edit Appointments',
  'appointment.delete': 'Archive Appointments',
  'appointment.status.update': 'Update Appointment Status',
  'portal.patient.view': 'View Patient Portal',
  'portal.doctor.view': 'View Doctor Portal',
  'emr.view': 'View EMR',
  'emr.create': 'Create EMR',
  'emr.edit': 'Edit EMR',
  'emr.delete': 'Archive EMR',
  'bed.view': 'View Beds',
  'bed.create': 'Create Beds',
  'bed.status.update': 'Update Bed Status',
  'opd.view': 'View OPD',
  'opd.create': 'Create OPD',
  'ipd.view': 'View IPD',
  'ipd.create': 'Create IPD',
  'clinical.view': 'View Clinical Workflows',
  'clinical.manage': 'Manage Clinical Workflows',
  'lab.view': 'View Lab',
  'lab.create': 'Create Lab Orders/Results',
  'radiology.view': 'View Radiology',
  'radiology.create': 'Create Radiology Orders/Results',
  'pharmacy.view': 'View Pharmacy',
  'pharmacy.create': 'Create Pharmacy Sales/Items',
  'pharmacy.stock.manage': 'Manage Pharmacy Stock',
  'inventory.view': 'View Inventory',
  'inventory.manage': 'Manage Inventory',
  'billing.view': 'View Billing',
  'billing.create': 'Create Bills',
  'billing.edit': 'Edit/Approve Billing',
  'insurance.view': 'View Insurance/TPA',
  'insurance.manage': 'Manage Insurance/TPA',
  'admin.profile.manage': 'Manage Own Profile',
  'admin.users.manage': 'Manage Users & Roles',
  'notification.view': 'View Notifications',
  'notification.manage': 'Manage Notifications',
  'communication.view': 'View Communications',
  'communication.manage': 'Manage Communications',
  'audit.view': 'View Audit Logs',
  'security.manage': 'Manage Security',
  'compliance.view': 'View Compliance',
  'compliance.manage': 'Manage Compliance',
  'configuration.manage': 'Manage Configuration',
  'hospital.manage': 'Manage Hospitals / SaaS',
};

const PERMISSION_GROUPS = {
  dashboard: ['dashboard.view', 'analytics.view'],
  patients: ['patient.view', 'patient.create', 'patient.edit', 'patient.delete', 'patient.document.manage'],
  doctors: ['doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete', 'doctor.document.manage'],
  appointments: ['appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'appointment.status.update'],
  portals: ['portal.patient.view', 'portal.doctor.view'],
  clinical: ['emr.view', 'emr.create', 'emr.edit', 'emr.delete', 'opd.view', 'opd.create', 'ipd.view', 'ipd.create', 'clinical.view', 'clinical.manage'],
  bed_management: ['bed.view', 'bed.create', 'bed.status.update'],
  diagnostics: ['lab.view', 'lab.create', 'radiology.view', 'radiology.create'],
  pharmacy_inventory: ['pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage'],
  billing_insurance: ['billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage'],
  users_admin: ['admin.profile.manage', 'admin.users.manage'],
  communication: ['notification.view', 'notification.manage', 'communication.view', 'communication.manage'],
  governance: ['audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage', 'hospital.manage'],
};

const ALL_PERMISSIONS = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat().concat(Object.keys(PERMISSION_LABELS)))).filter((p) => p !== '*').sort();

function normalizePermissions(input) {
  if (!input) return [];
  if (Array.isArray(input)) return Array.from(new Set(input.filter(Boolean).map(String).filter((p) => ALL_PERMISSIONS.includes(p))));
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

function buildPermissionCatalog(actor = {}) {
  const actorPermissions = getUserPermissions(actor);
  const canGrantAll = actorPermissions.includes('*');
  const grantable = canGrantAll ? ALL_PERMISSIONS : ALL_PERMISSIONS.filter((p) => actorPermissions.includes(p));
  return Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => ({
    group,
    permissions: permissions
      .filter((permission) => grantable.includes(permission))
      .map((permission) => ({ permission, label: PERMISSION_LABELS[permission] || permission })),
  })).filter((g) => g.permissions.length > 0);
}

module.exports = {
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  getRolePermissions,
  getUserPermissions,
  hasPermission,
  normalizePermissions,
  buildPermissionCatalog,
};
