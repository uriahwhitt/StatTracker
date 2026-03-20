export const defaultStats = () => ({
  pts2: 0, pts2a: 0, pts3: 0, pts3a: 0, ft: 0, fta: 0,
  oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0,
});

export const calcPoints = (s) => s.pts2 * 2 + s.pts3 * 3 + s.ft;

export const pct = (m, a) => a > 0 ? `${Math.round((m / a) * 100)}%` : "—";

export const sumStats = (games) => {
  const totals = defaultStats();
  games.forEach(g => Object.keys(totals).forEach(k => totals[k] += g.stats[k] || 0));
  return { ...totals, points: games.reduce((a, g) => a + g.points, 0) };
};
