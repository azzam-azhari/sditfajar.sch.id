'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import { jakartaToday } from '@/lib/date';
import { getSurah } from '@/constants/quran';
import type { ActionError, ActionResult } from '@/types/action.types';
import {
  tahfidzRecordSchema, tahfidzUpdateSchema,
  type TahfidzRecordInput, type TahfidzUpdateInput,
} from '@/validations/fase6.schema';

type Parsed = z.output<typeof tahfidzRecordSchema>;

/** Aturan domain: ayat sesuai jumlah ayat surah, tanggal tidak di masa depan, dan guru berhak mencatat. */
async function checkRecord(data: Parsed): Promise<ActionError | null> {
  const surah = getSurah(data.surah_number);
  if (!surah) return { success: false, error: 'Surah tidak valid.', code: 'VALIDATION_ERROR' };
  if (data.ayat_end > surah.ayat) {
    return { success: false, error: `Surah ${surah.name} hanya memiliki ${surah.ayat} ayat.`, code: 'VALIDATION_ERROR' };
  }
  if (data.record_date > jakartaToday()) {
    return { success: false, error: 'Tanggal setoran tidak boleh di masa depan.', code: 'VALIDATION_ERROR' };
  }
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('can_record_tahfidz', { p_student_id: data.student_id });
  if (allowed !== true) {
    return {
      success: false,
      error: 'Anda hanya dapat mencatat setoran murid kelas binaan, kelas Tahfidz yang Anda ampu, atau sebagai koordinator tahfidz.',
      code: 'FORBIDDEN',
    };
  }
  return null;
}

export async function createTahfidzRecordAction(input: TahfidzRecordInput): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireRole(['guru']);
  const parsed = tahfidzRecordSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const invalid = await checkRecord(parsed.data);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tahfidz_records')
    .insert({ ...parsed.data, teacher_id: user.id })
    .select('id')
    .single();
  if (error || !data) return dbError(error, 'Gagal menyimpan setoran.');
  await writeAudit('create_tahfidz_record', 'tahfidz_records', data.id, {
    surah_number: parsed.data.surah_number,
    predicate: parsed.data.predicate,
  });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Setoran hafalan berhasil dicatat.' };
}

export async function updateTahfidzRecordAction(input: TahfidzUpdateInput): Promise<ActionResult<void>> {
  await requireRole(['guru']);
  const parsed = tahfidzUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const invalid = await checkRecord(parsed.data);
  if (invalid) return invalid;
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from('tahfidz_records').update(fields).eq('id', id).select('id');
  if (error) return dbError(error, 'Gagal memperbarui setoran.');
  if (!data?.length) return { success: false, error: 'Anda hanya dapat mengubah setoran yang Anda catat.', code: 'FORBIDDEN' };
  await writeAudit('update_tahfidz_record', 'tahfidz_records', id, { predicate: fields.predicate });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Setoran diperbarui.' };
}

export async function deleteTahfidzRecordAction(id: string): Promise<ActionResult<void>> {
  await requireRole(['guru']);
  if (!z.guid().safeParse(id).success) return { success: false, error: 'Setoran tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('tahfidz_records').delete().eq('id', id).select('id');
  if (error) return dbError(error, 'Gagal menghapus setoran.');
  if (!data?.length) return { success: false, error: 'Anda hanya dapat menghapus setoran yang Anda catat.', code: 'FORBIDDEN' };
  await writeAudit('delete_tahfidz_record', 'tahfidz_records', id, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Setoran dihapus.' };
}
