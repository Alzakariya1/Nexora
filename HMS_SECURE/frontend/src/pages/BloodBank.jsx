import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { bloodBankApi } from '../api/bloodBankApi';

const cardStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, boxShadow: '0 8px 18px rgba(15,23,42,.05)' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const groups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const components = ['whole_blood','packed_rbc','platelets','plasma','cryoprecipitate'];

function Field({ label, value, onChange, type = 'text', required = false }) {
  return <label className="form-label small mb-1">{label}<input className="form-control form-control-sm" type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function Select({ label, value, onChange, children }) {
  return <label className="form-label small mb-1">{label}<select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;
}
function Badge({ value }) {
  const v = String(value || '').toLowerCase();
  const cls = v.includes('emergency') || v.includes('incompatible') || v.includes('expired') || v.includes('discard') ? 'danger' : v.includes('pending') || v.includes('requested') ? 'warning' : v.includes('available') || v.includes('compatible') || v.includes('approved') ? 'success' : 'secondary';
  return <span className={`badge bg-${cls}`}>{value || '-'}</span>;
}

export default function BloodBank() {
  const [dashboard, setDashboard] = useState({});
  const [donors, setDonors] = useState([]);
  const [units, setUnits] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [issues, setIssues] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [donorForm, setDonorForm] = useState({ full_name: '', phone: '', age: '', gender: '', blood_group: 'O+', eligibility_status: 'pending', screening_status: 'pending', consent_recorded: false });
  const [unitForm, setUnitForm] = useState({ bag_number: '', donor_id: '', blood_group: 'O+', component_type: 'packed_rbc', volume_ml: '450', collection_date: '', expiry_date: '', storage_location: '', storage_temperature_c: '', screening_status: 'pending', status: 'available' });
  const [reqForm, setReqForm] = useState({ patient_id: '', patient_name: '', patient_blood_group: 'O+', component_type: 'packed_rbc', units_requested: 1, priority: 'routine', indication: '', requested_by_doctor_id: '', request_source: 'ipd' });
  const [matchForm, setMatchForm] = useState({ requisition_id: '', patient_id: '', patient_name: '', patient_blood_group: 'O+', unit_id: '', compatibility_result: 'pending', test_notes: '' });
  const [issueForm, setIssueForm] = useState({ unit_id: '', requisition_id: '', cross_match_id: '', patient_id: '', patient_name: '', issue_type: 'issue', emergency_reason: '', volume_issued_ml: '', notes: '' });
  const [reservationForm, setReservationForm] = useState({ unit_id: '', requisition_id: '', patient_id: '', patient_name: '', reserved_until: '', notes: '' });

  async function load() {
    setLoading(true);
    try {
      const [dash, donorList, unitList, reqList, matchList, issueList, reservationList] = await Promise.all([
        bloodBankApi.dashboard(), bloodBankApi.donors(), bloodBankApi.units(), bloodBankApi.requisitions(), bloodBankApi.crossMatches(), bloodBankApi.issues(), bloodBankApi.reservations(),
      ]);
      setDashboard(dash.data || {}); setDonors(donorList.data || []); setUnits(unitList.data || []); setRequisitions(reqList.data || []); setMatches(matchList.data || []); setIssues(issueList.data || []); setReservations(reservationList.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Blood bank data load failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(label, fn, reset) {
    try { await fn(); toast.success(label); reset?.(); load(); }
    catch (err) { toast.error(err.response?.data?.message || `${label} failed`); }
  }

  return <div className="page-stack">
    <div className="page-header"><div><h2>Blood Bank</h2><p>Donor registry, blood inventory safety, requisition approval, compatibility validation, emergency issue and traceability.</p></div><button className="btn btn-outline-primary" onClick={load} disabled={loading}>Refresh</button></div>
    <div style={gridStyle}>{[
      ['Eligible Donors', dashboard.eligibleDonors || 0], ['Available Units', dashboard.availableUnits || 0], ['Reserved', dashboard.reservedUnits || 0], ['Issued', dashboard.issuedUnits || 0], ['Pending Reqs', dashboard.pendingRequisitions || 0], ['Emergency Reqs', dashboard.emergencyRequisitions || 0], ['Expiring Soon', dashboard.expiringSoon || 0], ['Wastage', dashboard.wastageCount || 0],
    ].map(([label, value]) => <div key={label} style={cardStyle}><div className="text-muted small">{label}</div><div className="h3 mb-0">{value}</div></div>)}</div>

    <div className="row g-3 mt-1">
      <div className="col-xl-4"><div style={cardStyle}><h5>Register Donor</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Donor registered', () => bloodBankApi.createDonor(donorForm), () => setDonorForm({ full_name: '', phone: '', age: '', gender: '', blood_group: 'O+', eligibility_status: 'pending', screening_status: 'pending', consent_recorded: false }));}}><Field label="Full Name" required value={donorForm.full_name} onChange={(v)=>setDonorForm({...donorForm, full_name:v})}/><Field label="Phone" value={donorForm.phone} onChange={(v)=>setDonorForm({...donorForm, phone:v})}/><Select label="Blood Group" value={donorForm.blood_group} onChange={(v)=>setDonorForm({...donorForm, blood_group:v})}>{groups.map(g=><option key={g}>{g}</option>)}</Select><Select label="Eligibility" value={donorForm.eligibility_status} onChange={(v)=>setDonorForm({...donorForm, eligibility_status:v})}><option>pending</option><option>eligible</option><option>deferred</option><option>rejected</option></Select><button className="btn btn-primary btn-sm">Save Donor</button></form></div></div>
      <div className="col-xl-4"><div style={cardStyle}><h5>Add Blood Unit</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Blood unit added', () => bloodBankApi.createUnit(unitForm), () => setUnitForm({ bag_number: '', donor_id: '', blood_group: 'O+', component_type: 'packed_rbc', volume_ml: '450', collection_date: '', expiry_date: '', storage_location: '', storage_temperature_c: '', screening_status: 'pending', status: 'available' }));}}><Field label="Bag Number" value={unitForm.bag_number} onChange={(v)=>setUnitForm({...unitForm, bag_number:v})}/><Field label="Donor ID" value={unitForm.donor_id} onChange={(v)=>setUnitForm({...unitForm, donor_id:v})}/><Select label="Blood Group" value={unitForm.blood_group} onChange={(v)=>setUnitForm({...unitForm, blood_group:v})}>{groups.map(g=><option key={g}>{g}</option>)}</Select><Select label="Component" value={unitForm.component_type} onChange={(v)=>setUnitForm({...unitForm, component_type:v})}>{components.map(c=><option key={c}>{c}</option>)}</Select><Field label="Expiry Date" type="date" value={unitForm.expiry_date} onChange={(v)=>setUnitForm({...unitForm, expiry_date:v})}/><Select label="Screening" value={unitForm.screening_status} onChange={(v)=>setUnitForm({...unitForm, screening_status:v})}><option>pending</option><option>cleared</option><option>rejected</option><option>quarantined</option></Select><button className="btn btn-primary btn-sm">Add Unit</button></form></div></div>
      <div className="col-xl-4"><div style={cardStyle}><h5>Create Requisition</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Requisition created', () => bloodBankApi.createRequisition(reqForm), () => setReqForm({ patient_id: '', patient_name: '', patient_blood_group: 'O+', component_type: 'packed_rbc', units_requested: 1, priority: 'routine', indication: '', requested_by_doctor_id: '', request_source: 'ipd' }));}}><Field label="Patient ID" value={reqForm.patient_id} onChange={(v)=>setReqForm({...reqForm, patient_id:v})}/><Field label="Patient Name" value={reqForm.patient_name} onChange={(v)=>setReqForm({...reqForm, patient_name:v})}/><Select label="Patient Blood Group" value={reqForm.patient_blood_group} onChange={(v)=>setReqForm({...reqForm, patient_blood_group:v})}>{groups.map(g=><option key={g}>{g}</option>)}</Select><Field label="Doctor ID *" required value={reqForm.requested_by_doctor_id} onChange={(v)=>setReqForm({...reqForm, requested_by_doctor_id:v})}/><Select label="Priority" value={reqForm.priority} onChange={(v)=>setReqForm({...reqForm, priority:v})}><option>routine</option><option>urgent</option><option>stat</option><option>emergency</option></Select><Field label="Indication" value={reqForm.indication} onChange={(v)=>setReqForm({...reqForm, indication:v})}/><button className="btn btn-primary btn-sm">Create Request</button></form></div></div>
    </div>

    <div className="row g-3 mt-1">
      <div className="col-xl-4"><div style={cardStyle}><h5>Cross-match</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Cross-match saved', () => bloodBankApi.createCrossMatch(matchForm), () => setMatchForm({ requisition_id: '', patient_id: '', patient_name: '', patient_blood_group: 'O+', unit_id: '', compatibility_result: 'pending', test_notes: '' }));}}><Field label="Requisition ID" value={matchForm.requisition_id} onChange={(v)=>setMatchForm({...matchForm, requisition_id:v})}/><Field label="Patient ID" value={matchForm.patient_id} onChange={(v)=>setMatchForm({...matchForm, patient_id:v})}/><Select label="Patient Blood Group" value={matchForm.patient_blood_group} onChange={(v)=>setMatchForm({...matchForm, patient_blood_group:v})}>{groups.map(g=><option key={g}>{g}</option>)}</Select><Field label="Unit ID" required value={matchForm.unit_id} onChange={(v)=>setMatchForm({...matchForm, unit_id:v})}/><Select label="Result" value={matchForm.compatibility_result} onChange={(v)=>setMatchForm({...matchForm, compatibility_result:v})}><option>pending</option><option>compatible</option><option>incompatible</option></Select><button className="btn btn-primary btn-sm">Save Match</button></form></div></div>
      <div className="col-xl-4"><div style={cardStyle}><h5>Reserve Unit</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Unit reserved', () => bloodBankApi.createReservation(reservationForm), () => setReservationForm({ unit_id: '', requisition_id: '', patient_id: '', patient_name: '', reserved_until: '', notes: '' }));}}><Field label="Unit ID" required value={reservationForm.unit_id} onChange={(v)=>setReservationForm({...reservationForm, unit_id:v})}/><Field label="Requisition ID" value={reservationForm.requisition_id} onChange={(v)=>setReservationForm({...reservationForm, requisition_id:v})}/><Field label="Patient ID" value={reservationForm.patient_id} onChange={(v)=>setReservationForm({...reservationForm, patient_id:v})}/><Field label="Patient Name" value={reservationForm.patient_name} onChange={(v)=>setReservationForm({...reservationForm, patient_name:v})}/><Field label="Reserved Until" type="datetime-local" value={reservationForm.reserved_until} onChange={(v)=>setReservationForm({...reservationForm, reserved_until:v})}/><button className="btn btn-primary btn-sm">Reserve</button></form></div></div>
      <div className="col-xl-4"><div style={cardStyle}><h5>Issue / Return / Discard</h5><form className="vstack gap-2" onSubmit={(e)=>{e.preventDefault(); save('Unit movement recorded', () => bloodBankApi.createIssue(issueForm), () => setIssueForm({ unit_id: '', requisition_id: '', cross_match_id: '', patient_id: '', patient_name: '', issue_type: 'issue', emergency_reason: '', volume_issued_ml: '', notes: '' }));}}><Field label="Unit ID" required value={issueForm.unit_id} onChange={(v)=>setIssueForm({...issueForm, unit_id:v})}/><Field label="Cross-match ID" value={issueForm.cross_match_id} onChange={(v)=>setIssueForm({...issueForm, cross_match_id:v})}/><Field label="Patient ID" value={issueForm.patient_id} onChange={(v)=>setIssueForm({...issueForm, patient_id:v})}/><Select label="Movement" value={issueForm.issue_type} onChange={(v)=>setIssueForm({...issueForm, issue_type:v})}><option>issue</option><option>emergency_issue</option><option>return</option><option>discard</option></Select>{issueForm.issue_type === 'emergency_issue' && <Field label="Emergency Reason *" required value={issueForm.emergency_reason} onChange={(v)=>setIssueForm({...issueForm, emergency_reason:v})}/>}<Field label="Volume ML" value={issueForm.volume_issued_ml} onChange={(v)=>setIssueForm({...issueForm, volume_issued_ml:v})}/><button className="btn btn-primary btn-sm">Record</button></form></div></div>
    </div>

    <div className="row g-3 mt-1">
      <div className="col-lg-7"><div style={cardStyle}><h5>Blood Unit Inventory</h5><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>ID</th><th>Bag</th><th>Group</th><th>Component</th><th>Screen</th><th>Status</th><th>Expiry</th></tr></thead><tbody>{units.slice(0,18).map(u=><tr key={u.id}><td>#{u.id}</td><td>{u.bag_number || u.unit_uid}</td><td>{u.blood_group}</td><td>{u.component_type}</td><td><Badge value={u.screening_status}/></td><td><Badge value={u.status}/></td><td>{u.expiry_date ? new Date(u.expiry_date).toLocaleDateString() : '-'}</td></tr>)}</tbody></table></div></div></div>
      <div className="col-lg-5"><div style={cardStyle}><h5>Stock Summary</h5><div className="table-responsive"><table className="table table-sm"><thead><tr><th>Group</th><th>Component</th><th>Avail</th><th>Res</th><th>Exp</th><th>Total</th></tr></thead><tbody>{(dashboard.inventoryByGroup || []).map((r, i)=><tr key={i}><td>{r.blood_group}</td><td>{r.component_type}</td><td>{r.available}</td><td>{r.reserved}</td><td>{r.expired}</td><td>{r.total}</td></tr>)}</tbody></table></div></div></div>
    </div>

    <div className="row g-3 mt-1">
      <div className="col-lg-6"><div style={cardStyle}><h5>Requisition Approvals</h5><div className="table-responsive"><table className="table table-sm"><thead><tr><th>ID</th><th>Patient</th><th>Group</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{requisitions.slice(0,10).map(r=><tr key={r.id}><td>#{r.id}</td><td>{r.patient_name || r.patient_id}</td><td>{r.patient_blood_group}</td><td><Badge value={r.priority}/></td><td><Badge value={r.status}/></td><td>{r.status === 'requested' && <><button className="btn btn-sm btn-outline-success me-1" onClick={()=>save('Approved', () => bloodBankApi.approveRequisition(r.id))}>Approve</button><button className="btn btn-sm btn-outline-danger" onClick={()=>save('Rejected', () => bloodBankApi.rejectRequisition(r.id, { reason: 'Rejected from UI' }))}>Reject</button></>}</td></tr>)}</tbody></table></div></div></div>
      <div className="col-lg-6"><div style={cardStyle}><h5>Traceability: Cross-match & Issues</h5><ul className="list-group list-group-flush">{matches.slice(0,5).map(m=><li key={`m${m.id}`} className="list-group-item px-0">Cross-match #{m.id}: Unit {m.unit_id} → {m.patient_name || m.patient_id || 'Patient'} <Badge value={m.compatibility_result}/> {m.compatibility_warning && <div className="small text-danger">{m.compatibility_warning}</div>}</li>)}{issues.slice(0,5).map(i=><li key={`i${i.id}`} className="list-group-item px-0">Issue #{i.id}: Unit {i.unit_id} — <Badge value={i.status}/> {i.emergency_issue ? <span className="text-danger small"> emergency override</span> : null}</li>)}</ul></div></div>
    </div>
  </div>;
}
