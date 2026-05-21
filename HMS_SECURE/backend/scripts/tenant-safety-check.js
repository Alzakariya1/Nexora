const assert = require('assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local_tenant_safety_secret';

const {
  resolveHospitalId,
  tenantCreateData,
} = require('../src/middleware/tenant');
const { sanitizeDbName } = require('../src/config/tenantDb');
const { hasPermission } = require('../src/middleware/auth');

function req({ role = 'admin', userHospital = 2, headerHospital = 9, body = {} } = {}) {
  return {
    user: { id: 10, role, hospital_id: userHospital, permissions: role === 'super_admin' ? ['*'] : [] },
    headers: { 'x-hospital-id': headerHospital },
    body,
  };
}

// Regular tenant users must remain pinned to the hospital in their token.
assert.strictEqual(resolveHospitalId(req({ role: 'admin', userHospital: 2, headerHospital: 9 })), 2);
assert.strictEqual(resolveHospitalId(req({ role: 'hospital_admin', userHospital: 3, headerHospital: 99 })), 3);

// Super admin tenant switching remains available for SaaS support screens.
assert.strictEqual(resolveHospitalId(req({ role: 'super_admin', userHospital: 1, headerHospital: 9 })), 9);

// Client supplied hospital_id must not override tenant-scoped create payloads.
const createPayload = tenantCreateData(req({ role: 'admin', userHospital: 4, headerHospital: 8 }), { hospital_id: 99, full_name: 'Cross Tenant Attempt' });
assert.strictEqual(createPayload.hospital_id, 4);
assert.strictEqual(createPayload.full_name, 'Cross Tenant Attempt');

// Master SaaS permissions are effectively platform-only after route role gates.
assert.strictEqual(hasPermission({ role: 'super_admin' }, 'hospital.manage'), true);
assert.strictEqual(hasPermission({ role: 'hospital_admin' }, 'hospital.manage'), false);

// Tenant DB names must be sanitized before use in connection strings.
assert.strictEqual(sanitizeDbName('../Prod Hospital!!'), 'prod_hospital');

console.log('Tenant safety check passed. Header spoofing, create scoping and platform permission assumptions are safe.');
