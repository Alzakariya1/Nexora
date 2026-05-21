const jwt = require('jsonwebtoken');
const { getUserPermissions, hasPermission } = require('../config/permissions');
const { auditEvent } = require('../utils/audit');
const { AuthSession, User } = require('../models');

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Access denied. Token missing.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    if (decoded.session_id) {
      const session = await AuthSession.findOne({ session_id: decoded.session_id, user_id: decoded.id, status: 'active' });
      if (!session || (session.expires_at && session.expires_at < new Date())) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
      }
      const user = await User.findOne({ id: decoded.id, status: 'active' });
      if (!user) return res.status(401).json({ message: 'User inactive. Please login again.' });
      if (user.password_changed_at && decoded.iat && new Date(decoded.iat * 1000) < new Date(user.password_changed_at)) {
        await AuthSession.updateOne({ session_id: decoded.session_id }, { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: decoded.id } });
        return res.status(401).json({ message: 'Password changed. Please login again.' });
      }
    }
    req.user = {
      ...decoded,
      permissions: getUserPermissions(decoded),
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      auditEvent({ req, action: `Role access denied: ${roles.join(',')}`, module_name: 'security', status: 'denied', severity: 'warning' });
      return res.status(403).json({ message: 'Permission denied.' });
    }
    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) {
      auditEvent({ req, action: `Permission denied: ${Array.isArray(permission) ? permission.join(',') : permission}`, module_name: 'security', status: 'denied', severity: 'warning' });
      return res.status(403).json({ message: 'Permission denied.', requiredPermission: permission });
    }
    return next();
  };
}

module.exports = { verifyToken, allowRoles, requirePermission, hasPermission, getUserPermissions };
