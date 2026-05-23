import React, { useEffect, useMemo, useState } from "react";
import { portalApi } from "../api";

function fmtDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function fmtMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function StatusBadge({ status }) {
  const clean = String(status || "active").replaceAll("_", " ");
  return <span className={`statusPill status-${String(status || "active").toLowerCase()}`}>{clean}</span>;
}

function TabButton({ active, children, onClick }) {
  return <button type="button" className={`portalTab ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function Empty({ children }) {
  return <div className="emptyState">{children}</div>;
}

function PortalList({ items = [], render, empty }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return items.map(render);
}

export default function PatientPortal({ user, patients = [] }) {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");

  const canSelectPatient = ["super_admin", "admin", "hospital_admin", "receptionist", "nurse"].includes(user?.role);

  async function load(patientId = selectedPatientId) {
    setLoading(true);
    setError("");
    try {
      const { data: response } = await portalApi.patient(patientId ? { patient_id: patientId } : {});
      setData(response);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load patient portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canSelectPatient && patients.length && !selectedPatientId) {
      const first = patients[0]?.id || patients[0]?.patient_id || "";
      setSelectedPatientId(String(first));
      load(first);
    } else {
      load("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients.length, canSelectPatient]);

  const summary = data?.summary || {};
  const patient = data?.patient;
  const access = data?.access || {};
  const upcoming = useMemo(() => (data?.appointments || []).filter((a) => ["scheduled", "checked_in", "in_consultation"].includes(a.status || "scheduled")).slice(0, 8), [data]);
  const reportDocs = useMemo(() => (data?.documentVault || []).filter((d) => ["lab_report", "radiology_report", "patient_document"].includes(d.source)).slice(0, 12), [data]);
  const pendingBills = useMemo(() => (data?.bills || []).filter((b) => ["pending", "unpaid", "partial"].includes(String(b.payment_status || b.status || "").toLowerCase()) || Number(b.due_amount || 0) > 0), [data]);

  return (
    <section className="portalPage">
      <div className="portalHero card">
        <div>
          <p className="eyebrow">PATIENT PORTAL</p>
          <h2>{patient?.full_name || "My Health Records"}</h2>
          <p className="muted">Secure self-service view for appointments, OPD records, prescriptions, reports, bills and documents.</p>
          {access.own_data_only && <p className="portalSecureNote">Own-data isolation enabled: this login can only view the linked patient profile.</p>}
        </div>
        <div className="portalHeroActions">
          {canSelectPatient && (
            <select value={selectedPatientId} onChange={(e) => { setSelectedPatientId(e.target.value); load(e.target.value); }}>
              <option value="">Select patient / try auto-link from login</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.patient_id || p.id}</option>)}
            </select>
          )}
          <button type="button" className="ghostBtn" disabled={loading} onClick={() => load()}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="card emptyState dangerText">{error}</div>}

      {!patient ? (
        <div className="card emptyState">{data?.message || "No patient profile is linked yet. Admin/staff can select a patient above, or create/link a patient using matching email, phone or user ID."}</div>
      ) : (
        <>
          <div className="portalProfile card">
            <div className="portalAvatar">{patient.profile_image_url ? <img src={patient.profile_image_url} alt={patient.full_name} /> : <span>{(patient.full_name || "P").slice(0, 1)}</span>}</div>
            <div>
              <h2>{patient.full_name}</h2>
              <p className="muted">Patient ID: {patient.patient_id || patient.id} · {patient.gender || "--"} · {patient.blood_group || "Blood group not added"}</p>
              <div className="profileMiniGrid">
                <span>Phone <b>{patient.phone || "--"}</b></span>
                <span>Email <b>{patient.email || "--"}</b></span>
                <span>Age <b>{patient.age || "--"}</b></span>
                <span>Emergency <b>{patient.emergency_contact_phone || "--"}</b></span>
              </div>
            </div>
            <StatusBadge status={patient.status || "active"} />
          </div>

          <div className="portalStatsGrid">
            <div className="card portalStat"><span>Appointments</span><strong>{summary.appointments || 0}</strong><small>{summary.upcomingAppointments || 0} upcoming</small></div>
            <div className="card portalStat"><span>Prescriptions / OPD</span><strong>{summary.prescriptions || 0}</strong><small>{summary.opdVisits || 0} OPD visits</small></div>
            <div className="card portalStat"><span>Ready Reports</span><strong>{summary.readyReports || 0}</strong><small>{(summary.labReports || 0) + (summary.radiologyReports || 0)} total</small></div>
            <div className="card portalStat"><span>Outstanding</span><strong>{fmtMoney(summary.outstandingAmount || 0)}</strong><small>{summary.pendingBills || 0} pending bills</small></div>
          </div>

          <div className="card portalTabsCard">
            <div className="portalTabs">
              <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
              <TabButton active={activeTab === "appointments"} onClick={() => setActiveTab("appointments")}>Appointments</TabButton>
              <TabButton active={activeTab === "prescriptions"} onClick={() => setActiveTab("prescriptions")}>Prescriptions</TabButton>
              <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")}>Reports</TabButton>
              <TabButton active={activeTab === "bills"} onClick={() => setActiveTab("bills")}>Bills</TabButton>
              <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>Documents</TabButton>
              <TabButton active={activeTab === "timeline"} onClick={() => setActiveTab("timeline")}>Timeline</TabButton>
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="portalTwoCol">
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Upcoming Appointments</h2><span className="muted">{upcoming.length} active</span></div>
                <PortalList items={upcoming} empty="No upcoming appointments." render={(a) => (
                  <article className="portalListItem" key={a.id || a._id}>
                    <div><strong>{a.doctor_name || a.doctor_id || "Doctor"}</strong><small>{a.appointment_date} · {a.appointment_time || "--"}</small></div>
                    <StatusBadge status={a.status || "scheduled"} />
                  </article>
                )} />
              </div>
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Recent Reports & Documents</h2><span className="muted">{summary.documents || 0} available</span></div>
                <PortalList items={reportDocs.slice(0, 8)} empty="No uploaded reports/documents yet." render={(doc, index) => (
                  <article className="portalListItem" key={`${doc.source}-${doc.record_id || index}`}>
                    <div><strong>{doc.title}</strong><small>{doc.category || doc.source} · {fmtDate(doc.uploaded_at)}</small></div>
                    {doc.url ? <a className="miniAction" href={doc.url} target="_blank" rel="noreferrer">Open</a> : <span className="muted">Saved</span>}
                  </article>
                )} />
              </div>
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Appointments</h2><span className="muted">{summary.appointments || 0} records</span></div>
              <PortalList items={data.appointments || []} empty="No appointments found." render={(a) => (
                <article className="portalListItem" key={a.id || `${a.appointment_date}-${a.appointment_time}`}>
                  <div><strong>{a.appointment_type || "Appointment"} with {a.doctor_name || a.doctor_id || "Doctor"}</strong><small>{a.appointment_date || "--"} · {a.appointment_time || "--"} · Token {a.token_number || "--"}</small></div>
                  <StatusBadge status={a.status || "scheduled"} />
                </article>
              )} />
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="portalTwoCol">
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Prescriptions</h2><span className="muted">{summary.prescriptions || 0}</span></div>
                <PortalList items={data.prescriptions || []} empty="No prescriptions found." render={(p) => (
                  <article className="portalListItem" key={p.id || p.prescription_number}>
                    <div><strong>{p.prescription_number || `Prescription #${p.id}`}</strong><small>{fmtDate(p.created_at)} · Doctor {p.doctor_id || "--"}</small></div>
                    <StatusBadge status={p.status || "active"} />
                  </article>
                )} />
              </div>
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>OPD Records</h2><span className="muted">{summary.opdVisits || 0}</span></div>
                <PortalList items={data.opdRecords || []} empty="No OPD records found." render={(r) => (
                  <article className="portalListItem" key={r.id || r.visit_date}>
                    <div><strong>{r.final_diagnosis || r.provisional_diagnosis || "OPD Consultation"}</strong><small>{r.visit_date || fmtDate(r.created_at)} · {r.advice || r.treatment_plan || "Clinical record"}</small></div>
                    <StatusBadge status={r.status || "completed"} />
                  </article>
                )} />
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="portalTwoCol">
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Lab Reports</h2><span className="muted">{summary.labReports || 0}</span></div>
                <PortalList items={data.labReports || []} empty="No lab reports found." render={(r) => (
                  <article className="portalListItem" key={r.id || r.accession_number}>
                    <div><strong>{r.test_name || "Lab Test"}</strong><small>{r.accession_number || "--"} · {fmtDate(r.approved_at || r.completed_at || r.created_at)}</small></div>
                    {r.report_pdf_url || r.report_file ? <a className="miniAction" href={r.report_pdf_url || r.report_file} target="_blank" rel="noreferrer">Open</a> : <StatusBadge status={r.test_status || "ordered"} />}
                  </article>
                )} />
              </div>
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Radiology Reports</h2><span className="muted">{summary.radiologyReports || 0}</span></div>
                <PortalList items={data.radiologyReports || []} empty="No radiology reports found." render={(r) => (
                  <article className="portalListItem" key={r.id || r.accession_number}>
                    <div><strong>{r.scan_name || "Radiology Scan"}</strong><small>{r.modality || "--"} · {fmtDate(r.approved_at || r.reported_at || r.created_at)}</small></div>
                    {r.report_pdf_url || r.report_file || r.pacs_viewer_url ? <a className="miniAction" href={r.report_pdf_url || r.report_file || r.pacs_viewer_url} target="_blank" rel="noreferrer">Open</a> : <StatusBadge status={r.status || "ordered"} />}
                  </article>
                )} />
              </div>
            </div>
          )}

          {activeTab === "bills" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Bills & Receipts</h2><span className="muted">Outstanding {fmtMoney(summary.outstandingAmount || 0)}</span></div>
              <PortalList items={data.bills || []} empty="No bills found." render={(b) => (
                <article className="portalListItem" key={b.id || b.invoice_number}>
                  <div><strong>{b.invoice_number || `Bill #${b.id}`}</strong><small>Total {fmtMoney(b.total_amount || b.amount)} · Paid {fmtMoney(b.paid_amount)} · Due {fmtMoney(b.due_amount)}</small></div>
                  <StatusBadge status={b.payment_status || b.status || "pending"} />
                </article>
              )} />
              {!!pendingBills.length && <div className="portalSecureNote">Payment collection is intentionally not enabled in this phase; this view safely shows bill status only.</div>}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Document Vault</h2><span className="muted">{access.downloadable_documents || 0} openable</span></div>
              <PortalList items={data.documentVault || []} empty="No portal documents found." render={(doc, index) => (
                <article className="portalListItem" key={`${doc.source}-${doc.record_id || index}`}>
                  <div><strong>{doc.title}</strong><small>{doc.source.replaceAll("_", " ")} · {doc.category || "document"} · {fmtDate(doc.uploaded_at)}</small></div>
                  {doc.url ? <a className="miniAction" href={doc.url} target="_blank" rel="noreferrer">Open</a> : <span className="muted">No file</span>}
                </article>
              )} />
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Medical Timeline</h2><span className="muted">Latest records</span></div>
              <div className="portalTimeline">
                {(data.timeline || []).slice(0, 40).map((item, index) => (
                  <article key={`${item.type}-${index}`} className="timelineItem">
                    <span className="timelineDot" />
                    <div><strong>{item.title}</strong><small>{item.type} · {fmtDate(item.date)}</small></div>
                    <StatusBadge status={item.status || item.type} />
                  </article>
                ))}
                {!(data.timeline || []).length && <Empty>No timeline records yet.</Empty>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
