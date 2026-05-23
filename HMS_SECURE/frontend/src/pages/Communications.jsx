import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { BellRing, CheckCircle2, Download, Mail, MessageCircle, RefreshCcw, RotateCcw, Send, Smartphone, Workflow } from 'lucide-react';
import { communicationApi } from '../api';

const CHANNELS = [
  { id: 'in_app', label: 'In-app', icon: BellRing },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const defaultForm = {
  title: '', message: '', template_key: '', recipient_type: 'patient', recipient_id: '', recipient_name: '', recipient_contact: '', module: 'system', channels: ['in_app'], scheduled_for: '',
};
const defaultTemplate = { template_key: '', name: '', channel: 'in_app', category: 'general', title_template: '', message_template: '', variables: '', status: 'draft' };
const defaultRule = { name: '', event_type: 'appointment_reminder', channels: ['in_app'], template_key: '', offset_minutes: 0, module: 'appointments', audience: 'patient', is_active: true };

function StatusBadge({ status }) { return <span className={`statusPill statusPill-${status || 'queued'}`}>{status || 'queued'}</span>; }

export default function Communications() {
  const [summary, setSummary] = useState({ channels: [] });
  const [logs, setLogs] = useState([]);
  const [due, setDue] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [templateForm, setTemplateForm] = useState(defaultTemplate);
  const [ruleForm, setRuleForm] = useState(defaultRule);
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().slice(0, 10));
  const [reminderChannels, setReminderChannels] = useState(['in_app']);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [summaryRes, logsRes, dueRes, templateRes, ruleRes] = await Promise.all([
        communicationApi.summary(),
        communicationApi.logs({ channel: channelFilter, status: statusFilter }),
        communicationApi.due({ limit: 25 }),
        communicationApi.templates({ status: 'all' }),
        communicationApi.rules(),
      ]);
      setSummary(summaryRes.data || {});
      setLogs(logsRes.data || []);
      setDue(dueRes.data || []);
      setTemplates(templateRes.data || []);
      setRules(ruleRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load communications');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [channelFilter, statusFilter]);

  const channelMap = useMemo(() => Object.fromEntries((summary.channels || []).map((item) => [item.channel, item.enabled])), [summary.channels]);
  const approvedTemplateKeys = useMemo(() => templates.filter((t) => t.status === 'approved').map((t) => t.template_key), [templates]);

  function toggleListValue(value, setter, field) {
    setter((prev) => {
      const current = new Set(prev[field] || []);
      if (current.has(value)) current.delete(value); else current.add(value);
      const next = Array.from(current);
      return { ...prev, [field]: next.length ? next : ['in_app'] };
    });
  }
  function toggleReminderChannel(channel) {
    setReminderChannels((prev) => {
      const current = new Set(prev || []);
      if (current.has(channel)) current.delete(channel); else current.add(channel);
      const next = Array.from(current);
      return next.length ? next : ['in_app'];
    });
  }

  async function sendManual(e) {
    e.preventDefault();
    if (!form.template_key && (!form.title.trim() || !form.message.trim())) return toast.error('Title/message or template key is required');
    try { await communicationApi.send(form); toast.success('Communication queued'); setForm(defaultForm); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Communication failed'); }
  }
  async function saveTemplate(e) {
    e.preventDefault();
    try {
      await communicationApi.saveTemplate({ ...templateForm, variables: templateForm.variables.split(',').map((x) => x.trim()).filter(Boolean) });
      toast.success('Template saved'); setTemplateForm(defaultTemplate); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Template save failed'); }
  }
  async function approveTemplate(row) {
    try { await communicationApi.approveTemplate(row.id, { approval_notes: 'Approved from communications console' }); toast.success('Template approved'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Template approval failed'); }
  }
  async function saveRule(e) {
    e.preventDefault();
    try { await communicationApi.saveRule(ruleForm); toast.success('Reminder rule saved'); setRuleForm(defaultRule); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Rule save failed'); }
  }
  async function queueReminders() {
    try { const res = await communicationApi.appointmentReminders({ date: reminderDate, channels: reminderChannels }); toast.success(`${res.data?.logs?.length || 0} appointment reminder log(s) created`); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Reminder automation failed'); }
  }
  async function queuePaymentReminders() {
    try { const res = await communicationApi.paymentDueReminders({ channels: reminderChannels }); toast.success(`${res.data?.logs?.length || 0} payment reminder log(s) created`); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Payment reminders failed'); }
  }
  async function markSent(row) {
    try { await communicationApi.markSent(row.id, { provider_message_id: row.provider_message_id || `manual-${Date.now()}` }); toast.success('Marked as sent'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Mark sent failed'); }
  }
  async function retry(row) {
    try { await communicationApi.retry(row.id); toast.success('Retry queued'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Retry failed'); }
  }
  async function exportCsv() {
    try {
      const res = await communicationApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a'); link.href = url; link.download = 'communication-logs.csv'; link.click(); window.URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.response?.data?.message || 'Export failed'); }
  }

  return (
    <section className="communicationsPage">
      <div className="sectionHeader heroHeader">
        <div><span className="eyebrow">Engagement engine</span><h1>Communications</h1><p>Upgrade existing WhatsApp/SMS/Email readiness with templates, reminder rules, due queue, provider status callbacks and audit-ready delivery logs.</p></div>
        <div className="headerActions"><button type="button" className="ghostBtn" onClick={load} disabled={loading}><RefreshCcw size={16} /> Refresh</button><button type="button" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      </div>

      <div className="statsGrid">
        <div className="statCard"><span>Total logs</span><strong>{summary.total || 0}</strong><small>All channels</small><BellRing size={24} /></div>
        <div className="statCard"><span>Queued / Due</span><strong>{summary.queued || 0} / {summary.due || 0}</strong><small>Ready for provider</small><Send size={24} /></div>
        <div className="statCard"><span>Sent / Delivered</span><strong>{summary.sent || 0} / {summary.delivered || 0}</strong><small>Provider lifecycle</small><CheckCircle2 size={24} /></div>
        <div className="statCard"><span>Templates / Rules</span><strong>{summary.templates || 0} / {summary.activeRules || 0}</strong><small>Automation readiness</small><Workflow size={24} /></div>
      </div>

      <div className="grid twoCol">
        <form className="card formStack" onSubmit={sendManual}>
          <h3>Send manual communication</h3>
          <div className="formGrid two">
            <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Message title" /></label>
            <label>Template key<select value={form.template_key} onChange={(e) => setForm({ ...form, template_key: e.target.value })}><option value="">No template</option>{approvedTemplateKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
            <label>Module<input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="appointments" /></label>
            <label>Schedule for<input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></label>
            <label>Recipient type<select value={form.recipient_type} onChange={(e) => setForm({ ...form, recipient_type: e.target.value })}><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="user">User</option><option value="tenant">Tenant</option></select></label>
            <label>Recipient ID<input value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })} placeholder="Optional" /></label>
            <label>Recipient name<input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder="Optional" /></label>
            <label>Contact<input value={form.recipient_contact} onChange={(e) => setForm({ ...form, recipient_contact: e.target.value })} placeholder="Phone or email" /></label>
          </div>
          <label>Message<textarea rows="4" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write message body or use approved template" /></label>
          <div className="channelPicker">{CHANNELS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={form.channels.includes(id) ? 'selected' : ''} onClick={() => toggleListValue(id, setForm, 'channels')}><Icon size={15} /> {label} <small>{channelMap[id] ? 'ready' : id === 'in_app' ? 'ready' : 'env needed'}</small></button>)}</div>
          <button type="submit"><Send size={16} /> Queue Message</button>
        </form>

        <div className="card formStack">
          <h3>Reminder automation</h3>
          <p className="muted">Create appointment and payment reminder logs. External channels stay skipped until provider env keys are configured.</p>
          <label>Appointment date<input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} /></label>
          <div className="channelPicker">{CHANNELS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={reminderChannels.includes(id) ? 'selected' : ''} onClick={() => toggleReminderChannel(id)}><Icon size={15} /> {label}</button>)}</div>
          <div className="headerActions"><button type="button" onClick={queueReminders}><BellRing size={16} /> Appointment reminders</button><button type="button" className="ghostBtn" onClick={queuePaymentReminders}><BellRing size={16} /> Payment due reminders</button></div>
          <div className="providerStatus">{(summary.channels || []).map((item) => <span key={item.channel} className={item.enabled ? 'ok' : 'warn'}>{item.channel}: {item.enabled ? 'ready' : 'env missing'}</span>)}</div>
          <div className="miniList"><h4>Due queue</h4>{due.slice(0, 5).map((row) => <p key={row.id}><b>#{row.id}</b> {row.channel} · {row.title} · {row.recipient_name || '-'}</p>)}{!due.length ? <p className="muted">No due messages waiting.</p> : null}</div>
        </div>
      </div>

      <div className="grid twoCol">
        <form className="card formStack" onSubmit={saveTemplate}>
          <h3>Template governance</h3>
          <div className="formGrid two">
            <label>Template key<input value={templateForm.template_key} onChange={(e) => setTemplateForm({ ...templateForm, template_key: e.target.value })} placeholder="appointment_reminder" required /></label>
            <label>Name<input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Appointment Reminder" /></label>
            <label>Channel<select value={templateForm.channel} onChange={(e) => setTemplateForm({ ...templateForm, channel: e.target.value })}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label>Status<select value={templateForm.status} onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value })}><option value="draft">Draft</option><option value="approved">Approved</option><option value="disabled">Disabled</option></select></label>
            <label>Title template<input value={templateForm.title_template} onChange={(e) => setTemplateForm({ ...templateForm, title_template: e.target.value })} placeholder="Reminder for {{patient.full_name}}" /></label>
            <label>Variables<input value={templateForm.variables} onChange={(e) => setTemplateForm({ ...templateForm, variables: e.target.value })} placeholder="patient.full_name,appointment.appointment_date" /></label>
          </div>
          <label>Message template<textarea rows="3" value={templateForm.message_template} onChange={(e) => setTemplateForm({ ...templateForm, message_template: e.target.value })} placeholder="Your appointment is on {{appointment.appointment_date}}" required /></label>
          <button type="submit"><CheckCircle2 size={16} /> Save Template</button>
        </form>

        <form className="card formStack" onSubmit={saveRule}>
          <h3>Reminder rules</h3>
          <div className="formGrid two">
            <label>Name<input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="Morning appointment reminder" /></label>
            <label>Event<select value={ruleForm.event_type} onChange={(e) => setRuleForm({ ...ruleForm, event_type: e.target.value })}><option value="appointment_reminder">Appointment reminder</option><option value="report_ready">Report ready alert</option><option value="payment_due">Payment due alert</option><option value="follow_up">Follow-up reminder</option></select></label>
            <label>Template key<input value={ruleForm.template_key} onChange={(e) => setRuleForm({ ...ruleForm, template_key: e.target.value })} placeholder="Optional approved template key" /></label>
            <label>Offset minutes<input type="number" value={ruleForm.offset_minutes} onChange={(e) => setRuleForm({ ...ruleForm, offset_minutes: e.target.value })} /></label>
          </div>
          <div className="channelPicker">{CHANNELS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={ruleForm.channels.includes(id) ? 'selected' : ''} onClick={() => toggleListValue(id, setRuleForm, 'channels')}><Icon size={15} /> {label}</button>)}</div>
          <button type="submit"><Workflow size={16} /> Save Rule</button>
        </form>
      </div>

      <div className="grid twoCol">
        <div className="card"><h3>Templates</h3><div className="tableWrap"><table><thead><tr><th>Key</th><th>Channel</th><th>Status</th><th>Version</th><th>Action</th></tr></thead><tbody>{templates.slice(0, 10).map((row) => <tr key={row.id}><td>{row.template_key}<br /><small>{row.name}</small></td><td>{row.channel}</td><td><StatusBadge status={row.status} /></td><td>{row.version || 1}</td><td>{row.status !== 'approved' ? <button className="ghostBtn" type="button" onClick={() => approveTemplate(row)}>Approve</button> : '-'}</td></tr>)}{!templates.length && <tr><td colSpan="5" className="emptyState">No templates yet.</td></tr>}</tbody></table></div></div>
        <div className="card"><h3>Rules</h3><div className="tableWrap"><table><thead><tr><th>Name</th><th>Event</th><th>Channels</th><th>Status</th></tr></thead><tbody>{rules.slice(0, 10).map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.event_type}</td><td>{(row.channels || []).join(', ')}</td><td>{row.is_active ? 'Active' : 'Inactive'}</td></tr>)}{!rules.length && <tr><td colSpan="4" className="emptyState">No rules yet.</td></tr>}</tbody></table></div></div>
      </div>

      <div className="card">
        <div className="tableToolbar"><div><h3>Communication logs</h3><p className="muted">Latest outbound, reminder and provider delivery activity.</p></div><div className="filtersInline"><select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}><option value="all">All channels</option>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="queued">Queued</option><option value="sent">Sent</option><option value="delivered">Delivered</option><option value="read">Read</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select></div></div>
        <div className="tableWrap"><table><thead><tr><th>ID</th><th>Channel</th><th>Recipient</th><th>Title</th><th>Module</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{logs.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.channel}<br /><small>{row.provider || '-'}</small></td><td><b>{row.recipient_name || '-'}</b><br /><small>{row.recipient_contact || row.recipient_id || '-'}</small></td><td>{row.title}<br /><small>{row.template_key ? `Template: ${row.template_key}` : row.message}</small></td><td>{row.module}</td><td><StatusBadge status={row.status} /></td><td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td><td>{['queued','failed'].includes(row.status) ? <div className="headerActions"><button type="button" className="ghostBtn" onClick={() => markSent(row)}>Mark sent</button><button type="button" className="ghostBtn" onClick={() => retry(row)}><RotateCcw size={14} /> Retry</button></div> : '-'}</td></tr>)}{!logs.length && <tr><td colSpan="8" className="emptyState">No communication logs found.</td></tr>}</tbody></table></div>
      </div>
    </section>
  );
}
