import React from "react";
import { Bed, Calendar, Stethoscope, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, StatCard } from "../components";

export default function Dashboard({ stats = {}, patients = [], doctors = [], appointments = [], beds = [], bills = [] }) {
  const chartPalette = ["var(--purple)", "var(--chart-blue)", "var(--chart-green)", "var(--chart-amber)"];
  const billingPalette = ["var(--chart-green)", "var(--chart-amber)", "var(--chart-rose)"];
  const appointmentChartData = [
    { name: "Patients", value: patients.length },
    { name: "Doctors", value: doctors.length },
    { name: "Appointments", value: appointments.length },
    { name: "Beds", value: beds.length },
  ];

  const billingChartData = [
    {
      name: "Paid",
      value: bills.filter((b) => b.status === "paid").length || 1,
    },
    {
      name: "Pending",
      value: bills.filter((b) => b.status === "pending").length || 1,
    },
    {
      name: "Unpaid",
      value: bills.filter((b) => b.status === "unpaid").length || 1,
    },
  ];

  return (
    <section>
      <div className="quickPanel">
        <h2>Welcome to your hospital command center</h2>
        <p>Quickly monitor appointments, beds, billing, pharmacy stock and recent operational activity.</p>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <StatCard icon={Users} title="Total Patients" value={stats.totalPatients} />
        <StatCard icon={Stethoscope} title="Total Doctors" value={stats.totalDoctors} />
        <StatCard icon={Calendar} title="Appointments Today" value={stats.appointmentsToday} />
        <StatCard icon={Bed} title="Available Beds" value={stats.availableBeds} />
      </div>

      <div className="dashboardTwoCol">
        <div className="card" style={{ padding: 22 }}>
          <div className="kekaPanelTitle">
            <h2>Hospital Overview</h2>
            <small className="muted">Live operational count</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={appointmentChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--muted)" />
                <YAxis axisLine={false} tickLine={false} stroke="var(--muted)" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {appointmentChartData.map((entry, index) => (
                    <Cell key={`overview-${entry.name}`} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="kekaPanelTitle">
            <h2>Billing Status</h2>
            <small className="muted">Paid vs pending</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={billingChartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={42} paddingAngle={3} label>
                  {billingChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={billingPalette[index % billingPalette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="kekaPanelTitle" style={{ padding: "18px 20px", margin: 0 }}>
          <h2>Recent Activity</h2>
          <small className="muted">Latest 6 activities</small>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <DataTable rows={(stats.recentActivity || []).slice(0, 6)} />
        </div>
      </div>
    </section>
  );
}
