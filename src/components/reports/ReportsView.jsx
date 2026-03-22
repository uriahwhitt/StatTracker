import { useState, useMemo } from "react";
import { T } from "../../utils/constants";
import {
  exportPlayerGamePDF,
  exportPlayerMultiGamePDF,
  exportTeamGamePDF,
  exportTeamMultiGamePDF,
} from "../../utils/pdfExport";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (str) => {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`;
};

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function ScopeBtn({ val, active, onSelect, children }) {
  return (
    <button onClick={() => onSelect(val)} style={{
      flex: 1, padding: "10px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: active === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active === val ? "rgba(249,115,22,0.4)" : T.border}`,
      color: active === val ? T.orange : "#666",
    }}>{children}</button>
  );
}

function TimeRangePills({ range, setRange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {["all", "season", "tournament", "daterange"].map(v => (
        <button key={v} onClick={() => setRange(v)} style={{
          padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap",
          background: range === v ? "rgba(249,115,22,0.15)" : "transparent",
          border: `1px solid ${range === v ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)"}`,
          color: range === v ? T.orange : "#555",
        }}>{v === "all" ? "All" : v === "season" ? "Season" : v === "tournament" ? "Tournament" : "Date Range"}</button>
      ))}
    </div>
  );
}

function ExportBtn({ label, color = T.orange, onClick, disabled }) {
  const bg = color === T.green ? "rgba(34,197,94,0.15)" : color === T.blue ? "rgba(59,130,246,0.15)" : "rgba(249,115,22,0.15)";
  const border = color === T.green ? "rgba(34,197,94,0.4)" : color === T.blue ? "rgba(59,130,246,0.4)" : "rgba(249,115,22,0.4)";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700,
      background: disabled ? "rgba(255,255,255,0.04)" : bg,
      color: disabled ? "#333" : color,
      border: `1px solid ${disabled ? T.border : border}`,
      cursor: disabled ? "default" : "pointer", marginBottom: 8,
    }}>{label}</button>
  );
}

function SectionLabel({ label }) {
  return (
    <div style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, marginTop: 16 }}>
      {label}
    </div>
  );
}

// ── Player Scope ──────────────────────────────────────────────────────────────
function PlayerScope({ db }) {
  const [playerId, setPlayerId] = useState(db.players[0]?.id || "");
  const [range, setRange] = useState("all");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tournamentId, setTournamentId] = useState("");
  const [dateStart, setDateStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateEnd, setDateEnd]   = useState(new Date().toISOString().slice(0, 10));

  const player = db.players.find(p => p.id === playerId);

  const filteredGames = useMemo(() => {
    if (!playerId) return [];
    let games = db.games.filter(g => g.playerId === playerId);
    if (range === "season") {
      games = games.filter(g => (g.gameDate || "").startsWith(year));
    } else if (range === "tournament") {
      games = games.filter(g => g.tournamentId === tournamentId);
    } else if (range === "daterange") {
      games = games.filter(g => (g.gameDate || "") >= dateStart && (g.gameDate || "") <= dateEnd);
    }
    return games.sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));
  }, [db.games, playerId, range, year, tournamentId, dateStart, dateEnd]);

  const scopeLabel = () => {
    if (range === "season") return `${year} Season`;
    if (range === "tournament") {
      const t = db.tournaments.find(t => t.id === tournamentId);
      return t ? t.name : "Tournament";
    }
    if (range === "daterange") return `${fmtDate(dateStart)} – ${fmtDate(dateEnd)}`;
    return "All Games";
  };

  const handlePlayerPdf = () => {
    if (!player || filteredGames.length === 0) return;
    const tournament = range === "tournament" ? db.tournaments.find(t => t.id === tournamentId) : null;
    if (filteredGames.length === 1) {
      exportPlayerGamePDF(filteredGames[0], player, tournament);
    } else {
      exportPlayerMultiGamePDF(filteredGames, player, scopeLabel(), tournament);
    }
  };

  const handleJson = () => {
    if (!player || filteredGames.length === 0) return;
    downloadJson(
      { player, games: filteredGames, exportedAt: new Date().toISOString() },
      `stattracker-${player.name.replace(/\s+/g, "-").toLowerCase()}.json`
    );
  };

  return (
    <div>
      <SectionLabel label="Player" />
      <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
        <option value="">— Select player —</option>
        {db.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <SectionLabel label="Time Range" />
      <TimeRangePills range={range} setRange={setRange} />

      {range === "season" && (
        <input type="number" value={year} min="2000" max="2099" onChange={e => setYear(e.target.value)}
          style={{ marginBottom: 12, fontSize: 14, width: 120 }} />
      )}
      {range === "tournament" && (
        <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
          <option value="">— Select tournament —</option>
          {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {range === "daterange" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ flex: 1, fontSize: 14 }} />
          <input type="date" value={dateEnd}   onChange={e => setDateEnd(e.target.value)}   style={{ flex: 1, fontSize: 14 }} />
        </div>
      )}

      {/* Result count */}
      {playerId && (
        <div style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>
          {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""} in scope
        </div>
      )}

      <SectionLabel label="Export" />
      <ExportBtn
        label={`Player PDF (${filteredGames.length} game${filteredGames.length !== 1 ? "s" : ""})`}
        onClick={handlePlayerPdf}
        disabled={!player || filteredGames.length === 0}
      />
      <ExportBtn
        label="JSON Export"
        color={T.blue}
        onClick={handleJson}
        disabled={!player || filteredGames.length === 0}
      />
    </div>
  );
}

// ── Team Scope ────────────────────────────────────────────────────────────────
function TeamScope({ db }) {
  const [teamId, setTeamId]           = useState(db.teams[0]?.id || "");
  const [range, setRange]             = useState("all");
  const [tournamentId, setTournamentId] = useState("");
  const [dateStart, setDateStart]     = useState(`${new Date().getFullYear()}-01-01`);
  const [dateEnd, setDateEnd]         = useState(new Date().toISOString().slice(0, 10));
  const [boxGameId, setBoxGameId]     = useState("");

  const team = db.teams.find(t => t.id === teamId);

  const filteredSbGames = useMemo(() => {
    if (!teamId) return [];
    let games = db.scorebookGames.filter(sg => sg.teamId === teamId && sg.status === "finalized");
    if (range === "tournament") {
      games = games.filter(sg => sg.tournamentId === tournamentId);
    } else if (range === "daterange") {
      games = games.filter(sg => (sg.gameDate || "") >= dateStart && (sg.gameDate || "") <= dateEnd);
    }
    return games.sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));
  }, [db.scorebookGames, teamId, range, tournamentId, dateStart, dateEnd]);

  const scopeLabel = () => {
    if (range === "tournament") {
      const t = db.tournaments.find(t => t.id === tournamentId);
      return t ? t.name : "Tournament";
    }
    if (range === "daterange") return `${fmtDate(dateStart)} – ${fmtDate(dateEnd)}`;
    return "All Games";
  };

  const selectedBoxGame = db.scorebookGames.find(sg => sg.id === boxGameId);

  // Orgs grouped for team select
  const orgsWithTeams = useMemo(() => {
    return db.organizations.map(org => ({
      org,
      teams: db.teams.filter(t => t.orgId === org.id),
    })).filter(g => g.teams.length > 0);
  }, [db.organizations, db.teams]);

  const handleTeamReportPdf = () => {
    if (!team || filteredSbGames.length === 0) return;
    const tournament = range === "tournament" ? db.tournaments.find(t => t.id === tournamentId) : null;
    exportTeamMultiGamePDF(filteredSbGames, scopeLabel(), tournament, db);
  };

  const handleBoxScorePdf = () => {
    if (!selectedBoxGame) return;
    exportTeamGamePDF(selectedBoxGame, db);
  };

  const handlePlayerProfilesPdf = () => {
    if (!team || filteredSbGames.length === 0) return;
    // Get all activated players across filtered games
    const playerIds = new Set();
    for (const sg of filteredSbGames) {
      for (const r of sg.roster || []) playerIds.add(r.playerId);
    }
    const tournament = range === "tournament" ? db.tournaments.find(t => t.id === tournamentId) : null;
    for (const pid of playerIds) {
      const player = db.players.find(p => p.id === pid);
      if (!player) continue;
      const playerGames = db.games.filter(g => g.playerId === pid && filteredSbGames.some(sg => sg.generatedGameIds?.includes(g.id) || g.scorebookGameId === sg.id));
      if (playerGames.length === 0) continue;
      exportPlayerMultiGamePDF(playerGames, player, scopeLabel(), tournament);
    }
  };

  const handleJson = () => {
    if (!team) return;
    downloadJson(
      { team, scorebookGames: filteredSbGames, exportedAt: new Date().toISOString() },
      `stattracker-team-${team.name.replace(/\s+/g, "-").toLowerCase()}.json`
    );
  };

  return (
    <div>
      <SectionLabel label="Team" />
      <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
        <option value="">— Select team —</option>
        {orgsWithTeams.map(({ org, teams }) => (
          <optgroup key={org.id} label={org.name}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        ))}
        {db.teams.filter(t => !db.organizations.some(o => o.id === t.orgId)).map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <SectionLabel label="Time Range" />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["all", "tournament", "daterange"].map(v => (
          <button key={v} onClick={() => setRange(v)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
            background: range === v ? "rgba(249,115,22,0.15)" : "transparent",
            border: `1px solid ${range === v ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)"}`,
            color: range === v ? T.orange : "#555",
          }}>{v === "all" ? "All" : v === "tournament" ? "Tournament" : "Date Range"}</button>
        ))}
      </div>

      {range === "tournament" && (
        <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
          <option value="">— Select tournament —</option>
          {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {range === "daterange" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ flex: 1, fontSize: 14 }} />
          <input type="date" value={dateEnd}   onChange={e => setDateEnd(e.target.value)}   style={{ flex: 1, fontSize: 14 }} />
        </div>
      )}

      {teamId && (
        <div style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>
          {filteredSbGames.length} finalized game{filteredSbGames.length !== 1 ? "s" : ""} in scope
        </div>
      )}

      {/* Box score game selector */}
      <SectionLabel label="Box Score Game (single game exports)" />
      <select value={boxGameId} onChange={e => setBoxGameId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
        <option value="">— Select a game —</option>
        {filteredSbGames.map(sg => (
          <option key={sg.id} value={sg.id}>
            vs {sg.opponent} · {sg.gameDate}
          </option>
        ))}
      </select>

      <SectionLabel label="Export" />
      <ExportBtn
        label={`Team Report PDF (${filteredSbGames.length} games)`}
        onClick={handleTeamReportPdf}
        disabled={!team || filteredSbGames.length === 0}
      />
      <ExportBtn
        label="Box Score PDF"
        color={T.green}
        onClick={handleBoxScorePdf}
        disabled={!selectedBoxGame}
      />
      <ExportBtn
        label="Player Profiles PDF (one page per player)"
        onClick={handlePlayerProfilesPdf}
        disabled={!team || filteredSbGames.length === 0}
      />
      <ExportBtn
        label="JSON Export"
        color={T.blue}
        onClick={handleJson}
        disabled={!team}
      />
    </div>
  );
}

// ── Game Scope ────────────────────────────────────────────────────────────────
function GameScope({ db }) {
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [gameId, setGameId] = useState("");

  const availableGames = useMemo(() => {
    let games = db.scorebookGames.filter(sg => sg.status === "finalized");
    if (tournamentFilter) games = games.filter(sg => sg.tournamentId === tournamentFilter);
    return games.sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));
  }, [db.scorebookGames, tournamentFilter]);

  const selectedGame = db.scorebookGames.find(sg => sg.id === gameId);

  const handleBoxScorePdf = () => {
    if (!selectedGame) return;
    exportTeamGamePDF(selectedGame, db);
  };

  return (
    <div>
      <SectionLabel label="Filter by Tournament (optional)" />
      <select value={tournamentFilter} onChange={e => { setTournamentFilter(e.target.value); setGameId(""); }} style={{ marginBottom: 12, fontSize: 14 }}>
        <option value="">— All tournaments —</option>
        {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <SectionLabel label="Game" />
      <select value={gameId} onChange={e => setGameId(e.target.value)} style={{ marginBottom: 12, fontSize: 14 }}>
        <option value="">— Select a game —</option>
        {availableGames.map(sg => {
          const team = db.teams.find(t => t.id === sg.teamId);
          return (
            <option key={sg.id} value={sg.id}>
              {team ? `${team.name} ` : ""}vs {sg.opponent} · {sg.gameDate}
            </option>
          );
        })}
      </select>

      {availableGames.length === 0 && (
        <div style={{ fontSize: 12, color: "#333", marginBottom: 12 }}>No finalized scorebook games found.</div>
      )}

      <SectionLabel label="Export" />
      <ExportBtn
        label="Box Score PDF"
        color={T.green}
        onClick={handleBoxScorePdf}
        disabled={!selectedGame}
      />
    </div>
  );
}

// ── Main ReportsView ──────────────────────────────────────────────────────────
export default function ReportsView({ db }) {
  const [scope, setScope] = useState("player");

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Reports</div>

      {/* Scope selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <ScopeBtn val="player" active={scope} onSelect={setScope}>Player</ScopeBtn>
        <ScopeBtn val="team"   active={scope} onSelect={setScope}>Team</ScopeBtn>
        <ScopeBtn val="game"   active={scope} onSelect={setScope}>Game</ScopeBtn>
      </div>

      {scope === "player" && <PlayerScope db={db} />}
      {scope === "team"   && <TeamScope   db={db} />}
      {scope === "game"   && <GameScope   db={db} />}
    </div>
  );
}
