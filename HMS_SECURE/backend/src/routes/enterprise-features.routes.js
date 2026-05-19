const express = require('express');
const { EnterpriseFeatureRecord, IntegrationLog, SecuritySetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const safeFeature = (v='') => String(v).trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
const flagKey = (feature) => `${safeFeature(feature)}_enabled`;

router.get('/enterprise-features/:feature/summary', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const base = tenantFilter(req, { feature_key: feature });
  const [total, active, pending, records, logs, setting] = await Promise.all([
    EnterpriseFeatureRecord.countDocuments(base),
    EnterpriseFeatureRecord.countDocuments(tenantFilter(req, { feature_key: feature, status: { $in: ['active', 'enabled', 'success', 'approved', 'connected', 'online'] } })),
    EnterpriseFeatureRecord.countDocuments(tenantFilter(req, { feature_key: feature, status: { $in: ['pending', 'open', 'draft', 'queued', 'review'] } })),
    EnterpriseFeatureRecord.find(base).sort({ created_at: -1 }).limit(10).lean(),
    IntegrationLog.find(tenantFilter(req, { system: feature })).sort({ created_at: -1 }).limit(10).lean(),
    SecuritySetting.findOne(tenantFilter(req, { setting_key: flagKey(feature) })).lean(),
  ]);
  res.json({ feature_key: feature, enabled: setting ? String(setting.setting_value) !== 'false' : true, total, active, pending, records, logs });
}));

router.get('/enterprise-features/:feature/records', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const query = tenantFilter(req, { feature_key: feature });
  if (req.query.type) query.record_type = req.query.type;
  if (req.query.status) query.status = req.query.status;
  res.json(await EnterpriseFeatureRecord.find(query).sort({ created_at: -1 }).limit(500).lean());
}));

router.post('/enterprise-features/:feature/records', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const doc = await EnterpriseFeatureRecord.create(tenantCreateData(req, {
    ...req.body,
    feature_key: feature,
    record_type: req.body.record_type || req.body.type || 'item',
    created_by: req.user?.id,
    updated_by: req.user?.id,
  }));
  await IntegrationLog.create(tenantCreateData(req, {
    system: feature,
    direction: 'internal',
    resource_type: doc.record_type,
    resource_id: String(doc.id),
    method: 'CREATE',
    endpoint: `/enterprise-features/${feature}/records`,
    status: 'success',
    request_payload: req.body,
  }));
  await auditEvent({ req, action: `Created ${feature} ${doc.record_type}`, module_name: feature, entity_type: 'enterprise_feature_record', entity_id: doc.id, new_value: doc.toJSON ? doc.toJSON() : doc });
  res.status(201).json(doc);
}));

router.patch('/enterprise-features/:feature/records/:id', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const before = await EnterpriseFeatureRecord.findOne(tenantFilter(req, { feature_key: feature, id: Number(req.params.id) })).lean();
  const doc = await EnterpriseFeatureRecord.findOneAndUpdate(
    tenantFilter(req, { feature_key: feature, id: Number(req.params.id) }),
    { $set: { ...req.body, updated_by: req.user?.id } },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: 'Record not found' });
  await auditEvent({ req, action: `Updated ${feature} record`, module_name: feature, entity_type: 'enterprise_feature_record', entity_id: doc.id, old_value: before, new_value: doc });
  res.json(doc);
}));

router.delete('/enterprise-features/:feature/records/:id', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const doc = await EnterpriseFeatureRecord.findOneAndDelete(tenantFilter(req, { feature_key: feature, id: Number(req.params.id) }));
  if (!doc) return res.status(404).json({ message: 'Record not found' });
  await auditEvent({ req, action: `Deleted ${feature} record`, module_name: feature, entity_type: 'enterprise_feature_record', entity_id: doc.id });
  res.json({ message: 'Record deleted' });
}));

router.put('/enterprise-features/:feature/enabled', requirePermission('configuration.manage'), asyncHandler(async (req, res) => {
  const feature = safeFeature(req.params.feature);
  const value = String(req.body.enabled !== false);
  await SecuritySetting.findOneAndUpdate(
    tenantFilter(req, { setting_key: flagKey(feature) }),
    { $set: tenantCreateData(req, { setting_key: flagKey(feature), setting_value: value, category: 'advanced_feature', description: `${feature} feature flag`, updated_by: req.user?.id }) },
    { upsert: true, new: true }
  );
  await auditEvent({ req, action: `${feature} feature ${value === 'true' ? 'enabled' : 'disabled'}`, module_name: feature, entity_type: 'feature_flag', entity_id: feature });
  res.json({ feature_key: feature, enabled: value === 'true' });
}));

module.exports = router;
