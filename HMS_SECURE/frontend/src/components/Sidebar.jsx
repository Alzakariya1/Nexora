import React, { useMemo, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";

const GROUP_META = {
  core: ["dashboard", "command", "patients", "doctors", "appointments", "beds"],
  clinical: ["labs", "radiology", "emr", "ipd", "nursing", "emergency", "blood_bank"],
  finance: ["billing", "pharmacy", "inventory", "insurance_tpa", "reports"],
  admin: ["profile", "tenant", "audit", "configuration", "saas", "communications", "patient_portal", "doctor_portal", "compliance", "integrations", "production_ops", "sales_demo", "legal_security"],
};

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  const [openGroups, setOpenGroups] = useState({ core: true, clinical: true, finance: true, admin: false });

  const groupedTabs = useMemo(() => {
    const used = new Set();
    const byKey = Object.fromEntries((tabs || []).map((item) => [item[0], item]));
    const build = (key) => GROUP_META[key].map((id) => byKey[id]).filter(Boolean).filter((item) => { used.add(item[0]); return true; });
    const result = { core: build("core"), clinical: build("clinical"), finance: build("finance"), admin: build("admin") };
    const rest = (tabs || []).filter((item) => !used.has(item[0]));
    if (rest.length) result.admin = [...result.admin, ...rest];
    return result;
  }, [tabs]);

  const openActiveGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: true }));

  const renderGroup = (title, key) => {
    const items = groupedTabs[key] || [];
    if (!items.length) return null;
    const isOpen = openGroups[key];
    return (
      <div className="navGroup" key={key}>
        <button className="groupToggle" type="button" onClick={() => setOpenGroups((p) => ({ ...p, [key]: !p[key] }))}>
          <span>{title}</span>
          <ChevronDown size={14} className={isOpen ? "rotate" : ""} />
        </button>
        {isOpen ? (
          <nav className="sideNav">
            {items.map(([id, label, Icon]) => (
              <button type="button" className={activeTab === id ? "active" : ""} onClick={() => { openActiveGroup(key); onTabChange(id); }} key={id} title={label}>
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="sidebarShell premiumSidebar">
      <div className="brandBlock nexoraBrand">
        <div className="brandMark">N</div>
        <div className="brandText"><h2>Nexora</h2><small>Hospital Suite</small></div>
      </div>

      <div className="sidebarScrollArea">
        {renderGroup("Core Operations", "core")}
        {renderGroup("Clinical", "clinical")}
        {renderGroup("Finance", "finance")}
        {renderGroup("Administration", "admin")}
      </div>

      <div className="sidebarFooter">
        <button type="button" onClick={onLogout} className="logoutBtn"><LogOut size={18} /><span>Logout</span></button>
      </div>
    </aside>
  );
}
