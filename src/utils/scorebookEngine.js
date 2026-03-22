// ── Scorebook Event-Sourcing Engine ──────────────────────────────────────────
// Pure functions — no React, no side effects. All stats derived from event replay.

export const createEvent = (type, period, playerId = null, extras = {}) => ({
  id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  timestamp: new Date().toISOString(),
  period,
  type,
  playerId,
  linkedEventId: null,
  deleted: false,
  ...extras,
});

const activeEvents = (events) => events.filter(e => !e.deleted);

// ── Foul group helper ─────────────────────────────────────────────────────────
// "quarter" → each period is its own group (resets every quarter)
// "half" (default) → Q1+Q2 = group 1, Q3+Q4 = group 2
const getFoulGroup = (period, format) => {
  if (format?.foulResetPeriod === "quarter") return period;
  const halfSize = Math.floor((format?.periods || 2) / 2);
  return period <= halfSize ? 1 : 2;
};

// ── Player Stats ─────────────────────────────────────────────────────────────
export const derivePlayerStats = (events, playerId) => {
  const stats = {
    pts2: 0, pts2a: 0, pts3: 0, pts3a: 0, ft: 0, fta: 0,
    oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0, techFoul: 0,
  };

  for (const e of activeEvents(events)) {
    if (e.playerId !== playerId) continue;
    switch (e.type) {
      case "2pt_made": stats.pts2++; stats.pts2a++; break;
      case "2pt_missed": stats.pts2a++; break;
      case "3pt_made": stats.pts3++; stats.pts3a++; break;
      case "3pt_missed": stats.pts3a++; break;
      case "ft_made": stats.ft++; stats.fta++; break;
      case "ft_missed": stats.fta++; break;
      case "oreb": stats.oreb++; break;
      case "dreb": stats.dreb++; break;
      case "assist": stats.ast++; break;
      case "steal": stats.stl++; break;
      case "block": stats.blk++; break;
      case "turnover": stats.tov++; break;
      case "personal_foul": stats.foul++; break;
      case "technical_foul": stats.techFoul++; break;
    }
  }

  stats.points = stats.pts2 * 2 + stats.pts3 * 3 + stats.ft;
  return stats;
};

// ── Team Stats (Home) ─────────────────────────────────────────────────────────
// displayPeriod: the period currently being displayed (for foul reset scoping).
// Defaults to getCurrentPeriod(events) if not passed — maintains backward compat.
export const deriveTeamStats = (events, format, displayPeriod) => {
  const active = activeEvents(events);
  let score = 0;
  const foulsByGroup = {};

  const currentPer = displayPeriod != null ? displayPeriod : getCurrentPeriod(events);
  const currentGroup = getFoulGroup(currentPer, format);

  for (const e of active) {
    switch (e.type) {
      case "2pt_made": score += 2; break;
      case "3pt_made": score += 3; break;
      case "ft_made": score += 1; break;
      case "personal_foul":
      case "technical_foul":
      case "team_tech_foul": {
        const p = e.period || 1;
        const group = getFoulGroup(p, format);
        const foulVal = (e.type === "technical_foul" || e.type === "team_tech_foul") ? 2 : 1;
        foulsByGroup[group] = (foulsByGroup[group] || 0) + foulVal;
        break;
      }
    }
  }

  const teamFouls = foulsByGroup[currentGroup] || 0;
  return { score, teamFouls, foulsByGroup };
};

// ── Opponent Stats ────────────────────────────────────────────────────────────
// displayPeriod: period for foul reset scoping (same half-group logic as home).
export const deriveOpponentStats = (events, format, displayPeriod) => {
  const active = activeEvents(events);
  let score = 0;

  const currentPer = displayPeriod != null ? displayPeriod : getCurrentPeriod(events);
  const currentGroup = getFoulGroup(currentPer, format);
  let fouls = 0;

  for (const e of active) {
    switch (e.type) {
      case "opp_score_1": score += 1; break;
      case "opp_score_2": score += 2; break;
      case "opp_score_3": score += 3; break;
      case "opp_foul":
        if (getFoulGroup(e.period || 1, format) === currentGroup) fouls++;
        break;
      case "opp_tech_foul":
        if (getFoulGroup(e.period || 1, format) === currentGroup) fouls += 2;
        break;
    }
  }

  return { score, fouls };
};

// ── Timeout tracking ──────────────────────────────────────────────────────────
// displayPeriod: counts only timeouts used in the same half-group as displayPeriod.
// Resets each half (or each quarter if foulResetPeriod === "quarter").
export const deriveTimeouts = (events, format, displayPeriod) => {
  const active = activeEvents(events);

  const currentPer = displayPeriod != null ? displayPeriod : getCurrentPeriod(events);
  const currentGroup = getFoulGroup(currentPer, format);

  const homeUsed = active.filter(
    e => e.type === "timeout_home" && getFoulGroup(e.period || 1, format) === currentGroup
  ).length;
  const awayUsed = active.filter(
    e => e.type === "timeout_away" && getFoulGroup(e.period || 1, format) === currentGroup
  ).length;

  // Backward compat: timeoutsPerHalf takes precedence, fall back to homeTimeouts
  const timeoutsPerHalf = format?.timeoutsPerHalf ?? format?.homeTimeouts ?? 5;

  return {
    homeUsed,
    awayUsed,
    homeRemaining: timeoutsPerHalf - homeUsed,
    awayRemaining: timeoutsPerHalf - awayUsed,
  };
};

// ── Active Players (replay substitutions) ─────────────────────────────────────
export const getActivePlayers = (events, initialFive) => {
  let current = [...initialFive];
  for (const e of activeEvents(events)) {
    if (e.type === "substitution_out" && e.replacedById) {
      const idx = current.indexOf(e.playerId);
      if (idx !== -1) current[idx] = e.replacedById;
    }
  }
  return current;
};

// ── Activated Players (ever on court) ─────────────────────────────────────────
export const getActivatedPlayers = (events, initialFive) => {
  const activated = new Set(initialFive);
  for (const e of activeEvents(events)) {
    if (e.type === "substitution_in") activated.add(e.playerId);
  }
  return [...activated];
};

// ── Current Period ────────────────────────────────────────────────────────────
// Reads the period from the latest period_change OR period_start event by timestamp.
export const getCurrentPeriod = (events) => {
  const relevant = activeEvents(events).filter(
    e => e.type === "period_start" || e.type === "period_change"
  );
  if (relevant.length === 0) return 1;
  const latest = relevant.reduce((a, b) =>
    new Date(a.timestamp) >= new Date(b.timestamp) ? a : b
  );
  return latest.period;
};

// ── Full Box Score ────────────────────────────────────────────────────────────
export const deriveBoxScore = (events, roster) => {
  return roster.map(r => ({
    ...r,
    stats: derivePlayerStats(events, r.playerId),
  }));
};

// ── Format Event for Display ──────────────────────────────────────────────────
export const formatEventDescription = (event, roster) => {
  const player = roster.find(r => r.playerId === event.playerId);
  const tag = player ? `#${player.jerseyNumber} ${player.name}` : "";

  const labels = {
    "2pt_made": `${tag} — 2PT Made`,
    "2pt_missed": `${tag} — 2PT Miss`,
    "3pt_made": `${tag} — 3PT Made`,
    "3pt_missed": `${tag} — 3PT Miss`,
    "ft_made": `${tag} — FT Made`,
    "ft_missed": `${tag} — FT Miss`,
    "oreb": `${tag} — Off Rebound`,
    "dreb": `${tag} — Def Rebound`,
    "assist": `${tag} — Assist`,
    "steal": `${tag} — Steal`,
    "block": `${tag} — Block`,
    "turnover": `${tag} — Turnover`,
    "personal_foul": `${tag} — Foul`,
    "technical_foul": `${tag} — Tech Foul`,
    "substitution_in": `${tag} — Subbed In`,
    "substitution_out": `${tag} — Subbed Out`,
    "opp_score_1": "Opponent +1 (FT)",
    "opp_score_2": "Opponent +2 (FG)",
    "opp_score_3": "Opponent +3 (3PT)",
    "opp_foul": "Opponent Foul",
    "opp_tech_foul": "Opponent Tech Foul",
    "team_tech_foul": "Team Tech Foul (Bench/Coach)",
    "timeout_home": "Home Timeout",
    "timeout_away": "Away Timeout",
    "period_start": `Period ${event.period} Start`,
    "period_end": `Period ${event.period} End`,
    "period_change": `Period ${event.period}`,
  };

  return labels[event.type] || event.type;
};

// ── Convert to Individual Game Record ─────────────────────────────────────────
export const convertToIndividualGame = (scorebookGame, playerId) => {
  const stats = derivePlayerStats(scorebookGame.events, playerId);
  return {
    id: `sb_gen_${scorebookGame.id}_${playerId}_${Date.now()}`,
    date: scorebookGame.createdAt,
    gameDate: scorebookGame.gameDate,
    opponent: scorebookGame.opponent,
    tournamentId: scorebookGame.tournamentId || null,
    playerId,
    stats: {
      pts2: stats.pts2,
      pts2a: stats.pts2a,
      pts3: stats.pts3,
      pts3a: stats.pts3a,
      ft: stats.ft,
      fta: stats.fta,
      oreb: stats.oreb,
      dreb: stats.dreb,
      ast: stats.ast,
      stl: stats.stl,
      blk: stats.blk,
      tov: stats.tov,
      foul: stats.foul,
    },
    points: stats.points,
    source: "scorebook",
    scorebookGameId: scorebookGame.id,
  };
};
