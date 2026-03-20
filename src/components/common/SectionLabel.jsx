export default function SectionLabel({ label, color }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color, textTransform: "uppercase", marginTop: 20, marginBottom: 10, paddingLeft: 2 }}>{label}</div>;
}
