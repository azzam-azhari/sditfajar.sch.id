/**
 * Normalisasi nomor HP/WhatsApp Indonesia ke satu format tersimpan:
 * buang spasi, strip, titik, dan kurung; awalan +62 / 62 menjadi 0.
 * Harus sama dengan fungsi SQL public.normalize_phone (migration 000013).
 */
export function normalizePhone(phone: string): string {
  const compact = phone.replace(/[\s().-]/g, '');
  if (compact.startsWith('+62')) return `0${compact.slice(3)}`;
  if (/^62\d{8,}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

/** True bila string terlihat seperti nomor telepon (bukan NIS/username/email). */
export function looksLikePhone(value: string): boolean {
  return /^\+?[\d\s().-]{8,}$/.test(value.trim());
}
