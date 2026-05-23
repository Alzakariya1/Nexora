import React from "react";
import { LogOut } from "lucide-react";

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  return (
    <aside className="sidebarShell">
      <div className="brandBlock nexoraBrand">
        <div className="brandMark">N</div>
        <div>
          <h2>Nexora</h2>
          <small>Hospital Suite</small>
        </div>
      </div>

      <nav className="sideNav" aria-label="Main navigation">
        {tabs.map(([id, label, Icon]) => (
          <button
            type="button"
            className={activeTab === id ? "active" : ""}
            onClick={() => onTabChange(id)}
            key={id}
            title={label}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <button type="button" onClick={onLogout} className="logoutBtn">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
