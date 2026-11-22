"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/constants/contact";

export function FloatingWhatsapp() {
  const href = whatsappLink(
    "Assalamu'alaikum Warahmatullahi Wabarakatuh, Admin SDIT Fajar. Saya ingin bertanya mengenai informasi pendaftaran dan program sekolah."
  );

  return (
    <aside
      aria-label="Kontak WhatsApp Panitia"
      className="fixed bottom-6 right-6 z-30"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-lg transition-all duration-300 hover:bg-emerald-700 hover:shadow-xl hover:scale-105 active:scale-95"
        title="Hubungi Panitia via WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden text-xs font-semibold sm:inline tracking-wide">
          Tanya Panitia
        </span>
      </a>
    </aside>
  );
}
