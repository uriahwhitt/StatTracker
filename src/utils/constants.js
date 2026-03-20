// ── Theme colors ─────────────────────────────────────────────────────────────
export const T = {
  orange: "#F97316", green: "#22C55E", blue: "#3B82F6", red: "#EF4444", purple: "#A855F7",
  bg: "#080810", card: "rgba(255,255,255,0.045)", border: "rgba(255,255,255,0.08)",
};

// ── Shared style helpers ─────────────────────────────────────────────────────
export const circBtn = (bg, size) => ({
  width: size, height: size, borderRadius: "50%", border: "none",
  background: bg, color: "#fff", fontSize: size * 0.55, fontWeight: 700,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, lineHeight: 1, WebkitTapHighlightColor: "transparent",
  transition: "opacity 0.15s",
});

export const pillBtn = (active) => ({
  background: active ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
  border: `1px solid ${active ? "rgba(249,115,22,0.4)" : T.border}`,
  color: active ? T.orange : "#666",
  borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
});

export const backBtn = {
  background: "none", border: "none", color: T.orange, cursor: "pointer",
  fontSize: 14, fontWeight: 700, padding: 0, marginBottom: 8, display: "block",
};
