import { cacheLife, cacheTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ArticleItem {
  slug: string;
  title: string;
  category: "Prestasi" | "Kegiatan" | "Pengumuman" | "Akademik";
  date: string;
  /** ISO date untuk SEO (sitemap, schema). Kosong pada artikel statis. */
  publishedAt?: string;
  author: string;
  excerpt: string;
  coverUrl?: string;
}

export interface DetailArticleItem {
  title: string;
  category: "Prestasi" | "Kegiatan" | "Pengumuman" | "Akademik";
  date: string;
  /** ISO date untuk SEO (sitemap, schema). Kosong pada artikel statis. */
  publishedAt?: string;
  author: string;
  content: string[];
  tags: string[];
}

/**
 * Mengambil daftar berita publik terbit dengan caching Next.js 16.
 */
export async function getPublicNewsList(): Promise<ArticleItem[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('news');

  try {
    // Admin client: RLS profiles hanya untuk authenticated, anon tak bisa baca nama penulis.
    const supabase = createAdminClient();
    const { data: dbPosts, error } = await supabase
      .from('news_posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        cover_url,
        status,
        published_at,
        profiles (
          name
        )
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error || !dbPosts || dbPosts.length === 0) {
      return [];
    }

    return dbPosts.map((post): ArticleItem => {
      const profObj = post.profiles as unknown;
      const authorName = Array.isArray(profObj)
        ? (profObj[0] as { name?: string })?.name
        : (profObj as { name?: string })?.name;

      return {
        slug: post.slug,
        title: post.title,
        category: "Kegiatan",
        date: post.published_at
          ? new Date(post.published_at).toLocaleDateString("id-ID", { dateStyle: "medium" })
          : "Terbaru",
        author: authorName || "Humas SDIT Fajar",
        publishedAt: post.published_at ?? undefined,
        coverUrl: post.cover_url ?? undefined,
        excerpt: post.excerpt || "Warta terbaru dari publikasi resmi SDIT Fajar.",
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengambil detail berita publik berdasarkan slug dengan caching Next.js 16.
 */
export async function getPublicNewsBySlug(slug: string): Promise<DetailArticleItem | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('news', `news:${slug}`);

  try {
    // Admin client: RLS profiles hanya untuk authenticated, anon tak bisa baca nama penulis.
    const supabase = createAdminClient();
    const { data: dbPost, error } = await supabase
      .from('news_posts')
      .select(`
        id,
        title,
        slug,
        content,
        published_at,
        profiles (
          name
        )
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (!error && dbPost) {
      const profileData = dbPost.profiles as unknown;
      const authorName = Array.isArray(profileData)
        ? (profileData[0] as { name?: string })?.name
        : (profileData as { name?: string })?.name;

      return {
        title: dbPost.title,
        category: "Kegiatan",
        date: dbPost.published_at
          ? new Date(dbPost.published_at).toLocaleDateString("id-ID", { dateStyle: "full" })
          : "Terbaru",
        author: authorName || "Humas SDIT Fajar",
        publishedAt: dbPost.published_at ?? undefined,
        content: dbPost.content.split(/\n\n+/),
        tags: ["SDIT Fajar", "Warta Resmi", "Pendidikan"],
      };
    }
  } catch {
    // Fallback below
  }

  return null;
}
