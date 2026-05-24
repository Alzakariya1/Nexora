import React, { useEffect, useMemo, useState } from 'react';
import { configurationApi } from '../api/configurationApi';
import { templateApi } from '../api/templateApi';
import { subscriptionApi } from '../api/subscriptionApi';
import { DataTable } from '../components';
import { toast } from 'react-hot-toast';

const emptyField = {
  target_module: 'patients',
  label: '',
  field_key: '',
  field_type: 'text',
  placeholder: '',
  section: 'Additional Details',
  help_text: '',
  required: false,
  options: '',
  default_value: '',
  display_order: 100,
  is_active: true,
};

const moduleLabels = {
  patients: 'Patients',
  doctors: 'Doctors',
  appointments: 'Appointments',
  billing: 'Billing',
  lab: 'Laboratory',
  radiology: 'Radiology',
  pharmacy: 'Pharmacy',
  ipd: 'IPD',
  opd: 'OPD',
};

function buildKey(label = '') {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export default function Configuration({ permissions = {}, onChanged }) {
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState(emptyField);
  const [editingId, setEditingId] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [templatePreview, setTemplatePreview] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState({ template_type: 'invoice', name: '', header_text: '', body_template: '', footer_text: '', is_default: false, is_active: true });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [{ data }, tpl] = await Promise.all([
        configurationApi.listDynamicFields(moduleFilter === 'all' ? {} : { module: moduleFilter }),
        templateApi.list().catch(() => ({ data: [] })),
      ]);
      setFields(data);
      setTemplates(tpl.data || []);
      try {
        const [currentSub, planRows] = await Promise.all([subscriptionApi.current(), subscriptionApi.plans()]);
        setSubscription(currentSub.data);
        setPlans(planRows.data || []);
      } catch (_) {
        setSubscription(null);
        setPlans([]);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Configuration data could not be loaded. Please check API route and permissions.';
      setLoadError(msg);
      setFields([]);
      setTemplates([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [moduleFilter]);

  const grouped = useMemo(() => fields.reduce((acc, row) => {
    acc[row.target_module] = (acc[row.target_module] || 0) + 1;
    return acc;
  }, {}), [fields]);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    const payload = {
      ...form,
      field_key: form.field_key || buildKey(form.label),
      display_order: Number(form.display_order || 100),
      options: String(form.options || '').split(',').map(x => x.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await configurationApi.updateDynamicField(editingId, payload);
        setMessage('Dynamic field updated successfully.');
        toast.success('Field updated successfully.');
      } else {
        await configurationApi.createDynamicField(payload);
        setMessage('Dynamic field created successfully.');
        toast.success('Field created successfully. It will now appear in supported forms.');
      }
      setForm(emptyField);
      setEditingId(null);
      await load();
      await onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Unable to save dynamic field.';
      setMessage(msg);
      toast.error(msg);
    }
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      target_module: row.target_module || 'patients',
      label: row.label || '',
      field_key: row.field_key || '',
      field_type: row.field_type || 'text',
      placeholder: row.placeholder || '',
      section: row.section || 'Additional Details',
      help_text: row.help_text || '',
      required: Boolean(row.required),
      options: Array.isArray(row.options) ? row.options.join(', ') : '',
      default_value: row.default_value || '',
      display_order: row.display_order || 100,
      is_active: row.is_active !== false,
    });
  }

  async function toggle(row) {
    try {
      await configurationApi.updateDynamicFieldStatus(row.id, !row.is_active);
      toast.success(!row.is_active ? 'Field activated successfully.' : 'Field deactivated successfully.');
      await load();
      await onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to update field status.');
    }
  }


  async function submitTemplate(e) {
    e.preventDefault();
    setMessage('');
    try {
      if (editingTemplateId) {
        await templateApi.update(editingTemplateId, templateForm);
        setMessage('Template updated successfully.');
        toast.success('Template updated successfully.');
      } else {
        await templateApi.create(templateForm);
        setMessage('Template created successfully.');
        toast.success('Template created successfully.');
      }
      setTemplateForm({ template_type: 'invoice', name: '', header_text: '', body_template: '', footer_text: '', is_default: false, is_active: true });
      setEditingTemplateId(null);
      setTemplatePreview('');
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Unable to save template.';
      setMessage(msg);
      toast.error(msg);
    }
  }

  function editTemplate(row) {
    setEditingTemplateId(row.id);
    setTemplateForm({
      template_type: row.template_type || 'invoice',
      name: row.name || '',
      header_text: row.header_text || '',
      body_template: row.body_template || '',
      footer_text: row.footer_text || '',
      is_default: Boolean(row.is_default),
      is_active: row.is_active !== false,
    });
  }

  async function removeTemplate(row) {
    if (!confirm(`Delete template ${row.name}?`)) return;
    try {
      await templateApi.delete(row.id);
      toast.success('Template deleted successfully.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to delete template.');
    }
  }

  async function previewTemplate(row) {
    try {
      const { data } = await templateApi.preview(row.id);
      setTemplatePreview(data.preview || '');
      toast.success('Template preview generated.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to preview template.');
    }
  }

  async function remove(row) {
    if (!confirm(`Delete field ${row.label || row.field_key}? Existing saved values will remain in records but the field will no longer show in forms.`)) return;
    try {
      await configurationApi.deleteDynamicField(row.id);
      toast.success('Field deleted successfully.');
      await load();
      await onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to delete field.');
    }
  }

  return (
    <section className="configuration-page">
      <div className="page-intro-card">
        <div>
          <span className="doctor-kicker">No-Code Configuration</span>
          <h1>Dynamic Forms</h1>
          <p className="muted">Add hospital-specific fields to patient, doctor and clinical workflows without code changes.</p>
        </div>
        <div className="config-summary-grid">
          <div><b>{fields.length}</b><span>Total Fields</span></div>
          <div><b>{fields.filter(x => x.is_active !== false).length}</b><span>Active</span></div>
          <div><b>{Object.keys(grouped).length}</b><span>Modules</span></div>
        </div>
      </div>

      {subscription && (
        <div className="subscription-panel">
          <div className="card subscription-current">
            <span className="doctor-kicker">Current SaaS Plan</span>
            <h2>{subscription.plan_name}</h2>
            <p className="muted">{subscription.description}</p>
            <div className="planUsageGrid">
              {Object.entries(subscription.checks || {}).map(([key, value]) => (
                <div className="usageMeter" key={key}>
                  <div><b>{key.replaceAll('_', ' ')}</b><span>{value.used} / {value.limit}</span></div>
                  <progress value={value.used} max={value.limit || 1}></progress>
                </div>
              ))}
            </div>
          </div>
          <div className="planCards">
            {plans.map(plan => (
              <div className={plan.id === subscription.plan ? 'planCard active' : 'planCard'} key={plan.id}>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <b>₹{Number(plan.monthly_price_inr || 0).toLocaleString()}/mo</b>
                <small>{plan.modules?.length || 0} modules · {plan.limits?.users} users</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="config-layout-grid">
        <form className="card form configuration-form" onSubmit={submit}>
          <h2>{editingId ? 'Edit Dynamic Field' : 'Create Dynamic Field'}</h2>
          {message && <p className="muted">{message}</p>}
          {loadError && <p className="alert danger">{loadError}</p>}
          <div className="formGrid">
            <select value={form.target_module} onChange={e => setForm({ ...form, target_module: e.target.value })}>
              {Object.entries(moduleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input placeholder="Label e.g. ABHA ID" value={form.label} required onChange={e => setForm({ ...form, label: e.target.value, field_key: form.field_key || buildKey(e.target.value) })} />
            <input placeholder="Field key e.g. abha_id" value={form.field_key} required onChange={e => setForm({ ...form, field_key: buildKey(e.target.value) })} />
            <select value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
              <option value="textarea">Textarea</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <input placeholder="Section" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
            <input placeholder="Placeholder" value={form.placeholder} onChange={e => setForm({ ...form, placeholder: e.target.value })} />
            <input placeholder="Options: one, two, three" value={form.options} disabled={form.field_type !== 'select'} onChange={e => setForm({ ...form, options: e.target.value })} />
            <input type="number" placeholder="Display order" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} />
          </div>
          <textarea placeholder="Help text" value={form.help_text} onChange={e => setForm({ ...form, help_text: e.target.value })} />
          <div className="config-checkbox-row">
            <label><input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} /> Required field</label>
            <label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={!permissions.configurationManage}>{editingId ? 'Update Field' : 'Create Field'}</button>
            {editingId && <button type="button" className="secondaryBtn" onClick={() => { setEditingId(null); setForm(emptyField); }}>Cancel</button>}
          </div>
        </form>

        <div className="card configuration-guide">
          <h3>Enterprise use cases</h3>
          <ul>
            <li>Add ABHA ID, passport, insurance or custom ID fields per hospital.</li>
            <li>Add doctor credential fields without frontend code changes.</li>
            <li>Keep data inside <b>custom_fields</b> so old records stay safe.</li>
            <li>Fields are tenant/hospital isolated.</li>
          </ul>
        </div>
      </div>


      <div className="config-layout-grid" style={{ marginTop: 18 }}>
        <form className="card form configuration-form" onSubmit={submitTemplate}>
          <h2>{editingTemplateId ? 'Edit Template' : 'Create Template'}</h2>
          <p className="muted">Build hospital-wise invoice, prescription and report templates.</p>
          <div className="formGrid">
            <select value={templateForm.template_type} onChange={e => setTemplateForm({ ...templateForm, template_type: e.target.value })}>
              <option value="invoice">Invoice</option>
              <option value="prescription">Prescription</option>
              <option value="lab_report">Lab Report</option>
              <option value="radiology_report">Radiology Report</option>
              <option value="discharge_summary">Discharge Summary</option>
            </select>
            <input placeholder="Template name" value={templateForm.name} required onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} />
          </div>
          <input placeholder="Header text" value={templateForm.header_text} onChange={e => setTemplateForm({ ...templateForm, header_text: e.target.value })} />
          <textarea rows={5} placeholder="Body template. Example: Patient: {{patient_name}} | Doctor: {{doctor_name}} | Total: {{total_amount}}" value={templateForm.body_template} onChange={e => setTemplateForm({ ...templateForm, body_template: e.target.value })} />
          <input placeholder="Footer text" value={templateForm.footer_text} onChange={e => setTemplateForm({ ...templateForm, footer_text: e.target.value })} />
          <div className="config-checkbox-row">
            <label><input type="checkbox" checked={templateForm.is_default} onChange={e => setTemplateForm({ ...templateForm, is_default: e.target.checked })} /> Default template</label>
            <label><input type="checkbox" checked={templateForm.is_active} onChange={e => setTemplateForm({ ...templateForm, is_active: e.target.checked })} /> Active</label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={!permissions.configurationManage}>{editingTemplateId ? 'Update Template' : 'Create Template'}</button>
            {editingTemplateId && <button type="button" className="secondaryBtn" onClick={() => { setEditingTemplateId(null); setTemplateForm({ template_type: 'invoice', name: '', header_text: '', body_template: '', footer_text: '', is_default: false, is_active: true }); }}>Cancel</button>}
          </div>
        </form>
        <div className="card configuration-guide">
          <h3>Template variables</h3>
          <ul>
            <li><b>{"{{patient_name}}"}</b>, <b>{"{{doctor_name}}"}</b>, <b>{"{{hospital_name}}"}</b></li>
            <li><b>{"{{invoice_number}}"}</b>, <b>{"{{total_amount}}"}</b>, <b>{"{{paid_amount}}"}</b></li>
            <li><b>{"{{diagnosis}}"}</b>, <b>{"{{prescription_items}}"}</b>, <b>{"{{report_notes}}"}</b></li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="patient-document-header">
          <div>
            <h2>Document Templates</h2>
            <p className="muted">Hospital-wise printable templates for invoices, prescriptions and reports.</p>
          </div>
        </div>
        <DataTable
          rows={templates.map(row => ({ ...row, type_label: String(row.template_type || '').replaceAll('_', ' '), default_label: row.is_default ? 'Default' : '-', active_label: row.is_active === false ? 'Inactive' : 'Active' }))}
          cols={['id', 'type_label', 'name', 'default_label', 'active_label']}
          onEdit={permissions.configurationManage ? editTemplate : null}
          onDelete={permissions.configurationManage ? removeTemplate : null}
          extraActions={permissions.configurationManage ? [{ label: 'Preview', onClick: previewTemplate }] : []}
        />
        {templatePreview && (
          <div className="template-preview-box">
            <h3>Template Preview</h3>
            <pre>{templatePreview}</pre>
          </div>
        )}
      </div>

      <div className="card">
        <div className="patient-document-header">
          <div>
            <h2>Configured Fields</h2>
            <p className="muted">These fields will appear in supported module forms.</p>
          </div>
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="all">All modules</option>
            {Object.entries(moduleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {loadError && <div className="emptyState">{loadError}</div>}
        {loading ? <p className="muted">Loading fields...</p> : (
          <DataTable
            rows={fields.map(row => ({ ...row, module_label: moduleLabels[row.target_module] || row.target_module, options_text: Array.isArray(row.options) ? row.options.join(', ') : '' }))}
            cols={['id', 'module_label', 'label', 'field_key', 'field_type', 'section', r => r.required ? 'Required' : 'Optional', r => r.is_active === false ? 'Inactive' : 'Active']}
            onEdit={permissions.configurationManage ? edit : null}
            onDelete={permissions.configurationManage ? remove : null}
            extraActions={permissions.configurationManage ? [{ label: 'Toggle Active', onClick: toggle }] : []}
          />
        )}
      </div>
    </section>
  );
}
