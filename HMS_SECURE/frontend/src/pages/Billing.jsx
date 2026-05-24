import React, { useMemo } from "react";
import { DataTable } from "../components";

const BILL_STATUSES = ["pending", "partial", "paid", "cancelled", "refunded"];
const PAYMENT_MODES = ["cash", "card", "upi", "bank", "insurance"];
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default function Billing({ bill, setBill, addBill, bills = [], permissions = {}, patients = [] }) {
  const patientOptions = patients || [];
  const total = Number(bill.total_amount || bill.amount || 0);
  const paid = Number(bill.paid_amount || 0);
  const due = Math.max(0, total - paid);
  const summary = useMemo(() => {
    const totalAmount = bills.reduce((s, b) => s + Number(b.total_amount || b.amount || 0), 0);
    const paidAmount = bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
    const pending = bills.filter((b) => ["pending", "partial", "unpaid"].includes(String(b.payment_status || b.status || "").toLowerCase())).length;
    return { totalAmount, paidAmount, due: Math.max(0, totalAmount - paidAmount), pending };
  }, [bills]);

  return (
    <section className="modulePage billingPage improvedBillingPage">
      <div className="billingSummaryGrid">
        <div className="card billingMetric"><span>Total Invoices</span><strong>{bills.length}</strong></div>
        <div className="card billingMetric"><span>Total Billed</span><strong>{money(summary.totalAmount)}</strong></div>
        <div className="card billingMetric"><span>Total Paid</span><strong>{money(summary.paidAmount)}</strong></div>
        <div className="card billingMetric"><span>Pending / Partial</span><strong>{summary.pending}</strong></div>
      </div>

      {permissions.billingCreate && (
        <form className="card form polishedForm invoiceForm" onSubmit={addBill}>
          <div className="sectionTitleRow">
            <div>
              <h2>Add Bill / Invoice</h2>
              <p className="muted">Use patient dropdown when records exist. Manual patient ID still works for old data, so existing functionality is not broken.</p>
            </div>
            <div className="invoiceDueBox"><span>Due Amount</span><strong>{money(due)}</strong></div>
          </div>
          <div className="formGrid labeledGrid invoiceGrid">
            <label><span>Invoice Number</span><input placeholder="Auto generated if blank" value={bill.invoice_number || ""} onChange={(e) => setBill({ ...bill, invoice_number: e.target.value })} /></label>
            <label><span>Patient *</span>{patientOptions.length ? <select required value={bill.patient_id || ""} onChange={(e) => setBill({ ...bill, patient_id: e.target.value })}><option value="">Select patient</option>{patientOptions.map((p) => <option key={p.id || p.patient_id} value={p.patient_id || p.id}>{p.full_name} · {p.patient_id || p.id}</option>)}</select> : <input required placeholder="patient id" value={bill.patient_id || ""} onChange={(e) => setBill({ ...bill, patient_id: e.target.value })} />}</label>
            <label><span>Consultation Charges</span><input type="number" min="0" placeholder="0" value={bill.consultation_charges || ""} onChange={(e) => setBill({ ...bill, consultation_charges: e.target.value })} /></label>
            <label><span>Lab Charges</span><input type="number" min="0" placeholder="0" value={bill.lab_charges || ""} onChange={(e) => setBill({ ...bill, lab_charges: e.target.value })} /></label>
            <label><span>Medicine Charges</span><input type="number" min="0" placeholder="0" value={bill.medicine_charges || ""} onChange={(e) => setBill({ ...bill, medicine_charges: e.target.value })} /></label>
            <label><span>Other / Total Amount *</span><input required type="number" min="0" placeholder="total amount" value={bill.amount || bill.total_amount || ""} onChange={(e) => setBill({ ...bill, amount: e.target.value, total_amount: e.target.value })} /></label>
            <label><span>Discount</span><input type="number" min="0" placeholder="0" value={bill.discount || ""} onChange={(e) => setBill({ ...bill, discount: e.target.value })} /></label>
            <label><span>Paid Amount</span><input type="number" min="0" placeholder="0" value={bill.paid_amount || ""} onChange={(e) => setBill({ ...bill, paid_amount: e.target.value })} /></label>
            <label><span>Status</span><select value={bill.status || bill.payment_status || "pending"} onChange={(e) => setBill({ ...bill, status: e.target.value, payment_status: e.target.value })}>{BILL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label><span>Payment Mode</span><select value={bill.payment_mode || "cash"} onChange={(e) => setBill({ ...bill, payment_mode: e.target.value })}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
            <label><span>Transaction ID</span><input placeholder="optional" value={bill.transaction_id || ""} onChange={(e) => setBill({ ...bill, transaction_id: e.target.value })} /></label>
            <label><span>Notes</span><input placeholder="optional notes" value={bill.notes || ""} onChange={(e) => setBill({ ...bill, notes: e.target.value })} /></label>
          </div>
          <button>Save Invoice</button>
        </form>
      )}
      <div className="card">
        <div className="sectionTitleRow"><h2>Billing Register</h2><span className="muted">{bills.length} invoices</span></div>
        <DataTable rows={bills} cols={["invoice_number", "patient_name", "patient_id", "total_amount", "paid_amount", "due_amount", "payment_status", "payment_mode"]} />
      </div>
    </section>
  );
}
