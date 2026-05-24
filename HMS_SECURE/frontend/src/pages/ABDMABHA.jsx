import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { integrationApi } from '../api';
import { FeatureHero, useIntegrationWorkspace, FhirPreview, Checklist, EnterpriseTable, StatusPill } from './advancedUtils.jsx';

const emptyIdentity = { patient_id: '', abha_number: '', verification_mode: 'manual_sandbox' };
const emptyConsent = { patient_id: '', abha_number: '', purpose: 'OP Consultation', status: 'requested', expires_at: '', notes: '' };
const emptyContext = { patient_id: '', context_type: 'OPD', reference_id: '', display: '', consent_uid: '' };

export default function ABDMABHA({ currentHospital }) {
  const ws = useIntegrationWorkspace('Patient', 'abdm_abha_enabled');
  const [summary, setSummary] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [consents, setConsents] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [identity, setIdentity] = useState(emptyIdentity);
  const [consent, setConsent] = useState(emptyConsent);
  const [context, setContext] = useState(emptyContext);
  const [loading, setLoading] = useState(false);
  const logs = ws.logs.filter(x => x.system === 'abdm_abha');

  async function loadAbdm() {
    setLoading(true);
    try {
      const [sum, ready, con, ctx] = await Promise.all([
        integrationApi.abdmSummary().catch(() => ({ data: null })),
        integrationApi.abdmReadiness().catch(() => ({ data: null })),
        integrationApi.abdmConsents().catch(() => ({ data: [] })),
        integrationApi.abdmCareContexts().catch(() => ({ data: [] })),
      ]);
      setSummary(sum.data);
      setReadiness(ready.data);
      setConsents(Array.isArray(con.data) ? con.data : []);
      setContexts(Array.isArray(ctx.data) ? ctx.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'ABDM workspace failed to load');
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAbdm(); }, []);

  async function verifyIdentity(e) {
    e.preventDefault();
    try {
      await integrationApi.abdmVerifyIdentity(identity);
      toast.success('ABHA identity linked');
      setIdentity(emptyIdentity);
      await Promise.all([loadAbdm(), ws.load?.()]);
    } catch (err) { toast.error(err.response?.data?.message || 'ABHA verification failed'); }
  }
  async function createConsent(e) {
    e.preventDefault();
    try {
      await integrationApi.abdmCreateConsent(consent);
      toast.success('Consent recorded');
      setConsent(emptyConsent);
      await Promise.all([loadAbdm(), ws.load?.()]);
    } catch (err) { toast.error(err.response?.data?.message || 'Consent save failed'); }
  }
  async function linkContext(e) {
    e.preventDefault();
    try {
      await integrationApi.abdmCreateCareContext(context);
      toast.success('Care context linked');
      setContext(emptyContext);
      await Promise.all([loadAbdm(), ws.load?.()]);
    } catch (err) { toast.error(err.response?.data?.message || 'Care context link failed'); }
  }

  const totals = summary?.totals || {};
  const checks = readiness?.checks || [];

  return <section className="pageStack enterprise-feature-page">
    <FeatureHero eyebrow="ABDM / ABHA INTEGRATION" title="ABDM/ABHA" hospital={currentHospital} description="Upgrade existing ABDM/ABHA readiness into a tenant-safe workspace for ABHA identity verification, consent artefacts, care context linking and sandbox callback logging.">
      <button className="ghostBtn" onClick={() => ws.saveSetting(!ws.settingOn, 'ABDM/ABHA readiness flag')}>{ws.settingOn ? 'Disable' : 'Enable'}</button>
    </FeatureHero>

    <div className="advStatsGrid">
      <div className="stat-card"><span>ABHA Linked Patients</span><strong>{totals.abha_linked_patients || 0}</strong><small>verified or captured IDs</small></div>
      <div className="stat-card"><span>Granted Consents</span><strong>{totals.granted_consents || 0}</strong><small>{totals.consents || 0} total consents</small></div>
      <div className="stat-card"><span>Care Contexts</span><strong>{totals.care_contexts || 0}</strong><small>linked to patients</small></div>
      <div className="stat-card"><span>Readiness</span><strong>{readiness?.ready_score ?? 0}%</strong><small>{summary?.settings?.mode || 'sandbox-ready'}</small></div>
    </div>

    <div className="grid threeCols">
      <form className="card enterprise-module-card form" onSubmit={verifyIdentity}>
        <h3>Verify / Link ABHA Identity</h3>
        <label><span>Patient ID</span><input value={identity.patient_id} onChange={e => setIdentity({ ...identity, patient_id: e.target.value })} required /></label>
        <label><span>ABHA Number / Address</span><input value={identity.abha_number} onChange={e => setIdentity({ ...identity, abha_number: e.target.value })} placeholder="14 digit ABHA or name@abdm" required /></label>
        <label><span>Mode</span><select value={identity.verification_mode} onChange={e => setIdentity({ ...identity, verification_mode: e.target.value })}><option>manual_sandbox</option><option>otp_verified</option><option>document_verified</option></select></label>
        <button>Verify ABHA</button>
      </form>

      <form className="card enterprise-module-card form" onSubmit={createConsent}>
        <h3>Consent Artefact Workflow</h3>
        <label><span>Patient ID</span><input value={consent.patient_id} onChange={e => setConsent({ ...consent, patient_id: e.target.value })} required /></label>
        <label><span>ABHA Number / Address</span><input value={consent.abha_number} onChange={e => setConsent({ ...consent, abha_number: e.target.value })} /></label>
        <label><span>Purpose</span><input value={consent.purpose} onChange={e => setConsent({ ...consent, purpose: e.target.value })} /></label>
        <label><span>Status</span><select value={consent.status} onChange={e => setConsent({ ...consent, status: e.target.value })}><option>requested</option><option>granted</option><option>denied</option><option>revoked</option><option>expired</option></select></label>
        <button>Record Consent</button>
      </form>

      <form className="card enterprise-module-card form" onSubmit={linkContext}>
        <h3>Link Care Context</h3>
        <label><span>Patient ID</span><input value={context.patient_id} onChange={e => setContext({ ...context, patient_id: e.target.value })} required /></label>
        <label><span>Context Type</span><select value={context.context_type} onChange={e => setContext({ ...context, context_type: e.target.value })}><option>OPD</option><option>IPD</option><option>LAB</option><option>RADIOLOGY</option><option>PRESCRIPTION</option><option>BILLING</option><option>DOCUMENT</option></select></label>
        <label><span>Reference ID</span><input value={context.reference_id} onChange={e => setContext({ ...context, reference_id: e.target.value })} /></label>
        <label><span>Display</span><input value={context.display} onChange={e => setContext({ ...context, display: e.target.value })} placeholder="OPD visit / lab report / discharge summary" /></label>
        <button>Link Context</button>
      </form>
    </div>

    <div className="grid twoCols">
      <FhirPreview workspace={ws} title="ABDM Patient FHIR Bundle Preview" />
      <div className="card enterprise-module-card">
        <div className="sectionTitleRow"><h3>ABDM Readiness Checks</h3><span>{loading ? 'Loading...' : `${readiness?.ready_score ?? 0}%`}</span></div>
        <div className="checklistGrid">{checks.map(c => <div className="checkRow" key={c.key}><span className="checkIcon">{c.passed ? '✓' : '!'}</span><div><strong>{c.label}</strong><small>{c.passed ? 'Ready' : 'Needs setup'}</small></div></div>)}</div>
      </div>
    </div>

    <Checklist items={['ABHA number/address verification writes only masked identifiers','Consent artefact workflow is tenant-scoped and audit logged','Care context links connect OPD/IPD/Lab/Radiology/Prescription/Billing records','FHIR Patient bundle remains available for ABDM exchange readiness','Sandbox callback endpoint logs inbound ABDM events']} />

    <EnterpriseTable title="ABDM Consent Artefacts" rows={consents} columns={[{ key: 'created_at', label: 'Time', render: r => r.created_at ? new Date(r.created_at).toLocaleString() : '-' }, { key: 'patient_id', label: 'Patient ID' }, { key: 'abha_masked', label: 'ABHA' }, { key: 'purpose', label: 'Purpose' }, { key: 'status', label: 'Status', render: r => <StatusPill type={['revoked','expired','denied'].includes(r.status) ? 'danger' : 'success'}>{r.status}</StatusPill> }, { key: 'consent_artefact_id', label: 'Artefact' }]} empty="No ABDM consent artefacts yet." />
    <EnterpriseTable title="ABHA Care Context Links" rows={contexts} columns={[{ key: 'created_at', label: 'Time', render: r => r.created_at ? new Date(r.created_at).toLocaleString() : '-' }, { key: 'patient_id', label: 'Patient ID' }, { key: 'context_type', label: 'Type' }, { key: 'reference_id', label: 'Reference' }, { key: 'display', label: 'Display' }, { key: 'status', label: 'Status', render: r => <StatusPill>{r.status}</StatusPill> }]} empty="No care contexts linked yet." />
    <EnterpriseTable title="ABDM / ABHA Integration Logs" rows={logs} columns={[{ key: 'created_at', label: 'Time', render: r => r.created_at ? new Date(r.created_at).toLocaleString() : '-' }, { key: 'resource_type', label: 'Resource' }, { key: 'method', label: 'Action' }, { key: 'endpoint', label: 'Endpoint' }, { key: 'status', label: 'Status', render: r => <StatusPill type={r.status === 'failed' ? 'danger' : 'success'}>{r.status}</StatusPill> }]} empty="No ABDM/ABHA logs yet." />
  </section>;
}
