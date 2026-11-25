import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentSettings } from '@/lib/data/payment';
import type { BankAccount } from '@/validations/payment.schema';

export interface SpmbWave {
  id: string;
  title: string;
  wave_number: number;
  registration_fee: number;
  start_date: string;
  end_date: string;
  is_open: boolean;
}

export interface PublicSpmbInfo {
  /** Gelombang yang dipakai formulir: gelombang terbuka dengan nomor terkecil. */
  activeWave: SpmbWave | null;
  /** Semua gelombang pada tahun ajaran yang sama (untuk info periode). */
  waves: SpmbWave[];
  /** Nama tahun ajaran, mis. '2027/2028'. */
  academicYearName: string | null;
  bankAccount: BankAccount | null;
  transferInstructions: string | null;
}

/**
 * Data publik halaman /spmb. academic_years & payment_settings tidak bisa dibaca
 * anon (RLS), jadi dibaca dengan admin client dan hanya kolom publik yang dikembalikan.
 */
export async function getPublicSpmbInfo(): Promise<PublicSpmbInfo> {
  const admin = createAdminClient();

  const [{ data: openWave }, settings] = await Promise.all([
    admin
      .from('admission_waves')
      .select('academic_year_id')
      .eq('status', 'open')
      .eq('is_active', true)
      .order('wave_number', { ascending: true })
      .limit(1)
      .maybeSingle(),
    getPaymentSettings(),
  ]);

  let academicYearId: string | null = openWave?.academic_year_id ?? null;
  let academicYearName: string | null = null;

  if (academicYearId) {
    const { data: year } = await admin.from('academic_years').select('name').eq('id', academicYearId).maybeSingle();
    academicYearName = year?.name ?? null;
  } else {
    const { data: year } = await admin
      .from('academic_years')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    academicYearId = year?.id ?? null;
    academicYearName = year?.name ?? null;
  }

  let waves: SpmbWave[] = [];
  if (academicYearId) {
    const { data } = await admin
      .from('admission_waves')
      .select('id, title, wave_number, registration_fee, start_date, end_date, status, is_active')
      .eq('academic_year_id', academicYearId)
      .in('status', ['open', 'closed'])
      .order('wave_number', { ascending: true });
    waves = (data ?? []).map((w) => ({
      id: w.id,
      title: w.title,
      wave_number: w.wave_number,
      registration_fee: Number(w.registration_fee),
      start_date: w.start_date,
      end_date: w.end_date,
      is_open: w.status === 'open' && w.is_active,
    }));
  }

  return {
    activeWave: waves.find((w) => w.is_open) ?? null,
    waves,
    academicYearName,
    bankAccount: settings.spmb_bank_account,
    transferInstructions: settings.spmb_transfer_instructions,
  };
}
