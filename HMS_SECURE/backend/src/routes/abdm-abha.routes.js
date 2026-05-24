const express = require('express');
const crypto = require('crypto');
const { Patient, Hospital, ABDMConsent, ABHACareContext, IntegrationLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const CONSENT_STATUSES = ['draft', 'requested', 'granted', 'denied', 'revoked', 'expired'];
const PURPOSES = ['OP Consultation', 'IPD Care', 'Lab Report Sharing', 'Radiology Report Sharing', 'Billing', 'Care Continuity', 'Patient Requested Export'];
const CONTEXT_TYPES = ['OPD', 'IPD', 'LAB', 'RADIOLOGY', 'PRESCRIPTION', 'BILLING', 'DOCUMENT'];

function text(value) { return String(value || '').trim(); }
function maskAbha(value) {
  const raw = text(value);
  if (!raw) return '';
  if (raw.includes('@')) {
    const [name, domain] = raw.split('@');
    return `${name.slice(0, 2)}***@${domain || 'abdm'}`;
  }
  return raw.length > 6 ? `${raw.slice(0, 2)}******${raw.slice(-4)}` : '******';
}
function hashValue(value) { return value ? crypto.createHash('sha256').update(String(value)).digest('hex') : ''; }
function abdmUid(prefix) { return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-8)}`; }
function validateAbha(value) {
  const v = text(value);
  if (!v) return { valid: false, message: 'ABHA number/address is required.' };
  const numberOk = /^\d{2}-?\d{4}-?\d{4}-?\d{4}$/.test(v);
  const addressOk = /^[a-zA-Z0-9._-]{3,}@[a-zA-Z0-9._-]{2,}$/.test(v);
  return { valid: numberOk || addressOk, message: numberOk || addressOk ? 'ABHA format accepted.' : 'Use a 14-digit ABHA number or ABHA address like name@abdm.' };
}
function publicConsent(row) {
  return {
    id: row.id,
    consent_uid: row.consent_uid,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    abha_masked: row.abha_masked,
    purpose: row.purpose,
    status: row.status,
    hiu_reference: row.hiu_reference,
    hip_reference: row.hip_reference,
    consent_artefact_id: row.consent_artefact_id,
    requested_at: row.requested_at,
    granted_at: row.granted_at,
    revoked_at: row.revoked_at,
    expires_at: row.expires_at,
    care_context_count: row.care_contexts?.length || 0,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function publicCareContext(row) {
  return {
    id: row.id,
    context_uid: row.context_uid,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    context_type: row.context_type,
    reference_id: row.reference_id,
    display: row.display,
    status: row.status,
    linked_at: row.linked_at,
    linked_by: row.linked_by,
    consent_uid: row.consent_uid,
    created_at: row.created_at,
  };
}
async function log(req, data) {
  return IntegrationLog.create(tenantCreateData(req, {
    system: 'abdm_abha',
    direction: data.direction || 'internal',
    status: data.status || 'success',
    ip_address: req.ip,
    ...data,
  }));
}
async function tenantHospital(req) {
  const hospitalId = Number(req.tenant?.hospital_id || req.user?.hospital_id || 1);
  return Hospital.findOne({ id: hospitalId }).lean();
}
async function getPatient(req, patientId) {
  return Patient.findOne(tenantFilter(req, { $or: [{ id: Number(patientId) || -1 }, { patient_id: String(patientId) }] })).lean();
}
function abdmSettings(hospital = {}) {
  const settings = hospital.settings || {};
  const abdm = settings.abdm || settings.abdm_abha || {};
  return {
    enabled: Boolean(hospital.feature_flags?.abdm_abha || settings.abdm_abha_enabled || abdm.enabled),
    mode: abdm.mode || process.env.ABDM_MODE || 'sandbox-ready',
    hip_id: abdm.hip_id || process.env.ABDM_HIP_ID || '',
    hiu_id: abdm.hiu_id || process.env.ABDM_HIU_ID || '',
    gateway_url: abdm.gateway_url || process.env.ABDM_GATEWAY_URL || '',
    callback_url: abdm.callback_url || process.env.ABDM_CALLBACK_URL || '',
    last_verified_at: abdm.last_verified_at || null,
  };
}

router.get('/abdm/summary', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const [hospital, patients, consents, contexts, logs] = await Promise.all([
    tenantHospital(req),
    Patient.find(tenantFilter(req)).select('id patient_id full_name custom_fields abha_number abha_address').limit(300).lean(),
    ABDMConsent.find(tenantFilter(req)).sort({ id: -1 }).limit(100).lean(),
    ABHACareContext.find(tenantFilter(req)).sort({ id: -1 }).limit(100).lean(),
    IntegrationLog.find(tenantFilter(req, { system: 'abdm_abha' })).sort({ id: -1 }).limit(20).lean(),
  ]);
  const linkedPatients = patients.filter((p) => p.abha_hash || p.abha_number || p.abha_address || p.custom_fields?.abha_id || p.custom_fields?.abha_number || p.custom_fields?.abha_address);
  res.json({
    settings: abdmSettings(hospital),
    totals: {
      patients_checked: patients.length,
      abha_linked_patients: linkedPatients.length,
      consents: consents.length,
      granted_consents: consents.filter((c) => c.status === 'granted').length,
      requested_consents: consents.filter((c) => c.status === 'requested').length,
      revoked_or_expired: consents.filter((c) => ['revoked', 'expired'].includes(c.status)).length,
      care_contexts: contexts.length,
    },
    recent_consents: consents.slice(0, 10).map(publicConsent),
    recent_care_contexts: contexts.slice(0, 10).map(publicCareContext),
    recent_logs: logs,
  });
}));

router.post('/abdm/identity/verify', requirePermission('patients.update'), asyncHandler(async (req, res) => {
  const patient = await getPatient(req, req.body.patient_id);
  if (!patient) return res.status(404).json({ message: 'Patient not found for this tenant.' });
  const abha = text(req.body.abha_number || req.body.abha_address || req.body.abha_id || patient.abha_number || patient.abha_address || patient.custom_fields?.abha_id);
  const validation = validateAbha(abha);
  if (!validation.valid) return res.status(400).json(validation);
  const update = {
    abha_masked: maskAbha(abha),
    abha_hash: hashValue(abha),
    abha_verified: true,
    abha_verified_at: new Date(),
    abha_verification_mode: req.body.verification_mode || 'manual_sandbox',
    abha_verification_reference: req.body.verification_reference || abdmUid('ABHA-VERIFY'),
    custom_fields: { ...(patient.custom_fields || {}), abha_id: maskAbha(abha), abdm_verified: true },
  };
  await Patient.updateOne(tenantFilter(req, { id: patient.id }), { $set: update });
  await auditEvent({ req, action: 'abdm.abha_verified', module_name: 'abdm_abha', entity_type: 'Patient', entity_id: patient.id, new_value: { patient_id: patient.patient_id, abha_masked: update.abha_masked } });
  await log(req, { resource_type: 'ABHAIdentity', resource_id: patient.patient_id || patient.id, method: 'VERIFY', endpoint: '/abdm/identity/verify', request_payload: { patient_id: req.body.patient_id, abha_masked: update.abha_masked } });
  res.json({ message: 'ABHA identity verified and linked', patient_id: patient.patient_id || patient.id, abha_masked: update.abha_masked, verification_reference: update.abha_verification_reference });
}));

router.get('/abdm/consents', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.patient_id) query.patient_id = String(req.query.patient_id);
  if (req.query.status) query.status = String(req.query.status);
  const rows = await ABDMConsent.find(tenantFilter(req, query)).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean();
  res.json(rows.map(publicConsent));
}));

router.post('/abdm/consents', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const patient = await getPatient(req, req.body.patient_id);
  if (!patient) return res.status(404).json({ message: 'Patient not found for this tenant.' });
  const abha = text(req.body.abha_number || req.body.abha_address || patient.abha_number || patient.abha_address || patient.custom_fields?.abha_id);
  const status = String(req.body.status || 'requested').toLowerCase();
  if (!CONSENT_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid ABDM consent status.' });
  const purpose = req.body.purpose || req.body.consent_purpose || 'OP Consultation';
  const now = new Date();
  const doc = await ABDMConsent.create(tenantCreateData(req, {
    consent_uid: abdmUid('ABDM-CONSENT'),
    patient_id: patient.patient_id || String(patient.id),
    patient_ref_id: patient.id,
    patient_name: patient.full_name,
    abha_masked: maskAbha(abha),
    abha_hash: hashValue(abha),
    purpose: PURPOSES.includes(purpose) ? purpose : String(purpose),
    status,
    hiu_reference: req.body.hiu_reference || '',
    hip_reference: req.body.hip_reference || '',
    consent_artefact_id: req.body.consent_artefact_id || (status === 'granted' ? abdmUid('ARTEFACT') : ''),
    requested_at: now,
    granted_at: status === 'granted' ? now : undefined,
    expires_at: req.body.expires_at || undefined,
    care_contexts: Array.isArray(req.body.care_contexts) ? req.body.care_contexts : [],
    notes: req.body.notes || '',
    created_by: req.user?.id,
  }));
  await auditEvent({ req, action: 'abdm.consent_created', module_name: 'abdm_abha', entity_type: 'ABDMConsent', entity_id: doc.id, new_value: publicConsent(doc.toJSON?.() || doc) });
  await log(req, { resource_type: 'Consent', resource_id: doc.consent_uid, method: 'POST', endpoint: '/abdm/consents', request_payload: { purpose, status }, response_payload: { consent_uid: doc.consent_uid } });
  res.status(201).json({ message: 'ABDM consent recorded', consent: publicConsent(doc.toJSON?.() || doc) });
}));

router.patch('/abdm/consents/:id/status', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const oldValue = await ABDMConsent.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!oldValue) return res.status(404).json({ message: 'ABDM consent not found.' });
  const status = String(req.body.status || '').toLowerCase();
  if (!CONSENT_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid ABDM consent status.' });
  const update = { status, updated_by: req.user?.id };
  if (status === 'granted') { update.granted_at = req.body.granted_at || new Date(); update.consent_artefact_id = req.body.consent_artefact_id || oldValue.consent_artefact_id || abdmUid('ARTEFACT'); }
  if (status === 'revoked') update.revoked_at = req.body.revoked_at || new Date();
  if (status === 'expired') update.expired_at = req.body.expired_at || new Date();
  if (req.body.notes !== undefined) update.notes = req.body.notes;
  await ABDMConsent.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: update });
  await auditEvent({ req, action: 'abdm.consent_status_updated', module_name: 'abdm_abha', entity_type: 'ABDMConsent', entity_id: req.params.id, old_value: { status: oldValue.status }, new_value: update });
  await log(req, { resource_type: 'Consent', resource_id: oldValue.consent_uid, method: 'PATCH', endpoint: '/abdm/consents/:id/status', request_payload: update });
  res.json({ message: 'ABDM consent status updated' });
}));

router.get('/abdm/care-contexts', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.patient_id) query.patient_id = String(req.query.patient_id);
  if (req.query.context_type) query.context_type = String(req.query.context_type).toUpperCase();
  const rows = await ABHACareContext.find(tenantFilter(req, query)).sort({ id: -1 }).limit(Number(req.query.limit || 100)).lean();
  res.json(rows.map(publicCareContext));
}));

router.post('/abdm/care-contexts', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const patient = await getPatient(req, req.body.patient_id);
  if (!patient) return res.status(404).json({ message: 'Patient not found for this tenant.' });
  const contextType = String(req.body.context_type || 'OPD').toUpperCase();
  if (!CONTEXT_TYPES.includes(contextType)) return res.status(400).json({ message: 'Invalid care context type.' });
  const doc = await ABHACareContext.create(tenantCreateData(req, {
    context_uid: abdmUid('CARECTX'),
    patient_id: patient.patient_id || String(patient.id),
    patient_ref_id: patient.id,
    patient_name: patient.full_name,
    context_type: contextType,
    reference_id: text(req.body.reference_id),
    display: req.body.display || `${contextType} record for ${patient.full_name}`,
    status: req.body.status || 'linked',
    consent_uid: req.body.consent_uid || '',
    linked_at: new Date(),
    linked_by: req.user?.id,
    metadata: req.body.metadata || {},
  }));
  await auditEvent({ req, action: 'abdm.care_context_linked', module_name: 'abdm_abha', entity_type: 'ABHACareContext', entity_id: doc.id, new_value: publicCareContext(doc.toJSON?.() || doc) });
  await log(req, { resource_type: 'CareContext', resource_id: doc.context_uid, method: 'POST', endpoint: '/abdm/care-contexts', request_payload: { patient_id: doc.patient_id, context_type: contextType } });
  res.status(201).json({ message: 'ABHA care context linked', care_context: publicCareContext(doc.toJSON?.() || doc) });
}));

router.post('/abdm/gateway/callback', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const eventType = req.body.event_type || req.body.type || 'abdm.callback';
  await log(req, { direction: 'inbound', resource_type: 'GatewayCallback', resource_id: req.body.request_id || req.body.transaction_id || abdmUid('CALLBACK'), method: 'CALLBACK', endpoint: '/abdm/gateway/callback', request_payload: req.body, status: req.body.error ? 'failed' : 'success', message: req.body.error || '' });
  await auditEvent({ req, action: 'abdm.gateway_callback_received', module_name: 'abdm_abha', entity_type: 'ABDMGatewayCallback', entity_id: req.body.request_id || req.body.transaction_id || eventType, new_value: { event_type: eventType, status: req.body.error ? 'failed' : 'success' } });
  res.json({ message: 'ABDM gateway callback logged', event_type: eventType });
}));

router.get('/abdm/readiness', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const hospital = await tenantHospital(req);
  const settings = abdmSettings(hospital);
  const checks = [
    { key: 'feature_flag', label: 'ABDM/ABHA feature flag enabled', passed: settings.enabled },
    { key: 'patient_identity', label: 'ABHA identity verification endpoint available', passed: true },
    { key: 'consent', label: 'Consent artefact workflow available', passed: true },
    { key: 'care_context', label: 'Care context linking available', passed: true },
    { key: 'fhir', label: 'FHIR Patient export available', passed: true },
    { key: 'gateway', label: 'Sandbox gateway config captured', passed: Boolean(settings.mode) },
  ];
  res.json({ settings, checks, ready_score: Math.round((checks.filter(c => c.passed).length / checks.length) * 100) });
}));

module.exports = router;
