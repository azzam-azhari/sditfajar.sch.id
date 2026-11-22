/** Nomor WhatsApp layanan sekolah/panitia SPMB (format internasional tanpa +). Ganti di sini saja. */
export const SCHOOL_WHATSAPP = '6287737860657';

/** Tautan wa.me dengan pesan terisi. */
export function whatsappLink(message: string, number: string = SCHOOL_WHATSAPP): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
