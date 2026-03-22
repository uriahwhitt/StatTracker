import { useState } from "react";
import { T } from "../../utils/constants";

export default function TournamentModal({ tournament, onSave, onClose }) {
  const [name, setName] = useState(tournament?.name || "");
  const [location, setLocation] = useState(tournament?.location || "");
  const [startDate, setStartDate] = useState(tournament?.startDate || "");
  const [endDate, setEndDate] = useState(tournament?.endDate || "");
  const [notes, setNotes] = useState(tournament?.notes || "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(tournament || {}),
      name: name.trim(),
      location: location.trim(),
      startDate,
      endDate,
      notes: notes.trim(),
      createdByOrgId: tournament?.createdByOrgId || null,
    });
  };

  const labelStyle = { fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 60,
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0",
        padding: "20px 16px", maxHeight: "85vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {tournament ? "Edit Tournament" : "New Tournament"}
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            color: "#888", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tournament name…" style={{ fontSize: 15 }} autoFocus />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, venue…" style={{ fontSize: 14 }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ fontSize: 14 }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} style={{
            outline: "none", color: "#fff", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px",
            fontSize: 14, width: "100%", fontFamily: "'DM Sans',sans-serif", resize: "vertical",
          }} />
        </div>

        <button onClick={handleSave} disabled={!name.trim()} style={{
          width: "100%",
          background: name.trim() ? `linear-gradient(135deg, ${T.orange}, #ea580c)` : "rgba(255,255,255,0.04)",
          color: name.trim() ? "#fff" : "#444", border: "none", borderRadius: 12,
          padding: "14px", fontSize: 15, fontWeight: 800, cursor: name.trim() ? "pointer" : "default",
        }}>
          {tournament ? "Save Changes" : "Create Tournament"}
        </button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
