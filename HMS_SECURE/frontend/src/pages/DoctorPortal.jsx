import React, { useEffect, useMemo, useState } from "react";
import { portalApi } from "../api";

function StatusBadge({ status }) {
  const clean = String(status || "active").replaceAll("_", " ");
  return <span className={`statusPill status-${String(status || "active").toLowerCase()}`}>{clean}</span>;
}

function PortalTab({ active, children, onClick }) {
  return <button type="button" className={`portalTab ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function Empty({ children }) {
  return <div className="emptyState">{children}</div>;
}

function fmtDate(value) {
  if (!value) return "--";
  return String(value).slice(0, 10);
}

function patientName(row = {}) {
  return row.patient_name || row.full_name || row.patient_id || "Patient";
}

export default function DoctorPortal({ user, doctors = [] }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canSelectDoctor = ["super_admin", "admin", "hospital_admin"].includes(user?.role);

  async function load(doctorId = selectedDoctorId) {
    setLoading(true);
    setError("");
    try {
      const { data: response } = await portalApi.doctor(doctorId ? { doctor_id: doctorId } : {});
      setData(response);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load doctor portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canSelectDoctor && doctors.length && !selectedDoctorId) {
      const first = doctors[0]?.id || doctors[0]?.doctor_id || "";
      setSelectedDoctorId(String(first));
      load(first);
    } else {
      load("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors.length]);

  const doctor = data?.doctor;
  const summary = data?.summary || {};
  const access = data?.access || {};
  const activeQueue = useMemo(() => data?.activeQueue || [], [data]);
  const readyOrders = useMemo(() => data?.recentResults || [], [data]);

  return (
    <section className="portalPage">
      <div className="portalHero card doctorPortalHero">
        <div>
          <p className="eyebrow">DOCTOR PORTAL</p>
          <h2>{doctor?.full_name || "My Clinical Workspace"}</h2>
          <p className="muted">Today&apos;s queue, assigned patients, EMR history, lab/radiology results and follow-ups in one tenant-safe dashboard.</p>
          {access.own_data_only && <p className="portalSecureNote">Own-doctor isolation enabled: this login can only view the linked doctor workspace.</p>}
        </div>
        <div className="portalHeroActions">
          {canSelectDoctor && (
            <select value={selectedDoctorId} onChange={(e) => { setSelectedDoctorId(e.target.value); load(e.target.value); }}>
              <option value="">Select doctor / try auto-link from login</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name} · {d.doctor_id || d.id}</option>)}
            </select>
          )}
          <button type="button" className="ghostBtn" disabled={loading} onClick={() => load()}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="card emptyState dangerText">{error}</div>}

      {!doctor ? (
        <div className="card emptyState">{data?.message || "No doctor profile is linked yet. Admin/staff can select a doctor above, or create/link a doctor using matching email, phone or user ID."}</div>
      ) : (
        <>
          <div className="portalProfile card">
            <div className="portalAvatar doctorAvatar">{doctor.profile_image_url ? <img src={doctor.profile_image_url} alt={doctor.full_name} /> : <span>{(doctor.full_name || "D").slice(0, 1)}</span>}</div>
            <div>
              <h2>{doctor.full_name}</h2>
              <p className="muted">Doctor ID: {doctor.doctor_id || doctor.id} · {doctor.specialization || "Specialization not added"}</p>
              <div className="profileMiniGrid">
                <span>Phone <b>{doctor.phone || "--"}</b></span>
                <span>Email <b>{doctor.email || "--"}</b></span>
                <span>Fee <b>₹{doctor.consultation_fee || 0}</b></span>
                <span>Reg. No. <b>{doctor.registration_number || doctor.license_number || "--"}</b></span>
              </div>
            </div>
            <StatusBadge status={doctor.status || "active"} />
          </div>

          <div className="portalStatsGrid">
            <div className="card portalStat"><span>Today</span><strong>{summary.today || 0}</strong><small>{summary.upcoming || 0} upcoming</small></div>
            <div className="card portalStat"><span>Waiting</span><strong>{summary.waiting || 0}</strong><small>{summary.inConsultation || 0} in consultation</small></div>
            <div className="card portalStat"><span>Assigned Patients</span><strong>{summary.assignedPatients || 0}</strong><small>{summary.consultations || 0} consults</small></div>
            <div className="card portalStat"><span>Ready Results</span><strong>{summary.readyResults || 0}</strong><small>{(summary.labOrders || 0) + (summary.radiologyOrders || 0)} orders</small></div>
          </div>

          <div className="card portalTabsCard">
            <div className="portalTabs">
              <PortalTab active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</PortalTab>
              <PortalTab active={activeTab === "queue"} onClick={() => setActiveTab("queue")}>Today Queue</PortalTab>
              <PortalTab active={activeTab === "patients"} onClick={() => setActiveTab("patients")}>Assigned Patients</PortalTab>
              <PortalTab active={activeTab === "emr"} onClick={() => setActiveTab("emr")}>EMR</PortalTab>
              <PortalTab active={activeTab === "results"} onClick={() => setActiveTab("results")}>Results</PortalTab>
              <PortalTab active={activeTab === "followups"} onClick={() => setActiveTab("followups")}>Follow-ups</PortalTab>
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="portalTwoCol">
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Today&apos;s Active Queue</h2><span className="muted">{activeQueue.length} active</span></div>
                {!activeQueue.length ? <Empty>No active queue for today.</Empty> : activeQueue.slice(0, 8).map((a) => (
                  <article className="portalListItem" key={a.id || a._id}>
                    <div><strong>{patientName(a)}</strong><small>Token {a.token_number || a.id} · {a.appointment_time || "--"}</small></div>
                    <StatusBadge status={a.status || "scheduled"} />
                  </article>
                ))}
              </div>
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Schedule</h2><span className="muted">Availability</span></div>
                {data.schedule ? (
                  <div className="scheduleSummary">
                    <strong>{(data.schedule.working_days || []).join(", ") || "Working days not set"}</strong>
                    <p>{data.schedule.start_time || "--"} to {data.schedule.end_time || "--"}</p>
                    <p>Slot: {data.schedule.slot_duration || 15} min · Max/day: {data.schedule.max_patients_per_day || "No limit"}</p>
                    {data.schedule.break_start && <p>Break: {data.schedule.break_start} - {data.schedule.break_end || "--"}</p>}
                  </div>
                ) : <Empty>Schedule not configured yet.</Empty>}
              </div>
            </div>
          )}

          {activeTab === "queue" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Today&apos;s Queue</h2><span className="muted">{(data.todayAppointments || []).length} appointments</span></div>
              {!(data.todayAppointments || []).length ? <Empty>No appointments for today.</Empty> : (data.todayAppointments || []).map((a) => (
                <article className="portalListItem" key={a.id || `${a.patient_id}-${a.appointment_time}`}>
                  <div><strong>{patientName(a)}</strong><small>{a.appointment_time || "--"} · Token {a.token_number || a.id} · {a.appointment_type || "OPD"}</small></div>
                  <StatusBadge status={a.status || "scheduled"} />
                </article>
              ))}
            </div>
          )}

          {activeTab === "patients" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Assigned Patients</h2><span className="muted">{(data.assignedPatients || []).length} patients</span></div>
              {!(data.assignedPatients || []).length ? <Empty>No assigned patients found from appointments/consultations yet.</Empty> : (data.assignedPatients || []).map((p) => (
                <article className="portalListItem" key={p.id || p.patient_id}>
                  <div><strong>{patientName(p)}</strong><small>{p.patient_id || "--"} · {p.gender || "--"} · Blood {p.blood_group || "--"} · Last visit {fmtDate(p.last_visit_date)}</small></div>
                  <span className="muted">{p.consultations || 0} consults</span>
                </article>
              ))}
            </div>
          )}

          {activeTab === "emr" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Recent EMR / Consultations</h2><span className="muted">{summary.consultations || 0} records</span></div>
              {!(data.consultations || []).length ? <Empty>No consultations yet.</Empty> : (data.consultations || []).slice(0, 25).map((c) => (
                <article className="portalListItem" key={c.id || c._id}>
                  <div><strong>{c.final_diagnosis || c.provisional_diagnosis || c.diagnosis || c.chief_complaint || "OPD Consultation"}</strong><small>Patient {c.patient_id || "--"} · {fmtDate(c.visit_date || c.created_at)} · Follow-up {fmtDate(c.follow_up_date)}</small></div>
                  <StatusBadge status={c.status || (c.is_finalized ? "finalized" : "saved")} />
                </article>
              ))}
            </div>
          )}

          {activeTab === "results" && (
            <div className="portalTwoCol">
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>Ready Results</h2><span className="muted">{readyOrders.length} ready</span></div>
                {!readyOrders.length ? <Empty>No ready reports yet.</Empty> : readyOrders.slice(0, 25).map((o) => (
                  <article className="portalListItem" key={`${o.test_name || o.scan_name}-${o.id}`}>
                    <div><strong>{o.test_name || o.scan_name || "Report"}</strong><small>Patient {o.patient_id || "--"} · {o.test_category || o.scan_category || "Clinical result"}</small></div>
                    <StatusBadge status={o.test_status || o.status || "reported"} />
                  </article>
                ))}
              </div>
              <div className="card portalPanel">
                <div className="sectionTitleRow"><h2>All Orders</h2><span className="muted">Lab/Radiology</span></div>
                {[...(data.labOrders || []), ...(data.radiologyOrders || [])].slice(0, 25).map((o) => (
                  <article className="portalListItem" key={`${o.test_name || o.scan_name}-${o.id}`}>
                    <div><strong>{o.test_name || o.scan_name || "Order"}</strong><small>Patient {o.patient_id || "--"} · {o.test_category || o.scan_category || "Clinical order"}</small></div>
                    <StatusBadge status={o.test_status || o.status || "ordered"} />
                  </article>
                ))}
                {!(data.labOrders || []).length && !(data.radiologyOrders || []).length && <Empty>No lab or radiology orders yet.</Empty>}
              </div>
            </div>
          )}

          {activeTab === "followups" && (
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Follow-up List</h2><span className="muted">{summary.followUps || 0} upcoming</span></div>
              {!(data.followUps || []).length ? <Empty>No upcoming follow-ups.</Empty> : (data.followUps || []).map((f) => (
                <article className="portalListItem" key={f.id || `${f.patient_id}-${f.follow_up_date}`}>
                  <div><strong>{patientName(f)}</strong><small>Patient {f.patient_id || "--"} · Follow-up {fmtDate(f.follow_up_date)} · {f.final_diagnosis || f.provisional_diagnosis || f.chief_complaint || "Consultation"}</small></div>
                  <StatusBadge status={f.status || "follow_up"} />
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
