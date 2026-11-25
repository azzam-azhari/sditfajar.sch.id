'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import type { ActionResult } from '@/types/action.types';
import { linkParentStudentSchema, type LinkParentStudentInput } from '@/validations/parent.schema';

const ADMIN_WALI_PATH = '/dashboard/admin/wali-murid';

/** Tautkan murid ke akun wali murid. Satu wali dapat terhubung ke beberapa anak. */
export async function linkParentStudentAction(input: LinkParentStudentInput): Promise<ActionResult<{ id: string }>> {
  await requireRole(['admin', 'super_admin']);
  const parsed = linkParentStudentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const [{ data: parent }, { data: student }] = await Promise.all([
    supabase.from('parents').select('id').eq('id', parsed.data.parent_id).maybeSingle(),
    supabase.from('students').select('id, is_active').eq('id', parsed.data.student_id).maybeSingle(),
  ]);
  if (!parent) return { success: false, error: 'Akun wali murid tidak ditemukan.', code: 'NOT_FOUND' };
  if (!student?.is_active) return { success: false, error: 'Murid tidak ditemukan atau sudah tidak aktif.', code: 'NOT_FOUND' };

  const { data, error } = await supabase
    .from('parent_students')
    .insert({ ...parsed.data, is_primary: false })
    .select('id')
    .single();
  if (error?.code === '23505') {
    return { success: false, error: 'Murid ini sudah terhubung ke akun wali tersebut.', code: 'DUPLICATE_ENTRY' };
  }
  if (error || !data) return dbError(error, 'Gagal menautkan murid ke akun wali.');

  await writeAudit('link_parent_student', 'parent_students', data.id, parsed.data);
  revalidatePath(ADMIN_WALI_PATH);
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Murid berhasil ditautkan ke akun wali.' };
}

/** Lepas tautan murid dari akun wali murid. */
export async function unlinkParentStudentAction(linkId: string): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  const id = z.guid().safeParse(linkId);
  if (!id.success) return { success: false, error: 'Data tautan tidak valid.', code: 'VALIDATION_ERROR' };

  const supabase = await createClient();
  const { data: link } = await supabase
    .from('parent_students')
    .select('id, parent_id, student_id, relationship')
    .eq('id', id.data)
    .maybeSingle();
  if (!link) return { success: false, error: 'Tautan tidak ditemukan.', code: 'NOT_FOUND' };

  const { error } = await supabase.from('parent_students').delete().eq('id', link.id);
  if (error) return dbError(error, 'Gagal melepas tautan murid.');

  await writeAudit('unlink_parent_student', 'parent_students', link.id, {
    parent_id: link.parent_id,
    student_id: link.student_id,
    relationship: link.relationship,
  });
  revalidatePath(ADMIN_WALI_PATH);
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tautan murid dilepas dari akun wali.' };
}
