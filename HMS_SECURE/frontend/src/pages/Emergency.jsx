import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { emergencyApi } from '../api/emergencyApi';

const cardStyle = { border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fff' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 };

export default function Emergency() {
  const [dashboard, setDashboard] = useState({});
  const [cases, setCases] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [caseForm, setCaseForm] = useState({ patient_id: '', patient_name: '', age: '', gender: '', phone: '', arrival_mode: 'walk_in', chief_complaint: '', triage_category: 'green', mlc_required: false, assigned_doctor_id: '', notes: '' });
  const [triageForm, setTriageForm] = useState({ emergency_case_id: '', triage_category: 'green', triage_score: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ emergency_case_id: '', transfer_type: 'ipd', target_department: '', target_bed_id: '', reason: '', handover_notes: '' });

  async function load() {
    setLoading(true);
    try {
      const [dash, list, transferList] = await Promise.all([
        emergencyApi.dashboard(), emergencyApi.cases(), emergencyApi.transfers(),
      ]);
      setDashboard(dash.data || {});
      setCases(list.data || []);
      setTransfers(transferList.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Emergency data load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitCase(e) {
    e.preventDefault();
    try {
      await emergencyApi.createCase(caseForm);
      toast.success('Emergency case registered');
      setCaseForm({ patient_id: '', patient_name: '', age: '', gender: '', phone: '', arrival_mode: 'walk_in', chief_complaint: '', triage_category: 'green', mlc_required: false, assigned_doctor_id: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Emergency registration failed'); }
  }

  async function submitTriage(e) {
    e.preventDefault();
    try {
      await emergencyApi.addTriage(triageForm.emergency_case_id, { ...triageForm, vitals: {} });
      toast.success('Triage recorded');
      setTriageForm({ emergency_case_id: '', triage_category: 'green', triage_score: '', notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Triage save failed'); }
  }

  async function submitTransfer(e) {
    e.preventDefault();
    try {
      await emergencyApi.createTransfer(transferForm.emergency_case_id, transferForm);
      toast.success('Emergency transfer requested');
      setTransferForm({ emergency_case_id: '', transfer_type: 'ipd', target_department: '', target_bed_id: '', reason: '', handover_notes: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Transfer request failed'); }
  }

  async function closeCase(row, status) {
    try {
      await emergencyApi.updateCase(row.id, { status });
      toast.success(`Case marked ${status}`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Case update failed'); }
  }

  const Field = ({ label, value, onChange, type = 'text', required = false }) => (
    <label className="form-label">{label}<input className="form-control" type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label>
  );

  return (
    <div className="page-stack">
      <div className="page-header"><div><h2>Emergency / Casualty</h2><p>Triage, MLC flags, emergency clinical notes, transfer and casualty queue foundation.</p></div><button className="btn btn-outline-primary" onClick={load} disabled={loading}>Refresh</button></div>
      <div style={gridStyle}>
        {[
          ['Active Cases', dashboard.activeCases || 0], ['Today Cases', dashboard.todayCases || 0], ['Critical Queue', dashboard.criticalQueue || 0], ['MLC Cases', dashboard.mlcCases || 0], ['Pending Transfers', dashboard.pendingTransfers || 0], ['Closed Today', dashboard.dischargedToday || 0],
        ].map(([label, value]) => <div key={label} style={cardStyle}><div className="text-muted small">{label}</div><div className="h3 mb-0">{value}</div></div>)}
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4"><div style={cardStyle}><h5>Register Emergency Case</h5><form onSubmit={submitCase} className="vstack gap-2">
          <Field label="Existing Patient ID" value={caseForm.patient_id} onChange={(v)=>setCaseForm({...caseForm, patient_id:v})} />
          <Field label="Patient Name" value={caseForm.patient_name} onChange={(v)=>setCaseForm({...caseForm, patient_name:v})} />
          <div className="row g-2"><div className="col"><Field label="Age" value={caseForm.age} onChange={(v)=>setCaseForm({...caseForm, age:v})} /></div><div className="col"><Field label="Gender" value={caseForm.gender} onChange={(v)=>setCaseForm({...caseForm, gender:v})} /></div></div>
          <Field label="Chief Complaint" required value={caseForm.chief_complaint} onChange={(v)=>setCaseForm({...caseForm, chief_complaint:v})} />
          <label className="form-label">Triage<select className="form-select" value={caseForm.triage_category} onChange={(e)=>setCaseForm({...caseForm, triage_category:e.target.value})}><option>red</option><option>orange</option><option>yellow</option><option>green</option><option>blue</option></select></label>
          <label className="form-check"><input className="form-check-input" type="checkbox" checked={caseForm.mlc_required} onChange={(e)=>setCaseForm({...caseForm, mlc_required:e.target.checked})} /> <span className="form-check-label">MLC required</span></label>
          <button className="btn btn-primary">Register Case</button>
        </form></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Record Triage</h5><form onSubmit={submitTriage} className="vstack gap-2">
          <Field label="Emergency Case ID" required value={triageForm.emergency_case_id} onChange={(v)=>setTriageForm({...triageForm, emergency_case_id:v})} />
          <label className="form-label">Category<select className="form-select" value={triageForm.triage_category} onChange={(e)=>setTriageForm({...triageForm, triage_category:e.target.value})}><option>red</option><option>orange</option><option>yellow</option><option>green</option><option>blue</option></select></label>
          <Field label="Triage Score" value={triageForm.triage_score} onChange={(v)=>setTriageForm({...triageForm, triage_score:v})} />
          <Field label="Notes" value={triageForm.notes} onChange={(v)=>setTriageForm({...triageForm, notes:v})} />
          <button className="btn btn-primary">Save Triage</button>
        </form></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Transfer / Admit</h5><form onSubmit={submitTransfer} className="vstack gap-2">
          <Field label="Emergency Case ID" required value={transferForm.emergency_case_id} onChange={(v)=>setTransferForm({...transferForm, emergency_case_id:v})} />
          <label className="form-label">Transfer Type<select className="form-select" value={transferForm.transfer_type} onChange={(e)=>setTransferForm({...transferForm, transfer_type:e.target.value})}><option value="ipd">IPD Admission</option><option value="ot">OT</option><option value="external_referral">External Referral</option></select></label>
          <Field label="Target Department" value={transferForm.target_department} onChange={(v)=>setTransferForm({...transferForm, target_department:v})} />
          <Field label="Reason" value={transferForm.reason} onChange={(v)=>setTransferForm({...transferForm, reason:v})} />
          <button className="btn btn-primary">Request Transfer</button>
        </form></div></div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-8"><div style={cardStyle}><h5>Emergency Queue</h5><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>ID</th><th>Patient</th><th>Triage</th><th>Status</th><th>MLC</th><th>Actions</th></tr></thead><tbody>{cases.slice(0, 12).map(row => <tr key={row.id}><td>#{row.id}</td><td>{row.patient_name || row.patient_id}</td><td><span className="badge bg-secondary">{row.triage_category}</span></td><td>{row.status}</td><td>{row.mlc_required ? 'Yes' : 'No'}</td><td><button className="btn btn-sm btn-outline-success me-1" onClick={()=>closeCase(row, 'discharged')}>Discharge</button><button className="btn btn-sm btn-outline-secondary" onClick={()=>closeCase(row, 'referred')}>Refer</button></td></tr>)}</tbody></table></div></div></div>
        <div className="col-lg-4"><div style={cardStyle}><h5>Transfers</h5><ul className="list-group list-group-flush">{transfers.slice(0, 8).map(t => <li key={t.id} className="list-group-item px-0">#{t.id} Case {t.emergency_case_id} — {t.transfer_type} <span className="badge bg-secondary">{t.status}</span></li>)}</ul></div></div>
      </div>
    </div>
  );
}
