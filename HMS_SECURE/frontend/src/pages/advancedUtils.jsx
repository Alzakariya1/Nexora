import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { auditApi, integrationApi } from '../api';

export const RESOURCES = ['Patient', 'Encounter', 'Observation', 'DiagnosticReport', 'Invoice', 'MedicationRequest'];
export const safeArray = (v) => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

export function StatusPill({ children, type = 'success' }) {
  return <span className={`statusPill ${type}`}>{children}</span>;
}

export function EnterpriseTable({ title, subtitle, columns, rows, empty = 'No records yet.' }) {
  return <div className="card enterprise-module-card">
    <div className="sectionTitleRow"><div><h3>{title}</h3>{subtitle && <p className="muted">{subtitle}</p>}</div><span className="muted">{rows?.length || 0} records</span></div>
    {rows?.length ? <div className="enterpriseTableWrap"><table className="enterpriseTable compact-enterprise-table"><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || r.key_id || r._id || i}>{columns.map(c => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '-')}</td>)}</tr>)}</tbody></table></div> : <div className="emptyTableState">{empty}</div>}
  </div>;
}

export function FeatureHero({ eyebrow, title, description, hospital, children }) {
  return <div className="advHero enterprise-feature-hero">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
    <div className="advHeroPanel"><StatusPill>Enabled</StatusPill><strong>{hospital?.name || 'Default Hospital'}</strong><small>Hospital scoped workspace</small>{children}</div>
  </div>;
}

export function useIntegrationWorkspace(defaultResource = 'Patient', settingKey = '') {
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState(defaultResource);
  const [summary, setSummary] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [fhir, setFhir] = useState(null);
  const [settings, setSettings] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);

  async function load(nextResource = resource) {
    setLoading(true);
    try {
      const [sum, keys, hooks, logRes, fhirRes, sec, login] = await Promise.all([
        integrationApi.summary().catch(() => ({ data: {} })),
        integrationApi.keys().catch(() => ({ data: [] })),
        integrationApi.webhooks().catch(() => ({ data: [] })),
        integrationApi.logs().catch(() => ({ data: [] })),
        integrationApi.fhir(nextResource).catch(() => ({ data: null })),
        auditApi.settings().catch(() => ({ data: [] })),
        auditApi.loginHistory({}).catch(() => ({ data: [] })),
      ]);
      setSummary(sum.data || {});
      setApiKeys(safeArray(keys.data));
      setWebhooks(safeArray(hooks.data));
      setLogs(safeArray(logRes.data?.length ? logRes.data : sum.data?.recent_logs));
      setFhir(fhirRes.data || null);
      setSettings(safeArray(sec.data));
      setLoginHistory(safeArray(login.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Workspace failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(resource); }, [resource]);
  const settingValue = useMemo(() => settings.find(s => s.setting_key === settingKey)?.setting_value, [settings, settingKey]);
  const settingOn = settingValue === 'true' || settingValue === true || settingValue === undefined;

  async function saveSetting(value, description = '') {
    try {
      await auditApi.saveSetting(settingKey, { value: String(value), category: 'advanced_feature', description });
      toast.success('Setting saved');
      await load(resource);
    } catch (err) { toast.error(err.response?.data?.message || 'Setting save failed'); }
  }

  async function createKey(name, scopes = []) {
    const { data } = await integrationApi.createKey({ name, scopes });
    toast.success('API key created');
    await load(resource);
    return data.api_key || '';
  }

  async function createWebhook(payload) {
    await integrationApi.createWebhook(payload);
    toast.success('Webhook saved');
    await load(resource);
  }

  async function createLog(payload) {
    await integrationApi.createLog(payload);
    toast.success('Test log saved');
    await load(resource);
  }

  return { loading, resource, setResource, summary, apiKeys, webhooks, logs, fhir, settings, settingOn, loginHistory, load, saveSetting, createKey, createWebhook, createLog };
}

export function IntegrationKeyPanel({ title, defaultName, scopes, workspace }) {
  const [name, setName] = useState(defaultName);
  const [raw, setRaw] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { setRaw(await workspace.createKey(name, scopes)); }
    catch (err) { toast.error(err.response?.data?.message || 'API key creation failed'); }
  }
  return <form className="card enterprise-module-card form" onSubmit={submit}>
    <h3>{title}</h3>
    <label><span>Key name</span><input value={name} onChange={e => setName(e.target.value)} required /></label>
    <button>Create Key</button>
    {raw && <div className="alert success"><strong>Copy now:</strong><code>{raw}</code></div>}
  </form>;
}

export function WebhookPanel({ title, defaultEvents, workspace }) {
  const [form, setForm] = useState({ name: title, target_url: '', events: defaultEvents });
  async function submit(e) {
    e.preventDefault();
    if (!form.target_url) return toast.error('Endpoint URL is required');
    try { await workspace.createWebhook({ ...form, events: String(form.events).split(',').map(x => x.trim()).filter(Boolean) }); setForm({ ...form, target_url: '' }); }
    catch (err) { toast.error(err.response?.data?.message || 'Webhook save failed'); }
  }
  return <form className="card enterprise-module-card form" onSubmit={submit}>
    <h3>{title}</h3>
    <label><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label><span>Endpoint URL</span><input placeholder="https://example.com/hms-webhook" value={form.target_url} onChange={e => setForm({ ...form, target_url: e.target.value })} /></label>
    <label><span>Events</span><input value={form.events} onChange={e => setForm({ ...form, events: e.target.value })} /></label>
    <button>Save Webhook</button>
  </form>;
}

export function FhirPreview({ workspace, title = 'FHIR / Export Preview' }) {
  return <div className="card enterprise-module-card">
    <div className="sectionTitleRow"><h3>{title}</h3><select value={workspace.resource} onChange={e => workspace.setResource(e.target.value)}>{RESOURCES.map(r => <option key={r}>{r}</option>)}</select></div>
    <pre className="code-box adv-code-preview">{workspace.fhir ? JSON.stringify(workspace.fhir, null, 2).slice(0, 3500) : 'No preview available. Create core HMS data first or refresh.'}</pre>
  </div>;
}

export function Checklist({ items }) {
  return <div className="card enterprise-module-card"><h3>Readiness Checklist</h3><div className="checklistGrid">{items.map((x, i) => <div className="checkRow" key={x}><span className="checkIcon">✓</span><div><strong>{x}</strong><small>{i < 2 ? 'Connected with current HMS data' : 'Configured for hospital readiness'}</small></div></div>)}</div></div>;
}

export const commonColumns = {
  keys: [
    { key: 'key_id', label: 'Key ID' }, { key: 'name', label: 'Name' }, { key: 'key_preview', label: 'Preview' }, { key: 'status', label: 'Status', render: r => <StatusPill>{r.status || 'active'}</StatusPill> },
  ],
  webhooks: [
    { key: 'name', label: 'Name' }, { key: 'target_url', label: 'URL', render: r => r.target_url || r.endpoint_url || '-' }, { key: 'events', label: 'Events', render: r => (r.events || r.event_types || []).join?.(', ') || '-' }, { key: 'status', label: 'Status', render: r => <StatusPill>{r.status || 'active'}</StatusPill> },
  ],
  logs: [
    { key: 'system', label: 'System' }, { key: 'resource_type', label: 'Resource' }, { key: 'method', label: 'Method' }, { key: 'endpoint', label: 'Endpoint' }, { key: 'status', label: 'Status', render: r => <StatusPill type={r.status === 'failed' ? 'danger' : 'success'}>{r.status || 'success'}</StatusPill> },
  ],
};
