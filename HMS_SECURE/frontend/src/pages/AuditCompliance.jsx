import React, { useEffect, useState } from 'react';
import { auditApi } from '../api';
import { FeatureHero, useIntegrationWorkspace, Checklist, EnterpriseTable, StatusPill } from './advancedUtils.jsx';

export default function AuditCompliance({ currentHospital }) {
  const ws = useIntegrationWorkspace('DiagnosticReport', 'audit_compliance_enabled');
  const [auditLogs, setAuditLogs] = useState([]);
  const [filter, setFilter] = useState({ module:'', status:'' });
  async function loadAudit(){ try{ const {data}=await auditApi.list(filter); setAuditLogs(Array.isArray(data)?data:[]);}catch{ setAuditLogs([]);} }
  useEffect(()=>{ loadAudit(); },[]);
  return <section className="pageStack enterprise-feature-page"><FeatureHero eyebrow="AUDIT & COMPLIANCE" title="Audit Compliance" hospital={currentHospital} description="Review audit logs, login history, security settings and export compliance evidence for hospital and SaaS audits."><button className="ghostBtn" onClick={()=>ws.saveSetting(!ws.settingOn,'Audit compliance feature flag')}>{ws.settingOn?'Disable':'Enable'}</button><a className="ghostBtn" href={auditApi.exportUrl(filter)} target="_blank">Export CSV</a></FeatureHero>
  <div className="advStatsGrid"><div className="stat-card"><span>Audit Logs</span><strong>{auditLogs.length}</strong><small>filtered events</small></div><div className="stat-card"><span>Login Events</span><strong>{ws.loginHistory.length}</strong><small>authentication evidence</small></div><div className="stat-card"><span>Security Settings</span><strong>{ws.settings.length}</strong><small>policy records</small></div><div className="stat-card"><span>Status</span><strong>{ws.settingOn?'ON':'OFF'}</strong><small>feature flag</small></div></div>
  <div className="card enterprise-module-card"><div className="sectionTitleRow"><h3>Audit Filters</h3><button onClick={loadAudit}>Apply</button></div><div className="inlineForm"><input placeholder="Module name" value={filter.module} onChange={e=>setFilter({...filter,module:e.target.value})}/><select value={filter.status} onChange={e=>setFilter({...filter,status:e.target.value})}><option value="">All status</option><option>success</option><option>failed</option><option>denied</option></select></div></div>
  <EnterpriseTable title="Audit Logs" rows={auditLogs} columns={[{key:'created_at',label:'Time',render:r=>r.created_at?new Date(r.created_at).toLocaleString():'-'},{key:'action',label:'Action'},{key:'module_name',label:'Module'},{key:'user_role',label:'Role'},{key:'status',label:'Status',render:r=><StatusPill type={r.status==='success'?'success':'danger'}>{r.status}</StatusPill>},{key:'severity',label:'Severity'}]} empty="No audit logs found for this filter." />
  <div className="grid twoCols"><EnterpriseTable title="Login Evidence" rows={ws.loginHistory} columns={[{key:'logged_at',label:'Time',render:r=>r.logged_at?new Date(r.logged_at).toLocaleString():'-'},{key:'email',label:'Email'},{key:'role',label:'Role'},{key:'status',label:'Status',render:r=><StatusPill type={r.status==='failed'?'danger':'success'}>{r.status}</StatusPill>}]} /><Checklist items={['Audit logs exportable','Login history captured','Security settings retained','Role changes auditable','Compliance evidence pack ready']} /></div>
  </section>;
}
