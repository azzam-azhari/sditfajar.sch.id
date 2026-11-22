import { pageMeta } from "@/lib/seo/site";
﻿import * as React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { formatRupiah, getPublishedProducts } from "@/lib/data/marketplace";

export const metadata = pageMeta({
  title: "Marketplace Buku & Seragam Sekolah",
  description:
    "Katalog resmi buku panduan tahfidz, seragam, modul kurikulum, dan perlengkapan murid SDIT Fajar Depok.",
  path: "/marketplace",
});

export default async function MarketplacePage() {
  const products = await getPublishedProducts();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      
      <PageHeader
        title="Marketplace & Perlengkapan Sekolah"
        badge="Etalase Resmi"
        description="Penyediaan buku panduan tahfidz, seragam, modul ajar, dan atribut resmi SDIT Fajar untuk kemudahan murid dan wali murid."
      />

      {/* Info Alur Fulfillment */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Info className="h-5 w-5" />
          <span>Ketentuan Pembelian & Pengambilan Produk:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              <span>Produk Fisik (Buku & Seragam)</span>
            </div>
            <p>
              Pemesanan diinisiasi oleh wali murid via portal pembayaran, kemudian barang diambil langsung di Koperasi Sekolah SDIT Fajar (Pick-up mandiri) dengan menunjukkan bukti pembayaran.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Download className="h-4 w-4 text-primary" />
              <span>Produk Digital (E-Book & Modul)</span>
            </div>
            <p>
              Setelah pembayaran diverifikasi petugas keuangan sekolah, tautan unduhan berkas PDF otomatis aktif di dashboard akun wali murid.
            </p>
          </div>
        </div>
      </section>

      {/* Grid Katalog Produk (dari database) */}
      {products.length === 0 ? (
        <EmptyState title="Katalog belum tersedia" description="Produk sekolah akan tampil di sini setelah dipublikasikan admin." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="group rounded-xl border border-border/80 bg-card p-5 space-y-4 transition-all hover:border-foreground/20 hover:shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                {product.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.cover_url} alt={product.title} className="h-40 w-full rounded-lg border border-border/60 object-cover" />
                )}
                <div className="flex items-center justify-between text-xs">
                  <StatusBadge status={product.product_type === "digital" ? "Digital (Unduh)" : "Fisik (Ambil di sekolah)"} variant="neutral" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                  {product.title}
                </h3>
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{product.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Harga Resmi:</span>
                  <span className="font-mono text-base font-bold text-primary">{formatRupiah(product.price)}</span>
                </div>
                {product.product_type === "physical" && (
                  <div className="text-right text-[11px] text-muted-foreground font-mono">
                    {product.stock === null ? "Stok tersedia" : product.stock > 0 ? `Stok: ${product.stock} unit` : "Stok habis"}
                  </div>
                )}
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold h-8">
                    <Link href="/dashboard/wali-murid/marketplace" className="flex items-center justify-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>Pesan sebagai Wali Murid</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
