import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FeatureHero, useIntegrationWorkspace, IntegrationKeyPanel, Checklist, EnterpriseTable, StatusPill } from './advancedUtils.jsx';
import { erpTallyApi } from '../api';

const defaultMap = {
  sales_ledger: 'Hospital Sales',
  tax_ledger: 'GST Output',
  cash_ledger: 'Cash',
  bank_ledger: 'Bank',
  receivable_ledger: 'Patient Receivables',
  discount_ledger: 'Discount Allowed',
  refund_ledger: 'Refunds',
};

export default function ERPTally({ currentHospital }) {
  const ws = useIntegrationWorkspace('Invoice', 'erp_tally_enabled');
  const [map, setMap] = useState(defaultMap);
  const [summary, setSummary] = useState({});
  const [preview, setPreview] = useState(null);
  const [format, setFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const erpLogs = useMemo(() => ws.logs.filter(x => x.system === 'erp_tally'), [ws.logs]);

  async function loadErp() {
    try {
      const [sum, ledger, prev] = await Promise.all([
        erpTallyApi.summary().catch(() => ({ data: {} })),
        erpTallyApi.ledgerMapping().catch(() => ({ data: { active_mapping: defaultMap } })),
        erpTallyApi.previewExport({ limit: 10, format }).catch(() => ({ data: null })),
      ]);
      setSummary(sum.data || {});
      setMap({ ...defaultMap, ...(ledger.data?.active_mapping || {}) });
      setPreview(prev.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'ERP/Tally workspace failed to load');
    }
  }

  useEffect(() => { loadErp(); }, [format]);

  async function saveMapping(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await erpTallyApi.saveLedgerMapping({ title: 'ERP/Tally Ledger Mapping', ...map });
      toast.success('Ledger mapping saved');
      await loadErp();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ledger mapping save failed');
    } finally { setLoading(false); }
  }

  async function runExport() {
    setLoading(true);
    try {
      const { data } = await erpTallyApi.runExport({ format, ledger_mapping: map, limit: 500 });
      setPreview({ manifest: data.manifest, vouchers: Array.isArray(data.payload) ? data.payload : [] });
      toast.success('ERP/Tally export generated');
      await ws.load();
      await loadErp();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ERP/Tally export failed');
    } finally { setLoading(false); }
  }

  return <section className="pageStack enterprise-feature-page">
    <FeatureHero eyebrow="ERP / TALLY UPGRADE" title="ERP/Tally Integration" hospital={currentHospital} description="Upgrade existing ERP/Tally readiness into tenant-safe accounting exports with ledger mapping, voucher preview, checksum manifest, audit logs and Tally XML/CSV/JSON payloads.">
      <button className="ghostBtn" onClick={() => ws.saveSetting(!ws.settingOn, 'ERP/Tally readiness flag')}>{ws.settingOn ? 'Disable' : 'Enable'}</button>
    </FeatureHero>

    <div className="advStatsGrid">
      <div className="stat-card"><span>Invoices</span><strong>{summary.invoice_count || 0}</strong><small>tenant scoped</small></div>
      <div className="stat-card"><span>Collected</span><strong>₹{summary.collected_amount || 0}</strong><small>export basis</small></div>
      <div className="stat-card"><span>Outstanding</span><strong>₹{summary.outstanding_amount || 0}</strong><small>receivable ledger</small></div>
      <div className="stat-card"><span>Exports</span><strong>{summary.export_count || erpLogs.length}</strong><small>{summary.failed_exports || 0} failed</small></div>
    </div>

    <div className="grid twoCols">
      <form className="card enterprise-module-card form" onSubmit={saveMapping}>
        <h3>Ledger Mapping</h3>
        <label><span>Sales ledger</span><input value={map.sales_ledger} onChange={e => setMap({ ...map, sales_ledger: e.target.value })} /></label>
        <label><span>GST / tax ledger</span><input value={map.tax_ledger} onChange={e => setMap({ ...map, tax_ledger: e.target.value })} /></label>
        <label><span>Cash ledger</span><input value={map.cash_ledger} onChange={e => setMap({ ...map, cash_ledger: e.target.value })} /></label>
        <label><span>Bank / UPI / card ledger</span><input value={map.bank_ledger} onChange={e => setMap({ ...map, bank_ledger: e.target.value })} /></label>
        <label><span>Patient receivable ledger</span><input value={map.receivable_ledger} onChange={e => setMap({ ...map, receivable_ledger: e.target.value })} /></label>
        <div className="rowActions"><button disabled={loading}>Save Mapping</button><button type="button" className="ghostBtn" onClick={runExport} disabled={loading}>Generate Export</button></div>
      </form>
      <div className="card enterprise-module-card form">
        <h3>Export Control</h3>
        <label><span>Export format</span><select value={format} onChange={e => setFormat(e.target.value)}><option value="json">JSON</option><option value="xml">Tally XML</option><option value="csv">CSV</option></select></label>
        <div className="alert success"><strong>Manifest checksum</strong><code>{preview?.manifest?.checksum || 'Preview unavailable until bills exist.'}</code></div>
        <p className="muted">Exports are read-only from billing data. They create an integration log and never mutate invoices.</p>
        <IntegrationKeyPanel title="Create ERP API Key" defaultName="ERP/Tally Export Key" scopes={['invoice.read','payment.read','erp.export']} workspace={ws}/>
      </div>
    </div>

    <div className="grid twoCols">
      <div className="card enterprise-module-card">
        <div className="sectionTitleRow"><h3>Voucher Preview</h3><StatusPill>{format.toUpperCase()}</StatusPill></div>
        <pre className="code-box adv-code-preview">{preview ? JSON.stringify(preview, null, 2).slice(0, 3500) : 'No voucher preview available. Create bills or refresh the workspace.'}</pre>
      </div>
      <Checklist items={['Existing ERP/Tally page upgraded, not duplicated','Ledger mapping persisted tenant-wise','Billing invoices mapped to accounting vouchers','Tally XML, CSV and JSON export formats supported','Export checksum manifest and audit log created']} />
    </div>

    <EnterpriseTable title="ERP/Tally Export Logs" rows={erpLogs} columns={[{key:'created_at',label:'Time',render:r=>r.created_at?new Date(r.created_at).toLocaleString():'-'},{key:'resource_type',label:'Resource'},{key:'method',label:'Action'},{key:'endpoint',label:'Endpoint'},{key:'status',label:'Status',render:r=><StatusPill type={r.status === 'failed' ? 'danger' : 'success'}>{r.status}</StatusPill>}]} empty="No ERP export logs yet. Generate an export." />
  </section>;
}
