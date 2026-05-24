const express = require('express');
const { Doctor, DoctorSchedule, Department, Appointment, AppointmentTokenCounter, Patient, Bed, Billing, AuditLog, DynamicField } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const multer = require('multer');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { createNotification } = require('../utils/notifications');
const { auditEvent } = require('../utils/audit');
const { ensureWithinLimit } = require('../utils/subscription');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
});

function fileToDataUrl(file) {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

async function uploadBufferToCloudinary(file, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
        });
        stream.end(file.buffer);
    });
}

async function safelyDestroyCloudinary(publicId, resourceType = 'auto') {
    if (!publicId || !hasCloudinaryConfig()) return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
        console.warn('Cloudinary cleanup skipped:', error?.message || error);
    }
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function idCandidates(identifier, prefix = '') {
    const raw = String(identifier ?? '').trim();
    const values = new Set();
    if (raw) values.add(raw);

    const numeric = Number(raw);
    if (Number.isFinite(numeric) && raw !== '') {
        values.add(String(numeric));
        values.add(String(numeric).padStart(2, '0'));
        values.add(String(numeric).padStart(3, '0'));
        if (prefix) {
            values.add(`${prefix}${String(numeric)}`);
            values.add(`${prefix}-${String(numeric)}`);
            values.add(`${prefix}${String(numeric).padStart(2, '0')}`);
            values.add(`${prefix}-${String(numeric).padStart(2, '0')}`);
            values.add(`${prefix}${String(numeric).padStart(3, '0')}`);
            values.add(`${prefix}-${String(numeric).padStart(3, '0')}`);
        }
    }
    return Array.from(values).filter(Boolean);
}

function identityLookup(identifier, idField, { prefix = '' } = {}) {
    const raw = String(identifier ?? '').trim();
    const numeric = Number(raw);
    const objectIdLike = /^[a-fA-F0-9]{24}$/.test(raw);
    const candidates = idCandidates(raw, prefix);
    const or = [];
    if (Number.isFinite(numeric) && raw !== '') or.push({ id: numeric });
    for (const value of candidates) or.push({ [idField]: value });
    if (objectIdLike) or.push({ _id: raw });
    return or.length ? { $or: or } : null;
}

function activeEntityFilter() {
    return {
        status: { $ne: 'archived' },
        $or: [
            { deleted_at: { $exists: false } },
            { deleted_at: null },
        ],
    };
}

async function resolveDoctorByIdentifier(req, identifier, { includeArchived = false, lean = false } = {}) {
    const lookup = identityLookup(identifier, 'doctor_id', { prefix: 'DOC' });
    if (!lookup) return null;
    const active = includeArchived ? {} : activeEntityFilter();

    // 1) Normal tenant-safe lookup. This is the correct production path.
    let query = Doctor.findOne({ $and: [tenantFilter(req), active, lookup] });
    let doctor = lean ? await query.lean() : await query;
    if (doctor) return doctor;

    const raw = String(identifier ?? '').trim();
    const numeric = Number(raw);

    // 2) Backward-compatible fallback for old seeded/imported doctors where
    // doctor_id was saved as DOC002/DR002/D-002 while the UI sends only 2.
    if (Number.isFinite(numeric) && raw !== '') {
        const suffix = String(numeric).replace(/^0+/, '') || '0';
        const padded2 = String(numeric).padStart(2, '0');
        const padded3 = String(numeric).padStart(3, '0');
        const doctorIdRegex = new RegExp(`(^|[^0-9])0*${escapeRegex(suffix)}$|${escapeRegex(padded2)}$|${escapeRegex(padded3)}$`, 'i');
        query = Doctor.findOne({
            $and: [
                tenantFilter(req),
                active,
                { $or: [{ doctor_id: doctorIdRegex }, { public_id: doctorIdRegex }, { user_id: numeric }] },
            ],
        });
        doctor = lean ? await query.lean() : await query;
        if (doctor) return doctor;
    }

    // 3) Last safe fallback for legacy records created before tenant support.
    // Only super_admin/default hospital can see this, and it still uses the identifier.
    if (req.user?.role === 'super_admin' || Number(req.hospital_id || 1) === 1) {
        query = Doctor.findOne({ $and: [active, lookup] });
        doctor = lean ? await query.lean() : await query;
        if (doctor) return doctor;
    }

    return null;
}

async function resolvePatientByIdentifier(req, identifier, { includeArchived = false, lean = true } = {}) {
    const lookup = identityLookup(identifier, 'patient_id');
    if (!lookup) return null;
    const active = includeArchived ? {} : activeEntityFilter();
    const query = Patient.findOne({ $and: [tenantFilter(req), active, lookup] });
    return lean ? query.lean() : query;
}

function publicDoctorId(doctor) {
    return String(doctor?.id || doctor?.doctor_id || '').trim();
}

function publicPatientId(patient) {
    return String(patient?.id || patient?.patient_id || '').trim();
}

router.use(verifyToken, attachTenant);


const DOCTOR_STATUSES = ['active', 'inactive', 'on_leave', 'archived'];
function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}
function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}
function normalizePhone(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ');
}
function validateDoctorPayload(body = {}, { partial = false } = {}) {
    const errors = [];
    const cleaned = {};
    const stringFields = ['doctor_id', 'full_name', 'email', 'phone', 'specialization', 'qualification', 'license_number', 'registration_number', 'status'];
    stringFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) cleaned[field] = String(body[field] ?? '').trim();
    });
    if (Object.prototype.hasOwnProperty.call(body, 'email')) cleaned.email = normalizeEmail(body.email);
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) cleaned.phone = normalizePhone(body.phone);
    if (Object.prototype.hasOwnProperty.call(body, 'department_id')) {
        const n = Number(body.department_id);
        if (body.department_id === '' || body.department_id === null || body.department_id === undefined) cleaned.department_id = null;
        else if (!Number.isFinite(n) || n <= 0) errors.push('Department must be a valid department id.');
        else cleaned.department_id = n;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'consultation_fee')) {
        const n = Number(body.consultation_fee);
        if (body.consultation_fee === '' || body.consultation_fee === null || body.consultation_fee === undefined) cleaned.consultation_fee = 0;
        else if (!Number.isFinite(n) || n < 0) errors.push('Consultation fee must be a valid non-negative number.');
        else cleaned.consultation_fee = n;
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body, 'doctor_id')) {
        if (isBlank(cleaned.doctor_id)) errors.push('Doctor ID is required.');
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body, 'full_name')) {
        if (isBlank(cleaned.full_name)) errors.push('Doctor full name is required.');
    }
    if (cleaned.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) errors.push('Doctor email is invalid.');
    if (cleaned.phone && !/^[0-9+()\-\s]{7,20}$/.test(cleaned.phone)) errors.push('Doctor phone number is invalid.');
    if (cleaned.status && !DOCTOR_STATUSES.includes(cleaned.status)) errors.push(`Doctor status must be one of: ${DOCTOR_STATUSES.join(', ')}.`);
    if (!cleaned.status && !partial) cleaned.status = 'active';
    return { errors, cleaned };
}
async function buildDoctorDuplicateWarnings(req, payload = {}, excludeId = null) {
    const warnings = [];
    const andBase = [tenantFilter(req)];
    if (excludeId !== null && excludeId !== undefined) andBase.push({ id: { $ne: Number(excludeId) } });
    const checks = [];
    if (payload.email) checks.push({ label: 'email', query: { email: payload.email } });
    if (payload.phone) checks.push({ label: 'phone', query: { phone: payload.phone } });
    for (const check of checks) {
        const existing = await Doctor.findOne({ $and: [...andBase, check.query] }).lean();
        if (existing) warnings.push(`Another doctor already uses this ${check.label}: ${existing.full_name || existing.doctor_id || existing.id}`);
    }
    return warnings;
}



async function validateCustomFields(req, targetModule, customFields = {}) {
    const fields = await DynamicField.find(tenantFilter(req, { target_module: targetModule, is_active: true })).lean();
    const cleaned = { ...(customFields || {}) };
    for (const field of fields) {
        const value = cleaned[field.field_key];
        if (field.required && (value === undefined || value === null || value === '' || value === false)) {
            const err = new Error(`${field.label || field.field_key} is required.`);
            err.status = 400;
            throw err;
        }
        if (value !== undefined && value !== null && value !== '') {
            if (field.field_type === 'number' && Number.isNaN(Number(value))) {
                const err = new Error(`${field.label || field.field_key} must be a number.`);
                err.status = 400;
                throw err;
            }
            if (field.field_type === 'select' && Array.isArray(field.options) && field.options.length && !field.options.includes(String(value))) {
                const err = new Error(`${field.label || field.field_key} has an invalid option.`);
                err.status = 400;
                throw err;
            }
        }
    }
    return cleaned;
}

async function withNames(req, rows) {
    const plainRows = rows.map(x => x.toJSON?.() || x);
    const patientIds = [...new Set(plainRows.map(x => x.patient_id).filter(Boolean))];
    const doctorIds = [...new Set(plainRows.map(x => x.doctor_id).filter(Boolean))];

    const patients = await Patient.find(tenantFilter(req, {
        $or: [
            { id: { $in: patientIds.map(Number).filter(n => !Number.isNaN(n)) } },
            { patient_id: { $in: patientIds } }
        ]
    })).lean();

    const doctors = await Doctor.find(tenantFilter(req, {
        $or: [
            { id: { $in: doctorIds.map(Number).filter(n => !Number.isNaN(n)) } },
            { doctor_id: { $in: doctorIds } }
        ]
    })).lean();

    const pm = Object.fromEntries([
        ...patients.map(p => [String(p.id), p.full_name]),
        ...patients.map(p => [String(p.patient_id), p.full_name])
    ]);

    const dm = Object.fromEntries([
        ...doctors.map(d => [String(d.id), d.full_name]),
        ...doctors.map(d => [String(d.doctor_id), d.full_name])
    ]);

    return plainRows.map(obj => ({
        ...obj,
        patient_name: pm[String(obj.patient_id)] || '',
        doctor_name: dm[String(obj.doctor_id)] || ''
    }));
}

router.get('/doctors', requirePermission('doctor.view'), asyncHandler(async (req, res) => {
    const includeArchived = String(req.query.include_archived || '').toLowerCase() === 'true';
    const baseFilter = includeArchived ? tenantFilter(req) : tenantFilter(req, activeEntityFilter());
    const rows = await Doctor.find(baseFilter).sort({ id: -1 }).lean();
    const deps = await Department.find(tenantFilter(req)).lean();
    const dm = Object.fromEntries(deps.map(d => [d.id, d.department_name]));
    res.json(rows.map(d => ({ ...d, public_id: publicDoctorId(d), department_name: dm[d.department_id] })));
}));


router.get('/doctors/:id', requirePermission('doctor.view'), asyncHandler(async (req, res) => {
    const doctor = await resolveDoctorByIdentifier(req, req.params.id, { includeArchived: true, lean: true });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    let departmentName = '';
    if (doctor.department_id) {
        const department = await Department.findOne(tenantFilter(req, { id: Number(doctor.department_id) })).lean();
        departmentName = department?.department_name || '';
    }

    doctor.public_id = publicDoctorId(doctor);

    const doctorAppointments = await Appointment.find(tenantFilter(req, {
        $or: [
            { doctor_id: String(doctor.doctor_id || '') },
            { doctor_id: String(doctor.id || '') },
            { doctor_id: doctor.doctor_id },
            { doctor_id: doctor.id },
        ],
    })).sort({ appointment_date: -1, appointment_time: -1 }).limit(20).lean();

    res.json({ ...doctor, department_name: departmentName, appointments: doctorAppointments });
}));

router.post('/doctors', requirePermission('doctor.create'), asyncHandler(async (req, res) => {
    const validation = validateDoctorPayload(req.body);
    if (validation.errors.length) return res.status(400).json({ message: 'Doctor validation failed', errors: validation.errors });

    const custom_fields = await validateCustomFields(req, 'doctors', req.body.custom_fields || {});
    const payload = {
        ...validation.cleaned,
        custom_fields,
        doctor_uid: req.body.doctor_uid || `DOC-${Date.now()}`,
    };

    const duplicateDoctor = await Doctor.findOne(tenantFilter(req, { doctor_id: payload.doctor_id })).lean();
    if (duplicateDoctor) {
        return res.status(409).json({
            message: `Doctor ID already exists for ${duplicateDoctor.full_name || 'another doctor'}: ${payload.doctor_id}`,
        });
    }

    const warnings = await buildDoctorDuplicateWarnings(req, payload);

    try {
        const limitCheck = await ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'doctors', 1);
        if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });
        const r = await Doctor.create(tenantCreateData(req, payload));
        await auditEvent({ req, action: 'doctor.created', module_name: 'doctors', entity_type: 'doctor', entity_id: r.id, new_value: r.toJSON?.() || r });
        res.status(201).json({ message: 'Doctor created', id: r.id, doctor_uid: payload.doctor_uid, warnings, doctor: r.toJSON?.() || r });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: 'Doctor ID already exists in this hospital. Please use a different Doctor ID.' });
        }
        throw error;
    }
}));

router.put('/doctors/:id', requirePermission('doctor.edit'), asyncHandler(async (req, res) => {
    const doctorNumericId = Number(req.params.id);
    if (!Number.isFinite(doctorNumericId)) return res.status(400).json({ message: 'Invalid doctor id' });

    const existingDoctor = await Doctor.findOne(tenantFilter(req, { id: doctorNumericId, ...activeEntityFilter() })).lean();
    if (!existingDoctor) return res.status(404).json({ message: 'Doctor not found' });

    const validation = validateDoctorPayload(req.body, { partial: true });
    if (validation.errors.length) return res.status(400).json({ message: 'Doctor validation failed', errors: validation.errors });

    const allowed = ['doctor_id', 'full_name', 'email', 'phone', 'specialization', 'qualification', 'consultation_fee', 'department_id', 'status', 'license_number', 'registration_number'];
    const update = {};
    allowed.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(validation.cleaned, k)) update[k] = validation.cleaned[k];
    });
    if ('custom_fields' in req.body) update.custom_fields = await validateCustomFields(req, 'doctors', req.body.custom_fields || {});
    if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid fields' });

    if (Object.prototype.hasOwnProperty.call(update, 'doctor_id') && update.doctor_id) {
        const duplicateDoctor = await Doctor.findOne(tenantFilter(req, { doctor_id: update.doctor_id, id: { $ne: doctorNumericId } })).lean();
        if (duplicateDoctor) {
            return res.status(409).json({ message: `Doctor ID already exists for ${duplicateDoctor.full_name || 'another doctor'}: ${update.doctor_id}` });
        }
    }

    const warnings = await buildDoctorDuplicateWarnings(req, update, doctorNumericId);

    try {
        const updated = await Doctor.findOneAndUpdate(
            tenantFilter(req, { id: doctorNumericId }),
            { $set: update },
            { new: true, runValidators: true },
        ).lean();
        await auditEvent({ req, action: 'doctor.updated', module_name: 'doctors', entity_type: 'doctor', entity_id: doctorNumericId, old_value: existingDoctor, new_value: updated });
        res.json({ message: 'Doctor updated', warnings, doctor: updated });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ message: 'Doctor ID already exists in this hospital. Please use a different Doctor ID.' });
        throw error;
    }
}));


router.post('/doctors/:id/profile-image', requirePermission('doctor.edit'), upload.single('profile_image'), asyncHandler(async (req, res) => {
    const doctor = await resolveDoctorByIdentifier(req, req.params.id, { includeArchived: false, lean: false });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    const doctorNumericId = doctor.id;

    if (!req.file) {
        return res.status(400).json({ message: 'Profile image is required' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only JPG, PNG, and WEBP images are allowed' });
    }

    try {
        await safelyDestroyCloudinary(doctor.profile_image_public_id, 'image');

        let profileImageUrl;
        let profileImagePublicId = '';
        let profileImageStorage = 'database';

        if (hasCloudinaryConfig()) {
            const result = await uploadBufferToCloudinary(req.file, {
                folder: 'hms/doctor-profile-images',
                resource_type: 'image',
            });
            profileImageUrl = result.secure_url;
            profileImagePublicId = result.public_id;
            profileImageStorage = 'cloudinary';
        } else {
            profileImageUrl = fileToDataUrl(req.file);
        }

        doctor.profile_image_url = profileImageUrl;
        doctor.profile_image_public_id = profileImagePublicId;
        doctor.profile_image_storage = profileImageStorage;
        await doctor.save();
        await auditEvent({ req, action: 'doctor.profile_image_uploaded', module_name: 'doctors', entity_type: 'doctor', entity_id: doctorNumericId, new_value: { profile_image_storage: profileImageStorage } });

        res.json({
            message: profileImageStorage === 'cloudinary'
                ? 'Doctor profile image uploaded successfully'
                : 'Doctor profile image saved successfully. Cloudinary is not configured, so the file was stored in MongoDB.',
            profile_image_url: doctor.profile_image_url,
            profile_image_public_id: doctor.profile_image_public_id,
            storage: profileImageStorage,
            doctor: doctor.toJSON(),
        });
    } catch (error) {
        console.error('Doctor profile image upload failed:', error);
        res.status(500).json({ message: error?.message || 'Doctor profile image upload failed' });
    }
}));


router.post('/doctors/:id/documents', requirePermission('doctor.document.manage'), upload.single('document'), asyncHandler(async (req, res) => {
    const doctorIdentifiers = [
        req.params.id,
        req.body?.doctor_id,
        req.body?.doctor_code,
        req.body?.mongo_id,
    ].filter((value, index, arr) => value !== undefined && value !== null && String(value).trim() !== '' && arr.findIndex(v => String(v).trim() === String(value).trim()) === index);

    let doctor = null;
    for (const identifier of doctorIdentifiers) {
        doctor = await resolveDoctorByIdentifier(req, identifier, { includeArchived: false, lean: false });
        if (doctor) break;
    }

    if (!doctor) {
        console.warn('Doctor document upload lookup failed:', {
            identifiers: doctorIdentifiers,
            hospital_id: req.hospital_id,
            user_id: req.user?.id,
            role: req.user?.role,
        });
        return res.status(404).json({ message: 'Doctor not found', identifiers: doctorIdentifiers });
    }
    const doctorNumericId = doctor.id;

    if (!req.file) {
        return res.status(400).json({ message: 'Document file is required' });
    }

    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only PDF, DOC, DOCX, JPG, PNG, and WEBP files are allowed' });
    }

    try {
        let fileUrl;
        let filePublicId = '';
        let storage = 'database';

        if (hasCloudinaryConfig()) {
            const result = await uploadBufferToCloudinary(req.file, {
                folder: 'hms/doctor-documents',
                resource_type: 'auto',
            });
            fileUrl = result.secure_url;
            filePublicId = result.public_id;
            storage = 'cloudinary';
        } else {
            fileUrl = fileToDataUrl(req.file);
        }

        const newDoc = {
            title: req.body.title || req.file.originalname,
            category: req.body.category || 'credential',
            document_type: req.body.document_type || 'Certificate',
            notes: req.body.notes || '',
            file_name: req.file.originalname,
            file_type: req.file.mimetype,
            file_size: req.file.size,
            file_url: fileUrl,
            file_public_id: filePublicId,
            storage,
            uploaded_at: new Date(),
        };

        doctor.certificates = doctor.certificates || [];
        doctor.certificates.push(newDoc);
        await doctor.save();
        await auditEvent({ req, action: 'doctor.document_uploaded', module_name: 'doctors', entity_type: 'doctor', entity_id: doctorNumericId, new_value: { title: newDoc.title, category: newDoc.category, document_type: newDoc.document_type, storage } });

        res.status(201).json({
            message: storage === 'cloudinary' ? 'Doctor document uploaded successfully' : 'Doctor document saved successfully. Cloudinary is not configured, so the file was stored in MongoDB.',
            document: newDoc,
            certificates: doctor.certificates,
            doctor: doctor.toJSON(),
        });
    } catch (error) {
        console.error('Doctor document upload failed:', error);
        res.status(500).json({ message: error?.message || 'Doctor document upload failed' });
    }
}));

router.delete('/doctors/:id/documents/:docIndex', requirePermission('doctor.document.manage'), asyncHandler(async (req, res) => {
    const docIndex = Number(req.params.docIndex);
    if (!Number.isInteger(docIndex) || docIndex < 0) {
        return res.status(400).json({ message: 'Invalid doctor document request' });
    }

    const doctor = await resolveDoctorByIdentifier(req, req.params.id, { includeArchived: false, lean: false });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    const doctorNumericId = doctor.id;

    const doc = doctor.certificates?.[docIndex];
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    try {
        await safelyDestroyCloudinary(doc.file_public_id, 'auto');

        doctor.certificates.splice(docIndex, 1);
        await doctor.save();
        await auditEvent({ req, action: 'doctor.document_deleted', module_name: 'doctors', entity_type: 'doctor', entity_id: doctorNumericId, old_value: { title: doc.title, category: doc.category, document_type: doc.document_type } });

        res.json({
            message: 'Doctor document deleted successfully',
            certificates: doctor.certificates,
            doctor: doctor.toJSON(),
        });
    } catch (error) {
        console.error('Doctor document delete failed:', error);
        res.status(500).json({ message: 'Doctor document delete failed' });
    }
}));

router.delete('/doctors/:id', requirePermission('doctor.delete'), asyncHandler(async (req, res) => {
    const doctorNumericId = Number(req.params.id);
    if (!Number.isFinite(doctorNumericId)) return res.status(400).json({ message: 'Invalid doctor id' });

    const existingDoctor = await Doctor.findOne(tenantFilter(req, { id: doctorNumericId, ...activeEntityFilter() })).lean();
    if (!existingDoctor) return res.status(404).json({ message: 'Doctor not found' });

    const updated = await Doctor.findOneAndUpdate(
        tenantFilter(req, { id: doctorNumericId }),
        { $set: { status: 'archived', deleted_at: new Date(), deleted_by: req.user?.id || null } },
        { new: true },
    ).lean();
    await auditEvent({ req, action: 'doctor.archived', module_name: 'doctors', entity_type: 'doctor', entity_id: doctorNumericId, old_value: existingDoctor, new_value: { status: 'archived' } });
    res.json({ message: 'Doctor archived', doctor: updated });
}));

router.get('/departments', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
    res.json(await Department.find(tenantFilter(req)).sort({ department_name: 1 }));
}));

router.post('/departments', requirePermission('doctor.create'), asyncHandler(async (req, res) => {
    const r = await Department.create(tenantCreateData(req, { department_name: req.body.department_name, description: req.body.description || null }));
    res.status(201).json({ message: 'Department created', id: r.id });
}));


const APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'archived'];
const APPOINTMENT_TYPES = ['opd', 'follow_up', 'emergency', 'teleconsultation'];
const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'in_consultation', 'completed'];
const QUEUE_ACTIVE_STATUSES = ['scheduled', 'checked_in', 'in_consultation'];
const TERMINAL_APPOINTMENT_STATUSES = ['completed', 'cancelled', 'no_show', 'archived'];
const APPOINTMENT_STATUS_TRANSITIONS = {
    scheduled: ['checked_in', 'cancelled', 'no_show', 'archived'],
    checked_in: ['in_consultation', 'completed', 'cancelled', 'no_show', 'archived'],
    in_consultation: ['completed', 'cancelled', 'archived'],
    completed: ['archived'],
    cancelled: ['archived'],
    no_show: ['archived'],
    archived: [],
};

function normalizeAppointmentStatus(value, fallback = 'scheduled') {
    const status = String(value || fallback || 'scheduled').trim().toLowerCase();
    return APPOINTMENT_STATUSES.includes(status) ? status : fallback;
}

function canMoveAppointmentStatus(from, to) {
    const current = normalizeAppointmentStatus(from);
    const next = normalizeAppointmentStatus(to);
    if (current === next) return true;
    return (APPOINTMENT_STATUS_TRANSITIONS[current] || []).includes(next);
}

function statusTransitionMessage(from, to) {
    const current = normalizeAppointmentStatus(from);
    const next = normalizeAppointmentStatus(to);
    const allowed = APPOINTMENT_STATUS_TRANSITIONS[current] || [];
    return `Invalid appointment status transition: ${current.replaceAll('_', ' ')} → ${next.replaceAll('_', ' ')}. Allowed next status: ${allowed.length ? allowed.map((x) => x.replaceAll('_', ' ')).join(', ') : 'none'}.`;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_WORKING_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeTime(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return raw;
    const h = String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, '0');
    const m = String(Math.min(59, Math.max(0, Number(match[2])))).padStart(2, '0');
    return `${h}:${m}`;
}

function timeToMinutes(value = '') {
    const time = normalizeTime(value);
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}

function minutesToTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function weekdayKey(dateText = '') {
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return WEEKDAY_KEYS[date.getDay()];
}

function normalizeWorkingDays(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(',');
    const days = input.map(d => String(d).trim().slice(0, 3).toLowerCase()).filter(d => WEEKDAY_KEYS.includes(d));
    return Array.from(new Set(days));
}

async function resolveDoctorForSchedule(req, doctorIdentifier) {
    return resolveDoctorByIdentifier(req, doctorIdentifier, { includeArchived: false, lean: true });
}

function normalizeSchedulePayload(body = {}) {
    return {
        working_days: normalizeWorkingDays(body.working_days || DEFAULT_WORKING_DAYS),
        start_time: normalizeTime(body.start_time || '10:00'),
        end_time: normalizeTime(body.end_time || '14:00'),
        break_start: normalizeTime(body.break_start || ''),
        break_end: normalizeTime(body.break_end || ''),
        slot_duration: Math.max(5, Number(body.slot_duration || 15)),
        max_patients_per_day: Math.max(0, Number(body.max_patients_per_day || 0)),
        unavailable_dates: Array.isArray(body.unavailable_dates)
            ? body.unavailable_dates.map(String).filter(Boolean)
            : String(body.unavailable_dates || '').split(',').map(x => x.trim()).filter(Boolean),
        notes: String(body.notes || '').trim(),
        status: ['active', 'inactive'].includes(String(body.status || '').toLowerCase()) ? String(body.status).toLowerCase() : 'active',
    };
}

function validateSchedulePayload(payload) {
    const start = timeToMinutes(payload.start_time);
    const end = timeToMinutes(payload.end_time);
    if (!payload.working_days.length) return 'At least one working day is required';
    if (start === null || end === null || start >= end) return 'Schedule start time must be before end time';
    if (payload.break_start || payload.break_end) {
        const bs = timeToMinutes(payload.break_start);
        const be = timeToMinutes(payload.break_end);
        if (bs === null || be === null || bs >= be) return 'Break start time must be before break end time';
        if (bs < start || be > end) return 'Break time must be within working hours';
    }
    return null;
}

function buildSlots(schedule, appointmentDate, bookedRows = []) {
    if (!schedule || schedule.status === 'inactive') return [];
    if (schedule.unavailable_dates?.includes(appointmentDate)) return [];
    const day = weekdayKey(appointmentDate);
    if (!schedule.working_days?.includes(day)) return [];

    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    const slot = Number(schedule.slot_duration || 15);
    const bs = schedule.break_start ? timeToMinutes(schedule.break_start) : null;
    const be = schedule.break_end ? timeToMinutes(schedule.break_end) : null;
    const bookedMap = new Map(bookedRows.map(a => [a.appointment_time, a]));
    const slots = [];

    for (let cursor = start; cursor + slot <= end; cursor += slot) {
        const time = minutesToTime(cursor);
        const inBreak = bs !== null && be !== null && cursor < be && cursor + slot > bs;
        const booked = bookedMap.get(time);
        slots.push({ time, available: !inBreak && !booked, in_break: inBreak, appointment_id: booked?.id || null, status: booked ? 'booked' : inBreak ? 'break' : 'available' });
    }
    return slots;
}

async function ensureWithinDoctorSchedule(req, payload, currentAppointmentId = null) {
    const doctor = await resolveDoctorForSchedule(req, payload.doctor_id);
    if (!doctor) return null;

    const schedule = await DoctorSchedule.findOne(tenantFilter(req, { doctor_ref_id: doctor.id, status: 'active' })).lean();
    if (!schedule) return null; // Backward compatible: allow booking until a schedule is configured.

    if (schedule.unavailable_dates?.includes(payload.appointment_date)) {
        return 'Doctor is marked unavailable on this date. Please choose another date.';
    }

    const day = weekdayKey(payload.appointment_date);
    if (!schedule.working_days?.includes(day)) {
        return 'Doctor is not available on this weekday according to the schedule.';
    }

    const time = timeToMinutes(payload.appointment_time);
    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    const duration = Number(schedule.slot_duration || 15);
    if (time === null || time < start || time + duration > end) {
        return `Doctor is available between ${schedule.start_time} and ${schedule.end_time}.`;
    }

    const bs = schedule.break_start ? timeToMinutes(schedule.break_start) : null;
    const be = schedule.break_end ? timeToMinutes(schedule.break_end) : null;
    if (bs !== null && be !== null && time < be && time + duration > bs) {
        return `Doctor has a break between ${schedule.break_start} and ${schedule.break_end}.`;
    }

    if (Number(schedule.max_patients_per_day || 0) > 0) {
        const countFilter = tenantFilter(req, {
            doctor_id: String(payload.doctor_id),
            appointment_date: payload.appointment_date,
            status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        });
        if (currentAppointmentId) countFilter.id = { $ne: Number(currentAppointmentId) };
        const dayCount = await Appointment.countDocuments(countFilter);
        if (dayCount >= Number(schedule.max_patients_per_day)) {
            return 'Doctor daily appointment limit has been reached for this date.';
        }
    }

    return null;
}


function normalizeAppointmentPayload(body = {}, existing = {}) {
    const allowed = ['patient_id', 'doctor_id', 'appointment_date', 'appointment_time', 'status', 'notes', 'appointment_type', 'cancellation_reason', 'no_show_reason', 'reschedule_reason'];
    const payload = {};

    allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            payload[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
        }
    });

    if (payload.appointment_type) payload.appointment_type = String(payload.appointment_type).toLowerCase();
    if (payload.status) payload.status = String(payload.status).toLowerCase();

    if (!payload.appointment_type) payload.appointment_type = existing.appointment_type || 'opd';
    if (!payload.status) payload.status = existing.status || 'scheduled';

    return payload;
}

function validateAppointmentPayload(payload, { partial = false } = {}) {
    const required = ['patient_id', 'doctor_id', 'appointment_date', 'appointment_time'];
    if (!partial) {
        for (const key of required) {
            if (!payload[key]) return `${key.replaceAll('_', ' ')} is required`;
        }
    }

    if (payload.appointment_type && !APPOINTMENT_TYPES.includes(payload.appointment_type)) {
        return 'Invalid appointment type';
    }

    if (payload.status && !APPOINTMENT_STATUSES.includes(payload.status)) {
        return 'Invalid appointment status';
    }

    if (payload.appointment_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.appointment_date))) {
        return 'Appointment date must be in YYYY-MM-DD format';
    }

    if (payload.appointment_time && timeToMinutes(payload.appointment_time) === null) {
        return 'Appointment time must be a valid HH:mm value';
    }

    return null;
}

async function resolveAppointmentReferences(req, payload) {
    const patient = payload.patient_id ? await resolvePatientByIdentifier(req, payload.patient_id, { lean: true }) : null;
    if (payload.patient_id && !patient) return { error: 'Selected patient was not found in this hospital' };

    const doctor = payload.doctor_id ? await resolveDoctorByIdentifier(req, payload.doctor_id, { lean: true }) : null;
    if (payload.doctor_id && !doctor) return { error: 'Selected doctor was not found in this hospital' };

    return { patient, doctor };
}

function canonicalizeAppointmentPayload(payload, refs = {}) {
    return {
        ...payload,
        patient_id: refs.patient ? publicPatientId(refs.patient) : String(payload.patient_id || '').trim(),
        doctor_id: refs.doctor ? publicDoctorId(refs.doctor) : String(payload.doctor_id || '').trim(),
    };
}

async function ensureAppointmentReferences(req, payload) {
    const refs = await resolveAppointmentReferences(req, payload);
    return refs.error || null;
}

async function ensureDoctorSlotAvailable(req, payload, currentAppointmentId = null) {
    if (!payload.doctor_id || !payload.appointment_date || !payload.appointment_time) return null;

    const filter = tenantFilter(req, {
        doctor_id: String(payload.doctor_id),
        appointment_date: payload.appointment_date,
        appointment_time: payload.appointment_time,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });

    if (currentAppointmentId) filter.id = { $ne: Number(currentAppointmentId) };

    const existing = await Appointment.findOne(filter).lean();
    if (existing) {
        return `This doctor already has an appointment at ${payload.appointment_date} ${payload.appointment_time}. Please choose another slot.`;
    }

    return null;
}

function parseTokenSequence(token) {
    const raw = String(token || '');
    const suffix = raw.includes('-') ? raw.split('-').pop() : raw;
    const parsed = Number(String(suffix || '').replace(/\D/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildTokenNumber(appointmentDate, sequence) {
    const dateKey = String(appointmentDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    return `${dateKey}-${String(Number(sequence || 1)).padStart(3, '0')}`;
}

async function maxTokenSequenceForDate(req, appointmentDate) {
    const rows = await Appointment.find(tenantFilter(req, { appointment_date: appointmentDate, status: { $ne: 'archived' } }))
        .select('token_number token_sequence id')
        .lean();
    return rows.reduce((max, row) => Math.max(max, Number(row.token_sequence || 0), parseTokenSequence(row.token_number)), 0);
}

async function ensureTokenCounterInitialized(req, appointmentDate) {
    const filter = tenantFilter(req, { appointment_date: appointmentDate });
    const existing = await AppointmentTokenCounter.findOne(filter).lean();
    if (existing) return existing;

    const maxSeq = await maxTokenSequenceForDate(req, appointmentDate);
    try {
        return await AppointmentTokenCounter.create(tenantCreateData(req, { appointment_date: appointmentDate, seq: maxSeq }));
    } catch (error) {
        if (error?.code !== 11000) throw error;
        return AppointmentTokenCounter.findOne(filter).lean();
    }
}

async function generateAppointmentToken(req, appointmentDate) {
    const date = String(appointmentDate || new Date().toISOString().slice(0, 10));
    await ensureTokenCounterInitialized(req, date);
    const counter = await AppointmentTokenCounter.findOneAndUpdate(
        tenantFilter(req, { appointment_date: date }),
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    const sequence = Number(counter?.seq || 1);
    return { token_number: buildTokenNumber(date, sequence), token_sequence: sequence };
}

function queueTokenValue(row) {
    return Number(row.token_sequence || 0) || parseTokenSequence(row.token_number) || Number(row.id || 0);
}

function queueSort(a, b) {
    const tokenA = queueTokenValue(a);
    const tokenB = queueTokenValue(b);
    if (tokenA !== tokenB) return tokenA - tokenB;
    return String(a.appointment_time || '').localeCompare(String(b.appointment_time || ''));
}

function enrichQueueRows(rows) {
    const now = Date.now();
    return rows.map((row, index) => {
        const checkedInAt = row.checked_in_at ? new Date(row.checked_in_at).getTime() : null;
        const waitingMinutes = checkedInAt && Number.isFinite(checkedInAt)
            ? Math.max(0, Math.round((now - checkedInAt) / 60000))
            : 0;
        return {
            ...row,
            queue_position: index + 1,
            waiting_minutes: waitingMinutes,
        };
    });
}

function statusTimestampUpdate(status) {
    const now = new Date();
    if (status === 'checked_in') return { checked_in_at: now };
    if (status === 'in_consultation') return { consultation_started_at: now };
    if (status === 'completed') return { completed_at: now };
    if (status === 'cancelled') return { cancelled_at: now };
    return {};
}


router.get('/doctor-schedules', requirePermission('appointment.view'), asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.doctor_id) {
        const doctor = await resolveDoctorForSchedule(req, req.query.doctor_id);
        if (!doctor) return res.json([]);
        filter.doctor_ref_id = doctor.id;
    }
    const rows = await DoctorSchedule.find(tenantFilter(req, filter)).sort({ id: -1 }).lean();
    const doctorIds = [...new Set(rows.map(r => r.doctor_ref_id).filter(Boolean))];
    const doctors = await Doctor.find(tenantFilter(req, { id: { $in: doctorIds } })).lean();
    const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]));
    res.json(rows.map(row => ({ ...row, doctor_name: doctorMap[row.doctor_ref_id]?.full_name || '', specialization: doctorMap[row.doctor_ref_id]?.specialization || '' })));
}));

router.post('/doctor-schedules', requirePermission('appointment.edit'), asyncHandler(async (req, res) => {
    const doctor = await resolveDoctorForSchedule(req, req.body.doctor_id || req.body.doctor_ref_id);
    if (!doctor) return res.status(400).json({ message: 'Selected doctor was not found in this hospital' });

    const payload = normalizeSchedulePayload(req.body);
    const error = validateSchedulePayload(payload);
    if (error) return res.status(400).json({ message: error });

    const updated = await DoctorSchedule.findOneAndUpdate(
        tenantFilter(req, { doctor_ref_id: doctor.id }),
        { $set: tenantCreateData(req, { ...payload, doctor_ref_id: doctor.id, doctor_id: String(doctor.doctor_id || doctor.id) }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    res.status(201).json({ message: 'Doctor schedule saved', schedule: updated });
}));

router.delete('/doctor-schedules/:id', requirePermission('appointment.edit'), asyncHandler(async (req, res) => {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) return res.status(400).json({ message: 'Invalid schedule id' });
    const result = await DoctorSchedule.deleteOne(tenantFilter(req, { id: scheduleId }));
    if (!result.deletedCount) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Doctor schedule deleted' });
}));

router.get('/doctors/:id/slots', requirePermission('appointment.view'), asyncHandler(async (req, res) => {
    const date = String(req.query.date || '').trim();
    if (!date) return res.status(400).json({ message: 'Date is required' });

    const doctor = await resolveDoctorForSchedule(req, req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const schedule = await DoctorSchedule.findOne(tenantFilter(req, { doctor_ref_id: doctor.id, status: 'active' })).lean();
    if (!schedule) return res.json({ doctor, schedule: null, slots: [], message: 'No schedule configured for this doctor' });

    const bookedRows = await Appointment.find(tenantFilter(req, {
        doctor_id: String(doctor.doctor_id || doctor.id),
        appointment_date: date,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    })).lean();

    res.json({ doctor, schedule, slots: buildSlots(schedule, date, bookedRows) });
}));

router.get('/appointments/queue', requirePermission('appointment.view'), asyncHandler(async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const filter = { appointment_date: date, status: { $ne: 'archived' } };
    if (req.query.doctor_id && req.query.doctor_id !== 'all') filter.doctor_id = String(req.query.doctor_id);

    const rows = await Appointment.find(tenantFilter(req, filter)).sort({ appointment_time: 1, id: 1 });
    const namedRows = await withNames(req, rows);
    const queueRows = enrichQueueRows(namedRows.sort(queueSort));
    const activeQueue = queueRows.filter(row => QUEUE_ACTIVE_STATUSES.includes(row.status || 'scheduled'));

    const doctors = {};
    activeQueue.forEach((row) => {
        const key = row.doctor_id || 'unassigned';
        if (!doctors[key]) {
            doctors[key] = { doctor_id: key, doctor_name: row.doctor_name || key, total: 0, waiting: 0, in_consultation: 0, completed: 0, rows: [] };
        }
        doctors[key].total += 1;
        doctors[key].waiting += row.status === 'checked_in' ? 1 : 0;
        doctors[key].in_consultation += row.status === 'in_consultation' ? 1 : 0;
        doctors[key].completed += row.status === 'completed' ? 1 : 0;
        doctors[key].rows.push(row);
    });

    res.json({
        date,
        stats: {
            total: queueRows.length,
            scheduled: queueRows.filter(row => row.status === 'scheduled').length,
            waiting: queueRows.filter(row => row.status === 'checked_in').length,
            in_consultation: queueRows.filter(row => row.status === 'in_consultation').length,
            completed: queueRows.filter(row => row.status === 'completed').length,
            cancelled: queueRows.filter(row => row.status === 'cancelled').length,
            no_show: queueRows.filter(row => row.status === 'no_show').length,
        },
        queue: activeQueue,
        doctors: Object.values(doctors),
    });
}));

router.get('/appointments', requirePermission('appointment.view'), asyncHandler(async (req, res) => {
    const { status, date, doctor_id, patient_id, type } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = String(status).toLowerCase();
    else filter.status = { $ne: 'archived' };
    if (date) filter.appointment_date = String(date);
    if (doctor_id) filter.doctor_id = String(doctor_id);
    if (patient_id) filter.patient_id = String(patient_id);
    if (type && type !== 'all') filter.appointment_type = String(type).toLowerCase();

    const rows = await Appointment.find(tenantFilter(req, filter)).sort({ appointment_date: -1, token_sequence: 1, appointment_time: 1, id: 1 });
    const namedRows = await withNames(req, rows);
    res.json(namedRows.sort((a, b) => String(b.appointment_date || '').localeCompare(String(a.appointment_date || '')) || queueSort(a, b)));
}));

router.post('/appointments', requirePermission('appointment.create'), asyncHandler(async (req, res) => {
    const uid = req.body.appointment_uid || `APT-${Date.now()}`;
    const payload = normalizeAppointmentPayload(req.body);
    const validationError = validateAppointmentPayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const refs = await resolveAppointmentReferences(req, payload);
    if (refs.error) return res.status(400).json({ message: refs.error });
    const canonicalPayload = canonicalizeAppointmentPayload(payload, refs);

    const slotError = await ensureDoctorSlotAvailable(req, canonicalPayload);
    if (slotError) return res.status(409).json({ message: slotError });

    const scheduleError = await ensureWithinDoctorSchedule(req, canonicalPayload);
    if (scheduleError) return res.status(409).json({ message: scheduleError });

    const limitCheck = await ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'appointments_per_month', 1);
    if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });

    const token = await generateAppointmentToken(req, canonicalPayload.appointment_date);
    const token_number = token.token_number;
    const r = await Appointment.create(tenantCreateData(req, {
        ...canonicalPayload,
        appointment_uid: uid,
        token_number,
        token_sequence: token.token_sequence,
    }));

    await createNotification(req, {
        title: 'Appointment created',
        message: `Appointment ${token_number} scheduled for ${canonicalPayload.appointment_date} at ${canonicalPayload.appointment_time}.`,
        type: 'appointment',
        severity: payload.appointment_type === 'emergency' ? 'critical' : 'info',
        module: 'appointments',
        entity_type: 'appointment',
        entity_id: r.id,
        target_path: '/appointments',
    });
    await auditEvent({ req, action: 'appointment.created', module_name: 'appointments', entity_type: 'appointment', entity_id: r.id, new_value: r.toJSON?.() || r });
    res.status(201).json({ message: 'Appointment created', id: r.id, appointment_uid: uid, token_number });
}));

router.patch('/appointments/:id/status', requirePermission('appointment.status.update'), asyncHandler(async (req, res) => {
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: 'Invalid appointment id' });

    const status = normalizeAppointmentStatus(req.body.status, '');
    if (!APPOINTMENT_STATUSES.includes(status) || status === 'archived') return res.status(400).json({ message: 'Invalid appointment status' });

    const existing = await Appointment.findOne(tenantFilter(req, { id: appointmentId, status: { $ne: 'archived' } })).lean();
    if (!existing) return res.status(404).json({ message: 'Appointment not found' });

    if (!canMoveAppointmentStatus(existing.status || 'scheduled', status)) {
        return res.status(409).json({ message: statusTransitionMessage(existing.status || 'scheduled', status) });
    }

    if (status === 'in_consultation') {
        const activeConsultation = await Appointment.findOne(tenantFilter(req, {
            id: { $ne: appointmentId },
            doctor_id: String(existing.doctor_id || ''),
            appointment_date: existing.appointment_date,
            status: 'in_consultation',
        })).lean();
        if (activeConsultation) {
            return res.status(409).json({
                message: `Doctor already has patient ${activeConsultation.patient_id || activeConsultation.id} in consultation. Complete that consultation before calling another patient.`,
                active_appointment_id: activeConsultation.id,
            });
        }
    }

    const update = { status, ...statusTimestampUpdate(status) };
    if (status === 'cancelled') {
        const reason = String(req.body.cancellation_reason || '').trim();
        if (!reason) return res.status(400).json({ message: 'Cancellation reason is required' });
        update.cancellation_reason = reason;
    }
    if (status === 'no_show' && req.body.no_show_reason) {
        update.no_show_reason = String(req.body.no_show_reason).trim();
    }

    const updated = await Appointment.findOneAndUpdate(
        tenantFilter(req, { id: appointmentId }),
        { $set: update },
        { new: true },
    ).lean();

    await createNotification(req, {
        title: 'Appointment status updated',
        message: `Appointment ${updated?.token_number || updated?.id} marked as ${status.replace('_', ' ')}.`,
        type: 'appointment',
        severity: ['cancelled', 'no_show'].includes(status) ? 'warning' : 'info',
        module: 'appointments',
        entity_type: 'appointment',
        entity_id: appointmentId,
        target_path: '/appointments',
    });
    await auditEvent({ req, action: 'appointment.status_updated', module_name: 'appointments', entity_type: 'appointment', entity_id: appointmentId, old_value: { status: existing.status }, new_value: { status, cancellation_reason: update.cancellation_reason, no_show_reason: update.no_show_reason } });
    res.json({ message: 'Appointment status updated', appointment: updated });
}));

router.put('/appointments/:id', requirePermission('appointment.edit'), asyncHandler(async (req, res) => {
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: 'Invalid appointment id' });

    const existing = await Appointment.findOne(tenantFilter(req, { id: appointmentId, status: { $ne: 'archived' } })).lean();
    if (!existing) return res.status(404).json({ message: 'Appointment not found' });

    const payload = normalizeAppointmentPayload(req.body, existing);
    const validationError = validateAppointmentPayload(payload, { partial: true });
    if (validationError) return res.status(400).json({ message: validationError });

    const mergedRaw = { ...existing, ...payload };
    const refs = await resolveAppointmentReferences(req, mergedRaw);
    if (refs.error) return res.status(400).json({ message: refs.error });
    const merged = canonicalizeAppointmentPayload(mergedRaw, refs);
    const payloadForUpdate = canonicalizeAppointmentPayload(payload, refs);

    const slotError = await ensureDoctorSlotAvailable(req, merged, appointmentId);
    if (slotError) return res.status(409).json({ message: slotError });

    const scheduleError = await ensureWithinDoctorSchedule(req, merged, appointmentId);
    if (scheduleError) return res.status(409).json({ message: scheduleError });

    const update = { ...payloadForUpdate, ...statusTimestampUpdate(payloadForUpdate.status) };
    const scheduleChanged = ['doctor_id', 'appointment_date', 'appointment_time'].some((key) => Object.prototype.hasOwnProperty.call(payloadForUpdate, key) && String(payloadForUpdate[key] || '') !== String(existing[key] || ''));
    if (scheduleChanged) {
        update.previous_schedule = { doctor_id: existing.doctor_id, appointment_date: existing.appointment_date, appointment_time: existing.appointment_time };
        update.rescheduled_at = new Date();
        update.reschedule_reason = String(req.body.reschedule_reason || payloadForUpdate.reschedule_reason || 'Rescheduled from appointment edit').trim();
    }
    const updated = await Appointment.findOneAndUpdate(
        tenantFilter(req, { id: appointmentId }),
        { $set: update },
        { new: true, runValidators: true },
    ).lean();

    await auditEvent({ req, action: scheduleChanged ? 'appointment.rescheduled' : 'appointment.updated', module_name: 'appointments', entity_type: 'appointment', entity_id: appointmentId, old_value: existing, new_value: updated });
    res.json({ message: scheduleChanged ? 'Appointment rescheduled' : 'Appointment updated', appointment: updated });
}));

router.delete('/appointments/:id', requirePermission('appointment.delete'), asyncHandler(async (req, res) => {
    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: 'Invalid appointment id' });

    const existing = await Appointment.findOne(tenantFilter(req, { id: appointmentId, status: { $ne: 'archived' } })).lean();
    if (!existing) return res.status(404).json({ message: 'Appointment not found' });

    const updated = await Appointment.findOneAndUpdate(
        tenantFilter(req, { id: appointmentId }),
        { $set: { status: 'archived', deleted_at: new Date(), deleted_by: req.user?.id || req.user?.user_id || null } },
        { new: true },
    ).lean();
    await auditEvent({ req, action: 'appointment.archived', module_name: 'appointments', entity_type: 'appointment', entity_id: appointmentId, old_value: existing, new_value: { status: 'archived' } });
    res.json({ message: 'Appointment archived', appointment: updated });
}));

router.get('/beds', requirePermission('bed.view'), asyncHandler(async (req, res) => {
    res.json(await Bed.find(tenantFilter(req)).sort({ bed_number: 1 }));
}));

router.post('/beds', requirePermission('bed.create'), asyncHandler(async (req, res) => {
    const ward = String(req.body.ward || 'General').trim();
    const bed_number = String(req.body.bed_number || '').trim();
    if (!bed_number) return res.status(400).json({ message: 'Bed number is required' });
    const status = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance', 'inactive'].includes(req.body.status) ? req.body.status : 'available';
    const exists = await Bed.findOne(tenantFilter(req, { ward, bed_number })).lean();
    if (exists) return res.status(409).json({ message: `Bed ${bed_number} already exists in ${ward} ward for this hospital.` });
    const r = await Bed.create(tenantCreateData(req, { ...req.body, ward, bed_number, status }));
    res.status(201).json({ message: 'Bed created', id: r.id });
}));

router.patch('/beds/:id/status', requirePermission('bed.status.update'), asyncHandler(async (req, res) => {
    await Bed.updateOne(tenantFilter(req, { id: Number(req.params.id) }), { $set: { status: req.body.status } });
    res.json({ message: 'Bed status updated' });
}));

router.get('/dashboard/stats', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const [totalPatients, totalDoctors, appointmentsToday, availableBeds, bills, activity] = await Promise.all([
        Patient.countDocuments(tenantFilter(req)),
        Doctor.countDocuments(tenantFilter(req)),
        Appointment.countDocuments(tenantFilter(req, { appointment_date: today })),
        Bed.countDocuments(tenantFilter(req, { status: 'available' })),
        Billing.find(tenantFilter(req, { billing_date: { $gte: new Date(today) } })).lean(),
        AuditLog.find(tenantFilter(req)).sort({ id: -1 }).limit(10).lean()
    ]);
    res.json({
        totalPatients,
        totalDoctors,
        appointmentsToday,
        availableBeds,
        dailyRevenue: bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0),
        recentActivity: activity
    });
}));

module.exports = router;
