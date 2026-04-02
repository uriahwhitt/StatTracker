import { useState } from "react";
import { T } from "../../utils/constants";
import RosterModal from "./RosterModal";
import MembersModal from "./MembersModal";

export default function PeopleView({ db, updateDb, user, userRole, isSuperadminUser }) {
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [editingOrgName, setEditingOrgName] = useState("");
  const [addingTeamToOrg, setAddingTeamToOrg] = useState(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [rosterModalTeamId, setRosterModalTeamId] = useState(null);
  const [membersModalTeamId, setMembersModalTeamId] = useState(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [addingOrg, setAddingOrg] = useState(false);
  const [playerFilter, setPlayerFilter] = useState("all");
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null); // { id, name, jerseyEdits: { teamId: jerseyNumber } }
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(null);

  const sectionLabel = (text) => (
    <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 20 }}>
      {text}
    </div>
  );

  // ── Org CRUD ────────────────────────────────────────────────────────────────
  const addOrg = () => {
    const name = newOrgName.trim();
    if (!name) return;
    const org = { id: `org_${Date.now()}`, name };
    updateDb({ ...db, organizations: [...db.organizations, org] });
    setNewOrgName("");
    setAddingOrg(false);
  };

  const saveOrgName = (id) => {
    const name = editingOrgName.trim();
    if (!name) return;
    updateDb({ ...db, organizations: db.organizations.map(o => o.id === id ? { ...o, name } : o) });
    setEditingOrgId(null);
  };

  const deleteOrg = (orgId) => {
    const teamIds = db.teams.filter(t => t.orgId === orgId).map(t => t.id);
    updateDb({
      ...db,
      organizations: db.organizations.filter(o => o.id !== orgId),
      teams: db.teams.filter(t => t.orgId !== orgId),
      players: db.players.map(p => p.orgId === orgId ? { ...p, orgId: null } : p),
    });
    setConfirmDeleteOrg(null);
    if (expandedOrgId === orgId) setExpandedOrgId(null);
  };

  // ── Team CRUD ───────────────────────────────────────────────────────────────
  const addTeam = (orgId) => {
    const name = newTeamName.trim();
    if (!name) return;
    const team = { id: `team_${Date.now()}`, orgId, name, roster: [], tempRoster: null };
    updateDb({ ...db, teams: [...db.teams, team] });
    setNewTeamName("");
    setAddingTeamToOrg(null);
  };

  const saveTeamName = (id) => {
    const name = editingTeamName.trim();
    if (!name) return;
    updateDb({ ...db, teams: db.teams.map(t => t.id === id ? { ...t, name } : t) });
    setEditingTeamId(null);
  };

  // ── Player CRUD ─────────────────────────────────────────────────────────────
  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const firstOrgId = db.organizations[0]?.id || null;
    const player = { id: `player_${Date.now()}`, name, orgId: firstOrgId, createdAt: new Date().toISOString() };
    updateDb({ ...db, players: [...db.players, player] });
    setNewPlayerName("");
    setAddingPlayer(false);
  };

  const savePlayerEdits = () => {
    if (!editingPlayer) return;
    const { id, name, jerseyEdits } = editingPlayer;
    const updatedPlayers = db.players.map(p => p.id === id ? { ...p, name: name.trim() || p.name } : p);
    const updatedTeams = db.teams.map(t => {
      const newJersey = jerseyEdits?.[t.id];
      if (newJersey === undefined) return t;
      return {
        ...t,
        roster: t.roster.map(r => r.playerId === id ? { ...r, jerseyNumber: newJersey } : r),
      };
    });
    updateDb({ ...db, players: updatedPlayers, teams: updatedTeams });
    setEditingPlayer(null);
    setExpandedPlayerId(null);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const teamsForOrg = (orgId) => db.teams.filter(t => t.orgId === orgId);
  const playerTeams = (playerId) => db.teams.filter(t => (t.roster || []).some(r => r.playerId === playerId));
  const isUnassigned = (playerId) => playerTeams(playerId).length === 0;

  const filteredPlayers = playerFilter === "all"
    ? db.players
    : playerFilter === "unassigned"
      ? db.players.filter(p => isUnassigned(p.id))
      : db.players.filter(p => db.teams.find(t => t.id === playerFilter)?.roster?.some(r => r.playerId === p.id));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Organizations ── */}
      {sectionLabel("Organizations")}

      {db.organizations.map(org => {
        const teams = teamsForOrg(org.id);
        const playerCount = db.players.filter(p => p.orgId === org.id).length;
        const isExpanded = expandedOrgId === org.id;

        return (
          <div key={org.id} style={{
            background: "rgba(249,115,22,0.06)", border: `1px solid rgba(249,115,22,0.15)`,
            borderRadius: 12, marginBottom: 8, overflow: "hidden",
          }}>
            {/* Org header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", cursor: "pointer" }}
              onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}>
              {editingOrgId === org.id ? (
                <input
                  value={editingOrgName}
                  onChange={e => setEditingOrgName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveOrgName(org.id); if (e.key === "Escape") setEditingOrgId(null); }}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                  style={{ flex: 1, fontSize: 14, fontWeight: 700 }}
                />
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>{org.name}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{teams.length} team{teams.length !== 1 ? "s" : ""} · {playerCount} player{playerCount !== 1 ? "s" : ""}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                {editingOrgId === org.id ? (
                  <>
                    <button onClick={() => saveOrgName(org.id)} style={smallBtn(T.orange)}>Save</button>
                    <button onClick={() => setEditingOrgId(null)} style={smallBtn("#444")}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingOrgId(org.id); setEditingOrgName(org.name); }} style={smallBtn("#555")}>Edit</button>
                    {confirmDeleteOrg === org.id ? (
                      <>
                        <button onClick={() => deleteOrg(org.id)} style={smallBtn(T.red)}>Confirm</button>
                        <button onClick={() => setConfirmDeleteOrg(null)} style={smallBtn("#444")}>✕</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteOrg(org.id)} style={smallBtn("rgba(239,68,68,0.3)")}>Delete</button>
                    )}
                  </>
                )}
                <span style={{ fontSize: 12, color: "#555", transform: `rotate(${isExpanded ? 180 : 0}deg)`, transition: "transform 0.2s" }}>▾</span>
              </div>
            </div>

            {/* Expanded: teams */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid rgba(249,115,22,0.1)`, padding: "8px 14px 12px" }}>
                {teams.map(team => (
                  <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                    {editingTeamId === team.id ? (
                      <input
                        value={editingTeamName}
                        onChange={e => setEditingTeamName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveTeamName(team.id); if (e.key === "Escape") setEditingTeamId(null); }}
                        autoFocus
                        style={{ flex: 1, fontSize: 13 }}
                      />
                    ) : (
                      <div style={{ flex: 1 }}>
                        <span style={{ color: "#ddd", fontWeight: 600, fontSize: 13 }}>{team.name}</span>
                        <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>{(team.roster || []).length} players</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 4 }}>
                      {editingTeamId === team.id ? (
                        <>
                          <button onClick={() => saveTeamName(team.id)} style={smallBtn(T.orange)}>Save</button>
                          <button onClick={() => setEditingTeamId(null)} style={smallBtn("#444")}>✕</button>
                        </>
                      ) : (
                        <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name); }} style={smallBtn("#555")}>Edit</button>
                      )}
                      <button onClick={() => setRosterModalTeamId(team.id)} style={smallBtn(T.blue)}>Roster ›</button>
                      <button onClick={() => setMembersModalTeamId(team.id)} style={smallBtn(T.orange)}>Members ›</button>
                    </div>
                  </div>
                ))}

                {/* Add team row */}
                {addingTeamToOrg === org.id ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input
                      placeholder="Team name…"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addTeam(org.id); if (e.key === "Escape") { setAddingTeamToOrg(null); setNewTeamName(""); } }}
                      autoFocus
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <button onClick={() => addTeam(org.id)} style={smallBtn(T.orange)}>Add</button>
                    <button onClick={() => { setAddingTeamToOrg(null); setNewTeamName(""); }} style={smallBtn("#444")}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingTeamToOrg(org.id)} style={{
                    marginTop: 10, width: "100%", background: "none",
                    border: `1px dashed ${T.border}`, color: "#555", borderRadius: 8,
                    padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>+ Add team</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add org */}
      {addingOrg ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Organization name…"
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addOrg(); if (e.key === "Escape") { setAddingOrg(false); setNewOrgName(""); } }}
            autoFocus
            style={{ flex: 1, fontSize: 14 }}
          />
          <button onClick={addOrg} style={smallBtn(T.orange)}>Add</button>
          <button onClick={() => { setAddingOrg(false); setNewOrgName(""); }} style={smallBtn("#444")}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAddingOrg(true)} style={{
          width: "100%", background: "none", border: `1px dashed ${T.border}`,
          color: "#555", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          marginBottom: 4,
        }}>+ Add Organization</button>
      )}

      {/* ── All Players ── */}
      {sectionLabel("All Players")}

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {[["all", "All"], ["unassigned", "Unassigned"], ...db.teams.map(t => [t.id, t.name])].map(([val, label]) => (
          <button key={val} onClick={() => setPlayerFilter(val)} style={{
            background: playerFilter === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${playerFilter === val ? "rgba(249,115,22,0.4)" : T.border}`,
            color: playerFilter === val ? T.orange : "#666",
            borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {/* Player list */}
      {filteredPlayers.map(player => {
        const teams = playerTeams(player.id);
        const unassigned = teams.length === 0;
        const isExpanded = expandedPlayerId === player.id;
        const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

        return (
          <div key={player.id} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, marginBottom: 6, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
              onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(168,85,247,0.2)",
                border: "1px solid rgba(168,85,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#A855F7", flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{player.name}</div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  {unassigned
                    ? <span style={{ color: T.orange, fontWeight: 700 }}>Unassigned</span>
                    : teams.map(t => t.name).join(", ")}
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#555", transform: `rotate(${isExpanded ? 180 : 0}deg)`, transition: "transform 0.2s" }}>▾</span>
            </div>

            {/* Expanded: edit player */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px" }}
                onClick={e => e.stopPropagation()}>
                {editingPlayer?.id === player.id ? (
                  <div>
                    <div style={{ fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name</div>
                    <input
                      value={editingPlayer.name}
                      onChange={e => setEditingPlayer(ep => ({ ...ep, name: e.target.value }))}
                      style={{ fontSize: 14, marginBottom: 10 }}
                    />
                    {teams.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Jersey Numbers</div>
                        {teams.map(t => {
                          const rosterEntry = t.roster.find(r => r.playerId === player.id);
                          const current = editingPlayer.jerseyEdits?.[t.id] ?? rosterEntry?.jerseyNumber ?? "";
                          return (
                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: "#888", flex: 1 }}>{t.name}</span>
                              <span style={{ fontSize: 12, color: "#555" }}>#</span>
                              <input
                                value={current}
                                onChange={e => setEditingPlayer(ep => ({
                                  ...ep,
                                  jerseyEdits: { ...ep.jerseyEdits, [t.id]: e.target.value },
                                }))}
                                style={{ width: 60, textAlign: "center", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}
                              />
                            </div>
                          );
                        })}
                      </>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={savePlayerEdits} style={{
                        flex: 1, background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
                        color: "#fff", border: "none", borderRadius: 10, padding: "10px",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>Save</button>
                      <button onClick={() => setEditingPlayer(null)} style={{
                        background: "transparent", color: "#555", border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditingPlayer({ id: player.id, name: player.name, jerseyEdits: {} })}
                    style={smallBtn("#555")}>Edit Player</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add player */}
      {addingPlayer ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            placeholder="Player name…"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addPlayer(); if (e.key === "Escape") { setAddingPlayer(false); setNewPlayerName(""); } }}
            autoFocus
            style={{ flex: 1, fontSize: 14 }}
          />
          <button onClick={addPlayer} style={smallBtn(T.orange)}>Add</button>
          <button onClick={() => { setAddingPlayer(false); setNewPlayerName(""); }} style={smallBtn("#444")}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAddingPlayer(true)} style={{
          width: "100%", background: "none", border: `1px dashed ${T.border}`,
          color: "#555", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          marginTop: 8,
        }}>+ Add player to org</button>
      )}

      <div style={{ height: 16 }} />

      {/* Roster modal */}
      {rosterModalTeamId && (
        <RosterModal
          db={db}
          updateDb={updateDb}
          teamId={rosterModalTeamId}
          onClose={() => setRosterModalTeamId(null)}
        />
      )}

      {/* Members modal */}
      {membersModalTeamId && (() => {
        const team = db.teams.find(t => t.id === membersModalTeamId);
        const org = db.organizations.find(o => o.id === team?.orgId);
        return (
          <MembersModal
            orgId={team?.orgId}
            teamId={membersModalTeamId}
            teamName={team?.name || ''}
            orgName={org?.name || ''}
            user={user}
            userRole={userRole}
            onClose={() => setMembersModalTeamId(null)}
          />
        );
      })()}
    </div>
  );
}

// ── Shared button helper ──────────────────────────────────────────────────────
const smallBtn = (bg) => ({
  background: bg, border: "none", color: "#fff", borderRadius: 8,
  padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
});
