import React, { useEffect, useMemo, useState } from "react";
import { portalApi } from "../api";

function StatusBadge({ status }) {
  const clean = String(status || "active").replaceAll("_", " ");
  return <span className={`statusPill status-${String(status || "active").toLowerCase()}`}>{clean}</span>;
}

export default function DoctorPortal({ user, doctors = [] }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const canSelectDoctor = ["super_admin", "admin", "hospital_admin"].includes(user?.role);

  async function load(doctorId = selectedDoctorId) {
    setLoading(true);
    try {
      const { data: response } = await portalApi.doctor(doctorId ? { doctor_id: doctorId } : {});
      setData(response);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canSelectDoctor && doctors.length && !selectedDoctorId) {
      const first = doctors[0]?.id || doctors[0]?.doctor_id || '';
      setSelectedDoctorId(String(first));
      load(first);
    } else {
      load('');
    }
  }, [doctors.length]);

  const doctor = data?.doctor;
  const summary = data?.summary || {};
  const activeQueue = useMemo(() => data?.activeQueue || [], [data]);

  return (
    <section className="portalPage">
      <div className="portalHero card doctorPortalHero">
        <div>
          <p className="eyebrow">DOCTOR PORTAL</p>
          <h2>{doctor?.full_name || "My Clinical Workspace"}</h2>
          <p className="muted">Today&apos;s appointments, queue, schedule, consultations, orders and recent clinical work in one focused dashboard.</p>
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
              </div>
            </div>
            <StatusBadge status={doctor.status || "active"} />
          </div>

          <div className="portalStatsGrid">
            <div className="card portalStat"><span>Today</span><strong>{summary.today || 0}</strong></div>
            <div className="card portalStat"><span>Waiting</span><strong>{summary.waiting || 0}</strong></div>
            <div className="card portalStat"><span>In Consultation</span><strong>{summary.inConsultation || 0}</strong></div>
            <div className="card portalStat"><span>Completed</span><strong>{summary.completed || 0}</strong></div>
          </div>

          <div className="portalTwoCol">
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Today&apos;s Queue</h2><span className="muted">{activeQueue.length} active</span></div>
              {!activeQueue.length ? <div className="emptyState">No active queue for today.</div> : activeQueue.map((a) => (
                <article className="portalListItem" key={a.id || a._id}>
                  <div><strong>{a.patient_name || a.patient_id || "Patient"}</strong><small>Token {a.token_number || a.id} · {a.appointment_time || "--"}</small></div>
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
              ) : <div className="emptyState">Schedule not configured yet.</div>}
            </div>
          </div>

          <div className="portalTwoCol">
            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Recent Consultations</h2><span className="muted">{summary.consultations || 0} records</span></div>
              {(data.consultations || []).slice(0, 8).map((c) => (
                <article className="portalListItem" key={c.id || c._id}>
                  <div><strong>{c.diagnosis || c.chief_complaint || "OPD Consultation"}</strong><small>{c.visit_date || c.created_at || "--"}</small></div>
                  <StatusBadge status={c.status || "saved"} />
                </article>
              ))}
              {!(data.consultations || []).length && <div className="emptyState">No consultations yet.</div>}
            </div>

            <div className="card portalPanel">
              <div className="sectionTitleRow"><h2>Orders & Reports</h2><span className="muted">Lab/Radiology</span></div>
              {[...(data.labOrders || []), ...(data.radiologyOrders || [])].slice(0, 8).map((o) => (
                <article className="portalListItem" key={`${o.test_name || o.scan_name}-${o.id}`}>
                  <div><strong>{o.test_name || o.scan_name || "Order"}</strong><small>{o.test_category || o.scan_category || "Clinical order"}</small></div>
                  <StatusBadge status={o.test_status || o.status || "ordered"} />
                </article>
              ))}
              {!(data.labOrders || []).length && !(data.radiologyOrders || []).length && <div className="emptyState">No lab or radiology orders yet.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
