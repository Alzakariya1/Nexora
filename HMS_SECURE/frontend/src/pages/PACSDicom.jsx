import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { pacsApi } from '../api';
import { FeatureHero, useIntegrationWorkspace, IntegrationKeyPanel, FhirPreview, Checklist, EnterpriseTable, StatusPill } from './advancedUtils.jsx';

const emptyStudy = {
  patient_id: '',
  doctor_id: '',
  scan_name: '',
  modality: 'CT',
  body_part: '',
  priority: 'routine',
  accession_number: '',
  dicom_study_id: '',
  series_instance_uid: '',
  orthanc_study_id: '',
  pacs_viewer_url: '',
};
const emptyConfig = { provider: 'orthanc', base_url: '', viewer_url_template: '', ae_title: '', remote_ae_title: '', worklist_enabled: true };

export default function PACSDicom({ currentHospital }) {
  const ws = useIntegrationWorkspace('ImagingStudy', 'pacs_dicom_enabled');
  const [dashboard, setDashboard] = useState(null);
  const [worklist, setWorklist] = useState([]);
  const [form, setForm] = useState(emptyStudy);
  const [config, setConfig] = useState(emptyConfig);
  const [linkForm, setLinkForm] = useState({});
  const [loading, setLoading] = useState(false);

  const totals = dashboard?.totals || {};
  const settings = dashboard?.settings || {};
  const mappedPercent = useMemo(() => totals.studies ? Math.round((totals.mapped_studies || 0) * 100 / totals.studies) : 0, [totals]);

  async function load() {
    try {
      const [dashRes, workRes] = await Promise.all([pacsApi.dashboard(), pacsApi.worklist({ limit: 100 })]);
      setDashboard(dashRes.data || null);
      setWorklist(Array.isArray(workRes.data) ? workRes.data : []);
      setConfig({ ...emptyConfig, ...(dashRes.data?.settings || {}) });
    } catch (err) {
      setDashboard(null);
      setWorklist([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await pacsApi.createStudy(form);
      toast.success('PACS/DICOM study created');
      setForm(emptyStudy);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Study creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyConnection(e) {
    e.preventDefault();
    try {
      await pacsApi.verifyConnection(config);
      toast.success('PACS configuration saved');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'PACS configuration failed');
    }
  }

  async function linkStudy(row) {
    const payload = linkForm[row.id] || {};
    try {
      await pacsApi.linkStudy(row.id, payload);
      toast.success('PACS link updated');
      setLinkForm({ ...linkForm, [row.id]: {} });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'PACS link update failed');
    }
  }

  async function updateStatus(row, status) {
    try {
      await pacsApi.updateStatus(row.id, status);
      toast.success('PACS status updated');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  }

  return <section className="pageStack enterprise-feature-page">
    <FeatureHero eyebrow="PACS / DICOM INTEGRATION" title="PACS / DICOM Worklist" hospital={currentHospital} description="Manage tenant-safe radiology imaging worklists, DICOM Study Instance UIDs, Orthanc/PACS viewer links, ImagingStudy manifests and integration configuration.">
      <button className="ghostBtn" onClick={() => ws.saveSetting(!ws.settingOn, 'PACS/DICOM readiness flag')}>{ws.settingOn ? 'Disable' : 'Enable'}</button>
    </FeatureHero>

    <div className="advStatsGrid">
      <div className="stat-card"><span>Total Studies</span><strong>{totals.studies || 0}</strong><small>radiology worklist</small></div>
      <div className="stat-card"><span>DICOM Mapped</span><strong>{totals.mapped_studies || 0}</strong><small>{mappedPercent}% mapped</small></div>
      <div className="stat-card"><span>Pending Worklist</span><strong>{totals.pending_worklist || 0}</strong><small>ordered/scheduled</small></div>
      <div className="stat-card"><span>Viewer Links</span><strong>{totals.viewer_links || 0}</strong><small>{settings.enabled ? 'PACS enabled' : 'PACS off'}</small></div>
    </div>

    <div className="grid twoCols">
      <form className="card enterprise-module-card form" onSubmit={create}>
        <h3>Create Imaging Study</h3>
        <label><span>Patient ID</span><input value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })} required /></label>
        <label><span>Doctor ID</span><input value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })} /></label>
        <label><span>Study / Scan Name</span><input value={form.scan_name} onChange={e => setForm({ ...form, scan_name: e.target.value })} required /></label>
        <label><span>Modality</span><select value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })}><option>XRAY</option><option>CT</option><option>MRI</option><option>USG</option><option>ECG</option><option>PET</option><option>MAMMO</option><option>DEXA</option><option>OTHER</option></select></label>
        <label><span>Body Part</span><input value={form.body_part} onChange={e => setForm({ ...form, body_part: e.target.value })} /></label>
        <label><span>Accession Number</span><input value={form.accession_number} onChange={e => setForm({ ...form, accession_number: e.target.value })} placeholder="auto if blank" /></label>
        <label><span>DICOM Study Instance UID</span><input value={form.dicom_study_id} onChange={e => setForm({ ...form, dicom_study_id: e.target.value })} placeholder="auto if blank" /></label>
        <label><span>Orthanc Study ID</span><input value={form.orthanc_study_id} onChange={e => setForm({ ...form, orthanc_study_id: e.target.value })} /></label>
        <label><span>PACS Viewer URL</span><input value={form.pacs_viewer_url} onChange={e => setForm({ ...form, pacs_viewer_url: e.target.value })} placeholder="https://viewer.example/study/..." /></label>
        <button disabled={loading}>{loading ? 'Creating...' : 'Create Imaging Study'}</button>
      </form>

      <form className="card enterprise-module-card form" onSubmit={verifyConnection}>
        <h3>PACS / Orthanc Configuration</h3>
        <label><span>Provider</span><select value={config.provider || 'orthanc'} onChange={e => setConfig({ ...config, provider: e.target.value })}><option value="orthanc">Orthanc</option><option value="dicomweb">DICOMweb</option><option value="vendor_pacs">Vendor PACS</option></select></label>
        <label><span>Base URL</span><input value={config.base_url || ''} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://pacs.example" /></label>
        <label><span>Viewer URL Template</span><input value={config.viewer_url_template || ''} onChange={e => setConfig({ ...config, viewer_url_template: e.target.value })} placeholder="https://viewer/studies/{studyUid}" /></label>
        <label><span>Local AE Title</span><input value={config.ae_title || ''} onChange={e => setConfig({ ...config, ae_title: e.target.value })} /></label>
        <label><span>Remote AE Title</span><input value={config.remote_ae_title || ''} onChange={e => setConfig({ ...config, remote_ae_title: e.target.value })} /></label>
        <label className="inlineCheck"><input type="checkbox" checked={Boolean(config.worklist_enabled)} onChange={e => setConfig({ ...config, worklist_enabled: e.target.checked })} /> Enable modality worklist</label>
        <button>Save / Verify PACS Config</button>
        <small className="muted">Current provider: {settings.provider || 'orthanc'} {settings.last_verified_at ? `• verified ${new Date(settings.last_verified_at).toLocaleString()}` : ''}</small>
      </form>
    </div>

    <EnterpriseTable title="DICOM Imaging Worklist" rows={worklist} columns={[
      { key: 'id', label: 'ID', render: r => `#${r.id}` },
      { key: 'patient_id', label: 'Patient', render: r => r.patient_name || r.patient_id || '-' },
      { key: 'scan_name', label: 'Study', render: r => <><strong>{r.scan_name || '-'}</strong><br/><small>{r.modality || '-'} {r.body_part || ''}</small></> },
      { key: 'accession_number', label: 'Accession' },
      { key: 'dicom_study_id', label: 'DICOM UID', render: r => <small>{r.dicom_study_id || r.study_instance_uid || '-'}</small> },
      { key: 'pacs_viewer_url', label: 'PACS Viewer', render: r => r.pacs_viewer_url ? <a href={r.pacs_viewer_url} target="_blank" rel="noreferrer">Open Viewer</a> : <span className="muted">No link</span> },
      { key: 'status', label: 'Status', render: r => <select value={r.status || 'ordered'} onChange={e => updateStatus(r, e.target.value)}><option value="ordered">ordered</option><option value="scheduled">scheduled</option><option value="scanned">scanned</option><option value="reported">reported</option><option value="approved">approved</option><option value="cancelled">cancelled</option></select> },
      { key: 'link', label: 'Link/Update', render: r => <div className="miniStack"><input placeholder="Study UID" value={(linkForm[r.id]?.dicom_study_id) ?? ''} onChange={e => setLinkForm({ ...linkForm, [r.id]: { ...(linkForm[r.id] || {}), dicom_study_id: e.target.value } })} /><input placeholder="PACS viewer URL" value={(linkForm[r.id]?.pacs_viewer_url) ?? ''} onChange={e => setLinkForm({ ...linkForm, [r.id]: { ...(linkForm[r.id] || {}), pacs_viewer_url: e.target.value } })} /><button type="button" className="miniBtn" onClick={() => linkStudy(r)}>Save</button></div> },
    ]} empty="No PACS/DICOM studies yet." />

    <div className="grid twoCols">
      <Checklist items={[
        'DICOM Study Instance UID captured per tenant',
        'Accession number worklist support added',
        'PACS viewer URL linking supported',
        'Orthanc/DICOMweb-ready configuration saved at hospital level',
        'FHIR ImagingStudy-style manifest available per study',
      ]} />
      <IntegrationKeyPanel title="Create PACS API Key" defaultName="PACS DICOM Key" scopes={['pacs.read', 'pacs.write', 'dicom.write', 'fhir.read']} workspace={ws} />
    </div>
    <FhirPreview workspace={ws} title="ImagingStudy / DiagnosticReport Preview" />
  </section>;
}
