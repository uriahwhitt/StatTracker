import { useState } from "react";
import { T } from "../../utils/constants";
import PeopleView from "./PeopleView";
import ScheduleView from "./ScheduleView";

export default function ManageView({ db, updateDb, user, userRole, isSuperadminUser }) {
  const [segment, setSegment] = useState("people");

  const segBtn = (val, label) => (
    <button key={val} onClick={() => setSegment(val)} style={{
      flex: 1, padding: "10px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: segment === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${segment === val ? "rgba(249,115,22,0.4)" : T.border}`,
      color: segment === val ? T.orange : "#666",
    }}>{label}</button>
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Manage</div>

      {/* Segment toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {segBtn("people", "People")}
        {segBtn("schedule", "Schedule")}
      </div>

      {segment === "people" && <PeopleView db={db} updateDb={updateDb} user={user} userRole={userRole} isSuperadminUser={isSuperadminUser} />}
      {segment === "schedule" && <ScheduleView db={db} updateDb={updateDb} user={user} userRole={userRole} />}
    </div>
  );
}
