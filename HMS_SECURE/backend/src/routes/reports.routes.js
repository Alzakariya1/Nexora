const express = require('express');
const { Patient, Appointment, Doctor, Department, Billing, InsuranceClaim, Medicine, PharmacySale, LabTest, RadiologyTest, Bed, IpdAdmission } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter } = require('../middleware/tenant');

const router = express.Router();
router.use(verifyToken, attachTenant);

function parseDate(value, fallback) {
  const raw = value ? String(value).slice(0, 10) : fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function toStartDate(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function toEndDate(dateString) {
  return new Date(`${dateString}T23:59:59.999Z`);
}

function addDays(dateString, days) {
  const date = toStartDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRange(from, to) {
  const days = [];
  let current = from;
  while (current <= to && days.length <= 370) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Math.round((e - s) / 60000);
}

function pct(part, total) {
  return total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0;
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeStatus(value) {
  return String(value || 'scheduled').toLowerCase();
}

router.get('/reports/patients-appointments', requirePermission('analytics.view'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = addDays(today, -29);
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, today);
  if (from > to) return res.status(400).json({ message: 'from date must be before or equal to to date' });

  const patientFilter = tenantFilter(req, {
    status: { $ne: 'archived' },
    deleted_at: { $exists: false },
  });
  const appointmentFilter = tenantFilter(req, {
    appointment_date: { $gte: from, $lte: to },
    status: { $ne: 'archived' },
  });

  const [patients, periodPatients, appointments, doctors, departments] = await Promise.all([
    Patient.find(patientFilter).select('id patient_id full_name created_at status').lean(),
    Patient.find(tenantFilter(req, {
      status: { $ne: 'archived' },
      deleted_at: { $exists: false },
      created_at: { $gte: toStartDate(from), $lte: toEndDate(to) },
    })).select('id patient_id full_name created_at').lean(),
    Appointment.find(appointmentFilter).select('id patient_id doctor_id appointment_date appointment_time appointment_type status checked_in_at consultation_started_at completed_at cancelled_at created_at').lean(),
    Doctor.find(tenantFilter(req, { status: { $ne: 'archived' }, deleted_at: { $exists: false } })).select('id doctor_id full_name department_id specialization').lean(),
    Department.find(tenantFilter(req)).select('id department_name name').lean(),
  ]);

  const patientById = new Map();
  patients.forEach((patient) => {
    if (patient.patient_id) patientById.set(String(patient.patient_id), patient);
    if (patient.id) patientById.set(String(patient.id), patient);
  });
  const doctorById = new Map();
  doctors.forEach((doctor) => {
    if (doctor.doctor_id) doctorById.set(String(doctor.doctor_id), doctor);
    if (doctor.id) doctorById.set(String(doctor.id), doctor);
  });
  const departmentById = new Map(departments.map((department) => [Number(department.id), department.department_name || department.name || `Department ${department.id}`]));

  const dailyMap = Object.fromEntries(dateRange(from, to).map((date) => [date, { date, registrations: 0, appointments: 0, completed: 0, cancelled: 0, no_show: 0 }]));
  periodPatients.forEach((patient) => {
    const day = patient.created_at ? new Date(patient.created_at).toISOString().slice(0, 10) : null;
    if (day && dailyMap[day]) dailyMap[day].registrations += 1;
  });

  const doctorStats = new Map();
  const departmentStats = new Map();
  const statusCounts = {};
  let waitingTotal = 0;
  let waitingCount = 0;
  const uniqueAppointmentPatients = new Set();
  const repeatPatients = new Set();
  const appointmentCountByPatient = new Map();

  appointments.forEach((appointment) => {
    const day = appointment.appointment_date;
    const status = normalizeStatus(appointment.status);
    if (dailyMap[day]) {
      dailyMap[day].appointments += 1;
      if (status === 'completed') dailyMap[day].completed += 1;
      if (status === 'cancelled') dailyMap[day].cancelled += 1;
      if (status === 'no_show') dailyMap[day].no_show += 1;
    }
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const patientKey = String(appointment.patient_id || '');
    if (patientKey) {
      uniqueAppointmentPatients.add(patientKey);
      const nextCount = (appointmentCountByPatient.get(patientKey) || 0) + 1;
      appointmentCountByPatient.set(patientKey, nextCount);
      if (nextCount > 1) repeatPatients.add(patientKey);
    }

    const doctorKey = String(appointment.doctor_id || 'unassigned');
    const doctor = doctorById.get(doctorKey);
    if (!doctorStats.has(doctorKey)) {
      doctorStats.set(doctorKey, { doctor_id: doctorKey, doctor_name: doctor?.full_name || 'Unassigned', total: 0, completed: 0, cancelled: 0, no_show: 0 });
    }
    const docStat = doctorStats.get(doctorKey);
    docStat.total += 1;
    if (status === 'completed') docStat.completed += 1;
    if (status === 'cancelled') docStat.cancelled += 1;
    if (status === 'no_show') docStat.no_show += 1;

    const departmentId = Number(doctor?.department_id || 0);
    const departmentKey = departmentId || 'unassigned';
    if (!departmentStats.has(departmentKey)) {
      departmentStats.set(departmentKey, { department_id: departmentId || null, department_name: departmentById.get(departmentId) || 'Unassigned', total: 0, unique_patients: new Set() });
    }
    const depStat = departmentStats.get(departmentKey);
    depStat.total += 1;
    if (patientKey) depStat.unique_patients.add(patientKey);

    const wait = minutesBetween(appointment.checked_in_at, appointment.consultation_started_at || appointment.completed_at);
    if (wait !== null) {
      waitingTotal += wait;
      waitingCount += 1;
    }
  });

  const totalAppointments = appointments.length;
  const newPatientKeys = new Set(periodPatients.flatMap((p) => [p.patient_id, p.id].filter(Boolean).map(String)));
  const newAppointmentPatients = Array.from(uniqueAppointmentPatients).filter((key) => newPatientKeys.has(key)).length;

  res.json({
    period: { from, to },
    summary: {
      patient_registrations: periodPatients.length,
      unique_appointment_patients: uniqueAppointmentPatients.size,
      new_appointment_patients: newAppointmentPatients,
      repeat_appointment_patients: repeatPatients.size,
      total_appointments: totalAppointments,
      completed_appointments: statusCounts.completed || 0,
      cancelled_appointments: statusCounts.cancelled || 0,
      no_show_appointments: statusCounts.no_show || 0,
      cancellation_rate: pct(statusCounts.cancelled || 0, totalAppointments),
      no_show_rate: pct(statusCounts.no_show || 0, totalAppointments),
      average_waiting_minutes: waitingCount ? Math.round(waitingTotal / waitingCount) : 0,
      waiting_samples: waitingCount,
    },
    daily: Object.values(dailyMap),
    appointment_statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count, percentage: pct(count, totalAppointments) })).sort((a, b) => b.count - a.count),
    doctor_wise_appointments: Array.from(doctorStats.values()).map((row) => ({ ...row, completion_rate: pct(row.completed, row.total), cancellation_rate: pct(row.cancelled, row.total), no_show_rate: pct(row.no_show, row.total) })).sort((a, b) => b.total - a.total),
    department_wise_patients: Array.from(departmentStats.values()).map((row) => ({ department_id: row.department_id, department_name: row.department_name, appointments: row.total, unique_patients: row.unique_patients.size })).sort((a, b) => b.appointments - a.appointments),
  });
}));


function normalizePaymentMode(value) {
  return String(value || 'unassigned').toLowerCase().trim() || 'unassigned';
}

function normalizeServiceType(value) {
  return String(value || 'other').toLowerCase().trim() || 'other';
}

function billDate(bill) {
  return bill.billing_date || bill.created_at || bill.updated_at || null;
}

function billDay(bill) {
  const d = billDate(bill);
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

function billTotal(bill) {
  return Number(bill.total_amount || bill.amount || 0);
}

function billPaid(bill) {
  return Number(bill.paid_amount || 0);
}

function billDue(bill) {
  const explicit = Number(bill.due_amount || 0);
  if (explicit > 0) return explicit;
  return Math.max(0, billTotal(bill) - billPaid(bill));
}

router.get('/reports/revenue-billing', requirePermission('analytics.view'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = addDays(today, -29);
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, today);
  if (from > to) return res.status(400).json({ message: 'from date must be before or equal to to date' });

  const activeFilter = tenantFilter(req, {
    is_archived: { $ne: true },
    status: { $ne: 'archived' },
    $or: [
      { billing_date: { $gte: toStartDate(from), $lte: toEndDate(to) } },
      { billing_date: { $exists: false }, created_at: { $gte: toStartDate(from), $lte: toEndDate(to) } },
    ],
  });

  const [bills, allOpenBills, doctors, departments, claims] = await Promise.all([
    Billing.find(activeFilter).select('id invoice_number patient_id doctor_id service_type billing_type payment_status status payment_mode total_amount amount paid_amount due_amount discount refund_amount gst_amount billing_date created_at items insurance_provider corporate_name').lean(),
    Billing.find(tenantFilter(req, { is_archived: { $ne: true }, status: { $ne: 'archived' } })).select('id total_amount amount paid_amount due_amount payment_status status billing_date created_at insurance_provider corporate_name').lean(),
    Doctor.find(tenantFilter(req, { status: { $ne: 'archived' }, deleted_at: { $exists: false } })).select('id doctor_id full_name department_id specialization').lean(),
    Department.find(tenantFilter(req)).select('id department_name name').lean(),
    InsuranceClaim.find(tenantFilter(req, { created_at: { $lte: toEndDate(to) } })).select('id claim_amount approved_amount paid_amount balance_amount status insurance_provider tpa_name created_at settled_at').lean(),
  ]);

  const doctorById = new Map();
  doctors.forEach((doctor) => {
    if (doctor.doctor_id) doctorById.set(String(doctor.doctor_id), doctor);
    if (doctor.id) doctorById.set(String(doctor.id), doctor);
  });
  const departmentById = new Map(departments.map((department) => [Number(department.id), department.department_name || department.name || `Department ${department.id}`]));

  const dailyMap = Object.fromEntries(dateRange(from, to).map((date) => [date, { date, invoices: 0, gross_revenue: 0, collected: 0, outstanding: 0, discounts: 0, refunds: 0 }]));
  const paymentModeMap = new Map();
  const serviceTypeMap = new Map();
  const doctorRevenueMap = new Map();
  const departmentRevenueMap = new Map();
  const statusCounts = {};

  let grossRevenue = 0;
  let collected = 0;
  let outstanding = 0;
  let discounts = 0;
  let refunds = 0;
  let tax = 0;

  bills.forEach((bill) => {
    const total = billTotal(bill);
    const paid = billPaid(bill);
    const due = billDue(bill);
    const discount = Number(bill.discount || 0);
    const refund = Number(bill.refund_amount || 0);
    const gst = Number(bill.gst_amount || 0);
    const status = normalizeStatus(bill.payment_status || bill.status);
    const day = billDay(bill);

    grossRevenue += total;
    collected += paid;
    outstanding += due;
    discounts += discount;
    refunds += refund;
    tax += gst;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (day && dailyMap[day]) {
      dailyMap[day].invoices += 1;
      dailyMap[day].gross_revenue = money(dailyMap[day].gross_revenue + total);
      dailyMap[day].collected = money(dailyMap[day].collected + paid);
      dailyMap[day].outstanding = money(dailyMap[day].outstanding + due);
      dailyMap[day].discounts = money(dailyMap[day].discounts + discount);
      dailyMap[day].refunds = money(dailyMap[day].refunds + refund);
    }

    const mode = normalizePaymentMode(bill.payment_mode);
    if (!paymentModeMap.has(mode)) paymentModeMap.set(mode, { payment_mode: mode, invoices: 0, collected: 0, gross_revenue: 0, outstanding: 0 });
    const modeRow = paymentModeMap.get(mode);
    modeRow.invoices += 1;
    modeRow.collected = money(modeRow.collected + paid);
    modeRow.gross_revenue = money(modeRow.gross_revenue + total);
    modeRow.outstanding = money(modeRow.outstanding + due);

    const service = normalizeServiceType(bill.service_type || bill.billing_type);
    if (!serviceTypeMap.has(service)) serviceTypeMap.set(service, { service_type: service, invoices: 0, gross_revenue: 0, collected: 0, outstanding: 0 });
    const serviceRow = serviceTypeMap.get(service);
    serviceRow.invoices += 1;
    serviceRow.gross_revenue = money(serviceRow.gross_revenue + total);
    serviceRow.collected = money(serviceRow.collected + paid);
    serviceRow.outstanding = money(serviceRow.outstanding + due);

    const doctorKey = String(bill.doctor_id || 'unassigned');
    const doctor = doctorById.get(doctorKey);
    if (!doctorRevenueMap.has(doctorKey)) doctorRevenueMap.set(doctorKey, { doctor_id: doctorKey, doctor_name: doctor?.full_name || 'Unassigned', invoices: 0, gross_revenue: 0, collected: 0, outstanding: 0 });
    const doctorRow = doctorRevenueMap.get(doctorKey);
    doctorRow.invoices += 1;
    doctorRow.gross_revenue = money(doctorRow.gross_revenue + total);
    doctorRow.collected = money(doctorRow.collected + paid);
    doctorRow.outstanding = money(doctorRow.outstanding + due);

    const departmentId = Number(doctor?.department_id || 0);
    const departmentKey = departmentId || 'unassigned';
    if (!departmentRevenueMap.has(departmentKey)) departmentRevenueMap.set(departmentKey, { department_id: departmentId || null, department_name: departmentById.get(departmentId) || (doctor ? 'Unassigned Department' : 'Unassigned'), invoices: 0, gross_revenue: 0, collected: 0, outstanding: 0 });
    const departmentRow = departmentRevenueMap.get(departmentKey);
    departmentRow.invoices += 1;
    departmentRow.gross_revenue = money(departmentRow.gross_revenue + total);
    departmentRow.collected = money(departmentRow.collected + paid);
    departmentRow.outstanding = money(departmentRow.outstanding + due);
  });

  const lifetimeOutstanding = allOpenBills.reduce((sum, bill) => {
    const status = normalizeStatus(bill.payment_status || bill.status);
    if (['paid', 'cancelled', 'refunded', 'archived'].includes(status)) return sum;
    return sum + billDue(bill);
  }, 0);
  const insuranceOutstanding = claims.reduce((sum, claim) => {
    const status = normalizeStatus(claim.status);
    if (['settled', 'closed', 'cancelled', 'rejected'].includes(status)) return sum;
    const balance = Number(claim.balance_amount || 0) || Math.max(0, Number(claim.approved_amount || claim.claim_amount || 0) - Number(claim.paid_amount || 0));
    return sum + balance;
  }, 0);

  const invoiceCount = bills.length;
  res.json({
    period: { from, to },
    summary: {
      invoices: invoiceCount,
      gross_revenue: money(grossRevenue),
      collected: money(collected),
      outstanding: money(outstanding),
      lifetime_outstanding: money(lifetimeOutstanding),
      discounts: money(discounts),
      refunds: money(refunds),
      tax: money(tax),
      net_revenue: money(grossRevenue - discounts - refunds),
      collection_rate: pct(collected, grossRevenue),
      discount_rate: pct(discounts, grossRevenue),
      refund_rate: pct(refunds, grossRevenue),
      insurance_outstanding: money(insuranceOutstanding),
      insurance_claims_open: claims.filter((claim) => !['settled', 'closed', 'cancelled', 'rejected'].includes(normalizeStatus(claim.status))).length,
    },
    daily_revenue: Object.values(dailyMap),
    payment_modes: Array.from(paymentModeMap.values()).sort((a, b) => b.collected - a.collected),
    service_type_revenue: Array.from(serviceTypeMap.values()).sort((a, b) => b.gross_revenue - a.gross_revenue),
    doctor_wise_revenue: Array.from(doctorRevenueMap.values()).sort((a, b) => b.gross_revenue - a.gross_revenue),
    department_wise_revenue: Array.from(departmentRevenueMap.values()).sort((a, b) => b.gross_revenue - a.gross_revenue),
    payment_statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count, percentage: pct(count, invoiceCount) })).sort((a, b) => b.count - a.count),
    risk_flags: {
      high_outstanding: lifetimeOutstanding > grossRevenue,
      refund_monitoring_required: pct(refunds, grossRevenue) > 10,
      discount_review_required: pct(discounts, grossRevenue) > 15,
    },
  });
}));


function stockQty(medicine) {
  return Number(medicine.stock ?? medicine.quantity ?? 0);
}

function safeDateValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hoursBetween(start, end) {
  const minutes = minutesBetween(start, end);
  return minutes === null ? null : Number((minutes / 60).toFixed(1));
}

function admissionStart(admission) {
  return admission.admission_date || admission.admitted_at || admission.created_at || null;
}

function admissionEnd(admission) {
  return admission.discharge_date || admission.discharged_at || admission.completed_at || null;
}

router.get('/reports/pharmacy-lab-ipd', requirePermission('analytics.view'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = addDays(today, -29);
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, today);
  if (from > to) return res.status(400).json({ message: 'from date must be before or equal to to date' });

  const fromDate = toStartDate(from);
  const toDate = toEndDate(to);
  const expiryWindow = addDays(today, 90);

  const [medicines, sales, labTests, radiologyTests, beds, admissions] = await Promise.all([
    Medicine.find(tenantFilter(req, { status: { $ne: 'archived' } })).select('id name generic_name category batch_number expiry_date quantity stock low_stock_threshold unit status').lean(),
    PharmacySale.find(tenantFilter(req, { sold_at: { $gte: fromDate, $lte: toDate } })).select('id medicine_id medicine_name quantity total_amount sold_at sale_type payment_status').lean(),
    LabTest.find(tenantFilter(req, { created_at: { $gte: fromDate, $lte: toDate } })).select('id test_name test_category priority test_status created_at sample_collected_at received_at processing_started_at completed_at approved_at result_parameters').lean(),
    RadiologyTest.find(tenantFilter(req, { created_at: { $gte: fromDate, $lte: toDate } })).select('id scan_name scan_category modality priority status created_at scheduled_at scanned_at reported_at approved_at').lean(),
    Bed.find(tenantFilter(req, {})).select('id ward bed_number status').lean(),
    IpdAdmission.find(tenantFilter(req, { $or: [
      { created_at: { $gte: fromDate, $lte: toDate } },
      { admission_date: { $gte: from, $lte: to } },
      { admitted_at: { $gte: fromDate, $lte: toDate } },
      { discharge_date: { $gte: from, $lte: to } },
      { discharged_at: { $gte: fromDate, $lte: toDate } },
    ] })).select('id patient_id doctor_id bed_id ward status admission_date admitted_at discharge_date discharged_at created_at completed_at').lean(),
  ]);

  const lowStock = medicines
    .filter((m) => stockQty(m) <= Number(m.low_stock_threshold ?? 10))
    .map((m) => ({ id: m.id, name: m.name, batch_number: m.batch_number || '', stock: stockQty(m), threshold: Number(m.low_stock_threshold ?? 10), unit: m.unit || 'pcs' }))
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));

  const expiredStock = medicines.filter((m) => m.expiry_date && m.expiry_date < today).length;
  const expiringSoon = medicines
    .filter((m) => m.expiry_date && m.expiry_date >= today && m.expiry_date <= expiryWindow)
    .map((m) => ({ id: m.id, name: m.name, batch_number: m.batch_number || '', expiry_date: m.expiry_date, stock: stockQty(m) }))
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));

  const fastMovingMap = new Map();
  sales.forEach((sale) => {
    const key = String(sale.medicine_id || sale.medicine_name || 'unknown');
    if (!fastMovingMap.has(key)) fastMovingMap.set(key, { medicine_id: sale.medicine_id || null, medicine_name: sale.medicine_name || 'Unknown', quantity_sold: 0, sales_count: 0, revenue: 0 });
    const row = fastMovingMap.get(key);
    row.quantity_sold += Number(sale.quantity || 0);
    row.sales_count += 1;
    row.revenue = money(row.revenue + Number(sale.total_amount || 0));
  });

  const labStatusCounts = {};
  const labCategoryMap = new Map();
  let labTatTotal = 0;
  let labTatCount = 0;
  let criticalLabResults = 0;
  labTests.forEach((test) => {
    const status = normalizeStatus(test.test_status);
    labStatusCounts[status] = (labStatusCounts[status] || 0) + 1;
    const category = test.test_category || 'General';
    if (!labCategoryMap.has(category)) labCategoryMap.set(category, { category, total: 0, pending: 0, completed: 0 });
    const cat = labCategoryMap.get(category);
    cat.total += 1;
    if (['ordered', 'collected', 'received', 'processing', 'pending'].includes(status)) cat.pending += 1;
    if (['completed', 'approved', 'reported'].includes(status)) cat.completed += 1;
    const tat = hoursBetween(test.sample_collected_at || test.received_at || test.created_at, test.approved_at || test.completed_at);
    if (tat !== null) { labTatTotal += tat; labTatCount += 1; }
    if (Array.isArray(test.result_parameters) && test.result_parameters.some((p) => p?.is_critical || String(p?.flag || '').toLowerCase() === 'critical')) criticalLabResults += 1;
  });

  const radiologyStatusCounts = {};
  const modalityMap = new Map();
  let radiologyTatTotal = 0;
  let radiologyTatCount = 0;
  radiologyTests.forEach((scan) => {
    const status = normalizeStatus(scan.status);
    radiologyStatusCounts[status] = (radiologyStatusCounts[status] || 0) + 1;
    const modality = scan.modality || 'UNKNOWN';
    if (!modalityMap.has(modality)) modalityMap.set(modality, { modality, total: 0, pending: 0, completed: 0 });
    const row = modalityMap.get(modality);
    row.total += 1;
    if (['ordered', 'scheduled', 'scanned', 'pending'].includes(status)) row.pending += 1;
    if (['reported', 'approved', 'completed'].includes(status)) row.completed += 1;
    const tat = hoursBetween(scan.scanned_at || scan.scheduled_at || scan.created_at, scan.approved_at || scan.reported_at);
    if (tat !== null) { radiologyTatTotal += tat; radiologyTatCount += 1; }
  });

  const bedStatusCounts = {};
  const wardMap = new Map();
  beds.forEach((bed) => {
    const status = normalizeStatus(bed.status || 'available');
    bedStatusCounts[status] = (bedStatusCounts[status] || 0) + 1;
    const ward = bed.ward || 'General';
    if (!wardMap.has(ward)) wardMap.set(ward, { ward, total_beds: 0, occupied: 0, available: 0, maintenance: 0 });
    const row = wardMap.get(ward);
    row.total_beds += 1;
    if (status === 'occupied') row.occupied += 1;
    if (status === 'available') row.available += 1;
    if (['maintenance', 'blocked', 'cleaning'].includes(status)) row.maintenance += 1;
  });

  let discharged = 0;
  let activeAdmissions = 0;
  let losTotal = 0;
  let losCount = 0;
  const admissionDaily = Object.fromEntries(dateRange(from, to).map((date) => [date, { date, admissions: 0, discharges: 0 }]));
  admissions.forEach((admission) => {
    const start = admissionStart(admission);
    const end = admissionEnd(admission);
    const startDay = start ? new Date(start).toISOString().slice(0, 10) : null;
    const endDay = end ? new Date(end).toISOString().slice(0, 10) : null;
    if (startDay && admissionDaily[startDay]) admissionDaily[startDay].admissions += 1;
    if (endDay && admissionDaily[endDay]) admissionDaily[endDay].discharges += 1;
    const status = normalizeStatus(admission.status);
    if (['discharged', 'completed', 'closed'].includes(status) || end) discharged += 1; else activeAdmissions += 1;
    const startTime = safeDateValue(start);
    const endTime = safeDateValue(end);
    if (startTime && endTime && endTime >= startTime) {
      losTotal += (endTime - startTime) / 86400000;
      losCount += 1;
    }
  });

  const totalBeds = beds.length;
  const occupiedBeds = bedStatusCounts.occupied || 0;
  const pendingLab = Object.entries(labStatusCounts).filter(([s]) => ['ordered', 'collected', 'received', 'processing', 'pending'].includes(s)).reduce((sum, [, c]) => sum + c, 0);
  const pendingRadiology = Object.entries(radiologyStatusCounts).filter(([s]) => ['ordered', 'scheduled', 'scanned', 'pending'].includes(s)).reduce((sum, [, c]) => sum + c, 0);

  res.json({
    period: { from, to },
    summary: {
      medicines: medicines.length,
      low_stock_items: lowStock.length,
      expired_stock_items: expiredStock,
      expiring_soon_items: expiringSoon.length,
      pharmacy_sales: sales.length,
      pharmacy_revenue: money(sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)),
      lab_tests: labTests.length,
      pending_lab_tests: pendingLab,
      critical_lab_results: criticalLabResults,
      average_lab_tat_hours: labTatCount ? Number((labTatTotal / labTatCount).toFixed(1)) : 0,
      radiology_tests: radiologyTests.length,
      pending_radiology_tests: pendingRadiology,
      average_radiology_tat_hours: radiologyTatCount ? Number((radiologyTatTotal / radiologyTatCount).toFixed(1)) : 0,
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      bed_occupancy_rate: pct(occupiedBeds, totalBeds),
      admissions: admissions.length,
      active_admissions: activeAdmissions,
      discharges: discharged,
      average_length_of_stay_days: losCount ? Number((losTotal / losCount).toFixed(1)) : 0,
    },
    pharmacy: {
      low_stock: lowStock.slice(0, 50),
      expiring_soon: expiringSoon.slice(0, 50),
      fast_moving_medicines: Array.from(fastMovingMap.values()).sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 20),
    },
    lab: {
      statuses: Object.entries(labStatusCounts).map(([status, count]) => ({ status, count, percentage: pct(count, labTests.length) })).sort((a, b) => b.count - a.count),
      category_summary: Array.from(labCategoryMap.values()).sort((a, b) => b.total - a.total),
    },
    radiology: {
      statuses: Object.entries(radiologyStatusCounts).map(([status, count]) => ({ status, count, percentage: pct(count, radiologyTests.length) })).sort((a, b) => b.count - a.count),
      modality_summary: Array.from(modalityMap.values()).sort((a, b) => b.total - a.total),
    },
    ipd: {
      bed_statuses: Object.entries(bedStatusCounts).map(([status, count]) => ({ status, count, percentage: pct(count, totalBeds) })).sort((a, b) => b.count - a.count),
      ward_occupancy: Array.from(wardMap.values()).map((row) => ({ ...row, occupancy_rate: pct(row.occupied, row.total_beds) })).sort((a, b) => b.occupancy_rate - a.occupancy_rate),
      admission_discharge_daily: Object.values(admissionDaily),
    },
    risk_flags: {
      low_stock_attention: lowStock.length > 0,
      expiry_attention: expiredStock > 0 || expiringSoon.length > 0,
      lab_backlog_attention: pendingLab > 0,
      radiology_backlog_attention: pendingRadiology > 0,
      high_occupancy_attention: pct(occupiedBeds, totalBeds) >= 85,
    },
  });
}));


router.get('/reports/executive-command-center', requirePermission('analytics.view'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = addDays(today, -29);
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, today);
  if (from > to) return res.status(400).json({ message: 'from date must be before or equal to to date' });

  const periodStart = toStartDate(from);
  const periodEnd = toEndDate(to);
  const [patients, appointments, bills, medicines, labTests, radiologyTests, beds, admissions, doctors, departments] = await Promise.all([
    Patient.find(tenantFilter(req, { status: { $ne: 'archived' }, deleted_at: { $exists: false }, created_at: { $gte: periodStart, $lte: periodEnd } })).select('id patient_id created_at').lean(),
    Appointment.find(tenantFilter(req, { appointment_date: { $gte: from, $lte: to }, status: { $ne: 'archived' } })).select('id patient_id doctor_id appointment_date status checked_in_at consultation_started_at completed_at').lean(),
    Billing.find(tenantFilter(req, { is_archived: { $ne: true }, status: { $ne: 'archived' }, $or: [{ billing_date: { $gte: periodStart, $lte: periodEnd } }, { billing_date: { $exists: false }, created_at: { $gte: periodStart, $lte: periodEnd } }] })).select('id doctor_id service_type payment_status status total_amount amount paid_amount due_amount discount refund_amount billing_date created_at').lean(),
    Medicine.find(tenantFilter(req, { status: { $ne: 'archived' } })).select('id name stock quantity min_stock reorder_level expiry_date').lean(),
    LabTest.find(tenantFilter(req, { created_at: { $gte: periodStart, $lte: periodEnd } })).select('id status result_parameters created_at').lean(),
    RadiologyTest.find(tenantFilter(req, { created_at: { $gte: periodStart, $lte: periodEnd } })).select('id status modality created_at').lean(),
    Bed.find(tenantFilter(req, { status: { $ne: 'archived' } })).select('id status ward').lean(),
    IpdAdmission.find(tenantFilter(req, { created_at: { $lte: periodEnd } })).select('id status admission_date discharge_date admitted_at discharged_at created_at').lean(),
    Doctor.find(tenantFilter(req, { status: { $ne: 'archived' }, deleted_at: { $exists: false } })).select('id doctor_id full_name department_id').lean(),
    Department.find(tenantFilter(req)).select('id department_name name').lean(),
  ]);

  const daily = Object.fromEntries(dateRange(from, to).map((date) => [date, { date, footfall: 0, revenue: 0, appointments: 0, admissions: 0 }]));
  patients.forEach((p) => { const d = p.created_at ? new Date(p.created_at).toISOString().slice(0,10) : null; if (daily[d]) daily[d].footfall += 1; });
  appointments.forEach((a) => { if (daily[a.appointment_date]) daily[a.appointment_date].appointments += 1; });
  bills.forEach((b) => { const d = billDay(b); if (daily[d]) daily[d].revenue += billTotal(b); });
  admissions.forEach((a) => { const d = admissionStart(a) ? new Date(admissionStart(a)).toISOString().slice(0,10) : null; if (daily[d]) daily[d].admissions += 1; });

  const grossRevenue = bills.reduce((sum, b) => sum + billTotal(b), 0);
  const collected = bills.reduce((sum, b) => sum + billPaid(b), 0);
  const outstanding = bills.reduce((sum, b) => sum + billDue(b), 0);
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => normalizeStatus(b.status) === 'occupied').length;
  const pendingLab = labTests.filter((t) => ['ordered','collected','received','processing','pending'].includes(normalizeStatus(t.status))).length;
  const pendingRadiology = radiologyTests.filter((t) => ['ordered','scheduled','scanned','pending'].includes(normalizeStatus(t.status))).length;
  const lowStock = medicines.filter((m) => Number(m.stock ?? m.quantity ?? 0) <= Number(m.min_stock ?? m.reorder_level ?? 0)).length;
  const criticalLabResults = labTests.filter((t) => Array.isArray(t.result_parameters) && t.result_parameters.some((p) => p?.is_critical || String(p?.flag || '').toLowerCase() === 'critical')).length;
  const cancelled = appointments.filter((a) => normalizeStatus(a.status) === 'cancelled').length;
  const noShow = appointments.filter((a) => normalizeStatus(a.status) === 'no_show').length;
  const completed = appointments.filter((a) => normalizeStatus(a.status) === 'completed').length;

  const doctorById = new Map();
  doctors.forEach((d) => { if (d.doctor_id) doctorById.set(String(d.doctor_id), d); if (d.id) doctorById.set(String(d.id), d); });
  const departmentById = new Map(departments.map((d) => [Number(d.id), d.department_name || d.name || `Department ${d.id}`]));
  const departmentMap = new Map();
  appointments.forEach((a) => {
    const doctor = doctorById.get(String(a.doctor_id || ''));
    const depId = Number(doctor?.department_id || 0);
    const key = depId || 'unassigned';
    if (!departmentMap.has(key)) departmentMap.set(key, { department_id: depId || null, department_name: departmentById.get(depId) || 'Unassigned', appointments: 0, revenue: 0 });
    departmentMap.get(key).appointments += 1;
  });
  bills.forEach((b) => {
    const doctor = doctorById.get(String(b.doctor_id || ''));
    const depId = Number(doctor?.department_id || 0);
    const key = depId || 'unassigned';
    if (!departmentMap.has(key)) departmentMap.set(key, { department_id: depId || null, department_name: departmentById.get(depId) || 'Unassigned', appointments: 0, revenue: 0 });
    departmentMap.get(key).revenue += billTotal(b);
  });

  const alerts = [
    { key: 'high_outstanding', label: 'Outstanding dues review', severity: outstanding > grossRevenue * 0.35 ? 'high' : outstanding > 0 ? 'medium' : 'low', count: money(outstanding) },
    { key: 'high_occupancy', label: 'Bed occupancy pressure', severity: pct(occupiedBeds, totalBeds) >= 85 ? 'high' : pct(occupiedBeds, totalBeds) >= 70 ? 'medium' : 'low', count: `${pct(occupiedBeds, totalBeds)}%` },
    { key: 'diagnostic_backlog', label: 'Lab/Radiology pending work', severity: pendingLab + pendingRadiology > 20 ? 'high' : pendingLab + pendingRadiology > 0 ? 'medium' : 'low', count: pendingLab + pendingRadiology },
    { key: 'stock_attention', label: 'Low stock items', severity: lowStock > 10 ? 'high' : lowStock > 0 ? 'medium' : 'low', count: lowStock },
    { key: 'critical_results', label: 'Critical lab results', severity: criticalLabResults > 0 ? 'high' : 'low', count: criticalLabResults },
  ];

  res.json({
    period: { from, to },
    summary: {
      patient_footfall: patients.length,
      appointments: appointments.length,
      completed_appointments: completed,
      cancellation_rate: pct(cancelled, appointments.length),
      no_show_rate: pct(noShow, appointments.length),
      gross_revenue: money(grossRevenue),
      collected: money(collected),
      outstanding: money(outstanding),
      collection_rate: pct(collected, grossRevenue),
      bed_occupancy_rate: pct(occupiedBeds, totalBeds),
      occupied_beds: occupiedBeds,
      total_beds: totalBeds,
      pending_lab_tests: pendingLab,
      pending_radiology_tests: pendingRadiology,
      low_stock_items: lowStock,
      active_admissions: admissions.filter((a) => !['discharged','completed','closed'].includes(normalizeStatus(a.status))).length,
    },
    trend: Object.values(daily).map((d) => ({ ...d, revenue: money(d.revenue) })),
    department_performance: Array.from(departmentMap.values()).map((r) => ({ ...r, revenue: money(r.revenue) })).sort((a,b) => (b.revenue + b.appointments) - (a.revenue + a.appointments)).slice(0, 20),
    pending_work_alerts: alerts,
    executive_flags: {
      finance_attention: outstanding > grossRevenue * 0.35,
      occupancy_attention: pct(occupiedBeds, totalBeds) >= 85,
      diagnostics_attention: pendingLab + pendingRadiology > 0,
      pharmacy_attention: lowStock > 0,
    },
  });
}));

module.exports = router;
