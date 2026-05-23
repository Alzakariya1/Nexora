import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { nursingApi } from '../api/nursingApi';

const cardStyle = { border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fff' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 };

export default function Nursing() {
  const [dashboard, setDashboard] = useState({});
  const [vitals, setVitals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vitalForm, setVitalForm] = useState({ patient_id: '', ipd_admission_id: '', temperature: '', pulse: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', spo2: '', pain_score: '', notes: '' });
  const [taskForm, setTaskForm] = useState({ patient_id: '', ipd_admission_id: '', title: '', task_type: 'round', priority: 'normal', due_at: '', notes: '' });
  const [medForm, setMedForm] = useState({ patient_id: '', ipd_admission_id: '', medication_name: '', dose: '', route: '', frequency: '', scheduled_at: '', notes: '' });

  async function load() {
    setLoading(true);
    try {
      const [dash, vit, task, med] = await Promise.all([
        nursingApi.dashboard(), nursingApi.vitals(), nursingApi.tasks(), nursingApi.medications(),
      ]);
      setDashboard(dash.data || {});
      setVitals(vit.data || []);
      setTasks(task.data || []);
      setMedications(med.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nursing data load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitVital(e) {
    e.preventDefault();
    try {
      await nursingApi.createVital(vitalForm);
      toast.success('Vitals recorded');
      setVitalForm({ patient_id: '', ipd_admission_id: '', temperature: '', pulse: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', spo2: '', pain_score: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Vitals save failed'); }
  }

  async function submitTask(e) {
    e.preventDefault();
    try {
      await nursingApi.createTask(taskForm);
      toast.success('Nursing task created');
      setTaskForm({ patient_id: '', ipd_admission_id: '', title: '', task_type: 'round', priority: 'normal', due_at: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Task save failed'); }
  }

  async function submitMedication(e) {
    e.preventDefault();
    try {
      await nursingApi.createMedication(medForm);
      toast.success('Medication schedule added');
      setMedForm({ patient_id: '', ipd_admission_id: '', medication_name: '', dose: '', route: '', frequency: '', scheduled_at: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Medication save failed'); }
  }

  const Field = ({ label, value, onChange, type = 'text', required = false }) => (
    <label className="form-label">{label}<input className="form-control" type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label>
  );

  return (
    <div className="page-stack">
      <div className="page-header"><div><h2>Nursing Module</h2><p>Vitals, MAR, care tasks and shift handover foundation.</p></div><button className="btn btn-outline-primary" onClick={load} disabled={loading}>Refresh</button></div>
      <div style={gridStyle}>
        {[
          ['Active Admissions', dashboard.activeAdmissions || 0], ['Open Tasks', dashboard.openTasks || 0], ['Overdue Tasks', dashboard.overdueTasks || 0], ['Scheduled Meds', dashboard.scheduledMeds || 0], ['Administered Today', dashboard.administeredToday || 0], ['Vitals Today', dashboard.vitalsToday || 0], ['Active Care Plans', dashboard.activeCarePlans || 0],
        ].map(([label, value]) => <div key={label} style={cardStyle}><div className="text-muted small">{label}</div><div className="h3 mb-0">{value}</div></div>)}
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4"><div style={cardStyle}><h5>Record Vitals</h5><form onSubmit={submitVital} className="vstack gap-2">
          <Field label="Patient ID" required value={vitalForm.patient_id} onChange={(v)=>setVitalForm({...vitalForm, patient_id:v})} />
          <Field label="IPD Admission ID" value={vitalForm.ipd_admission_id} onChange={(v)=>setVitalForm({...vitalForm, ipd_admission_id:v})} />
          <div className="row g-2"><div className="col"><Field label="Temp" value={vitalForm.temperature} onChange={(v)=>setVitalForm({...vitalForm, temperature:v})} /></div><div className="col"><Field label="Pulse" value={vitalForm.pulse} onChange={(v)=>setVitalForm({...vitalForm, pulse:v})} /></div></div>
          <div className="row g-2"><div className="col"><Field label="BP Sys" value={vitalForm.blood_pressure_systolic} onChange={(v)=>setVitalForm({...vitalForm, blood_pressure_systolic:v})} /></div><div className="col"><Field label="BP Dia" value={vitalForm.blood_pressure_diastolic} onChange={(v)=>setVitalForm({...vitalForm, blood_pressure_diastolic:v})} /></div></div>
          <div className="row g-2"><div className="col"><Field label="SpO2" value={vitalForm.spo2} onChange={(v)=>setVitalForm({...vitalForm, spo2:v})} /></div><div className="col"><Field label="Pain" value={vitalForm.pain_score} onChange={(v)=>setVitalForm({...vitalForm, pain_score:v})} /></div></div>
          <Field label="Notes" value={vitalForm.notes} onChange={(v)=>setVitalForm({...vitalForm, notes:v})} />
          <button className="btn btn-primary">Save Vitals</button>
        </form></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Create Shift Task</h5><form onSubmit={submitTask} className="vstack gap-2">
          <Field label="Patient ID" value={taskForm.patient_id} onChange={(v)=>setTaskForm({...taskForm, patient_id:v})} />
          <Field label="Title" required value={taskForm.title} onChange={(v)=>setTaskForm({...taskForm, title:v})} />
          <Field label="Task Type" value={taskForm.task_type} onChange={(v)=>setTaskForm({...taskForm, task_type:v})} />
          <label className="form-label">Priority<select className="form-select" value={taskForm.priority} onChange={(e)=>setTaskForm({...taskForm, priority:e.target.value})}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label>
          <Field label="Due At" type="datetime-local" value={taskForm.due_at} onChange={(v)=>setTaskForm({...taskForm, due_at:v})} />
          <button className="btn btn-primary">Create Task</button>
        </form></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Medication Administration</h5><form onSubmit={submitMedication} className="vstack gap-2">
          <Field label="Patient ID" required value={medForm.patient_id} onChange={(v)=>setMedForm({...medForm, patient_id:v})} />
          <Field label="Medication" required value={medForm.medication_name} onChange={(v)=>setMedForm({...medForm, medication_name:v})} />
          <div className="row g-2"><div className="col"><Field label="Dose" value={medForm.dose} onChange={(v)=>setMedForm({...medForm, dose:v})} /></div><div className="col"><Field label="Route" value={medForm.route} onChange={(v)=>setMedForm({...medForm, route:v})} /></div></div>
          <Field label="Frequency" value={medForm.frequency} onChange={(v)=>setMedForm({...medForm, frequency:v})} />
          <Field label="Scheduled At" type="datetime-local" value={medForm.scheduled_at} onChange={(v)=>setMedForm({...medForm, scheduled_at:v})} />
          <button className="btn btn-primary">Schedule Medication</button>
        </form></div></div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4"><div style={cardStyle}><h5>Latest Vitals</h5><ul className="list-group list-group-flush">{vitals.slice(0, 8).map(v => <li key={v.id} className="list-group-item px-0">#{v.id} {v.patient_id} — T:{v.temperature || '-'} P:{v.pulse || '-'} SpO2:{v.spo2 || '-'}</li>)}</ul></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Open Tasks</h5><ul className="list-group list-group-flush">{tasks.slice(0, 8).map(t => <li key={t.id} className="list-group-item px-0">#{t.id} {t.title} <span className="badge bg-secondary">{t.status}</span></li>)}</ul></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Medication Queue</h5><ul className="list-group list-group-flush">{medications.slice(0, 8).map(m => <li key={m.id} className="list-group-item px-0">#{m.id} {m.medication_name} — {m.status}</li>)}</ul></div></div>
      </div>
    </div>
  );
}
