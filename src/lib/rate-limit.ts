import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionError } from '@/types/action.types';

/** Batas frekuensi per aksi. Ubah di sini agar seluruh aplikasi konsisten. */
export const RATE_LIMITS = {
  ppdbSubmit: { max: 5, windowSeconds: 60 * 60 }, // 5 pendaftaran / jam / IP
  ppdbStatus: { max: 20, windowSeconds: 15 * 60 }, // 20 cek status / 15 menit / IP
  paymentProof: { max: 10, windowSeconds: 60 * 60 }, // 10 unggahan bukti / jam / wali
  assignmentSubmit: { max: 30, windowSeconds: 60 * 60 }, // 30 pengumpulan / jam / murid
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** IP klien dari header proxy (Vercel mengisi x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * true = aksi diizinkan. Memanggil RPC hit_rate_limit (migration 000021).
 * Fail-open: bila fungsi belum tersedia atau error, aksi tetap diizinkan dan peringatan dicatat,
 * agar gangguan rate limiter tidak memblokir pendaftaran/pengumpulan yang sah.
 */
export async function allowRequest(name: RateLimitName, subject: string): Promise<boolean> {
  const { max, windowSeconds } = RATE_LIMITS[name];
  const { data, error } = await createAdminClient().rpc('hit_rate_limit', {
    p_key: `${name}:${subject}`.slice(0, 200),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn(`[RateLimit] ${name} tidak aktif:`, error.message);
    return true;
  }
  return data !== false;
}

export function rateLimitedError(message = 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi.'): ActionError {
  return { success: false, title: 'Terlalu Banyak Permintaan', error: message, code: 'RATE_LIMITED' };
}
