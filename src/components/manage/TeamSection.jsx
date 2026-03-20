import { useState } from "react";
import { T, circBtn } from "../../utils/constants";
import SectionLabel from "../common/SectionLabel";

export default function TeamSection({ db, updateDb, selectedTeamId, setSelectedTeamId }) {
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingOrgId, setEditingOrgId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const addTeam = () => {
    const name = newTeamName.trim();
    if (!name || !selectedOrgId) return;
    updateDb({
      ...db,
      teams: [...db.teams, {
        id: Date.now().toString(),
        name,
        orgId: selectedOrgId,
        roster: [],
        tempRoster: null,
      }],
    });
    setNewTeamName("");
  };

  const saveTeamEdit = (id) => {
    const name = editingName.trim();
    if (!name) return;
    updateDb({
      ...db,
      teams: db.teams.map(t => t.id === id ? { ...t, name, orgId: editingOrgId || t.orgId } : t),
    });
    setEditingId(null);
    setEditingName("");
    setEditingOrgId("");
  };

  const deleteTeam = (id) => {
    updateDb({
      ...db,
      teams: db.teams.filter(t => t.id !== id),
    });
    if (selectedTeamId === id) setSelectedTeamId(null);
    setConfirmDeleteId(null);
  };

  // Group teams by org
  const orgMap = {};
  db.organizations.forEach(o => { orgMap[o.id] = { ...o, teams: [] }; });
  db.teams.forEach(t => {
    if (orgMap[t.orgId]) orgMap[t.orgId].teams.push(t);
  });

  return (
    <>
      <SectionLabel label="Teams" color={T.green} />
      {db.organizations.length === 0 ? (
        <div style={{ color: "#333", fontSize: 13, marginBottom: 16, paddingLeft: 2 }}>Add an organization first.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)} style={{ width: "auto", minWidth: 120, flexShrink: 0 }}>
              <option value="">Select Org…</option>
              {db.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input placeholder="Team name…" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTeam()} />
            <button onClick={addTeam} style={{ ...circBtn(T.green, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
          </div>
        </>
      )}

      {db.teams.length === 0 && db.organizations.length > 0 && (
        <div style={{ color: "#333", fontSize: 13, marginBottom: 16, paddingLeft: 2 }}>No teams yet.</div>
      )}

      {Object.values(orgMap).filter(o => o.teams.length > 0).map(org => (
        <div key={org.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6, paddingLeft: 2 }}>{org.name}</div>
          {org.teams.map(t => {
            const rosterCount = (t.roster || []).length;
            const isSelected = selectedTeamId === t.id;
            const isEditing = editingId === t.id;
            const isConfirming = confirmDeleteId === t.id;

            return (
              <div key={t.id} style={{
                background: isSelected ? "rgba(34,197,94,0.1)" : T.card,
                border: `1px solid ${isSelected ? "rgba(34,197,94,0.3)" : T.border}`,
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
              }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={editingOrgId} onChange={e => setEditingOrgId(e.target.value)} style={{ width: "auto", minWidth: 100, flexShrink: 0 }}>
                        {db.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <input value={editingName} onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveTeamEdit(t.id)}
                        style={{ fontSize: 14, flex: 1 }} autoFocus />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveTeamEdit(t.id)} style={{
                        background: T.green, border: "none", color: "#fff", borderRadius: 8,
                        padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>Save</button>
                      <button onClick={() => { setEditingId(null); setEditingName(""); setEditingOrgId(""); }} style={{
                        background: "transparent", border: "1px solid #333", color: "#555", borderRadius: 8,
                        padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                ) : isConfirming ? (
                  <div>
                    <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 8 }}>Delete {t.name}?</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => deleteTeam(t.id)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #333", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "#444" }}>{rosterCount} player{rosterCount !== 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setSelectedTeamId(isSelected ? null : t.id)} style={{
                        background: isSelected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${isSelected ? "rgba(34,197,94,0.3)" : T.border}`,
                        color: isSelected ? T.green : "#888",
                        borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>{isSelected ? "Close Roster" : "Roster"}</button>
                      <button onClick={() => { setEditingId(t.id); setEditingName(t.name); setEditingOrgId(t.orgId); }} style={{
                        background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888",
                        borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Edit</button>
                      <button onClick={() => setConfirmDeleteId(t.id)} style={{
                        background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#888",
                        borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
