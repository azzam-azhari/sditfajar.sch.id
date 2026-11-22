import { SCHOOL } from "@/lib/seo/site";
import { OG_SIZE, ogCard } from "@/lib/seo/og-card";

export const alt = `${SCHOOL.name} — ${SCHOOL.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogCard({ title: SCHOOL.tagline, kicker: "Sekolah Dasar Islam Terpadu" });
}
