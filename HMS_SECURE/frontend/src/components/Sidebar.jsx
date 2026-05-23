import React, { useMemo, useState } from "react";
import { ChevronDown, LogOut, SlidersHorizontal, Zap } from "lucide-react";

const GROUPS = [
  { key: "core", title: "Core", items: ["dashboard", "commandCenter", "reports"] },
  { key: "operations", title: "Operations", items: ["patients", "doctors", "appointments", "beds", "ipd", "nursing", "emergency"] },
  { key: "clinical", title: "Clinical", items: ["emr", "labs", "bloodBank", "patientPortal", "doctorPortal"] },
  { key: "revenue", title: "Revenue & Stock", items: ["billing", "pharmacy", "inventory", "insurance_tpa"] },
  { key: "admin", title: "Administration", items: ["hrStaff", "profile", "auditSecurity", "configuration", "compliance", "communications", "two_factor_auth", "audit_compliance"] },
  { key: "enterprise", title: "Enterprise", items: ["operations", "saasControl", "salesDemo", "legalSecurity", "pilotDeployment", "tenants", "integration", "hl7", "pacs", "biometric", "erp", "whatsapp_sms", "abdm_abha"] },
];

export default function Sidebar({ tabs = [], activeTab, onTabChange, onLogout }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(["core", "operations", "clinical", "revenue"]));

  const groupedTabs = useMemo(() => {
    const tabMap = new Map(tabs.map((tab) => [tab[0], tab]));
    const used = new Set();
    const groups = GROUPS.map((group) => {
      const items = group.items.map((id) => tabMap.get(id)).filter(Boolean);
      items.forEach(([id]) => used.add(id));
      return { ...group, items };
    }).filter((group) => group.items.length);
    const remaining = tabs.filter(([id]) => !used.has(id));
    if (remaining.length) groups.push({ key: "more", title: "More", items: remaining });
    return groups;
  }, [tabs]);

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function selectTab(id) {
    onTabChange(id);
  }

  return (
    <aside className="sidebarShell premiumSidebar">
      <div className="brandBlock nexoraBrand">
        <div className="brandMark">N</div>
        <div>
          <h2>Nexora</h2>
          <small>Hospital Suite</small>
        </div>
      </div>

      <nav className="sideNav groupedSideNav" aria-label="Main navigation">
        {groupedTabs.map((group) => {
          const expanded = openGroups.has(group.key);
          const activeInside = group.items.some(([id]) => id === activeTab);
          return (
            <section className={`navGroup ${activeInside ? "activeGroup" : ""}`} key={group.key}>
              <button
                type="button"
                className="navGroupToggle"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
              >
                <span>{group.title}</span>
                <ChevronDown size={14} className={expanded ? "rotate" : ""} />
              </button>
              {expanded ? (
                <div className="navGroupItems">
                  {group.items.map(([id, label, Icon]) => (
                    <button
                      type="button"
                      className={activeTab === id ? "active" : ""}
                      onClick={() => selectTab(id)}
                      key={id}
                      title={label}
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      <button type="button" className="sidebarPreviewCard" onClick={() => onTabChange("commandCenter")}> 
        <Zap size={16} />
        <span><b>Quick Actions</b><small>Command center shortcuts</small></span>
      </button>

      <button type="button" className="sidebarCustomize" onClick={() => onTabChange("configuration")}> 
        <SlidersHorizontal size={16} />
        <span>Customize Dashboard</span>
      </button>

      <div className="sidebarFooter">
        <button type="button" onClick={onLogout} className="logoutBtn">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
