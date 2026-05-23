import React from "react";
import { Activity, Bed, Calendar, CreditCard, Plus, Stethoscope, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "../components";

export default function Dashboard({ stats = {}, patients = [], doctors = [], appointments = [], beds = [], bills = [] }) {
  const chartPalette = ["var(--purple)", "var(--chart-blue)", "var(--chart-green)", "var(--chart-amber)"];
  const billingPalette = ["var(--chart-green)", "var(--chart-amber)", "var(--chart-rose)"];

  const overviewData = [
    { name: "Mon", patients: 12, appointments: 8 },
    { name: "Tue", patients: 18, appointments: 12 },
    { name: "Wed", patients: 15, appointments: 10 },
    { name: "Thu", patients: 24, appointments: 19 },
    { name: "Fri", patients: 20, appointments: 15 },
  ];

  const billingChartData = [
    { name: "Paid", value: bills.filter((b) => b.status === "paid").length || 1 },
    { name: "Pending", value: bills.filter((b) => b.status === "pending").length || 1 },
    { name: "Unpaid", value: bills.filter((b) => b.status === "unpaid").length || 1 },
  ];

  const activity = [
    { title: "New patient admitted", meta: "Room 204 assigned successfully", color: "#10B981" },
    { title: "Appointment marked no-show", meta: "Dr. Sharma · OPD", color: "#F59E0B" },
    { title: "Pharmacy stock alert", meta: "Paracetamol stock running low", color: "#EF4444" },
    { title: "Lab report generated", meta: "CBC report shared with patient", color: "#6366F1" },
  ];

  return (
    <section>
      <div className="enterpriseHero">
        <div>
          <span className="heroBadge">Operational Command Center</span>
          <h2>Welcome back, System Admin</h2>
          <p>Monitor hospital operations, patient movement, appointments, billing and diagnostics from a single intelligent dashboard.</p>

          <div className="heroActions">
            <button><Plus size={16} /> New Patient</button>
            <button className="secondaryBtn"><Calendar size={16} /> Appointment</button>
            <button className="secondaryBtn"><CreditCard size={16} /> Generate Bill</button>
          </div>
        </div>

        <div className="heroStats">
          <div>
            <strong>24</strong>
            <span>Today's Appointments</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Critical Alerts</span>
          </div>
          <div>
            <strong>82%</strong>
            <span>Bed Occupancy</span>
          </div>
        </div>
      </div>

      <div className="grid enterpriseStats" style={{ marginTop: 20 }}>
        <StatCard icon={Users} title="Total Patients" value={stats.totalPatients} />
        <StatCard icon={Stethoscope} title="Total Doctors" value={stats.totalDoctors} />
        <StatCard icon={Calendar} title="Appointments Today" value={stats.appointmentsToday} />
        <StatCard icon={Bed} title="Available Beds" value={stats.availableBeds} />
      </div>

      <div className="dashboardTwoCol">
        <div className="card enterpriseChartCard">
          <div className="kekaPanelTitle">
            <h2>Operational Analytics</h2>
            <small className="muted">Weekly patient & appointment trends</small>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={overviewData}>
                <defs>
                  <linearGradient id="patientsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--muted)" />
                <YAxis axisLine={false} tickLine={false} stroke="var(--muted)" />
                <Tooltip />
                <Area type="monotone" dataKey="patients" stroke="#7C3AED" fill="url(#patientsGradient)" strokeWidth={3} />
                <Area type="monotone" dataKey="appointments" stroke="#06B6D4" fill="transparent" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card enterpriseChartCard">
          <div className="kekaPanelTitle">
            <h2>Billing Intelligence</h2>
            <small className="muted">Collections & pending payments</small>
          </div>

          <div className="billingChartWrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={billingChartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={55} paddingAngle={3}>
                  {billingChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={billingPalette[index % billingPalette.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="billingCenter">
              <strong>₹4.8L</strong>
              <span>Collected</span>
            </div>
          </div>
        </div>
      </div>

      <div className="activityLayout">
        <div className="card activityCard">
          <div className="kekaPanelTitle">
            <h2>Operational Activity</h2>
            <small className="muted">Live hospital workflow updates</small>
          </div>

          <div className="activityFeed">
            {activity.map((item, idx) => (
              <div key={idx} className="activityItem">
                <span className="activityDot" style={{ background: item.color }} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                  <small>2 minutes ago</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card quickInsights">
          <div className="kekaPanelTitle">
            <h2>Quick Insights</h2>
            <small className="muted">Real-time hospital metrics</small>
          </div>

          <div className="insightGrid">
            <div>
              <Activity size={18} />
              <strong>12 min</strong>
              <span>Avg Wait Time</span>
            </div>
            <div>
              <Bed size={18} />
              <strong>06</strong>
              <span>ICU Beds Free</span>
            </div>
            <div>
              <Stethoscope size={18} />
              <strong>18</strong>
              <span>Doctors Active</span>
            </div>
            <div>
              <CreditCard size={18} />
              <strong>24</strong>
              <span>Pending Bills</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
