import React, { useEffect, useMemo, useState } from 'react';
import { auditApi } from '../api';

const emptySetting = { setting_key: '', setting_value: '', category: 'general', description: '' };

function fmtDate(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString(); } catch (_) { return '-'; }
}

function StatusBadge({ value }) {
  const status = value || 'success';
  return <span className={`statusBadge ${status}`}>{status.replaceAll('_', ' ')}</span>;
}

export default function AuditSecurity({ permissions }) {
  const [summary, setSummary] = useState({});
  const [auditRows, setAuditRows] = useState([]);
  const [loginRows, setLoginRows] = useState([]);
  const [settings, setSettings] = useState([]);
  const [filters, setFilters] = useState({ q: '', module: '', status: '' });
  const [settingForm, setSettingForm] = useState(emptySetting);
  const [loading, setLoading] = useState(false);

  const modules = useMemo(() => Array.from(new Set(auditRows.map((row) => row.module_name).filter(Boolean))).sort(), [auditRows]);

  async function load() {
    setLoading(true);
    try {
      const [s, a, l, st] = await Promise.all([
        auditApi.summary(),
        auditApi.list(filters),
        auditApi.loginHistory(),
        auditApi.settings(),
      ]);
      setSummary(s.data || {});
      setAuditRows(a.data || []);
      setLoginRows(l.data || []);
      setSettings(st.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function applyFilters(e) {
    e.preventDefault();
    const { data } = await auditApi.list(filters);
    setAuditRows(data || []);
  }

  async function saveSetting(e) {
    e.preventDefault();
    if (!settingForm.setting_key) return;
    await auditApi.saveSetting(settingForm.setting_key, {
      value: settingForm.setting_value,
      category: settingForm.category,
      description: settingForm.description,
    });
    setSettingForm(emptySetting);
    await load();
  }

  async function seedDefaults() {
    await auditApi.seedDefaults();
    await load();
  }

  if (!permissions?.securityManage && !permissions?.auditView) {
    return <section className="card"><h2>Security Center</h2><p className="muted">You do not have access to this module.</p></section>;
  }

  return (
    <div className="securityCenter">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Enterprise Controls</p>
          <h1>Audit & Security Center</h1>
          <p>Track sensitive actions, login attempts, permission denials and tenant-specific security settings.</p>
        </div>
        <div className="headerActions">
          <button className="secondaryBtn" type="button" onClick={load} disabled={loading}>Refresh</button>
          <a className="primaryBtn" href={auditApi.exportUrl(filters)} target="_blank" rel="noreferrer">Export Audit CSV</a>
        </div>
      </div>

      <div className="statsGrid securityStats">
        <div className="statCard"><span>Total Audit Logs</span><strong>{summary.auditCount || 0}</strong><small>All tracked sensitive events</small></div>
        <div className="statCard"><span>Failed Logins 24h</span><strong>{summary.failedLogins24h || 0}</strong><small>Invalid or blocked login attempts</small></div>
        <div className="statCard"><span>Denied Actions 24h</span><strong>{summary.deniedActions24h || 0}</strong><small>Permission blocked activities</small></div>
        <div className="statCard"><span>Active Users</span><strong>{summary.activeUsers || 0}</strong><small>Current hospital users</small></div>
      </div>

      <div className="grid twoCol securityGrid">
        <section className="card auditPanel">
          <div className="cardHeaderRow">
            <div><h3>Audit Logs</h3><p className="muted">Old/new values, IP, device and status tracking.</p></div>
          </div>
          <form className="filterBar" onSubmit={applyFilters}>
            <input placeholder="Search action/path" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <select value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
              <option value="">All modules</option>
              {modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
              <option value="denied">Denied</option>
              <option value="deleted">Deleted</option>
            </select>
            <button type="submit">Apply</button>
          </form>
          <div className="auditList">
            {auditRows.slice(0, 80).map((row) => (
              <article className="auditItem" key={row.id}>
                <div>
                  <strong>{row.action}</strong>
                  <p>{row.user_name || 'System'} · {row.module_name || '-'} · {fmtDate(row.created_at)}</p>
                  <small>{row.method || ''} {row.path || ''}</small>
                </div>
                <div className="auditMeta"><StatusBadge value={row.status} /><small>{row.ip_address || '-'}</small></div>
              </article>
            ))}
            {!auditRows.length && <p className="muted emptyState">No audit logs found.</p>}
          </div>
        </section>

        <section className="card">
          <div className="cardHeaderRow"><div><h3>Login History</h3><p className="muted">Successful, failed and blocked logins by IP/device.</p></div></div>
          <div className="loginHistoryList">
            {loginRows.slice(0, 40).map((row) => (
              <article className="auditItem compact" key={row.id}>
                <div>
                  <strong>{row.email || 'Unknown user'}</strong>
                  <p>{row.role || '-'} · {fmtDate(row.logged_at || row.created_at)}</p>
                  <small>{row.reason || ''}</small>
                </div>
                <div className="auditMeta"><StatusBadge value={row.status} /><small>{row.ip_address || '-'}</small></div>
              </article>
            ))}
            {!loginRows.length && <p className="muted emptyState">No login history found.</p>}
          </div>
        </section>
      </div>

      <section className="card securitySettingsPanel">
        <div className="cardHeaderRow">
          <div><h3>Security Settings</h3><p className="muted">Hospital-level security configuration and policy readiness.</p></div>
          <button type="button" className="secondaryBtn" onClick={seedDefaults}>Ensure Defaults</button>
        </div>
        <form className="settingsForm" onSubmit={saveSetting}>
          <input placeholder="Setting key" value={settingForm.setting_key} onChange={(e) => setSettingForm({ ...settingForm, setting_key: e.target.value })} />
          <input placeholder="Value" value={settingForm.setting_value} onChange={(e) => setSettingForm({ ...settingForm, setting_value: e.target.value })} />
          <input placeholder="Category" value={settingForm.category} onChange={(e) => setSettingForm({ ...settingForm, category: e.target.value })} />
          <input placeholder="Description" value={settingForm.description} onChange={(e) => setSettingForm({ ...settingForm, description: e.target.value })} />
          <button type="submit">Save Setting</button>
        </form>
        <div className="settingsTable">
          <table>
            <thead><tr><th>Key</th><th>Value</th><th>Category</th><th>Description</th><th>Updated</th></tr></thead>
            <tbody>
              {settings.map((row) => (
                <tr key={row.id} onClick={() => setSettingForm({ setting_key: row.setting_key || '', setting_value: row.setting_value || '', category: row.category || 'general', description: row.description || '' })}>
                  <td>{row.setting_key}</td><td>{row.setting_value}</td><td>{row.category}</td><td>{row.description}</td><td>{fmtDate(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
