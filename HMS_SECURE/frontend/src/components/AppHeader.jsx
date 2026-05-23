import React, { useEffect, useMemo, useRef, useState } from "react";
import { notificationApi } from "../api/notificationApi";
import { Bell, Building2, Check, ChevronDown, LogOut, Moon, Palette, RefreshCcw, Search, Sun, UserCircle, X } from "lucide-react";

function safeText(value) {
  return String(value || "").toLowerCase();
}

function getInitials(name = "User") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

const themeColors = [
  { name: "Purple", value: "#5b3fb4", dark: "#49339a", soft: "#f0ecff" },
  { name: "Blue", value: "#2563eb", dark: "#1d4ed8", soft: "#eaf1ff" },
  { name: "Teal", value: "#0f766e", dark: "#115e59", soft: "#e6fffb" },
  { name: "Green", value: "#16a34a", dark: "#15803d", soft: "#ecfdf3" },
  { name: "Rose", value: "#e11d48", dark: "#be123c", soft: "#fff1f2" },
  { name: "Indigo", value: "#4f46e5", dark: "#4338ca", soft: "#eef2ff" },
];

export default function AppHeader({
  title,
  user,
  appointmentCount,
  lowStockCount,
  pendingBillCount,
  onRefresh,
  searchData,
  onSearchNavigate,
  onOpenProfile,
  onChangePassword,
  onLogout,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [mode, setMode] = useState(() => localStorage.getItem("nexora-theme-mode") || "light");
  const [accent, setAccent] = useState(() => localStorage.getItem("nexora-accent") || "#5b3fb4");
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const selected = themeColors.find((color) => color.value === accent) || themeColors[0];
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.setProperty("--purple", selected.value);
    document.documentElement.style.setProperty("--purple-dark", selected.dark);
    document.documentElement.style.setProperty("--purple-soft", selected.soft);
    localStorage.setItem("nexora-theme-mode", mode);
    localStorage.setItem("nexora-accent", selected.value);
  }, [mode, accent]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setProfileOpen(false);
        setNotificationOpen(false);
      }
    }
    function onClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target)) setProfileOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, []);


  const results = useMemo(() => {
    const q = safeText(query).trim();
    const patients = searchData?.patients || [];
    const doctors = searchData?.doctors || [];
    const actions = searchData?.actions || [];
    if (!q) return { patients: [], doctors: [], actions: actions.slice(0, 6) };
    return {
      patients: patients
        .filter((p) => [p.full_name, p.patient_id, p.phone, p.email].some((v) => safeText(v).includes(q)))
        .slice(0, 5),
      doctors: doctors
        .filter((d) => [d.full_name, d.doctor_id, d.phone, d.email, d.specialization].some((v) => safeText(v).includes(q)))
        .slice(0, 5),
      actions: actions.filter((a) => safeText(a.label).includes(q)).slice(0, 6),
    };
  }, [query, searchData]);

  const fallbackNotifications = [
    { id: "appointments", title: `${appointmentCount || 0} appointments`, message: "Review today's appointment queue.", is_read: true, severity: "info" },
    { id: "stock", title: `${lowStockCount || 0} low stock items`, message: "Check medicines that need restocking.", is_read: true, severity: "warning" },
    { id: "billing", title: `${pendingBillCount || 0} pending bills`, message: "Follow up on unpaid billing records.", is_read: true, severity: "info" },
  ];
  const visibleNotifications = notifications.length ? notifications : fallbackNotifications;

  const hasResults = results.patients.length || results.doctors.length || results.actions.length;
  const selectedAccent = themeColors.find((color) => color.value === accent) || themeColors[0];
  const hospitalName = user?.hospital_name || user?.hospital?.name || user?.tenant_name || "Hospital";

  async function loadNotifications() {
    try {
      setNotificationLoading(true);
      const { data } = await notificationApi.list({ limit: 25 });
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unread_count || 0));
    } catch (error) {
      // Keep header usable even if older backend deployment does not have notification routes yet.
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationLoading(false);
    }
  }

  async function markNotificationRead(item) {
    if (!item?.id || String(item.id).startsWith("appointments") || item.is_read) return;
    try {
      await notificationApi.markRead(item.id);
      await loadNotifications();
    } catch (error) {
      console.warn("Notification read failed", error);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await notificationApi.markAllRead();
      await loadNotifications();
    } catch (error) {
      console.warn("Mark all notifications failed", error);
    }
  }

  function choose(type, item) {
    setOpen(false);
    setQuery("");
    onSearchNavigate?.(type, item);
  }

  function menuAction(action) {
    setProfileOpen(false);
    action?.();
  }

  return (
    <header className="appHeader">
      <div className="topBar">
        <div className="topBarLeft">
          <div className="hospitalContextChip" title={hospitalName}>
            <Building2 size={18} />
            <span>{hospitalName}</span>
          </div>
        <div className="topBarSearch" ref={wrapRef}>
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search patients, doctors or actions..."
            aria-label="Global search"
          />
          {query ? (
            <button type="button" className="searchClear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
          <kbd>Alt + K</kbd>

          {open ? (
            <div className="searchDropdown">
              <div className="searchSection">
                <b>Patients</b>
                {results.patients.length ? results.patients.map((p) => (
                  <button type="button" key={`p-${p.id || p.patient_id}`} onClick={() => choose("patient", p)}>
                    <span>{p.full_name || "Unnamed Patient"}</span>
                    <small>{p.patient_id || p.phone || p.email || "Patient"}</small>
                  </button>
                )) : <p>No patient found</p>}
              </div>
              <div className="searchSection">
                <b>Doctors</b>
                {results.doctors.length ? results.doctors.map((d) => (
                  <button type="button" key={`d-${d.id || d.doctor_id}`} onClick={() => choose("doctor", d)}>
                    <span>{d.full_name || "Unnamed Doctor"}</span>
                    <small>{d.specialization || d.doctor_id || d.email || "Doctor"}</small>
                  </button>
                )) : <p>No doctor found</p>}
              </div>
              <div className="searchSection">
                <b>Actions</b>
                {results.actions.length ? results.actions.map((a) => (
                  <button type="button" key={a.key} onClick={() => choose("action", a)}>
                    <span>{a.label}</span>
                    <small>{a.hint}</small>
                  </button>
                )) : <p>No action found</p>}
              </div>
              {!hasResults ? <div className="searchEmpty">No matching result</div> : null}
            </div>
          ) : null}
        </div>
        </div>
        <div className="topBarActions">
          <div className="notificationWrap" ref={notificationRef}>
            <button
              type="button"
              className="iconBtn notificationBtn"
              aria-label="Notifications"
              onClick={() => { setNotificationOpen((value) => !value); loadNotifications(); }}
            >
              <Bell size={18} />
              {unreadCount ? <span className="notifyDot" title={`${unreadCount} unread`} /> : null}
            </button>
            {notificationOpen ? (
              <div className="notificationDropdown">
                <div className="dropdownTitle">
                  <div>
                    <b>Notifications</b>
                    <small>{unreadCount ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "Operational alerts"}</small>
                  </div>
                  <button type="button" className="dropdownSmallBtn" onClick={markAllNotificationsRead}>Mark all read</button>
                </div>
                {notificationLoading ? <div className="notificationEmpty">Loading notifications...</div> : null}
                {!notificationLoading && visibleNotifications.length ? visibleNotifications.map((item) => (
                  <button type="button" className={`notificationItem ${item.is_read ? "read" : "unread"}`} key={item.id} onClick={() => markNotificationRead(item)}>
                    <span className={`notificationSeverity ${item.severity || "info"}`} />
                    <div>
                      <b>{item.title}</b>
                      <small>{item.message || item.text || "No details"}</small>
                      {item.created_at ? <em>{new Date(item.created_at).toLocaleString()}</em> : null}
                    </div>
                  </button>
                )) : null}
                {!notificationLoading && !visibleNotifications.length ? <div className="notificationEmpty">No notifications yet</div> : null}
              </div>
            ) : null}
          </div>

          <div className="profileMenuWrap" ref={menuRef}>
            <button type="button" className="userChip profileChip" onClick={() => setProfileOpen((value) => !value)}>
              <span>{getInitials(user?.full_name || "User")}</span>
              <div><b>{user?.full_name || "User"}</b><small>{user?.hospital_name || "Hospital"}</small></div>
              <ChevronDown size={15} />
            </button>
            {profileOpen ? (
              <div className="profileDropdown">
                <div className="profileDropdownHead">
                  <span>{getInitials(user?.full_name || "User")}</span>
                  <div>
                    <b>{user?.full_name || "User"}</b>
                    <small>{user?.email || user?.role || "Signed in"}</small>
                  </div>
                </div>

                <button type="button" onClick={() => menuAction(onOpenProfile)}><UserCircle size={16} /> View Profile</button>
                <button type="button" onClick={() => menuAction(onChangePassword)}><Check size={16} /> Change Password</button>

                <div className="dropdownDivider" />
                <div className="themeModeRow">
                  <span><Palette size={15} /> Appearance</span>
                  <div className="modeToggle">
                    <button type="button" className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}><Sun size={14} /> Light</button>
                    <button type="button" className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}><Moon size={14} /> Dark</button>
                  </div>
                </div>
                <div className="themeColorGrid" aria-label="Theme color">
                  {themeColors.map((color) => (
                    <button
                      type="button"
                      key={color.name}
                      className={selectedAccent.value === color.value ? "active" : ""}
                      style={{ background: color.value }}
                      title={color.name}
                      onClick={() => setAccent(color.value)}
                    >
                      {selectedAccent.value === color.value ? <Check size={13} /> : null}
                    </button>
                  ))}
                </div>

                <div className="dropdownDivider" />
                <button type="button" className="logoutMenuBtn" onClick={() => menuAction(onLogout)}><LogOut size={16} /> Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pageHeader">
        <div><h1>{title}</h1><p>Welcome back, {user?.full_name || "User"}</p></div>
        <div className="headerMetrics">
          <span>📅 {appointmentCount} Appointments</span>
          <span>💊 {lowStockCount} Low Stock</span>
          <span>💰 {pendingBillCount} Pending Bills</span>
          <button type="button" onClick={onRefresh} className="refreshBtn"><RefreshCcw size={15} />Refresh</button>
        </div>
      </div>
    </header>
  );
}
