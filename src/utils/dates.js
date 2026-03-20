export const todayStr = () => new Date().toISOString().slice(0, 10);

export const fmtGameDate = (g) => {
  const d = g.gameDate || g.date.slice(0, 10);
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const gameDate = (g) => g.gameDate || g.date.slice(0, 10);

export const fmtDateRange = (start, end) => {
  if (!start && !end) return null;
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!start) return fmt(end);
  if (!end) return fmt(start);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear())
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${e.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}`;
};
