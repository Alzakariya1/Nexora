import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { DataTable } from "../components";
import { pharmacyApi } from "../api";

const emptyMedicine = {
  name: "",
  generic_name: "",
  category: "",
  batch_number: "",
  vendor: "",
  expiry_date: "",
  quantity: "",
  low_stock_threshold: 10,
  cost_price: "",
  selling_price: "",
  unit: "pcs",
  status: "active",
};

const emptySale = { medicine_id: "", quantity: 1, selling_price: "", patient_id: "", prescription_id: "" };
const emptyStock = { medicine_id: "", mode: "add", quantity: 1, note: "" };

function currency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}


export default function Pharmacy({ med, setMed, addMedicine, meds = [], permissions = {}, onChanged }) {
  const [medicineForm, setMedicineForm] = useState({ ...emptyMedicine, ...med });
  const [editingId, setEditingId] = useState(null);
  const [stockForm, setStockForm] = useState(emptyStock);
  const [saleForm, setSaleForm] = useState(emptySale);
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  async function refreshPharmacy() {
    try {
      const [summaryRes, salesRes] = await Promise.all([pharmacyApi.summary(), pharmacyApi.sales({ limit: 20 })]);
      setSummary(summaryRes.data);
      setSales(salesRes.data || []);
    } catch (_) {
      // Keep the main pharmacy list usable even if summary endpoints are not deployed yet.
    }
  }

  useEffect(() => {
    refreshPharmacy();
  }, []);

  const filteredMeds = useMemo(() => {
    const term = search.trim().toLowerCase();
    return meds.filter((m) => {
      const matchesSearch = !term || [m.name, m.generic_name, m.batch_number, m.vendor, m.category].some((v) => String(v || "").toLowerCase().includes(term));
      const matchesStock = stockFilter === "all" || (stockFilter === "low" && m.stock_status === "low_stock") || (stockFilter === "out" && m.stock_status === "out_of_stock") || (stockFilter === "in" && m.stock_status === "in_stock");
      return matchesSearch && matchesStock;
    });
  }, [meds, search, stockFilter]);

  const selectedSaleMedicine = meds.find((m) => String(m.id) === String(saleForm.medicine_id));

  async function saveMedicine(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await pharmacyApi.update(editingId, medicineForm);
        toast.success("Medicine updated");
      } else if (addMedicine) {
        setMed?.(medicineForm);
        await pharmacyApi.create(medicineForm);
        toast.success("Medicine added");
      }
      setMedicineForm(emptyMedicine);
      setMed?.(emptyMedicine);
      setEditingId(null);
      await onChanged?.();
      await refreshPharmacy();
    } catch (err) {
      toast.error(err.response?.data?.message || "Medicine save failed");
    }
  }

  function editMedicine(row) {
    setEditingId(row.id);
    setMedicineForm({ ...emptyMedicine, ...row, quantity: row.quantity ?? row.stock ?? "", selling_price: row.selling_price ?? row.price ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function adjustStock(e) {
    e.preventDefault();
    try {
      if (!stockForm.medicine_id) return toast.error("Select medicine first");
      await pharmacyApi.adjustStock(stockForm.medicine_id, stockForm);
      toast.success("Stock updated");
      setStockForm(emptyStock);
      await onChanged?.();
      await refreshPharmacy();
    } catch (err) {
      toast.error(err.response?.data?.message || "Stock update failed");
    }
  }

  async function createSale(e) {
    e.preventDefault();
    try {
      if (!saleForm.medicine_id) return toast.error("Select medicine first");
      await pharmacyApi.createSale({ ...saleForm, selling_price: saleForm.selling_price || selectedSaleMedicine?.selling_price || selectedSaleMedicine?.price || 0 });
      toast.success("Sale completed and stock reduced");
      setSaleForm(emptySale);
      await onChanged?.();
      await refreshPharmacy();
    } catch (err) {
      toast.error(err.response?.data?.message || "Sale failed");
    }
  }

  const tableRows = filteredMeds.map((m) => ({
    ...m,
    stock: `${m.quantity ?? m.stock ?? 0} ${m.unit || ""}`,
    selling_price: currency(m.selling_price ?? m.price),
    stock_status: (m.stock_status || "in_stock").replaceAll("_", " "),
  }));

  return (
    <section className="pharmacyPage">
      <div className="appointmentHero pharmacyHero">
        <div>
          <span className="eyebrow">Inventory Control</span>
          <h2>Pharmacy & Stock Management</h2>
          <p className="muted">Manage medicine stock, batches, expiry, vendors, low-stock alerts, and sales from one place.</p>
        </div>
      </div>

      <div className="appointmentStatsGrid pharmacyStatsGrid">
        <div className="appointmentStat"><span>Total Medicines</span><strong>{summary?.stock?.medicines ?? meds.length}</strong></div>
        <div className="appointmentStat"><span>Total Units</span><strong>{summary?.stock?.units ?? meds.reduce((s, m) => s + Number(m.quantity ?? m.stock ?? 0), 0)}</strong></div>
        <div className="appointmentStat"><span>Low Stock</span><strong>{summary?.stock?.lowStock ?? meds.filter((m) => m.stock_status === "low_stock").length}</strong></div>
        <div className="appointmentStat"><span>Sales Revenue</span><strong>{currency(summary?.sales?.revenue)}</strong></div>
      </div>

      {permissions.pharmacyCreate && (
        <form className="card pharmacyForm" onSubmit={saveMedicine}>
          <div className="formTitleRow">
            <div><h3>{editingId ? "Edit Medicine" : "Add Medicine"}</h3><p className="muted">Batch, expiry and low-stock data help avoid dispensing errors.</p></div>
            {editingId && <button type="button" className="secondaryBtn" onClick={() => { setEditingId(null); setMedicineForm(emptyMedicine); }}>Cancel Edit</button>}
          </div>
          <div className="appointmentFormGrid pharmacyFormGrid">
            <label><span>Medicine Name</span><input required value={medicineForm.name} onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })} /></label>
            <label><span>Generic Name</span><input value={medicineForm.generic_name} onChange={(e) => setMedicineForm({ ...medicineForm, generic_name: e.target.value })} /></label>
            <label><span>Category</span><input placeholder="Tablet / Injection / Syrup" value={medicineForm.category} onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })} /></label>
            <label><span>Batch No.</span><input value={medicineForm.batch_number} onChange={(e) => setMedicineForm({ ...medicineForm, batch_number: e.target.value })} /></label>
            <label><span>Vendor</span><input value={medicineForm.vendor} onChange={(e) => setMedicineForm({ ...medicineForm, vendor: e.target.value })} /></label>
            <label><span>Expiry Date</span><input type="date" value={medicineForm.expiry_date || ""} onChange={(e) => setMedicineForm({ ...medicineForm, expiry_date: e.target.value })} /></label>
            <label><span>Quantity</span><input required type="number" min="0" value={medicineForm.quantity} onChange={(e) => setMedicineForm({ ...medicineForm, quantity: e.target.value })} /></label>
            <label><span>Low Stock Alert</span><input type="number" min="0" value={medicineForm.low_stock_threshold} onChange={(e) => setMedicineForm({ ...medicineForm, low_stock_threshold: e.target.value })} /></label>
            <label><span>Cost Price</span><input type="number" min="0" value={medicineForm.cost_price} onChange={(e) => setMedicineForm({ ...medicineForm, cost_price: e.target.value })} /></label>
            <label><span>Selling Price</span><input type="number" min="0" value={medicineForm.selling_price} onChange={(e) => setMedicineForm({ ...medicineForm, selling_price: e.target.value })} /></label>
            <label><span>Unit</span><input value={medicineForm.unit} onChange={(e) => setMedicineForm({ ...medicineForm, unit: e.target.value })} /></label>
            <label><span>Status</span><select value={medicineForm.status} onChange={(e) => setMedicineForm({ ...medicineForm, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          <div className="appointmentFormActions"><button type="submit">{editingId ? "Update Medicine" : "Add Medicine"}</button></div>
        </form>
      )}

      <div className="pharmacyActionGrid">
        {permissions.pharmacyStockManage && (
          <form className="card" onSubmit={adjustStock}>
            <h3>Stock Adjustment</h3>
            <p className="muted">Add purchase stock or remove damaged/expired stock.</p>
            <div className="compactFormGrid">
              <select value={stockForm.medicine_id} onChange={(e) => setStockForm({ ...stockForm, medicine_id: e.target.value })}><option value="">Select medicine</option>{meds.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.quantity ?? m.stock ?? 0})</option>)}</select>
              <select value={stockForm.mode} onChange={(e) => setStockForm({ ...stockForm, mode: e.target.value })}><option value="add">Add Stock</option><option value="remove">Remove Stock</option></select>
              <input type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
              <input placeholder="Reason / note" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} />
            </div>
            <button type="submit">Update Stock</button>
          </form>
        )}

        {permissions.pharmacyStockManage && (
          <form className="card" onSubmit={createSale}>
            <h3>Direct Sale</h3>
            <p className="muted">Issue medicine and reduce inventory instantly.</p>
            <div className="compactFormGrid">
              <select value={saleForm.medicine_id} onChange={(e) => setSaleForm({ ...saleForm, medicine_id: e.target.value, selling_price: meds.find((m) => String(m.id) === e.target.value)?.selling_price || "" })}><option value="">Select medicine</option>{meds.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.quantity ?? m.stock ?? 0})</option>)}</select>
              <input type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })} />
              <input placeholder="Selling price" type="number" min="0" value={saleForm.selling_price} onChange={(e) => setSaleForm({ ...saleForm, selling_price: e.target.value })} />
              <input placeholder="Patient ID / UHID optional" value={saleForm.patient_id} onChange={(e) => setSaleForm({ ...saleForm, patient_id: e.target.value })} />
            </div>
            <button type="submit">Complete Sale</button>
          </form>
        )}
      </div>

      <div className="card pharmacyInventoryCard">
        <div className="formTitleRow">
          <div><h3>Medicine Inventory</h3><p className="muted">Search stock by medicine, batch, category or vendor.</p></div>
          <div className="pharmacyFilters"><input placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}><option value="all">All Stock</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select></div>
        </div>
        <DataTable rows={tableRows} onEdit={permissions.pharmacyStockManage ? editMedicine : null} />
      </div>

      <div className="card pharmacySalesCard">
        <h3>Recent Pharmacy Sales</h3>
        <DataTable rows={sales.map((s) => ({ ...s, total_amount: currency(s.total_amount), sold_at: s.sold_at ? new Date(s.sold_at).toLocaleString() : "—" }))} />
      </div>
    </section>
  );
}
