import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSurah } from '@/constants/quran';
import type { TahfidzPredicate } from '@/constants/quran';

export interface TahfidzRecordView {
  id: string;
  student_id: string;
  teacher_id: string;
  surah_number: number;
  ayat_start: number;
  ayat_end: number;
  pages: number | null;
  predicate: TahfidzPredicate;
  record_date: string;
  notes: string | null;
  profiles: { name: string } | null;
}

export interface TahfidzSummary {
  totalRecords: number;
  totalAyat: number;
  totalPages: number;
  surahCount: number;
  highestJuz: number | null;
  last: TahfidzRecordView | null;
}

const SELECT = 'id, student_id, teacher_id, surah_number, ayat_start, ayat_end, pages, predicate, record_date, notes, profiles(name)';

/** Riwayat setoran (RLS: murid sendiri, wali anaknya, guru berwenang, koordinator semua). */
export async function getTahfidzRecords(studentIds: string[] | null): Promise<TahfidzRecordView[]> {
  const supabase = await createClient();
  let query = supabase.from('tahfidz_records').select(SELECT).order('record_date', { ascending: false }).order('created_at', { ascending: false });
  if (studentIds) {
    if (studentIds.length === 0) return [];
    query = query.in('student_id', studentIds);
  }
  const { data } = await query;
  return ((data ?? []) as unknown as TahfidzRecordView[]).map((r) => ({ ...r, pages: r.pages === null ? null : Number(r.pages) }));
}

export function summarizeTahfidz(records: TahfidzRecordView[]): TahfidzSummary {
  const juzs = records.map((r) => getSurah(r.surah_number)?.juz).filter((j): j is number => typeof j === 'number');
  return {
    totalRecords: records.length,
    totalAyat: records.reduce((sum, r) => sum + (r.ayat_end - r.ayat_start + 1), 0),
    totalPages: Math.round(records.reduce((sum, r) => sum + (r.pages ?? 0), 0) * 10) / 10,
    surahCount: new Set(records.map((r) => r.surah_number)).size,
    highestJuz: juzs.length ? Math.max(...juzs) : null,
    last: records[0] ?? null,
  };
}

export function isTahfidzSubject(subject: { code: string | null; name: string }): boolean {
  const code = (subject.code ?? '').toUpperCase();
  return code === 'TFZ' || code === 'TAHFIDZ' || /tahfidz/i.test(subject.name);
}
