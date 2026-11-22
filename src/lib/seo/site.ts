import type { Metadata } from "next";

/**
 * Satu sumber kebenaran data sekolah untuk SEO (metadata, sitemap, robots, JSON-LD).
 * Ubah di sini agar konsisten dengan Google Business Profile.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://sditfajar.sch.id").replace(/\/$/, "");

export const SCHOOL = {
  name: "SDIT Fajar",
  legalName: "Sekolah Dasar Islam Terpadu Fajar",
  tagline: "SD Islam Terpadu & Sekolah Tahfidz di Tapos, Depok",
  description:
    "SDIT Fajar adalah Sekolah Dasar Islam Terpadu dengan program tahfidz Al-Qur'an (target min. 3 juz) dan Kurikulum Merdeka di Jatijajar, Tapos, Kota Depok, Jawa Barat. Pendaftaran SPMB online dibuka setiap tahun.",
  npsn: "10814529",
  email: "info@sditfajar.sch.id",
  // TODO: isi nomor telepon/WA resmi (yang tampil di situs masih contoh). Kosong = tidak dimasukkan ke schema.
  telephone: "",
  address: {
    streetAddress: "Jl. Jati III No.04 RT 07/07, Jatijajar",
    addressLocality: "Kota Depok",
    addressRegion: "Jawa Barat",
    postalCode: "16466",
    addressCountry: "ID",
    district: "Kec. Tapos",
  },
  fullAddress: "Jl. Jati III No.04 RT 07/07, Jatijajar, Kec. Tapos, Kota Depok, Jawa Barat 16466",
  geo: { latitude: -6.414378235237263, longitude: 106.86558773787966 },
  // TODO: isi URL media sosial resmi (Instagram, Facebook, YouTube, Google Maps).
  sameAs: [] as string[],
  keywords: [
    "SDIT Fajar",
    "SD Islam Terpadu Depok",
    "SDIT Depok",
    "SDIT Tapos",
    "SD Islam Jatijajar",
    "sekolah tahfidz Depok",
    "SD tahfidz Depok",
    "pendaftaran SD Depok",
    "SPMB SD Islam Depok",
    "sekolah dasar Islam Tapos Depok",
  ],
} as const;

export const MAPS_URL = `https://www.google.com/maps?q=${SCHOOL.geo.latitude},${SCHOOL.geo.longitude}`;

/**
 * Metadata halaman publik lengkap (canonical + Open Graph + Twitter).
 * openGraph halaman menggantikan milik layout secara utuh, jadi siteName/locale ditulis ulang di sini.
 */
export function pageMeta({
  title,
  description,
  path,
  absoluteTitle = false,
  type = "website",
  publishedTime,
  authors,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  authors?: string[];
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SCHOOL.name} Depok`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "id_ID",
      siteName: SCHOOL.name,
      url: path,
      title: fullTitle,
      description,
      // Artikel memakai opengraph-image miliknya sendiri; halaman lain memakai kartu default.
      ...(type === "article" ? { publishedTime, authors } : { images: ["/opengraph-image"] }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(type === "article" ? {} : { images: ["/opengraph-image"] }),
    },
  };
}

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
