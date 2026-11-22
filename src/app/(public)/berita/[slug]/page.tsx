import * as React from "react";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft, ArrowRight, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/common/status-badge";
import { getPublicNewsBySlug, getPublicNewsList } from "@/lib/data/news";
import { ShareButton } from "../_components/share-button";
import { pageMeta, absoluteUrl, SITE_URL } from "@/lib/seo/site";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";

// Slug dibaca dari URL; render memblokir sampai data artikel tersedia (pola sama dengan halaman dinamis lain).
export const instant = false;

interface DetailBeritaPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DetailBeritaPageProps) {
  const { slug } = await params;
  const article = await getPublicNewsBySlug(slug);
  return pageMeta({
    title: article.title,
    description: summarize(article.content[0] || "Warta resmi kegiatan dan prestasi SDIT Fajar Depok."),
    path: `/berita/${slug}`,
    type: "article",
    publishedTime: article.publishedAt,
    authors: [article.author],
  });
}

function summarize(text: string, max = 158): string {
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default async function DetailBeritaPage({ params }: DetailBeritaPageProps) {
  const { slug } = await params;
  const [article, allNews] = await Promise.all([getPublicNewsBySlug(slug), getPublicNewsList()]);
  const otherNews = allNews.filter((n) => n.slug !== slug).slice(0, 5);
  const wordCount = article.content.join(" ").split(/\s+/).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const [lead, ...body] = article.content;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: summarize(lead ?? ""),
            mainEntityOfPage: absoluteUrl(`/berita/${slug}`),
            image: absoluteUrl("/opengraph-image"),
            ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
            author: { "@type": "Person", name: article.author },
            publisher: { "@id": `${SITE_URL}/#school` },
            inLanguage: "id-ID",
          },
          breadcrumbSchema([
            { name: "Beranda", path: "/" },
            { name: "Berita", path: "/berita" },
            { name: article.title, path: `/berita/${slug}` },
          ]),
        ]}
      />
      <Breadcrumb className="mb-8">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Beranda</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/berita">Berita</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
            <BreadcrumbPage className="max-w-xs truncate">{article.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Artikel */}
        <article className="min-w-0 lg:col-span-8">
          <header className="space-y-5 border-b border-border/80 pb-6">
            <StatusBadge status={article.category} variant="info" />
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(article.author) || "SF"}
                </span>
                <span className="font-medium text-foreground">{article.author}</span>
              </div>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {article.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readMinutes} menit baca
              </span>
            </div>
          </header>

          <div className="space-y-5 py-8 text-base leading-8 text-foreground/90">
            {lead && <p className="text-lg leading-8 text-foreground">{lead}</p>}
            {body.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          <footer className="space-y-5 border-t border-border/80 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                <Link href="/berita">
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Indeks Berita
                </Link>
              </Button>
              <ShareButton title={article.title} />
            </div>
          </footer>
        </article>

        {/* Berita lainnya */}
        <aside className="lg:col-span-4">
          <div className="rounded-xl border border-border/80 bg-card shadow-xs lg:sticky lg:top-24">
            <div className="flex items-center gap-2 border-b border-border/80 px-5 py-4">
              <Newspaper className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Berita Lainnya</h2>
            </div>
            {otherNews.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {otherNews.map((news) => (
                  <li key={news.slug}>
                    <Link
                      href={`/berita/${news.slug}`}
                      className="group block space-y-1.5 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
                        {news.category}
                      </span>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {news.title}
                      </h3>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {news.date}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada berita lain.</p>
            )}
            <div className="border-t border-border/80 p-4">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/berita">
                  Lihat Semua Berita
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
