import { useState } from "react";
import { T, circBtn } from "../../utils/constants";
import SectionLabel from "../common/SectionLabel";

export default function OrgSection({ db, updateDb }) {
  const [newOrgName, setNewOrgName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const addOrg = () => {
    const name = newOrgName.trim();
    if (!name) return;
    updateDb({
      ...db,
      organizations: [...db.organizations, { id: Date.now().toString(), name }],
    });
    setNewOrgName("");
  };

  const renameOrg = (id) => {
    const name = editingName.trim();
    if (!name) return;
    updateDb({
      ...db,
      organizations: db.organizations.map(o => o.id === id ? { ...o, name } : o),
    });
    setEditingId(null);
    setEditingName("");
  };

  const deleteOrg = (id) => {
    // Cascade: delete teams under this org and their roster data
    const teamIds = new Set(db.teams.filter(t => t.orgId === id).map(t => t.id));
    updateDb({
      ...db,
      organizations: db.organizations.filter(o => o.id !== id),
      teams: db.teams.filter(t => t.orgId !== id),
    });
    setConfirmDeleteId(null);
  };

  return (
    <>
      <SectionLabel label="Organizations" color={T.purple} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input placeholder="Organization name…" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} onKeyDown={e => e.key === "Enter" && addOrg()} />
        <button onClick={addOrg} style={{ ...circBtn(T.purple, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
      </div>
      {db.organizations.length === 0 && (
        <div style={{ color: "#333", fontSize: 13, marginBottom: 16, paddingLeft: 2 }}>No organizations yet.</div>
      )}
      {db.organizations.map(o => {
        const teamCount = db.teams.filter(t => t.orgId === o.id).length;
        const isEditing = editingId === o.id;
        const isConfirming = confirmDeleteId === o.id;

        return (
          <div key={o.id} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          }}>
            {isEditing ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={editingName} onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && renameOrg(o.id)}
                  style={{ fontSize: 14, flex: 1 }} autoFocus />
                <button onClick={() => renameOrg(o.id)} style={{
                  background: T.purple, border: "none", color: "#fff", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}>Save</button>
                <button onClick={() => { setEditingId(null); setEditingName(""); }} style={{
                  background: "transparent", border: "1px solid #333", color: "#555", borderRadius: 8,
                  padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                }}>Cancel</button>
              </div>
            ) : isConfirming ? (
              <div>
                <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 8 }}>
                  Delete {o.name}{teamCount > 0 ? ` and ${teamCount} team${teamCount !== 1 ? "s" : ""}` : ""}?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => deleteOrg(o.id)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #333", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: "#444" }}>{teamCount} team{teamCount !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setEditingId(o.id); setEditingName(o.name); }} style={{
                    background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888",
                    borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>Edit</button>
                  <button onClick={() => setConfirmDeleteId(o.id)} style={{
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#888",
                    borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
