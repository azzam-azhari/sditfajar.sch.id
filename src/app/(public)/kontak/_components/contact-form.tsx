"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { whatsappLink } from "@/constants/contact";

const KATEGORI = {
  spmb: "Informasi Pendaftaran (SPMB)",
  akademik: "Konsultasi Kurikulum & Tahfidz",
  kunjungan: "Rencana Kunjungan Sekolah",
  umum: "Informasi Umum Lainnya",
} as const;

type Kategori = keyof typeof KATEGORI;

const inputClass =
  "w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Form kontak publik. Tidak menyimpan data di server: pesan disusun lalu dibuka di WhatsApp
 * layanan sekolah, sehingga pengunjung langsung terhubung dengan sekretariat.
 */
export function ContactForm() {
  const [kategori, setKategori] = React.useState<Kategori>("spmb");
  const [sent, setSent] = React.useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const nama = String(data.get("nama") ?? "").trim();
    const wa = String(data.get("whatsapp") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const pesan = String(data.get("pesan") ?? "").trim();

    const text = [
      "Assalamu'alaikum, Admin SDIT Fajar.",
      `Kategori: ${KATEGORI[kategori]}`,
      `Nama: ${nama}`,
      `No. WhatsApp: ${wa}`,
      email ? `Email: ${email}` : null,
      "",
      pesan,
    ]
      .filter((line) => line !== null)
      .join("\n");

    window.open(whatsappLink(text), "_blank", "noopener,noreferrer");
    setSent(true);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="kontak-nama" className="text-xs font-semibold text-foreground">
            Nama Lengkap *
          </label>
          <input id="kontak-nama" name="nama" type="text" required minLength={3} maxLength={120} autoComplete="name" placeholder="Contoh: Bpk. Rahmat Fauzi" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="kontak-wa" className="text-xs font-semibold text-foreground">
            Nomor WhatsApp Aktif *
          </label>
          <input id="kontak-wa" name="whatsapp" type="tel" required inputMode="tel" pattern="[0-9+ ()-]{9,20}" title="Nomor WhatsApp 9–20 digit" autoComplete="tel" placeholder="Contoh: 081234567890" className={`${inputClass} font-mono`} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="kontak-email" className="text-xs font-semibold text-foreground">
            Alamat Email (Opsional)
          </label>
          <input id="kontak-email" name="email" type="email" autoComplete="email" placeholder="nama@email.com" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label id="kontak-kategori-label" className="text-xs font-semibold text-foreground">
            Kategori Kepentingan
          </label>
          <Select value={kategori} onValueChange={(v) => setKategori(v as Kategori)}>
            <SelectTrigger aria-labelledby="kontak-kategori-label" className="w-full h-9 text-xs">
              <SelectValue placeholder="Pilih Kategori" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KATEGORI).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="kontak-pesan" className="text-xs font-semibold text-foreground">
          Pesan / Pertanyaan Lengkap *
        </label>
        <textarea
          id="kontak-pesan"
          name="pesan"
          rows={4}
          required
          minLength={10}
          maxLength={1500}
          placeholder="Tuliskan pertanyaan atau hal yang ingin Anda konsultasikan kepada kami..."
          className="w-full rounded-md border border-input bg-background p-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
        <Button
          type="submit"
          className="w-full sm:w-auto text-xs font-semibold h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Kirim lewat WhatsApp</span>
        </Button>
        <p role="status" className="text-[11px] text-muted-foreground">
          {sent
            ? "WhatsApp terbuka di tab baru. Tekan kirim di WhatsApp agar pesan sampai ke sekretariat."
            : "Pesan akan dibuka di WhatsApp sekretariat sekolah."}
        </p>
      </div>
    </form>
  );
}
