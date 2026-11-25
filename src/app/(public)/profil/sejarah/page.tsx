import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMeta } from "@/lib/seo/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";

export const metadata = pageMeta({
  title: "Sejarah Sekolah",
  description:
    "Perjalanan sejarah pendirian SDIT Fajar di Jatijajar, Tapos, Kota Depok sejak 2012 serta tonggak capaian sekolah tahfidz ini hingga saat ini.",
  path: "/profil/sejarah",
});

const JEJAK_LANGKAH = [
  {
    image: "/sejarah/2.jpg",
    alt: "Para tokoh masyarakat dan pendiri meletakkan batu pertama pembangunan SDIT Fajar",
    title: "Peletakan Batu Pertama: Simbol Awal dan Harapan",
    desc: "Peletakan batu pertama menandai dimulainya pembangunan fisik sekolah. Momen ini menggambarkan optimisme serta harapan untuk mendidik sepuluh siswa pertama yang bergabung dalam SDIT Fajar. Ini adalah bukti nyata bahwa dengan kesungguhan hati dan doa, mimpi untuk menyediakan pendidikan berkualitas berbasis Islam dapat diwujudkan.",
  },
  {
    image: "/sejarah/1.jpg",
    alt: "Para tokoh dan pendiri berkumpul saat penandatanganan prasasti SDIT Fajar",
    title: "Peresmian Berdirinya Sekolah (2012)",
    desc: "Sekolah Dasar Islam Terpadu Fajar (SDIT Fajar) resmi didirikan pada tahun 2012 dengan visi menghadirkan pendidikan berbasis Islam yang berkualitas. Berawal dari impian besar para pendiri untuk membentuk generasi muda yang berakhlak mulia, cerdas, dan bertakwa, sekolah ini memulai perjalanannya dengan komitmen yang kuat terhadap nilai-nilai Islam. Momen bersejarah tersebut diresmikan dengan tanda tangan oleh Wali Kota Depok bersama tokoh masyarakat dan para pendiri.",
  },
  {
    image: "/sejarah/3.jpg",
    alt: "Keluarga besar SDIT Fajar mengukir sejarah bersama",
    title: "Mengukir Sejarah Bersama",
    desc: "Hingga saat ini, SDIT Fajar telah menjelma menjadi lembaga pendidikan yang dikenal luas berkat prestasi siswa-siswinya, baik di tingkat akademik maupun non-akademik. Visi untuk terus mencetak generasi penerus bangsa yang unggul dan berkarakter Islami masih menjadi fokus utama dalam setiap langkah dan program yang dijalankan oleh sekolah ini.",
  },
];

export default function SejarahPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">

      <PageHeader
        title="Sejarah & Linimasa Sekolah"
        badge="Sejarah"
        description="Merekam jejak langkah dan dedikasi panjang SDIT Fajar dalam melahirkan generasi pecinta Al-Qur'an dan pembelajar sejati."
      >
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link href="/profil">Profil & Visi Misi</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link href="/profil/manajemen">Manajemen Sekolah</Link>
        </Button>
      </PageHeader>

      {/* Kisah Awal */}
      <section className="rounded-2xl border border-border/80 bg-card p-6 md:p-8 space-y-4">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Bermula dari Niat Luhur Membina Ummat
        </h2>
        <div className="space-y-3 text-xs md:text-sm text-muted-foreground leading-relaxed">
          <p>
            Kelahiran SDIT Fajar berawal dari kegelisahan bersama para pendidik muslim di Depok terhadap minimnya lembaga pendidikan dasar yang mampu memadukan antara kekuatan hafalan Al-Qur&apos;an dengan penguasaan kurikulum umum berstandar nasional secara seimbang.
          </p>
          <p>
            Dengan izin Allah Subhanahu wa Ta&apos;ala serta dukungan wakaf dan gotong royong para muhsinin, pada tahun 2012 dimulailah pembangunan sarana belajar pertama di kawasan Jatijajar, Tapos. Sejak itu, SDIT Fajar terus berbenah secara berkelanjutan meningkatkan kualitas pendidik, sarana pembelajaran, hingga sistem administrasi modern.
          </p>
        </div>
      </section>

      {/* Jejak Langkah */}
      <section className="space-y-8" aria-labelledby="jejak-langkah-heading">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Jejak Langkah
          </span>
          <h2
            id="jejak-langkah-heading"
            className="text-xl md:text-2xl font-bold tracking-tight text-foreground mt-1"
          >
            Perjalanan Kami (2012 – Sekarang)
          </h2>
        </div>

        <ol className="relative border-l-2 border-border/80 pl-6 ml-3 space-y-12">
          {JEJAK_LANGKAH.map((item, idx) => (
            <li key={item.image} className="relative group">
              {/* Dot */}
              <div className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background group-hover:scale-125 transition-transform">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>

              <div
                className={cn(
                  "flex flex-col gap-5 md:flex-row md:items-center md:gap-8",
                  idx % 2 === 1 && "md:flex-row-reverse"
                )}
              >
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-border/80 bg-muted md:w-2/5 md:shrink-0">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>

                <div className="space-y-2 md:flex-1">
                  <span className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base md:text-lg font-bold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer Navigation */}
      <div className="pt-6 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Kenali jajaran pimpinan dan dewan pengajar kami.
        </p>
        <Button asChild size="sm" className="text-xs bg-primary text-primary-foreground">
          <Link href="/profil/manajemen" className="flex items-center gap-1.5">
            <span>Lihat Profil Manajemen Sekolah</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

    </div>
  );
}
