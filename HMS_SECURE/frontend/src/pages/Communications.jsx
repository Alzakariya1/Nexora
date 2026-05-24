import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { BellRing, CheckCircle2, Download, Mail, MessageCircle, RefreshCcw, Send, Smartphone } from 'lucide-react';
import { communicationApi } from '../api';

const CHANNELS = [
  { id: 'in_app', label: 'In-app', icon: BellRing },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const defaultForm = {
  title: '',
  message: '',
  recipient_type: 'patient',
  recipient_id: '',
  recipient_name: '',
  recipient_contact: '',
  module: 'system',
  channels: ['in_app'],
};

function StatusBadge({ status }) {
  return <span className={`statusPill statusPill-${status || 'queued'}`}>{status || 'queued'}</span>;
}

export default function Communications() {
  const [summary, setSummary] = useState({ channels: [] });
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().slice(0, 10));
  const [reminderChannels, setReminderChannels] = useState(['in_app']);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [summaryRes, logsRes] = await Promise.all([
        communicationApi.summary(),
        communicationApi.logs({ channel: channelFilter, status: statusFilter }),
      ]);
      setSummary(summaryRes.data || {});
      setLogs(logsRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load communications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [channelFilter, statusFilter]);

  const channelMap = useMemo(() => Object.fromEntries((summary.channels || []).map((item) => [item.channel, item.enabled])), [summary.channels]);

  function toggleChannel(channel, key = 'channels') {
    setForm((prev) => {
      const current = new Set(prev[key] || []);
      if (current.has(channel)) current.delete(channel); else current.add(channel);
      const next = Array.from(current);
      return { ...prev, [key]: next.length ? next : ['in_app'] };
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
    if (!form.title.trim() || !form.message.trim()) return toast.error('Title and message are required');
    try {
      await communicationApi.send(form);
      toast.success('Communication queued');
      setForm(defaultForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Communication failed');
    }
  }

  async function queueReminders() {
    try {
      const res = await communicationApi.appointmentReminders({ date: reminderDate, channels: reminderChannels });
      toast.success(`${res.data?.logs?.length || 0} reminder log(s) created`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reminder automation failed');
    }
  }

  async function markSent(row) {
    try {
      await communicationApi.markSent(row.id, { provider_message_id: row.provider_message_id || `manual-${Date.now()}` });
      toast.success('Marked as sent');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mark sent failed');
    }
  }

  async function exportCsv() {
    try {
      const res = await communicationApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'communication-logs.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    }
  }

  return (
    <section className="communicationsPage">
      <div className="sectionHeader heroHeader">
        <div>
          <span className="eyebrow">Engagement engine</span>
          <h1>Communications</h1>
          <p>Manage in-app, email, SMS and WhatsApp-ready messages, appointment reminders and delivery logs.</p>
        </div>
        <div className="headerActions">
          <button type="button" className="ghostBtn" onClick={load} disabled={loading}><RefreshCcw size={16} /> Refresh</button>
          <button type="button" onClick={exportCsv}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="statsGrid">
        <div className="statCard"><span>Total logs</span><strong>{summary.total || 0}</strong><small>All channels</small><BellRing size={24} /></div>
        <div className="statCard"><span>Queued</span><strong>{summary.queued || 0}</strong><small>Ready for provider</small><Send size={24} /></div>
        <div className="statCard"><span>Sent</span><strong>{summary.sent || 0}</strong><small>Delivered/confirmed</small><CheckCircle2 size={24} /></div>
        <div className="statCard"><span>Skipped</span><strong>{summary.skipped || 0}</strong><small>Provider missing</small><MessageCircle size={24} /></div>
      </div>

      <div className="grid twoCol">
        <form className="card formStack" onSubmit={sendManual}>
          <h3>Send manual communication</h3>
          <div className="formGrid two">
            <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Message title" /></label>
            <label>Module<input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="appointments" /></label>
            <label>Recipient type<select value={form.recipient_type} onChange={(e) => setForm({ ...form, recipient_type: e.target.value })}><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="user">User</option><option value="tenant">Tenant</option></select></label>
            <label>Recipient ID<input value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })} placeholder="Optional" /></label>
            <label>Recipient name<input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder="Optional" /></label>
            <label>Contact<input value={form.recipient_contact} onChange={(e) => setForm({ ...form, recipient_contact: e.target.value })} placeholder="Phone or email" /></label>
          </div>
          <label>Message<textarea rows="4" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write message body" /></label>
          <div className="channelPicker">
            {CHANNELS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={form.channels.includes(id) ? 'selected' : ''} onClick={() => toggleChannel(id)}><Icon size={15} /> {label} <small>{channelMap[id] ? 'ready' : id === 'in_app' ? 'ready' : 'env needed'}</small></button>)}
          </div>
          <button type="submit"><Send size={16} /> Queue Message</button>
        </form>

        <div className="card formStack">
          <h3>Appointment reminder automation</h3>
          <p className="muted">Create reminder logs for scheduled/checked-in appointments on a selected date. External channels stay safely skipped until provider env keys are configured.</p>
          <label>Appointment date<input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} /></label>
          <div className="channelPicker">
            {CHANNELS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={reminderChannels.includes(id) ? 'selected' : ''} onClick={() => toggleReminderChannel(id)}><Icon size={15} /> {label}</button>)}
          </div>
          <button type="button" onClick={queueReminders}><BellRing size={16} /> Queue reminders</button>
          <div className="providerStatus">
            {(summary.channels || []).map((item) => <span key={item.channel} className={item.enabled ? 'ok' : 'warn'}>{item.channel}: {item.enabled ? 'ready' : 'env missing'}</span>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tableToolbar">
          <div><h3>Communication logs</h3><p className="muted">Latest outbound and reminder activity.</p></div>
          <div className="filtersInline">
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}><option value="all">All channels</option>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="queued">Queued</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>ID</th><th>Channel</th><th>Recipient</th><th>Title</th><th>Module</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {logs.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.channel}</td><td><b>{row.recipient_name || '-'}</b><br /><small>{row.recipient_contact || row.recipient_id || '-'}</small></td><td>{row.title}<br /><small>{row.message}</small></td><td>{row.module}</td><td><StatusBadge status={row.status} /></td><td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td><td>{row.status === 'queued' ? <button type="button" className="ghostBtn" onClick={() => markSent(row)}>Mark sent</button> : '-'}</td></tr>)}
              {!logs.length && <tr><td colSpan="8" className="emptyState">No communication logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
