import { pageMeta } from "@/lib/seo/site";
﻿import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  Target,
  Trophy,
  Cpu,
  PenTool,
  HeartPulse,
  Languages,
  Clock,
  Users,
  ArrowRight,
  Medal,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";

export const metadata = pageMeta({
  title: "Ekstrakurikuler: Pramuka, Panahan, Robotik & Lainnya",
  description:
    "Ekstrakurikuler SDIT Fajar Depok: Pramuka SIT, panahan, robotik & koding, futsal, kaligrafi, dokter kecil, serta English & Arabic club beserta prestasinya.",
  path: "/ekstrakurikuler",
});

interface Ekskul {
  name: string;
  category: string;
  icon: LucideIcon;
  schedule: string;
  target: string;
  desc: string;
  /** Foto sementara dari Unsplash; kosongkan untuk memakai ilustrasi ikon. `position` = titik fokus crop (object-position). */
  image?: { src: string; alt: string; position?: string };
}

/** URL Unsplash dengan ukuran sumber wajar; next/image mengoptimasi ulang sesuai `sizes`. */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=960&q=70&auto=format&fit=crop`;

const EKSTRAKURIKULER: Ekskul[] = [
  {
    name: "Pramuka SIT (Satuan Komunitas)",
    category: "Wajib",
    icon: Compass,
    schedule: "Jumat, 13.30 – 15.00 WIB",
    target: "Kelas 1 – 6",
    desc: "Membina kedisiplinan, ketangkasan fisik, kemandirian berkemah, dan jiwa tolong-menolong berlandaskan Dasa Darma Pramuka SIT.",
    image: { src: unsplash("1504280390367-361c6d9f38f4"), alt: "Pemandangan hutan dari dalam tenda perkemahan" },
  },
  {
    name: "Panahan Sunnah (Archery)",
    category: "Olahraga Sunnah",
    icon: Target,
    schedule: "Sabtu, 08.00 – 10.00 WIB",
    target: "Kelas 3 – 6",
    desc: "Melatih fokus konsentrasi, kekuatan fisik, kesabaran, dan ketenangan jiwa sesuai sunnah olahraga yang dianjurkan Rasulullah SAW.",
    image: {
      src: unsplash("1510925758641-869d353cecc7"),
      alt: "Pemanah menarik busur ke arah papan target",
      position: "50% 62%",
    },
  },
  {
    name: "Robotic & Koding Dasar",
    category: "Sains & Teknologi",
    icon: Cpu,
    schedule: "Sabtu, 10.00 – 11.30 WIB",
    target: "Kelas 4 – 6",
    desc: "Mengenalkan logika algoritma pemrograman visual (Scratch/Blockly) dan merakit robotika cerdas pengikut garis (Line Follower).",
    image: { src: unsplash("1485827404703-89b55fcc595e"), alt: "Robot humanoid putih dengan layar tablet" },
  },
  {
    name: "Futsal Murid",
    category: "Olahraga Prestasi",
    icon: Trophy,
    schedule: "Selasa & Kamis, 16.00 – 17.30 WIB",
    target: "Kelas 3 – 6",
    desc: "Melatih kekompakan tim, ketahanan fisik, sportivitas islami, dan persiapan turnamen olahraga antar sekolah se-Jabodetabek.",
    image: { src: unsplash("1606925797300-0b35e9d1794e"), alt: "Pemain menendang bola di lapangan futsal berjaring" },
  },
  {
    name: "Khat & Kaligrafi Al-Qur'an",
    category: "Seni Islami",
    icon: PenTool,
    schedule: "Rabu, 15.30 – 17.00 WIB",
    target: "Kelas 2 – 6",
    desc: "Mengasah keindahan tulisan tangan Arab dengan kaidah Khat Naskhi dan Riq'ah, melatih kehalusan budi pekerti dan ketelitian.",
    image: { src: unsplash("1585036156171-384164a8c675"), alt: "Halaman mushaf Al-Qur'an dengan tulisan Arab yang terbuka" },
  },
  {
    name: "Dokter Kecil (UKS)",
    category: "Kesehatan & Sosial",
    icon: HeartPulse,
    schedule: "Senin, 15.30 – 16.30 WIB",
    target: "Kelas 4 – 5",
    desc: "Pelatihan pertolongan pertama pada kecelakaan (P3K), pola hidup bersih dan sehat (PHBS), serta duta kesehatan lingkungan kelas.",
    image: { src: unsplash("1576091160550-2173dba999ef"), alt: "Stetoskop di atas meja kerja tenaga kesehatan" },
  },
  {
    name: "English & Arabic Young Club",
    category: "Bahasa Asing",
    icon: Languages,
    schedule: "Kamis, 15.30 – 16.45 WIB",
    target: "Kelas 3 – 6",
    desc: "Permainan peran (role play), storytelling kisah nabi dalam bahasa Inggris/Arab, dan pembiasaan percakapan sehari-hari murid.",
    image: { src: unsplash("1503676260728-1c00da094a0b"), alt: "Tumpukan buku, apel, dan balok huruf A B C di meja kelas" },
  },
];

const PRESTASI = [
  { year: "2025", title: "Juara 1 Lomba Panahan Tradisional Pelajar se-Jawa Barat" },
  { year: "2024", title: "Juara 2 Lomba Robotic Line Follower Tingkat SD" },
  { year: "2024", title: "Regu Teladan Jambore Pramuka SIT Nasional" },
];

const RINGKASAN = [
  { value: String(EKSTRAKURIKULER.length), label: "Pilihan kegiatan" },
  { value: String(EKSTRAKURIKULER.filter((e) => e.category === "Wajib").length), label: "Kegiatan wajib" },
  { value: "Senin – Sabtu", label: "Jadwal di luar jam pelajaran" },
];

function EkskulCard({ item }: { item: Ekskul }) {
  const Icon = item.icon;
  const isWajib = item.category === "Wajib";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card transition-colors hover:border-foreground/20">
      {/* Media: rasio tetap agar tidak ada pergeseran tata letak saat gambar dimuat */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {item.image ? (
          <Image
            src={item.image.src}
            alt={item.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            style={item.image.position ? { objectPosition: item.image.position } : undefined}
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
            <Icon className="h-16 w-16 text-primary/40" strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-primary shadow-xs ring-1 ring-border/60 backdrop-blur-sm">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span
            className={
              isWajib
                ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs"
                : "rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-xs ring-1 ring-border/60 backdrop-blur-sm"
            }
          >
            {item.category}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-bold leading-snug text-foreground text-balance">{item.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>

        <dl className="mt-auto grid gap-2 border-t border-border/60 pt-4 text-xs">
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="sr-only">Jadwal</span>
            </dt>
            <dd className="font-mono text-foreground">{item.schedule}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="sr-only">Sasaran</span>
            </dt>
            <dd className="text-foreground">{item.target}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default function EkstrakurikulerPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Ekstrakurikuler & Minat Bakat"
        badge="Kesiswaan"
        description="Wadah pengembangan potensi jasmani, kreativitas seni islami, teknologi, dan kepemimpinan murid di luar jam intrakurikuler."
      >
        <Button asChild size="sm" className="text-xs">
          <Link href="/spmb">Daftar Murid Baru</Link>
        </Button>
      </PageHeader>

      {/* Ringkasan */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/80 bg-border/80 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {RINGKASAN.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-0.5 bg-card px-5 py-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="font-mono text-xl font-bold text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Grid Ekstrakurikuler */}
      <section aria-labelledby="daftar-ekskul" className="space-y-5">
        <h2 id="daftar-ekskul" className="text-lg font-bold tracking-tight text-foreground">
          Pilihan Kegiatan
        </h2>
        <ul role="list" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EKSTRAKURIKULER.map((item) => (
            <li key={item.name}>
              <EkskulCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      {/* Prestasi Ekstrakurikuler */}
      <section aria-labelledby="prestasi-ekskul" className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 md:p-8">
        <div className="space-y-1">
          <h2 id="prestasi-ekskul" className="flex items-center gap-2 text-base font-bold text-foreground">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Jejak Prestasi Murid SDIT Fajar
          </h2>
          <p className="text-sm text-muted-foreground">Buah pembinaan ekstrakurikuler yang intensif dan berkelanjutan.</p>
        </div>
        <ul role="list" className="grid gap-3 sm:grid-cols-3">
          {PRESTASI.map((p) => (
            <li key={p.title} className="flex items-start gap-3 rounded-lg border border-border/60 p-4">
              <Medal className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-snug text-foreground">{p.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.year}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer Navigation */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-border/80 pt-6 sm:flex-row">
        <p className="text-sm text-muted-foreground">Ingin membaca kabar prestasi dan kegiatan terbaru murid?</p>
        <Button asChild size="sm" className="text-xs">
          <Link href="/berita" className="flex items-center gap-1.5">
            <span>Buka Berita & Agenda</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
