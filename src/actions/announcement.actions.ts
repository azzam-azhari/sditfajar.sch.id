'use server';

import { requireUser } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import type { ActionError, ActionResult } from '@/types/action.types';
import {
  announcementSchema, announcementUpdateSchema,
  type AnnouncementInput, type AnnouncementUpdateInput,
} from '@/validations/fase6.schema';
import { z } from 'zod';

type Parsed = z.output<typeof announcementSchema>;

/** Pembuat pengumuman: super admin, admin, atau guru berjabatan kepala sekolah. */
async function requireAnnouncementManager(): Promise<{ userId: string } | ActionError> {
  const { user, profile } = await requireUser();
  if (profile.role === 'super_admin' || profile.role === 'admin') return { userId: user.id };
  if (profile.role === 'guru') {
    const supabase = await createClient();
    const { data } = await supabase.rpc('has_teacher_position', { pos_code: 'kepala_sekolah' });
    if (data === true) return { userId: user.id };
  }
  return { success: false, error: 'Hanya super admin, admin, dan kepala sekolah yang dapat membuat pengumuman.', code: 'FORBIDDEN' };
}

/** Kosongkan kolom target yang tidak relevan dan pastikan target ada. */
async function normalizeTarget(data: Parsed): Promise<
  | { values: { target_type: string; target_role: string | null; classroom_id: string | null; student_id: string | null } }
  | ActionError
> {
  const supabase = await createClient();
  if (data.target_type === 'class') {
    const { data: classroom } = await supabase.from('classrooms').select('id').eq('id', data.classroom_id!).maybeSingle();
    if (!classroom) return { success: false, error: 'Kelas tujuan tidak ditemukan.', code: 'VALIDATION_ERROR' };
  }
  if (data.target_type === 'student') {
    const { data: student } = await supabase.from('students').select('id').eq('id', data.student_id!).maybeSingle();
    if (!student) return { success: false, error: 'Murid tujuan tidak ditemukan.', code: 'VALIDATION_ERROR' };
  }
  return {
    values: {
      target_type: data.target_type,
      target_role: data.target_type === 'role' ? data.target_role ?? null : null,
      classroom_id: data.target_type === 'class' ? data.classroom_id ?? null : null,
      student_id: data.target_type === 'student' ? data.student_id ?? null : null,
    },
  };
}

export async function createAnnouncementAction(input: AnnouncementInput): Promise<ActionResult<{ id: string }>> {
  const manager = await requireAnnouncementManager();
  if ('success' in manager) return manager;
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const target = await normalizeTarget(parsed.data);
  if ('success' in target) return target;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      status: parsed.data.status,
      ...target.values,
      created_by: manager.userId,
      published_at: parsed.data.status === 'published' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) return dbError(error, 'Gagal menyimpan pengumuman.');
  await writeAudit('create_announcement', 'announcements', data.id, { target_type: parsed.data.target_type, status: parsed.data.status });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: parsed.data.status === 'published' ? 'Pengumuman diterbitkan.' : 'Draf pengumuman disimpan.' };
}

export async function updateAnnouncementAction(input: AnnouncementUpdateInput): Promise<ActionResult<void>> {
  const manager = await requireAnnouncementManager();
  if ('success' in manager) return manager;
  const parsed = announcementUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const target = await normalizeTarget(parsed.data);
  if ('success' in target) return target;

  const supabase = await createClient();
  const { data: existing } = await supabase.from('announcements').select('published_at').eq('id', parsed.data.id).maybeSingle();
  if (!existing) return { success: false, error: 'Pengumuman tidak ditemukan.', code: 'NOT_FOUND' };
  const { data, error } = await supabase
    .from('announcements')
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      status: parsed.data.status,
      ...target.values,
      published_at: parsed.data.status === 'published' ? existing.published_at ?? new Date().toISOString() : existing.published_at,
    })
    .eq('id', parsed.data.id)
    .select('id');
  if (error) return dbError(error, 'Gagal memperbarui pengumuman.');
  if (!data?.length) return { success: false, error: 'Anda hanya dapat mengubah pengumuman milik Anda.', code: 'FORBIDDEN' };
  await writeAudit('update_announcement', 'announcements', parsed.data.id, { status: parsed.data.status });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Pengumuman diperbarui.' };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult<void>> {
  const manager = await requireAnnouncementManager();
  if ('success' in manager) return manager;
  if (!z.guid().safeParse(id).success) return { success: false, error: 'Pengumuman tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('announcements').delete().eq('id', id).select('id');
  if (error) return dbError(error, 'Gagal menghapus pengumuman.');
  if (!data?.length) return { success: false, error: 'Anda hanya dapat menghapus pengumuman milik Anda.', code: 'FORBIDDEN' };
  await writeAudit('delete_announcement', 'announcements', id, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Pengumuman dihapus.' };
}
