import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, CalendarDays, ClipboardCheck, Clock, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { hrStaffApi } from '../api/hrStaffApi';

const today = new Date().toISOString().slice(0, 10);
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

const emptyStaff = { full_name: '', phone: '', email: '', role: 'staff', designation: '', department_name: '', employment_type: 'full_time', joining_date: today, salary_basic: '', status: 'active' };
const emptyAttendance = { staff_id: '', attendance_date: today, shift: 'General', status: 'present', notes: '' };
const emptyRoster = { staff_id: '', roster_date: today, shift_name: 'Morning', start_time: '09:00', end_time: '17:00', ward_or_location: '', notes: '' };
const emptyLeave = { staff_id: '', leave_type: 'casual', start_date: today, end_date: today, reason: '' };

function Card({ icon: Icon, title, value, sub }) {
  return <div className="stat-card"><div><p>{title}</p><h3>{value ?? 0}</h3>{sub && <small>{sub}</small>}</div>{Icon && <Icon size={24} />}</div>;
}
function field(e, setter) { const { name, value } = e.target; setter((prev) => ({ ...prev, [name]: value })); }

export default function HRStaff() {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payrollExports, setPayrollExports] = useState([]);
  const [staffForm, setStaffForm] = useState(emptyStaff);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendance);
  const [rosterForm, setRosterForm] = useState(emptyRoster);
  const [leaveForm, setLeaveForm] = useState(emptyLeave);
  const [payrollForm, setPayrollForm] = useState({ period_start: startOfMonth, period_end: today, notes: '' });

  const staffOptions = useMemo(() => staff.filter((s) => s.status !== 'terminated'), [staff]);
  async function load() {
    setLoading(true);
    try {
      const [dash, s, a, r, l, p] = await Promise.all([
        hrStaffApi.dashboard(), hrStaffApi.staff(), hrStaffApi.attendance({ from: startOfMonth, to: today }), hrStaffApi.rosters({ from: startOfMonth, to: today }), hrStaffApi.leaves(), hrStaffApi.payrollExports(),
      ]);
      setDashboard(dash.data || {}); setStaff(s.data || []); setAttendance(a.data || []); setRosters(r.data || []); setLeaves(l.data || []); setPayrollExports(p.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'HR / Staff data load failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function saveStaff(e) { e.preventDefault(); try { await hrStaffApi.createStaff(staffForm); setStaffForm(emptyStaff); toast.success('Staff profile saved'); load(); } catch (err) { toast.error(err.response?.data?.message || 'Staff save failed'); } }
  async function markAttendance(e) { e.preventDefault(); try { await hrStaffApi.markAttendance(attendanceForm); setAttendanceForm(emptyAttendance); toast.success('Attendance marked'); load(); } catch (err) { toast.error(err.response?.data?.message || 'Attendance save failed'); } }
  async function saveRoster(e) { e.preventDefault(); try { await hrStaffApi.createRoster(rosterForm); setRosterForm(emptyRoster); toast.success('Shift roster saved'); load(); } catch (err) { toast.error(err.response?.data?.message || 'Roster save failed'); } }
  async function saveLeave(e) { e.preventDefault(); try { await hrStaffApi.createLeave(leaveForm); setLeaveForm(emptyLeave); toast.success('Leave request saved'); load(); } catch (err) { toast.error(err.response?.data?.message || 'Leave save failed'); } }
  async function reviewLeave(row, status) { try { await hrStaffApi.reviewLeave(row.id, { status, review_notes: `${status} from HR dashboard` }); toast.success(`Leave ${status}`); load(); } catch (err) { toast.error(err.response?.data?.message || 'Leave review failed'); } }
  async function createPayroll(e) { e.preventDefault(); try { await hrStaffApi.createPayrollExport(payrollForm); toast.success('Payroll export generated'); load(); } catch (err) { toast.error(err.response?.data?.message || 'Payroll export failed'); } }

  return <div className="page-stack">
    <div className="page-header"><div><p className="eyebrow">Enterprise workforce operations</p><h2>HR / Staff Module</h2><p>Staff profiles, attendance, shift roster, leave and payroll export basics.</p></div><button className="btn-secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
    <div className="stats-grid">
      <Card icon={Users} title="Total Staff" value={dashboard.totalStaff} sub={`${dashboard.activeStaff || 0} active`} />
      <Card icon={ClipboardCheck} title="Attendance Marked" value={dashboard.attendanceMarked} sub={`${dashboard.lateCount || 0} late`} />
      <Card icon={CalendarDays} title="Pending Leaves" value={dashboard.pendingLeaves} sub={`${dashboard.approvedLeaves || 0} approved`} />
      <Card icon={Clock} title="Rostered Shifts" value={dashboard.rosteredShifts} />
      <Card icon={FileSpreadsheet} title="Payroll Exports" value={dashboard.payrollExports} />
    </div>

    <div className="grid-two">
      <section className="panel"><h3>Staff Profiles</h3><form className="form-grid" onSubmit={saveStaff}>
        <input name="full_name" placeholder="Full name" value={staffForm.full_name} onChange={(e)=>field(e,setStaffForm)} required />
        <input name="phone" placeholder="Phone" value={staffForm.phone} onChange={(e)=>field(e,setStaffForm)} />
        <input name="email" placeholder="Email" value={staffForm.email} onChange={(e)=>field(e,setStaffForm)} />
        <input name="designation" placeholder="Designation" value={staffForm.designation} onChange={(e)=>field(e,setStaffForm)} />
        <input name="department_name" placeholder="Department" value={staffForm.department_name} onChange={(e)=>field(e,setStaffForm)} />
        <select name="employment_type" value={staffForm.employment_type} onChange={(e)=>field(e,setStaffForm)}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="consultant">Consultant</option></select>
        <input name="salary_basic" placeholder="Basic salary" type="number" value={staffForm.salary_basic} onChange={(e)=>field(e,setStaffForm)} />
        <button className="btn-primary">Save Staff</button></form>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead><tbody>{staff.slice(0,8).map((s)=><tr key={s.id}><td>{s.staff_uid || s.id}</td><td>{s.full_name}</td><td>{s.department_name || '-'}</td><td>{s.designation || '-'}</td><td>{s.status}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel"><h3>Attendance</h3><form className="form-grid" onSubmit={markAttendance}>
        <select name="staff_id" value={attendanceForm.staff_id} onChange={(e)=>field(e,setAttendanceForm)} required><option value="">Select staff</option>{staffOptions.map((s)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <input name="attendance_date" type="date" value={attendanceForm.attendance_date} onChange={(e)=>field(e,setAttendanceForm)} />
        <input name="shift" placeholder="Shift" value={attendanceForm.shift} onChange={(e)=>field(e,setAttendanceForm)} />
        <select name="status" value={attendanceForm.status} onChange={(e)=>field(e,setAttendanceForm)}><option value="present">Present</option><option value="late">Late</option><option value="half_day">Half day</option><option value="absent">Absent</option><option value="leave">Leave</option></select>
        <input name="notes" placeholder="Notes" value={attendanceForm.notes} onChange={(e)=>field(e,setAttendanceForm)} />
        <button className="btn-primary">Mark Attendance</button></form>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Staff</th><th>Shift</th><th>Status</th></tr></thead><tbody>{attendance.slice(0,8).map((a)=><tr key={a.id}><td>{String(a.attendance_date || '').slice(0,10)}</td><td>{a.staff_name}</td><td>{a.shift}</td><td>{a.status}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel"><h3>Shift Roster</h3><form className="form-grid" onSubmit={saveRoster}>
        <select name="staff_id" value={rosterForm.staff_id} onChange={(e)=>field(e,setRosterForm)} required><option value="">Select staff</option>{staffOptions.map((s)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <input name="roster_date" type="date" value={rosterForm.roster_date} onChange={(e)=>field(e,setRosterForm)} />
        <input name="shift_name" value={rosterForm.shift_name} onChange={(e)=>field(e,setRosterForm)} />
        <input name="start_time" type="time" value={rosterForm.start_time} onChange={(e)=>field(e,setRosterForm)} />
        <input name="end_time" type="time" value={rosterForm.end_time} onChange={(e)=>field(e,setRosterForm)} />
        <input name="ward_or_location" placeholder="Ward/location" value={rosterForm.ward_or_location} onChange={(e)=>field(e,setRosterForm)} />
        <button className="btn-primary">Save Roster</button></form>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Staff</th><th>Shift</th><th>Location</th></tr></thead><tbody>{rosters.slice(0,8).map((r)=><tr key={r.id}><td>{String(r.roster_date || '').slice(0,10)}</td><td>{r.staff_name}</td><td>{r.shift_name}</td><td>{r.ward_or_location || '-'}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel"><h3>Leave Requests</h3><form className="form-grid" onSubmit={saveLeave}>
        <select name="staff_id" value={leaveForm.staff_id} onChange={(e)=>field(e,setLeaveForm)} required><option value="">Select staff</option>{staffOptions.map((s)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <select name="leave_type" value={leaveForm.leave_type} onChange={(e)=>field(e,setLeaveForm)}><option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="unpaid">Unpaid</option></select>
        <input name="start_date" type="date" value={leaveForm.start_date} onChange={(e)=>field(e,setLeaveForm)} />
        <input name="end_date" type="date" value={leaveForm.end_date} onChange={(e)=>field(e,setLeaveForm)} />
        <input name="reason" placeholder="Reason" value={leaveForm.reason} onChange={(e)=>field(e,setLeaveForm)} />
        <button className="btn-primary">Request Leave</button></form>
        <div className="table-wrap"><table><thead><tr><th>Staff</th><th>Type</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead><tbody>{leaves.slice(0,8).map((l)=><tr key={l.id}><td>{l.staff_name}</td><td>{l.leave_type}</td><td>{String(l.start_date || '').slice(0,10)} to {String(l.end_date || '').slice(0,10)}</td><td>{l.status}</td><td>{l.status === 'requested' && <><button className="btn-mini" onClick={()=>reviewLeave(l,'approved')}>Approve</button><button className="btn-mini danger" onClick={()=>reviewLeave(l,'rejected')}>Reject</button></>}</td></tr>)}</tbody></table></div>
      </section>
    </div>

    <section className="panel"><h3>Payroll Export Basics</h3><form className="form-grid" onSubmit={createPayroll}>
      <input name="period_start" type="date" value={payrollForm.period_start} onChange={(e)=>field(e,setPayrollForm)} />
      <input name="period_end" type="date" value={payrollForm.period_end} onChange={(e)=>field(e,setPayrollForm)} />
      <input name="notes" placeholder="Payroll notes" value={payrollForm.notes} onChange={(e)=>field(e,setPayrollForm)} />
      <button className="btn-primary">Generate Payroll Export</button></form>
      <div className="table-wrap"><table><thead><tr><th>Export</th><th>Period</th><th>Staff</th><th>Basic Total</th><th>Status</th></tr></thead><tbody>{payrollExports.slice(0,8).map((p)=><tr key={p.id}><td>{p.export_uid || p.id}</td><td>{String(p.period_start || '').slice(0,10)} to {String(p.period_end || '').slice(0,10)}</td><td>{p.staff_count}</td><td>{p.gross_basic_total || 0}</td><td>{p.status}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
