import { useState, useMemo } from "react";
import { T } from "../../utils/constants";
import { deriveBoxScore, deriveTeamStats, deriveOpponentStats } from "../../utils/scorebookEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, dec = 1) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(dec));
const pct = (made, att) => att > 0 ? ((made / att) * 100).toFixed(0) + "%" : "—";
const fmtDate = (str) => {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`;
};

// Derive per-player stats from db.games for the Players sub-view
const buildPlayerStats = (db) => {
  const map = {};
  for (const g of db.games) {
    const pid = g.playerId;
    if (!pid) continue;
    if (!map[pid]) map[pid] = { games: [], playerId: pid };
    map[pid].games.push(g);
  }
  // Also pull from finalized scorebookGames
  for (const sg of db.scorebookGames) {
    if (sg.status !== "finalized") continue;
    const box = deriveBoxScore(sg.events, sg.roster);
    for (const row of box) {
      const pid = row.playerId;
      if (!map[pid]) map[pid] = { games: [], playerId: pid };
      // Only add if not already present via generated individual game record
      const alreadyCounted = map[pid].games.some(g => g.scorebookGameId === sg.id);
      if (!alreadyCounted) {
        map[pid].games.push({
          id: `sb_${sg.id}_${pid}`,
          playerId: pid,
          gameDate: sg.gameDate,
          opponent: sg.opponent,
          tournamentId: sg.tournamentId,
          teamId: sg.teamId,
          stats: row.stats,
          points: row.stats.points,
          source: "scorebook",
          scorebookGameId: sg.id,
        });
      }
    }
  }
  return map;
};

// Derive combined game list for Games sub-view (deduplicates by scorebookGameId)
const buildGameList = (db) => {
  const list = [];
  const usedSbIds = new Set();

  // Finalized scorebook games take priority
  for (const sg of db.scorebookGames) {
    if (sg.status === "finalized") {
      usedSbIds.add(sg.id);
      const homeStats = deriveTeamStats(sg.events, sg.format);
      const oppStats  = deriveOpponentStats(sg.events, sg.format);
      list.push({
        _type: "scorebook",
        id: sg.id,
        gameDate: sg.gameDate,
        opponent: sg.opponent,
        tournamentId: sg.tournamentId,
        teamId: sg.teamId,
        phase: sg.phase,
        bracketName: sg.bracketName,
        round: sg.round,
        status: "final",
        homeScore: homeStats.score,
        oppScore: oppStats.score,
        sbGame: sg,
      });
    }
  }

  // Scheduled games
  for (const sg of db.scheduledGames || []) {
    // Skip if there's already a finalized scorebook game for this scheduled game
    const linked = db.scorebookGames.find(s => s.scheduledGameId === sg.id && s.status === "finalized");
    if (linked) continue;
    list.push({
      _type: "scheduled",
      id: sg.id,
      gameDate: sg.gameDate,
      opponent: sg.opponent,
      tournamentId: sg.tournamentId,
      teamId: sg.homeTeamId,
      phase: sg.phase,
      bracketName: sg.bracketName,
      round: sg.round,
      status: sg.status,
      homeScore: null,
      oppScore: null,
    });
  }

  // Individual tracker games (source=manual, not from scorebook)
  for (const g of db.games) {
    if (g.source === "scorebook" && g.scorebookGameId && usedSbIds.has(g.scorebookGameId)) continue;
    list.push({
      _type: "individual",
      id: g.id,
      gameDate: g.gameDate,
      opponent: g.opponent,
      tournamentId: g.tournamentId,
      teamId: g.teamId,
      phase: g.phase,
      bracketName: g.bracketName,
      round: g.round,
      status: "final",
      homeScore: g.points,
      oppScore: null,
      game: g,
    });
  }

  return list.sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterPills({ options, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onSelect(o.value)} style={{
          flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap",
          background: active === o.value ? "rgba(249,115,22,0.15)" : "transparent",
          border: `1px solid ${active === o.value ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)"}`,
          color: active === o.value ? T.orange : "#555",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function PhaseBadge({ phase, bracketName, round }) {
  if (!phase) return null;
  const isPool = phase === "pool";
  const text = isPool ? "Pool" : [bracketName, round].filter(Boolean).join(" · ") || "Bracket";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px",
      background: isPool ? "rgba(168,85,247,0.15)" : "rgba(245,158,11,0.15)",
      color: isPool ? "#a855f7" : "#F59E0B",
      border: `1px solid ${isPool ? "rgba(168,85,247,0.3)" : "rgba(245,158,11,0.3)"}`,
    }}>{text}</span>
  );
}

function StatusDot({ status }) {
  const color = status === "final" ? T.green : "#444";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

// ── Modal wrapper (faux viewport pattern — no position: fixed) ─────────────────
function Modal({ onClose, children }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div style={{
        background: "#12121f", borderRadius: "16px 16px 0 0",
        width: "100%", maxWidth: 600,
        maxHeight: "85vh", overflowY: "auto",
        padding: "20px 16px env(safe-area-inset-bottom, 16px)",
        border: `1px solid ${T.border}`, borderBottom: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalSheet({ onClose, title, children }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div style={{
        background: "#12121f", borderRadius: "16px 16px 0 0",
        width: "100%", maxWidth: 600,
        maxHeight: "85vh", overflowY: "auto",
        padding: "20px 16px env(safe-area-inset-bottom, 16px)",
        border: `1px solid ${T.border}`, borderBottom: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Games sub-view ─────────────────────────────────────────────────────────────
function GamesSubView({ db, setView }) {
  const [filter, setFilter] = useState("all");
  const [selectedGame, setSelectedGame] = useState(null);

  const allGames = useMemo(() => buildGameList(db), [db]);

  const pillOptions = useMemo(() => {
    const opts = [{ value: "all", label: "All" }];
    const sorted = [...db.tournaments].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    for (const t of sorted) opts.push({ value: t.id, label: t.name });
    opts.push({ value: "exhibition", label: "Exhibition" });
    return opts;
  }, [db.tournaments]);

  const filteredGames = useMemo(() => {
    if (filter === "all") return allGames;
    if (filter === "exhibition") return allGames.filter(g => !g.tournamentId);
    return allGames.filter(g => g.tournamentId === filter);
  }, [allGames, filter]);

  // Summary stats
  const finalGames = filteredGames.filter(g => g.status === "final" && g.homeScore != null && g.oppScore != null);
  const wins = finalGames.filter(g => g.homeScore > g.oppScore).length;
  const losses = finalGames.filter(g => g.homeScore < g.oppScore).length;
  const ppg = finalGames.length > 0 ? (finalGames.reduce((s, g) => s + (g.homeScore || 0), 0) / finalGames.length) : null;

  // Group by tournament
  const grouped = useMemo(() => {
    const groups = {};
    for (const g of filteredGames) {
      const key = g.tournamentId || "__exhibition__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    }
    return groups;
  }, [filteredGames]);

  const getTournamentLabel = (key) => {
    if (key === "__exhibition__") return { name: "Exhibition / Unlinked", location: "" };
    const t = db.tournaments.find(t => t.id === key);
    return t ? { name: t.name, location: t.location } : { name: "Unknown Tournament", location: "" };
  };

  // Order tournament groups: known tournaments first (by startDate desc), exhibition last
  const groupKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    const tourney = keys.filter(k => k !== "__exhibition__").sort((a, b) => {
      const ta = db.tournaments.find(t => t.id === a);
      const tb = db.tournaments.find(t => t.id === b);
      return (tb?.startDate || "").localeCompare(ta?.startDate || "");
    });
    if (grouped["__exhibition__"]) tourney.push("__exhibition__");
    return tourney;
  }, [grouped, db.tournaments]);

  return (
    <div>
      <FilterPills options={pillOptions} active={filter} onSelect={setFilter} />

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          [filteredGames.length, "Games"],
          [`${wins}-${losses}`, "W-L"],
          [ppg != null ? fmt(ppg) : "—", "PPG"],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{
            flex: 1, background: T.card, borderRadius: 12, padding: "10px 0",
            textAlign: "center",
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: "#fff" }}>{val}</div>
            <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", marginTop: 60, fontSize: 14 }}>No games found.</div>
      )}

      {groupKeys.map(key => {
        const { name, location } = getTournamentLabel(key);
        const games = grouped[key];
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            {/* Tournament group header */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ccc" }}>{name}</div>
              {location && <div style={{ fontSize: 11, color: "#444" }}>{location}</div>}
            </div>

            {games.map(g => {
              const win = g.homeScore != null && g.oppScore != null && g.homeScore > g.oppScore;
              const loss = g.homeScore != null && g.oppScore != null && g.homeScore < g.oppScore;
              const scoreColor = win ? T.green : loss ? T.red : "#555";
              const scoreText = (g.homeScore != null && g.oppScore != null)
                ? `${g.homeScore} - ${g.oppScore}`
                : null;
              return (
                <div key={g.id} onClick={() => setSelectedGame(g)} style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: "12px 14px", marginBottom: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <StatusDot status={g.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>vs {g.opponent}</span>
                      <PhaseBadge phase={g.phase} bracketName={g.bracketName} round={g.round} />
                    </div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{fmtDate(g.gameDate)}</div>
                  </div>
                  {scoreText && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 900, color: scoreColor, flexShrink: 0 }}>
                      {scoreText}
                    </div>
                  )}
                  {!scoreText && g.status !== "final" && (
                    <div style={{ fontSize: 11, color: "#333", fontWeight: 700, flexShrink: 0 }}>Scheduled</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {selectedGame && (
        <GameDetailModal game={selectedGame} db={db} onClose={() => setSelectedGame(null)} setView={setView} />
      )}
    </div>
  );
}

function GameDetailModal({ game, db, onClose, setView }) {
  const tournament = db.tournaments.find(t => t.id === game.tournamentId);

  // Box score from scorebook game
  let boxRows = null;
  if (game._type === "scorebook" && game.sbGame) {
    boxRows = deriveBoxScore(game.sbGame.events, game.sbGame.roster);
  }

  const team = db.teams.find(t => t.id === game.teamId);

  return (
    <ModalSheet title={`vs ${game.opponent}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>{fmtDate(game.gameDate)}</div>

      {tournament && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Tournament</span>
          <div style={{ fontSize: 13, color: T.orange, fontWeight: 600 }}>{tournament.name}</div>
        </div>
      )}

      {team && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Team</span>
          <div style={{ fontSize: 13, color: "#ccc" }}>{team.name}</div>
        </div>
      )}

      {(game.phase) && (
        <div style={{ marginBottom: 12 }}>
          <PhaseBadge phase={game.phase} bracketName={game.bracketName} round={game.round} />
        </div>
      )}

      {/* Score */}
      {game.homeScore != null && game.oppScore != null && (
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 12,
          padding: "12px 0", textAlign: "center", marginBottom: 16,
          display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 900, color: "#fff" }}>{game.homeScore}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" }}>Us</div>
          </div>
          <div style={{ color: "#333", fontSize: 20 }}>-</div>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 900, color: "#fff" }}>{game.oppScore}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" }}>Opp</div>
          </div>
        </div>
      )}

      {/* Box score */}
      {boxRows && boxRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>Box Score</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#555" }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700 }}>Player</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>PTS</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>REB</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>AST</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>STL</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>BLK</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>FG%</th>
                  <th style={{ padding: "4px 4px", textAlign: "center" }}>PF</th>
                </tr>
              </thead>
              <tbody>
                {boxRows.map(r => {
                  const reb = (r.stats.oreb || 0) + (r.stats.dreb || 0);
                  const fgPct = pct((r.stats.pts2 || 0) + (r.stats.pts3 || 0), (r.stats.pts2a || 0) + (r.stats.pts3a || 0));
                  return (
                    <tr key={r.playerId} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "6px 6px", color: "#ccc" }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: T.orange, fontSize: 11 }}>#{r.jerseyNumber}</span>
                        {" "}{r.name}
                      </td>
                      {[r.stats.points, reb, r.stats.ast, r.stats.stl, r.stats.blk, fgPct, r.stats.foul].map((v, i) => (
                        <td key={i} style={{ padding: "6px 4px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: "#888" }}>{v ?? 0}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual game stats (source=manual) */}
      {game._type === "individual" && game.game && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>Stats</div>
          {(() => {
            const s = game.game.stats;
            const reb = (s.oreb || 0) + (s.dreb || 0);
            return (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[
                  [game.game.points, "PTS"],
                  [reb, "REB"],
                  [s.ast, "AST"],
                  [s.stl, "STL"],
                  [s.blk, "BLK"],
                  [`${s.pts2 || 0}/${s.pts2a || 0}`, "2PT"],
                  [`${s.pts3 || 0}/${s.pts3a || 0}`, "3PT"],
                  [`${s.ft || 0}/${s.fta || 0}`, "FT"],
                ].map(([val, lbl]) => (
                  <div key={lbl} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 900, color: T.orange }}>{val ?? 0}</div>
                    <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Export button */}
      {game.status === "final" && (
        <button onClick={() => { setView("reports"); onClose(); }} style={{
          width: "100%", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700,
          background: "rgba(249,115,22,0.15)", color: T.orange,
          border: `1px solid rgba(249,115,22,0.4)`, cursor: "pointer", marginTop: 4,
        }}>Export →</button>
      )}
    </ModalSheet>
  );
}

// ── Players sub-view ──────────────────────────────────────────────────────────
function PlayersSubView({ db }) {
  const [teamFilter, setTeamFilter] = useState("all");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const playerStatsMap = useMemo(() => buildPlayerStats(db), [db]);

  const teamPills = useMemo(() => {
    const opts = [{ value: "all", label: "All" }];
    for (const t of db.teams) opts.push({ value: t.id, label: t.name });
    return opts;
  }, [db.teams]);

  const rows = useMemo(() => {
    return db.players
      .filter(p => {
        if (teamFilter === "all") return true;
        const team = db.teams.find(t => t.id === teamFilter);
        return team?.roster?.some(r => r.playerId === p.id);
      })
      .map(p => {
        const entry = playerStatsMap[p.id];
        const games = entry?.games || [];
        const gp = games.length;
        const pts = games.reduce((s, g) => s + (g.points || 0), 0);
        const reb = games.reduce((s, g) => s + (g.stats?.oreb || 0) + (g.stats?.dreb || 0), 0);
        const ast = games.reduce((s, g) => s + (g.stats?.ast || 0), 0);
        const fg2m = games.reduce((s, g) => s + (g.stats?.pts2 || 0), 0);
        const fg2a = games.reduce((s, g) => s + (g.stats?.pts2a || 0), 0);
        const fg3m = games.reduce((s, g) => s + (g.stats?.pts3 || 0), 0);
        const fg3a = games.reduce((s, g) => s + (g.stats?.pts3a || 0), 0);
        const fgPct = pct(fg2m + fg3m, fg2a + fg3a);

        const team = db.teams.find(t => t.roster?.some(r => r.playerId === p.id));
        return {
          player: p, team,
          gp, ppg: gp > 0 ? pts / gp : 0,
          rpg: gp > 0 ? reb / gp : 0,
          apg: gp > 0 ? ast / gp : 0,
          fgPct, games,
        };
      })
      .sort((a, b) => b.ppg - a.ppg);
  }, [db, teamFilter, playerStatsMap]);

  return (
    <div>
      <FilterPills options={teamPills} active={teamFilter} onSelect={setTeamFilter} />

      {rows.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", marginTop: 60, fontSize: 14 }}>No players found.</div>
      )}

      {rows.map(({ player, team, gp, ppg, rpg, apg, fgPct, games }) => {
        const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div key={player.id} onClick={() => setSelectedPlayer({ player, team, games })} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: "12px 14px", marginBottom: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#a855f7",
            }}>{initials}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 1 }}>{player.name}</div>
              <div style={{ fontSize: 11, color: "#444" }}>{team?.name || "Unassigned"}</div>
            </div>

            <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
              {[
                [fmt(ppg), "PPG"],
                [fmt(rpg), "RPG"],
                [fmt(apg), "APG"],
                [fgPct, "FG%"],
              ].map(([val, lbl]) => (
                <div key={lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#ccc" }}>{gp > 0 ? val : "—"}</div>
                  <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                </div>
              ))}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#ccc" }}>{gp}</div>
                <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>GP</div>
              </div>
            </div>
          </div>
        );
      })}

      {selectedPlayer && (
        <PlayerDetailModal {...selectedPlayer} db={db} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}

function PlayerDetailModal({ player, team, games, db, onClose }) {
  const sorted = [...games].sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));
  return (
    <ModalSheet title={player.name} onClose={onClose}>
      {team && <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>{team.name}</div>}

      {sorted.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", padding: "20px 0" }}>No game records.</div>
      )}

      {sorted.map(g => {
        const s = g.stats || {};
        const reb = (s.oreb || 0) + (s.dreb || 0);
        const fg2m = s.pts2 || 0; const fg2a = s.pts2a || 0;
        const fg3m = s.pts3 || 0; const fg3a = s.pts3a || 0;
        const fgPct = pct(fg2m + fg3m, fg2a + fg3a);
        const t = db.tournaments.find(t => t.id === g.tournamentId);
        return (
          <div key={g.id} style={{
            borderTop: `1px solid ${T.border}`, padding: "10px 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>vs {g.opponent}</div>
              <div style={{ fontSize: 11, color: "#444" }}>
                {fmtDate(g.gameDate)}{t ? ` · ${t.name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              {[
                [g.points, "PTS"],
                [reb, "REB"],
                [s.ast ?? 0, "AST"],
                [fgPct, "FG%"],
              ].map(([val, lbl]) => (
                <div key={lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "#888" }}>{val}</div>
                  <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </ModalSheet>
  );
}

// ── Teams sub-view ────────────────────────────────────────────────────────────
function TeamsSubView({ db }) {
  const [selectedTeam, setSelectedTeam] = useState(null);

  const teamCards = useMemo(() => {
    return db.teams.map(team => {
      const org = db.organizations.find(o => o.id === team.orgId);
      const sbGames = db.scorebookGames.filter(sg => sg.teamId === team.id && sg.status === "finalized");
      const gp = sbGames.length;

      let wins = 0, losses = 0, totalPts = 0, totalOppPts = 0;
      for (const sg of sbGames) {
        const homeStats = deriveTeamStats(sg.events, sg.format);
        const oppStats  = deriveOpponentStats(sg.events, sg.format);
        totalPts += homeStats.score;
        totalOppPts += oppStats.score;
        if (homeStats.score > oppStats.score) wins++;
        else if (homeStats.score < oppStats.score) losses++;
      }

      return { team, org, gp, wins, losses, ppg: gp > 0 ? totalPts / gp : 0, oppPpg: gp > 0 ? totalOppPts / gp : 0 };
    });
  }, [db]);

  return (
    <div>
      {teamCards.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", marginTop: 60, fontSize: 14 }}>No teams found.</div>
      )}

      {teamCards.map(({ team, org, gp, wins, losses, ppg, oppPpg }) => (
        <div key={team.id} onClick={() => setSelectedTeam({ team, org, gp, wins, losses, ppg, oppPpg })} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: "14px 16px", marginBottom: 10, cursor: "pointer",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{team.name}</div>
              {org && <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{org.name}</div>}
            </div>
            <div style={{ fontSize: 11, color: "#444", fontWeight: 700 }}>{gp} GP</div>
          </div>
          {gp > 0 && (
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              {[
                [`${wins}-${losses}`, "W-L"],
                [fmt(ppg), "PPG"],
                [fmt(oppPpg), "OPP PPG"],
              ].map(([val, lbl]) => (
                <div key={lbl}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: T.orange }}>{val}</div>
                  <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                </div>
              ))}
            </div>
          )}
          {gp === 0 && <div style={{ fontSize: 12, color: "#333", marginTop: 6 }}>No finalized games</div>}
        </div>
      ))}

      {selectedTeam && (
        <TeamDetailModal {...selectedTeam} db={db} onClose={() => setSelectedTeam(null)} />
      )}
    </div>
  );
}

function TeamDetailModal({ team, org, gp, wins, losses, ppg, oppPpg, db, onClose }) {
  // Build per-player season averages from finalized scorebook games for this team
  const rosterStats = useMemo(() => {
    const sbGames = db.scorebookGames.filter(sg => sg.teamId === team.id && sg.status === "finalized");
    const playerMap = {};
    for (const sg of sbGames) {
      const box = deriveBoxScore(sg.events, sg.roster);
      for (const row of box) {
        if (!playerMap[row.playerId]) {
          const p = db.players.find(p => p.id === row.playerId);
          playerMap[row.playerId] = { player: p, name: row.name, jersey: row.jerseyNumber, gp: 0, pts: 0, reb: 0, ast: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
        }
        const acc = playerMap[row.playerId];
        acc.gp++;
        acc.pts += row.stats.points || 0;
        acc.reb += (row.stats.oreb || 0) + (row.stats.dreb || 0);
        acc.ast += row.stats.ast || 0;
        acc.fg2m += row.stats.pts2 || 0;
        acc.fg2a += row.stats.pts2a || 0;
        acc.fg3m += row.stats.pts3 || 0;
        acc.fg3a += row.stats.pts3a || 0;
      }
    }
    return Object.values(playerMap).sort((a, b) => (b.pts / (b.gp || 1)) - (a.pts / (a.gp || 1)));
  }, [team, db]);

  return (
    <ModalSheet title={team.name} onClose={onClose}>
      {org && <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>{org.name}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          [`${wins}-${losses}`, "Record"],
          [fmt(ppg), "PPG"],
          [fmt(oppPpg), "OPP PPG"],
          [gp, "GP"],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{
            flex: 1, background: T.card, borderRadius: 10, padding: "8px 0",
            textAlign: "center",
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 900, color: "#fff" }}>{val}</div>
            <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{lbl}</div>
          </div>
        ))}
      </div>

      {rosterStats.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", padding: "16px 0" }}>No finalized game stats.</div>
      )}

      {rosterStats.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#555" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700 }}>Player</th>
                <th style={{ textAlign: "center", padding: "4px 4px" }}>GP</th>
                <th style={{ textAlign: "center", padding: "4px 4px" }}>PPG</th>
                <th style={{ textAlign: "center", padding: "4px 4px" }}>RPG</th>
                <th style={{ textAlign: "center", padding: "4px 4px" }}>APG</th>
                <th style={{ textAlign: "center", padding: "4px 4px" }}>FG%</th>
              </tr>
            </thead>
            <tbody>
              {rosterStats.map(r => (
                <tr key={r.player?.id || r.name} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 6px", color: "#ccc" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", color: T.orange, fontSize: 11 }}>#{r.jersey}</span>
                    {" "}{r.name}
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 4px", fontFamily: "'DM Mono',monospace", color: "#888" }}>{r.gp}</td>
                  <td style={{ textAlign: "center", padding: "6px 4px", fontFamily: "'DM Mono',monospace", color: "#888" }}>{fmt(r.pts / r.gp)}</td>
                  <td style={{ textAlign: "center", padding: "6px 4px", fontFamily: "'DM Mono',monospace", color: "#888" }}>{fmt(r.reb / r.gp)}</td>
                  <td style={{ textAlign: "center", padding: "6px 4px", fontFamily: "'DM Mono',monospace", color: "#888" }}>{fmt(r.ast / r.gp)}</td>
                  <td style={{ textAlign: "center", padding: "6px 4px", fontFamily: "'DM Mono',monospace", color: "#888" }}>{pct(r.fg2m + r.fg3m, r.fg2a + r.fg3a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalSheet>
  );
}

// ── Main HistoryView ──────────────────────────────────────────────────────────
export default function HistoryView({ db, setView }) {
  const [subView, setSubView] = useState("games");

  const subBtn = (val, label) => (
    <button key={val} onClick={() => setSubView(val)} style={{
      flex: 1, padding: "10px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: subView === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${subView === val ? "rgba(249,115,22,0.4)" : T.border}`,
      color: subView === val ? T.orange : "#666",
    }}>{label}</button>
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>History</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {subBtn("games", "Games")}
        {subBtn("players", "Players")}
        {subBtn("teams", "Teams")}
      </div>

      {subView === "games"   && <GamesSubView db={db} setView={setView} />}
      {subView === "players" && <PlayersSubView db={db} />}
      {subView === "teams"   && <TeamsSubView db={db} />}
    </div>
  );
}
