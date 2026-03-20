import { useState } from "react";
import { T, pillBtn } from "../../utils/constants";
import { fmtGameDate, gameDate, todayStr } from "../../utils/dates";
import { sumStats } from "../../utils/stats";
import StatSummary from "../common/StatSummary";
import SectionLabel from "../common/SectionLabel";

export default function ReportsView({ activePlayer, playerGames, db, setView, setSelectedGame }) {
  const [reportStart, setReportStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [reportEnd, setReportEnd] = useState(todayStr);
  const [reportShowGames, setReportShowGames] = useState(false);

  const filtered = playerGames.filter(g => { const d = gameDate(g); return d >= reportStart && d <= reportEnd; });
  const tot = sumStats(filtered);
  const totalPts = filtered.reduce((a, g) => a + g.points, 0);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>
        {activePlayer?.name ? `${activePlayer.name}'s Reports` : "Reports"}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>From</div>
          <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} style={{ fontSize: 14 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>To</div>
          <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} style={{ fontSize: 14 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(() => {
          const yr = new Date().getFullYear();
          return [
            [`${yr} Season`, `${yr}-01-01`, `${yr}-12-31`],
            [`${yr - 1} Season`, `${yr - 1}-01-01`, `${yr - 1}-12-31`],
            ["All Time", "2000-01-01", `${yr}-12-31`],
          ].map(([label, s, e]) => (
            <button key={label} onClick={() => { setReportStart(s); setReportEnd(e); }} style={pillBtn(reportStart === s && reportEnd === e)}>{label}</button>
          ));
        })()}
      </div>

      <div style={{
        background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
        borderRadius: 14, padding: "14px 16px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'DM Mono',monospace" }}>{filtered.length}</div>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase" }}>Games</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.orange, fontFamily: "'DM Mono',monospace" }}>{totalPts}</div>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase" }}>Total Pts</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.orange, fontFamily: "'DM Mono',monospace" }}>
            {filtered.length > 0 ? (totalPts / filtered.length).toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase" }}>PPG</div>
        </div>
      </div>

      {filtered.length > 0 && (
        <>
          <SectionLabel label="Per-Game Averages" color={T.green} />
          <StatSummary stats={tot} points={totalPts} gamesPlayed={filtered.length} showAvg />
          <SectionLabel label="Totals" color={T.orange} />
          <StatSummary stats={tot} points={totalPts} />

          <button onClick={() => setReportShowGames(!reportShowGames)} style={{
            marginTop: 16, width: "100%", background: "rgba(255,255,255,0.04)", color: "#888",
            border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>{reportShowGames ? "Hide Games" : `Show Games (${filtered.length})`}</button>

          {reportShowGames && (
            <div style={{ marginTop: 12 }}>
              {filtered.map(g => {
                const t = db.tournaments.find(x => x.id === g.tournamentId);
                return (
                  <div key={g.id} onClick={() => { setView("history"); setSelectedGame(g); }} style={{
                    background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                    display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#ddd", fontSize: 14 }}>vs {g.opponent}</div>
                      <div style={{ fontSize: 11, color: "#444" }}>{fmtGameDate(g)}</div>
                      {t && <div style={{ fontSize: 10, color: T.orange, marginTop: 2, fontWeight: 600 }}>🏆 {t.name}</div>}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 900, color: T.orange }}>{g.points}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {filtered.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", marginTop: 50, fontSize: 15 }}>No games in this date range.</div>
      )}
    </div>
  );
}
