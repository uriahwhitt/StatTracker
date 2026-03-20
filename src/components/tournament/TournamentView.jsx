import { useState } from "react";
import { T, circBtn, backBtn } from "../../utils/constants";
import { fmtGameDate, fmtDateRange } from "../../utils/dates";
import { pct, sumStats } from "../../utils/stats";
import StatSummary from "../common/StatSummary";

export default function TournamentView({
  db, updateDb, tournamentGames,
  selectedTournament, setSelectedTournament,
  confirmDelete, setConfirmDelete, confirmAndDelete,
  setView, setSelectedGame,
}) {
  const [newTournament, setNewTournament] = useState("");
  const [tournStartDate, setTournStartDate] = useState("");
  const [tournEndDate, setTournEndDate] = useState("");
  const [editingTournament, setEditingTournament] = useState(false);
  const [editTournName, setEditTournName] = useState("");
  const [editTournStart, setEditTournStart] = useState("");
  const [editTournEnd, setEditTournEnd] = useState("");

  const addTournament = () => {
    const name = newTournament.trim();
    if (!name) return;
    updateDb({
      ...db, tournaments: [...db.tournaments, {
        id: Date.now().toString(), name,
        date: new Date().toISOString(),
        startDate: tournStartDate || null,
        endDate: tournEndDate || null,
      }]
    });
    setNewTournament("");
    setTournStartDate("");
    setTournEndDate("");
  };

  const saveTournamentEdits = () => {
    if (!selectedTournament) return;
    const updatedTournaments = db.tournaments.map(t =>
      t.id === selectedTournament.id ? {
        ...t,
        name: editTournName.trim() || t.name,
        startDate: editTournStart || null,
        endDate: editTournEnd || null,
      } : t
    );
    updateDb({ ...db, tournaments: updatedTournaments });
    const updated = updatedTournaments.find(t => t.id === selectedTournament.id);
    setSelectedTournament(updated);
    setEditingTournament(false);
  };

  // Tournament list
  if (!selectedTournament) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Tournaments</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="New tournament name…" value={newTournament} onChange={e => setNewTournament(e.target.value)} onKeyDown={e => e.key === "Enter" && addTournament()} />
          <button onClick={addTournament} style={{ ...circBtn(T.orange, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input type="date" value={tournStartDate} onChange={e => setTournStartDate(e.target.value)} style={{ fontSize: 13 }} />
          <input type="date" value={tournEndDate} onChange={e => setTournEndDate(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        {db.tournaments.length === 0 && (
          <div style={{ color: "#333", textAlign: "center", marginTop: 60, fontSize: 15 }}>No tournaments yet.<br />Add one above 🏆</div>
        )}
        {db.tournaments.map(t => {
          const tg = tournamentGames(t.id);
          const tot = sumStats(tg);
          const dateRange = fmtDateRange(t.startDate, t.endDate);
          return (
            <div key={t.id} onClick={() => setSelectedTournament(t)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: 16 }}>🏆 {t.name}</div>
              {dateRange && <div style={{ fontSize: 12, color: T.orange, marginTop: 2 }}>{dateRange}</div>}
              <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{tg.length} game{tg.length !== 1 ? "s" : ""}</div>
              {tg.length > 0 && (
                <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                  {[
                    [(tot.points / tg.length).toFixed(1), "PPG", T.orange],
                    [((tot.oreb + tot.dreb) / tg.length).toFixed(1), "RPG", T.green],
                    [(tot.ast / tg.length).toFixed(1), "APG", T.blue],
                    [pct(tot.pts2 + tot.pts3, tot.pts2a + tot.pts3a), "FG%", "#a855f7"],
                  ].map(([val, lbl, col]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: col, fontFamily: "'DM Mono',monospace" }}>{val}</div>
                      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Tournament detail
  const tg = tournamentGames(selectedTournament.id);
  const tot = sumStats(tg);
  const dateRange = fmtDateRange(selectedTournament.startDate, selectedTournament.endDate);

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => { setSelectedTournament(null); setEditingTournament(false); }} style={backBtn}>← Tournaments</button>

      {editingTournament ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tournament Name</div>
          <input value={editTournName} onChange={e => setEditTournName(e.target.value)} style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Start Date</div>
              <input type="date" value={editTournStart} onChange={e => setEditTournStart(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>End Date</div>
              <input type="date" value={editTournEnd} onChange={e => setEditTournEnd(e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveTournamentEdits} style={{ flex: 1, background: T.orange, border: "none", color: "#fff", borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditingTournament(false)} style={{ background: "transparent", border: "1px solid #333", color: "#555", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4 }}>🏆 {selectedTournament.name}</div>
              {dateRange && <div style={{ fontSize: 13, color: T.orange, marginTop: 2 }}>{dateRange}</div>}
            </div>
            <button onClick={() => {
              setEditingTournament(true);
              setEditTournName(selectedTournament.name);
              setEditTournStart(selectedTournament.startDate || "");
              setEditTournEnd(selectedTournament.endDate || "");
            }} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 6 }}>Edit</button>
          </div>
        </>
      )}

      <div style={{ fontSize: 13, color: "#444", marginBottom: 16 }}>{tg.length} games · per-game averages</div>
      <StatSummary stats={tot} points={tot.points} gamesPlayed={tg.length} showAvg />
      {tg.length > 0 && (
        <>
          <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Game Log</div>
          {tg.map(g => (
            <div key={g.id} onClick={() => { setView("history"); setSelectedGame(g); setSelectedTournament(null); }} style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
              display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
            }}>
              <div>
                <div style={{ fontWeight: 600, color: "#ddd", fontSize: 14 }}>vs {g.opponent}</div>
                <div style={{ fontSize: 11, color: "#444" }}>{fmtGameDate(g)}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 900, color: T.orange }}>{g.points}</div>
            </div>
          ))}
        </>
      )}

      {confirmDelete?.type === "tournament" && confirmDelete.id === selectedTournament.id ? (
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={confirmAndDelete} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
          <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete({ type: "tournament", id: selectedTournament.id, label: selectedTournament.name })} style={{
          marginTop: 16, width: "100%", background: "rgba(239,68,68,0.08)", color: T.red,
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "12px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Delete Tournament</button>
      )}
    </div>
  );
}
