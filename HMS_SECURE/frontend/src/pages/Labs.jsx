import React, { useMemo, useState } from "react";

const LAB_STATUS = ["ordered", "sample_collected", "received", "processing", "result_entered", "approved", "completed", "cancelled"];
const RAD_STATUS = ["ordered", "scheduled", "scanned", "reported", "approved", "cancelled"];
const MODALITIES = ["XRAY", "CT", "MRI", "USG", "MAMMO", "DEXA", "OTHER"];

function Badge({ value }) {
  return <span className={`statusPill statusPill-${String(value || "").replaceAll("_", "-")}`}>{String(value || "ordered").replaceAll("_", " ")}</span>;
}

function PersonSelect({ value, onChange, list, placeholder, type }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((item) => {
        const code = type === "doctor" ? item.doctor_id || item.id : item.patient_id || item.id;
        return <option key={item.id} value={code}>{item.full_name || item.name} {code ? `(${code})` : ""}</option>;
      })}
    </select>
  );
}

function TemplateBuilder({ templates = [], createLabTemplate }) {
  const [form, setForm] = useState({ test_name: "", test_category: "General", sample_type: "Blood", container: "", turnaround_hours: 24, price: 0, machine_code: "", loinc_code: "", method: "", report_template: "" });
  const [param, setParam] = useState({ name: "", unit: "", normal_range: "", min: "", max: "", input_type: "number" });
  const [parameters, setParameters] = useState([]);
  const addParam = () => {
    if (!param.name) return;
    setParameters([...parameters, param]);
    setParam({ name: "", unit: "", normal_range: "", min: "", max: "", input_type: "number" });
  };
  const submit = async (e) => {
    e.preventDefault();
    await createLabTemplate?.({ ...form, parameters });
    setForm({ test_name: "", test_category: "General", sample_type: "Blood", container: "", turnaround_hours: 24, price: 0, machine_code: "", loinc_code: "", method: "", report_template: "" });
    setParameters([]);
  };
  return (
    <div className="workflowTableCard">
      <h3>Test Parameter Templates</h3>
      <form className="enterpriseForm compactForm" onSubmit={submit}>
        <div className="formGrid">
          <input required placeholder="Test name" value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} />
          <input placeholder="Category" value={form.test_category} onChange={(e) => setForm({ ...form, test_category: e.target.value })} />
          <input placeholder="Sample type" value={form.sample_type} onChange={(e) => setForm({ ...form, sample_type: e.target.value })} />
          <input placeholder="Container" value={form.container} onChange={(e) => setForm({ ...form, container: e.target.value })} />
          <input type="number" placeholder="TAT hours" value={form.turnaround_hours} onChange={(e) => setForm({ ...form, turnaround_hours: e.target.value })} />
          <input placeholder="Machine code/API code" value={form.machine_code} onChange={(e) => setForm({ ...form, machine_code: e.target.value })} />
        </div>
        <div className="formGrid">
          <input placeholder="Parameter" value={param.name} onChange={(e) => setParam({ ...param, name: e.target.value })} />
          <input placeholder="Unit" value={param.unit} onChange={(e) => setParam({ ...param, unit: e.target.value })} />
          <input placeholder="Normal range" value={param.normal_range} onChange={(e) => setParam({ ...param, normal_range: e.target.value })} />
          <button type="button" className="ghostBtn" onClick={addParam}>Add Parameter</button>
        </div>
        <p className="muted">Parameters: {parameters.map(p => `${p.name} ${p.normal_range ? `(${p.normal_range})` : ""}`).join(", ") || "None added"}</p>
        <button>Create Template</button>
      </form>
      <table>
        <thead><tr><th>ID</th><th>Test</th><th>Sample</th><th>Parameters</th><th>Machine Code</th><th>Status</th></tr></thead>
        <tbody>
          {templates.map(t => <tr key={t.id}><td>#{t.id}</td><td>{t.test_name}</td><td>{t.sample_type}</td><td>{(t.parameters || []).length}</td><td>{t.machine_code || "-"}</td><td><Badge value={t.status || "active"} /></td></tr>)}
          {!templates.length && <tr><td colSpan="6" className="emptyCell">No test templates yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ResultEditor({ row, onSave, onApprove }) {
  const [open, setOpen] = useState(false);
  const [parameters, setParameters] = useState(row.result_parameters || []);
  const [notes, setNotes] = useState(row.report_notes || "");
  const [pdf, setPdf] = useState(row.report_pdf_url || row.report_file || "");
  if (!open) return <button type="button" className="miniBtn" onClick={() => setOpen(true)}>Result Entry</button>;
  return (
    <div className="miniReportBox wideMiniBox">
      {(parameters.length ? parameters : [{ name: "Result", unit: "", normal_range: "", result_value: "" }]).map((p, idx) => (
        <div className="formGrid" key={`${p.name}-${idx}`}>
          <input placeholder="Parameter" value={p.name || ""} onChange={(e) => setParameters(parameters.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
          <input placeholder="Result" value={p.result_value || ""} onChange={(e) => setParameters(parameters.map((x, i) => i === idx ? { ...x, result_value: e.target.value } : x))} />
          <input placeholder="Unit" value={p.unit || ""} onChange={(e) => setParameters(parameters.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
          <input placeholder="Normal range" value={p.normal_range || ""} onChange={(e) => setParameters(parameters.map((x, i) => i === idx ? { ...x, normal_range: e.target.value } : x))} />
        </div>
      ))}
      <textarea placeholder="Interpretation / report notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <input placeholder="PDF report URL" value={pdf} onChange={(e) => setPdf(e.target.value)} />
      <div className="rowActions">
        <button type="button" onClick={() => onSave(row.id, { result_parameters: parameters, report_notes: notes, report_pdf_url: pdf })}>Save Result</button>
        <button type="button" className="ghostBtn" onClick={() => onApprove(row.id, { report_pdf_url: pdf, report_notes: notes })}>Approve</button>
        <button type="button" className="ghostBtn" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}

function RadiologyReportEditor({ row, onSave, onApprove }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dicom_study_id: row.dicom_study_id || "", pacs_viewer_url: row.pacs_viewer_url || "", radiologist_name: row.radiologist_name || "", technician_name: row.technician_name || "", findings: row.findings || "", impression: row.impression || "", recommendation: row.recommendation || "", report_file: row.report_file || "", image_file: row.image_file || "" });
  if (!open) return <button type="button" className="miniBtn" onClick={() => setOpen(true)}>Radiologist Report</button>;
  return (
    <div className="miniReportBox wideMiniBox">
      <div className="formGrid">
        <input placeholder="DICOM Study ID" value={form.dicom_study_id} onChange={(e) => setForm({ ...form, dicom_study_id: e.target.value })} />
        <input placeholder="PACS viewer URL" value={form.pacs_viewer_url} onChange={(e) => setForm({ ...form, pacs_viewer_url: e.target.value })} />
        <input placeholder="Radiologist" value={form.radiologist_name} onChange={(e) => setForm({ ...form, radiologist_name: e.target.value })} />
        <input placeholder="Technician" value={form.technician_name} onChange={(e) => setForm({ ...form, technician_name: e.target.value })} />
      </div>
      <textarea placeholder="Findings" value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} />
      <textarea placeholder="Impression" value={form.impression} onChange={(e) => setForm({ ...form, impression: e.target.value })} />
      <input placeholder="PDF report URL" value={form.report_file} onChange={(e) => setForm({ ...form, report_file: e.target.value })} />
      <div className="rowActions">
        <button type="button" onClick={() => onSave(row.id, form)}>Save Report</button>
        <button type="button" className="ghostBtn" onClick={() => onApprove(row.id, { report_pdf_url: form.report_file })}>Approve</button>
        <button type="button" className="ghostBtn" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}

export default function Labs({ lab, setLab, addLab, labs = [], labTemplates = [], createLabTemplate, saveLabResults, approveLabReport, rad, setRad, addRadiology, rads = [], patients = [], doctors = [], updateLabStatus, uploadLabReport, updateRadiologyStatus, uploadRadiologyReport, saveRadiologyReport, approveRadiologyReport, permissions = {} }) {
  const [active, setActive] = useState("lab");
  const labStats = useMemo(() => ({ total: labs.length, samples: labs.filter(x => ["sample_collected", "received", "processing"].includes(x.test_status || "ordered")).length, approved: labs.filter(x => ["approved", "completed"].includes(x.test_status || "")).length }), [labs]);
  const radStats = useMemo(() => ({ total: rads.length, scanned: rads.filter(x => ["scanned", "reported"].includes(x.status || "ordered")).length, approved: rads.filter(x => (x.status || "") === "approved").length }), [rads]);

  const selectTemplate = (templateId) => {
    const t = labTemplates.find(x => String(x.id) === String(templateId));
    setLab({ ...lab, template_id: templateId, test_name: t?.test_name || lab.test_name, test_category: t?.test_category || lab.test_category, sample_type: t?.sample_type || lab.sample_type });
  };

  return (
    <section className="labWorkflowPage">
      <div className="pageHero">
        <div><p className="eyebrow">Advanced LIS / RIS</p><h1>Lab & Radiology Command</h1><p className="muted">Sample barcodes, test templates, result entry, approvals, DICOM IDs and PACS-ready URLs.</p></div>
        <div className="segmented">
          <button className={active === "lab" ? "active" : ""} onClick={() => setActive("lab")}>Laboratory</button>
          <button className={active === "templates" ? "active" : ""} onClick={() => setActive("templates")}>Templates</button>
          <button className={active === "radiology" ? "active" : ""} onClick={() => setActive("radiology")}>Radiology</button>
        </div>
      </div>

      {active === "templates" && <TemplateBuilder templates={labTemplates} createLabTemplate={createLabTemplate} />}

      {active === "lab" && <>
        <div className="statsGrid"><div className="statCard"><span>Total Lab Orders</span><strong>{labStats.total}</strong></div><div className="statCard"><span>Samples In Workflow</span><strong>{labStats.samples}</strong></div><div className="statCard"><span>Approved/Completed</span><strong>{labStats.approved}</strong></div></div>
        {permissions.labCreate && <form className="enterpriseForm" onSubmit={addLab}><h3>Create Lab Order</h3><div className="formGrid">
          <PersonSelect type="patient" list={patients} value={lab.patient_id} placeholder="Select patient" onChange={(v) => setLab({ ...lab, patient_id: v })} />
          <PersonSelect type="doctor" list={doctors} value={lab.doctor_id} placeholder="Select doctor" onChange={(v) => setLab({ ...lab, doctor_id: v })} />
          <select value={lab.template_id || ""} onChange={(e) => selectTemplate(e.target.value)}><option value="">Select test template</option>{labTemplates.map(t => <option key={t.id} value={t.id}>{t.test_name}</option>)}</select>
          <input placeholder="Test name" value={lab.test_name || ""} onChange={(e) => setLab({ ...lab, test_name: e.target.value })} required />
          <input placeholder="Sample type" value={lab.sample_type || ""} onChange={(e) => setLab({ ...lab, sample_type: e.target.value })} />
          <select value={lab.priority || "routine"} onChange={(e) => setLab({ ...lab, priority: e.target.value })}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
        </div><button>Create Lab Order</button></form>}
        <div className="workflowTableCard"><h3>Lab Orders</h3><table><thead><tr><th>ID</th><th>Barcode</th><th>Patient</th><th>Test</th><th>Sample</th><th>Status</th><th>Report</th><th>Actions</th></tr></thead><tbody>
          {labs.map(row => <tr key={row.id}><td>#{row.id}</td><td><strong>{row.sample_barcode || "-"}</strong><br/><small>{row.accession_number || ""}</small></td><td>{row.patient_name || row.patient_id || "-"}</td><td>{row.test_name}</td><td>{row.sample_type || "-"}</td><td><Badge value={row.test_status || "ordered"} /></td><td>{row.report_pdf_url || row.report_file ? <a href={row.report_pdf_url || row.report_file} target="_blank" rel="noreferrer">PDF</a> : <span className="muted">Pending</span>}</td><td><select value={row.test_status || "ordered"} onChange={(e) => updateLabStatus?.(row.id, e.target.value)}>{LAB_STATUS.map(v => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select><ResultEditor row={row} onSave={saveLabResults || uploadLabReport} onApprove={approveLabReport || uploadLabReport} /></td></tr>)}
          {!labs.length && <tr><td colSpan="8" className="emptyCell">No lab orders yet.</td></tr>}
        </tbody></table></div>
      </>}

      {active === "radiology" && <>
        <div className="statsGrid"><div className="statCard"><span>Total Radiology Orders</span><strong>{radStats.total}</strong></div><div className="statCard"><span>Scanned/Reported</span><strong>{radStats.scanned}</strong></div><div className="statCard"><span>Approved</span><strong>{radStats.approved}</strong></div></div>
        {permissions.radiologyCreate && <form className="enterpriseForm" onSubmit={addRadiology}><h3>Create Radiology Order</h3><div className="formGrid">
          <PersonSelect type="patient" list={patients} value={rad.patient_id} placeholder="Select patient" onChange={(v) => setRad({ ...rad, patient_id: v })} />
          <PersonSelect type="doctor" list={doctors} value={rad.doctor_id} placeholder="Select doctor" onChange={(v) => setRad({ ...rad, doctor_id: v })} />
          <input placeholder="Scan name" value={rad.scan_name || ""} onChange={(e) => setRad({ ...rad, scan_name: e.target.value })} required />
          <select value={rad.modality || "XRAY"} onChange={(e) => setRad({ ...rad, modality: e.target.value })}>{MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <input placeholder="Body part" value={rad.body_part || ""} onChange={(e) => setRad({ ...rad, body_part: e.target.value })} />
          <select value={rad.priority || "routine"} onChange={(e) => setRad({ ...rad, priority: e.target.value })}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
          <input placeholder="DICOM Study ID optional" value={rad.dicom_study_id || ""} onChange={(e) => setRad({ ...rad, dicom_study_id: e.target.value })} />
          <input placeholder="PACS viewer URL optional" value={rad.pacs_viewer_url || ""} onChange={(e) => setRad({ ...rad, pacs_viewer_url: e.target.value })} />
        </div><button>Create Radiology Order</button></form>}
        <div className="workflowTableCard"><h3>Radiology Orders</h3><table><thead><tr><th>ID</th><th>Accession</th><th>Patient</th><th>Scan</th><th>DICOM/PACS</th><th>Status</th><th>Report</th><th>Actions</th></tr></thead><tbody>
          {rads.map(row => <tr key={row.id}><td>#{row.id}</td><td>{row.accession_number || "-"}</td><td>{row.patient_name || row.patient_id || "-"}</td><td>{row.scan_name}<br/><small>{row.modality || ""} {row.body_part || ""}</small></td><td>{row.dicom_study_id || "-"}<br/>{row.pacs_viewer_url ? <a href={row.pacs_viewer_url} target="_blank" rel="noreferrer">Open PACS</a> : <small className="muted">No PACS URL</small>}</td><td><Badge value={row.status || "ordered"} /></td><td>{row.report_pdf_url || row.report_file ? <a href={row.report_pdf_url || row.report_file} target="_blank" rel="noreferrer">PDF</a> : <span className="muted">Pending</span>}</td><td><select value={row.status || "ordered"} onChange={(e) => updateRadiologyStatus?.(row.id, e.target.value)}>{RAD_STATUS.map(v => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select><RadiologyReportEditor row={row} onSave={saveRadiologyReport || uploadRadiologyReport} onApprove={approveRadiologyReport || uploadRadiologyReport} /></td></tr>)}
          {!rads.length && <tr><td colSpan="8" className="emptyCell">No radiology orders yet.</td></tr>}
        </tbody></table></div>
      </>}
    </section>
  );
}
