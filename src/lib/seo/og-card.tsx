import { ImageResponse } from "next/og";
import { SCHOOL } from "@/lib/seo/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** Kartu pratinjau 1200x630 untuk WhatsApp, Facebook, X, dan Google Discover. */
export function ogCard({ title, kicker }: { title: string; kicker: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #064e3b 0%, #047857 55%, #10b981 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85, letterSpacing: 2, textTransform: "uppercase" }}>
          {kicker}
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 52 : 64, fontWeight: 700, lineHeight: 1.15 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 26, opacity: 0.9 }}>
          <span style={{ fontSize: 34, fontWeight: 700 }}>{SCHOOL.name}</span>
          <span>Jatijajar, Tapos, Kota Depok • sditfajar.sch.id</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
