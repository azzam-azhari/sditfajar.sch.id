import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { RegistrationFormClient } from "./_components/registration-form-client";
import { getPublicSpmbInfo } from "@/lib/data/spmb";
import { pageMeta } from "@/lib/seo/site";
import { FAQ_SPMB } from "@/lib/seo/faq";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";

export const metadata = pageMeta({
  title: "Pendaftaran SPMB Online SD Islam Terpadu & Tahfidz Depok",
  description:
    "Daftar online SPMB SDIT Fajar, SD Islam Terpadu dan sekolah tahfidz di Jatijajar, Tapos, Kota Depok. Lihat gelombang, biaya pendaftaran, alur, dan cek status. Kuota 100 murid.",
  path: "/spmb",
});

async function RegistrationSection() {
  const info = await getPublicSpmbInfo();
  return <RegistrationFormClient info={info} />;
}

function RegistrationFormSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Skeleton Kartu Gelombang Pendaftaran */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-28 rounded-lg bg-muted/50" />
          <div className="h-28 rounded-lg bg-muted/50" />
        </div>
      </div>

      {/* Skeleton Form Pendaftaran */}
      <div className="rounded-xl border border-border/80 bg-card p-6 space-y-6">
        <div className="h-6 w-64 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 rounded-md bg-muted/50" />
          <div className="h-10 rounded-md bg-muted/50" />
          <div className="h-10 rounded-md bg-muted/50" />
          <div className="h-10 rounded-md bg-muted/50" />
        </div>
        <div className="h-10 w-36 rounded-md bg-muted" />
      </div>
    </div>
  );
}

export default function PendaftaranPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      <PageHeader
        title="Pendaftaran Murid Baru (SPMB)"
        description="Portal pendaftaran daring murid baru SDIT Fajar. Kuota penerimaan dibatasi 100 murid baru (4 rombel) demi efektivitas pembinaan talaqqi Al-Qur'an dan penanaman adab islami."
      >
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link href="/spmb/status" className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            <span>Cek Status Pendaftaran</span>
          </Link>
        </Button>
      </PageHeader>

      <Suspense fallback={<RegistrationFormSkeleton />}>
        <RegistrationSection />
      </Suspense>

      <FaqSection items={FAQ_SPMB} title="Tanya Jawab Pendaftaran SDIT Fajar" eyebrow="FAQ SPMB" />
      <JsonLd data={breadcrumbSchema([{ name: "Beranda", path: "/" }, { name: "Pendaftaran", path: "/spmb" }])} />
    </div>
  );
}
