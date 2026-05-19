import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { enterpriseFeatureApi } from '../api';
import { EnterpriseTable, StatusPill } from './advancedUtils.jsx';

const empty = { title: '', record_type: 'configuration', status: 'active', priority: 'normal', owner: '', external_id: '', endpoint: '', notes: '' };

export default function EnterpriseFeatureWorkspace({
  featureKey,
  title,
  eyebrow,
  description,
  primaryRecord = 'configuration',
  recordTypes = ['configuration', 'event', 'mapping', 'evidence'],
  fields = [],
  checklist = [],
  currentHospital,
}) {
  const [summary, setSummary] = useState({ records: [], logs: [] });
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ ...empty, record_type: primaryRecord });
  const [payload, setPayload] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(false);

  const active = useMemo(() => records.filter(r => ['active', 'enabled', 'connected', 'approved', 'success', 'online'].includes(r.status)).length, [records]);
  const pending = useMemo(() => records.filter(r => ['pending', 'open', 'draft', 'queued', 'review'].includes(r.status)).length, [records]);

  async function load() {
    setLoading(true);
    try {
      const params = filterType === 'all' ? {} : { type: filterType };
      const [sum, list] = await Promise.all([
        enterpriseFeatureApi.summary(featureKey).catch(() => ({ data: {} })),
        enterpriseFeatureApi.records(featureKey, params).catch(() => ({ data: [] })),
      ]);
      setSummary(sum.data || {});
      setRecords(Array.isArray(list.data) ? list.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || `${title} data load failed`);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [featureKey, filterType]);

  function setBase(k, v) { setForm(prev => ({ ...prev, [k]: v })); }
  function setExtra(k, v) { setPayload(prev => ({ ...prev, [k]: v })); }
  function reset() { setForm({ ...empty, record_type: primaryRecord }); setPayload({}); setEditingId(null); }

  async function save(e) {
    e.preventDefault();
    try {
      const data = { ...form, payload };
      if (editingId) await enterpriseFeatureApi.update(featureKey, editingId, data);
      else await enterpriseFeatureApi.create(featureKey, data);
      toast.success(editingId ? 'Record updated' : 'Record saved');
      reset(); await load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  }
  function edit(row) {
    setEditingId(row.id);
    setForm({ ...empty, ...row, record_type: row.record_type || primaryRecord });
    setPayload(row.payload || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function del(row) {
    if (!confirm(`Delete ${row.title || 'record'}?`)) return;
    await enterpriseFeatureApi.remove(featureKey, row.id);
    toast.success('Record deleted'); load();
  }
  async function toggleFeature() {
    try { await enterpriseFeatureApi.setEnabled(featureKey, !(summary.enabled !== false)); await load(); toast.success('Feature flag updated'); }
    catch (err) { toast.error(err.response?.data?.message || 'Feature update failed'); }
  }

  const columns = [
    { key: 'id', label: 'ID', render: r => `#${r.id}` },
    { key: 'record_type', label: 'Type' },
    { key: 'title', label: 'Title' },
    { key: 'external_id', label: 'Ref' },
    { key: 'status', label: 'Status', render: r => <StatusPill type={r.status === 'failed' || r.status === 'blocked' ? 'danger' : 'success'}>{r.status || 'active'}</StatusPill> },
    { key: 'owner', label: 'Owner' },
    { key: 'actions', label: 'Actions', render: r => <div className="rowActions"><button type="button" onClick={() => edit(r)}>Edit</button><button type="button" className="dangerText" onClick={() => del(r)}>Delete</button></div> },
  ];

  return <section className="pageStack enterprise-feature-page stable-workspace">
    <div className="advHero enterprise-feature-hero real-feature-hero">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      <div className="advHeroPanel"><StatusPill>{summary.enabled === false ? 'Disabled' : 'Enabled'}</StatusPill><strong>{currentHospital?.name || 'Default Hospital'}</strong><small>Data is saved per hospital/tenant</small><button type="button" className="ghostBtn" onClick={toggleFeature}>{summary.enabled === false ? 'Enable' : 'Disable'}</button></div>
    </div>

    <div className="advStatsGrid">
      <div className="stat-card"><span>Total Records</span><strong>{records.length || summary.total || 0}</strong><small>{title} saved items</small></div>
      <div className="stat-card"><span>Active</span><strong>{active || summary.active || 0}</strong><small>enabled/connected</small></div>
      <div className="stat-card"><span>Pending</span><strong>{pending || summary.pending || 0}</strong><small>open/draft/review</small></div>
      <div className="stat-card"><span>Audit Logs</span><strong>{summary.logs?.length || 0}</strong><small>latest integration events</small></div>
    </div>

    <div className="grid twoCols alignStart">
      <form className="card enterprise-module-card form stable-form" onSubmit={save}>
        <div className="sectionTitleRow"><div><h3>{editingId ? `Edit ${title} Record` : `Create ${title} Record`}</h3><p className="muted">This creates real tenant-scoped database records, not placeholder text.</p></div>{editingId && <button type="button" className="ghostBtn" onClick={reset}>New</button>}</div>
        <div className="formGrid two">
          <label><span>Record type</span><select value={form.record_type} onChange={e => setBase('record_type', e.target.value)}>{recordTypes.map(t => <option key={t}>{t}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={e => setBase('status', e.target.value)}>{['active','enabled','connected','pending','open','draft','review','approved','success','failed','disabled','blocked'].map(s => <option key={s}>{s}</option>)}</select></label>
          <label><span>Title</span><input required value={form.title} onChange={e => setBase('title', e.target.value)} placeholder={`${title} item title`} /></label>
          <label><span>Reference / External ID</span><input value={form.external_id || ''} onChange={e => setBase('external_id', e.target.value)} placeholder="External/reference id" /></label>
          <label><span>Owner</span><input value={form.owner || ''} onChange={e => setBase('owner', e.target.value)} placeholder="Responsible team/person" /></label>
          <label><span>Endpoint / URL</span><input value={form.endpoint || ''} onChange={e => setBase('endpoint', e.target.value)} placeholder="API/device/viewer endpoint" /></label>
          {fields.map(f => <label key={f.key}><span>{f.label}</span>{f.type === 'select' ? <select value={payload[f.key] || f.default || ''} onChange={e => setExtra(f.key, e.target.value)}>{(f.options || []).map(o => <option key={o}>{o}</option>)}</select> : <input type={f.type || 'text'} value={payload[f.key] || ''} onChange={e => setExtra(f.key, e.target.value)} placeholder={f.placeholder || f.label} />}</label>)}
        </div>
        <label><span>Notes</span><textarea value={form.notes || ''} onChange={e => setBase('notes', e.target.value)} placeholder="Operational details, evidence, mapping notes" /></label>
        <button>{editingId ? 'Update Record' : 'Save Record'}</button>
      </form>

      <div className="card enterprise-module-card">
        <h3>{title} Readiness Checklist</h3>
        <ul className="checkList">{checklist.map((item, i) => <li key={i}><span>✓</span>{item}</li>)}</ul>
        <div className="filterRow"><label><span>Filter records</span><select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="all">All types</option>{recordTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></label><button type="button" className="ghostBtn" onClick={load}>{loading ? 'Loading...' : 'Refresh'}</button></div>
      </div>
    </div>

    <EnterpriseTable title={`${title} Records`} subtitle="Saved to MongoDB through backend enterprise feature APIs." rows={records} columns={columns} empty={`No ${title} records yet. Create one above.`} />
    <EnterpriseTable title={`${title} Recent Logs`} rows={summary.logs || []} columns={[{key:'created_at',label:'Time',render:r=>r.created_at?new Date(r.created_at).toLocaleString():'-'},{key:'resource_type',label:'Resource'},{key:'method',label:'Method'},{key:'endpoint',label:'Endpoint'},{key:'status',label:'Status',render:r=><StatusPill>{r.status||'success'}</StatusPill>}]} empty="No integration logs yet. Creating records will add audit/integration evidence." />
  </section>;
}
