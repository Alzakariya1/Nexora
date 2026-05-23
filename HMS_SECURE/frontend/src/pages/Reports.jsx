import React, { useEffect, useState } from 'react';
import { reportApi } from '../api';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="card h-100 border-0 shadow-sm">
      <div className="card-body">
        <div className="text-muted small">{label}</div>
        <div className="fs-3 fw-bold">{value ?? 0}</div>
        {hint ? <div className="small text-muted">{hint}</div> : null}
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows?.length ? rows.map((row, idx) => (
            <tr key={row.id || row.key || `${row.date || row.status || row.service_type || 'row'}-${idx}`}>
              {columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="text-muted text-center py-3">{emptyText || 'No report data available.'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(addDaysIso(-29));
  const [to, setTo] = useState(todayIso());
  const [activeTab, setActiveTab] = useState('patients');
  const [loading, setLoading] = useState(false);
  const [patientReport, setPatientReport] = useState(null);
  const [revenueReport, setRevenueReport] = useState(null);
  const [operationsReport, setOperationsReport] = useState(null);
  const [executiveReport, setExecutiveReport] = useState(null);
  const [error, setError] = useState('');

  async function loadReport(tab = activeTab) {
    setLoading(true);
    setError('');
    try {
      if (tab === 'revenue') {
        const { data } = await reportApi.getRevenueBillingReports({ from, to });
        setRevenueReport(data);
      } else if (tab === 'operations') {
        const { data } = await reportApi.getPharmacyLabIpdReports({ from, to });
        setOperationsReport(data);
      } else if (tab === 'executive') {
        const { data } = await reportApi.getExecutiveCommandCenter({ from, to });
        setExecutiveReport(data);
      } else {
        const { data } = await reportApi.getPatientAppointmentReports({ from, to });
        setPatientReport(data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
    if ((tab === 'revenue' && !revenueReport) || (tab === 'operations' && !operationsReport) || (tab === 'executive' && !executiveReport) || (tab === 'patients' && !patientReport)) {
      loadReport(tab);
    }
  }

  useEffect(() => {
    loadReport('patients');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = patientReport?.summary || {};
  const revenueSummary = revenueReport?.summary || {};
  const operationsSummary = operationsReport?.summary || {};
  const executiveSummary = executiveReport?.summary || {};

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div>
          <h2 className="mb-1">Reports & Analytics</h2>
          <div className="text-muted">Tenant-safe operational and financial reports for hospital admins.</div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <label className="form-label small mb-0">From
            <input className="form-control form-control-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="form-label small mb-0">To
            <input className="form-control form-control-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => loadReport(activeTab)} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        <li className="nav-item"><button className={`nav-link ${activeTab === 'patients' ? 'active' : ''}`} onClick={() => switchTab('patients')}>Patients & Appointments</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'revenue' ? 'active' : ''}`} onClick={() => switchTab('revenue')}>Revenue & Billing</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => switchTab('operations')}>Pharmacy, Lab & IPD</button></li>
        <li className="nav-item"><button className={`nav-link ${activeTab === 'executive' ? 'active' : ''}`} onClick={() => switchTab('executive')}>Executive Command Center</button></li>
      </ul>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {activeTab === 'executive' ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-xl-2"><MetricCard label="Footfall" value={executiveSummary.patient_footfall} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Appointments" value={executiveSummary.appointments} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Revenue" value={money(executiveSummary.gross_revenue)} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Outstanding" value={money(executiveSummary.outstanding)} hint={`${executiveSummary.collection_rate || 0}% collected`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Occupancy" value={`${executiveSummary.bed_occupancy_rate || 0}%`} hint={`${executiveSummary.occupied_beds || 0}/${executiveSummary.total_beds || 0}`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Pending Work" value={(executiveSummary.pending_lab_tests || 0) + (executiveSummary.pending_radiology_tests || 0)} hint={`${executiveSummary.low_stock_items || 0} low stock`} /></div>
          </div>
          {executiveReport?.executive_flags?.finance_attention || executiveReport?.executive_flags?.occupancy_attention || executiveReport?.executive_flags?.diagnostics_attention || executiveReport?.executive_flags?.pharmacy_attention ? (
            <div className="alert alert-warning small">Executive attention suggested for finance, occupancy, diagnostics or pharmacy signals.</div>
          ) : null}
          <div className="row g-3">
            <div className="col-lg-7"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">KPI Trend</div><div className="card-body"><SimpleTable columns={[{ key: 'date', label: 'Date' }, { key: 'footfall', label: 'Footfall' }, { key: 'appointments', label: 'Appointments' }, { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }, { key: 'admissions', label: 'Admissions' }]} rows={executiveReport?.trend || []} /></div></div></div>
            <div className="col-lg-5"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Pending Work Alerts</div><div className="card-body"><SimpleTable columns={[{ key: 'label', label: 'Signal' }, { key: 'severity', label: 'Severity' }, { key: 'count', label: 'Value' }]} rows={executiveReport?.pending_work_alerts || []} /></div></div></div>
            <div className="col-12"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Department Performance</div><div className="card-body"><SimpleTable columns={[{ key: 'department_name', label: 'Department' }, { key: 'appointments', label: 'Appointments' }, { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }]} rows={executiveReport?.department_performance || []} /></div></div></div>
          </div>
        </>
      ) : activeTab === 'patients' ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-xl-2"><MetricCard label="New Registrations" value={summary.patient_registrations} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Appointments" value={summary.total_appointments} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Completed" value={summary.completed_appointments} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Cancelled" value={summary.cancelled_appointments} hint={`${summary.cancellation_rate || 0}%`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="No-show" value={summary.no_show_appointments} hint={`${summary.no_show_rate || 0}%`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Avg Wait" value={`${summary.average_waiting_minutes || 0}m`} hint={`${summary.waiting_samples || 0} samples`} /></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Doctor-wise Appointments</div>
                <div className="card-body">
                  <SimpleTable columns={[{ key: 'doctor_name', label: 'Doctor' }, { key: 'total', label: 'Total' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'no_show', label: 'No-show' }, { key: 'completion_rate', label: 'Completion %', render: (r) => `${r.completion_rate || 0}%` }]} rows={patientReport?.doctor_wise_appointments || []} />
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Department-wise Patients</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'department_name', label: 'Department' }, { key: 'unique_patients', label: 'Patients' }, { key: 'appointments', label: 'Appointments' }]} rows={patientReport?.department_wise_patients || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Daily Registration & Appointment Trend</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'date', label: 'Date' }, { key: 'registrations', label: 'Registrations' }, { key: 'appointments', label: 'Appointments' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'no_show', label: 'No-show' }]} rows={patientReport?.daily || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Appointment Status Mix</div>
                <div className="card-body">
                  <SimpleTable columns={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }, { key: 'percentage', label: 'Share', render: (r) => `${r.percentage || 0}%` }]} rows={patientReport?.appointment_statuses || []} />
                  <div className="small text-muted mt-3">Repeat patients are estimated from patients with more than one appointment in the selected period.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'operations' ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-xl-2"><MetricCard label="Low Stock" value={operationsSummary.low_stock_items} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Expiring Soon" value={operationsSummary.expiring_soon_items} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Lab Pending" value={operationsSummary.pending_lab_tests} hint={`${operationsSummary.average_lab_tat_hours || 0}h avg TAT`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Radiology Pending" value={operationsSummary.pending_radiology_tests} hint={`${operationsSummary.average_radiology_tat_hours || 0}h avg TAT`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Bed Occupancy" value={`${operationsSummary.bed_occupancy_rate || 0}%`} hint={`${operationsSummary.occupied_beds || 0}/${operationsSummary.total_beds || 0}`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Avg LOS" value={`${operationsSummary.average_length_of_stay_days || 0}d`} hint={`${operationsSummary.discharges || 0} discharges`} /></div>
          </div>

          {operationsReport?.risk_flags?.low_stock_attention || operationsReport?.risk_flags?.expiry_attention || operationsReport?.risk_flags?.lab_backlog_attention || operationsReport?.risk_flags?.high_occupancy_attention ? (
            <div className="alert alert-warning small">Operational review suggested for stock, expiry, backlog or occupancy signals.</div>
          ) : null}

          <div className="row g-3">
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Low Stock Medicines</div><div className="card-body"><SimpleTable columns={[{ key: 'name', label: 'Medicine' }, { key: 'batch_number', label: 'Batch' }, { key: 'stock', label: 'Stock' }, { key: 'threshold', label: 'Threshold' }]} rows={operationsReport?.pharmacy?.low_stock || []} /></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Fast-moving Medicines</div><div className="card-body"><SimpleTable columns={[{ key: 'medicine_name', label: 'Medicine' }, { key: 'quantity_sold', label: 'Qty Sold' }, { key: 'sales_count', label: 'Sales' }, { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }]} rows={operationsReport?.pharmacy?.fast_moving_medicines || []} /></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Lab Category Summary</div><div className="card-body"><SimpleTable columns={[{ key: 'category', label: 'Category' }, { key: 'total', label: 'Total' }, { key: 'pending', label: 'Pending' }, { key: 'completed', label: 'Completed' }]} rows={operationsReport?.lab?.category_summary || []} /></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Radiology Modality Summary</div><div className="card-body"><SimpleTable columns={[{ key: 'modality', label: 'Modality' }, { key: 'total', label: 'Total' }, { key: 'pending', label: 'Pending' }, { key: 'completed', label: 'Completed' }]} rows={operationsReport?.radiology?.modality_summary || []} /></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Ward Occupancy</div><div className="card-body"><SimpleTable columns={[{ key: 'ward', label: 'Ward' }, { key: 'total_beds', label: 'Beds' }, { key: 'occupied', label: 'Occupied' }, { key: 'available', label: 'Available' }, { key: 'occupancy_rate', label: 'Occupancy', render: (r) => `${r.occupancy_rate || 0}%` }]} rows={operationsReport?.ipd?.ward_occupancy || []} /></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white fw-semibold">Admission / Discharge Trend</div><div className="card-body"><SimpleTable columns={[{ key: 'date', label: 'Date' }, { key: 'admissions', label: 'Admissions' }, { key: 'discharges', label: 'Discharges' }]} rows={operationsReport?.ipd?.admission_discharge_daily || []} /></div></div></div>
          </div>
        </>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-xl-2"><MetricCard label="Invoices" value={revenueSummary.invoices} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Gross Revenue" value={money(revenueSummary.gross_revenue)} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Collected" value={money(revenueSummary.collected)} hint={`${revenueSummary.collection_rate || 0}% collected`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Outstanding" value={money(revenueSummary.outstanding)} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Discounts" value={money(revenueSummary.discounts)} hint={`${revenueSummary.discount_rate || 0}%`} /></div>
            <div className="col-6 col-xl-2"><MetricCard label="Refunds" value={money(revenueSummary.refunds)} hint={`${revenueSummary.refund_rate || 0}%`} /></div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-4"><MetricCard label="Lifetime Outstanding" value={money(revenueSummary.lifetime_outstanding)} /></div>
            <div className="col-md-4"><MetricCard label="Insurance Outstanding" value={money(revenueSummary.insurance_outstanding)} hint={`${revenueSummary.insurance_claims_open || 0} open claims`} /></div>
            <div className="col-md-4"><MetricCard label="Net Revenue" value={money(revenueSummary.net_revenue)} hint={`Tax ${money(revenueSummary.tax)}`} /></div>
          </div>

          {revenueReport?.risk_flags?.high_outstanding || revenueReport?.risk_flags?.discount_review_required || revenueReport?.risk_flags?.refund_monitoring_required ? (
            <div className="alert alert-warning small">Finance review suggested for high outstanding, discounts or refund signals in the selected report period.</div>
          ) : null}

          <div className="row g-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Daily Revenue Trend</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'date', label: 'Date' }, { key: 'invoices', label: 'Invoices' }, { key: 'gross_revenue', label: 'Gross', render: (r) => money(r.gross_revenue) }, { key: 'collected', label: 'Collected', render: (r) => money(r.collected) }, { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) }, { key: 'refunds', label: 'Refunds', render: (r) => money(r.refunds) }]} rows={revenueReport?.daily_revenue || []} /></div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Payment Mode Report</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'payment_mode', label: 'Mode' }, { key: 'invoices', label: 'Invoices' }, { key: 'collected', label: 'Collected', render: (r) => money(r.collected) }, { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) }]} rows={revenueReport?.payment_modes || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Department-wise Revenue</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'department_name', label: 'Department' }, { key: 'invoices', label: 'Invoices' }, { key: 'gross_revenue', label: 'Gross', render: (r) => money(r.gross_revenue) }, { key: 'collected', label: 'Collected', render: (r) => money(r.collected) }]} rows={revenueReport?.department_wise_revenue || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Doctor-wise Revenue</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'doctor_name', label: 'Doctor' }, { key: 'invoices', label: 'Invoices' }, { key: 'gross_revenue', label: 'Gross', render: (r) => money(r.gross_revenue) }, { key: 'outstanding', label: 'Outstanding', render: (r) => money(r.outstanding) }]} rows={revenueReport?.doctor_wise_revenue || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Service Type Revenue</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'service_type', label: 'Service' }, { key: 'invoices', label: 'Invoices' }, { key: 'gross_revenue', label: 'Gross', render: (r) => money(r.gross_revenue) }, { key: 'collected', label: 'Collected', render: (r) => money(r.collected) }]} rows={revenueReport?.service_type_revenue || []} /></div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">Payment Status Mix</div>
                <div className="card-body"><SimpleTable columns={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }, { key: 'percentage', label: 'Share', render: (r) => `${r.percentage || 0}%` }]} rows={revenueReport?.payment_statuses || []} /></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
