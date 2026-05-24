const express = require("express");
const { Patient, Appointment, OpdRecord, Prescription, Billing, LabTest, RadiologyTest, IpdAdmission, DynamicField, PharmacySale, ClinicalRecord, InsuranceClaim, NursingNote } = require("../models");
const { mongoose } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, requirePermission } = require("../middleware/auth");
const { attachTenant, tenantFilter, tenantCreateData } = require("../middleware/tenant");
const router = express.Router();
const multer = require("multer");
const { cloudinary, hasCloudinaryConfig } = require("../config/cloudinary");
const { auditEvent } = require("../utils/audit");
const { ensureWithinLimit } = require("../utils/subscription");
router.use(verifyToken, attachTenant);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
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

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizePhone(value) {
    return cleanString(value || '').replace(/\s+/g, '');
}

function normalizeEmail(value) {
    return cleanString(value || '').toLowerCase();
}

function normalizeGender(value) {
    const gender = cleanString(value || '').toLowerCase();
    return ['male', 'female', 'other'].includes(gender) ? gender : gender;
}

function activePatientFilter(req, extra = {}) {
    return {
        $and: [
            tenantFilter(req),
            extra,
            { deleted_at: { $exists: false } },
        ],
    };
}


function patientLookupFilter(req, identifier) {
    const raw = cleanString(identifier);
    if (!raw) return activePatientFilter(req, { id: -1 });
    const or = [];
    const numericId = Number(raw);
    if (Number.isFinite(numericId)) or.push({ id: numericId });
    or.push({ patient_id: raw }, { patient_uid: raw });
    if (mongoose.Types.ObjectId.isValid(raw)) or.push({ _id: raw });
    return activePatientFilter(req, { $or: or });
}

async function findPatientByPublicId(req, identifier, projection = null) {
    const query = Patient.findOne(patientLookupFilter(req, identifier));
    if (projection) query.select(projection);
    return query;
}

function normalizePatientResponse(patient) {
    if (!patient) return patient;
    const plain = patient.toJSON ? patient.toJSON() : { ...patient };
    plain.public_id = String(plain.id || plain.patient_id || plain.patient_uid || '');
    plain.documents = Array.isArray(plain.documents) ? plain.documents.filter((doc) => !doc?.deleted_at) : [];
    return plain;
}

function validatePatientPayload(body = {}, { partial = false } = {}) {
    const errors = [];
    const payload = { ...body };

    ['patient_id', 'patient_uid', 'full_name', 'gender', 'phone', 'email', 'address', 'blood_group', 'medical_notes',
        'emergency_contact_name', 'emergency_contact_phone', 'insurance_provider', 'insurance_policy_number'].forEach((key) => {
        if (key in payload) payload[key] = cleanString(payload[key]);
    });

    if ('phone' in payload) payload.phone = normalizePhone(payload.phone);
    if ('email' in payload) payload.email = normalizeEmail(payload.email);
    if ('gender' in payload) payload.gender = normalizeGender(payload.gender);

    if (!partial || 'full_name' in payload) {
        if (!payload.full_name) errors.push('Patient full name is required.');
        else if (String(payload.full_name).length < 2) errors.push('Patient full name must be at least 2 characters.');
    }

    if ('age' in payload && payload.age !== '' && payload.age !== null && payload.age !== undefined) {
        const age = Number(payload.age);
        if (!Number.isFinite(age) || age < 0 || age > 130) errors.push('Age must be between 0 and 130.');
        else payload.age = age;
    }

    if ('gender' in payload && payload.gender && !['male', 'female', 'other'].includes(payload.gender)) {
        errors.push('Gender must be male, female, or other.');
    }

    if ('email' in payload && payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.push('Email format is invalid.');
    }

    if ('phone' in payload && payload.phone && !/^[0-9+()-]{7,20}$/.test(payload.phone)) {
        errors.push('Phone number format is invalid.');
    }

    if ('emergency_contact_phone' in payload && payload.emergency_contact_phone) {
        payload.emergency_contact_phone = normalizePhone(payload.emergency_contact_phone);
        if (!/^[0-9+()-]{7,20}$/.test(payload.emergency_contact_phone)) {
            errors.push('Emergency contact phone format is invalid.');
        }
    }

    if ('blood_group' in payload && payload.blood_group) {
        payload.blood_group = String(payload.blood_group).toUpperCase();
        if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(payload.blood_group)) {
            errors.push('Blood group must be A+, A-, B+, B-, AB+, AB-, O+, or O-.');
        }
    }

    if (errors.length) {
        const err = new Error(errors.join(' '));
        err.status = 400;
        err.errors = errors;
        throw err;
    }

    return payload;
}

async function findPotentialDuplicatePatients(req, payload = {}, currentId = null) {
    const or = [];
    if (payload.patient_id) or.push({ patient_id: payload.patient_id });
    if (payload.phone) or.push({ phone: normalizePhone(payload.phone) });
    if (payload.email) or.push({ email: normalizeEmail(payload.email) });
    if (payload.full_name && payload.age !== undefined && payload.gender) {
        or.push({ full_name: new RegExp(`^${String(payload.full_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), age: Number(payload.age), gender: payload.gender });
    }
    if (!or.length) return [];
    const filter = activePatientFilter(req, { $or: or });
    if (currentId) filter.id = { $ne: Number(currentId) };
    return Patient.find(filter).select('id patient_id patient_uid full_name age gender phone email').limit(5).lean();
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

function patientIdentityFilter(patient) {
    const keys = [patient.patient_id, patient.patient_uid, String(patient.id)].filter(Boolean).map(String);
    const numericIds = keys.map(Number).filter((n) => !Number.isNaN(n));
    return {
        $or: [
            { patient_id: { $in: keys } },
            { patient_id: { $in: numericIds } },
            { patient_uid: { $in: keys } },
        ],
    };
}


function timelineFilter(req, patient, extra = {}) {
    return {
        $and: [
            tenantFilter(req),
            patientIdentityFilter(patient),
            extra,
        ],
    };
}

function notArchivedFilter(extra = {}) {
    return {
        ...extra,
        deleted_at: { $exists: false },
        archived_at: { $exists: false },
        is_archived: { $ne: true },
        status: { $nin: ['archived', 'deleted'] },
    };
}

function formatTimelineItem(type, title, date, payload = {}, meta = {}) {
    return {
        type,
        title,
        date: date || payload.created_at || payload.updated_at || new Date(0),
        status: payload.status || payload.payment_status || payload.test_status || '',
        priority: payload.priority || '',
        doctor_id: payload.doctor_id || '',
        payload,
        meta,
    };
}

function totalDueAmount(bills = []) {
    return bills.reduce((sum, bill) => sum + Number(bill.due_amount ?? Math.max(Number(bill.total_amount || bill.amount || 0) - Number(bill.paid_amount || 0), 0)), 0);
}

async function safeTimelineQuery(label, queryPromise) {
    try {
        return await queryPromise;
    } catch (error) {
        console.warn(`Patient timeline section skipped (${label}):`, error?.message || error);
        return [];
    }
}

async function buildPatientTimeline(req, patient) {
    const [appointments, opdRecords, prescriptions, bills, labTests, radiologyTests, admissions, pharmacySales, clinicalRecords, insuranceClaims, nursingNotes] = await Promise.all([
        safeTimelineQuery('appointments', Appointment.find(timelineFilter(req, patient, notArchivedFilter())).sort({ appointment_date: -1, appointment_time: -1, id: -1 }).lean()),
        safeTimelineQuery('opdRecords', OpdRecord.find(timelineFilter(req, patient, notArchivedFilter())).sort({ visit_date: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('prescriptions', Prescription.find(timelineFilter(req, patient, { status: { $ne: 'archived' } })).sort({ visit_date: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('bills', Billing.find(timelineFilter(req, patient, notArchivedFilter())).sort({ billing_date: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('labTests', LabTest.find(timelineFilter(req, patient, { test_status: { $nin: ['archived', 'deleted'] } })).sort({ created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('radiologyTests', RadiologyTest.find(timelineFilter(req, patient, { status: { $nin: ['archived', 'deleted'] } })).sort({ created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('admissions', IpdAdmission.find(timelineFilter(req, patient, notArchivedFilter())).sort({ admission_date: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('pharmacySales', PharmacySale.find(timelineFilter(req, patient, notArchivedFilter())).sort({ sold_at: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('clinicalRecords', ClinicalRecord.find(timelineFilter(req, patient, { status: { $ne: 'archived' } })).sort({ record_date: -1, created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('insuranceClaims', InsuranceClaim.find(timelineFilter(req, patient)).sort({ created_at: -1, id: -1 }).lean()),
        safeTimelineQuery('nursingNotes', NursingNote.find(timelineFilter(req, patient)).sort({ note_date: -1, created_at: -1, id: -1 }).lean()),
    ]);

    const documents = (patient.documents || []).filter((doc) => !doc.deleted_at).map((doc, index) => formatTimelineItem(
        'document',
        doc.title || doc.file_name || `Document ${index + 1}`,
        doc.uploaded_at,
        { ...doc, id: index },
        { category: doc.category || doc.document_type || 'document' },
    ));

    const registrationEvent = formatTimelineItem(
        'registration',
        'Patient registered',
        patient.created_at,
        { id: patient.id, patient_id: patient.patient_id, patient_uid: patient.patient_uid, full_name: patient.full_name, status: patient.status || 'active' },
    );

    const timeline = [
        registrationEvent,
        ...appointments.map((a) => formatTimelineItem(
            'appointment',
            `${String(a.appointment_type || 'OPD').toUpperCase()} appointment`,
            `${a.appointment_date || ''} ${a.appointment_time || ''}`.trim() || a.created_at,
            a,
        )),
        ...opdRecords.map((o) => formatTimelineItem('opd', o.is_finalized ? 'Finalized OPD consultation' : 'OPD consultation', o.visit_date || o.created_at, o)),
        ...clinicalRecords.map((c) => formatTimelineItem('clinical', c.title || c.record_type || 'Clinical record', c.record_date || c.created_at, c)),
        ...prescriptions.map((rx) => formatTimelineItem('prescription', rx.prescription_number || 'Prescription', rx.visit_date || rx.created_at, rx)),
        ...bills.map((b) => formatTimelineItem('billing', b.invoice_number || 'Billing record', b.billing_date || b.created_at, b)),
        ...pharmacySales.map((s) => formatTimelineItem('pharmacy', s.sale_number || s.medicine_name || 'Pharmacy sale', s.sold_at || s.created_at, s)),
        ...labTests.map((l) => formatTimelineItem('lab', l.test_name || l.name || 'Lab test', l.sample_collected_at || l.created_at, l)),
        ...radiologyTests.map((r) => formatTimelineItem('radiology', r.scan_name || r.name || 'Radiology record', r.scanned_at || r.created_at, r)),
        ...admissions.map((i) => formatTimelineItem('ipd', i.discharge_date ? 'IPD discharge/admission record' : 'IPD admission', i.admission_date || i.created_at, i)),
        ...insuranceClaims.map((c) => formatTimelineItem('insurance', c.claim_number || 'Insurance/TPA claim', c.submitted_at || c.created_at, c)),
        ...nursingNotes.map((n) => formatTimelineItem('nursing', n.title || 'Nursing note', n.note_date || n.created_at, n)),
        ...documents,
    ].filter((item) => item.date).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return {
        patient,
        summary: {
            appointments: appointments.length,
            consultations: opdRecords.length,
            clinicalRecords: clinicalRecords.length,
            prescriptions: prescriptions.length,
            bills: bills.length,
            pendingAmount: totalDueAmount(bills),
            labTests: labTests.length,
            radiologyTests: radiologyTests.length,
            admissions: admissions.length,
            pharmacySales: pharmacySales.length,
            insuranceClaims: insuranceClaims.length,
            nursingNotes: nursingNotes.length,
            documents: documents.length,
            totalEvents: timeline.length,
        },
        timeline,
        appointments,
        opdRecords,
        clinicalRecords,
        prescriptions,
        bills,
        labTests,
        radiologyTests,
        admissions,
        pharmacySales,
        insuranceClaims,
        nursingNotes,
        documents,
    };
}

router.get(
    "/",
    requirePermission("patient.view"),
    asyncHandler(async (req, res) => {
        const rows = await Patient.find(activePatientFilter(req)).sort({ id: -1 });
        res.json(rows.map(normalizePatientResponse));
    }),
);

router.get(
    "/duplicate-check",
    requirePermission("patient.view"),
    asyncHandler(async (req, res) => {
        const payload = validatePatientPayload(req.query, { partial: true });
        const matches = await findPotentialDuplicatePatients(req, payload, req.query.exclude_id);
        res.json({ duplicate: matches.length > 0, matches });
    }),
);

router.get(
    "/:id/timeline",
    requirePermission("patient.view"),
    asyncHandler(async (req, res) => {
        const patient = await findPatientByPublicId(req, req.params.id).lean();
        if (!patient) return res.status(404).json({ message: "Patient not found" });
        try {
            await auditEvent({ req, action: 'patient.timeline.viewed', module_name: 'patients', entity_type: 'Patient', entity_id: patient.id, severity: 'info', metadata: { patient_id: patient.patient_id, patient_uid: patient.patient_uid } });
        } catch (error) {
            console.warn('Patient timeline audit skipped:', error?.message || error);
        }
        try {
            res.json(await buildPatientTimeline(req, patient));
        } catch (error) {
            console.error('Patient timeline failed:', error);
            res.status(500).json({ message: error?.message || 'Patient timeline failed' });
        }
    }),
);
router.get(
    "/:id",
    requirePermission("patient.view"),
    asyncHandler(async (req, res) => {
        const r = await findPatientByPublicId(req, req.params.id);
        if (!r) return res.status(404).json({ message: "Patient not found" });
        await auditEvent({ req, action: 'patient.viewed', module_name: 'patients', entity_type: 'Patient', entity_id: r.id, severity: 'info', metadata: { patient_id: r.patient_id, patient_uid: r.patient_uid } });
        res.json(normalizePatientResponse(r));
    }),
);
router.post(
    "/",
    requirePermission("patient.create"),
    asyncHandler(async (req, res) => {
        const uid = req.body.patient_uid || `PAT-${Date.now()}`;
        const custom_fields = await validateCustomFields(req, 'patients', req.body.custom_fields || {});
        const payload = validatePatientPayload({ ...req.body, custom_fields, patient_uid: uid });
        if (Object.prototype.hasOwnProperty.call(payload, 'patient_id')) {
            payload.patient_id = cleanString(payload.patient_id);
            if (!payload.patient_id) delete payload.patient_id;
        }
        if (payload.patient_id) {
            const existingPatient = await Patient.findOne(activePatientFilter(req, { patient_id: payload.patient_id })).lean();
            if (existingPatient) {
                return res.status(409).json({
                    message: `Patient ID already exists for ${existingPatient.full_name || 'another patient'}: ${payload.patient_id}`,
                });
            }
        }
        try {
            const limitCheck = await ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'patients', 1);
            if (!limitCheck.ok) return res.status(402).json({ message: limitCheck.message, subscription: limitCheck.subscription });
            const duplicateWarnings = await findPotentialDuplicatePatients(req, payload);
            const r = await Patient.create(tenantCreateData(req, payload));
            await auditEvent({ req, action: 'patient.created', module_name: 'patients', entity_type: 'Patient', entity_id: r.id, new_value: r.toJSON?.() || r });
            res.status(201).json({ message: "Patient created", id: r.id, public_id: String(r.id), patient_uid: uid, patient: normalizePatientResponse(r), duplicate_warnings: duplicateWarnings });
        } catch (error) {
            if (error?.code === 11000) {
                return res.status(409).json({
                    message: 'Patient ID already exists in this hospital. Please use a different Patient ID.',
                });
            }
            throw error;
        }
    }),
);
router.put(
    "/:id",
    requirePermission("patient.edit"),
    asyncHandler(async (req, res) => {
        const allowed = [
            "patient_id",
            "full_name",
            "age",
            "gender",
            "phone",
            "email",
            "address",
            "blood_group",
            "medical_notes",

            "emergency_contact_name",
            "emergency_contact_phone",
            "insurance_provider",
            "insurance_policy_number",
            "custom_fields",

            "documents",
        ];
        const update = {};
        allowed.forEach((k) => {
            if (k in req.body) update[k] = cleanString(req.body[k]);
        });
        Object.assign(update, validatePatientPayload(update, { partial: true }));
        if ('custom_fields' in req.body) update.custom_fields = await validateCustomFields(req, 'patients', req.body.custom_fields || {});
        if (!Object.keys(update).length)
            return res.status(400).json({ message: "No valid fields to update" });

        const existingPatient = await findPatientByPublicId(req, req.params.id).lean();
        if (!existingPatient) return res.status(404).json({ message: "Patient not found" });
        const patientNumericId = Number(existingPatient.id);

        if (Object.prototype.hasOwnProperty.call(update, 'patient_id')) {
            if (!update.patient_id) delete update.patient_id;
            else {
                const duplicatePatient = await Patient.findOne(activePatientFilter(req, {
                    patient_id: update.patient_id,
                    id: { $ne: patientNumericId },
                })).lean();
                if (duplicatePatient) {
                    return res.status(409).json({
                        message: `Patient ID already exists for ${duplicatePatient.full_name || 'another patient'}: ${update.patient_id}`,
                    });
                }
            }
        }

        const sensitiveFields = ['medical_notes', 'insurance_provider', 'insurance_policy_number', 'documents'];
        const changedSensitiveFields = sensitiveFields.filter((field) => Object.prototype.hasOwnProperty.call(update, field) && JSON.stringify(existingPatient[field] ?? null) !== JSON.stringify(update[field] ?? null));
        if (changedSensitiveFields.length && !req.body.reason && !req.body.edit_reason) {
            return res.status(400).json({ message: `Edit reason is required for sensitive patient changes: ${changedSensitiveFields.join(', ')}` });
        }

        try {
            const updated = await Patient.findOneAndUpdate(
                patientLookupFilter(req, req.params.id),
                { $set: update },
                { new: true, runValidators: true },
            ).lean();
            await auditEvent({ req, action: 'patient.updated', module_name: 'patients', entity_type: 'Patient', entity_id: patientNumericId, old_value: existingPatient, new_value: updated, reason: req.body.reason || req.body.edit_reason || null, metadata: { sensitive_fields: changedSensitiveFields } });
            res.json({ message: "Patient updated", id: updated?.id || patientNumericId, public_id: String(updated?.id || patientNumericId), patient: normalizePatientResponse(updated), duplicate_warnings: await findPotentialDuplicatePatients(req, { ...existingPatient, ...update }, patientNumericId) });
        } catch (error) {
            if (error?.code === 11000) {
                return res.status(409).json({
                    message: 'Patient ID already exists in this hospital. Please use a different Patient ID.',
                });
            }
            throw error;
        }
    }),
);
router.post(
    "/:id/documents",
    requirePermission("patient.document.manage"),
    upload.single("document"),
    asyncHandler(async (req, res) => {
        const patient = await findPatientByPublicId(req, req.params.id);

        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Document file is required" });
        }

        let fileUrl;
        let filePublicId = "";
        let storage = "database";

        if (hasCloudinaryConfig()) {
            const result = await uploadBufferToCloudinary(req.file, {
                folder: "hms/patient-documents",
                resource_type: "auto",
            });
            fileUrl = result.secure_url;
            filePublicId = result.public_id;
            storage = "cloudinary";
        } else {
            fileUrl = fileToDataUrl(req.file);
        }

        const newDoc = {
            title: req.body.title || req.file.originalname,
            category: req.body.category || "medical",
            document_type: req.body.document_type || "Other",
            notes: req.body.notes || "",
            file_name: req.file.originalname,
            file_type: req.file.mimetype,
            file_size: req.file.size,
            file_url: fileUrl,
            file_public_id: filePublicId,
            storage,
            uploaded_at: new Date(),
        };

        patient.documents = patient.documents || [];
        patient.documents.push(newDoc);

        await patient.save();
        await auditEvent({ req, action: 'patient.document.uploaded', module_name: 'patients', entity_type: 'Patient', entity_id: patient.id, severity: 'warning', new_value: { title: newDoc.title, category: newDoc.category, file_name: newDoc.file_name, file_type: newDoc.file_type, file_size: newDoc.file_size, storage: newDoc.storage } });

        res.status(201).json({
            message: storage === "cloudinary" ? "Document uploaded successfully" : "Document saved successfully. Cloudinary is not configured, so the file was stored in MongoDB.",
            document: newDoc,
            documents: normalizePatientResponse(patient).documents,
        });
    }),
);
router.post(
    "/:id/profile-image",
    requirePermission("patient.document.manage"),
    upload.single("profile_image"),
    asyncHandler(async (req, res) => {
        const patient = await findPatientByPublicId(req, req.params.id);

        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Profile image is required" });
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: "Only JPG, PNG, and WEBP images are allowed",
            });
        }

        await safelyDestroyCloudinary(patient.profile_image_public_id, "image");

        let profileImageUrl;
        let profileImagePublicId = "";
        let profileImageStorage = "database";

        if (hasCloudinaryConfig()) {
            const result = await uploadBufferToCloudinary(req.file, {
                folder: "hms/patient-profile-images",
                resource_type: "image",
            });
            profileImageUrl = result.secure_url;
            profileImagePublicId = result.public_id;
            profileImageStorage = "cloudinary";
        } else {
            profileImageUrl = fileToDataUrl(req.file);
        }

        patient.profile_image_url = profileImageUrl;
        patient.profile_image_public_id = profileImagePublicId;
        patient.profile_image_storage = profileImageStorage;

        await patient.save();
        await auditEvent({ req, action: 'patient.profile_image.updated', module_name: 'patients', entity_type: 'Patient', entity_id: patient.id, severity: 'warning', old_value: { profile_image_public_id: patient.profile_image_public_id }, new_value: { storage: profileImageStorage, file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size } });

        res.json({
            message: profileImageStorage === "cloudinary" ? "Patient profile image uploaded successfully" : "Patient profile image saved successfully. Cloudinary is not configured, so the file was stored in MongoDB.",
            profile_image_url: patient.profile_image_url,
            profile_image_public_id: patient.profile_image_public_id,
            storage: profileImageStorage,
            patient: normalizePatientResponse(patient),
        });
    }),
);
router.delete(
    "/:id/documents/:docIndex",
    requirePermission("patient.document.manage"),
    asyncHandler(async (req, res) => {
        const patient = await findPatientByPublicId(req, req.params.id);

        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        const docIndex = Number(req.params.docIndex);
        const doc = patient.documents?.[docIndex];

        if (!doc) {
            return res.status(404).json({ message: "Document not found" });
        }

        if (!req.body?.reason && !req.query?.reason) {
            return res.status(400).json({ message: 'Document delete reason is required.' });
        }

        await safelyDestroyCloudinary(doc.file_public_id, "auto");

        patient.documents.splice(docIndex, 1);
        await patient.save();
        await auditEvent({ req, action: 'patient.document.deleted', module_name: 'patients', entity_type: 'Patient', entity_id: patient.id, old_value: { title: doc.title, category: doc.category, file_name: doc.file_name, file_type: doc.file_type, file_size: doc.file_size, storage: doc.storage }, reason: req.body?.reason || req.query?.reason, severity: 'warning' });

        res.json({
            message: "Document deleted successfully",
            documents: normalizePatientResponse(patient).documents,
        });
    }),
);
router.delete(
    "/:id",
    requirePermission("patient.delete"),
    asyncHandler(async (req, res) => {
        const patient = await findPatientByPublicId(req, req.params.id).lean();
        if (!patient) return res.status(404).json({ message: "Patient not found" });
        await Patient.findOneAndUpdate(
            patientLookupFilter(req, req.params.id),
            { $set: { status: 'inactive', deleted_at: new Date(), deleted_by: req.user?.id || null } },
        );
        await auditEvent({ req, action: 'patient.soft_deleted', module_name: 'patients', entity_type: 'Patient', entity_id: req.params.id, old_value: patient });
        res.json({ message: "Patient archived" });
    }),
);
module.exports = router;
