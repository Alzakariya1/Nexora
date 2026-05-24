import React, { useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checked_in", label: "Checked In" },
  { value: "in_consultation", label: "In Consultation" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

const TYPE_OPTIONS = [
  { value: "opd", label: "OPD" },
  { value: "follow_up", label: "Follow-up" },
  { value: "emergency", label: "Emergency" },
  { value: "teleconsultation", label: "Teleconsultation" },
];

const WEEK_DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

function statusLabel(status = "scheduled") {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function typeLabel(type = "opd") {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label || type;
}

function statusClass(status = "scheduled") {
  return `apptStatus apptStatus-${status}`;
}

function doctorLabel(doctor) {
  if (!doctor) return "";
  const code = doctor.doctor_id || doctor.id;
  return `${doctor.full_name || "Doctor"}${code ? ` (${code})` : ""}`;
}

export default function Appointments({
  appointment,
  setAppointment,
  addAppointment,
  appointmentSearch,
  setAppointmentSearch,
  appointmentStatusFilter,
  setAppointmentStatusFilter,
  appointmentDateFilter,
  setAppointmentDateFilter,
  appointmentTypeFilter,
  setAppointmentTypeFilter,
  filteredAppointments,
  paginatedAppointments,
  editAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  appointmentPage,
  setAppointmentPage,
  appointmentTotalPages,
  doctors = [],
  doctorSchedules = [],
  scheduleForm,
  setScheduleForm,
  saveDoctorSchedule,
  editDoctorSchedule,
  deleteDoctorSchedule,
  permissions = {},
}) {
  const [showForm, setShowForm] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showQueue, setShowQueue] = useState(true);
  const [consultationFor, setConsultationFor] = useState(null);
  const emptyPrescriptionItem = { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" };
  const emptyConsultation = {
    chief_complaint: "",
    bp: "",
    pulse: "",
    temperature: "",
    spo2: "",
    diagnosis: "",
    clinical_notes: "",
    treatment_plan: "",
    follow_up_date: "",
    prescriptions: [{ ...emptyPrescriptionItem }],
    generate_bill: true,
    consultation_fee: "",
    paid_amount: "",
    discount: "",
    gst_percent: "",
  };
  const [consultation, setConsultation] = useState(emptyConsultation);
  const today = new Date().toISOString().slice(0, 10);

  const appointmentStats = useMemo(() => {
    const rows = filteredAppointments || [];
    return {
      total: rows.length,
      today: rows.filter((a) => a.appointment_date === today).length,
      checkedIn: rows.filter((a) => ["checked_in", "in_consultation"].includes(a.status)).length,
      completed: rows.filter((a) => a.status === "completed").length,
    };
  }, [filteredAppointments, today]);

  const queueRows = useMemo(() => {
    const tokenValue = (row) => Number(String(row.token_number || "").replace(/\D/g, "")) || Number(row.id || 0);
    return (filteredAppointments || [])
      .filter((a) => (a.appointment_date || "") === today)
      .filter((a) => ["scheduled", "checked_in", "in_consultation"].includes(a.status || "scheduled"))
      .sort((a, b) => tokenValue(a) - tokenValue(b) || String(a.appointment_time || "").localeCompare(String(b.appointment_time || "")))
      .map((row, index) => ({ ...row, queue_position: index + 1 }));
  }, [filteredAppointments, today]);

  const queueStats = useMemo(() => ({
    scheduled: queueRows.filter((a) => (a.status || "scheduled") === "scheduled").length,
    waiting: queueRows.filter((a) => a.status === "checked_in").length,
    inConsultation: queueRows.filter((a) => a.status === "in_consultation").length,
  }), [queueRows]);

  const callNextPatient = () => {
    const next = queueRows.find((a) => a.status === "checked_in") || queueRows.find((a) => (a.status || "scheduled") === "scheduled");
    if (!next) return;
    updateAppointmentStatus(next, next.status === "checked_in" ? "in_consultation" : "checked_in");
  };

  const handleField = (key, value) => setAppointment({ ...appointment, [key]: value });
  const handleScheduleField = (key, value) => setScheduleForm({ ...scheduleForm, [key]: value });
  const handleConsultationField = (key, value) => setConsultation({ ...consultation, [key]: value });
  const updatePrescriptionItem = (index, key, value) => {
    setConsultation((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };
  const addPrescriptionItem = () => setConsultation((prev) => ({ ...prev, prescriptions: [...prev.prescriptions, { ...emptyPrescriptionItem }] }));
  const removePrescriptionItem = (index) => {
    setConsultation((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.length === 1 ? [{ ...emptyPrescriptionItem }] : prev.prescriptions.filter((_, i) => i !== index),
    }));
  };

  function startConsultation(row) {
    const doctor = doctors.find((d) => String(d.id) === String(row.doctor_id) || String(d.doctor_id) === String(row.doctor_id));
    setConsultationFor(row);
    setShowForm(false);
    setConsultation((prev) => ({
      ...emptyConsultation,
      consultation_fee: doctor?.consultation_fee || prev.consultation_fee || "",
    }));
  }

  async function saveConsultation(e) {
    e.preventDefault();
    if (!consultationFor) return;
    const payload = {
      appointment_id: consultationFor.id,
      patient_id: consultationFor.patient_id,
      doctor_id: consultationFor.doctor_id,
      visit_date: consultationFor.appointment_date || today,
      chief_complaint: consultation.chief_complaint,
      vitals: { bp: consultation.bp, pulse: consultation.pulse, temperature: consultation.temperature, spo2: consultation.spo2 },
      diagnosis: consultation.diagnosis,
      clinical_notes: consultation.clinical_notes,
      treatment_plan: consultation.treatment_plan,
      follow_up_date: consultation.follow_up_date,
      status: "completed",
      prescriptions: consultation.prescriptions,
      generate_bill: consultation.generate_bill,
      consultation_fee: consultation.consultation_fee,
      paid_amount: consultation.paid_amount,
      discount: consultation.discount,
      gst_percent: consultation.gst_percent,
    };
    await import("../api/appointmentApi").then(({ appointmentApi }) => appointmentApi.saveConsultation(payload));
    await updateAppointmentStatus(consultationFor, "completed");
    setConsultationFor(null);
    setConsultation(emptyConsultation);
  }

  const toggleWorkingDay = (day) => {
    const current = Array.isArray(scheduleForm.working_days) ? scheduleForm.working_days : [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    handleScheduleField("working_days", next);
  };

  return (
    <section className="appointmentPage">
      <div className="appointmentHero card">
        <div>
          <p className="eyebrow">APPOINTMENT WORKFLOW</p>
          <h2>Appointments, Doctor Schedule & OPD Booking</h2>
          <p className="muted">Manage doctor availability, appointment booking, check-in, consultation status, cancellation and daily queue flow.</p>
        </div>
        <div className="appointmentHeroActions">
          {permissions.appointmentCreate && (
            <button type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Hide Booking" : "+ New Appointment"}
            </button>
          )}
          {permissions.doctorScheduleManage && (
            <button type="button" className="ghostBtn" onClick={() => setShowSchedule((v) => !v)}>
              {showSchedule ? "Hide Schedule" : "Doctor Schedule"}
            </button>
          )}
          <button type="button" className="ghostBtn" onClick={() => setShowQueue((v) => !v)}>
            {showQueue ? "Hide Queue" : "Reception Queue"}
          </button>
        </div>
      </div>

      <div className="appointmentStatsGrid">
        <div className="appointmentStat card"><span>Total</span><strong>{appointmentStats.total}</strong></div>
        <div className="appointmentStat card"><span>Today</span><strong>{appointmentStats.today}</strong></div>
        <div className="appointmentStat card"><span>Waiting / Active</span><strong>{appointmentStats.checkedIn}</strong></div>
        <div className="appointmentStat card"><span>Completed</span><strong>{appointmentStats.completed}</strong></div>
      </div>

      {showQueue && (
        <div className="card appointmentBoard receptionQueuePanel">
          <div className="sectionTitleRow">
            <div>
              <h2>Reception Queue</h2>
              <p className="muted">Today&apos;s token queue for front desk check-in, doctor call and no-show tracking.</p>
            </div>
            <div className="queueHeaderActions">
              <button type="button" className="ghostBtn" disabled={!queueRows.length} onClick={callNextPatient}>Call Next</button>
            </div>
          </div>

          <div className="queueStatsGrid">
            <div><span>Scheduled</span><strong>{queueStats.scheduled}</strong></div>
            <div><span>Waiting</span><strong>{queueStats.waiting}</strong></div>
            <div><span>In Consultation</span><strong>{queueStats.inConsultation}</strong></div>
          </div>

          {!queueRows.length ? (
            <div className="emptyState">No active queue for today. Scheduled, checked-in and in-consultation appointments will appear here.</div>
          ) : (
            <div className="queueBoard">
              {queueRows.map((a) => (
                <article className={`queueCard queueCard-${a.status || "scheduled"}`} key={a.id || a._id}>
                  <div className="queueToken">
                    <small>#{a.queue_position}</small>
                    <strong>{a.token_number || String(a.id || "-").padStart(3, "0")}</strong>
                  </div>
                  <div className="queuePatient">
                    <h3>{a.patient_name || a.patient_id || "Unknown Patient"}</h3>
                    <p>{a.appointment_time || "--:--"} · {a.doctor_name || a.doctor_id || "Doctor"}</p>
                  </div>
                  <span className={statusClass(a.status || "scheduled")}>{statusLabel(a.status || "scheduled")}</span>
                  <div className="queueActions">
                    {permissions.appointmentStatusUpdate && (a.status || "scheduled") === "scheduled" && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "checked_in")}>Check In</button>
                    )}
                    {permissions.appointmentStatusUpdate && a.status === "checked_in" && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "in_consultation")}>Call Patient</button>
                    )}
                    {permissions.appointmentStatusUpdate && a.status === "in_consultation" && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "completed")}>Complete</button>
                    )}
                    {permissions.appointmentStatusUpdate && ["scheduled", "checked_in"].includes(a.status || "scheduled") && (
                      <button type="button" className="dangerGhost" onClick={() => updateAppointmentStatus(a, "no_show")}>No Show</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {permissions.doctorScheduleManage && showSchedule && (
        <div className="card appointmentBoard schedulePanel">
          <div className="sectionTitleRow">
            <div>
              <h2>Doctor Availability Schedule</h2>
              <p className="muted">Configure OPD timings, slot duration, break time, daily limit and unavailable dates. Booking outside this schedule will be blocked.</p>
            </div>
          </div>

          <form className="appointmentForm scheduleForm" onSubmit={saveDoctorSchedule}>
            <div className="appointmentFormGrid">
              <label>
                <span>Doctor</span>
                <select required value={scheduleForm.doctor_id || ""} onChange={(e) => handleScheduleField("doctor_id", e.target.value)}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id || doctor.doctor_id} value={doctor.id || doctor.doctor_id}>{doctorLabel(doctor)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start Time</span>
                <input type="time" required value={scheduleForm.start_time || ""} onChange={(e) => handleScheduleField("start_time", e.target.value)} />
              </label>
              <label>
                <span>End Time</span>
                <input type="time" required value={scheduleForm.end_time || ""} onChange={(e) => handleScheduleField("end_time", e.target.value)} />
              </label>
              <label>
                <span>Slot Duration</span>
                <select value={scheduleForm.slot_duration || 15} onChange={(e) => handleScheduleField("slot_duration", Number(e.target.value))}>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <label>
                <span>Break Start</span>
                <input type="time" value={scheduleForm.break_start || ""} onChange={(e) => handleScheduleField("break_start", e.target.value)} />
              </label>
              <label>
                <span>Break End</span>
                <input type="time" value={scheduleForm.break_end || ""} onChange={(e) => handleScheduleField("break_end", e.target.value)} />
              </label>
              <label>
                <span>Max Patients / Day</span>
                <input type="number" min="0" placeholder="0 = no limit" value={scheduleForm.max_patients_per_day || ""} onChange={(e) => handleScheduleField("max_patients_per_day", e.target.value)} />
              </label>
              <label>
                <span>Status</span>
                <select value={scheduleForm.status || "active"} onChange={(e) => handleScheduleField("status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="appointmentNotes">
                <span>Unavailable Dates</span>
                <input placeholder="YYYY-MM-DD, YYYY-MM-DD" value={scheduleForm.unavailable_dates || ""} onChange={(e) => handleScheduleField("unavailable_dates", e.target.value)} />
              </label>
              <label className="appointmentNotes">
                <span>Notes</span>
                <textarea rows="2" placeholder="Optional schedule notes" value={scheduleForm.notes || ""} onChange={(e) => handleScheduleField("notes", e.target.value)} />
              </label>
            </div>

            <div className="weekdaySelector">
              <span>Working Days</span>
              <div>
                {WEEK_DAYS.map((day) => (
                  <button key={day.value} type="button" className={(scheduleForm.working_days || []).includes(day.value) ? "dayChip active" : "dayChip"} onClick={() => toggleWorkingDay(day.value)}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="appointmentFormActions">
              <button type="submit">Save Schedule</button>
              <button type="button" className="ghostBtn" onClick={() => setScheduleForm({ doctor_id: "", working_days: ["mon", "tue", "wed", "thu", "fri", "sat"], start_time: "10:00", end_time: "14:00", break_start: "", break_end: "", slot_duration: 15, max_patients_per_day: "", unavailable_dates: "", status: "active", notes: "" })}>Reset Schedule Form</button>
            </div>
          </form>

          <div className="scheduleList">
            {!doctorSchedules?.length ? (
              <div className="emptyState">No doctor schedules configured yet.</div>
            ) : doctorSchedules.map((row) => (
              <article className="scheduleCard" key={row.id || row._id}>
                <div>
                  <h3>{row.doctor_name || row.doctor_id || "Doctor"}</h3>
                  <p>{(row.working_days || []).join(", ").toUpperCase()} · {row.start_time} - {row.end_time}</p>
                  <small>Slot: {row.slot_duration || 15} min · Break: {row.break_start && row.break_end ? `${row.break_start} - ${row.break_end}` : "None"} · Limit: {row.max_patients_per_day || "No limit"}</small>
                </div>
                <span className={row.status === "active" ? "apptStatus apptStatus-completed" : "apptStatus apptStatus-cancelled"}>{row.status || "active"}</span>
                <div className="appointmentActions">
                  <button type="button" className="ghostBtn" onClick={() => editDoctorSchedule(row)}>Edit</button>
                  <button type="button" className="dangerGhost" onClick={() => deleteDoctorSchedule(row)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {permissions.appointmentCreate && showForm && (
        <form className="card appointmentForm" onSubmit={addAppointment}>
          <div className="sectionTitleRow">
            <div>
              <h2>{appointment?.id ? "Edit Appointment" : "Schedule Appointment"}</h2>
              <p className="muted">Configured doctor schedules are enforced by backend validation. Emergency and teleconsultation appointments still follow active slot rules.</p>
            </div>
          </div>

          <div className="appointmentFormGrid">
            <label>
              <span>Patient ID</span>
              <input required placeholder="e.g. PAT-001 or 1" value={appointment.patient_id || ""} onChange={(e) => handleField("patient_id", e.target.value)} />
            </label>
            <label>
              <span>Doctor</span>
              <select required value={appointment.doctor_id || ""} onChange={(e) => handleField("doctor_id", e.target.value)}>
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id || doctor.doctor_id} value={doctor.doctor_id || doctor.id}>{doctorLabel(doctor)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input required type="date" value={appointment.appointment_date || ""} onChange={(e) => handleField("appointment_date", e.target.value)} />
            </label>
            <label>
              <span>Time</span>
              <input required type="time" value={appointment.appointment_time || ""} onChange={(e) => handleField("appointment_time", e.target.value)} />
            </label>
            <label>
              <span>Type</span>
              <select value={appointment.appointment_type || "opd"} onChange={(e) => handleField("appointment_type", e.target.value)}>
                {TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={appointment.status || "scheduled"} onChange={(e) => handleField("status", e.target.value)}>
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="appointmentNotes">
              <span>Notes</span>
              <textarea rows="3" placeholder="Reason, symptoms, internal notes..." value={appointment.notes || ""} onChange={(e) => handleField("notes", e.target.value)} />
            </label>
          </div>

          <div className="appointmentFormActions">
            <button type="submit">Save Appointment</button>
          </div>
        </form>
      )}

      {consultationFor && (
        <div className="card appointmentBoard opdConsultPanel">
          <div className="sectionTitleRow">
            <div>
              <h2>OPD Consultation</h2>
              <p className="muted">{consultationFor.patient_name || consultationFor.patient_id} · {consultationFor.doctor_name || consultationFor.doctor_id} · Token {consultationFor.token_number || consultationFor.id}</p>
            </div>
            <button type="button" className="ghostBtn" onClick={() => setConsultationFor(null)}>Close</button>
          </div>
          <form className="appointmentForm opdConsultForm" onSubmit={saveConsultation}>
            <div className="opdTwoColumn">
              <div className="opdPanelBlock">
                <h3>Clinical Notes</h3>
                <label><span>Chief Complaint</span><input required value={consultation.chief_complaint} onChange={(e) => handleConsultationField("chief_complaint", e.target.value)} placeholder="Fever, pain, follow-up..." /></label>
                <div className="appointmentFormGrid compactVitals">
                  <label><span>BP</span><input value={consultation.bp} onChange={(e) => handleConsultationField("bp", e.target.value)} placeholder="120/80" /></label>
                  <label><span>Pulse</span><input value={consultation.pulse} onChange={(e) => handleConsultationField("pulse", e.target.value)} placeholder="78" /></label>
                  <label><span>Temp</span><input value={consultation.temperature} onChange={(e) => handleConsultationField("temperature", e.target.value)} placeholder="98.6" /></label>
                  <label><span>SpO2</span><input value={consultation.spo2} onChange={(e) => handleConsultationField("spo2", e.target.value)} placeholder="98%" /></label>
                </div>
                <label><span>Diagnosis</span><input required value={consultation.diagnosis} onChange={(e) => handleConsultationField("diagnosis", e.target.value)} /></label>
                <label><span>Clinical Notes</span><textarea rows="3" value={consultation.clinical_notes} onChange={(e) => handleConsultationField("clinical_notes", e.target.value)} /></label>
                <label><span>Treatment Plan</span><textarea rows="3" value={consultation.treatment_plan} onChange={(e) => handleConsultationField("treatment_plan", e.target.value)} /></label>
                <label><span>Follow-up Date</span><input type="date" value={consultation.follow_up_date} onChange={(e) => handleConsultationField("follow_up_date", e.target.value)} /></label>
              </div>

              <div className="opdPanelBlock">
                <div className="sectionTitleRow compactTitleRow">
                  <div><h3>Prescription</h3><p className="muted">Medicine, dosage, frequency and duration will be saved with this OPD visit.</p></div>
                  <button type="button" className="ghostBtn" onClick={addPrescriptionItem}>+ Medicine</button>
                </div>
                <div className="prescriptionList">
                  {consultation.prescriptions.map((item, index) => (
                    <div className="prescriptionItem" key={index}>
                      <input placeholder="Medicine name" value={item.medicine_name} onChange={(e) => updatePrescriptionItem(index, "medicine_name", e.target.value)} />
                      <input placeholder="Dosage" value={item.dosage} onChange={(e) => updatePrescriptionItem(index, "dosage", e.target.value)} />
                      <input placeholder="Frequency" value={item.frequency} onChange={(e) => updatePrescriptionItem(index, "frequency", e.target.value)} />
                      <input placeholder="Duration" value={item.duration} onChange={(e) => updatePrescriptionItem(index, "duration", e.target.value)} />
                      <input className="prescriptionInstruction" placeholder="Instructions" value={item.instructions} onChange={(e) => updatePrescriptionItem(index, "instructions", e.target.value)} />
                      <button type="button" className="dangerGhost" onClick={() => removePrescriptionItem(index)}>Remove</button>
                    </div>
                  ))}
                </div>

                <div className="opdBillingBox">
                  <label className="checkboxLine">
                    <input type="checkbox" checked={!!consultation.generate_bill} onChange={(e) => handleConsultationField("generate_bill", e.target.checked)} />
                    <span>Generate OPD consultation bill</span>
                  </label>
                  {consultation.generate_bill && (
                    <div className="appointmentFormGrid compactVitals">
                      <label><span>Fee</span><input type="number" min="0" value={consultation.consultation_fee} onChange={(e) => handleConsultationField("consultation_fee", e.target.value)} /></label>
                      <label><span>Paid</span><input type="number" min="0" value={consultation.paid_amount} onChange={(e) => handleConsultationField("paid_amount", e.target.value)} /></label>
                      <label><span>Discount</span><input type="number" min="0" value={consultation.discount} onChange={(e) => handleConsultationField("discount", e.target.value)} /></label>
                      <label><span>GST %</span><input type="number" min="0" value={consultation.gst_percent} onChange={(e) => handleConsultationField("gst_percent", e.target.value)} /></label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="formActions"><button type="submit">Save Consultation, Prescription & Bill</button></div>
          </form>
        </div>
      )}

      <div className="card appointmentBoard">
        <div className="sectionTitleRow">
          <div>
            <h2>Appointment Board</h2>
            <p className="muted">Filter and move appointments through the reception-to-consultation lifecycle.</p>
          </div>
        </div>

        <div className="appointmentFilters">
          <input placeholder="Search patient, doctor, ID..." value={appointmentSearch} onChange={(e) => setAppointmentSearch(e.target.value)} />
          <input type="date" value={appointmentDateFilter || ""} onChange={(e) => setAppointmentDateFilter(e.target.value)} />
          <select value={appointmentStatusFilter} onChange={(e) => setAppointmentStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={appointmentTypeFilter} onChange={(e) => setAppointmentTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="button" className="ghostBtn" onClick={() => { setAppointmentSearch(""); setAppointmentDateFilter(""); setAppointmentStatusFilter("all"); setAppointmentTypeFilter("all"); }}>
            Reset
          </button>
        </div>

        {!filteredAppointments?.length ? (
          <div className="emptyState">No appointments found for the selected filters.</div>
        ) : (
          <>
            <div className="appointmentList">
              {paginatedAppointments.map((a) => (
                <article className="appointmentCard" key={a.id || a._id}>
                  <div className="tokenBox">
                    <span>Token</span>
                    <strong>{a.token_number || String(a.id || "-").padStart(3, "0")}</strong>
                  </div>

                  <div className="appointmentPeople">
                    <h3>{a.patient_name || a.patient_id || "Unknown Patient"}</h3>
                    <p>Patient ID: {a.patient_id || "--"}</p>
                    <p>Doctor: <b>{a.doctor_name || a.doctor_id || "--"}</b></p>
                  </div>

                  <div className="appointmentMeta">
                    <span>{a.appointment_date || "No date"}</span>
                    <strong>{a.appointment_time || "No time"}</strong>
                    <small>{typeLabel(a.appointment_type || "opd")}</small>
                  </div>

                  <div className="appointmentStatusArea">
                    <span className={statusClass(a.status || "scheduled")}>{statusLabel(a.status || "scheduled")}</span>
                    {a.notes && <small title={a.notes}>{a.notes}</small>}
                  </div>

                  <div className="appointmentActions">
                    {permissions.appointmentStatusUpdate && a.status === "scheduled" && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "checked_in")}>Check In</button>
                    )}
                    {permissions.appointmentStatusUpdate && a.status === "checked_in" && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "in_consultation")}>Start</button>
                    )}
                    {permissions.appointmentStatusUpdate && ["checked_in", "in_consultation"].includes(a.status) && (
                      <button type="button" onClick={() => startConsultation(a)}>OPD Consult</button>
                    )}
                    {permissions.appointmentStatusUpdate && ["checked_in", "in_consultation"].includes(a.status) && (
                      <button type="button" onClick={() => updateAppointmentStatus(a, "completed")}>Complete</button>
                    )}
                    {permissions.appointmentStatusUpdate && ["scheduled", "checked_in"].includes(a.status || "scheduled") && (
                      <button type="button" className="ghostBtn" onClick={() => updateAppointmentStatus(a, "no_show")}>No Show</button>
                    )}
                    {permissions.appointmentEdit && <button type="button" className="ghostBtn" onClick={() => { editAppointment(a); setShowForm(true); }}>Edit</button>}
                    {permissions.appointmentStatusUpdate && !["completed", "cancelled"].includes(a.status) && (
                      <button type="button" className="dangerGhost" onClick={() => updateAppointmentStatus(a, "cancelled")}>Cancel</button>
                    )}
                    {permissions.appointmentDelete && <button type="button" className="dangerGhost" onClick={() => deleteAppointment(a)}>Delete</button>}
                  </div>
                </article>
              ))}
            </div>

            <div className="paginationBar">
              <button type="button" disabled={appointmentPage === 1} onClick={() => setAppointmentPage(appointmentPage - 1)}>Previous</button>
              <span>Page {appointmentPage} of {appointmentTotalPages || 1}</span>
              <button type="button" disabled={appointmentPage >= appointmentTotalPages} onClick={() => setAppointmentPage(appointmentPage + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
