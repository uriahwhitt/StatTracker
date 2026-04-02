import { T } from "../../utils/constants";

const ALL_TABS = [
  { v: "tracker",   icon: "🏀", label: "Track" },
  { v: "scorebook", icon: "📋", label: "Scorebook" },
  { v: "history",   icon: "📊", label: "History" },
  { v: "reports",   icon: "📈", label: "Reports" },
  { v: "manage",    icon: "⚙️",  label: "Manage" },
];

// visibleTabs: array of tab keys to show. If omitted, all tabs are shown.
export default function BottomNav({ view, navTo, hidden, visibleTabs }) {
  if (hidden) return null;
  const tabs = visibleTabs
    ? ALL_TABS.filter(t => visibleTabs.includes(t.v))
    : ALL_TABS;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(8,8,16,0.97)", backdropFilter: "blur(24px) saturate(1.5)",
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom, 8px)",
    }}>
      {tabs.map(tab => (
        <button key={tab.v} onClick={() => navTo(tab.v)} style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 3, padding: "12px 0 8px",
          opacity: view === tab.v ? 1 : 0.3,
          transition: "opacity 0.2s",
        }}>
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: view === tab.v ? T.orange : "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
