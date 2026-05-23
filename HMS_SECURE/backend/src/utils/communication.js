const { CommunicationLog, CommunicationTemplate } = require('../models');
const { tenantCreateData, tenantFilter } = require('../middleware/tenant');

const CHANNELS = ['in_app', 'email', 'sms', 'whatsapp'];
const FINAL_STATUSES = ['sent', 'delivered', 'read', 'skipped', 'cancelled'];

function normalizeChannel(channel) {
  const clean = String(channel || 'in_app').toLowerCase().trim();
  return CHANNELS.includes(clean) ? clean : 'in_app';
}

function normalizeContact(channel, contact) {
  const value = String(contact || '').trim();
  if (!value) return '';
  if (channel === 'email') return value.toLowerCase();
  if (channel === 'sms' || channel === 'whatsapp') return value.replace(/[^0-9+]/g, '');
  return value;
}

function channelEnabled(channel) {
  if (channel === 'in_app') return true;
  if (channel === 'email') return Boolean(process.env.SMTP_HOST || process.env.EMAIL_PROVIDER);
  if (channel === 'sms') return Boolean(process.env.SMS_PROVIDER || process.env.SMS_API_KEY);
  if (channel === 'whatsapp') return Boolean(process.env.WHATSAPP_PROVIDER || process.env.WHATSAPP_TOKEN);
  return false;
}

function providerName(channel) {
  if (channel === 'in_app') return 'internal';
  if (channel === 'email') return process.env.EMAIL_PROVIDER || 'smtp';
  if (channel === 'sms') return process.env.SMS_PROVIDER || 'sms_gateway';
  if (channel === 'whatsapp') return process.env.WHATSAPP_PROVIDER || 'whatsapp_business';
  return null;
}

function renderTemplate(text = '', variables = {}) {
  return String(text || '').replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key) => {
    const value = key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), variables);
    return value === undefined || value === null ? '' : String(value);
  });
}

async function applyTemplate(req, payload = {}) {
  if (!payload.template_key) return payload;
  const channel = normalizeChannel(payload.channel);
  const template = await CommunicationTemplate.findOne(tenantFilter(req, {
    template_key: payload.template_key,
    channel,
    status: 'approved',
  })).lean();
  if (!template) return payload;
  const variables = payload.variables || {};
  return {
    ...payload,
    title: payload.title || renderTemplate(template.title_template, variables),
    message: payload.message || renderTemplate(template.message_template, variables),
    template_key: template.template_key,
    template_version: template.version,
    provider_template_id: template.provider_template_id,
  };
}

async function queueCommunication(req, payload = {}) {
  const channel = normalizeChannel(payload.channel);
  const resolved = await applyTemplate(req, { ...payload, channel });
  const enabled = channelEnabled(channel);
  const scheduledFor = resolved.scheduled_for ? new Date(resolved.scheduled_for) : null;
  const isFuture = scheduledFor && scheduledFor.getTime() > Date.now();
  const status = enabled ? (channel === 'in_app' && !isFuture ? 'sent' : 'queued') : 'skipped';
  const retryCount = Number(resolved.retry_count || 0);
  const log = await CommunicationLog.create(tenantCreateData(req, {
    channel,
    recipient_type: resolved.recipient_type || 'patient',
    recipient_id: resolved.recipient_id || null,
    recipient_name: resolved.recipient_name || null,
    recipient_contact: resolved.recipient_contact || null,
    contact_normalized: normalizeContact(channel, resolved.recipient_contact),
    title: resolved.title || 'Notification',
    message: resolved.message || '',
    template_key: resolved.template_key || null,
    template_version: resolved.template_version || null,
    module: resolved.module || 'system',
    entity_type: resolved.entity_type || null,
    entity_id: resolved.entity_id || null,
    status,
    provider: resolved.provider || providerName(channel),
    provider_message_id: resolved.provider_message_id || null,
    provider_payload: resolved.provider_payload || {},
    error_message: enabled ? null : `${channel.toUpperCase()} provider is not configured. Message kept as skipped log.`,
    scheduled_for: scheduledFor,
    retry_count: retryCount,
    next_retry_at: resolved.next_retry_at || null,
    consent_checked: Boolean(resolved.consent_checked || false),
    sent_at: status === 'sent' ? new Date() : null,
    created_by: req.user?.id || null,
  }));
  return log;
}

function nextRetryDate(retryCount) {
  const minutes = Math.min(60, Math.max(5, (Number(retryCount || 0) + 1) * 10));
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = {
  CHANNELS,
  FINAL_STATUSES,
  normalizeChannel,
  normalizeContact,
  channelEnabled,
  providerName,
  renderTemplate,
  queueCommunication,
  nextRetryDate,
};
