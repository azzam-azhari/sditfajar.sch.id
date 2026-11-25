import { notFound } from "next/navigation";
import { getPublicNewsBySlug } from "@/lib/data/news";
import { OG_SIZE, ogCard } from "@/lib/seo/og-card";

export const alt = "Berita SDIT Fajar Depok";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function BeritaOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublicNewsBySlug(slug);
  if (!article) notFound();
  return ogCard({ title: article.title, kicker: `Berita • ${article.category}` });
}
