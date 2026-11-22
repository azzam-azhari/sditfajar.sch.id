import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";
import { getPublicNewsList } from "@/lib/data/news";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pendaftaran", priority: 0.9, changeFrequency: "daily" },
  { path: "/profil", priority: 0.8, changeFrequency: "monthly" },
  { path: "/kurikulum", priority: 0.8, changeFrequency: "monthly" },
  { path: "/kontak", priority: 0.8, changeFrequency: "monthly" },
  { path: "/ekstrakurikuler", priority: 0.7, changeFrequency: "monthly" },
  { path: "/berita", priority: 0.7, changeFrequency: "daily" },
  { path: "/profil/sejarah", priority: 0.6, changeFrequency: "monthly" },
  { path: "/profil/manajemen", priority: 0.6, changeFrequency: "monthly" },
  { path: "/pendaftaran/status", priority: 0.5, changeFrequency: "monthly" },
  { path: "/marketplace", priority: 0.5, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const news = await getPublicNewsList();
  const latestNews = news.find((n) => n.publishedAt)?.publishedAt;

  const pages: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    // Hanya beri lastModified bila benar-benar diketahui; tanggal palsu membuat Google mengabaikannya.
    ...(r.path === "/berita" && latestNews ? { lastModified: new Date(latestNews) } : {}),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const articles: MetadataRoute.Sitemap = news.map((n) => ({
    url: `${SITE_URL}/berita/${n.slug}`,
    ...(n.publishedAt ? { lastModified: new Date(n.publishedAt) } : {}),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...pages, ...articles];
}
