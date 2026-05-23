
import React, { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  const [openGroups, setOpenGroups] = useState({
    operations: true,
    management: false,
    portals: false,
  });

  const groups = {
    operations: tabs.slice(0, 6),
    management: tabs.slice(6, 10),
    portals: tabs.slice(10),
  };

  const renderGroup = (title, key) => (
    <div className="navGroup">
      <button
        className="groupToggle"
        type="button"
        onClick={() => setOpenGroups((p) => ({ ...p, [key]: !p[key] }))}
      >
        <span>{title}</span>
        <ChevronDown size={16} className={openGroups[key] ? "rotate" : ""} />
      </button>

      {openGroups[key] && (
        <nav className="sideNav">
          {groups[key].map(([id, label, Icon]) => (
            <button
              type="button"
              className={activeTab === id ? "active" : ""}
              onClick={() => onTabChange(id)}
              key={id}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );

  return (
    <aside className="sidebarShell premiumSidebar">
      <div className="brandBlock nexoraBrand">
        <div className="brandMark">N</div>
        <div className="brandText">
          <h2>Nexora</h2>
          <small>Hospital Suite</small>
        </div>
      </div>

      {renderGroup("OPERATIONS", "operations")}
      {renderGroup("MANAGEMENT", "management")}
      {renderGroup("PORTALS", "portals")}

      <div className="premiumPreviewCard">
        <h4>Quick Actions</h4>
        <p>Access frequent HMS workflows instantly.</p>
      </div>

      <div className="sidebarFooter">
        <button type="button" onClick={onLogout} className="logoutBtn">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
