import React, { useEffect, useMemo, useState } from "react";
import { portalApi } from "../api";

function fmtDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function StatusBadge({ status }) {
  const clean = String(status || "active").replaceAll("_", " ");
  return <span className={`statusPill status-${String(status || "active").toLowerCase()}`}>{clean}</span>;
}

export default function PatientPortal({ user, patients = [] }) {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const canSelectPatient = ["super_admin", "admin", "hospital_admin", "receptionist", "nurse"].includes(user?.role);

  async function load(patientId = selectedPatientId) {
    setLoading(true);
    try {
      const { data: response } = await portalApi.patient(patientId ? { patient_id: patientId } : {});
      setData(response);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canSelectPatient && patients.length && !selectedPatientId) {
      const first = patients[0]?.id || patients[0]?.patient_id || '';
      setSelectedPatientId(String(first));
      load(first);
    } else {
      load('');
    }
  }, [patients.length]);

  const summary = data?.summary || {};
  const patient = data?.patient;
  const upcoming = useMemo(() => (data?.appointments || []).filter((a) => ["scheduled", "checked_in", "in_consultation"].includes(a.status || "scheduled")).slice(0, 8), [data]);

  return (
    <section className="portalPage">
      <div className="portalHero card">
        <div>
          <p className="eyebrow">PATIENT PORTAL</p>
          <h2>{patient?.full_name || "My Health Records"}</h2>
          <p className="muted">Appointments, prescriptions, bills, reports, documents and clinical timeline in one secure view.</p>
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
              </div>
            </div>
            <StatusBadge status="active" />
          </div>

          <div className="portalStatsGrid">
            <div className="card portalStat"><span>Appointments</span><strong>{summary.appointments || 0}</strong></div>
            <div className="card portalStat"><span>Prescriptions</span><strong>{summary.prescriptions || 0}</strong></div>
            <div className="card portalStat"><span>Lab/Radiology</span><strong>{(summary.labReports || 0) + (summary.radiologyReports || 0)}</strong></div>
            <div className="card portalStat"><span>Pending Bills</span><strong>{summary.pendingBills || 0}</strong></div>
          </div>

          <div className="portalTwoCol">
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Upcoming Appointments</h2><span className="muted">{upcoming.length} active</span></div>
              {!upcoming.length ? <div className="emptyState">No upcoming appointments.</div> : upcoming.map((a) => (
                <article className="portalListItem" key={a.id || a._id}>
                  <div><strong>{a.doctor_name || a.doctor_id || "Doctor"}</strong><small>{a.appointment_date} · {a.appointment_time || "--"}</small></div>
                  <StatusBadge status={a.status || "scheduled"} />
                </article>
              ))}
            </div>

            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Documents & Reports</h2><span className="muted">{summary.documents || 0} documents</span></div>
              {[...(data.documents || []), ...(data.labReports || []).filter((x) => x.report_file), ...(data.radiologyReports || []).filter((x) => x.report_file)].slice(0, 8).map((doc, index) => (
                <article className="portalListItem" key={doc.file_url || doc.report_file || index}>
                  <div><strong>{doc.title || doc.test_name || doc.scan_name || doc.file_name || "Report"}</strong><small>{doc.document_type || doc.test_status || doc.status || "Record"}</small></div>
                  {(doc.file_url || doc.report_file) ? <a className="miniAction" href={doc.file_url || doc.report_file} target="_blank" rel="noreferrer">Open</a> : <span className="muted">Saved</span>}
                </article>
              ))}
              {!(data.documents || []).length && !(data.labReports || []).some((x) => x.report_file) && !(data.radiologyReports || []).some((x) => x.report_file) && <div className="emptyState">No documents or uploaded reports yet.</div>}
            </div>
          </div>

          <div className="card portalPanel">
            <div className="sectionTitleRow"><h2>Medical Timeline</h2><span className="muted">Latest records</span></div>
            <div className="portalTimeline">
              {(data.timeline || []).slice(0, 20).map((item, index) => (
                <article key={`${item.type}-${index}`} className="timelineItem">
                  <span className="timelineDot" />
                  <div><strong>{item.title}</strong><small>{item.type} · {fmtDate(item.date)}</small></div>
                  <StatusBadge status={item.status || item.type} />
                </article>
              ))}
              {!(data.timeline || []).length && <div className="emptyState">No timeline records yet.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
