const { Hospital } = require('../models');
const { runWithTenantDbName, sanitizeDbName } = require('../config/tenantDb');

const DEFAULT_HOSPITAL_ID = Number(process.env.DEFAULT_HOSPITAL_ID || 1);

function isSuperAdmin(req) {
  return req.user?.role === 'super_admin';
}

function validPositiveId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function resolveHospitalId(req) {
  const userHospitalId = validPositiveId(req.user?.hospital_id || req.user?.hospitalId);
  const headerHospitalId = validPositiveId(req.headers['x-hospital-id'] || req.headers['x-tenant-hospital-id']);

  // SaaS safety: regular hospital users must never be able to change tenant context
  // by spoofing x-hospital-id headers or by sending hospital_id in payloads.
  if (!isSuperAdmin(req) && userHospitalId) return userHospitalId;

  // Super admins can intentionally switch tenants for support/provisioning screens.
  if (isSuperAdmin(req) && headerHospitalId) return headerHospitalId;

  if (userHospitalId) return userHospitalId;
  return DEFAULT_HOSPITAL_ID;
}

async function resolveTenantDatabase(req, hospitalId) {
  const explicitDb = sanitizeDbName(req.headers['x-tenant-db'] || req.headers['x-tenant-db-name']);
  // Only super admins can force a tenant DB from headers for support/backup/tenant-switch use cases.
  if (explicitDb && isSuperAdmin(req)) return explicitDb;

  const userHospitalId = validPositiveId(req.user?.hospital_id || req.user?.hospitalId);
  const tokenDb = sanitizeDbName(req.user?.tenant_db_name || req.user?.db_name);

  // A token database is trusted only for the same hospital encoded in the token.
  if (tokenDb && userHospitalId && Number(userHospitalId) === Number(hospitalId)) return tokenDb;

  const hospital = await Hospital.findOne({ id: Number(hospitalId), status: { $in: ['active', 'trial'] }, is_deleted: { $ne: true } }).lean();
  return sanitizeDbName(hospital?.tenant_db_name || hospital?.db_name || '');
}

async function attachTenant(req, _res, next) {
  try {
    req.hospital_id = resolveHospitalId(req);
    const tenantDbName = await resolveTenantDatabase(req, req.hospital_id);
    req.tenant = {
      hospital_id: req.hospital_id,
      tenant_db_name: tenantDbName || null,
      storage_mode: tenantDbName ? 'database-per-tenant' : 'shared-database',
    };
    if (!tenantDbName) return next();
    return runWithTenantDbName(tenantDbName, () => next());
  } catch (error) {
    return next(error);
  }
}

function tenantFilter(req, extra = {}) {
  const hospitalId = Number(req.hospital_id || resolveHospitalId(req));
  const base = { ...extra };

  // In database-per-tenant mode the selected database already isolates data.
  // Keep hospital_id in records for audit/reporting, but do not hide existing tenant DB records if hospital_id is missing.
  if (req.tenant?.tenant_db_name) {
    return base;
  }

  // Backward compatibility: old records created before tenant support may not have hospital_id.
  // Keep those visible only to the default hospital so existing deployments don't lose data.
  if (hospitalId === DEFAULT_HOSPITAL_ID) {
    return {
      ...base,
      $or: [
        { hospital_id: hospitalId },
        { hospital_id: { $exists: false } },
        { hospital_id: null },
      ],
    };
  }

  return { ...base, hospital_id: hospitalId };
}

function tenantCreateData(req, data = {}) {
  const hospitalId = Number(req.hospital_id || resolveHospitalId(req));
  return {
    ...data,
    // Never trust client-supplied hospital_id for tenant-scoped creates.
    hospital_id: hospitalId,
  };
}

function withTenantCreate(req, _res, next) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = tenantCreateData(req, req.body);
  }
  return next();
}

module.exports = {
  DEFAULT_HOSPITAL_ID,
  isSuperAdmin,
  validPositiveId,
  resolveHospitalId,
  resolveTenantDatabase,
  attachTenant,
  tenantFilter,
  tenantCreateData,
  withTenantCreate,
};
