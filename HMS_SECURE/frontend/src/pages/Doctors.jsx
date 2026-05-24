import React, { useState } from "react";
import { DataTable, Form } from "../components";

export default function Doctors({
  doctor,
  setDoctor,
  addDoctor,
  doctorSearch,
  setDoctorSearch,
  paginatedDoctors,
  editDoctor,
  deleteDoctor,
  doctorPage,
  setDoctorPage,
  doctorTotalPages,
  permissions = {},
  activeView = "doctors",
  selectedDoctor,
  editingDoctorId,
  cancelDoctorEdit,
  setTab,
  openDoctorProfile,
  uploadDoctorProfileImage,
  uploadDoctorDocument,
  deleteDoctorDocument,
  appointments = [],
  dynamicFields = [],
}) {
  const [doctorDocForm, setDoctorDocForm] = useState({
    title: "",
    document_type: "Registration Certificate",
    category: "credential",
    notes: "",
    file: null,
  });
  const [uploadingDoctorImage, setUploadingDoctorImage] = useState(false);
  const [uploadingDoctorDocument, setUploadingDoctorDocument] = useState(false);
  const [deletingDoctorDocumentIndex, setDeletingDoctorDocumentIndex] = useState(null);
  const [showDoctorDocForm, setShowDoctorDocForm] = useState(false);

  function resetDoctorDocForm() {
    setDoctorDocForm({
      title: "",
      document_type: "Registration Certificate",
      category: "credential",
      notes: "",
      file: null,
    });
  }

  function formatFileSize(size) {
    const bytes = Number(size || 0);
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (activeView === "doctorProfile" && selectedDoctor) {
    const relatedAppointments = selectedDoctor.appointments?.length
      ? selectedDoctor.appointments
      : appointments.filter((a) =>
          String(a.doctor_id) === String(selectedDoctor.doctor_id) ||
          String(a.doctor_id) === String(selectedDoctor.id),
        );

    const documents = selectedDoctor.certificates || selectedDoctor.documents || [];

    return (
      <section className="keka-profile-page doctor-keka-profile">
        <button className="profileBackBtn"
          type="button"
          onClick={() => {
            cancelDoctorEdit?.();
            resetDoctorDocForm();
            setShowDoctorDocForm(false);
            setTab("doctors");
          }}
        >
          ← Back to Doctors
        </button>

        <div className="card doctor-profile-card keka-entity-profile-card" style={{ marginTop: 16 }}>
          <div className="keka-cover-card compact-cover">
            <div className="keka-cover-art"></div>
            <div className="keka-cover-content entity-cover-content">
              <div className="keka-cover-title-block">
                <span className="doctor-kicker">Doctor Overview</span>
                <h1>{selectedDoctor.full_name || "Unnamed Doctor"}</h1>
                <p>Doctor ID: {selectedDoctor.doctor_id || "--"} {selectedDoctor.specialization ? `• ${selectedDoctor.specialization}` : ""}</p>
              </div>
              <div className="keka-profile-score"><div className="score-ring">{documents.length}</div><div><b>Documents</b><span>Credentials uploaded</span></div></div>
            </div>
          </div>
          <div className="doctor-profile-hero keka-entity-overview">

          <div className="patient-profile-top doctor-profile-top">
            <div className="patient-avatar doctor-avatar-upload">
              {selectedDoctor.profile_image_url ? (
                <img src={selectedDoctor.profile_image_url} alt={selectedDoctor.full_name} />
              ) : (
                <i className="bi bi-person-circle"></i>
              )}

              {permissions.doctorEdit && uploadDoctorProfileImage && (
                <label className="profile-image-overlay-btn" title="Upload doctor image">
                  <i className={uploadingDoctorImage ? "bi bi-arrow-repeat" : "bi bi-camera"}></i>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadingDoctorImage(true);
                        Promise.resolve(uploadDoctorProfileImage(selectedDoctor.id, file))
                          .finally(() => setUploadingDoctorImage(false));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <div className="patient-profile-main">
              <div className="patient-profile-header doctor-profile-header entity-clean-header">
                <div>
                  <span className="doctor-kicker">Professional Details</span>
                  <h2>Profile Information</h2>
                  <p>Credentials, contact details and current profile status.</p>
                </div>
                <div className="doctor-profile-actions">
                  <div className="patient-status">{selectedDoctor.status || "Active Doctor"}</div>
                  {permissions.doctorEdit && (
                    <button
                      type="button"
                      onClick={() => editDoctor(selectedDoctor, { stayOnProfile: true })}
                    >
                      <i className="bi bi-pencil-square"></i> Edit Profile
                    </button>
                  )}
                </div>
              </div>

              <div className="patient-info-grid">
                <div className="info-card"><span>Specialization</span><h3>{selectedDoctor.specialization || "--"}</h3></div>
                <div className="info-card"><span>Qualification</span><h3>{selectedDoctor.qualification || "--"}</h3></div>
                <div className="info-card"><span>Department</span><h3>{selectedDoctor.department_name || "--"}</h3></div>
                <div className="info-card"><span>Phone</span><h3>{selectedDoctor.phone || "--"}</h3></div>
                <div className="info-card"><span>Email</span><h3>{selectedDoctor.email || "--"}</h3></div>
                <div className="info-card"><span>Consultation Fee</span><h3>{selectedDoctor.consultation_fee ? `₹${selectedDoctor.consultation_fee}` : "--"}</h3></div>
              </div>

              <div className="patient-extra-grid">
                <div className="extra-info-card">
                  <h3>Registration Details</h3>
                  <div className="extra-info-row"><span>License Number</span><b>{selectedDoctor.license_number || "--"}</b></div>
                  <div className="extra-info-row"><span>Registration Number</span><b>{selectedDoctor.registration_number || "--"}</b></div>
                </div>

                <div className="extra-info-card">
                  <h3>Profile Status</h3>
                  <div className="extra-info-row"><span>Status</span><b>{selectedDoctor.status || "active"}</b></div>
                  <div className="extra-info-row"><span>Internal Record ID</span><b>{selectedDoctor.id || "--"}</b></div>
                  <div className="extra-info-row"><span>Profile Image</span><b>{selectedDoctor.profile_image_url ? "Uploaded" : "Not uploaded"}</b></div>
                </div>
                {selectedDoctor.custom_fields && Object.keys(selectedDoctor.custom_fields).length > 0 && (
                  <div className="extra-info-card">
                    <h3>Doctor Custom Details</h3>
                    {dynamicFields.map((field) => (
                      <div className="extra-info-row" key={field.field_key}><span>{field.label}</span><b>{String(selectedDoctor.custom_fields?.[field.field_key] ?? "--")}</b></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          {permissions.doctorEdit && String(editingDoctorId || "") === String(selectedDoctor.id || "") && (
            <div style={{ marginTop: 16 }}>
              <Form
                title="Edit Doctor Profile"
                data={doctor}
                setData={setDoctor}
                submit={addDoctor}
                customFields={dynamicFields}
              />
              <button
                type="button"
                className="secondaryBtn"
                style={{ marginTop: 10 }}
                onClick={cancelDoctorEdit}
              >
                Cancel Edit
              </button>
            </div>
          )}

          <div className="patient-summary-grid">
            <div className="summary-card"><i className="bi bi-calendar-check"></i><div><span>Appointments</span><h3>{relatedAppointments.length}</h3></div></div>
            <div className="summary-card"><i className="bi bi-file-earmark-medical"></i><div><span>Documents</span><h3>{documents.length}</h3></div></div>
            <div className="summary-card"><i className="bi bi-clock-history"></i><div><span>Recent Records</span><h3>{Math.min(relatedAppointments.length, 20)}</h3></div></div>
            <div className="summary-card"><i className="bi bi-cash-stack"></i><div><span>Fee</span><h3>{selectedDoctor.consultation_fee ? `₹${selectedDoctor.consultation_fee}` : "--"}</h3></div></div>
          </div>

          <div className="patient-related-grid">
            <div className="patient-related-card">
              <h3>Recent Appointments</h3>
              {!relatedAppointments.length ? (
                <p className="muted">No appointments found for this doctor.</p>
              ) : (
                relatedAppointments.map((a) => (
                  <div className="mini-record" key={a.id || a._id}>
                    <div>
                      <b>{a.patient_name || a.patient_id || "Patient not assigned"}</b>
                      <p>{a.appointment_date || "No date"} • {a.appointment_time || "No time"}</p>
                    </div>
                    <span className="record-status">{a.status || "scheduled"}</span>
                  </div>
                ))
              )}
            </div>

            <div className="patient-related-card">
              <div className="patient-document-header">
                <div>
                  <h3>Doctor Documents</h3>
                  <p className="muted">Registration, license, certificates, and other credentials.</p>
                </div>
                {permissions.doctorDocumentManage && uploadDoctorDocument && (
                  <button type="button" onClick={() => setShowDoctorDocForm((v) => !v)}>
                    <i className={showDoctorDocForm ? "bi bi-x-lg" : "bi bi-plus-lg"}></i> {showDoctorDocForm ? "Close" : "Add Document"}
                  </button>
                )}
              </div>

              {permissions.doctorDocumentManage && uploadDoctorDocument && showDoctorDocForm && (
                <div className="patient-document-card profile-documents doctor-document-form" style={{ marginBottom: 14 }}>
                  <div className="patient-document-grid">
                    <input
                      placeholder="Document title"
                      value={doctorDocForm.title}
                      onChange={(e) => setDoctorDocForm({ ...doctorDocForm, title: e.target.value })}
                    />
                    <select
                      value={doctorDocForm.document_type}
                      onChange={(e) => setDoctorDocForm({ ...doctorDocForm, document_type: e.target.value })}
                    >
                      <option>Registration Certificate</option>
                      <option>Medical License</option>
                      <option>Degree Certificate</option>
                      <option>Specialization Certificate</option>
                      <option>Experience Letter</option>
                      <option>Government ID</option>
                      <option>Other</option>
                    </select>
                    <select
                      value={doctorDocForm.category}
                      onChange={(e) => setDoctorDocForm({ ...doctorDocForm, category: e.target.value })}
                    >
                      <option value="credential">Credential</option>
                      <option value="license">License</option>
                      <option value="certificate">Certificate</option>
                      <option value="identity">Identity</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setDoctorDocForm({ ...doctorDocForm, file: e.target.files?.[0] || null })}
                    />
                  </div>
                  <textarea
                    placeholder="Notes (optional)"
                    value={doctorDocForm.notes}
                    onChange={(e) => setDoctorDocForm({ ...doctorDocForm, notes: e.target.value })}
                    rows={2}
                    style={{ marginTop: 10 }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={uploadingDoctorDocument}
                      onClick={async () => {
                        if (!doctorDocForm.file) return alert("Please choose a document file");
                        try {
                          setUploadingDoctorDocument(true);
                          await uploadDoctorDocument(selectedDoctor.id, doctorDocForm);
                          resetDoctorDocForm();
                          setShowDoctorDocForm(false);
                        } finally {
                          setUploadingDoctorDocument(false);
                        }
                      }}
                    >
                      <i className={uploadingDoctorDocument ? "bi bi-arrow-repeat" : "bi bi-upload"}></i> {uploadingDoctorDocument ? "Uploading..." : "Upload Document"}
                    </button>
                    {doctorDocForm.file && <small className="muted">Selected: {doctorDocForm.file.name}</small>}
                  </div>
                </div>
              )}

              {!documents.length ? (
                <div className="empty-doc-state">
                  <i className="bi bi-folder2-open"></i>
                  <h4>No documents uploaded yet</h4>
                  <p>Upload registration certificate, medical license, degree certificate, or other credentials.</p>
                  {permissions.doctorDocumentManage && uploadDoctorDocument && !showDoctorDocForm && (
                    <button type="button" onClick={() => setShowDoctorDocForm(true)}>Add First Document</button>
                  )}
                </div>
              ) : (
                <div className="patient-document-list">
                  {documents.map((doc, index) => (
                    <div className="patient-document-item" key={doc._id || doc.file_url || `${doc.title}-${index}`}>
                      <div className="patient-document-info">
                        <div className="document-icon">
                          <i className="bi bi-file-earmark-medical"></i>
                        </div>
                        <div>
                          <h4>{doc.title || doc.file_name || "Document"}</h4>
                          <p>{doc.document_type || "Certificate"} • {doc.category || "credential"}</p>
                          <small>
                            {doc.uploaded_at ? `Uploaded: ${new Date(doc.uploaded_at).toLocaleString()}` : "Uploaded document"}
                            {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ""}
                          </small>
                        </div>
                      </div>

                      <div className="patient-document-actions">
                        {doc.file_url && (
                          <button className="icon-btn profile-btn" title="View Document" onClick={() => window.open(doc.file_url, "_blank")}>
                            <i className="bi bi-eye"></i>
                          </button>
                        )}
                        {doc.file_url && (
                          <a href={doc.file_url} download={doc.file_name} className="icon-btn edit-btn" title="Download Document">
                            <i className="bi bi-download"></i>
                          </a>
                        )}
                        {permissions.doctorDocumentManage && deleteDoctorDocument && (
                          <button
                            className="icon-btn delete-btn"
                            title="Delete Document"
                            disabled={deletingDoctorDocumentIndex === index}
                            onClick={async () => {
                              try {
                                setDeletingDoctorDocumentIndex(index);
                                await deleteDoctorDocument(selectedDoctor.id, index);
                              } finally {
                                setDeletingDoctorDocumentIndex(null);
                              }
                            }}
                          >
                            <i className={deletingDoctorDocumentIndex === index ? "bi bi-arrow-repeat" : "bi bi-trash"}></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      {permissions.doctorCreate && (
        <Form
          title="Add Doctor"
          data={doctor}
          setData={setDoctor}
          submit={addDoctor}
          customFields={dynamicFields}
        />
      )}
      <div className="card">
        <input
          placeholder="Search doctor by ID, name, phone, email or specialization..."
          value={doctorSearch}
          onChange={(e) => setDoctorSearch(e.target.value)}
          style={{
            maxWidth: 460,
            marginBottom: 16,
          }}
        />

        <DataTable
          rows={paginatedDoctors}
          showProfile
          onProfile={openDoctorProfile}
          onEdit={permissions.doctorEdit ? editDoctor : null}
          onDelete={permissions.doctorDelete ? deleteDoctor : null}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            disabled={doctorPage === 1}
            onClick={() => setDoctorPage(doctorPage - 1)}
          >
            Previous
          </button>

          <span>Page {doctorPage} of {doctorTotalPages || 1}</span>

          <button
            disabled={doctorPage >= doctorTotalPages}
            onClick={() => setDoctorPage(doctorPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
