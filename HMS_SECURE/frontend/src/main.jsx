import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap-icons/font/bootstrap-icons.css";
import {
  Activity,
  Bed,
  Building2,
  Calendar,
  Pill,
  ReceiptText,
  Stethoscope,
  TestTube2,
  Users,
  UserCircle,
  ShieldCheck,
  SlidersHorizontal,
  Crown,
  MessageCircle,
  FileCode2,
  Link2,
  ScanLine,
  Fingerprint,
  ShieldPlus,
  Landmark,
  Send,
  BadgeCheck,
  KeyRound,
  ClipboardCheck,
  FileHeart,
  PackageSearch,
  BarChart3,
  LineChart,
  ServerCog,
  Presentation,
  Scale,
Rocket,
  Droplets,
  BriefcaseBusiness,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import {
  appointmentApi,
  authApi,
  bedApi,
  billingApi,
  dashboardApi,
  doctorApi,
  doctorScheduleApi,
  labApi,
  patientApi,
  pharmacyApi,
  radiologyApi,
  tenantApi,
  auditApi,
  configurationApi,
  saasApi,
  emrApi,
  integrationApi,
  ipdApi,
} from "./api";
import { AppLayout } from "./layouts";
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Beds = lazy(() => import("./pages/Beds"));
const Billing = lazy(() => import("./pages/Billing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Doctors = lazy(() => import("./pages/Doctors"));
const Labs = lazy(() => import("./pages/Labs"));
const Login = lazy(() => import("./pages/Login"));
const Patients = lazy(() => import("./pages/Patients"));
const Pharmacy = lazy(() => import("./pages/Pharmacy"));
const TenantControl = lazy(() => import("./pages/TenantControl"));
const AuditSecurity = lazy(() => import("./pages/AuditSecurity"));
const Configuration = lazy(() => import("./pages/Configuration"));
const SaasControl = lazy(() => import("./pages/SaasControl"));
const Communications = lazy(() => import("./pages/Communications"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const DoctorPortal = lazy(() => import("./pages/DoctorPortal"));
const EMR = lazy(() => import("./pages/EMR"));
const IPD = lazy(() => import("./pages/IPD"));
const InsuranceTPA = lazy(() => import("./pages/InsuranceTPA"));
const Inventory = lazy(() => import("./pages/Inventory"));
const ComplianceCenter = lazy(() => import("./pages/ComplianceCenter"));
const IntegrationCenter = lazy(() => import("./pages/IntegrationCenter"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const Reports = lazy(() => import("./pages/Reports"));
const Nursing = lazy(() => import("./pages/Nursing"));
const Emergency = lazy(() => import("./pages/Emergency"));
const BloodBank = lazy(() => import("./pages/BloodBank"));
const HRStaff = lazy(() => import("./pages/HRStaff"));
const ProductionOps = lazy(() => import("./pages/ProductionOps"));
const SalesDemoCenter = lazy(() => import("./pages/SalesDemoCenter"));
const LegalSecurityCenter = lazy(() => import("./pages/LegalSecurityCenter"));
const AdvancedFeaturePage = lazy(() => import("./pages/AdvancedFeaturePage"));
const FHIRAPIs = lazy(() => import("./pages/FHIRAPIs"));
const WhatsAppSMS = lazy(() => import("./pages/WhatsAppSMS"));
const HL7Ready = lazy(() => import("./pages/HL7Ready"));
const PACSDicom = lazy(() => import("./pages/PACSDicom"));
const Biometric = lazy(() => import("./pages/Biometric"));
const ERPTally = lazy(() => import("./pages/ERPTally"));
const ABDMABHA = lazy(() => import("./pages/ABDMABHA"));
const TwoFactorSecurity = lazy(() => import("./pages/TwoFactorSecurity"));
const AuditCompliance = lazy(() => import("./pages/AuditCompliance"));
const PilotDeploymentCenter = lazy(() => import("./pages/PilotDeploymentCenter"));
import { DEFAULT_ENABLED_MODULES, DEFAULT_FEATURE_FLAGS, filterTabsByPermissions, hasPermission, normalizeFeatureFlags } from "./utils";
import "./style.css";


const emptyPatient = {
  patient_id: "",
  full_name: "",
  age: "",
  gender: "male",
  phone: "",
  email: "",
  address: "",
  blood_group: "",
  medical_notes: "",

  // profile_image_url: "",

  emergency_contact_name: "",
  emergency_contact_phone: "",
  insurance_provider: "",
  insurance_policy_number: "",
};
const emptyDoctor = {
  doctor_id: "",
  full_name: "",
  email: "",
  phone: "",
  specialization: "",
  qualification: "",
  consultation_fee: "",
  license_number: "",
  registration_number: "",
  status: "active",
};
const emptySchedule = {
  doctor_id: "",
  working_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
  start_time: "10:00",
  end_time: "14:00",
  break_start: "",
  break_end: "",
  slot_duration: 15,
  max_patients_per_day: "",
  unavailable_dates: "",
  status: "active",
  notes: "",
};
const emptyAppointment = {
  patient_id: "",
  doctor_id: "",
  appointment_date: "",
  appointment_time: "",
  appointment_type: "opd",
  status: "scheduled",
  notes: "",
};
const emptyBed = { ward: "", bed_number: "", status: "available" };
const emptyLab = { patient_id: "", doctor_id: "", template_id: "", test_name: "", test_category: "General", sample_type: "Blood", priority: "routine", notes: "" };
const emptyRad = { patient_id: "", doctor_id: "", scan_name: "", scan_category: "General", modality: "XRAY", body_part: "", priority: "routine", dicom_study_id: "", pacs_viewer_url: "", notes: "" };
const emptyMed = { name: "", generic_name: "", category: "", batch_number: "", vendor: "", expiry_date: "", quantity: "", low_stock_threshold: 10, cost_price: "", selling_price: "", unit: "pcs", status: "active" };
const emptyBill = { patient_id: "", amount: "", status: "unpaid" };

function App() {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "null"),
  );
  const [tab, setTab] = useState("dashboard");
  const [currentHospital, setCurrentHospital] = useState(null);
  const [tenants, setTenants] = useState([]);
  const emptyTenantForm = {
    hospital_code: "",
    name: "",
    type: "hospital",
    plan: "enterprise",
    status: "active",
    enabled_modules: DEFAULT_ENABLED_MODULES,
    feature_flags: DEFAULT_FEATURE_FLAGS,
    branding: {
      logo_url: "",
      logo_public_id: "",
      primary_color: "#0f172a",
      secondary_color: "#2563eb",
    },
    settings: {
      address: "",
      city: "",
      state: "",
      country: "India",
      phone: "",
      email: "",
      website: "",
      gst_number: "",
      registration_number: "",
      uhid_prefix: "",
      bill_prefix: "",
      prescription_prefix: "",
      lab_report_prefix: "",
    },
    initial_admin: {
      full_name: "",
      email: "",
      password: "",
      phone: "",
    },
  };
  const [tenantForm, setTenantForm] = useState(emptyTenantForm);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [stats, setStats] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [pendingPatientDocs, setPendingPatientDocs] = useState([]);
  const [patientProfileImage, setPatientProfileImage] = useState(null);
  const [patientProfilePreview, setPatientProfilePreview] = useState("");

  const [savedPatientDocs, setSavedPatientDocs] = useState({});

  const [patientDocForm, setPatientDocForm] = useState({
    category: "medical",
    document_type: "Prescription",
    title: "",
    notes: "",
  });

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [doctorSchedules, setDoctorSchedules] = useState([]);
  const [beds, setBeds] = useState([]);
  const [ipdAdmissions, setIpdAdmissions] = useState([]);
  const [labs, setLabs] = useState([]);
  const [rads, setRads] = useState([]);
  const [meds, setMeds] = useState([]);
  const [bills, setBills] = useState([]);
  const [profile, setProfile] = useState(user || {});
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "receptionist",
    profile_image: "",
    bio: "",
    permissions: [],
  });
  const [usersList, setUsersList] = useState([]);
  const [dynamicFields, setDynamicFields] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [manageableRoles, setManageableRoles] = useState([]);

  const [patient, setPatient] = useState(emptyPatient);
  const [doctor, setDoctor] = useState(emptyDoctor);

  const [appointment, setAppointment] = useState(emptyAppointment);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("all");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState("");
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState("all");
  const [patientPage, setPatientPage] = useState(1);
  const [doctorPage, setDoctorPage] = useState(1);
  const [appointmentPage, setAppointmentPage] = useState(1);
  const pageSize = 10;
  const [bed, setBed] = useState(emptyBed);
  const [lab, setLab] = useState(emptyLab);
  const [rad, setRad] = useState(emptyRad);
  const [labTemplates, setLabTemplates] = useState([]);
  const [med, setMed] = useState(emptyMed);
  const [bill, setBill] = useState(emptyBill);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  async function load() {
    if (!localStorage.getItem("token")) return;
    try {
      const { data: hospital } = await tenantApi.me();
      setCurrentHospital(hospital);
      if (hospital?.name && (!user?.hospital_name || user.hospital_name !== hospital.name)) {
        const enrichedUser = { ...user, hospital_id: hospital.id, hospital_name: hospital.name };
        setUser(enrichedUser);
        localStorage.setItem("user", JSON.stringify(enrichedUser));
      }
    } catch (_) {
      // Tenant endpoint is backward-compatible; ignore if current server has not deployed it yet.
    }
    const calls = [
      dashboardApi.getStats(),
      patientApi.list(),
      doctorApi.list(),
      appointmentApi.list(),
      doctorScheduleApi.list(),
      bedApi.list(),
      ipdApi.list(),
      labApi.list(),
      radiologyApi.list(),
      labApi.templates(),
      pharmacyApi.list(),
      billingApi.list(),
      authApi.getUsers(),
      configurationApi.listPublicFields(),
      authApi.getPermissions(),
    ];
    const [s, p, d, a, ds, b, ipd, l, r, lt, m, bi, u, cf, perms] = await Promise.allSettled(calls);
    if (s.value) setStats(s.value.data);
    if (p.value) setPatients(p.value.data);
    if (d.value) setDoctors(d.value.data);
    if (a.value) setAppointments(a.value.data);
    if (ds.value) setDoctorSchedules(ds.value.data);
    if (b.value) setBeds(b.value.data);
    if (ipd.value) setIpdAdmissions(ipd.value.data);
    if (l.value) setLabs(l.value.data);
    if (r.value) setRads(r.value.data);
    if (lt.value) setLabTemplates(lt.value.data);
    if (m.value) setMeds(m.value.data);
    if (bi.value) setBills(bi.value.data);
    if (u.value) setUsersList(u.value.data);
    if (cf.value) setDynamicFields(cf.value.data);
    if (perms.value) {
      setPermissionCatalog(perms.value.data?.catalog || []);
      setManageableRoles(perms.value.data?.manageableRoles || []);
    }
    if (hasPermission(user, "hospital.manage")) {
      try {
        const { data: tenantRows } = await tenantApi.list();
        setTenants(tenantRows);
      } catch (_) {
        setTenants([]);
      }
    }
  }
  useEffect(() => {
    load();
  }, [user]);

  async function addPatient(e) {
    e.preventDefault();

    try {
      let savedPatientId = editingPatientId;

      let duplicateWarnings = [];
      if (editingPatientId) {
        const { data } = await patientApi.update(editingPatientId, patient);
        duplicateWarnings = data?.duplicate_warnings || [];
        toast.success("Patient updated successfully");
      } else {
        const { data } = await patientApi.create(patient);
        savedPatientId = data.id;
        duplicateWarnings = data?.duplicate_warnings || [];
        toast.success("Patient added successfully");
      }

      if (duplicateWarnings.length > 0) {
        toast(`Possible duplicate patient found: ${duplicateWarnings[0].full_name || duplicateWarnings[0].patient_id}`);
      }
      if (patientProfileImage && savedPatientId) {
        const imageFormData = new FormData();

        imageFormData.append("profile_image", patientProfileImage);

        const imageUploadResponse = await patientApi.uploadProfileImage(savedPatientId, imageFormData);

        patient.profile_image_url = imageUploadResponse.data.profile_image_url;
      }

      const uploadedDocs = [];

      for (const doc of pendingPatientDocs) {
        if (!doc.file) {
          uploadedDocs.push(doc);
          continue;
        }

        const formData = new FormData();

        formData.append("document", doc.file);
        formData.append("title", doc.title);
        formData.append("category", doc.category);
        formData.append("document_type", doc.document_type);
        formData.append("notes", doc.notes || "");

        const { data } = await patientApi.uploadDocument(savedPatientId, formData);

        if (data.document) {
          uploadedDocs.push(data.document);
        }
      }

      setSavedPatientDocs((prev) => ({
        ...prev,
        [patient.patient_id]: uploadedDocs,
      }));

      setEditingPatientId(null);

      setPatient(emptyPatient);
      setPendingPatientDocs([]);

      setPatientProfileImage(null);
      setPatientProfilePreview("");

      await load();

      toast.success("Patient and documents saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Patient action failed");
    }
  }

  async function addDoctor(e) {
    e.preventDefault();

    try {
      if (editingDoctorId) {
        const updatedDoctorId = editingDoctorId;
        await doctorApi.update(updatedDoctorId, doctor);
        toast.success("Doctor updated successfully");
        setEditingDoctorId(null);
        setDoctor(emptyDoctor);
        await load();

        if (tab === "doctorProfile" && selectedDoctor && String(selectedDoctor.id) === String(updatedDoctorId)) {
          try {
            const { data } = await doctorApi.get(updatedDoctorId);
            setSelectedDoctor(data);
          } catch (_) {
            setSelectedDoctor((prev) => prev ? { ...prev, ...doctor } : prev);
          }
        }
        return;
      }

      await doctorApi.create(doctor);
      toast.success("Doctor added successfully");
      setDoctor(emptyDoctor);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor action failed");
    }
  }
  function editPatient(row) {
    setPatient({
      patient_id: row.patient_id || "",
      full_name: row.full_name || "",
      age: row.age || "",
      gender: row.gender || "male",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
      blood_group: row.blood_group || "",
      medical_notes: row.medical_notes || "",
      profile_image_url: row.profile_image_url || "",

      emergency_contact_name: row.emergency_contact_name || "",
      emergency_contact_phone: row.emergency_contact_phone || "",
      insurance_provider: row.insurance_provider || "",
      insurance_policy_number: row.insurance_policy_number || "",
      custom_fields: row.custom_fields || {},
    });

    setEditingPatientId(row.id || row._id);
    setPendingPatientDocs(
      row.documents || savedPatientDocs[row.patient_id] || [],
    );

    setPatientProfilePreview(row.profile_image_url || "");
    setPatientProfileImage(null);
  }

  async function deletePatient(row) {
    if (!confirm("Delete this patient?")) return;

    try {
      await patientApi.delete(row.id || row._id);
      await load();
      toast.success("Patient archived successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }
  function handlePendingPatientDocument(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG, and WEBP files are allowed");
      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("File size should be less than 5MB");
      e.target.value = "";
      return;
    }

    const newDoc = {
      id: Date.now(),
      patient_id: patient.patient_id,
      category: patientDocForm.category,
      document_type: patientDocForm.document_type,
      title: patientDocForm.title || file.name,
      notes: patientDocForm.notes,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file,
      file_url: URL.createObjectURL(file),
      uploaded_at: new Date().toLocaleString(),
    };

    setPendingPatientDocs((prev) => [...prev, newDoc]);

    setPatientDocForm({
      category: "medical",
      document_type: "Prescription",
      title: "",
      notes: "",
    });

    e.target.value = "";
    toast.success("Document added to patient form");
  }
  function handlePatientProfileImage(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP images are allowed");
      e.target.value = "";
      return;
    }

    const maxSize = 3 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Image size should be less than 3MB");
      e.target.value = "";
      return;
    }

    setPatientProfileImage(file);
    setPatientProfilePreview(URL.createObjectURL(file));

    toast.success("Patient profile image selected");
  }
  function removePendingPatientDocument(docId) {
    setPendingPatientDocs((prev) => prev.filter((doc, index) => (doc.id ?? index) !== docId));
    toast.success("Document removed");
  }

  async function deletePatientDocument(patientId, docIndex) {
    const reason = prompt("Reason for deleting this patient document:");
    if (!reason) return;
    try {
      const { data } = await patientApi.deleteDocument(patientId, docIndex, reason);
      setSelectedPatient((prev) => prev && String(prev.id) === String(patientId) ? { ...prev, documents: data.documents || [] } : prev);
      await load();
      toast.success("Patient document deleted successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Document delete failed");
    }
  }
  function editDoctor(row, options = {}) {
    setDoctor({
      doctor_id: row.doctor_id || "",
      full_name: row.full_name || "",
      email: row.email || "",
      phone: row.phone || "",
      specialization: row.specialization || "",
      qualification: row.qualification || "",
      consultation_fee: row.consultation_fee || "",
      license_number: row.license_number || "",
      registration_number: row.registration_number || "",
      status: row.status || "active",
      custom_fields: row.custom_fields || {},
    });

    setEditingDoctorId(row.id || row._id);
    if (options.stayOnProfile) setTab("doctorProfile");
  }

  function cancelDoctorEdit() {
    setDoctor(emptyDoctor);
    setEditingDoctorId(null);
  }

  function getDoctorIdentifier(row) {
    if (!row) return "";
    return row.id || row.doctor_id || row._id || row.doctor_uid || "";
  }

  async function openDoctorProfile(row) {
    const fallbackDoctor = doctors.find((d) => d.id === row.id || d.doctor_id === row.doctor_id) || row;
    setSelectedDoctor(fallbackDoctor);
    setTab("doctorProfile");

    try {
      const { data } = await doctorApi.get(getDoctorIdentifier(row));
      setSelectedDoctor(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not refresh doctor profile");
    }
  }

  async function uploadDoctorProfileImage(doctorId, file) {
    if (!doctorId || !file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP images are allowed");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image size should be less than 3MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("profile_image", file);

      const { data } = await doctorApi.uploadProfileImage(doctorId, formData);
      const refreshed = await doctorApi.get(doctorId);

      setSelectedDoctor(refreshed.data);
      await load();
      toast.success(data.message || "Doctor profile image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor profile image upload failed");
    }
  }


  async function uploadDoctorDocument(doctorId, payload) {
    const resolvedDoctorId = getDoctorIdentifier(selectedDoctor) || doctorId;
    if (!resolvedDoctorId || !payload?.file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(payload.file.type)) {
      toast.error("Only PDF, DOC, DOCX, JPG, PNG, and WEBP files are allowed");
      return;
    }

    if (payload.file.size > 8 * 1024 * 1024) {
      toast.error("Document size should be less than 8MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("document", payload.file);
      formData.append("title", payload.title || payload.file.name);
      formData.append("document_type", payload.document_type || "Certificate");
      formData.append("category", payload.category || "credential");
      formData.append("notes", payload.notes || "");

      formData.append("doctor_id", String(selectedDoctor?.doctor_id || resolvedDoctorId));
      formData.append("id", String(selectedDoctor?.id || resolvedDoctorId));

      const { data } = await doctorApi.uploadDocument(resolvedDoctorId, formData);
      const refreshId = getDoctorIdentifier(data.doctor) || resolvedDoctorId;
      const refreshed = await doctorApi.get(refreshId);

      setSelectedDoctor(refreshed.data);
      await load();
      toast.success(data.message || "Doctor document uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor document upload failed");
    }
  }

  async function deleteDoctorDocument(doctorId, docIndex) {
    const resolvedDoctorId = getDoctorIdentifier(selectedDoctor) || doctorId;
    if (!resolvedDoctorId && resolvedDoctorId !== 0) return;
    if (!confirm("Delete this doctor document?")) return;

    try {
      const { data } = await doctorApi.deleteDocument(resolvedDoctorId, docIndex);
      const refreshId = getDoctorIdentifier(data.doctor) || resolvedDoctorId;
      const refreshed = await doctorApi.get(refreshId);

      setSelectedDoctor(refreshed.data);
      await load();
      toast.success(data.message || "Doctor document deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor document delete failed");
    }
  }

  async function deleteDoctor(row) {
    if (!confirm("Delete this doctor?")) return;

    try {
      await doctorApi.delete(row.id || row._id);
      await load();
      toast.success("Doctor archived successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }
  async function saveDoctorSchedule(e) {
    e.preventDefault();
    try {
      const payload = {
        ...scheduleForm,
        unavailable_dates: Array.isArray(scheduleForm.unavailable_dates)
          ? scheduleForm.unavailable_dates
          : String(scheduleForm.unavailable_dates || "").split(",").map((x) => x.trim()).filter(Boolean),
      };
      await doctorScheduleApi.save(payload);
      setScheduleForm(emptySchedule);
      await load();
      toast.success("Doctor schedule saved successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor schedule save failed");
    }
  }

  function editDoctorSchedule(row) {
    setScheduleForm({
      doctor_id: row.doctor_ref_id || row.doctor_id || "",
      working_days: row.working_days || emptySchedule.working_days,
      start_time: row.start_time || "10:00",
      end_time: row.end_time || "14:00",
      break_start: row.break_start || "",
      break_end: row.break_end || "",
      slot_duration: row.slot_duration || 15,
      max_patients_per_day: row.max_patients_per_day || "",
      unavailable_dates: Array.isArray(row.unavailable_dates) ? row.unavailable_dates.join(", ") : (row.unavailable_dates || ""),
      status: row.status || "active",
      notes: row.notes || "",
    });
  }

  async function deleteDoctorSchedule(row) {
    if (!confirm("Delete this doctor schedule?")) return;
    try {
      await doctorScheduleApi.delete(row.id || row._id);
      await load();
      toast.success("Doctor schedule deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Doctor schedule delete failed");
    }
  }

  async function addAppointment(e) {
    e.preventDefault();

    try {
      if (editingAppointmentId) {
        await appointmentApi.update(editingAppointmentId, appointment);
        toast.success("Appointment updated successfully");
        setEditingAppointmentId(null);
      } else {
        await appointmentApi.create(appointment);
        toast.success("Appointment added successfully");
      }

      setAppointment(emptyAppointment);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Appointment action failed");
    }
  }

  function editAppointment(row) {
    setAppointment({
      id: row.id || row._id,
      patient_id: row.patient_id || "",
      doctor_id: row.doctor_id || "",
      appointment_date: row.appointment_date || "",
      appointment_time: row.appointment_time || "",
      appointment_type: row.appointment_type || "opd",
      status: row.status || "scheduled",
      notes: row.notes || "",
      reschedule_reason: "",
      original_doctor_id: row.doctor_id || "",
      original_appointment_date: row.appointment_date || "",
      original_appointment_time: row.appointment_time || "",
    });

    setEditingAppointmentId(row.id || row._id);
  }

  async function deleteAppointment(row) {
    if (!confirm("Archive this appointment? It will be hidden from normal appointment lists but kept for audit history.")) return;

    try {
      await appointmentApi.delete(row.id || row._id);
      await load();
      toast.success("Appointment archived successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }

  async function updateAppointmentStatus(row, status) {
    const appointmentId = row.id || row._id;
    if (!appointmentId) return;

    const extra = {};
    if (status === "cancelled") {
      const reason = prompt("Cancellation reason is required for audit trail:");
      if (!reason?.trim()) {
        toast.error("Cancellation reason is required");
        return;
      }
      extra.cancellation_reason = reason.trim();
    }
    if (status === "no_show") {
      const reason = prompt("Optional no-show note/reason:") || "";
      if (reason.trim()) extra.no_show_reason = reason.trim();
    }

    try {
      await appointmentApi.updateStatus(appointmentId, status, extra);
      await load();
      toast.success(`Appointment marked as ${status.replaceAll("_", " ")}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Appointment status update failed");
    }
  }

  async function addBed(e) {
    e.preventDefault();
    await bedApi.create(bed);
    setBed(emptyBed);
    await load();
  }

  async function addLab(e) {
    e.preventDefault();
    await labApi.create(lab);
    setLab(emptyLab);
    toast.success("Lab order created");
    await load();
  }

  async function addRadiology(e) {
    e.preventDefault();
    await radiologyApi.create(rad);
    setRad(emptyRad);
    toast.success("Radiology order created");
    await load();
  }

  async function createLabTemplate(payload) {
    await labApi.createTemplate(payload);
    toast.success("Lab template created");
    await load();
  }

  async function saveLabResults(id, payload) {
    await labApi.saveResults(id, payload);
    toast.success("Lab results saved");
    await load();
  }

  async function approveLabReport(id, payload = {}) {
    await labApi.approve(id, payload);
    toast.success("Lab report approved");
    await load();
  }

  async function saveRadiologyReport(id, payload) {
    await radiologyApi.saveReport(id, payload);
    toast.success("Radiology report saved");
    await load();
  }

  async function approveRadiologyReport(id, payload = {}) {
    await radiologyApi.approve(id, payload);
    toast.success("Radiology report approved");
    await load();
  }

  async function updateLabStatus(id, status) {
    await labApi.updateStatus(id, status);
    toast.success("Lab status updated");
    await load();
  }

  async function uploadLabReport(id, payload) {
    await labApi.uploadReport(id, payload);
    toast.success("Lab report uploaded");
    await load();
  }


  async function archiveLabOrder(id) {
    const reason = prompt("Archive reason is required for audit trail:");
    if (!reason?.trim()) {
      toast.error("Archive reason is required");
      return;
    }
    await labApi.archive(id, reason.trim());
    toast.success("Lab order archived");
    await load();
  }

  async function updateRadiologyStatus(id, status) {
    await radiologyApi.updateStatus(id, status);
    toast.success("Radiology status updated");
    await load();
  }

  async function uploadRadiologyReport(id, payload) {
    await radiologyApi.uploadReport(id, payload);
    toast.success("Radiology report uploaded");
    await load();
  }


  async function archiveRadiologyOrder(id) {
    const reason = prompt("Archive reason is required for audit trail:");
    if (!reason?.trim()) {
      toast.error("Archive reason is required");
      return;
    }
    await radiologyApi.archive(id, reason.trim());
    toast.success("Radiology order archived");
    await load();
  }

  async function addMedicine(e) {
    e.preventDefault();
    await pharmacyApi.create(med);
    setMed(emptyMed);
    await load();
  }

  async function addBill(e) {
    e.preventDefault();
    const invoiceId = bill.id || bill.billingId;
    if (invoiceId) {
      await billingApi.update(invoiceId, bill);
      toast.success("Invoice updated");
    } else {
      await billingApi.create(bill);
      toast.success("Invoice created");
    }
    setBill(emptyBill);
    await load();
  }

  function editBill(row) {
    setBill({
      ...emptyBill,
      ...row,
      amount: row.amount || row.total_amount || "",
      total_amount: row.total_amount || row.amount || "",
      payment_status: row.payment_status || row.status || "pending",
      status: row.payment_status || row.status || "pending",
      payment_mode: row.payment_mode || "cash",
      service_type: row.service_type || "opd",
    });
  }

  async function updateBillPayment(row) {
    const currentTotal = Number(row.total_amount || row.amount || 0);
    const value = window.prompt(`Paid amount for ${row.invoice_number || `invoice ${row.id}`}`, String(row.paid_amount || 0));
    if (value === null) return;
    const paid_amount = Number(value);
    if (Number.isNaN(paid_amount) || paid_amount < 0 || paid_amount > currentTotal) {
      toast.error("Invalid paid amount");
      return;
    }
    await billingApi.updatePayment(row.id, { paid_amount, payment_mode: row.payment_mode || "cash" });
    toast.success("Payment updated");
    await load();
  }

  async function cancelBill(row) {
    const reason = window.prompt(`Reason to cancel ${row.invoice_number || `invoice ${row.id}`}`);
    if (!reason) return;
    await billingApi.cancel(row.id, reason);
    toast.success("Invoice cancelled");
    await load();
  }

  async function archiveBill(row) {
    const reason = window.prompt(`Reason to archive ${row.invoice_number || `invoice ${row.id}`}`);
    if (!reason) return;
    await billingApi.archive(row.id, reason);
    toast.success("Invoice archived");
    await load();
  }
  function handleProfileImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setProfile({
        ...profile,
        profile_image: reader.result,
      });
      toast.success("Profile image selected");
    };

    reader.readAsDataURL(file);
  }
  async function updateProfile(e) {
    e.preventDefault();
    try {
      const { data } = await authApi.updateProfile(profile);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Profile update failed");
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await authApi.changePassword(passwordForm);
      toast.success("Password changed. Please login again.");
      localStorage.clear();
      setUser(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed");
    }
  }

  async function addUser(e) {
    e.preventDefault();
    try {
      await authApi.createUser(newUser);
      setNewUser({
        full_name: "",
        email: "",
        password: "",
        role: "receptionist",
        profile_image: "",
        bio: "",
        permissions: [],
      });
      await load();
      toast.success("User added successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "User add failed");
    }
  }

  async function updateUserPermissions(row, nextPermissions) {
    try {
      const { data } = await authApi.updateUser(row.id, { permissions: nextPermissions });
      setUsersList((rows) => rows.map((u) => (u.id === row.id ? data.user : u)));
      toast.success("User permissions updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Permission update failed");
    }
  }

  async function toggleUserStatus(row) {
    if (row.email === user?.email) return toast.error("You cannot deactivate your own account");
    try {
      await authApi.updateUserStatus(row.id, row.status === "active" ? "inactive" : "active");
      await load();
      toast.success("User status updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "User status update failed");
    }
  }
  async function deleteUser(row) {
    if (row.email === user?.email) {
      return toast.error("You cannot deactivate your own admin account");
    }

    const reason = window.prompt(`Reason to deactivate ${row.full_name || row.email}`);
    if (!reason) return;

    try {
      await authApi.deactivateUser(row.id, reason);
      await load();
      toast.success("User deactivated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "User deactivate failed");
    }
  }
  async function saveTenant(e) {
    e.preventDefault();
    if (!tenantForm.name?.trim()) return toast.error("Hospital name is required");

    try {
      const payload = {
        ...tenantForm,
        hospital_code: tenantForm.hospital_code?.trim() || undefined,
      };

      if (editingTenantId) {
        const { initial_admin, ...hospitalOnlyPayload } = payload;
        await tenantApi.update(editingTenantId, hospitalOnlyPayload);
        toast.success("Hospital updated successfully");
      } else {
        await tenantApi.create(payload);
        toast.success(payload.initial_admin?.email ? "Hospital and admin login created successfully" : "Hospital created successfully");
      }

      setTenantForm(emptyTenantForm);
      setEditingTenantId(null);
      const { data } = await tenantApi.list();
      setTenants(data);
      try {
        const { data: updatedHospital } = await tenantApi.me();
        setCurrentHospital(updatedHospital);
      } catch (_) {
        // keep current hospital state unchanged if refresh fails
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Hospital save failed");
    }
  }

  function editTenant(row) {
    // Prefer mongo_id when available because old seed data may contain duplicate numeric ids.
    // Using mongo_id keeps hospital updates targeted to the exact row selected from the table.
    setEditingTenantId(row.mongo_id || row.id);
    setTenantForm({
      ...emptyTenantForm,
      id: row.id,
      mongo_id: row.mongo_id,
      hospital_code: row.hospital_code || "",
      name: row.name || "",
      type: row.type || "hospital",
      plan: row.plan || "enterprise",
      status: row.status || "active",
      enabled_modules: Array.isArray(row.enabled_modules) && row.enabled_modules.length ? row.enabled_modules : DEFAULT_ENABLED_MODULES,
      feature_flags: normalizeFeatureFlags(row.feature_flags),
      branding: {
        logo_url: row.branding?.logo_url || "",
        logo_public_id: row.branding?.logo_public_id || "",
        primary_color: row.branding?.primary_color || "#0f172a",
        secondary_color: row.branding?.secondary_color || "#2563eb",
      },
      settings: {
        address: row.settings?.address || "",
        city: row.settings?.city || "",
        state: row.settings?.state || "",
        country: row.settings?.country || "India",
        phone: row.settings?.phone || "",
        email: row.settings?.email || "",
        website: row.settings?.website || "",
        gst_number: row.settings?.gst_number || "",
        registration_number: row.settings?.registration_number || "",
        uhid_prefix: row.settings?.uhid_prefix || "",
        bill_prefix: row.settings?.bill_prefix || "",
        prescription_prefix: row.settings?.prescription_prefix || "",
        lab_report_prefix: row.settings?.lab_report_prefix || "",
      },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleTenantStatus(row) {
    try {
      const nextStatus = row.status === "active" ? "inactive" : "active";
      await tenantApi.update(row.id, { status: nextStatus });
      const { data } = await tenantApi.list();
      setTenants(data);
      toast.success("Hospital status updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Status update failed");
    }
  }

  async function uploadTenantLogo(hospitalId, file) {
    if (!file) return toast.error("Please choose a logo file");
    try {
      const formData = new FormData();
      formData.append("logo", file);
      await tenantApi.uploadLogo(hospitalId, formData);
      const { data } = await tenantApi.list();
      setTenants(data);
      try {
        const { data: updatedHospital } = await tenantApi.me();
        setCurrentHospital(updatedHospital);
      } catch (_) { }
      toast.success("Hospital logo uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Logo upload failed");
    }
  }

  async function archiveTenant(row) {
    if (!row?.id) return;
    if (!confirm(`Archive ${row.name}? Existing data will stay safe, but hospital login will be blocked.`)) return;
    try {
      await tenantApi.archive(row.id);
      const { data } = await tenantApi.list();
      setTenants(data);
      toast.success("Hospital archived safely");
    } catch (err) {
      toast.error(err.response?.data?.message || "Hospital archive failed");
    }
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }
  const allTabs = [
    ["dashboard", "Dashboard", Activity],
    ["commandCenter", "Command Center", BarChart3],
    ["reports", "Reports", LineChart],
    ["patients", "Patients", Users],
    ["doctors", "Doctors", Stethoscope],
    ["appointments", "Appointments", Calendar],
    ["patientPortal", "Patient Portal", UserCircle],
    ["doctorPortal", "Doctor Portal", Stethoscope],
    ["emr", "EMR / EHR", FileHeart],
    ["beds", "Beds", Bed],
    ["ipd", "IPD", Bed],
    ["nursing", "Nursing", ClipboardCheck],
    ["emergency", "Emergency", ShieldPlus],
    ["bloodBank", "Blood Bank", Droplets],
    ["hrStaff", "HR / Staff", BriefcaseBusiness],
    ["labs", "Lab/Radiology", TestTube2],
    ["pharmacy", "Pharmacy", Pill],
    ["inventory", "Inventory", PackageSearch],
    ["compliance", "Compliance", ClipboardCheck],
    ["billing", "Billing", ReceiptText],
    ["profile", "Profile", UserCircle],
    ["auditSecurity", "Security", ShieldCheck],
    ["operations", "Production Ops", ServerCog],
    ["configuration", "Configuration", SlidersHorizontal],
    ["communications", "Communications", MessageCircle],
    ["saasControl", "SaaS Control", Crown],
    ["salesDemo", "Sales Demo", Presentation],
    ["legalSecurity", "Legal & Security", Scale],
    ["pilotDeployment", "Pilot Deployment", Rocket],
    ["tenants", "Hospitals", Building2],
    ["integration", "FHIR APIs", FileCode2],
    ["hl7", "HL7 Ready", Link2],
    ["pacs", "PACS/DICOM", ScanLine],
    ["biometric", "Biometric", Fingerprint],
    ["insurance_tpa", "Insurance/TPA", ShieldPlus],
    ["erp", "ERP/Tally", Landmark],
    ["whatsapp_sms", "WhatsApp/SMS", Send],
    ["abdm_abha", "ABDM/ABHA", BadgeCheck],
    ["two_factor_auth", "2FA Security", KeyRound],
    ["audit_compliance", "Audit Compliance", ClipboardCheck],
  ];

  const enabledModules = currentHospital?.enabled_modules || DEFAULT_ENABLED_MODULES;
  const activeFeatureFlags = normalizeFeatureFlags(currentHospital?.feature_flags);
  const tabs = filterTabsByPermissions(user, allTabs, enabledModules, activeFeatureFlags);

  useEffect(() => {
    const internalViews = ["patientProfile", "doctorProfile"];
    if (internalViews.includes(tab)) return;
    if (tabs.length && !tabs.some(([id]) => id === tab)) {
      setTab(tabs[0][0]);
    }
  }, [tab, tabs]);

  if (!user) return <Login onLogin={setUser} />;

  const can = (permission) => hasPermission(user, permission);

  const permissions = {
    patientCreate: can("patient.create"),
    patientEdit: can("patient.edit"),
    patientDelete: can("patient.delete"),
    patientDocumentManage: can("patient.document.manage"),
    doctorCreate: can("doctor.create"),
    doctorEdit: can("doctor.edit"),
    doctorDelete: can("doctor.delete"),
    doctorDocumentManage: can("doctor.document.manage") || can("doctor.edit"),
    appointmentCreate: can("appointment.create"),
    appointmentEdit: can("appointment.edit"),
    appointmentDelete: can("appointment.delete"),
    appointmentStatusUpdate: can("appointment.status.update"),
    doctorScheduleManage: can("appointment.edit"),
    bedCreate: can("bed.create"),
    ipdCreate: can("ipd.create"),
    labCreate: can("lab.create"),
    radiologyCreate: can("radiology.create"),
    pharmacyCreate: can("pharmacy.create"),
    pharmacyStockManage: can("pharmacy.stock.manage"),
    inventoryManage: can("inventory.manage") || can("pharmacy.stock.manage"),
    billingCreate: can("billing.create"),
    billingEdit: can("billing.edit"),
    adminUsersManage: can("admin.users.manage"),
    hospitalManage: can("hospital.manage"),
    auditView: can("audit.view"),
    securityManage: can("security.manage"),
    complianceView: can("compliance.view") || can("audit.view"),
    complianceManage: can("compliance.manage") || can("security.manage"),
    configurationManage: can("configuration.manage"),
    featureFlags: normalizeFeatureFlags(currentHospital?.feature_flags),
    insuranceManage: can("insurance.manage") || can("billing.edit") || can("configuration.manage"),
  };

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(userSearch.toLowerCase());

    const matchRole = roleFilter === "all" ? true : u.role === roleFilter;

    return matchSearch && matchRole;
  });
  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();

    return (
      (p.patient_id || "").toLowerCase().includes(q) ||
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  });
  const paginatedPatients = filteredPatients.slice(
    (patientPage - 1) * pageSize,
    patientPage * pageSize,
  );

  const patientTotalPages = Math.ceil(filteredPatients.length / pageSize);

  const filteredDoctors = doctors.filter((d) => {
    const q = doctorSearch.toLowerCase();

    return (
      (d.doctor_id || "").toLowerCase().includes(q) ||
      (d.full_name || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.phone || "").toLowerCase().includes(q) ||
      (d.specialization || "").toLowerCase().includes(q)
    );
  });

  const paginatedDoctors = filteredDoctors.slice(
    (doctorPage - 1) * pageSize,
    doctorPage * pageSize,
  );

  const doctorTotalPages = Math.ceil(filteredDoctors.length / pageSize);
  const filteredAppointments = appointments.filter((a) => {
    const q = appointmentSearch.toLowerCase();

    const matchSearch =
      (a.patient_id || "").toLowerCase().includes(q) ||
      (a.doctor_id || "").toLowerCase().includes(q) ||
      (a.patient_name || "").toLowerCase().includes(q) ||
      (a.doctor_name || "").toLowerCase().includes(q);

    const matchStatus =
      appointmentStatusFilter === "all"
        ? true
        : a.status === appointmentStatusFilter;

    const matchDate = appointmentDateFilter
      ? a.appointment_date === appointmentDateFilter
      : true;

    const matchType = appointmentTypeFilter === "all"
      ? true
      : (a.appointment_type || "opd") === appointmentTypeFilter;

    return matchSearch && matchStatus && matchDate && matchType;
  });
  const paginatedAppointments = filteredAppointments.slice(
    (appointmentPage - 1) * pageSize,
    appointmentPage * pageSize,
  );

  const appointmentTotalPages = Math.ceil(
    filteredAppointments.length / pageSize,
  );
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0f172a",
            color: "#fff",
            borderRadius: "12px",
            padding: "14px 16px",
            fontWeight: 600,
          },
        }}
      />
      <AppLayout
        user={user}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onLogout={logout}
        headerTitle={tab === "patientProfile" ? "Patient Profile" : tab === "doctorProfile" ? "Doctor Profile" : tabs.find((t) => t[0] === tab)?.[1]}
        appointmentCount={appointments.length}
        lowStockCount={meds.filter((m) => Number(m.stock || 0) < 10).length}
        pendingBillCount={bills.filter((b) => b.status === "pending").length}
        onRefresh={load}
        searchData={{
          patients,
          doctors,
          actions: tabs.map(([key, label]) => ({ key, label: `Open ${label}`, hint: `${label} module` })),
        }}
        onSearchNavigate={(type, item) => {
          if (type === "patient") {
            setTab("patients");
            setPatientSearch(item.full_name || item.patient_id || "");
          } else if (type === "doctor") {
            setTab("doctors");
            setDoctorSearch(item.full_name || item.doctor_id || "");
          } else if (type === "action") {
            setTab(item.key);
          }
        }}
      >
        <Suspense fallback={<div className="page-loader">Loading module...</div>}>
            {tab === "fhir" && <FHIRAPIs currentHospital={currentHospital} />}
            {tab === "whatsapp_sms" && <WhatsAppSMS currentHospital={currentHospital} />}
            {tab === "hl7" && <HL7Ready currentHospital={currentHospital} />}
            {tab === "pacs" && <PACSDicom currentHospital={currentHospital} />}
            {tab === "biometric" && <Biometric currentHospital={currentHospital} />}
            {tab === "erp" && <ERPTally currentHospital={currentHospital} />}
            {tab === "abdm_abha" && <ABDMABHA currentHospital={currentHospital} />}
            {tab === "two_factor_auth" && <TwoFactorSecurity currentHospital={currentHospital} />}
            {tab === "audit_compliance" && <AuditCompliance currentHospital={currentHospital} />}
            {tab === "dashboard" && (
              <Dashboard
                stats={stats}
                patients={patients}
                doctors={doctors}
                appointments={appointments}
                beds={beds}
                bills={bills}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}
            {tab === "patients" && (
              <Patients
                patient={patient}
                setPatient={setPatient}
                emptyPatient={emptyPatient}
                editingPatientId={editingPatientId}
                setEditingPatientId={setEditingPatientId}
                patientProfilePreview={patientProfilePreview}
                setPatientProfilePreview={setPatientProfilePreview}
                patientProfileImage={patientProfileImage}
                setPatientProfileImage={setPatientProfileImage}
                pendingPatientDocs={pendingPatientDocs}
                setPendingPatientDocs={setPendingPatientDocs}
                patientDocForm={patientDocForm}
                setPatientDocForm={setPatientDocForm}
                handlePatientProfileImage={handlePatientProfileImage}
                handlePendingPatientDocument={handlePendingPatientDocument}
                removePendingPatientDocument={removePendingPatientDocument}
                addPatient={addPatient}
                patientSearch={patientSearch}
                setPatientSearch={setPatientSearch}
                paginatedPatients={paginatedPatients}
                editPatient={editPatient}
                deletePatient={deletePatient}
                deletePatientDocument={deletePatientDocument}
                patients={patients}
                setSelectedPatient={setSelectedPatient}
                setTab={setTab}
                patientPage={patientPage}
                setPatientPage={setPatientPage}
                patientTotalPages={patientTotalPages}
                selectedPatient={selectedPatient}
                appointments={appointments}
                bills={bills}
                savedPatientDocs={savedPatientDocs}
                permissions={permissions}
                dynamicFields={dynamicFields.filter((f) => f.target_module === "patients" && f.is_active !== false)}
                activeView="patients"
              />
            )}
            {tab === "patientProfile" && selectedPatient && (
              <Patients
                patient={patient}
                setPatient={setPatient}
                emptyPatient={emptyPatient}
                editingPatientId={editingPatientId}
                setEditingPatientId={setEditingPatientId}
                patientProfilePreview={patientProfilePreview}
                setPatientProfilePreview={setPatientProfilePreview}
                patientProfileImage={patientProfileImage}
                setPatientProfileImage={setPatientProfileImage}
                pendingPatientDocs={pendingPatientDocs}
                setPendingPatientDocs={setPendingPatientDocs}
                patientDocForm={patientDocForm}
                setPatientDocForm={setPatientDocForm}
                handlePatientProfileImage={handlePatientProfileImage}
                handlePendingPatientDocument={handlePendingPatientDocument}
                removePendingPatientDocument={removePendingPatientDocument}
                addPatient={addPatient}
                patientSearch={patientSearch}
                setPatientSearch={setPatientSearch}
                paginatedPatients={paginatedPatients}
                editPatient={editPatient}
                deletePatient={deletePatient}
                deletePatientDocument={deletePatientDocument}
                patients={patients}
                setSelectedPatient={setSelectedPatient}
                setTab={setTab}
                patientPage={patientPage}
                setPatientPage={setPatientPage}
                patientTotalPages={patientTotalPages}
                selectedPatient={selectedPatient}
                appointments={appointments}
                bills={bills}
                savedPatientDocs={savedPatientDocs}
                permissions={permissions}
                dynamicFields={dynamicFields.filter((f) => f.target_module === "patients" && f.is_active !== false)}
                activeView="patientProfile"
              />
            )}
            {tab === "doctors" && (
              <Doctors
                doctor={doctor}
                setDoctor={setDoctor}
                addDoctor={addDoctor}
                doctorSearch={doctorSearch}
                setDoctorSearch={setDoctorSearch}
                paginatedDoctors={paginatedDoctors}
                editDoctor={editDoctor}
                deleteDoctor={deleteDoctor}
                doctorPage={doctorPage}
                setDoctorPage={setDoctorPage}
                doctorTotalPages={doctorTotalPages}
                permissions={permissions}
                selectedDoctor={selectedDoctor}
                editingDoctorId={editingDoctorId}
                cancelDoctorEdit={cancelDoctorEdit}
                setTab={setTab}
                openDoctorProfile={openDoctorProfile}
                uploadDoctorProfileImage={uploadDoctorProfileImage}
                uploadDoctorDocument={uploadDoctorDocument}
                deleteDoctorDocument={deleteDoctorDocument}
                appointments={appointments}
                dynamicFields={dynamicFields.filter((f) => f.target_module === "doctors" && f.is_active !== false)}
                activeView="doctors"
              />
            )}
            {tab === "doctorProfile" && selectedDoctor && (
              <Doctors
                doctor={doctor}
                setDoctor={setDoctor}
                addDoctor={addDoctor}
                doctorSearch={doctorSearch}
                setDoctorSearch={setDoctorSearch}
                paginatedDoctors={paginatedDoctors}
                editDoctor={editDoctor}
                deleteDoctor={deleteDoctor}
                doctorPage={doctorPage}
                setDoctorPage={setDoctorPage}
                doctorTotalPages={doctorTotalPages}
                permissions={permissions}
                selectedDoctor={selectedDoctor}
                editingDoctorId={editingDoctorId}
                cancelDoctorEdit={cancelDoctorEdit}
                setTab={setTab}
                openDoctorProfile={openDoctorProfile}
                uploadDoctorProfileImage={uploadDoctorProfileImage}
                uploadDoctorDocument={uploadDoctorDocument}
                deleteDoctorDocument={deleteDoctorDocument}
                appointments={appointments}
                dynamicFields={dynamicFields.filter((f) => f.target_module === "doctors" && f.is_active !== false)}
                activeView="doctorProfile"
              />
            )}

            {tab === "patientPortal" && (
              <PatientPortal
                user={user}
                patients={patients}
              />
            )}

            {tab === "doctorPortal" && (
              <DoctorPortal
                user={user}
                doctors={doctors}
              />
            )}

            {tab === "appointments" && (
              <Appointments
                appointment={appointment}
                setAppointment={setAppointment}
                addAppointment={addAppointment}
                appointmentSearch={appointmentSearch}
                setAppointmentSearch={setAppointmentSearch}
                appointmentStatusFilter={appointmentStatusFilter}
                setAppointmentStatusFilter={setAppointmentStatusFilter}
                appointmentDateFilter={appointmentDateFilter}
                setAppointmentDateFilter={setAppointmentDateFilter}
                appointmentTypeFilter={appointmentTypeFilter}
                setAppointmentTypeFilter={setAppointmentTypeFilter}
                filteredAppointments={filteredAppointments}
                paginatedAppointments={paginatedAppointments}
                editAppointment={editAppointment}
                deleteAppointment={deleteAppointment}
                updateAppointmentStatus={updateAppointmentStatus}
                appointmentPage={appointmentPage}
                setAppointmentPage={setAppointmentPage}
                appointmentTotalPages={appointmentTotalPages}
                doctors={doctors}
                patients={patients}
                doctorSchedules={doctorSchedules}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                saveDoctorSchedule={saveDoctorSchedule}
                editDoctorSchedule={editDoctorSchedule}
                deleteDoctorSchedule={deleteDoctorSchedule}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}

            {tab === "beds" && (
              <Beds bed={bed} setBed={setBed} addBed={addBed} beds={beds} permissions={permissions} />
            )}

            {tab === "ipd" && (
              <IPD admissions={ipdAdmissions} setAdmissions={setIpdAdmissions} patients={patients} doctors={doctors} beds={beds} onChanged={load} permissions={permissions} />
            )}

            {tab === "labs" && (
              <Labs
                lab={lab}
                setLab={setLab}
                addLab={addLab}
                labs={labs}
                labTemplates={labTemplates}
                createLabTemplate={createLabTemplate}
                saveLabResults={saveLabResults}
                approveLabReport={approveLabReport}
                rad={rad}
                setRad={setRad}
                addRadiology={addRadiology}
                rads={rads}
                patients={patients}
                doctors={doctors}
                updateLabStatus={updateLabStatus}
                uploadLabReport={uploadLabReport}
                archiveLabOrder={archiveLabOrder}
                updateRadiologyStatus={updateRadiologyStatus}
                uploadRadiologyReport={uploadRadiologyReport}
                archiveRadiologyOrder={archiveRadiologyOrder}
                saveRadiologyReport={saveRadiologyReport}
                approveRadiologyReport={approveRadiologyReport}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}

            {tab === "pharmacy" && (
              <Pharmacy
                med={med}
                setMed={setMed}
                addMedicine={addMedicine}
                meds={meds}
                permissions={permissions}
                onChanged={load}
              />
            )}

            {tab === "inventory" && (
              <Inventory permissions={permissions} />
            )}

            {tab === "compliance" && (
              <ComplianceCenter permissions={permissions} />
            )}

            {tab === "integration" && (
              <IntegrationCenter permissions={permissions} />
            )}

            {tab === "commandCenter" && (
              <CommandCenter />
            )}

            {tab === "reports" && (
              <Reports />
            )}

            {tab === "nursing" && (
              <Nursing />
            )}

            {tab === "emergency" && (
              <Emergency />
            )}

            {tab === "bloodBank" && (
              <BloodBank />
            )}

            {tab === "hrStaff" && (
              <HRStaff />
            )}

            {tab === "operations" && (
              <ProductionOps permissions={permissions} />
            )}


            {tab === "insurance_tpa" && (
              <InsuranceTPA
                patients={patients}
                bills={bills}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}
            {tab === "billing" && (
              <Billing
                bill={bill}
                setBill={setBill}
                addBill={addBill}
                editBill={editBill}
                updateBillPayment={updateBillPayment}
                cancelBill={cancelBill}
                archiveBill={archiveBill}
                bills={bills}
                patients={patients}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}
            {tab === "saasControl" && (
              <SaasControl />
            )}
            {tab === "salesDemo" && (
              <SalesDemoCenter />
            )}
            {tab === "legalSecurity" && (
              <LegalSecurityCenter />
            )}
            {tab === "pilotDeployment" && (
              <PilotDeploymentCenter />
            )}
            {tab === "tenants" && (
              <TenantControl
                tenants={tenants}
                tenantForm={tenantForm}
                setTenantForm={setTenantForm}
                editingTenantId={editingTenantId}
                setEditingTenantId={setEditingTenantId}
                saveTenant={saveTenant}
                editTenant={editTenant}
                toggleTenantStatus={toggleTenantStatus}
                uploadTenantLogo={uploadTenantLogo}
                archiveTenant={archiveTenant}
                currentHospital={currentHospital}
                user={user}
                enabledModules={enabledModules}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}
            {tab === "auditSecurity" && (
              <AuditSecurity permissions={permissions} />
            )}
            {tab === "configuration" && (
              <Configuration permissions={permissions} onChanged={load} />
            )}
            {tab === "communications" && (
              <Communications />
            )}
            {tab === "emr" && (
              <EMR />
            )}
            {tab === "profile" && (
              <AdminProfile
                user={user}
                profile={profile}
                setProfile={setProfile}
                updateProfile={updateProfile}
                handleProfileImageUpload={handleProfileImageUpload}
                passwordForm={passwordForm}
                setPasswordForm={setPasswordForm}
                changePassword={changePassword}
                newUser={newUser}
                setNewUser={setNewUser}
                addUser={addUser}
                userSearch={userSearch}
                setUserSearch={setUserSearch}
                roleFilter={roleFilter}
                setRoleFilter={setRoleFilter}
                filteredUsers={filteredUsers}
                toggleUserStatus={toggleUserStatus}
                deleteUser={deleteUser}
                permissions={permissions}
                permissionCatalog={permissionCatalog}
                manageableRoles={manageableRoles}
                updateUserPermissions={updateUserPermissions}
              />
            )}
        </Suspense>
      </AppLayout>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
