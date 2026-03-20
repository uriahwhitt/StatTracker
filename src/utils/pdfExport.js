import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  deriveBoxScore,
  derivePlayerStats,
  deriveTeamStats,
  deriveOpponentStats,
} from "./scorebookEngine";
import { sumStats } from "./stats";

// ── Brand / Theme ─────────────────────────────────────────────────────────────
const BRAND = "StatTracker  ·  Whitt's End, LLC";
const C = {
  orange:   [249, 115,  22],
  blue:     [ 59, 130, 246],
  green:    [ 34, 197,  94],
  white:    [255, 255, 255],
  mid:      [110, 110, 130],
  rowDark:  [ 18,  18,  30],
  rowAlt:   [ 26,  26,  42],
  totRow:   [ 38,  38,  58],
  bg:       [  8,   8,  16],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const slug   = (s) => (s || "export").replace(/\s+/g, "-").toLowerCase();
const shot   = (m, a) => `${m}/${a}`;
const pct    = (m, a) => a > 0 ? `${Math.round((m / a) * 100)}%` : "—";
const avgFmt = (v, n) => n > 0 ? (v / n).toFixed(1) : "—";
const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function initDoc() {
  return new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  // letter landscape: 792 × 612 pt
}

// Returns the Y position where table content should start
function drawHeader(doc, title, subtitle, metaLines = []) {
  const W = doc.internal.pageSize.width;

  // Left: brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.orange);
  doc.text("StatTracker", 40, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.mid);
  doc.text("Whitt's End, LLC", 40, 51);

  // Right: report title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text(title, W - 40, 36, { align: "right" });

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.mid);
    doc.text(subtitle, W - 40, 49, { align: "right" });
  }

  let metaY = subtitle ? 61 : 49;
  doc.setFontSize(9);
  for (const line of metaLines) {
    doc.text(line, W - 40, metaY, { align: "right" });
    metaY += 11;
  }

  // Divider
  const dividerY = Math.max(58, metaY + 2);
  doc.setDrawColor(...C.orange);
  doc.setLineWidth(0.75);
  doc.line(40, dividerY, W - 40, dividerY);

  return dividerY + 10;
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mid);
    doc.text(`${BRAND}  ·  Generated ${todayLabel()}`, 40, H - 18);
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, W - 40, H - 18, { align: "right" });
    }
  }
}

// Shared autoTable style defaults
function tableStyles(headColor = C.orange) {
  return {
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: C.white,
      fillColor: C.rowDark,
      halign: "center",
      cellPadding: 4,
      lineColor: [60, 60, 80],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: headColor,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
      lineColor: C.white,
      lineWidth: 0.5,
    },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin: { left: 40, right: 40 },
  };
}

// Highlight totals / averages rows
function totalsRowStyle(data, rows, totalRows = 1) {
  const lastN = rows.length - totalRows;
  if (data.row.index >= lastN) {
    data.cell.styles.fontStyle = "bold";
    data.cell.styles.fillColor = C.totRow;
    data.cell.styles.textColor =
      data.row.index === rows.length - 1 ? C.green : C.orange;
  }
}

// ── 1. Individual Player — Single Game ────────────────────────────────────────
export function exportPlayerGamePDF(game, player, tournament) {
  const doc   = initDoc();
  const s     = game.stats;
  const reb   = (s.oreb || 0) + (s.dreb || 0);

  const meta = [];
  if (tournament) meta.push(`Tournament: ${tournament.name}`);
  meta.push(`Game Date: ${game.gameDate}`);

  const startY = drawHeader(doc, player.name, `vs. ${game.opponent}`, meta);

  const cols = ["PTS", "2PM/A", "2P%", "3PM/A", "3P%", "FTM/A", "FT%", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TO", "PF"];
  const row  = [
    game.points,
    shot(s.pts2, s.pts2a), pct(s.pts2, s.pts2a),
    shot(s.pts3, s.pts3a), pct(s.pts3, s.pts3a),
    shot(s.ft,   s.fta),   pct(s.ft,   s.fta),
    s.oreb, s.dreb, reb,
    s.ast, s.stl, s.blk, s.tov, s.foul,
  ];

  autoTable(doc, {
    ...tableStyles(C.orange),
    startY,
    head: [cols],
    body: [row],
  });

  drawFooter(doc);
  doc.save(`stattracker-${slug(player.name)}-vs-${slug(game.opponent)}-${game.gameDate}.pdf`);
}

// ── 2. Individual Player — Multi-Game (Tournament / Season / All) ─────────────
export function exportPlayerMultiGamePDF(games, player, scopeLabel, tournament) {
  if (!games.length) return;
  const doc = initDoc();

  const meta = [];
  if (tournament) meta.push(`Tournament: ${tournament.name}`);
  meta.push(`${games.length} game${games.length !== 1 ? "s" : ""}`);

  const startY = drawHeader(doc, player.name, scopeLabel, meta);

  const rows = games.map((g) => {
    const s = g.stats;
    const reb = (s.oreb || 0) + (s.dreb || 0);
    return [
      g.gameDate,
      `vs. ${g.opponent}`,
      g.points,
      shot(s.pts2, s.pts2a),
      shot(s.pts3, s.pts3a),
      shot(s.ft,   s.fta),
      reb,
      s.ast, s.stl, s.blk, s.tov, s.foul,
    ];
  });

  const totals = sumStats(games);
  const totReb = (totals.oreb || 0) + (totals.dreb || 0);
  const n = games.length;

  rows.push([
    "TOTALS", "",
    totals.points,
    shot(totals.pts2, totals.pts2a),
    shot(totals.pts3, totals.pts3a),
    shot(totals.ft,   totals.fta),
    totReb,
    totals.ast, totals.stl, totals.blk, totals.tov, totals.foul,
  ]);
  rows.push([
    "AVG", "",
    avgFmt(totals.points, n),
    `${avgFmt(totals.pts2, n)}/${avgFmt(totals.pts2a, n)}`,
    `${avgFmt(totals.pts3, n)}/${avgFmt(totals.pts3a, n)}`,
    `${avgFmt(totals.ft,   n)}/${avgFmt(totals.fta,   n)}`,
    avgFmt(totReb, n),
    avgFmt(totals.ast, n), avgFmt(totals.stl, n),
    avgFmt(totals.blk, n), avgFmt(totals.tov, n), avgFmt(totals.foul, n),
  ]);

  autoTable(doc, {
    ...tableStyles(C.blue),
    startY,
    head: [["Date", "Opponent", "PTS", "2PM/A", "3PM/A", "FT/A", "REB", "AST", "STL", "BLK", "TO", "PF"]],
    body: rows,
    columnStyles: { 0: { halign: "left" }, 1: { halign: "left", cellWidth: 110 } },
    didParseCell: (data) => totalsRowStyle(data, rows, 2),
  });

  drawFooter(doc);
  doc.save(`stattracker-${slug(player.name)}-${slug(scopeLabel)}.pdf`);
}

// ── 3. Team — Single Scorebook Game (Box Score) ───────────────────────────────
export function exportTeamGamePDF(sbGame, db) {
  const doc        = initDoc();
  const team       = db.teams.find((t) => t.id === sbGame.teamId);
  const org        = db.organizations.find((o) => o.id === sbGame.orgId);
  const tournament = sbGame.tournamentId
    ? db.tournaments.find((t) => t.id === sbGame.tournamentId)
    : null;

  const teamLabel  = [org?.name, team?.name].filter(Boolean).join(" — ") || "Team";
  const teamScore  = deriveTeamStats(sbGame.events, sbGame.format).score;
  const oppScore   = deriveOpponentStats(sbGame.events).score;

  const meta = [];
  if (tournament) meta.push(`Tournament: ${tournament.name}`);
  meta.push(`${sbGame.gameDate}  ·  Final: ${teamScore} – ${oppScore}`);

  const startY = drawHeader(doc, `${teamLabel} vs. ${sbGame.opponent}`, `Game Report - ${sbGame.opponent}`, meta);

  const boxScore = deriveBoxScore(sbGame.events, sbGame.roster)
    .sort((a, b) => (a.jerseyNumber || 999) - (b.jerseyNumber || 999));

  const sumCol = (key) => boxScore.reduce((acc, r) => acc + (r.stats[key] || 0), 0);

  const rows = boxScore.map((r) => {
    const s = r.stats;
    const reb = (s.oreb || 0) + (s.dreb || 0);
    return [
      r.jerseyNumber ?? "",
      r.name,
      s.points,
      shot(s.pts2, s.pts2a),
      shot(s.pts3, s.pts3a),
      shot(s.ft,   s.fta),
      s.oreb, s.dreb, reb,
      s.ast, s.stl, s.blk, s.tov, s.foul,
    ];
  });

  const tOreb = sumCol("oreb");
  const tDreb = sumCol("dreb");
  const tPts2 = sumCol("pts2"); const tPts2a = sumCol("pts2a");
  const tPts3 = sumCol("pts3"); const tPts3a = sumCol("pts3a");
  const tFt   = sumCol("ft");   const tFta   = sumCol("fta");

  rows.push([
    "", "TOTALS",
    teamScore,
    shot(tPts2, tPts2a),
    shot(tPts3, tPts3a),
    shot(tFt,   tFta),
    tOreb, tDreb, tOreb + tDreb,
    sumCol("ast"), sumCol("stl"), sumCol("blk"), sumCol("tov"), sumCol("foul"),
  ]);

  autoTable(doc, {
    ...tableStyles(C.orange),
    startY,
    head: [
      [
        { content: "#",      rowSpan: 2, styles: { valign: "middle" } },
        { content: "Player", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
        { content: "Scoring",   colSpan: 4, styles: { halign: "center" } },
        { content: "Rebounds",  colSpan: 3, styles: { halign: "center" } },
        { content: "Secondary", colSpan: 3, styles: { halign: "center" } },
        { content: "Penalty",   colSpan: 2, styles: { halign: "center" } },
      ],
      ["PTS", "2PM/A", "3PM/A", "FT/A", "Off", "Def", "Tot", "AST", "STL", "BLK", "TO", "PF"],
    ],
    body: rows,
    columnStyles: {
      0: { cellWidth: 26 },
      1: { halign: "left", cellWidth: 115 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.row.index === 0) {
        data.cell.styles.fillColor  = [30, 18, 8];
        data.cell.styles.textColor  = C.orange;
        data.cell.styles.fontSize   = 8;
        data.cell.styles.lineColor  = C.white;
        data.cell.styles.lineWidth  = 0.5;
      }
      totalsRowStyle(data, rows, 1);
    },
  });

  drawFooter(doc);
  doc.save(`stattracker-game-report-vs-${slug(sbGame.opponent)}-${sbGame.gameDate}.pdf`);
}

// ── 4. Team — Tournament or Season (Aggregate Box Score) ──────────────────────
export function exportTeamMultiGamePDF(sbGames, scopeLabel, tournament, db) {
  if (!sbGames.length) return;
  const doc       = initDoc();
  const firstGame = sbGames[0];
  const team      = db.teams.find((t) => t.id === firstGame.teamId);
  const org       = db.organizations.find((o) => o.id === firstGame.orgId);
  const teamLabel = [org?.name, team?.name].filter(Boolean).join(" — ") || "Team";

  const meta = [];
  if (tournament) meta.push(`Tournament: ${tournament.name}`);
  meta.push(`${sbGames.length} game${sbGames.length !== 1 ? "s" : ""}`);

  const startY = drawHeader(doc, teamLabel, scopeLabel, meta);

  // Merge roster and accumulate stats across all games
  const playerMap = {};
  for (const g of sbGames) {
    for (const r of g.roster) {
      if (!playerMap[r.playerId]) {
        playerMap[r.playerId] = {
          ...r, gameCount: 0,
          pts: 0, pts2: 0, pts2a: 0, pts3: 0, pts3a: 0,
          ft: 0, fta: 0, oreb: 0, dreb: 0,
          ast: 0, stl: 0, blk: 0, tov: 0, foul: 0,
        };
      }
      const s = derivePlayerStats(g.events, r.playerId);
      const p = playerMap[r.playerId];
      p.gameCount++;
      p.pts   += s.points;
      p.pts2  += s.pts2;  p.pts2a += s.pts2a;
      p.pts3  += s.pts3;  p.pts3a += s.pts3a;
      p.ft    += s.ft;    p.fta   += s.fta;
      p.oreb  += s.oreb;  p.dreb  += s.dreb;
      p.ast   += s.ast;   p.stl   += s.stl;
      p.blk   += s.blk;   p.tov   += s.tov;
      p.foul  += s.foul;
    }
  }

  const players = Object.values(playerMap)
    .sort((a, b) => (a.jerseyNumber || 999) - (b.jerseyNumber || 999));

  const rows = players.map((p) => {
    const reb = p.oreb + p.dreb;
    const n   = p.gameCount;
    return [
      p.jerseyNumber ?? "",
      p.name,
      p.pts,         avgFmt(p.pts, n),
      shot(p.pts2,   p.pts2a),
      shot(p.pts3,   p.pts3a),
      shot(p.ft,     p.fta),
      reb,           avgFmt(reb, n),
      p.ast,         avgFmt(p.ast, n),
      p.stl, p.blk, p.tov, p.foul,
    ];
  });

  autoTable(doc, {
    ...tableStyles(C.blue),
    startY,
    head: [
      [
        { content: "#",      rowSpan: 2, styles: { valign: "middle" } },
        { content: "Player", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
        { content: "Scoring",   colSpan: 5, styles: { halign: "center" } },
        { content: "Rebounds",  colSpan: 2, styles: { halign: "center" } },
        { content: "Secondary", colSpan: 4, styles: { halign: "center" } },
        { content: "Penalty",   colSpan: 2, styles: { halign: "center" } },
      ],
      ["PTS", "PPG", "2PM/A", "3PM/A", "FT/A", "Tot", "RPG", "AST", "APG", "STL", "BLK", "TO", "PF"],
    ],
    body: rows,
    columnStyles: {
      0: { cellWidth: 26 },
      1: { halign: "left", cellWidth: 115 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.row.index === 0) {
        data.cell.styles.fillColor  = [8, 18, 38];
        data.cell.styles.textColor  = C.blue;
        data.cell.styles.fontSize   = 8;
        data.cell.styles.lineColor  = C.white;
        data.cell.styles.lineWidth  = 0.5;
      }
    },
  });

  drawFooter(doc);
  doc.save(`stattracker-team-${slug(scopeLabel)}.pdf`);
}
