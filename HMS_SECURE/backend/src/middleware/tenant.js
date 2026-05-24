const { Hospital } = require('../models');
const { runWithTenantDbName, sanitizeDbName } = require('../config/tenantDb');

const DEFAULT_HOSPITAL_ID = Number(process.env.DEFAULT_HOSPITAL_ID || 1);

function resolveHospitalId(req) {
  const headerHospitalId = Number(req.headers['x-hospital-id'] || req.headers['x-tenant-hospital-id']);
  const userHospitalId = Number(req.user?.hospital_id || req.user?.hospitalId);
  if (Number.isFinite(headerHospitalId) && headerHospitalId > 0) return headerHospitalId;
  if (Number.isFinite(userHospitalId) && userHospitalId > 0) return userHospitalId;
  return DEFAULT_HOSPITAL_ID;
}

async function resolveTenantDatabase(req, hospitalId) {
  const explicitDb = sanitizeDbName(req.headers['x-tenant-db'] || req.headers['x-tenant-db-name']);
  // Only super admins can force a tenant DB from headers for support/backup/tenant-switch use cases.
  if (explicitDb && req.user?.role === 'super_admin') return explicitDb;
  const tokenDb = sanitizeDbName(req.user?.tenant_db_name || req.user?.db_name);
  if (tokenDb && Number(req.user?.hospital_id) === Number(hospitalId)) return tokenDb;
  const hospital = await Hospital.findOne({ id: Number(hospitalId) }).lean();
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
  return {
    ...data,
    hospital_id: Number(data.hospital_id || req.hospital_id || resolveHospitalId(req)),
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
  resolveHospitalId,
  resolveTenantDatabase,
  attachTenant,
  tenantFilter,
  tenantCreateData,
  withTenantCreate,
};
