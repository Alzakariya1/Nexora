
export const PLAN_DEFINITIONS = {
  clinic: {
    id: 'clinic',
    name: 'Clinic Plan',
    price: '₹2,999/mo',
    description: 'Best for single clinics and small practices.',
    limits: { users: 8, patients: 1500, doctors: 5, appointments_per_month: 1200, medicines: 250, branches: 1, storage_gb: 5 },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'patientPortal', 'doctorPortal', 'emr', 'billing', 'profile', 'configuration', 'communications'],
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital Plan',
    price: '₹9,999/mo',
    description: 'For hospitals that need OPD/IPD, lab, radiology, pharmacy and billing.',
    limits: { users: 50, patients: 25000, doctors: 50, appointments_per_month: 15000, medicines: 5000, branches: 3, storage_gb: 100 },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'patientPortal', 'doctorPortal', 'emr', 'beds', 'lab', 'radiology', 'pharmacy', 'inventory', 'billing', 'compliance', 'integration', 'profile', 'auditSecurity', 'operations', 'configuration', 'communications'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: '₹24,999/mo',
    description: 'For chains and enterprise hospitals with advanced controls and integrations.',
    limits: { users: 500, patients: 500000, doctors: 500, appointments_per_month: 200000, medicines: 50000, branches: 50, storage_gb: 1000 },
    modules: ['dashboard', 'patients', 'doctors', 'appointments', 'patientPortal', 'doctorPortal', 'emr', 'beds', 'lab', 'radiology', 'pharmacy', 'inventory', 'billing', 'compliance', 'integration', 'profile', 'auditSecurity', 'operations', 'configuration', 'communications', 'integration', 'tenants'],
  },
};

export function getPlanDefinition(plan = 'enterprise') {
  return PLAN_DEFINITIONS[plan] || PLAN_DEFINITIONS.clinic;
}

export function getPlanModules(plan = 'enterprise') {
  return getPlanDefinition(plan).modules;
}

export function normalizePlanModules(plan = 'enterprise', modules = []) {
  const allowed = new Set(getPlanModules(plan));
  const selected = Array.isArray(modules) && modules.length ? modules : getPlanModules(plan);
  const clean = Array.from(new Set(selected.filter((moduleId) => allowed.has(moduleId))));
  return clean.length ? clean : getPlanModules(plan);
}

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard.view', 'analytics.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.delete', 'patient.document.manage',
    'doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'portal.patient.view', 'portal.doctor.view', 'appointment.status.update', 'emr.view', 'emr.create', 'emr.edit', 'emr.delete',
    'bed.view', 'bed.create', 'bed.status.update',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
    'admin.profile.manage', 'admin.users.manage',
    'audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage', 'communication.view', 'communication.manage', 'communication.view', 'communication.manage', 'hospital.manage'
  ],
  hospital_admin: [
    'dashboard.view', 'analytics.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.delete', 'patient.document.manage',
    'doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'portal.patient.view', 'portal.doctor.view', 'appointment.status.update', 'emr.view', 'emr.create', 'emr.edit', 'emr.delete',
    'bed.view', 'bed.create', 'bed.status.update',
    'opd.view', 'opd.create', 'ipd.view', 'ipd.create',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
    'admin.profile.manage', 'admin.users.manage',
    'audit.view', 'security.manage', 'compliance.view', 'compliance.manage', 'configuration.manage', 'communication.view', 'communication.manage'
  ],
  doctor: [
    'dashboard.view',
    'patient.view',
    'appointment.view', 'appointment.status.update', 'portal.doctor.view',
    'lab.view', 'radiology.view', 'portal.doctor.view', 'emr.view', 'emr.create',
    'admin.profile.manage'
  ],
  nurse: [
    'dashboard.view',
    'patient.view', 'patient.edit',
    'bed.view', 'bed.status.update',
    'appointment.view',
    'admin.profile.manage'
  ],
  receptionist: [
    'dashboard.view',
    'patient.view', 'patient.create', 'patient.edit', 'patient.document.manage',
    'appointment.view', 'appointment.create', 'appointment.edit', 'appointment.delete', 'portal.patient.view', 'portal.doctor.view', 'emr.view', 'emr.create',
    'bed.view',
    'billing.view', 'billing.create',
    'admin.profile.manage'
  ],
  pharmacist: [
    'dashboard.view',
    'pharmacy.view', 'pharmacy.create', 'pharmacy.stock.manage', 'inventory.view', 'inventory.manage',
    'admin.profile.manage'
  ],
  lab_technician: [
    'dashboard.view',
    'lab.view', 'lab.create',
    'radiology.view', 'radiology.create',
    'admin.profile.manage'
  ],
  accountant: [
    'dashboard.view',
    'billing.view', 'billing.create', 'billing.edit', 'insurance.view', 'insurance.manage',
    'admin.profile.manage'
  ],
  patient: [
    'dashboard.view',
    'appointment.view', 'portal.patient.view', 'emr.view',
    'billing.view',
    'admin.profile.manage'
  ]
};

export const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'commandCenter', label: 'Command Center' },
  { id: 'patients', label: 'Patients' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'patientPortal', label: 'Patient Portal' },
  { id: 'doctorPortal', label: 'Doctor Portal' },
  { id: 'emr', label: 'EMR / EHR' },
  { id: 'beds', label: 'Beds' },
  { id: 'lab', label: 'Laboratory' },
  { id: 'radiology', label: 'Radiology' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'billing', label: 'Billing' },
  { id: 'profile', label: 'Profile' },
  { id: 'auditSecurity', label: 'Security' },
  { id: 'operations', label: 'Production Ops' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'integration', label: 'FHIR APIs' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'communications', label: 'Communications' },
  { id: 'tenants', label: 'Hospitals' },
  { id: 'saasControl', label: 'SaaS Control' },
  { id: 'salesDemo', label: 'Sales Demo' },
  { id: 'legalSecurity', label: 'Legal & Security' },
];

export const DEFAULT_ENABLED_MODULES = MODULES.map((module) => module.id);


export const FEATURE_FLAGS = [
  { id: 'fhir', label: 'FHIR APIs', description: 'Enable interoperability-ready FHIR endpoints and UI controls.' },
  { id: 'hl7', label: 'HL7 Ready', description: 'Enable HL7 integration readiness for enterprise hospital systems.' },
  { id: 'pacs', label: 'PACS/DICOM', description: 'Enable PACS viewer URL and DICOM Study ID workflows.' },
  { id: 'biometric', label: 'Biometric', description: 'Enable biometric attendance and identity verification readiness.' },
  { id: 'insurance_tpa', label: 'Insurance/TPA', description: 'Enable insurance, TPA, and claim workflow readiness.' },
  { id: 'erp', label: 'ERP/Tally', description: 'Enable accounting/ERP export and integration readiness.' },
  { id: 'whatsapp_sms', label: 'WhatsApp/SMS', description: 'Enable reminder and notification integration readiness.' },
  { id: 'abdm_abha', label: 'ABDM/ABHA', description: 'Enable ABHA/ABDM-ready patient identity fields and future integrations.' },
  { id: 'two_factor_auth', label: '2FA Security', description: 'Enable two-factor authentication controls when security module is upgraded.' },
  { id: 'audit_compliance', label: 'Audit Compliance', description: 'Enable enterprise audit/compliance dashboards and reports.' },
];

export const DEFAULT_FEATURE_FLAGS = FEATURE_FLAGS.reduce((acc, feature) => {
  acc[feature.id] = feature.id === 'audit_compliance';
  return acc;
}, {});

export function normalizeFeatureFlags(featureFlags) {
  const safeFlags = { ...DEFAULT_FEATURE_FLAGS };
  if (featureFlags && typeof featureFlags === 'object' && !Array.isArray(featureFlags)) {
    for (const feature of FEATURE_FLAGS) {
      if (feature.id in featureFlags) safeFlags[feature.id] = Boolean(featureFlags[feature.id]);
    }
  }
  return safeFlags;
}

export function hasFeature(featureFlags, featureId) {
  return Boolean(normalizeFeatureFlags(featureFlags)[featureId]);
}

export const TAB_PERMISSIONS = {
  fhir: 'configuration.manage',
  hl7: 'configuration.manage',
  pacs: 'configuration.manage',
  biometric: 'configuration.manage',
  insurance_tpa: 'configuration.manage',
  erp: 'configuration.manage',
  whatsapp_sms: 'communication.manage',
  abdm_abha: 'configuration.manage',
  two_factor_auth: 'security.manage',
  audit_compliance: ['audit.view', 'security.manage'],
  dashboard: 'dashboard.view',
  commandCenter: 'analytics.view',
  patients: 'patient.view',
  doctors: 'doctor.view',
  appointments: 'appointment.view',
  patientPortal: 'portal.patient.view',
  doctorPortal: 'portal.doctor.view',
  emr: 'emr.view',
  beds: 'bed.view',
  labs: ['lab.view', 'radiology.view'],
  pharmacy: 'pharmacy.view',
  inventory: ['inventory.view', 'pharmacy.view'],
  billing: 'billing.view',
  profile: 'admin.profile.manage',
  auditSecurity: ['audit.view', 'security.manage'],
  operations: ['security.manage', 'audit.view'],
  compliance: ['compliance.view', 'compliance.manage', 'audit.view'],
  configuration: 'configuration.manage',
  communications: 'communication.view',
  tenants: 'hospital.manage',
  saasControl: 'hospital.manage',
  salesDemo: 'hospital.manage',
  legalSecurity: ['security.manage', 'compliance.manage', 'hospital.manage'],
};

export const TAB_MODULES = {
  fhir: ['configuration'],
  hl7: ['configuration'],
  pacs: ['configuration'],
  biometric: ['configuration'],
  insurance_tpa: ['billing'],
  erp: ['billing'],
  whatsapp_sms: ['communications'],
  abdm_abha: ['patients'],
  two_factor_auth: ['auditSecurity'],
  audit_compliance: ['auditSecurity'],
  dashboard: ['dashboard'],
  commandCenter: ['commandCenter', 'dashboard'],
  patients: ['patients'],
  doctors: ['doctors'],
  appointments: ['appointments'],
  patientPortal: ['patientPortal', 'appointments', 'patients'],
  doctorPortal: ['doctorPortal', 'appointments', 'doctors'],
  emr: ['emr'],
  beds: ['beds'],
  labs: ['lab', 'radiology'],
  pharmacy: ['pharmacy'],
  inventory: ['inventory', 'pharmacy'],
  billing: ['billing'],
  profile: ['profile'],
  auditSecurity: ['auditSecurity', 'profile'],
  operations: ['operations', 'auditSecurity'],
  configuration: ['configuration', 'profile'],
  communications: ['communications'],
  tenants: ['tenants'],
  saasControl: ['tenants'],
  salesDemo: ['tenants'],
  legalSecurity: ['auditSecurity'],
};

// Platform-level tabs are controlled by permission only.
// They must not be hidden by hospital module ON/OFF settings.
export const PLATFORM_TABS = ['tenants', 'saasControl', 'salesDemo', 'legalSecurity', 'auditSecurity', 'configuration'];

export const TAB_FEATURES = {
  fhir: 'fhir',
  hl7: 'hl7',
  pacs: 'pacs',
  biometric: 'biometric',
  insurance_tpa: 'insurance_tpa',
  erp: 'erp',
  whatsapp_sms: 'whatsapp_sms',
  abdm_abha: 'abdm_abha',
  two_factor_auth: 'two_factor_auth',
  audit_compliance: 'audit_compliance',
};

export function getUserPermissions(user) {
  if (!user || typeof user !== 'object') return [];
  const rolePermissions = ROLE_PERMISSIONS[user?.role] || [];
  const customPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return Array.from(new Set([...rolePermissions, ...customPermissions]));
}

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  const userPermissions = getUserPermissions(user);
  if (userPermissions.includes('*')) return true;
  if (Array.isArray(permission)) return permission.some((p) => userPermissions.includes(p));
  return userPermissions.includes(permission);
}

export function normalizeEnabledModules(enabledModules) {
  if (!Array.isArray(enabledModules) || enabledModules.length === 0) {
    return DEFAULT_ENABLED_MODULES;
  }
  return Array.from(new Set(enabledModules));
}

export function hasModuleAccess(enabledModules, moduleIds) {
  const normalizedModules = normalizeEnabledModules(enabledModules);
  const requiredModules = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  if (!requiredModules.length) return true;
  return requiredModules.some((moduleId) => normalizedModules.includes(moduleId));
}

export function filterTabsByPermissions(user, tabs = [], enabledModules, featureFlags) {
  if (!user) return [];
  return tabs.filter(([id]) => {
    const allowedByPermission = hasPermission(user, TAB_PERMISSIONS[id]);
    const requiredFeature = TAB_FEATURES[id];
    if (requiredFeature && !hasFeature(featureFlags, requiredFeature)) return false;

    if (PLATFORM_TABS.includes(id)) {
      return allowedByPermission;
    }

    const allowedByModule = hasModuleAccess(enabledModules, TAB_MODULES[id]);
    return allowedByPermission && allowedByModule;
  });
}
