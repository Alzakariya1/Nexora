import React, { useMemo } from "react";
import { DataTable } from "../components";
import { billingApi } from "../api";

const BILL_STATUSES = ["pending", "partial", "paid", "cancelled", "refunded"];
const PAYMENT_MODES = ["cash", "card", "upi", "bank", "insurance", "corporate_credit", "other"];
const SERVICE_TYPES = ["opd", "ipd", "lab", "radiology", "pharmacy", "procedure", "package", "other"];
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default function Billing({
  bill,
  setBill,
  addBill,
  bills = [],
  permissions = {},
  patients = [],
  editBill,
  updateBillPayment,
  cancelBill,
  archiveBill,
}) {
  const patientOptions = patients || [];
  const editableId = bill.id || bill.billingId;
  const total = Number(bill.total_amount || bill.amount || 0);
  const paid = Number(bill.paid_amount || 0);
  const due = Math.max(0, total - paid);
  const canEdit = Boolean(permissions.billingEdit);

  const summary = useMemo(() => {
    const activeBills = bills.filter((b) => !["cancelled", "refunded"].includes(String(b.payment_status || b.status || "").toLowerCase()));
    const totalAmount = activeBills.reduce((s, b) => s + Number(b.total_amount || b.amount || 0), 0);
    const paidAmount = activeBills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
    const pending = activeBills.filter((b) => ["pending", "partial", "unpaid"].includes(String(b.payment_status || b.status || "").toLowerCase())).length;
    return { totalAmount, paidAmount, due: Math.max(0, totalAmount - paidAmount), pending };
  }, [bills]);


  const extraActions = [
    {
      label: "Open PDF",
      icon: "bi bi-file-earmark-pdf",
      onClick: (row) => window.open(billingApi.pdfUrl(row.id), "_blank", "noopener,noreferrer"),
    },
  ];
  if (canEdit) {
    extraActions.push(
      {
        label: "Record Payment",
        icon: "bi bi-cash-coin",
        onClick: (row) => updateBillPayment?.(row),
      },
      {
        label: "Cancel Invoice",
        icon: "bi bi-x-circle",
        onClick: (row) => cancelBill?.(row),
      },
    );
  }

  return (
    <section className="modulePage billingPage improvedBillingPage">
      <div className="billingSummaryGrid">
        <div className="card billingMetric"><span>Total Invoices</span><strong>{bills.length}</strong></div>
        <div className="card billingMetric"><span>Total Billed</span><strong>{money(summary.totalAmount)}</strong></div>
        <div className="card billingMetric"><span>Total Paid</span><strong>{money(summary.paidAmount)}</strong></div>
        <div className="card billingMetric"><span>Pending / Partial</span><strong>{summary.pending}</strong></div>
      </div>

      {(permissions.billingCreate || canEdit) && (
        <form className="card form polishedForm invoiceForm" onSubmit={addBill}>
          <div className="sectionTitleRow">
            <div>
              <h2>{editableId ? "Edit Bill / Invoice" : "Add Bill / Invoice"}</h2>
              <p className="muted">Patient-linked invoice with payment status, discount reason, service type and audit-safe updates.</p>
            </div>
            <div className="invoiceDueBox"><span>Due Amount</span><strong>{money(due)}</strong></div>
          </div>
          <div className="formGrid labeledGrid invoiceGrid">
            <label><span>Invoice Number</span><input placeholder="Auto generated if blank" value={bill.invoice_number || ""} onChange={(e) => setBill({ ...bill, invoice_number: e.target.value })} /></label>
            <label><span>Patient *</span>{patientOptions.length ? <select required value={bill.patient_id || ""} onChange={(e) => setBill({ ...bill, patient_id: e.target.value })}><option value="">Select patient</option>{patientOptions.map((p) => <option key={p.id || p.patient_id || p.patient_uid} value={p.patient_id || p.patient_uid || p.id}>{p.full_name} · {p.patient_id || p.patient_uid || p.id}</option>)}</select> : <input required placeholder="patient id" value={bill.patient_id || ""} onChange={(e) => setBill({ ...bill, patient_id: e.target.value })} />}</label>
            <label><span>Service Type</span><select value={bill.service_type || "opd"} onChange={(e) => setBill({ ...bill, service_type: e.target.value })}>{SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label><span>Consultation Charges</span><input type="number" min="0" placeholder="0" value={bill.consultation_charges || bill.consultation_fee || ""} onChange={(e) => setBill({ ...bill, consultation_charges: e.target.value, consultation_fee: e.target.value })} /></label>
            <label><span>Lab Charges</span><input type="number" min="0" placeholder="0" value={bill.lab_charges || ""} onChange={(e) => setBill({ ...bill, lab_charges: e.target.value })} /></label>
            <label><span>Medicine Charges</span><input type="number" min="0" placeholder="0" value={bill.medicine_charges || ""} onChange={(e) => setBill({ ...bill, medicine_charges: e.target.value })} /></label>
            <label><span>Other / Total Amount *</span><input required type="number" min="0" placeholder="total amount" value={bill.amount || bill.total_amount || ""} onChange={(e) => setBill({ ...bill, amount: e.target.value, total_amount: e.target.value })} /></label>
            <label><span>GST / Tax</span><input type="number" min="0" placeholder="0" value={bill.gst_amount || ""} onChange={(e) => setBill({ ...bill, gst_amount: e.target.value })} /></label>
            <label><span>Discount</span><input type="number" min="0" placeholder="0" value={bill.discount || ""} onChange={(e) => setBill({ ...bill, discount: e.target.value })} /></label>
            <label><span>Discount Reason</span><input placeholder="required if discount" value={bill.discount_reason || ""} onChange={(e) => setBill({ ...bill, discount_reason: e.target.value })} /></label>
            <label><span>Paid Amount</span><input type="number" min="0" placeholder="0" value={bill.paid_amount || ""} onChange={(e) => setBill({ ...bill, paid_amount: e.target.value })} /></label>
            <label><span>Status</span><select value={bill.status || bill.payment_status || "pending"} onChange={(e) => setBill({ ...bill, status: e.target.value, payment_status: e.target.value })}>{BILL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label><span>Payment Mode</span><select value={bill.payment_mode || "cash"} onChange={(e) => setBill({ ...bill, payment_mode: e.target.value })}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
            <label><span>Transaction ID</span><input placeholder="optional" value={bill.transaction_id || ""} onChange={(e) => setBill({ ...bill, transaction_id: e.target.value })} /></label>
            <label><span>Notes</span><input placeholder="optional notes" value={bill.notes || ""} onChange={(e) => setBill({ ...bill, notes: e.target.value })} /></label>
          </div>
          <div className="formActionsRow">
            <button>{editableId ? "Update Invoice" : "Save Invoice"}</button>
            {editableId && <button type="button" className="secondaryBtn" onClick={() => setBill({ patient_id: "", amount: "", total_amount: "", paid_amount: "", payment_mode: "cash", status: "pending", payment_status: "pending", service_type: "opd" })}>New Invoice</button>}
          </div>
        </form>
      )}
      <div className="card">
        <div className="sectionTitleRow"><h2>Billing Register</h2><span className="muted">{bills.length} invoices</span></div>
        <DataTable
          rows={bills}
          cols={["invoice_number", "patient_name", "patient_id", "service_type", "total_amount", "paid_amount", "due_amount", "payment_status", "payment_mode"]}
          onEdit={canEdit ? editBill : undefined}
          onDelete={canEdit ? archiveBill : undefined}
          extraActions={extraActions}
        />
      </div>
    </section>
  );
}
