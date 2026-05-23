import React, { useEffect, useState } from 'react';
import { integrationApi } from '../api/integrationApi';
import { FeatureHero, useIntegrationWorkspace, IntegrationKeyPanel, WebhookPanel, FhirPreview, Checklist, EnterpriseTable, commonColumns } from './advancedUtils.jsx';

export default function HL7Ready({ currentHospital }) {
  const ws = useIntegrationWorkspace('Patient', 'hl7_ready_enabled');
  const [summary, setSummary] = useState({ total: 0, queued: 0, sent: 0, failed: 0, recent: [] });
  const [test, setTest] = useState({ message_type: 'ADT^A04', patient_id: '', endpoint: '/api/hl7/messages' });
  const [preview, setPreview] = useState('');
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await integrationApi.hl7Summary();
      setSummary(res.data || {});
    } catch (e) {
      setSummary({ total: 0, queued: 0, sent: 0, failed: 0, recent: [] });
    }
  };
  useEffect(() => { load(); }, []);

  const generate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await integrationApi.hl7Generate(test);
      setPreview(res.data.raw_message || '');
      setParsed(res.data.parsed || null);
    } finally { setLoading(false); }
  };
  const queuePreview = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      await integrationApi.hl7Queue({ raw_message: preview, endpoint: test.endpoint, direction: 'outbound' });
      await load();
    } finally { setLoading(false); }
  };

  const hl7Columns = [
    { key: 'message_type', label: 'Type' }, { key: 'direction', label: 'Direction' }, { key: 'status', label: 'Status' },
    { key: 'control_id', label: 'Control ID' }, { key: 'retry_count', label: 'Retries' }, { key: 'created_at', label: 'Created' },
  ];

  return <section className="pageStack enterprise-feature-page">
    <FeatureHero eyebrow="HL7 INTEROPERABILITY" title="HL7 Ready" hospital={currentHospital} description="Configure HL7 ADT, ORM and ORU message workflows with queue, parser, ACK and retry readiness."><button className="ghostBtn" onClick={() => ws.saveSetting(!ws.settingOn, 'HL7 readiness flag')}>{ws.settingOn ? 'Disable' : 'Enable'}</button></FeatureHero>
    <div className="advStatsGrid"><div className="stat-card"><span>Total HL7 Messages</span><strong>{summary.total || 0}</strong><small>tenant scoped</small></div><div className="stat-card"><span>Queued</span><strong>{summary.queued || 0}</strong><small>pending delivery</small></div><div className="stat-card"><span>Sent</span><strong>{summary.sent || 0}</strong><small>ACK accepted</small></div><div className="stat-card"><span>Failed</span><strong>{summary.failed || 0}</strong><small>needs retry/review</small></div></div>
    <div className="grid twoCols"><IntegrationKeyPanel title="Create HL7 API Key" defaultName="HL7 Integration Key" scopes={['hl7.read','hl7.write','fhir.read']} workspace={ws}/><WebhookPanel title="HL7 Webhook Endpoint" defaultEvents="patient.created,appointment.created,lab.approved" workspace={ws}/></div>
    <div className="grid twoCols"><form className="card enterprise-module-card form" onSubmit={generate}><h3>Generate HL7 Test Message</h3><label><span>Message type</span><select value={test.message_type} onChange={e=>setTest({...test,message_type:e.target.value})}><option>ADT^A01</option><option>ADT^A04</option><option>ADT^A08</option><option>ORM^O01</option><option>ORU^R01</option></select></label><label><span>Patient ID / internal id</span><input value={test.patient_id} onChange={e=>setTest({...test,patient_id:e.target.value})} placeholder="Optional patient numeric id" /></label><label><span>Endpoint</span><input value={test.endpoint} onChange={e=>setTest({...test,endpoint:e.target.value})}/></label><button disabled={loading}>{loading ? 'Processing...' : 'Generate Preview'}</button>{preview && <button type="button" className="ghostBtn" onClick={queuePreview}>Queue Preview</button>}</form><FhirPreview workspace={ws} title="HL7/FHIR Resource Preview" /></div>
    {preview && <section className="card"><div className="sectionTitleRow"><h3>HL7 Preview</h3><button className="ghostBtn" onClick={queuePreview}>Queue Message</button></div><pre className="code-box">{preview}</pre>{parsed && <pre className="code-box">{JSON.stringify(parsed, null, 2)}</pre>}</section>}
    <Checklist items={['ADT patient registration/admission events', 'ORM order event readiness', 'ORU result event readiness', 'Message queue and ACK handling', 'Retry/failure log', 'Tenant-safe HL7 audit trail']} />
    <EnterpriseTable title="HL7 Queue" rows={summary.recent || []} columns={hl7Columns} empty="No HL7 queue messages yet. Generate and queue a test message." />
    <EnterpriseTable title="Integration Logs" rows={ws.logs.filter(x=>!x.system || x.system==='hl7' || x.system==='fhir')} columns={commonColumns.logs} empty="No HL7 logs yet." />
  </section>;
}
