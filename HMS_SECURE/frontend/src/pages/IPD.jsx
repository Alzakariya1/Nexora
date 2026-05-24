import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { DataTable } from '../components';
import { ipdApi } from '../api';

const emptyAdmission = {
  patient_id: '',
  primary_consultant_id: '',
  bed_id: '',
  admission_type: 'planned',
  admission_reason: '',
  diagnosis: '',
  admission_date: '',
};

const ACTIVE_STATUSES = ['admission_requested', 'admitted', 'under_treatment', 'discharge_initiated', 'billing_pending'];

function patientLabel(p) {
  return `${p.full_name || 'Patient'} (${p.patient_id || p.id})`;
}

function doctorLabel(d) {
  return `${d.full_name || 'Doctor'} (${d.doctor_id || d.id})`;
}

export default function IPD({ admissions = [], setAdmissions, patients = [], doctors = [], beds = [], onChanged, permissions = {} }) {
  const [form, setForm] = useState(emptyAdmission);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  const availableBeds = useMemo(() => beds.filter((b) => !['occupied', 'admitted'].includes(String(b.status || '').toLowerCase())), [beds]);
  const rows = useMemo(() => admissions.filter((a) => {
    if (statusFilter === 'all') return a.status !== 'archived';
    if (statusFilter === 'active') return ACTIVE_STATUSES.includes(a.status);
    return a.status === statusFilter;
  }), [admissions, statusFilter]);

  async function refresh() {
    const { data } = await ipdApi.list();
    setAdmissions(Array.isArray(data) ? data : []);
    if (onChanged) await onChanged();
  }

  async function admit(e) {
    e.preventDefault();
    if (!form.patient_id || !form.primary_consultant_id || !form.bed_id || !form.admission_reason.trim()) {
      toast.error('Patient, consultant, bed and admission reason are required.');
      return;
    }
    try {
      setLoading(true);
      await ipdApi.admit(form);
      setForm(emptyAdmission);
      await refresh();
      toast.success('Patient admitted successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admission failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(row, status) {
    const note = prompt(`Note for status: ${status}`) || '';
    try {
      await ipdApi.updateStatus(row.id, { status, note });
      await refresh();
      toast.success('IPD status updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  }

  async function transferBed(row) {
    const bedId = prompt('Enter new available bed numeric ID');
    if (!bedId) return;
    const reason = prompt('Transfer reason');
    if (!reason) return toast.error('Transfer reason is required');
    try {
      await ipdApi.transferBed(row.id, { bed_id: Number(bedId), reason });
      await refresh();
      toast.success('Bed transfer completed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bed transfer failed');
    }
  }

  async function discharge(row) {
    const discharge_summary = prompt('Discharge summary');
    if (!discharge_summary) return toast.error('Discharge summary is required');
    const discharge_advice = prompt('Discharge advice / follow-up instructions') || '';
    try {
      await ipdApi.discharge({ ipd_id: row.id, discharge_summary, discharge_advice });
      await refresh();
      toast.success('Patient discharged');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Discharge failed');
    }
  }

  async function addNursing(row) {
    const note = prompt('Nursing note');
    if (!note) return;
    try {
      await ipdApi.addNursingNote({ ipd_id: row.id, note, vitals: {} });
      await refresh();
      toast.success('Nursing note added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nursing note failed');
    }
  }

  async function archive(row) {
    const reason = prompt('Archive reason');
    if (!reason) return toast.error('Archive reason is required');
    try {
      await ipdApi.archive(row.id, reason);
      await refresh();
      toast.success('IPD admission archived safely');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Archive failed');
    }
  }

  return (
    <section className="modulePage ipdPage">
      <div className="sectionTitleRow">
        <div>
          <h2>IPD / Admission Workflow</h2>
          <p className="muted">Manage admission, bed allocation, ward transfer, nursing notes and discharge without harming patient history.</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active">Active admissions</option>
          <option value="all">All non-archived</option>
          <option value="admitted">Admitted</option>
          <option value="under_treatment">Under treatment</option>
          <option value="discharge_initiated">Discharge initiated</option>
          <option value="billing_pending">Billing pending</option>
          <option value="discharged">Discharged</option>
        </select>
      </div>

      {permissions.ipdCreate && (
        <form className="card formGrid" onSubmit={admit}>
          <label><span>Patient *</span><select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} required><option value="">Select patient</option>{patients.map((p) => <option key={p.id} value={p.patient_id || p.id}>{patientLabel(p)}</option>)}</select></label>
          <label><span>Primary Consultant *</span><select value={form.primary_consultant_id} onChange={(e) => setForm({ ...form, primary_consultant_id: e.target.value })} required><option value="">Select doctor</option>{doctors.map((d) => <option key={d.id} value={d.doctor_id || d.id}>{doctorLabel(d)}</option>)}</select></label>
          <label><span>Available Bed *</span><select value={form.bed_id} onChange={(e) => setForm({ ...form, bed_id: e.target.value })} required><option value="">Select bed</option>{availableBeds.map((b) => <option key={b.id} value={b.id}>#{b.id} - {b.ward} / {b.bed_number}</option>)}</select></label>
          <label><span>Admission Type *</span><select value={form.admission_type} onChange={(e) => setForm({ ...form, admission_type: e.target.value })}><option value="planned">Planned</option><option value="emergency">Emergency</option><option value="daycare">Daycare</option><option value="transfer">Transfer</option></select></label>
          <label><span>Admission Date</span><input type="datetime-local" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></label>
          <label><span>Initial Diagnosis</span><input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Acute abdomen" /></label>
          <label className="wide"><span>Admission Reason *</span><textarea value={form.admission_reason} onChange={(e) => setForm({ ...form, admission_reason: e.target.value })} required placeholder="Clinical reason for admission" /></label>
          <div className="wide"><button className="primaryBtn" disabled={loading}>{loading ? 'Saving...' : 'Admit Patient'}</button></div>
        </form>
      )}

      <div className="card">
        <div className="sectionTitleRow"><h3>Admission Register</h3><span className="muted">{rows.length} records</span></div>
        <DataTable rows={rows} cols={["id", "patient_name", "patient_id", "doctor_name", "ward", "bed_number", "admission_type", "status", "admission_date", "discharge_date"]} />
        <div className="tableActionList">
          {rows.slice(0, 30).map((row) => (
            <div className="actionRow" key={row.id}>
              <span>#{row.id} {row.patient_name || row.patient_id} — {row.ward}/{row.bed_number} — <b>{row.status}</b></span>
              {permissions.ipdCreate && <div className="actionButtons"><button onClick={() => updateStatus(row, 'under_treatment')}>Under Treatment</button><button onClick={() => updateStatus(row, 'discharge_initiated')}>Start Discharge</button><button onClick={() => updateStatus(row, 'billing_pending')}>Billing Pending</button><button onClick={() => transferBed(row)}>Transfer Bed</button><button onClick={() => addNursing(row)}>Nursing Note</button><button onClick={() => discharge(row)}>Discharge</button><button className="dangerBtn" onClick={() => archive(row)}>Archive</button></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
