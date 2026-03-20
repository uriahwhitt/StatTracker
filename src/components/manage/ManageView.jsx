import { useState, useRef } from "react";
import { T, circBtn, pillBtn } from "../../utils/constants";
import { fmtGameDate, gameDate, todayStr } from "../../utils/dates";
import SectionLabel from "../common/SectionLabel";
import OrgSection from "./OrgSection";
import TeamSection from "./TeamSection";
import RosterSection from "./RosterSection";
import {
  exportPlayerGamePDF,
  exportPlayerMultiGamePDF,
  exportTeamGamePDF,
  exportTeamMultiGamePDF,
} from "../../utils/pdfExport";

export default function ManageView({
  db, updateDb, activePlayerId, setActivePlayer, activePlayer,
  playerGames, addPlayer: addPlayerFromApp,
  confirmDelete, setConfirmDelete, confirmAndDelete,
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");

  // ── Player export state ────────────────────────────────────────────────────
  const [exportScope, setExportScope]       = useState("all");
  const [exportGameId, setExportGameId]     = useState("");
  const [exportTournId, setExportTournId]   = useState("");
  const [exportYear, setExportYear]         = useState(() => String(new Date().getFullYear()));
  const [exportStart, setExportStart]       = useState(() => `${new Date().getFullYear()}-01-01`);
  const [exportEnd, setExportEnd]           = useState(todayStr);
  const [exportMsg, setExportMsg]           = useState("");

  // ── Team export state ──────────────────────────────────────────────────────
  const [teamScope, setTeamScope]           = useState("game");
  const [teamGameId, setTeamGameId]         = useState("");
  const [teamTournId, setTeamTournId]       = useState("");
  const [teamYear, setTeamYear]             = useState(() => String(new Date().getFullYear()));
  const [teamMsg, setTeamMsg]               = useState("");

  // ── Import state ───────────────────────────────────────────────────────────
  const [importData, setImportData]         = useState(null);
  const [importPlayerId, setImportPlayerId] = useState("");
  const [importMsg, setImportMsg]           = useState("");
  const fileInputRef = useRef(null);

  // ── Player management ──────────────────────────────────────────────────────
  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const player = { id: Date.now().toString(), name };
    const newDb = { ...db, players: [...db.players, player] };
    updateDb(newDb);
    if (!activePlayerId) setActivePlayer(player.id);
    setNewPlayerName("");
  };

  const renamePlayer = (id, newName) => {
    const name = newName.trim();
    if (!name) return;
    const updatedPlayers = db.players.map(p => p.id === id ? { ...p, name } : p);
    updateDb({ ...db, players: updatedPlayers });
    setEditingPlayerId(null);
    setEditingPlayerName("");
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const flash = (setter, msg, ms = 2500) => {
    setter(msg);
    setTimeout(() => setter(""), ms);
  };

  const filterPlayerGames = (scope) => {
    if (scope === "game")       return playerGames.filter(g => g.id === exportGameId);
    if (scope === "tournament") return playerGames.filter(g => g.tournamentId === exportTournId);
    if (scope === "season")     return playerGames.filter(g => gameDate(g).startsWith(exportYear));
    if (scope === "daterange")  return playerGames.filter(g => { const d = gameDate(g); return d >= exportStart && d <= exportEnd; });
    return playerGames;
  };

  // ── Player: JSON export ────────────────────────────────────────────────────
  const doExport = () => {
    const games = filterPlayerGames(exportScope);
    if (!games.length) { flash(setExportMsg, "No games to export"); return; }

    const tournIds   = new Set(games.map(g => g.tournamentId).filter(Boolean));
    const tournaments = db.tournaments.filter(t => tournIds.has(t.id));
    const exportGames = games.map(({ playerId, ...rest }) => rest);

    const payload = {
      stattracker_export: true, version: 1,
      exportedAt: new Date().toISOString(),
      playerName: activePlayer?.name || "Unknown",
      games: exportGames, tournaments,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `stattracker-${(activePlayer?.name || "export").replace(/\s+/g, "-").toLowerCase()}-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(setExportMsg, `Exported ${exportGames.length} game${exportGames.length !== 1 ? "s" : ""}`);
  };

  // ── Player: PDF export ─────────────────────────────────────────────────────
  const doExportPDF = () => {
    const games = filterPlayerGames(exportScope);
    if (!games.length) { flash(setExportMsg, "No games to export"); return; }
    if (!activePlayer)  { flash(setExportMsg, "No active player");  return; }

    const tournament = exportScope === "tournament" && exportTournId
      ? db.tournaments.find(t => t.id === exportTournId) : null;

    if (exportScope === "game") {
      const game = games[0];
      const gameTournament = game.tournamentId
        ? db.tournaments.find(t => t.id === game.tournamentId) : null;
      exportPlayerGamePDF(game, activePlayer, gameTournament);
    } else {
      const scopeLabels = {
        all:        "All Games",
        tournament: tournament?.name || "Tournament",
        season:     `${exportYear} Season`,
        daterange:  `${exportStart} – ${exportEnd}`,
      };
      exportPlayerMultiGamePDF(games, activePlayer, scopeLabels[exportScope], tournament);
    }

    flash(setExportMsg, `PDF exported (${games.length} game${games.length !== 1 ? "s" : ""})`);
  };

  // ── Team: PDF export ───────────────────────────────────────────────────────
  const filterTeamGames = () => {
    const sbGames = db.scorebookGames || [];
    if (teamScope === "game")       return sbGames.filter(g => g.id === teamGameId);
    if (teamScope === "tournament") return sbGames.filter(g => g.tournamentId === teamTournId);
    if (teamScope === "season")     return sbGames.filter(g => (g.gameDate || "").startsWith(teamYear));
    return sbGames;
  };

  const doTeamPDF = () => {
    const games = filterTeamGames();
    if (!games.length) { flash(setTeamMsg, "No games found"); return; }

    if (teamScope === "game") {
      exportTeamGamePDF(games[0], db);
    } else {
      const tournament = teamScope === "tournament" && teamTournId
        ? db.tournaments.find(t => t.id === teamTournId) : null;
      const scopeLabel = teamScope === "tournament"
        ? (tournament?.name || "Tournament")
        : `${teamYear} Season`;
      exportTeamMultiGamePDF(games, scopeLabel, tournament, db);
    }

    flash(setTeamMsg, `PDF exported (${games.length} game${games.length !== 1 ? "s" : ""})`);
  };

  // ── Derived data for pickers ───────────────────────────────────────────────
  const playerYears = [...new Set(playerGames.map(g => gameDate(g).slice(0, 4)))].sort().reverse();
  const sbGames     = db.scorebookGames || [];
  const sbYears     = [...new Set(sbGames.map(g => (g.gameDate || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const sbTournIds  = new Set(sbGames.map(g => g.tournamentId).filter(Boolean));
  const sbTournaments = db.tournaments.filter(t => sbTournIds.has(t.id));

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.stattracker_export || !Array.isArray(data.games)) {
          flash(setImportMsg, "Invalid export file", 3000);
          return;
        }
        setImportData(data);
        setImportPlayerId(activePlayerId);
      } catch {
        flash(setImportMsg, "Could not parse file", 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const doImport = () => {
    if (!importData || !importPlayerId) return;

    const existingIds = new Set(db.games.map(g => g.id));
    const newGames    = importData.games
      .filter(g => !existingIds.has(g.id))
      .map(g => ({ ...g, playerId: importPlayerId }));

    let newTournaments = [...db.tournaments];
    const tournIdMap   = {};
    for (const t of (importData.tournaments || [])) {
      const existing = newTournaments.find(lt => lt.name === t.name);
      if (existing) {
        tournIdMap[t.id] = existing.id;
      } else {
        const newT = { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
        newTournaments.push(newT);
        tournIdMap[t.id] = newT.id;
      }
    }

    const remappedGames = newGames.map(g => ({
      ...g,
      tournamentId: g.tournamentId ? (tournIdMap[g.tournamentId] || g.tournamentId) : null,
    }));

    const mergedGames = [...remappedGames, ...db.games].sort((a, b) => {
      const da = gameDate(a), db2 = gameDate(b);
      return db2.localeCompare(da);
    });

    updateDb({ ...db, games: mergedGames, tournaments: newTournaments });
    flash(setImportMsg, `Imported ${remappedGames.length} new game${remappedGames.length !== 1 ? "s" : ""}${remappedGames.length === 0 ? " (all duplicates)" : ""}`, 3000);
    setImportData(null);
  };

  // ── Shared sub-components ──────────────────────────────────────────────────
  const ScopePills = ({ scopes, active, onChange }) => (
    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
      {scopes.map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)} style={pillBtn(active === val)}>{label}</button>
      ))}
    </div>
  );

  const exportBtnStyle = (color) => ({
    flex: 1, background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: "#fff", border: "none", borderRadius: 10, padding: "11px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Manage</div>

      {/* ── Organizations ── */}
      <OrgSection db={db} updateDb={updateDb} />

      {/* ── Teams ── */}
      <TeamSection db={db} updateDb={updateDb} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} />

      {/* ── Roster (when team selected) ── */}
      {selectedTeamId && <RosterSection db={db} updateDb={updateDb} teamId={selectedTeamId} />}

      {/* ── Players ── */}
      <SectionLabel label="Players" color={T.orange} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input placeholder="New player name…" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()} />
        <button onClick={addPlayer} style={{ ...circBtn(T.orange, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
      </div>
      {db.players.map(p => {
        const count     = db.games.filter(g => g.playerId === p.id).length;
        const isEditing = editingPlayerId === p.id;
        return (
          <div key={p.id} style={{
            background: p.id === activePlayerId ? "rgba(249,115,22,0.1)" : T.card,
            border: `1px solid ${p.id === activePlayerId ? "rgba(249,115,22,0.3)" : T.border}`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          }}>
            {isEditing ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={editingPlayerName} onChange={e => setEditingPlayerName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && renamePlayer(p.id, editingPlayerName)}
                  style={{ fontSize: 14, flex: 1 }} autoFocus />
                <button onClick={() => renamePlayer(p.id, editingPlayerName)} style={{ background: T.orange, border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Save</button>
                <button onClick={() => { setEditingPlayerId(null); setEditingPlayerName(""); }} style={{ background: "transparent", border: "1px solid #333", color: "#555", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Cancel</button>
              </div>
            ) : confirmDelete?.type === "player" && confirmDelete.id === p.id ? (
              <div>
                <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 8 }}>Delete {p.name} and all {count} game{count !== 1 ? "s" : ""}?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={confirmAndDelete} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                  <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #333", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#444" }}>{count} game{count !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => { setEditingPlayerId(p.id); setEditingPlayerName(p.name); }} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => setConfirmDelete({ type: "player", id: p.id, label: p.name })} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#888", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                  {p.id === activePlayerId
                    ? <span style={{ fontSize: 11, color: T.orange, fontWeight: 700, marginLeft: 4 }}>ACTIVE</span>
                    : <button onClick={() => setActivePlayer(p.id)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Select</button>
                  }
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Player Reports ── */}
      <SectionLabel label="Player Reports" color={T.blue} />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          Reports for <span style={{ color: T.orange, fontWeight: 700 }}>{activePlayer?.name || "—"}</span>
        </div>

        <ScopePills
          scopes={[["all", "All"], ["season", "Season"], ["tournament", "Tournament"], ["game", "Game"], ["daterange", "Date Range"]]}
          active={exportScope}
          onChange={setExportScope}
        />

        {exportScope === "season" && (
          <select value={exportYear} onChange={e => setExportYear(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
            {(playerYears.length ? playerYears : [String(new Date().getFullYear())]).map(y => (
              <option key={y} value={y}>{y} Season</option>
            ))}
          </select>
        )}

        {exportScope === "game" && (
          <select value={exportGameId} onChange={e => setExportGameId(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
            <option value="">Select game…</option>
            {playerGames.map(g => (
              <option key={g.id} value={g.id}>vs {g.opponent} — {fmtGameDate(g)} ({g.points} pts)</option>
            ))}
          </select>
        )}

        {exportScope === "tournament" && (
          <select value={exportTournId} onChange={e => setExportTournId(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
            <option value="">Select tournament…</option>
            {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {exportScope === "daterange" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ fontSize: 13 }} />
            <input type="date" value={exportEnd}   onChange={e => setExportEnd(e.target.value)}   style={{ fontSize: 13 }} />
          </div>
        )}

        {exportMsg && (
          <div style={{ fontSize: 13, color: T.green, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>{exportMsg}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={doExport}    style={exportBtnStyle(T.blue)}>Export JSON</button>
          <button onClick={doExportPDF} style={exportBtnStyle(T.orange)}>Export PDF</button>
        </div>
      </div>

      {/* ── Team Reports ── */}
      <SectionLabel label="Team Reports" color={T.green} />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", marginBottom: 12 }}>
        {sbGames.length === 0 ? (
          <div style={{ fontSize: 13, color: "#444" }}>No scorebook games recorded yet.</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Full team box score from scorebook games</div>

            <ScopePills
              scopes={[["game", "Game"], ["tournament", "Tournament"], ["season", "Season"]]}
              active={teamScope}
              onChange={setTeamScope}
            />

            {teamScope === "game" && (
              <select value={teamGameId} onChange={e => setTeamGameId(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
                <option value="">Select game…</option>
                {sbGames.map(g => (
                  <option key={g.id} value={g.id}>vs {g.opponent} — {g.gameDate}</option>
                ))}
              </select>
            )}

            {teamScope === "tournament" && (
              <select value={teamTournId} onChange={e => setTeamTournId(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
                <option value="">Select tournament…</option>
                {sbTournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {teamScope === "season" && (
              <select value={teamYear} onChange={e => setTeamYear(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
                {(sbYears.length ? sbYears : [String(new Date().getFullYear())]).map(y => (
                  <option key={y} value={y}>{y} Season</option>
                ))}
              </select>
            )}

            {teamMsg && (
              <div style={{ fontSize: 13, color: T.green, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>{teamMsg}</div>
            )}

            <button onClick={doTeamPDF} style={{ ...exportBtnStyle(T.green), flex: "none", width: "100%" }}>
              Export Team PDF
            </button>
          </>
        )}
      </div>

      {/* ── Import ── */}
      <SectionLabel label="Import" color={T.green} />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Import a StatTracker JSON file and assign to a player</div>

        <input type="file" ref={fileInputRef} accept=".json" onChange={handleFileSelect} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} style={{
          width: "100%", background: "rgba(255,255,255,0.06)",
          color: "#aaa", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px",
          fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10,
        }}>{importData ? `${importData.games.length} games from ${importData.playerName}` : "Select JSON File…"}</button>

        {importData && (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Assign imported games to:</div>
            <select value={importPlayerId} onChange={e => setImportPlayerId(e.target.value)} style={{ fontSize: 14, marginBottom: 10 }}>
              <option value="">Select player…</option>
              {db.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doImport} disabled={!importPlayerId} style={{
                flex: 1,
                background: importPlayerId ? `linear-gradient(135deg, ${T.green}, #16a34a)` : "rgba(255,255,255,0.04)",
                color: importPlayerId ? "#fff" : "#444", border: "none", borderRadius: 10, padding: "12px",
                fontSize: 14, fontWeight: 700, cursor: importPlayerId ? "pointer" : "default",
              }}>Import</button>
              <button onClick={() => setImportData(null)} style={{
                background: "transparent", color: "#555", border: "1px solid #222",
                borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </>
        )}

        {importMsg && <div style={{ marginTop: 8, fontSize: 13, color: T.green, fontWeight: 700, textAlign: "center" }}>{importMsg}</div>}
      </div>

      <div style={{ height: 16 }} />
    </div>
  );
}
