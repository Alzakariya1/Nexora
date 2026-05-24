const { AuditLog, LoginHistory } = require('../models');

const DEFAULT_HOSPITAL_ID = Number(process.env.DEFAULT_HOSPITAL_ID || 1);

function getClientMeta(req = {}) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim();
  return {
    ip_address: ip || null,
    user_agent: req.headers?.['user-agent'] || null,
    method: req.method || null,
    path: req.originalUrl || req.url || null,
  };
}

function safeJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value, (key, val) => {
      if (['password', 'oldPassword', 'newPassword', 'token', 'reset_token', 'resetToken', 'authorization'].includes(key)) return '[REDACTED]';
      return val;
    }));
  } catch (_) {
    return String(value);
  }
}

async function auditEvent({ req, userId, hospital_id, action, module_name = 'system', entity_type = null, entity_id = null, old_value = null, new_value = null, status = 'success', severity = 'info' }) {
  try {
    const actor = req?.user || {};
    const meta = getClientMeta(req);
    await AuditLog.create({
      hospital_id: Number(hospital_id || actor.hospital_id || DEFAULT_HOSPITAL_ID),
      user_id: userId || actor.id || null,
      user_role: actor.role || null,
      action,
      module_name,
      entity_type,
      entity_id: entity_id === undefined || entity_id === null ? null : String(entity_id),
      old_value: safeJson(old_value),
      new_value: safeJson(new_value),
      status,
      severity,
      ...meta,
    });
  } catch (_) {
    // Audit logging must never break production workflows.
  }
}

async function loginHistoryEvent({ req, user = null, email = '', status = 'success', reason = '' }) {
  try {
    const meta = getClientMeta(req);
    await LoginHistory.create({
      hospital_id: Number(user?.hospital_id || req?.user?.hospital_id || DEFAULT_HOSPITAL_ID),
      user_id: user?.id || null,
      email: email || user?.email || null,
      role: user?.role || null,
      status,
      reason,
      logged_at: new Date(),
      ...meta,
    });
  } catch (_) { }
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

module.exports = { auditEvent, loginHistoryEvent, getClientMeta, csvEscape };
