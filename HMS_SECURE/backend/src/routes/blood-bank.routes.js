const express = require('express');
const {
  BloodDonor,
  BloodUnit,
  BloodRequisition,
  BloodCrossMatch,
  BloodIssueRecord,
  BloodReservation,
  Patient,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());
const toNum = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));
const toDate = (value) => (value ? new Date(value) : undefined);
const validGroups = new Set(['A+','A-','B+','B-','AB+','AB-','O+','O-']);
const componentTypes = new Set(['whole_blood','packed_rbc','platelets','plasma','cryoprecipitate']);
const unitStatuses = new Set(['available','reserved','issued','returned','discarded','expired','quarantined']);
const screenStatuses = new Set(['pending','cleared','rejected','quarantined']);
const donorStatuses = new Set(['pending','eligible','deferred','rejected']);
const requisitionStatuses = new Set(['requested','approved','rejected','fulfilled','cancelled']);
const compatibilityStatuses = new Set(['pending','compatible','incompatible']);
const issueTypes = new Set(['issue','return','discard','emergency_issue']);
const priorities = new Set(['routine','urgent','stat','emergency']);

const normalize = (value, allowed, fallback) => {
  const v = clean(value).toLowerCase();
  return allowed.has(v) ? v : fallback;
};
const normalizeBloodGroup = (value) => {
  const group = clean(value).toUpperCase().replace(/\s+/g, '');
  return validGroups.has(group) ? group : group;
};
const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const compatibleDonorMap = {
  'O-': ['O-'],
  'O+': ['O-','O+'],
  'A-': ['O-','A-'],
  'A+': ['O-','O+','A-','A+'],
  'B-': ['O-','B-'],
  'B+': ['O-','O+','B-','B+'],
  'AB-': ['O-','A-','B-','AB-'],
  'AB+': ['O-','O+','A-','A+','B-','B+','AB-','AB+'],
};
function isCompatible(patientGroup, unitGroup, component = 'packed_rbc') {
  const p = normalizeBloodGroup(patientGroup);
  const u = normalizeBloodGroup(unitGroup);
  if (!p || !u) return { compatible: false, warning: 'Patient and unit blood group are required for compatibility validation.' };
  if (component === 'plasma') {
    // Plasma compatibility is reverse of RBC logic in simplified operational guardrail.
    const ok = compatibleDonorMap[u]?.includes(p);
    return { compatible: Boolean(ok), warning: ok ? '' : `Plasma compatibility warning: ${u} plasma may be incompatible with ${p} recipient.` };
  }
  const ok = compatibleDonorMap[p]?.includes(u);
  return { compatible: Boolean(ok), warning: ok ? '' : `Compatibility warning: ${u} unit is not normally compatible with ${p} recipient.` };
}
function unitRuntimeStatus(unit) {
  if (!unit) return 'unknown';
  if (unit.expiry_date && new Date(unit.expiry_date).getTime() < Date.now() && ['available','reserved'].includes(unit.status)) return 'expired';
  return unit.status || 'available';
}
async function audit(req, action, entity_type, entity_id, metadata = {}, severity = 'info') {
  await auditEvent({ req, action, module_name: 'blood_bank', entity_type, entity_id, new_value: metadata, metadata, status: 'success', severity });
}
async function findPatient(req, patient_id) {
  if (!clean(patient_id)) return null;
  return Patient.findOne(tenantFilter(req, { patient_id: clean(patient_id) })).lean();
}

router.get('/blood-bank/dashboard', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const base = tenantFilter(req);
  const [donors, units, requisitions, matches, issues, reservations] = await Promise.all([
    BloodDonor.find(base).lean(),
    BloodUnit.find(base).lean(),
    BloodRequisition.find(base).lean(),
    BloodCrossMatch.find(base).lean(),
    BloodIssueRecord.find(base).lean(),
    BloodReservation.find(base).lean(),
  ]);
  const now = Date.now();
  const nearExpiryMs = Number(req.query.near_expiry_days || 7) * 24 * 60 * 60 * 1000;
  const inventoryByGroup = {};
  for (const unit of units) {
    const status = unitRuntimeStatus(unit);
    const key = `${unit.blood_group || 'Unknown'}|${unit.component_type || 'whole_blood'}`;
    inventoryByGroup[key] ||= { blood_group: unit.blood_group || 'Unknown', component_type: unit.component_type || 'whole_blood', available: 0, reserved: 0, issued: 0, quarantined: 0, expired: 0, total: 0 };
    inventoryByGroup[key].total += 1;
    if (inventoryByGroup[key][status] !== undefined) inventoryByGroup[key][status] += 1;
  }
  const usageTrend = issues.reduce((acc, item) => {
    const day = new Date(item.created_at || item.issued_at || Date.now()).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  res.json({
    donors: donors.length,
    eligibleDonors: donors.filter((d) => d.eligibility_status === 'eligible').length,
    availableUnits: units.filter((u) => unitRuntimeStatus(u) === 'available' && u.screening_status === 'cleared').length,
    reservedUnits: units.filter((u) => unitRuntimeStatus(u) === 'reserved').length,
    issuedUnits: units.filter((u) => unitRuntimeStatus(u) === 'issued').length,
    quarantinedUnits: units.filter((u) => ['quarantined','rejected'].includes(u.screening_status) || unitRuntimeStatus(u) === 'quarantined').length,
    expiringSoon: units.filter((u) => u.expiry_date && new Date(u.expiry_date).getTime() >= now && new Date(u.expiry_date).getTime() <= now + nearExpiryMs && ['available','reserved'].includes(u.status)).length,
    expiredUnits: units.filter((u) => unitRuntimeStatus(u) === 'expired').length,
    pendingRequisitions: requisitions.filter((r) => r.status === 'requested').length,
    emergencyRequisitions: requisitions.filter((r) => ['emergency','stat'].includes(r.priority) && ['requested','approved'].includes(r.status)).length,
    pendingCrossMatches: matches.filter((m) => m.compatibility_result === 'pending').length,
    incompatibleCrossMatches: matches.filter((m) => m.compatibility_result === 'incompatible').length,
    activeReservations: reservations.filter((r) => r.status === 'active').length,
    wastageCount: issues.filter((i) => ['discard','discarded'].includes(i.issue_type) || i.status === 'discarded').length,
    inventoryByGroup: Object.values(inventoryByGroup).sort((a,b) => `${a.blood_group}${a.component_type}`.localeCompare(`${b.blood_group}${b.component_type}`)),
    usageTrend: Object.entries(usageTrend).sort().map(([date, count]) => ({ date, count })),
    recentIssues: issues.sort((a,b) => (b.id || 0) - (a.id || 0)).slice(0, 8),
  });
}));

router.get('/blood-bank/donors', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.blood_group) where.blood_group = normalizeBloodGroup(req.query.blood_group);
  if (req.query.eligibility_status) where.eligibility_status = normalize(req.query.eligibility_status, donorStatuses, 'pending');
  res.json(await BloodDonor.find(tenantFilter(req, where)).sort({ id: -1 }).limit(300).lean());
}));
router.post('/blood-bank/donors', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!clean(body.full_name)) return res.status(400).json({ message: 'full_name is required' });
  const donor = await BloodDonor.create(tenantCreateData(req, {
    donor_uid: clean(body.donor_uid) || uid('DON'), full_name: clean(body.full_name), age: toNum(body.age), gender: clean(body.gender), phone: clean(body.phone), email: clean(body.email), address: clean(body.address), blood_group: normalizeBloodGroup(body.blood_group), last_donation_date: toDate(body.last_donation_date), next_eligible_date: toDate(body.next_eligible_date), eligibility_status: normalize(body.eligibility_status, donorStatuses, 'pending'), screening_status: normalize(body.screening_status, screenStatuses, 'pending'), screening_notes: clean(body.screening_notes), medical_history: clean(body.medical_history), consent_recorded: body.consent_recorded === true || body.consent_recorded === 'true', status: clean(body.status) || 'active', created_by: req.user?.id,
  }));
  await audit(req, 'blood_bank.donor.created', 'BloodDonor', donor.id, { blood_group: donor.blood_group });
  res.status(201).json(donor);
}));
router.patch('/blood-bank/donors/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.blood_group) updates.blood_group = normalizeBloodGroup(updates.blood_group);
  if (updates.eligibility_status) updates.eligibility_status = normalize(updates.eligibility_status, donorStatuses, 'pending');
  if (updates.screening_status) updates.screening_status = normalize(updates.screening_status, screenStatuses, 'pending');
  const donor = await BloodDonor.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!donor) return res.status(404).json({ message: 'Blood donor not found' });
  await audit(req, 'blood_bank.donor.updated', 'BloodDonor', donor.id, { eligibility_status: donor.eligibility_status });
  res.json(donor);
}));

router.get('/blood-bank/units', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = normalize(req.query.status, unitStatuses, 'available');
  if (req.query.blood_group) where.blood_group = normalizeBloodGroup(req.query.blood_group);
  if (req.query.component_type) where.component_type = normalize(req.query.component_type, componentTypes, 'whole_blood');
  res.json(await BloodUnit.find(tenantFilter(req, where)).sort({ expiry_date: 1, id: -1 }).limit(500).lean());
}));
router.post('/blood-bank/units', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const bag = clean(body.bag_number);
  if (bag) {
    const existing = await BloodUnit.findOne(tenantFilter(req, { bag_number: bag })).lean();
    if (existing) return res.status(409).json({ message: 'Duplicate bag number is not allowed for this hospital.' });
  }
  const unit = await BloodUnit.create(tenantCreateData(req, {
    unit_uid: clean(body.unit_uid) || uid('BU'), bag_number: bag || undefined, donor_id: toNum(body.donor_id), donor_uid: clean(body.donor_uid), blood_group: normalizeBloodGroup(body.blood_group), component_type: normalize(body.component_type, componentTypes, 'whole_blood'), volume_ml: toNum(body.volume_ml) || 450, collection_date: toDate(body.collection_date) || new Date(), expiry_date: toDate(body.expiry_date), storage_location: clean(body.storage_location), storage_temperature_c: toNum(body.storage_temperature_c), screening_status: normalize(body.screening_status, screenStatuses, 'pending'), status: normalize(body.status, unitStatuses, 'available'), notes: clean(body.notes), created_by: req.user?.id,
  }));
  if (unit.donor_id) await BloodDonor.updateOne(tenantFilter(req, { id: unit.donor_id }), { $inc: { donor_frequency_count: 1 }, $set: { last_donation_date: unit.collection_date, updated_by: req.user?.id } });
  await audit(req, 'blood_bank.unit.created', 'BloodUnit', unit.id, { unit_uid: unit.unit_uid, bag_number: unit.bag_number, blood_group: unit.blood_group });
  res.status(201).json(unit);
}));
router.patch('/blood-bank/units/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = normalize(updates.status, unitStatuses, 'available');
  if (updates.screening_status) updates.screening_status = normalize(updates.screening_status, screenStatuses, 'pending');
  if (updates.blood_group) updates.blood_group = normalizeBloodGroup(updates.blood_group);
  if (updates.expiry_date) updates.expiry_date = toDate(updates.expiry_date);
  const unit = await BloodUnit.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!unit) return res.status(404).json({ message: 'Blood unit not found' });
  await audit(req, 'blood_bank.unit.updated', 'BloodUnit', unit.id, { status: unit.status, screening_status: unit.screening_status });
  res.json(unit);
}));

router.get('/blood-bank/requisitions', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = normalize(req.query.status, requisitionStatuses, 'requested');
  res.json(await BloodRequisition.find(tenantFilter(req, where)).sort({ id: -1 }).limit(300).lean());
}));
router.post('/blood-bank/requisitions', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const patient = await findPatient(req, body.patient_id);
  const patientName = clean(body.patient_name) || patient?.full_name || '';
  const patientGroup = normalizeBloodGroup(body.patient_blood_group || patient?.blood_group);
  if (!patientName && !clean(body.patient_id)) return res.status(400).json({ message: 'patient_id or patient_name is required' });
  if (!patientGroup) return res.status(400).json({ message: 'patient_blood_group is required' });
  if (!clean(body.requested_by_doctor_id)) return res.status(400).json({ message: 'requested_by_doctor_id is required for authorization traceability' });
  const reqn = await BloodRequisition.create(tenantCreateData(req, {
    requisition_uid: clean(body.requisition_uid) || uid('BR'), patient_id: clean(body.patient_id), patient_name: patientName, patient_blood_group: patientGroup, component_type: normalize(body.component_type, componentTypes, 'packed_rbc'), units_requested: Math.max(1, toNum(body.units_requested) || 1), priority: normalize(body.priority, priorities, 'routine'), indication: clean(body.indication), requested_by_doctor_id: clean(body.requested_by_doctor_id), request_source: clean(body.request_source) || 'ipd', status: 'requested', notes: clean(body.notes), created_by: req.user?.id,
  }));
  await audit(req, 'blood_bank.requisition.created', 'BloodRequisition', reqn.id, { priority: reqn.priority, patient_blood_group: reqn.patient_blood_group });
  res.status(201).json(reqn);
}));
router.post('/blood-bank/requisitions/:id/approve', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const reqn = await BloodRequisition.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id), status: 'requested' }), { $set: { status: 'approved', approved_by: req.user?.id, approved_at: new Date(), updated_by: req.user?.id } }, { new: true });
  if (!reqn) return res.status(404).json({ message: 'Requested requisition not found' });
  await audit(req, 'blood_bank.requisition.approved', 'BloodRequisition', reqn.id, { approved_by: req.user?.id });
  res.json(reqn);
}));
router.post('/blood-bank/requisitions/:id/reject', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const reqn = await BloodRequisition.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id), status: 'requested' }), { $set: { status: 'rejected', rejected_by: req.user?.id, rejected_at: new Date(), rejection_reason: clean(req.body?.reason), updated_by: req.user?.id } }, { new: true });
  if (!reqn) return res.status(404).json({ message: 'Requested requisition not found' });
  await audit(req, 'blood_bank.requisition.rejected', 'BloodRequisition', reqn.id, { reason: reqn.rejection_reason }, 'warning');
  res.json(reqn);
}));

router.get('/blood-bank/cross-matches', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.compatibility_result = normalize(req.query.status, compatibilityStatuses, 'pending');
  res.json(await BloodCrossMatch.find(tenantFilter(req, where)).sort({ id: -1 }).limit(300).lean());
}));
router.post('/blood-bank/cross-matches', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const unit = await BloodUnit.findOne(tenantFilter(req, { id: toNum(body.unit_id) })).lean();
  if (!unit) return res.status(404).json({ message: 'Blood unit not found' });
  const reqn = body.requisition_id ? await BloodRequisition.findOne(tenantFilter(req, { id: toNum(body.requisition_id) })).lean() : null;
  const patientGroup = normalizeBloodGroup(body.patient_blood_group || reqn?.patient_blood_group);
  const check = isCompatible(patientGroup, unit.blood_group, unit.component_type);
  const requestedResult = normalize(body.compatibility_result, compatibilityStatuses, 'pending');
  const result = requestedResult === 'compatible' && !check.compatible ? 'incompatible' : requestedResult;
  const match = await BloodCrossMatch.create(tenantCreateData(req, {
    requisition_id: reqn?.id || toNum(body.requisition_id), patient_id: clean(body.patient_id) || reqn?.patient_id, patient_name: clean(body.patient_name) || reqn?.patient_name, patient_blood_group: patientGroup, unit_id: unit.id, unit_blood_group: unit.blood_group, component_type: unit.component_type, request_source: clean(body.request_source) || reqn?.request_source, requested_by_doctor_id: clean(body.requested_by_doctor_id) || reqn?.requested_by_doctor_id, compatibility_result: result, compatibility_warning: check.warning, test_notes: clean(body.test_notes), requested_by: req.user?.id, tested_by: result === 'pending' ? undefined : req.user?.id, tested_at: result === 'pending' ? undefined : new Date(),
  }));
  if (result === 'compatible' && unit.status === 'available' && unit.screening_status === 'cleared') {
    await BloodUnit.updateOne(tenantFilter(req, { id: unit.id }), { $set: { status: 'reserved', reserved_for_patient_id: match.patient_id, updated_by: req.user?.id } });
  }
  await audit(req, 'blood_bank.cross_match.created', 'BloodCrossMatch', match.id, { unit_id: unit.id, result, warning: check.warning }, result === 'incompatible' ? 'warning' : 'info');
  res.status(201).json(match);
}));
router.patch('/blood-bank/cross-matches/:id', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const match = await BloodCrossMatch.findOne(tenantFilter(req, { id: Number(req.params.id) }));
  if (!match) return res.status(404).json({ message: 'Cross-match not found' });
  const unit = await BloodUnit.findOne(tenantFilter(req, { id: match.unit_id })).lean();
  const result = normalize(req.body?.compatibility_result, compatibilityStatuses, match.compatibility_result || 'pending');
  const check = isCompatible(match.patient_blood_group, unit?.blood_group, unit?.component_type);
  match.compatibility_result = result === 'compatible' && !check.compatible ? 'incompatible' : result;
  match.compatibility_warning = check.warning;
  match.test_notes = clean(req.body?.test_notes) || match.test_notes;
  match.tested_by = req.user?.id;
  match.tested_at = new Date();
  await match.save();
  if (match.compatibility_result === 'compatible' && unit?.status === 'available' && unit?.screening_status === 'cleared') await BloodUnit.updateOne(tenantFilter(req, { id: unit.id }), { $set: { status: 'reserved', reserved_for_patient_id: match.patient_id, updated_by: req.user?.id } });
  await audit(req, 'blood_bank.cross_match.updated', 'BloodCrossMatch', match.id, { result: match.compatibility_result });
  res.json(match);
}));

router.get('/blood-bank/reservations', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await BloodReservation.find(tenantFilter(req, req.query.status ? { status: clean(req.query.status) } : {})).sort({ id: -1 }).limit(300).lean());
}));
router.post('/blood-bank/reservations', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const unit = await BloodUnit.findOne(tenantFilter(req, { id: toNum(req.body?.unit_id) }));
  if (!unit) return res.status(404).json({ message: 'Blood unit not found' });
  if (unit.status !== 'available' && unit.status !== 'reserved') return res.status(400).json({ message: `Unit is not reservable. Current status: ${unit.status}` });
  if (unit.screening_status !== 'cleared') return res.status(400).json({ message: 'Only cleared units can be reserved.' });
  const reservation = await BloodReservation.create(tenantCreateData(req, { unit_id: unit.id, requisition_id: toNum(req.body?.requisition_id), patient_id: clean(req.body?.patient_id), patient_name: clean(req.body?.patient_name), reserved_until: toDate(req.body?.reserved_until) || new Date(Date.now() + 24*60*60*1000), status: 'active', reserved_by: req.user?.id, notes: clean(req.body?.notes) }));
  unit.status = 'reserved'; unit.reserved_for_patient_id = reservation.patient_id; unit.reserved_until = reservation.reserved_until; unit.updated_by = req.user?.id; await unit.save();
  await audit(req, 'blood_bank.reservation.created', 'BloodReservation', reservation.id, { unit_id: unit.id, patient_id: reservation.patient_id });
  res.status(201).json(reservation);
}));
router.post('/blood-bank/reservations/:id/release', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const reservation = await BloodReservation.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id), status: 'active' }), { $set: { status: 'released', released_by: req.user?.id, released_at: new Date() } }, { new: true });
  if (!reservation) return res.status(404).json({ message: 'Active reservation not found' });
  await BloodUnit.updateOne(tenantFilter(req, { id: reservation.unit_id, status: 'reserved' }), { $set: { status: 'available', reserved_for_patient_id: '', reserved_until: null, updated_by: req.user?.id } });
  await audit(req, 'blood_bank.reservation.released', 'BloodReservation', reservation.id, { unit_id: reservation.unit_id });
  res.json(reservation);
}));

router.get('/blood-bank/issues', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  res.json(await BloodIssueRecord.find(tenantFilter(req, {})).sort({ id: -1 }).limit(300).lean());
}));
router.post('/blood-bank/issues', requirePermission('clinical.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const unit = await BloodUnit.findOne(tenantFilter(req, { id: toNum(body.unit_id) }));
  if (!unit) return res.status(404).json({ message: 'Blood unit not found' });
  const issueType = normalize(body.issue_type, issueTypes, 'issue');
  const emergencyIssue = issueType === 'emergency_issue' || body.emergency_issue === true || body.emergency_issue === 'true';
  const statusNow = unitRuntimeStatus(unit);
  if (issueType === 'issue' && !['reserved','available'].includes(statusNow)) return res.status(400).json({ message: `Unit cannot be issued from status ${statusNow}` });
  if (!emergencyIssue && issueType === 'issue') {
    const match = body.cross_match_id ? await BloodCrossMatch.findOne(tenantFilter(req, { id: toNum(body.cross_match_id), unit_id: unit.id })).lean() : null;
    if (!match || match.compatibility_result !== 'compatible') return res.status(400).json({ message: 'Compatible cross-match is required before routine blood issue.' });
  }
  if (emergencyIssue && !clean(body.emergency_reason)) return res.status(400).json({ message: 'emergency_reason is required for emergency issue override.' });
  const movementStatus = issueType === 'return' ? 'returned' : issueType === 'discard' ? 'discarded' : 'issued';
  const record = await BloodIssueRecord.create(tenantCreateData(req, { unit_id: unit.id, requisition_id: toNum(body.requisition_id), cross_match_id: toNum(body.cross_match_id), patient_id: clean(body.patient_id), patient_name: clean(body.patient_name), issue_type: issueType, emergency_issue: emergencyIssue, emergency_reason: clean(body.emergency_reason), volume_issued_ml: toNum(body.volume_issued_ml) || unit.volume_ml, issued_at: ['issue','emergency_issue'].includes(issueType) ? new Date() : toDate(body.issued_at) || new Date(), returned_at: issueType === 'return' ? new Date() : undefined, discarded_at: issueType === 'discard' ? new Date() : undefined, status: movementStatus, issued_by: ['issue','emergency_issue'].includes(issueType) ? req.user?.id : undefined, returned_by: issueType === 'return' ? req.user?.id : undefined, discarded_by: issueType === 'discard' ? req.user?.id : undefined, notes: clean(body.notes) }));
  unit.status = movementStatus;
  if (toNum(body.volume_issued_ml) && toNum(body.volume_issued_ml) < (unit.volume_ml || 0)) unit.partial_consumed_ml = (unit.partial_consumed_ml || 0) + toNum(body.volume_issued_ml);
  if (movementStatus === 'discarded') { unit.disposed_at = new Date(); unit.disposal_reason = clean(body.notes) || 'Discarded by blood bank workflow'; }
  unit.updated_by = req.user?.id;
  await unit.save();
  if (record.requisition_id && ['issued','discarded'].includes(movementStatus)) await BloodRequisition.updateOne(tenantFilter(req, { id: record.requisition_id }), { $set: { status: movementStatus === 'issued' ? 'fulfilled' : 'approved', updated_by: req.user?.id } });
  await audit(req, `blood_bank.unit.${movementStatus}`, 'BloodIssueRecord', record.id, { unit_id: unit.id, patient_id: record.patient_id, emergency_issue: emergencyIssue }, emergencyIssue || movementStatus === 'discarded' ? 'warning' : 'info');
  res.status(201).json(record);
}));

router.get('/blood-bank/reports/stock', requirePermission('clinical.view'), asyncHandler(async (req, res) => {
  const units = await BloodUnit.find(tenantFilter(req, {})).lean();
  const byComponent = {};
  const now = Date.now();
  for (const u of units) {
    const key = `${u.blood_group || 'Unknown'}|${u.component_type || 'whole_blood'}`;
    byComponent[key] ||= { blood_group: u.blood_group || 'Unknown', component_type: u.component_type || 'whole_blood', available: 0, reserved: 0, issued: 0, quarantined: 0, expired: 0, total: 0 };
    const st = unitRuntimeStatus(u);
    byComponent[key].total += 1;
    if (byComponent[key][st] !== undefined) byComponent[key][st] += 1;
  }
  const expiryWastage = units.filter((u) => u.expiry_date && new Date(u.expiry_date).getTime() < now && !['issued'].includes(u.status)).length;
  res.json({ stock: Object.values(byComponent), expiryWastage, generated_at: new Date() });
}));

module.exports = router;
