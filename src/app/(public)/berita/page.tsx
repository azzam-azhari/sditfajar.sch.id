import { pageMeta } from "@/lib/seo/site";
import * as React from "react";
import Link from "next/link";
import { Calendar, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { getPublicNewsList } from "@/lib/data/news";

export const metadata = pageMeta({
  title: "Berita & Pengumuman Sekolah",
  description:
    "Kabar terkini SDIT Fajar Depok: kegiatan murid, prestasi tahfidz dan akademik, agenda sekolah, serta pengumuman resmi SPMB.",
  path: "/berita",
});

export const instant = false;

/** Jumlah kartu arsip per halaman (berita utama hanya tampil di halaman 1). */
const PAGE_SIZE = 9;

export default async function BeritaPage(props: { searchParams: Promise<{ halaman?: string }> }) {
  const { halaman } = await props.searchParams;
  const displayArticles = await getPublicNewsList();
  const archive = displayArticles.slice(1);
  const totalPages = Math.max(1, Math.ceil(archive.length / PAGE_SIZE));
  const requested = Number.parseInt(halaman ?? "1", 10);
  const currentPage = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), totalPages) : 1;
  const featured = currentPage === 1 ? displayArticles[0] : undefined;
  const regular = archive.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageHref = (page: number) => (page <= 1 ? "/berita" : `/berita?halaman=${page}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      <PageHeader
        title="Warta & Informasi Sekolah"
        badge="Kabar SDIT Fajar"
        description="Dokumentasi agenda kegiatan santri, prestasi tahfidz dan sains, sosialisasi program kurikulum, serta pengumuman resmi kelembagaan."
      />

      {/* Featured Headline */}
      {featured && (
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="Utama" variant="success" />
                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {featured.date}
                </span>
                <span className="text-xs text-muted-foreground">• Oleh {featured.author}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground hover:text-primary transition-colors">
                <Link href={`/berita/${featured.slug}`}>
                  {featured.title}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {featured.excerpt}
              </p>
              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link href={`/berita/${featured.slug}`} className="flex items-center gap-1.5">
                    <span>Baca Selengkapnya</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-4 flex items-center justify-center p-8 rounded-xl border border-border/60 bg-muted/20">
              <div className="text-center space-y-2">
                <div className="size-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl font-mono">
                  SDIT
                </div>
                <div className="text-xs font-semibold text-foreground">Warta Resmi Sekolah</div>
                <div className="text-[11px] text-muted-foreground">Kabar terpercaya SDIT Fajar</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Grid Berita Lainnya */}
      <section className="space-y-6">
        <h3 className="text-lg font-bold tracking-tight text-foreground border-b border-border/80 pb-3">
          Arsip Berita & Agenda Terkini
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regular.map((article) => (
            <article
              key={article.slug}
              className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 hover:border-primary/50 transition-colors shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>{article.category}</span>
                  <span>{article.date}</span>
                </div>
                <h4 className="text-base font-semibold tracking-tight text-foreground hover:text-primary transition-colors">
                  <Link href={`/berita/${article.slug}`}>
                    {article.title}
                  </Link>
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {article.excerpt}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{article.author}</span>
                <Link
                  href={`/berita/${article.slug}`}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <span>Baca</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Navigasi halaman berita" className="flex items-center justify-between gap-3 border-t border-border/80 pt-5">
            {currentPage > 1 ? (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href={pageHref(currentPage - 1)} rel="prev">
                  <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <ol className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <li key={page}>
                  <Link
                    href={pageHref(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-mono transition-colors ${
                      page === currentPage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/80 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {page}
                  </Link>
                </li>
              ))}
            </ol>
            {currentPage < totalPages ? (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href={pageHref(currentPage + 1)} rel="next">
                  Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
