const { CommunicationLog } = require('../models');
const { tenantCreateData } = require('../middleware/tenant');

const CHANNELS = ['in_app', 'email', 'sms', 'whatsapp'];

function normalizeChannel(channel) {
  const clean = String(channel || 'in_app').toLowerCase();
  return CHANNELS.includes(clean) ? clean : 'in_app';
}

function channelEnabled(channel) {
  if (channel === 'in_app') return true;
  if (channel === 'email') return Boolean(process.env.SMTP_HOST || process.env.EMAIL_PROVIDER);
  if (channel === 'sms') return Boolean(process.env.SMS_PROVIDER || process.env.SMS_API_KEY);
  if (channel === 'whatsapp') return Boolean(process.env.WHATSAPP_PROVIDER || process.env.WHATSAPP_TOKEN);
  return false;
}

async function queueCommunication(req, payload = {}) {
  const channel = normalizeChannel(payload.channel);
  const enabled = channelEnabled(channel);
  const status = enabled ? (channel === 'in_app' ? 'sent' : 'queued') : 'skipped';
  const log = await CommunicationLog.create(tenantCreateData(req, {
    channel,
    recipient_type: payload.recipient_type || 'patient',
    recipient_id: payload.recipient_id || null,
    recipient_name: payload.recipient_name || null,
    recipient_contact: payload.recipient_contact || null,
    title: payload.title || 'Notification',
    message: payload.message || '',
    module: payload.module || 'system',
    entity_type: payload.entity_type || null,
    entity_id: payload.entity_id || null,
    status,
    provider: payload.provider || (channel === 'in_app' ? 'internal' : null),
    error_message: enabled ? null : `${channel.toUpperCase()} provider is not configured. Message kept as skipped log.`,
    scheduled_for: payload.scheduled_for || null,
    sent_at: status === 'sent' ? new Date() : null,
    created_by: req.user?.id || null,
  }));
  return log;
}

module.exports = { CHANNELS, channelEnabled, queueCommunication };
