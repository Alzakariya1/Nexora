const { mongoose } = require("../config/db");
const { getCurrentTenantDbName, getTenantModel } = require("../config/tenantDb");
const opts = {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    strict: false,
    versionKey: false,
};
const counterSchema = new mongoose.Schema(
    { _id: String, seq: { type: Number, default: 0 } },
    { versionKey: false },
);
const Counter = mongoose.model("Counter", counterSchema);
async function nextId(name, db) {
    const counterModel = db?.models?.Counter || (db ? db.model("Counter", counterSchema) : Counter);
    const c = await counterModel.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
    );
    return c.seq;
}
const TENANT_COLLECTIONS = new Set([
    "departments", "patients", "doctors", "doctor_schedules", "appointments", "beds",
    "opd_records", "ipd_admissions", "nursing_notes", "lab_test_templates", "lab_tests",
    "radiology_tests", "medicines", "pharmacy_sales", "billing", "billings", "insurance_claims",
    "prescriptions", "clinical_records", "audit_logs", "login_history", "security_settings",
    "dynamic_fields", "templates", "notifications", "communication_logs", "suppliers",
    "inventory_items", "inventory_batches", "purchase_orders", "supplier_bills",
    "stock_receivings", "stock_returns", "inventory_transactions", "consent_forms",
    "incident_reports", "sop_documents", "compliance_checklists", "backup_verifications",
    "api_keys", "integration_logs", "webhook_subscriptions", "webhook_events",
    "data_requests", "security_incidents", "policy_acknowledgements",
    "pilot_deployments", "pilot_tasks", "knowledge_base_articles",
    "tenant_restore_requests", "tenant_data_exports", "tenant_disaster_recovery_logs",
    "ot_bookings", "surgery_notes", "anaesthesia_notes", "post_op_notes", "ot_inventory_usages",
    "nursing_vitals", "medication_administrations", "nursing_handover_notes", "nursing_care_plans", "nursing_shift_tasks",
    "emergency_cases", "emergency_triage_notes", "emergency_clinical_notes", "emergency_transfers",
    "blood_donors", "blood_units", "blood_requisitions", "blood_cross_matches", "blood_issue_records", "blood_reservations",
    "staff_profiles", "staff_attendance", "staff_shift_rosters", "staff_leave_requests", "staff_payroll_exports",
    "hl7_messages",
    "abdm_consents", "abha_care_contexts"
]);
function tenantAwareModel(model, name, schema, collection) {
    if (!TENANT_COLLECTIONS.has(collection)) return model;
    return new Proxy(model, {
        get(target, prop) {
            if (prop === "schema" || prop === "modelName" || prop === "collection" || prop === "db" || prop === Symbol.toStringTag) return target[prop];
            const dbName = getCurrentTenantDbName();
            const active = dbName ? getTenantModel(name, schema, collection, dbName) : target;
            const value = active[prop];
            return typeof value === "function" ? value.bind(active) : value;
        },
        apply(target, thisArg, argArray) {
            const dbName = getCurrentTenantDbName();
            const active = dbName ? getTenantModel(name, schema, collection, dbName) : target;
            return Reflect.apply(active, thisArg, argArray);
        },
        construct(target, argArray) {
            const dbName = getCurrentTenantDbName();
            const active = dbName ? getTenantModel(name, schema, collection, dbName) : target;
            return Reflect.construct(active, argArray);
        },
    });
}
function makeModel(name, collection, extra = {}) {
    const schema = new mongoose.Schema({ id: { type: Number }, ...extra }, opts);
    schema.pre("validate", async function (next) {
        if (this.isNew && !this.id) this.id = await nextId(collection, this.constructor.db);
        next();
    });
    schema.set("toJSON", {
        transform: (_, ret) => {
            delete ret._id;
            return ret;
        },
    });
    return tenantAwareModel(mongoose.model(name, schema, collection), name, schema, collection);
}
const User = makeModel("User", "users", {
    email: { type: String, unique: true, index: true },
    hospital_id: { type: Number, default: 1, index: true },
    role: { type: String, default: "receptionist" },
    status: { type: String, default: "active" },
    permissions: { type: [String], default: [] },
    failed_login_attempts: { type: Number, default: 0 },
    locked_until: Date,
    last_failed_login_at: Date,
    password_changed_at: Date,
});
const AuthSession = makeModel("AuthSession", "auth_sessions", {
    user_id: { type: Number, index: true },
    hospital_id: { type: Number, default: 1, index: true },
    session_id: { type: String, unique: true, index: true },
    refresh_token_hash: { type: String, index: true },
    user_agent: String,
    ip: String,
    status: { type: String, default: "active", index: true },
    expires_at: { type: Date, index: true },
    revoked_at: Date,
    revoked_by: Number,
    last_used_at: Date,
});
const Hospital = makeModel("Hospital", "hospitals", {
    hospital_code: { type: String, unique: true, sparse: true, index: true },
    tenant_db_name: { type: String, sparse: true, index: true },
    tenant_db_status: { type: String, default: "shared" },
    tenant_db_created_at: Date,
    name: { type: String, default: "Default Hospital" },
    type: { type: String, default: "hospital" },
    status: { type: String, default: "active" },
    plan: { type: String, default: "enterprise" },
    plan_limits: { type: Object, default: {} },
    subscription: {
        type: Object,
        default: {
            status: "active",
            billing_cycle: "monthly",
            renewal_date: null,
            next_billing_date: null,
            trial_start_date: null,
            trial_end_date: null,
            cancelled_at: null,
            suspended_at: null,
            notes: "",
        },
    },
    enabled_modules: { type: [String], default: ['dashboard', 'commandCenter', 'patients', 'doctors', 'appointments', 'emr', 'beds', 'ipd', 'lab', 'radiology', 'pharmacy', 'inventory', 'bloodBank', 'hrStaff', 'billing', 'compliance', 'integration', 'profile', 'operations', 'tenants'] },
    feature_flags: {
        type: Object,
        default: {
            fhir: false,
            hl7: false,
            pacs: false,
            biometric: false,
            insurance_tpa: false,
            erp: false,
            whatsapp_sms: false,
            abdm_abha: false,
            two_factor_auth: false,
            audit_compliance: true,
        },
    },
    branding: { type: Object, default: {} },
    settings: { type: Object, default: {} },
    branches: { type: [Object], default: [] },
    onboarding: {
        type: Object,
        default: {
            status: 'not_started',
            current_step: 'hospital_profile',
            completed_steps: [],
            module_setup_done: false,
            branding_done: false,
            branch_setup_done: false,
            admin_setup_done: false,
            settings_done: false,
            completed_at: null,
            completed_by: null,
            notes: '',
        },
    },
});
const Department = makeModel("Department", "departments", { hospital_id: { type: Number, default: 1, index: true } });

const Patient = makeModel("Patient", "patients", {
    hospital_id: { type: Number, default: 1, index: true },
    // Patient ID is unique per tenant/hospital, not globally.
    patient_id: { type: String, trim: true, index: true },

    full_name: String,
    age: Number,
    gender: String,
    phone: String,
    email: String,
    address: String,
    blood_group: String,
    medical_notes: String,
    custom_fields: { type: Object, default: {} },

    profile_image_url: String,
    profile_image_public_id: String,
    profile_image_storage: String,

    emergency_contact_name: String,
    emergency_contact_phone: String,
    insurance_provider: String,
    insurance_policy_number: String,

    status: { type: String, default: "active", index: true },
    deleted_at: Date,
    deleted_by: Number,

    documents: [
        {
            title: String,
            category: String,
            document_type: String,
            notes: String,
            file_name: String,
            file_type: String,
            file_size: Number,
            file_url: String,
            file_public_id: String,
            storage: String,
            uploaded_at: {
                type: Date,
                default: Date.now,
            },
        },
    ],
});


Patient.schema.index(
    { hospital_id: 1, patient_id: 1 },
    {
        unique: true,
        name: "patient_hospital_patient_id_unique",
        partialFilterExpression: { patient_id: { $type: "string" } },
    },
);

const Doctor = makeModel("Doctor", "doctors", {
    hospital_id: { type: Number, default: 1, index: true },
    // Keep doctor_id unique per hospital through the compound index below.
    // Do not mark this field globally unique, otherwise different hospitals cannot use the same doctor_id.
    doctor_id: { type: String, trim: true },

    full_name: String,
    email: String,
    phone: String,
    specialization: String,
    qualification: String,
    consultation_fee: Number,
    department_id: Number,
    status: { type: String, default: "active", index: true },
    deleted_at: Date,
    deleted_by: Number,
    custom_fields: { type: Object, default: {} },

    // Reserved for the next doctor-profile phase. Keeping these schema fields now is backward compatible
    // because strict:false already allowed them, but defining them documents the intended structure.
    profile_image_url: String,
    profile_image_public_id: String,
    profile_image_storage: String,
    license_number: String,
    registration_number: String,
    certificates: [
        {
            title: String,
            category: String,
            document_type: String,
            notes: String,
            file_name: String,
            file_type: String,
            file_size: Number,
            file_url: String,
            file_public_id: String,
            storage: String,
            uploaded_at: {
                type: Date,
                default: Date.now,
            },
        },
    ],
});
Doctor.schema.index(
    { hospital_id: 1, doctor_id: 1 },
    {
        unique: true,
        name: "doctor_hospital_doctor_id_unique",
        partialFilterExpression: { doctor_id: { $type: "string" } },
    },
);
const DoctorSchedule = makeModel("DoctorSchedule", "doctor_schedules", {
    hospital_id: { type: Number, default: 1, index: true },
    doctor_ref_id: Number,
    doctor_id: { type: String, trim: true },
    working_days: { type: [String], default: [] },
    start_time: String,
    end_time: String,
    break_start: String,
    break_end: String,
    slot_duration: { type: Number, default: 15 },
    max_patients_per_day: { type: Number, default: 0 },
    unavailable_dates: { type: [String], default: [] },
    notes: String,
    status: { type: String, default: "active" },
});
DoctorSchedule.schema.index(
    { hospital_id: 1, doctor_ref_id: 1 },
    { name: "doctor_schedule_hospital_doctor_lookup" },
);

const Appointment = makeModel("Appointment", "appointments", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true },
    doctor_id: { type: String, trim: true },
    appointment_uid: String,
    appointment_date: String,
    appointment_time: String,
    appointment_type: { type: String, default: "opd" },
    status: { type: String, default: "scheduled" },
    // Canonical visible queue token. Format: YYYYMMDD-001, unique per hospital per date.
    token_number: { type: String, trim: true },
    token_sequence: { type: Number, default: 0, index: true },
    checked_in_at: Date,
    consultation_started_at: Date,
    completed_at: Date,
    cancelled_at: Date,
    cancellation_reason: String,
    no_show_reason: String,
    reschedule_reason: String,
    rescheduled_at: Date,
    previous_schedule: { type: Object, default: null },
    deleted_at: Date,
    deleted_by: Number,
    notes: String,
});
Appointment.schema.index(
    { hospital_id: 1, doctor_id: 1, appointment_date: 1, appointment_time: 1, status: 1 },
    { name: "appointment_doctor_slot_lookup" },
);
Appointment.schema.index(
    { hospital_id: 1, appointment_date: 1, token_number: 1 },
    { name: "appointment_daily_token_lookup" },
);
Appointment.schema.index(
    { hospital_id: 1, appointment_date: 1, token_sequence: 1 },
    { name: "appointment_daily_token_sequence_lookup" },
);
const AppointmentTokenCounter = makeModel("AppointmentTokenCounter", "appointment_token_counters", {
    hospital_id: { type: Number, default: 1, index: true },
    appointment_date: { type: String, required: true, index: true },
    seq: { type: Number, default: 0 },
});
AppointmentTokenCounter.schema.index(
    { hospital_id: 1, appointment_date: 1 },
    { unique: true, name: "appointment_token_counter_hospital_date_unique" },
);
const Bed = makeModel("Bed", "beds", {
    hospital_id: { type: Number, default: 1, index: true },
    ward: { type: String, trim: true, default: "General", index: true },
    bed_number: { type: String, trim: true, required: true },
    status: { type: String, default: "available", index: true },
});
Bed.schema.index(
    { hospital_id: 1, ward: 1, bed_number: 1 },
    { unique: true, name: "bed_hospital_ward_number_unique", partialFilterExpression: { bed_number: { $type: "string" } } },
);
const OpdRecord = makeModel("OpdRecord", "opd_records", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    appointment_id: Number,
    visit_date: String,
    chief_complaint: String,
    history_present_illness: String,
    past_history: String,
    medication_history: String,
    surgical_history: String,
    family_history: String,
    allergies: { type: [String], default: [] },
    vitals: { type: Object, default: {} },
    examination_findings: String,
    diagnosis: String,
    provisional_diagnosis: String,
    final_diagnosis: String,
    diagnosis_code: String,
    clinical_notes: String,
    treatment_plan: String,
    advice: String,
    referral_notes: String,
    investigation_orders: { type: [Object], default: [] },
    follow_up_date: String,
    prescriptions: { type: [Object], default: [] },
    status: { type: String, default: "completed", index: true },
    is_finalized: { type: Boolean, default: false },
    locked_at: Date,
    finalized_by: Number,
    archived_at: Date,
    archived_by: Number,
    archive_reason: String,
    last_edit_reason: String,
    last_edited_by: Number,
    last_edited_at: Date,
});
OpdRecord.schema.index({ hospital_id: 1, patient_id: 1, visit_date: -1 }, { name: "opd_patient_visit_lookup" });
OpdRecord.schema.index({ hospital_id: 1, doctor_id: 1, visit_date: -1 }, { name: "opd_doctor_visit_lookup" });
const IpdAdmission = makeModel("IpdAdmission", "ipd_admissions", { hospital_id: { type: Number, default: 1, index: true } });
const NursingNote = makeModel("NursingNote", "nursing_notes", { hospital_id: { type: Number, default: 1, index: true } });
const LabTestTemplate = makeModel("LabTestTemplate", "lab_test_templates", {
    hospital_id: { type: Number, default: 1, index: true },
    template_code: { type: String, trim: true, index: true },
    test_name: { type: String, trim: true, required: true, index: true },
    test_category: { type: String, default: "General", index: true },
    sample_type: { type: String, default: "Blood" },
    container: String,
    turnaround_hours: { type: Number, default: 24 },
    price: { type: Number, default: 0 },
    machine_code: String,
    loinc_code: String,
    method: String,
    parameters: { type: [Object], default: [] }, // name, unit, normal_range, min, max, input_type
    report_template: String,
    status: { type: String, default: "active", index: true },
});
LabTestTemplate.schema.index({ hospital_id: 1, test_name: 1 }, { name: "lab_template_hospital_test_lookup" });

const LabTest = makeModel("LabTest", "lab_tests", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    appointment_id: Number,
    opd_id: Number,
    template_id: Number,
    test_name: String,
    test_category: String,
    sample_type: String,
    sample_barcode: { type: String, trim: true, index: true },
    accession_number: { type: String, trim: true, index: true },
    machine_order_id: String,
    priority: { type: String, default: "routine" },
    test_status: { type: String, default: "ordered", index: true },
    collected_by: String,
    sample_collected_at: Date,
    received_at: Date,
    processing_started_at: Date,
    completed_at: Date,
    approved_at: Date,
    approved_by: String,
    result_parameters: { type: [Object], default: [] },
    interpretation: String,
    report_file: String,
    report_pdf_url: String,
    report_notes: String,
    report_version: { type: Number, default: 1 },
    integration_payload: { type: Object, default: {} },
});
LabTest.schema.index({ hospital_id: 1, sample_barcode: 1 }, { name: "lab_sample_barcode_lookup" });
LabTest.schema.index({ hospital_id: 1, test_status: 1, created_at: -1 }, { name: "lab_status_recent_lookup" });

const RadiologyTest = makeModel("RadiologyTest", "radiology_tests", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    appointment_id: Number,
    opd_id: Number,
    scan_name: String,
    scan_category: String,
    modality: { type: String, default: "XRAY", index: true },
    body_part: String,
    priority: { type: String, default: "routine" },
    status: { type: String, default: "ordered", index: true },
    accession_number: { type: String, trim: true, index: true },
    dicom_study_id: { type: String, trim: true, index: true },
    pacs_viewer_url: String,
    scheduled_at: Date,
    scanned_at: Date,
    reported_at: Date,
    approved_at: Date,
    radiologist_id: String,
    radiologist_name: String,
    technician_name: String,
    findings: String,
    impression: String,
    recommendation: String,
    image_file: String,
    report_file: String,
    report_pdf_url: String,
    report_notes: String,
    report_version: { type: Number, default: 1 },
    integration_payload: { type: Object, default: {} },
});
RadiologyTest.schema.index({ hospital_id: 1, dicom_study_id: 1 }, { name: "radiology_dicom_lookup" });
RadiologyTest.schema.index({ hospital_id: 1, status: 1, created_at: -1 }, { name: "radiology_status_recent_lookup" });
const Medicine = makeModel("Medicine", "medicines", {
    hospital_id: { type: Number, default: 1, index: true },
    name: { type: String, trim: true, index: true },
    generic_name: String,
    category: String,
    batch_number: String,
    vendor: String,
    expiry_date: String,
    quantity: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    low_stock_threshold: { type: Number, default: 10 },
    cost_price: { type: Number, default: 0 },
    selling_price: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    unit: { type: String, default: 'pcs' },
    status: { type: String, default: 'active' },
});
Medicine.schema.index({ hospital_id: 1, name: 1, batch_number: 1 }, { name: 'medicine_hospital_name_batch_lookup' });
const PharmacySale = makeModel("PharmacySale", "pharmacy_sales", {
    hospital_id: { type: Number, default: 1, index: true },
    sale_number: { type: String, index: true },
    medicine_id: Number,
    medicine_name: String,
    prescription_id: Number,
    patient_id: String,
    doctor_id: String,
    quantity: Number,
    selling_price: Number,
    total_amount: Number,
    payment_status: { type: String, default: 'paid' },
    sale_type: { type: String, default: 'direct' },
    sold_at: { type: Date, default: Date.now },
});


// V31 Enterprise Inventory + Purchase Order models
const Supplier = makeModel("Supplier", "suppliers", {
    hospital_id: { type: Number, default: 1, index: true },
    supplier_code: { type: String, trim: true, index: true },
    name: { type: String, trim: true, required: true, index: true },
    contact_person: String,
    phone: String,
    email: String,
    gst_number: String,
    address: String,
    payment_terms: String,
    status: { type: String, default: "active", index: true },
});
Supplier.schema.index({ hospital_id: 1, supplier_code: 1 }, { name: "supplier_hospital_code_lookup" });

const InventoryItem = makeModel("InventoryItem", "inventory_items", {
    hospital_id: { type: Number, default: 1, index: true },
    item_code: { type: String, trim: true, index: true },
    name: { type: String, trim: true, required: true, index: true },
    item_type: { type: String, default: "medicine", index: true }, // medicine, consumable, equipment, general
    category: String,
    unit: { type: String, default: "pcs" },
    barcode: { type: String, trim: true, index: true },
    sku: String,
    hsn_code: String,
    reorder_level: { type: Number, default: 10 },
    reorder_quantity: { type: Number, default: 0 },
    default_supplier_id: Number,
    location: String,
    status: { type: String, default: "active", index: true },
});
InventoryItem.schema.index({ hospital_id: 1, item_code: 1 }, { name: "inventory_item_hospital_code_lookup" });
InventoryItem.schema.index({ hospital_id: 1, barcode: 1 }, { name: "inventory_item_hospital_barcode_lookup" });

const InventoryBatch = makeModel("InventoryBatch", "inventory_batches", {
    hospital_id: { type: Number, default: 1, index: true },
    item_id: { type: Number, required: true, index: true },
    medicine_id: Number,
    item_name: String,
    batch_number: { type: String, trim: true, index: true },
    barcode: { type: String, trim: true, index: true },
    expiry_date: String,
    manufacture_date: String,
    quantity: { type: Number, default: 0 },
    received_quantity: { type: Number, default: 0 },
    cost_price: { type: Number, default: 0 },
    selling_price: { type: Number, default: 0 },
    supplier_id: Number,
    supplier_name: String,
    location: String,
    status: { type: String, default: "active", index: true },
});
InventoryBatch.schema.index({ hospital_id: 1, item_id: 1, batch_number: 1 }, { name: "inventory_batch_item_batch_lookup" });
InventoryBatch.schema.index({ hospital_id: 1, expiry_date: 1 }, { name: "inventory_batch_expiry_lookup" });

const PurchaseOrder = makeModel("PurchaseOrder", "purchase_orders", {
    hospital_id: { type: Number, default: 1, index: true },
    po_number: { type: String, index: true },
    supplier_id: { type: Number, index: true },
    supplier_name: String,
    order_date: String,
    expected_date: String,
    status: { type: String, default: "draft", index: true }, // draft, ordered, partially_received, received, cancelled
    subtotal: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    notes: String,
    items: { type: [Object], default: [] },
    created_by: Number,
});
PurchaseOrder.schema.index({ hospital_id: 1, po_number: 1 }, { unique: true, name: "po_hospital_number_unique" });

const SupplierBill = makeModel("SupplierBill", "supplier_bills", {
    hospital_id: { type: Number, default: 1, index: true },
    bill_number: { type: String, index: true },
    supplier_id: { type: Number, index: true },
    supplier_name: String,
    purchase_order_id: Number,
    invoice_number: String,
    invoice_date: String,
    due_date: String,
    amount: { type: Number, default: 0 },
    paid_amount: { type: Number, default: 0 },
    balance_amount: { type: Number, default: 0 },
    status: { type: String, default: "pending", index: true }, // pending, partial, paid, cancelled
    notes: String,
});
SupplierBill.schema.index({ hospital_id: 1, bill_number: 1 }, { unique: true, name: "supplier_bill_hospital_number_unique" });

const StockReceiving = makeModel("StockReceiving", "stock_receivings", {
    hospital_id: { type: Number, default: 1, index: true },
    receiving_number: { type: String, index: true },
    purchase_order_id: Number,
    supplier_id: Number,
    supplier_name: String,
    received_date: String,
    status: { type: String, default: "received", index: true },
    items: { type: [Object], default: [] },
    notes: String,
    received_by: Number,
});
StockReceiving.schema.index({ hospital_id: 1, receiving_number: 1 }, { unique: true, name: "stock_receiving_hospital_number_unique" });

const StockReturn = makeModel("StockReturn", "stock_returns", {
    hospital_id: { type: Number, default: 1, index: true },
    return_number: { type: String, index: true },
    supplier_id: Number,
    supplier_name: String,
    return_date: String,
    reason: String,
    status: { type: String, default: "returned", index: true },
    items: { type: [Object], default: [] },
    notes: String,
    returned_by: Number,
});
StockReturn.schema.index({ hospital_id: 1, return_number: 1 }, { unique: true, name: "stock_return_hospital_number_unique" });

const InventoryTransaction = makeModel("InventoryTransaction", "inventory_transactions", {
    hospital_id: { type: Number, default: 1, index: true },
    transaction_number: { type: String, index: true },
    transaction_type: { type: String, index: true }, // receive, return, dispense, adjustment
    item_id: Number,
    batch_id: Number,
    medicine_id: Number,
    item_name: String,
    batch_number: String,
    quantity: { type: Number, default: 0 },
    balance_after: { type: Number, default: 0 },
    reference_type: String,
    reference_id: Number,
    notes: String,
    performed_by: Number,
});
InventoryTransaction.schema.index({ hospital_id: 1, item_id: 1, created_at: -1 }, { name: "inventory_transaction_item_recent" });

const Billing = makeModel("Billing", "billing", {
    hospital_id: { type: Number, default: 1, index: true },
    invoice_number: { type: String, trim: true, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    items: { type: [Object], default: [] },
    amount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    gst_amount: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    paid_amount: { type: Number, default: 0 },
    due_amount: { type: Number, default: 0 },
    status: { type: String, default: "pending", index: true },
    payment_status: { type: String, default: "pending", index: true },
    payment_mode: String,
    transaction_id: String,
    service_type: { type: String, default: "opd", index: true },
    billing_type: { type: String, default: "opd", index: true },
    visit_type: String,
    admission_id: Number,
    appointment_id: Number,
    claim_id: Number,
    corporate_name: String,
    insurance_provider: String,
    approval_status: { type: String, default: "not_required", index: true },
    approval_reason: String,
    approved_by: Number,
    approved_at: Date,
    advance_amount: { type: Number, default: 0 },
    refund_amount: { type: Number, default: 0 },
    refund_reason: String,
    refunded_at: Date,
    refunded_by: Number,
    discount_reason: String,
    cancel_reason: String,
    cancelled_at: Date,
    cancelled_by: Number,
    is_archived: { type: Boolean, default: false, index: true },
    archived_at: Date,
    archived_by: Number,
    archive_reason: String,
    notes: String,
    billing_date: Date,
});
Billing.schema.index({ hospital_id: 1, invoice_number: 1 }, { unique: true, name: "billing_hospital_invoice_unique", partialFilterExpression: { invoice_number: { $type: "string" } } });
const InsuranceClaim = makeModel("InsuranceClaim", "insurance_claims", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    billing_id: { type: Number, index: true },
    invoice_number: String,
    insurance_provider: String,
    tpa_name: String,
    policy_number: String,
    claim_number: { type: String, index: true },
    claim_type: { type: String, default: "cashless" },
    claim_amount: { type: Number, default: 0 },
    approved_amount: { type: Number, default: 0 },
    paid_amount: { type: Number, default: 0 },
    balance_amount: { type: Number, default: 0 },
    status: { type: String, default: "draft", index: true },
    priority: { type: String, default: "normal" },
    admission_date: String,
    discharge_date: String,
    submitted_at: Date,
    approved_at: Date,
    settled_at: Date,
    rejection_reason: String,
    notes: String,
    documents: { type: [Object], default: [] },
    created_by: Number,
});
InsuranceClaim.schema.index({ hospital_id: 1, claim_number: 1 }, { unique: true, name: "insurance_claim_hospital_number_unique" });
InsuranceClaim.schema.index({ hospital_id: 1, status: 1, created_at: -1 }, { name: "insurance_claim_status_lookup" });
const Prescription = makeModel("Prescription", "prescriptions", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    appointment_id: { type: Number, index: true },
    opd_id: { type: Number, index: true },
    prescription_number: { type: String, index: true },
    status: { type: String, default: "active" },
});

const ClinicalRecord = makeModel("ClinicalRecord", "clinical_records", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, trim: true, index: true },
    doctor_id: { type: String, trim: true, index: true },
    appointment_id: Number,
    opd_id: Number,
    record_type: { type: String, default: "clinical_note", index: true },
    title: String,
    chief_complaint: String,
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
    diagnosis: String,
    severity: String,
    onset_date: String,
    status: { type: String, default: "active", index: true },
    notes: String,
    vitals: { type: Object, default: {} },
    attachments: { type: [Object], default: [] },
    recorded_by: Number,
    record_date: { type: Date, default: Date.now, index: true },
});
ClinicalRecord.schema.index({ hospital_id: 1, patient_id: 1, record_date: -1 }, { name: "clinical_record_patient_timeline_lookup" });
ClinicalRecord.schema.index({ hospital_id: 1, record_type: 1, status: 1 }, { name: "clinical_record_type_status_lookup" });


const ConsentForm = makeModel("ConsentForm", "consent_forms", {
    hospital_id: { type: Number, default: 1, index: true },
    consent_number: { type: String, index: true },
    patient_id: { type: String, trim: true, index: true },
    patient_name: String,
    consent_type: { type: String, default: "general", index: true },
    title: String,
    form_text: String,
    language: { type: String, default: "English" },
    status: { type: String, default: "draft", index: true }, // draft, signed, revoked, expired
    signed_by: String,
    relationship: String,
    signed_at: Date,
    witness_name: String,
    doctor_id: String,
    doctor_name: String,
    valid_until: String,
    digital_signature: String,
    document_url: String,
    notes: String,
    auto_generated: { type: Boolean, default: false },
    generated_run_id: String,
    reminder_count: { type: Number, default: 0 },
    last_reminder_at: String,
    next_reminder_at: String,
    dunning_stage: { type: String, default: "none" }, // none, reminder, past_due, suspension_warning, suspended
    dunning_notes: String,
    created_by: Number,
});
ConsentForm.schema.index({ hospital_id: 1, consent_number: 1 }, { unique: true, name: "consent_hospital_number_unique" });
ConsentForm.schema.index({ hospital_id: 1, patient_id: 1, created_at: -1 }, { name: "consent_patient_recent_lookup" });

const IncidentReport = makeModel("IncidentReport", "incident_reports", {
    hospital_id: { type: Number, default: 1, index: true },
    incident_number: { type: String, index: true },
    incident_type: { type: String, default: "clinical", index: true },
    severity: { type: String, default: "medium", index: true },
    status: { type: String, default: "open", index: true }, // open, investigating, corrective_action, closed
    incident_date: String,
    department: String,
    location: String,
    patient_id: String,
    patient_name: String,
    reported_by: String,
    description: String,
    immediate_action: String,
    root_cause: String,
    corrective_action: String,
    preventive_action: String,
    closed_at: Date,
    attachments: { type: [Object], default: [] },
    created_by: Number,
});
IncidentReport.schema.index({ hospital_id: 1, incident_number: 1 }, { unique: true, name: "incident_hospital_number_unique" });
IncidentReport.schema.index({ hospital_id: 1, status: 1, severity: 1 }, { name: "incident_status_severity_lookup" });

const SopDocument = makeModel("SopDocument", "sop_documents", {
    hospital_id: { type: Number, default: 1, index: true },
    sop_number: { type: String, index: true },
    title: { type: String, required: true, index: true },
    department: String,
    category: { type: String, default: "general", index: true },
    version: { type: String, default: "1.0" },
    status: { type: String, default: "draft", index: true }, // draft, under_review, approved, retired
    effective_date: String,
    review_date: String,
    owner_name: String,
    approved_by: String,
    approved_at: Date,
    document_text: String,
    file_url: String,
    training_required: { type: Boolean, default: false },
    created_by: Number,
});
SopDocument.schema.index({ hospital_id: 1, sop_number: 1 }, { unique: true, name: "sop_hospital_number_unique" });
SopDocument.schema.index({ hospital_id: 1, department: 1, status: 1 }, { name: "sop_department_status_lookup" });

const ComplianceChecklist = makeModel("ComplianceChecklist", "compliance_checklists", {
    hospital_id: { type: Number, default: 1, index: true },
    checklist_code: { type: String, index: true },
    standard: { type: String, default: "NABH", index: true },
    title: { type: String, required: true },
    department: String,
    category: String,
    status: { type: String, default: "pending", index: true }, // pending, compliant, partial, non_compliant, not_applicable
    priority: { type: String, default: "medium" },
    due_date: String,
    evidence_url: String,
    evidence_notes: String,
    owner_name: String,
    last_reviewed_at: Date,
    reviewed_by: String,
    corrective_action: String,
    created_by: Number,
});
ComplianceChecklist.schema.index({ hospital_id: 1, checklist_code: 1 }, { unique: true, name: "compliance_checklist_hospital_code_unique" });
ComplianceChecklist.schema.index({ hospital_id: 1, standard: 1, status: 1 }, { name: "compliance_standard_status_lookup" });

const BackupVerification = makeModel("BackupVerification", "backup_verifications", {
    hospital_id: { type: Number, default: 1, index: true },
    verification_number: { type: String, index: true },
    backup_type: { type: String, default: "database" },
    backup_date: String,
    restore_test_date: String,
    status: { type: String, default: "pending", index: true }, // pending, passed, failed, partial
    storage_location: String,
    verified_by: String,
    restore_duration_minutes: Number,
    records_checked: Number,
    issue_found: String,
    action_taken: String,
    next_test_due: String,
    notes: String,
    created_by: Number,
});
BackupVerification.schema.index({ hospital_id: 1, verification_number: 1 }, { unique: true, name: "backup_verification_hospital_number_unique" });
BackupVerification.schema.index({ hospital_id: 1, status: 1, backup_date: -1 }, { name: "backup_verification_status_lookup" });

const AuditLog = makeModel("AuditLog", "audit_logs", {
    hospital_id: { type: Number, default: 1, index: true },
    user_id: { type: Number, index: true },
    user_role: String,
    action: { type: String, index: true },
    module_name: { type: String, index: true },
    entity_type: String,
    entity_id: String,
    old_value: Object,
    new_value: Object,
    status: { type: String, default: "success", index: true },
    severity: { type: String, default: "info" },
    ip_address: String,
    user_agent: String,
    method: String,
    path: String,
    reason: String,
    changed_fields: { type: [String], default: [] },
    metadata: { type: Object, default: {} },
});
AuditLog.schema.index({ hospital_id: 1, created_at: -1 }, { name: "audit_hospital_recent_lookup" });
AuditLog.schema.index({ hospital_id: 1, module_name: 1, status: 1 }, { name: "audit_hospital_module_status_lookup" });
AuditLog.schema.index({ hospital_id: 1, entity_type: 1, entity_id: 1, created_at: -1 }, { name: "audit_entity_timeline_lookup" });
AuditLog.schema.index({ hospital_id: 1, severity: 1, created_at: -1 }, { name: "audit_severity_recent_lookup" });
const LoginHistory = makeModel("LoginHistory", "login_history", {
    hospital_id: { type: Number, default: 1, index: true },
    user_id: { type: Number, index: true },
    email: { type: String, index: true },
    role: String,
    status: { type: String, default: "success", index: true },
    reason: String,
    ip_address: String,
    user_agent: String,
    method: String,
    path: String,
    logged_at: { type: Date, default: Date.now, index: true },
});
LoginHistory.schema.index({ hospital_id: 1, logged_at: -1 }, { name: "login_history_hospital_recent_lookup" });
const SecuritySetting = makeModel("SecuritySetting", "security_settings", {
    hospital_id: { type: Number, default: 1, index: true },
    setting_key: { type: String, trim: true, index: true },
    setting_value: String,
    description: String,
    category: { type: String, default: "general" },
    updated_by: Number,
});
SecuritySetting.schema.index(
    { hospital_id: 1, setting_key: 1 },
    { unique: true, name: "security_setting_hospital_key_unique" },
);

const DynamicField = makeModel("DynamicField", "dynamic_fields", {
    hospital_id: { type: Number, default: 1, index: true },
    target_module: { type: String, trim: true, index: true }, // patients, doctors, appointments, billing, lab, radiology
    field_key: { type: String, trim: true, index: true },
    label: String,
    field_type: { type: String, default: "text" }, // text, number, date, select, textarea, checkbox
    placeholder: String,
    section: { type: String, default: "Additional Details" },
    help_text: String,
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    default_value: String,
    display_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
});
DynamicField.schema.index(
    { hospital_id: 1, target_module: 1, field_key: 1 },
    { unique: true, name: "dynamic_field_hospital_module_key_unique" },
);


const Template = makeModel("Template", "templates", {
    hospital_id: { type: Number, default: 1, index: true },
    template_type: { type: String, index: true },
    name: String,
    header_text: String,
    footer_text: String,
    body_template: String,
    paper_size: { type: String, default: "A4" },
    orientation: { type: String, default: "portrait" },
    logo_position: { type: String, default: "left" },
    show_hospital_logo: { type: Boolean, default: true },
    show_patient_details: { type: Boolean, default: true },
    show_doctor_signature: { type: Boolean, default: true },
    is_default: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
});
Template.schema.index({ hospital_id: 1, template_type: 1, name: 1 }, { unique: true, name: "template_hospital_type_name_unique" });



const SaaSInvoice = makeModel("SaaSInvoice", "saas_invoices", {
    hospital_id: { type: Number, required: true, index: true },
    hospital_name: String,
    plan: String,
    plan_name: String,
    invoice_number: { type: String, index: true },
    billing_cycle: { type: String, default: "monthly" },
    period_start: String,
    period_end: String,
    due_date: String,
    subtotal: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    paid_amount: { type: Number, default: 0 },
    balance_amount: { type: Number, default: 0 },
    status: { type: String, default: "pending", index: true }, // draft, pending, paid, partial, overdue, cancelled
    notes: String,
    auto_generated: { type: Boolean, default: false },
    generated_run_id: String,
    reminder_count: { type: Number, default: 0 },
    last_reminder_at: String,
    next_reminder_at: String,
    dunning_stage: { type: String, default: "none" }, // none, reminder, past_due, suspension_warning, suspended
    dunning_notes: String,
    created_by: Number,
});
SaaSInvoice.schema.index({ hospital_id: 1, invoice_number: 1 }, { unique: true, name: "saas_invoice_hospital_number_unique" });
SaaSInvoice.schema.index({ status: 1, due_date: 1 }, { name: "saas_invoice_status_due_lookup" });
SaaSInvoice.schema.index({ hospital_id: 1, period_start: 1, period_end: 1, status: 1 }, { name: "saas_invoice_period_guardrail" });
SaaSInvoice.schema.index({ next_reminder_at: 1, status: 1 }, { name: "saas_invoice_dunning_lookup" });

const SaaSPayment = makeModel("SaaSPayment", "saas_payments", {
    hospital_id: { type: Number, required: true, index: true },
    invoice_id: { type: Number, required: true, index: true },
    invoice_number: String,
    payment_number: { type: String, index: true },
    amount: { type: Number, default: 0 },
    payment_date: String,
    payment_mode: { type: String, default: "manual" },
    gateway: { type: String, default: "manual", index: true },
    transaction_id: String,
    gateway_fee: { type: Number, default: 0 },
    net_amount: { type: Number, default: 0 },
    settlement_status: { type: String, default: "unsettled", index: true }, // unsettled, settled, disputed
    settlement_reference: String,
    settled_at: String,
    received_by: Number,
    notes: String,
});
SaaSPayment.schema.index({ hospital_id: 1, invoice_id: 1, created_at: -1 }, { name: "saas_payment_invoice_lookup" });
SaaSPayment.schema.index({ gateway: 1, settlement_status: 1, payment_date: 1 }, { name: "saas_payment_settlement_lookup" });
SaaSPayment.schema.index({ hospital_id: 1, transaction_id: 1 }, { unique: true, name: "saas_payment_transaction_unique", partialFilterExpression: { transaction_id: { $type: "string", $ne: "" } } });



const SaaSSettlement = makeModel("SaaSSettlement", "saas_settlements", {
    settlement_number: { type: String, index: true },
    gateway: { type: String, default: "manual_gateway_ready", index: true },
    settlement_reference: { type: String, index: true },
    settlement_date: String,
    from_date: String,
    to_date: String,
    gross_amount: { type: Number, default: 0 },
    gateway_fee: { type: Number, default: 0 },
    net_amount: { type: Number, default: 0 },
    payment_count: { type: Number, default: 0 },
    status: { type: String, default: "settled", index: true }, // settled, partial, disputed
    notes: String,
    created_by: Number,
});
SaaSSettlement.schema.index({ gateway: 1, settlement_reference: 1 }, { unique: true, name: "saas_settlement_gateway_reference_unique", partialFilterExpression: { settlement_reference: { $type: "string" } } });
SaaSSettlement.schema.index({ settlement_date: 1, gateway: 1 }, { name: "saas_settlement_date_gateway_lookup" });

const SaaSPaymentIntent = makeModel("SaaSPaymentIntent", "saas_payment_intents", {
    hospital_id: { type: Number, required: true, index: true },
    invoice_id: { type: Number, required: true, index: true },
    invoice_number: String,
    gateway: { type: String, default: "manual" },
    payment_link_id: String,
    payment_link_url: String,
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, default: "created", index: true }, // created, pending, paid, expired, failed, cancelled
    expires_at: String,
    paid_at: String,
    transaction_id: String,
    customer_email: String,
    customer_phone: String,
    notes: String,
    created_by: Number,
});
SaaSPaymentIntent.schema.index({ hospital_id: 1, invoice_id: 1, status: 1 }, { name: "saas_payment_intent_invoice_lookup" });
SaaSPaymentIntent.schema.index({ payment_link_id: 1 }, { unique: true, name: "saas_payment_intent_link_unique", partialFilterExpression: { payment_link_id: { $type: "string" } } });



const CommunicationLog = makeModel("CommunicationLog", "communication_logs", {
    hospital_id: { type: Number, default: 1, index: true },
    channel: { type: String, default: "in_app", index: true }, // in_app, email, sms, whatsapp
    recipient_type: { type: String, default: "patient" },
    recipient_id: String,
    recipient_name: String,
    recipient_contact: String,
    contact_normalized: String,
    title: String,
    message: String,
    template_key: String,
    template_version: Number,
    module: { type: String, default: "system", index: true },
    entity_type: String,
    entity_id: String,
    status: { type: String, default: "queued", index: true }, // queued, sent, delivered, read, failed, skipped, cancelled
    provider: String,
    provider_message_id: String,
    provider_status: String,
    provider_payload: { type: Object, default: {} },
    error_message: String,
    scheduled_for: Date,
    retry_count: { type: Number, default: 0 },
    next_retry_at: Date,
    delivered_at: Date,
    read_at: Date,
    sent_at: Date,
    consent_checked: { type: Boolean, default: false },
    created_by: Number,
});
CommunicationLog.schema.index({ hospital_id: 1, created_at: -1 }, { name: "communication_hospital_recent_lookup" });
CommunicationLog.schema.index({ hospital_id: 1, channel: 1, status: 1 }, { name: "communication_channel_status_lookup" });
CommunicationLog.schema.index({ hospital_id: 1, scheduled_for: 1, status: 1 }, { name: "communication_schedule_status_lookup" });
CommunicationLog.schema.index({ hospital_id: 1, provider_message_id: 1 }, { name: "communication_provider_message_lookup", partialFilterExpression: { provider_message_id: { $type: "string" } } });

const CommunicationTemplate = makeModel("CommunicationTemplate", "communication_templates", {
    hospital_id: { type: Number, default: 1, index: true },
    template_key: { type: String, required: true, trim: true },
    name: String,
    channel: { type: String, default: "in_app", index: true },
    category: { type: String, default: "general", index: true },
    title_template: String,
    message_template: String,
    variables: { type: [String], default: [] },
    provider_template_id: String,
    language: { type: String, default: "en" },
    status: { type: String, default: "draft", index: true }, // draft, approved, disabled
    version: { type: Number, default: 1 },
    approval_notes: String,
    created_by: Number,
    updated_by: Number,
});
CommunicationTemplate.schema.index({ hospital_id: 1, template_key: 1, channel: 1 }, { unique: true, name: "communication_template_key_channel_unique", partialFilterExpression: { template_key: { $type: "string" } } });
CommunicationTemplate.schema.index({ hospital_id: 1, status: 1, channel: 1 }, { name: "communication_template_status_channel_lookup" });

const CommunicationRule = makeModel("CommunicationRule", "communication_rules", {
    hospital_id: { type: Number, default: 1, index: true },
    name: String,
    event_type: { type: String, required: true, index: true }, // appointment_reminder, report_ready, payment_due, follow_up
    channels: { type: [String], default: ["in_app"] },
    template_key: String,
    offset_minutes: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true, index: true },
    audience: { type: String, default: "patient" },
    module: { type: String, default: "system" },
    conditions: { type: Object, default: {} },
    created_by: Number,
    updated_by: Number,
});
CommunicationRule.schema.index({ hospital_id: 1, event_type: 1, is_active: 1 }, { name: "communication_rule_event_lookup" });

const ApiKey = makeModel("ApiKey", "api_keys", {
    hospital_id: { type: Number, default: 1, index: true },
    key_id: { type: String, index: true },
    name: String,
    key_hash: String,
    key_preview: String,
    scopes: { type: [String], default: [] },
    status: { type: String, default: "active", index: true },
    last_used_at: Date,
    expires_at: Date,
    created_by: Number,
});
ApiKey.schema.index({ hospital_id: 1, key_id: 1 }, { unique: true, name: "api_key_hospital_key_unique", partialFilterExpression: { key_id: { $type: "string" } } });

const IntegrationLog = makeModel("IntegrationLog", "integration_logs", {
    hospital_id: { type: Number, default: 1, index: true },
    direction: { type: String, default: "inbound", index: true },
    system: { type: String, default: "fhir", index: true },
    resource_type: String,
    resource_id: String,
    method: String,
    endpoint: String,
    status: { type: String, default: "success", index: true },
    status_code: Number,
    api_key_id: String,
    request_payload: Object,
    response_payload: Object,
    error_message: String,
    ip_address: String,
});
IntegrationLog.schema.index({ hospital_id: 1, created_at: -1 }, { name: "integration_recent_lookup" });

const WebhookSubscription = makeModel("WebhookSubscription", "webhook_subscriptions", {
    hospital_id: { type: Number, default: 1, index: true },
    name: String,
    target_url: String,
    events: { type: [String], default: [] },
    secret: String,
    status: { type: String, default: "active", index: true },
    last_triggered_at: Date,
    failure_count: { type: Number, default: 0 },
    created_by: Number,
});

const WebhookEvent = makeModel("WebhookEvent", "webhook_events", {
    hospital_id: { type: Number, default: 1, index: true },
    event_type: { type: String, index: true },
    resource_type: String,
    resource_id: String,
    payload: Object,
    delivery_status: { type: String, default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    last_error: String,
});


const EnterpriseFeatureRecord = makeModel("EnterpriseFeatureRecord", "enterprise_feature_records", {
    hospital_id: { type: Number, default: 1, index: true },
    feature_key: { type: String, required: true, index: true },
    record_type: { type: String, default: "item", index: true },
    title: String,
    status: { type: String, default: "active", index: true },
    priority: { type: String, default: "normal", index: true },
    owner: String,
    external_id: String,
    endpoint: String,
    payload: { type: Object, default: {} },
    metadata: { type: Object, default: {} },
    notes: String,
    created_by: Number,
    updated_by: Number,
});
EnterpriseFeatureRecord.schema.index({ hospital_id: 1, feature_key: 1, record_type: 1, created_at: -1 }, { name: "enterprise_feature_record_lookup" });



const SaaSPaymentWebhook = makeModel("SaaSPaymentWebhook", "saas_payment_webhooks", {
    hospital_id: { type: Number, default: 1, index: true },
    invoice_id: Number,
    invoice_number: String,
    gateway: { type: String, default: "manual_gateway_ready", index: true },
    event_id: { type: String, required: true, index: true },
    event_type: String,
    payment_link_id: String,
    transaction_id: String,
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, default: "received", index: true }, // received, verified, processed, duplicate, ignored, failed
    signature_verified: { type: Boolean, default: false },
    received_at: { type: Date, default: Date.now },
    processed_at: Date,
    idempotency_key: { type: String, required: true, index: true },
    payload: { type: Object, default: {} },
    error: String,
});
SaaSPaymentWebhook.schema.index({ gateway: 1, event_id: 1 }, { unique: true, name: "saas_webhook_gateway_event_unique" });
SaaSPaymentWebhook.schema.index({ idempotency_key: 1 }, { unique: true, name: "saas_webhook_idempotency_unique" });
SaaSPaymentWebhook.schema.index({ invoice_id: 1, status: 1, received_at: -1 }, { name: "saas_webhook_invoice_lookup" });

const SaaSPlan = makeModel("SaaSPlan", "saas_plans", {
    plan_id: { type: String, unique: true, index: true },
    name: { type: String, required: true },
    description: String,
    monthly_price_inr: { type: Number, default: 0 },
    billing_cycles: { type: [String], default: ["monthly", "yearly"] },
    trial_days: { type: Number, default: 14 },
    support_level: { type: String, default: "standard" },
    limits: { type: Object, default: {} },
    modules: { type: [String], default: [] },
    features: { type: Object, default: {} },
    is_active: { type: Boolean, default: true },
});
SaaSPlan.schema.index({ is_active: 1, monthly_price_inr: 1 }, { name: "saas_plan_active_price_lookup" });


const DemoRequest = makeModel("DemoRequest", "demo_requests", {
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: String,
    organization: { type: String, required: true, index: true },
    organization_type: { type: String, default: "hospital", index: true },
    city: String,
    staff_size: String,
    interest: { type: [String], default: [] },
    preferred_demo_date: String,
    follow_up_at: Date,
    assigned_to: String,
    message: String,
    source: { type: String, default: "website" },
    status: { type: String, default: "new", index: true },
    notes: String,
});
DemoRequest.schema.index({ status: 1, created_at: -1 }, { name: "demo_request_status_recent_lookup" });

const SalesActivity = makeModel("SalesActivity", "sales_activities", {
    demo_request_id: { type: Number, index: true },
    activity_type: { type: String, default: "note", index: true },
    subject: String,
    notes: String,
    outcome: String,
    next_follow_up_at: Date,
    created_by: Number,
});
SalesActivity.schema.index({ demo_request_id: 1, created_at: -1 }, { name: "sales_activity_demo_recent_lookup" });



const LegalPolicy = makeModel("LegalPolicy", "legal_policies", {
    policy_key: { type: String, required: true, index: true },
    title: { type: String, required: true },
    version: { type: String, default: "1.0" },
    category: { type: String, default: "legal", index: true },
    content: { type: String, default: "" },
    effective_date: Date,
    owner: String,
    review_cycle_days: { type: Number, default: 180 },
    next_review_date: Date,
    status: { type: String, default: "draft", index: true },
    approved_by: Number,
    approved_at: Date,
});
LegalPolicy.schema.index({ policy_key: 1, version: 1 }, { unique: true, name: "legal_policy_key_version_unique" });

const DataRequest = makeModel("DataRequest", "data_requests", {
    hospital_id: { type: Number, default: 1, index: true },
    requester_name: { type: String, required: true },
    requester_email: { type: String, required: true, index: true },
    requester_phone: String,
    request_type: { type: String, default: "access", index: true },
    patient_id: Number,
    user_id: Number,
    description: String,
    due_date: Date,
    status: { type: String, default: "open", index: true },
    assigned_to: Number,
    resolution_notes: String,
    resolved_at: Date,
});
DataRequest.schema.index({ hospital_id: 1, status: 1, due_date: 1 }, { name: "data_request_hospital_status_due" });

const SecurityIncident = makeModel("SecurityIncident", "security_incidents", {
    hospital_id: { type: Number, default: 1, index: true },
    title: { type: String, required: true },
    severity: { type: String, default: "medium", index: true },
    category: { type: String, default: "security", index: true },
    detected_at: { type: Date, default: Date.now },
    reported_by: Number,
    affected_systems: { type: [String], default: [] },
    patient_data_involved: { type: Boolean, default: false },
    description: String,
    containment_actions: String,
    root_cause: String,
    corrective_actions: String,
    status: { type: String, default: "open", index: true },
    closed_at: Date,
});
SecurityIncident.schema.index({ hospital_id: 1, severity: 1, status: 1 }, { name: "security_incident_hospital_severity_status" });

const PolicyAcknowledgement = makeModel("PolicyAcknowledgement", "policy_acknowledgements", {
    hospital_id: { type: Number, default: 1, index: true },
    policy_id: { type: Number, required: true, index: true },
    user_id: { type: Number, required: true, index: true },
    acknowledged_at: { type: Date, default: Date.now },
    ip_address: String,
    user_agent: String,
});
PolicyAcknowledgement.schema.index({ policy_id: 1, user_id: 1 }, { unique: true, name: "policy_ack_policy_user_unique" });


const PilotDeployment = makeModel("PilotDeployment", "pilot_deployments", {
    hospital_id: { type: Number, index: true },
    hospital_name: { type: String, required: true },
    contact_name: String,
    contact_email: String,
    contact_phone: String,
    deployment_stage: { type: String, default: "planning", index: true },
    go_live_target_date: Date,
    pilot_start_date: Date,
    pilot_end_date: Date,
    assigned_owner: String,
    scope_modules: { type: [String], default: [] },
    success_criteria: { type: [String], default: [] },
    risks: { type: [Object], default: [] },
    training_sessions: { type: [Object], default: [] },
    migration_items: { type: [Object], default: [] },
    checklist: { type: [Object], default: [] },
    feedback: { type: [Object], default: [] },
    notes: String,
});
PilotDeployment.schema.index({ deployment_stage: 1, go_live_target_date: 1 }, { name: "pilot_stage_go_live_lookup" });

const PilotTask = makeModel("PilotTask", "pilot_tasks", {
    pilot_id: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    category: { type: String, default: "general", index: true },
    status: { type: String, default: "open", index: true },
    priority: { type: String, default: "medium" },
    owner: String,
    due_date: Date,
    completed_at: Date,
    notes: String,
});
PilotTask.schema.index({ pilot_id: 1, status: 1 }, { name: "pilot_task_status_lookup" });


const TenantBackup = makeModel("TenantBackup", "tenant_backups", {
    hospital_id: { type: Number, required: true, index: true },
    hospital_code: String,
    hospital_name: String,
    tenant_db_name: { type: String, required: true, index: true },
    backup_type: { type: String, default: "manual" },
    status: { type: String, default: "queued", index: true },
    storage_provider: { type: String, default: "local" },
    backup_path: String,
    file_name: String,
    size_bytes: Number,
    started_at: Date,
    completed_at: Date,
    verified_at: Date,
    restore_tested_at: Date,
    restore_test_status: { type: String, default: "not_tested" },
    retention_until: Date,
    checksum_sha256: String,
    manifest: { type: Object, default: {} },
    verification_status: { type: String, default: "pending" },
    verified_by: Number,
    disaster_recovery_log_id: Number,
    error_message: String,
    requested_by: Number,
    notes: String,
});
TenantBackup.schema.index({ hospital_id: 1, created_at: -1 }, { name: "tenant_backup_hospital_recent_lookup" });

const Notification = makeModel("Notification", "notifications", {
    hospital_id: { type: Number, default: 1, index: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    type: { type: String, default: "system", index: true },
    severity: { type: String, default: "info" },
    module: { type: String, default: "system", index: true },
    entity_type: String,
    entity_id: String,
    target_path: String,
    user_id: Number,
    role: String,
    read_by: { type: [Number], default: [] },
    is_active: { type: Boolean, default: true },
});
Notification.schema.index({ hospital_id: 1, created_at: -1 }, { name: "notification_hospital_recent_lookup" });

const CustomerSuccessNote = makeModel("CustomerSuccessNote", "customer_success_notes", {
    hospital_id: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    note: { type: String, default: "" },
    category: { type: String, default: "general", index: true },
    priority: { type: String, default: "medium", index: true },
    status: { type: String, default: "open", index: true },
    next_follow_up_at: Date,
    created_by: Number,
    closed_at: Date,
});
CustomerSuccessNote.schema.index({ hospital_id: 1, status: 1, next_follow_up_at: 1 }, { name: "cs_note_followup_lookup" });

const RenewalWorkflow = makeModel("RenewalWorkflow", "renewal_workflows", {
    hospital_id: { type: Number, required: true, index: true },
    renewal_date: { type: Date, required: true, index: true },
    stage: { type: String, default: "upcoming", index: true },
    owner_id: Number,
    health_score: { type: Number, default: 75 },
    risk_level: { type: String, default: "medium", index: true },
    action_items: { type: [String], default: [] },
    last_touch_at: Date,
    notes: String,
});
RenewalWorkflow.schema.index({ hospital_id: 1, renewal_date: 1 }, { name: "renewal_hospital_date_lookup" });

const SupportTicket = makeModel("SupportTicket", "support_tickets", {
    hospital_id: { type: Number, required: true, index: true },
    ticket_no: { type: String, trim: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "general", index: true },
    priority: { type: String, default: "medium", index: true },
    status: { type: String, default: "open", index: true },
    sla_hours: { type: Number, default: 24 },
    sla_due_at: { type: Date, index: true },
    escalated: { type: Boolean, default: false, index: true },
    escalated_at: Date,
    assigned_to: Number,
    created_by: Number,
    last_response_at: Date,
    closed_at: Date,
    resolution_notes: String,
    comments: { type: [Object], default: [] },
});
SupportTicket.schema.index({ hospital_id: 1, status: 1, sla_due_at: 1 }, { name: "support_ticket_sla_lookup" });
SupportTicket.schema.index({ ticket_no: 1 }, { name: "support_ticket_no_lookup", sparse: true });

const TenantRestoreRequest = makeModel("TenantRestoreRequest", "tenant_restore_requests", {
    hospital_id: { type: Number, required: true, index: true },
    hospital_code: String,
    hospital_name: String,
    tenant_db_name: String,
    backup_id: { type: Number, index: true },
    restore_scope: { type: String, default: "full_tenant" },
    status: { type: String, default: "requested", index: true },
    priority: { type: String, default: "normal" },
    requested_by: Number,
    approved_by: Number,
    approved_at: Date,
    scheduled_at: Date,
    started_at: Date,
    completed_at: Date,
    target_environment: { type: String, default: "staging" },
    dry_run_required: { type: Boolean, default: true },
    approval_checklist: { type: Object, default: {} },
    rollback_plan: String,
    reason: String,
    notes: String,
    error_message: String,
});
TenantRestoreRequest.schema.index({ hospital_id: 1, status: 1, created_at: -1 }, { name: "tenant_restore_status_lookup" });

const TenantDataExport = makeModel("TenantDataExport", "tenant_data_exports", {
    hospital_id: { type: Number, required: true, index: true },
    hospital_code: String,
    hospital_name: String,
    export_type: { type: String, default: "tenant_data" },
    export_format: { type: String, default: "json" },
    status: { type: String, default: "queued", index: true },
    requested_by: Number,
    requested_by_role: String,
    file_name: String,
    export_path: String,
    size_bytes: Number,
    record_counts: { type: Object, default: {} },
    checksum_sha256: String,
    manifest: { type: Object, default: {} },
    filters: { type: Object, default: {} },
    expires_at: Date,
    completed_at: Date,
    downloaded_at: Date,
    error_message: String,
    notes: String,
});
TenantDataExport.schema.index({ hospital_id: 1, created_at: -1 }, { name: "tenant_export_recent_lookup" });

const TenantDisasterRecoveryLog = makeModel("TenantDisasterRecoveryLog", "tenant_disaster_recovery_logs", {
    hospital_id: { type: Number, required: true, index: true },
    hospital_code: String,
    hospital_name: String,
    event_type: { type: String, default: "backup" },
    status: { type: String, default: "open", index: true },
    severity: { type: String, default: "info" },
    related_backup_id: Number,
    related_restore_request_id: Number,
    related_export_id: Number,
    summary: String,
    details: { type: Object, default: {} },
    created_by: Number,
    resolved_by: Number,
    resolved_at: Date,
});
TenantDisasterRecoveryLog.schema.index({ hospital_id: 1, event_type: 1, created_at: -1 }, { name: "tenant_dr_event_lookup" });

const KnowledgeBaseArticle = makeModel("KnowledgeBaseArticle", "knowledge_base_articles", {
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true, sparse: true, index: true },
    summary: { type: String, default: "" },
    body: { type: String, required: true },
    category: { type: String, default: "general", index: true },
    audience: { type: String, default: "tenant_admin", index: true },
    visibility: { type: String, default: "tenant_admin", index: true },
    status: { type: String, default: "draft", index: true },
    tags: { type: [String], default: [] },
    related_ticket_category: String,
    display_order: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 },
    last_viewed_at: Date,
    created_by: Number,
    updated_by: Number,
    published_at: Date,
});
KnowledgeBaseArticle.schema.index({ status: 1, visibility: 1, category: 1, display_order: 1 }, { name: "kb_public_lookup" });
KnowledgeBaseArticle.schema.index({ title: "text", summary: "text", body: "text", tags: "text" }, { name: "kb_text_search" });

const OTBooking = makeModel("OTBooking", "ot_bookings", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: { type: String, index: true },
    doctor_id: { type: String, index: true },
    surgeon_team: { type: [Object], default: [] },
    ot_room: String,
    surgery_type: String,
    procedure_name: String,
    scheduled_date: { type: String, index: true },
    start_time: String,
    end_time: String,
    priority: { type: String, default: "routine" },
    status: { type: String, default: "scheduled", index: true },
    diagnosis: String,
    notes: String,
    billing_id: Number,
    created_by: Number,
    updated_by: Number,
});

const SurgeryNote = makeModel("SurgeryNote", "surgery_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    ot_booking_id: { type: Number, index: true },
    patient_id: String,
    doctor_id: String,
    pre_op_diagnosis: String,
    post_op_diagnosis: String,
    procedure_performed: String,
    findings: String,
    complications: String,
    specimens: String,
    implants: String,
    estimated_blood_loss: String,
    surgery_start_at: Date,
    surgery_end_at: Date,
    status: { type: String, default: "draft" },
    created_by: Number,
    updated_by: Number,
});

const AnaesthesiaNote = makeModel("AnaesthesiaNote", "anaesthesia_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    ot_booking_id: { type: Number, index: true },
    patient_id: String,
    anaesthetist_id: String,
    anaesthesia_type: String,
    asa_grade: String,
    airway_notes: String,
    medications: { type: [Object], default: [] },
    monitoring_notes: String,
    complications: String,
    status: { type: String, default: "draft" },
    created_by: Number,
    updated_by: Number,
});

const PostOpNote = makeModel("PostOpNote", "post_op_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    ot_booking_id: { type: Number, index: true },
    patient_id: String,
    recovery_status: String,
    vitals: { type: Object, default: {} },
    pain_score: Number,
    post_op_orders: String,
    follow_up_plan: String,
    complications: String,
    created_by: Number,
    updated_by: Number,
});

const OTInventoryUsage = makeModel("OTInventoryUsage", "ot_inventory_usages", {
    hospital_id: { type: Number, default: 1, index: true },
    ot_booking_id: { type: Number, index: true },
    item_id: Number,
    item_name: String,
    quantity: { type: Number, default: 0 },
    unit: String,
    notes: String,
    created_by: Number,
});


const NursingVital = makeModel("NursingVital", "nursing_vitals", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: String,
    ipd_admission_id: { type: Number, index: true },
    recorded_at: { type: Date, default: Date.now, index: true },
    temperature: Number,
    pulse: Number,
    respiratory_rate: Number,
    blood_pressure_systolic: Number,
    blood_pressure_diastolic: Number,
    spo2: Number,
    pain_score: Number,
    gcs_score: Number,
    notes: String,
    recorded_by: Number,
    updated_by: Number,
});

const MedicationAdministration = makeModel("MedicationAdministration", "medication_administrations", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: String,
    ipd_admission_id: { type: Number, index: true },
    medication_name: String,
    dose: String,
    route: String,
    frequency: String,
    scheduled_at: Date,
    administered_at: Date,
    status: { type: String, default: "scheduled", index: true },
    withheld_reason: String,
    notes: String,
    administered_by: Number,
    created_by: Number,
    updated_by: Number,
});

const NursingHandoverNote = makeModel("NursingHandoverNote", "nursing_handover_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: String,
    ipd_admission_id: { type: Number, index: true },
    shift: String,
    handover_from: Number,
    handover_to: Number,
    situation: String,
    background: String,
    assessment: String,
    recommendation: String,
    pending_tasks: { type: [Object], default: [] },
    created_by: Number,
});

const NursingCarePlan = makeModel("NursingCarePlan", "nursing_care_plans", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: String,
    ipd_admission_id: { type: Number, index: true },
    diagnosis: String,
    goals: { type: [String], default: [] },
    interventions: { type: [Object], default: [] },
    evaluation_notes: String,
    status: { type: String, default: "active", index: true },
    started_at: Date,
    reviewed_at: Date,
    created_by: Number,
    updated_by: Number,
});

const NursingShiftTask = makeModel("NursingShiftTask", "nursing_shift_tasks", {
    hospital_id: { type: Number, default: 1, index: true },
    patient_id: String,
    ipd_admission_id: { type: Number, index: true },
    title: String,
    task_type: String,
    priority: { type: String, default: "normal", index: true },
    due_at: Date,
    status: { type: String, default: "open", index: true },
    assigned_to: Number,
    completed_at: Date,
    completed_by: Number,
    notes: String,
    created_by: Number,
    updated_by: Number,
});


const EmergencyCase = makeModel("EmergencyCase", "emergency_cases", {
    hospital_id: { type: Number, default: 1, index: true },
    emergency_uid: { type: String, trim: true, index: true },
    patient_id: { type: String, index: true },
    patient_name: String,
    age: Number,
    gender: String,
    phone: String,
    arrival_mode: String,
    arrival_at: { type: Date, default: Date.now, index: true },
    chief_complaint: String,
    triage_category: { type: String, default: "green", index: true },
    triage_score: Number,
    vitals: { type: Object, default: {} },
    mlc_required: { type: Boolean, default: false, index: true },
    mlc_number: String,
    police_informed: { type: Boolean, default: false },
    assigned_doctor_id: String,
    bed_id: Number,
    status: { type: String, default: "registered", index: true },
    disposition: String,
    billing_id: Number,
    notes: String,
    created_by: Number,
    updated_by: Number,
    closed_at: Date,
    closed_by: Number,
});
EmergencyCase.schema.index({ hospital_id: 1, emergency_uid: 1 }, { unique: true, sparse: true, name: "emergency_hospital_uid_unique" });
EmergencyCase.schema.index({ hospital_id: 1, status: 1, arrival_at: -1 }, { name: "emergency_status_arrival_lookup" });

const EmergencyTriageNote = makeModel("EmergencyTriageNote", "emergency_triage_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    emergency_case_id: { type: Number, index: true },
    patient_id: String,
    triage_category: { type: String, default: "green", index: true },
    triage_score: Number,
    vitals: { type: Object, default: {} },
    red_flags: { type: [String], default: [] },
    notes: String,
    recorded_by: Number,
    recorded_at: { type: Date, default: Date.now, index: true },
});

const EmergencyClinicalNote = makeModel("EmergencyClinicalNote", "emergency_clinical_notes", {
    hospital_id: { type: Number, default: 1, index: true },
    emergency_case_id: { type: Number, index: true },
    patient_id: String,
    assessment: String,
    diagnosis: String,
    treatment_given: String,
    orders: { type: [Object], default: [] },
    follow_up_plan: String,
    created_by: Number,
    updated_by: Number,
});

const EmergencyTransfer = makeModel("EmergencyTransfer", "emergency_transfers", {
    hospital_id: { type: Number, default: 1, index: true },
    emergency_case_id: { type: Number, index: true },
    patient_id: String,
    transfer_type: { type: String, default: "ipd" },
    target_department: String,
    target_bed_id: Number,
    reason: String,
    handover_notes: String,
    status: { type: String, default: "requested", index: true },
    requested_by: Number,
    completed_by: Number,
    completed_at: Date,
});


const BloodDonor = makeModel("BloodDonor", "blood_donors", {
    hospital_id: { type: Number, default: 1, index: true },
    donor_uid: { type: String, trim: true, index: true },
    full_name: { type: String, required: true, index: true },
    age: Number,
    gender: String,
    phone: String,
    email: String,
    address: String,
    blood_group: { type: String, index: true },
    last_donation_date: Date,
    next_eligible_date: Date,
    eligibility_status: { type: String, default: "pending", index: true },
    screening_status: { type: String, default: "pending", index: true },
    screening_notes: String,
    medical_history: String,
    donor_frequency_count: { type: Number, default: 0 },
    consent_recorded: { type: Boolean, default: false },
    status: { type: String, default: "active", index: true },
    created_by: Number,
    updated_by: Number,
});
BloodDonor.schema.index({ hospital_id: 1, donor_uid: 1 }, { unique: true, sparse: true, name: "blood_donor_hospital_uid_unique" });
BloodDonor.schema.index({ hospital_id: 1, blood_group: 1, eligibility_status: 1 }, { name: "blood_donor_group_eligibility_lookup" });

const BloodUnit = makeModel("BloodUnit", "blood_units", {
    hospital_id: { type: Number, default: 1, index: true },
    unit_uid: { type: String, trim: true, index: true },
    bag_number: { type: String, trim: true, index: true },
    donor_id: Number,
    donor_uid: String,
    blood_group: { type: String, index: true },
    component_type: { type: String, default: "whole_blood", index: true },
    volume_ml: Number,
    collection_date: Date,
    expiry_date: { type: Date, index: true },
    storage_location: String,
    storage_temperature_c: Number,
    screening_status: { type: String, default: "pending", index: true },
    status: { type: String, default: "available", index: true },
    quarantine_reason: String,
    reserved_for_patient_id: String,
    reserved_until: Date,
    partial_consumed_ml: { type: Number, default: 0 },
    disposed_at: Date,
    disposal_reason: String,
    notes: String,
    created_by: Number,
    updated_by: Number,
});
BloodUnit.schema.index({ hospital_id: 1, unit_uid: 1 }, { unique: true, sparse: true, name: "blood_unit_hospital_uid_unique" });
BloodUnit.schema.index({ hospital_id: 1, bag_number: 1 }, { unique: true, sparse: true, name: "blood_unit_hospital_bag_unique" });
BloodUnit.schema.index({ hospital_id: 1, blood_group: 1, component_type: 1, status: 1 }, { name: "blood_inventory_lookup" });
BloodUnit.schema.index({ hospital_id: 1, expiry_date: 1, status: 1 }, { name: "blood_expiry_lookup" });

const BloodRequisition = makeModel("BloodRequisition", "blood_requisitions", {
    hospital_id: { type: Number, default: 1, index: true },
    requisition_uid: { type: String, trim: true, index: true },
    patient_id: { type: String, index: true },
    patient_name: String,
    patient_blood_group: { type: String, index: true },
    component_type: { type: String, default: "packed_rbc", index: true },
    units_requested: { type: Number, default: 1 },
    priority: { type: String, default: "routine", index: true },
    indication: String,
    requested_by_doctor_id: String,
    request_source: String,
    status: { type: String, default: "requested", index: true },
    approved_by: Number,
    approved_at: Date,
    rejected_by: Number,
    rejected_at: Date,
    rejection_reason: String,
    notes: String,
    created_by: Number,
    updated_by: Number,
});
BloodRequisition.schema.index({ hospital_id: 1, requisition_uid: 1 }, { unique: true, sparse: true, name: "blood_requisition_hospital_uid_unique" });

const BloodCrossMatch = makeModel("BloodCrossMatch", "blood_cross_matches", {
    hospital_id: { type: Number, default: 1, index: true },
    requisition_id: Number,
    patient_id: String,
    patient_name: String,
    patient_blood_group: { type: String, index: true },
    unit_id: Number,
    unit_blood_group: String,
    component_type: String,
    request_source: String,
    requested_by_doctor_id: String,
    compatibility_result: { type: String, default: "pending", index: true },
    compatibility_warning: String,
    test_notes: String,
    requested_by: Number,
    tested_by: Number,
    tested_at: Date,
    status: { type: String, default: "open", index: true },
});
BloodCrossMatch.schema.index({ hospital_id: 1, patient_id: 1, compatibility_result: 1 }, { name: "blood_crossmatch_patient_lookup" });

const BloodIssueRecord = makeModel("BloodIssueRecord", "blood_issue_records", {
    hospital_id: { type: Number, default: 1, index: true },
    unit_id: Number,
    requisition_id: Number,
    cross_match_id: Number,
    patient_id: String,
    patient_name: String,
    issue_type: { type: String, default: "issue", index: true },
    emergency_issue: { type: Boolean, default: false, index: true },
    emergency_reason: String,
    volume_issued_ml: Number,
    issued_at: Date,
    returned_at: Date,
    discarded_at: Date,
    status: { type: String, default: "issued", index: true },
    issued_by: Number,
    returned_by: Number,
    discarded_by: Number,
    notes: String,
});
BloodIssueRecord.schema.index({ hospital_id: 1, unit_id: 1, created_at: -1 }, { name: "blood_issue_unit_traceability" });

const BloodReservation = makeModel("BloodReservation", "blood_reservations", {
    hospital_id: { type: Number, default: 1, index: true },
    unit_id: { type: Number, index: true },
    requisition_id: Number,
    patient_id: { type: String, index: true },
    patient_name: String,
    reserved_until: Date,
    status: { type: String, default: "active", index: true },
    reserved_by: Number,
    released_by: Number,
    released_at: Date,
    notes: String,
});
BloodReservation.schema.index({ hospital_id: 1, unit_id: 1, status: 1 }, { name: "blood_reservation_active_lookup" });


const StaffProfile = makeModel("StaffProfile", "staff_profiles", {
    hospital_id: { type: Number, default: 1, index: true },
    staff_uid: { type: String, trim: true, index: true },
    full_name: { type: String, trim: true },
    email: { type: String, trim: true, index: true },
    phone: String,
    role: { type: String, default: "staff", index: true },
    department_id: { type: Number, index: true },
    department_name: String,
    designation: String,
    employment_type: { type: String, default: "full_time", index: true },
    joining_date: Date,
    salary_basic: Number,
    payroll_code: String,
    emergency_contact_name: String,
    emergency_contact_phone: String,
    address: String,
    status: { type: String, default: "active", index: true },
    created_by: Number,
    updated_by: Number,
});
StaffProfile.schema.index({ hospital_id: 1, staff_uid: 1 }, { unique: true, name: "staff_hospital_uid_unique", partialFilterExpression: { staff_uid: { $type: "string" } } });

const StaffAttendance = makeModel("StaffAttendance", "staff_attendance", {
    hospital_id: { type: Number, default: 1, index: true },
    staff_id: { type: Number, index: true },
    staff_name: String,
    attendance_date: { type: Date, index: true },
    shift: String,
    check_in_at: Date,
    check_out_at: Date,
    status: { type: String, default: "present", index: true },
    late_minutes: Number,
    overtime_minutes: Number,
    notes: String,
    marked_by: Number,
    updated_by: Number,
});
StaffAttendance.schema.index({ hospital_id: 1, staff_id: 1, attendance_date: 1 }, { name: "staff_attendance_lookup" });

const StaffShiftRoster = makeModel("StaffShiftRoster", "staff_shift_rosters", {
    hospital_id: { type: Number, default: 1, index: true },
    staff_id: { type: Number, index: true },
    staff_name: String,
    department_id: { type: Number, index: true },
    roster_date: { type: Date, index: true },
    shift_name: String,
    start_time: String,
    end_time: String,
    ward_or_location: String,
    status: { type: String, default: "scheduled", index: true },
    assigned_by: Number,
    updated_by: Number,
    notes: String,
});
StaffShiftRoster.schema.index({ hospital_id: 1, staff_id: 1, roster_date: 1 }, { name: "staff_roster_lookup" });

const StaffLeaveRequest = makeModel("StaffLeaveRequest", "staff_leave_requests", {
    hospital_id: { type: Number, default: 1, index: true },
    staff_id: { type: Number, index: true },
    staff_name: String,
    leave_type: { type: String, default: "casual", index: true },
    start_date: Date,
    end_date: Date,
    total_days: Number,
    reason: String,
    status: { type: String, default: "requested", index: true },
    requested_by: Number,
    reviewed_by: Number,
    reviewed_at: Date,
    review_notes: String,
});
StaffLeaveRequest.schema.index({ hospital_id: 1, staff_id: 1, status: 1 }, { name: "staff_leave_status_lookup" });

const StaffPayrollExport = makeModel("StaffPayrollExport", "staff_payroll_exports", {
    hospital_id: { type: Number, default: 1, index: true },
    period_start: Date,
    period_end: Date,
    export_uid: { type: String, index: true },
    status: { type: String, default: "generated", index: true },
    generated_by: Number,
    generated_at: Date,
    staff_count: Number,
    gross_basic_total: Number,
    attendance_days_total: Number,
    leave_days_total: Number,
    rows: { type: [Object], default: [] },
    notes: String,
});


const HL7Message = makeModel("HL7Message", "hl7_messages", {
    hospital_id: { type: Number, default: 1, index: true },
    message_uid: { type: String, index: true },
    message_type: { type: String, index: true },
    trigger_event: String,
    control_id: { type: String, index: true },
    direction: { type: String, default: "outbound", index: true },
    status: { type: String, default: "queued", index: true },
    patient_id: Number,
    appointment_id: Number,
    lab_test_id: Number,
    source_module: String,
    endpoint: String,
    raw_message: String,
    parsed_payload: { type: Object, default: {} },
    ack_code: String,
    ack_message: String,
    retry_count: { type: Number, default: 0 },
    max_retries: { type: Number, default: 3 },
    next_retry_at: Date,
    last_error: String,
    queued_at: Date,
    sent_at: Date,
    failed_at: Date,
    processed_at: Date,
    created_by: Number,
});
HL7Message.schema.index({ hospital_id: 1, control_id: 1 }, { name: "hl7_control_lookup" });
HL7Message.schema.index({ hospital_id: 1, message_type: 1, status: 1 }, { name: "hl7_type_status_lookup" });

const ABDMConsent = makeModel("ABDMConsent", "abdm_consents", {
    hospital_id: { type: Number, default: 1, index: true },
    consent_uid: { type: String, index: true },
    patient_id: { type: String, index: true },
    patient_ref_id: Number,
    patient_name: String,
    abha_masked: String,
    abha_hash: { type: String, index: true },
    purpose: String,
    status: { type: String, default: "requested", index: true },
    hiu_reference: String,
    hip_reference: String,
    consent_artefact_id: { type: String, index: true },
    care_contexts: { type: [Object], default: [] },
    requested_at: Date,
    granted_at: Date,
    revoked_at: Date,
    expired_at: Date,
    expires_at: Date,
    notes: String,
    created_by: Number,
    updated_by: Number,
});
ABDMConsent.schema.index({ hospital_id: 1, patient_id: 1, status: 1 }, { name: "abdm_consent_patient_status_lookup" });
ABDMConsent.schema.index({ hospital_id: 1, consent_uid: 1 }, { name: "abdm_consent_uid_lookup" });

const ABHACareContext = makeModel("ABHACareContext", "abha_care_contexts", {
    hospital_id: { type: Number, default: 1, index: true },
    context_uid: { type: String, index: true },
    patient_id: { type: String, index: true },
    patient_ref_id: Number,
    patient_name: String,
    context_type: { type: String, index: true },
    reference_id: String,
    display: String,
    status: { type: String, default: "linked", index: true },
    consent_uid: String,
    linked_at: Date,
    linked_by: Number,
    metadata: { type: Object, default: {} },
});
ABHACareContext.schema.index({ hospital_id: 1, patient_id: 1, context_type: 1 }, { name: "abha_context_patient_type_lookup" });
ABHACareContext.schema.index({ hospital_id: 1, context_uid: 1 }, { name: "abha_context_uid_lookup" });

module.exports = {
    Counter,
    User,
    AuthSession,
    Hospital,
    Department,
    Patient,
    Doctor,
    DoctorSchedule,
    Appointment,
    AppointmentTokenCounter,
    Bed,
    OpdRecord,
    IpdAdmission,
    NursingNote,
    LabTestTemplate,
    LabTest,
    RadiologyTest,
    Medicine,
    PharmacySale,
    Billing,
    InsuranceClaim,
    Prescription,
    ClinicalRecord,
    AuditLog,
    LoginHistory,
    SecuritySetting,
    DynamicField,
    Template,
    Notification,
    CommunicationTemplate,
    CommunicationRule,
    SaaSPlan,
    SaaSInvoice,
    SaaSPayment,
    SaaSSettlement,
    SaaSPaymentIntent,
    SaaSPaymentWebhook,
    CommunicationLog,
    Supplier,
    InventoryItem,
    InventoryBatch,
    PurchaseOrder,
    SupplierBill,
    StockReceiving,
    StockReturn,
    InventoryTransaction,
    ConsentForm,
    IncidentReport,
    SopDocument,
    ComplianceChecklist,
    BackupVerification,
    ApiKey,
    IntegrationLog,
    WebhookSubscription,
    WebhookEvent,
    EnterpriseFeatureRecord,
    DemoRequest,
    SalesActivity,
    LegalPolicy,
    DataRequest,
    SecurityIncident,
    PolicyAcknowledgement,
    PilotDeployment,
    PilotTask,
    TenantBackup,
    TenantRestoreRequest,
    TenantDataExport,
    TenantDisasterRecoveryLog,
    CustomerSuccessNote,
    RenewalWorkflow,
    SupportTicket,
    KnowledgeBaseArticle,
    OTBooking,
    SurgeryNote,
    AnaesthesiaNote,
    PostOpNote,
    OTInventoryUsage,
    NursingVital,
    MedicationAdministration,
    NursingHandoverNote,
    NursingCarePlan,
    NursingShiftTask,
    EmergencyCase,
    EmergencyTriageNote,
    EmergencyClinicalNote,
    EmergencyTransfer,
    BloodDonor,
    BloodUnit,
    BloodRequisition,
    BloodCrossMatch,
    BloodIssueRecord,
    BloodReservation,
    StaffProfile,
    StaffAttendance,
    StaffShiftRoster,
    StaffLeaveRequest,
    StaffPayrollExport,
    HL7Message,
    ABDMConsent,
    ABHACareContext,
};
