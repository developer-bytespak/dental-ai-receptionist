import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AI dental receptionist demo: the call, the schedule and the compliance trail";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social preview card, drawn on the demo's own palette. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0e0812 0%, #1a0f22 60%, #24152f 100%)",
          color: "#f5f3f7",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #ff7ab8, #ff4fa0 55%, #c026d3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            R
          </div>
          <div style={{ fontSize: 28, color: "#a79bb0" }}>Riverside Family Dental · AI front desk</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>AI Dental Receptionist</div>
          <div style={{ fontSize: 34, color: "#ff7ab8" }}>HIPAA-aware. Books 24/7. Logs every step.</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#a79bb0" }}>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Live call</span>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Schedule</span>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Compliance trail</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
