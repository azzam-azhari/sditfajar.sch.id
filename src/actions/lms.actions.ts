'use server';

import { randomUUID } from 'crypto';
import { requireRole, requireUser } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAdminSignedUrl, deleteStorageFile, uploadStorageFile } from '@/lib/supabase/storage';
import { jakartaToday } from '@/lib/date';
import { allowRequest, rateLimitedError } from '@/lib/rate-limit';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import type { ActionError, ActionResult } from '@/types/action.types';
import {
  assignmentSchema, assignmentUpdateSchema, finalGradeSchema, gradeSubmissionSchema,
  lmsFileRequestSchema, materialSchema, materialStatusSchema, materialUpdateSchema,
  scheduleSchema, scheduleUpdateSchema, studentAttendanceSchema, submissionSchema,
  type AssignmentInput, type AssignmentUpdateInput, type FinalGradeInput,
  type GradeSubmissionInput, type LmsFileRequest, type MaterialInput, type MaterialStatusInput,
  type MaterialUpdateInput, type ScheduleInput, type ScheduleUpdateInput,
  type StudentAttendanceInput, type SubmissionInput,
} from '@/validations/lms.schema';

type IdResult = ActionResult<{ id: string }>;
type VoidResult = ActionResult<void>;

async function requireTeacher(): Promise<{ userId: string; teacherId: string } | ActionError> {
  const { user } = await requireRole(['guru']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return { success: false, error: 'Profil guru tidak ditemukan.', code: 'FORBIDDEN' };
  return { userId: user.id, teacherId: data.id };
}

async function uploadLmsFile(file: File | null, folder: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${randomUUID()}-${safeName}`;
  const uploaded = await uploadStorageFile('lms-files', path, await file.arrayBuffer(), file.name, file.type, file.size);
  return uploaded.path;
}

async function removeLmsFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await deleteStorageFile('lms-files', path).catch((err) =>
    console.warn('[LMS] Gagal menghapus berkas lama:', err instanceof Error ? err.message : err)
  );
}

function hasFile(file: File | null): file is File {
  return Boolean(file && file.size > 0);
}

// ============================================================================
// MATERI
// ============================================================================

export async function createMaterialAction(input: MaterialInput, file: File | null): Promise<IdResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  if (!parsed.data.content && !parsed.data.external_url && !hasFile(file)) {
    return { success: false, error: 'Isi teks, tautan/video, atau berkas materi wajib diisi.', code: 'VALIDATION_ERROR' };
  }

  let filePath: string | null = null;
  try {
    filePath = await uploadLmsFile(file, `materials/${parsed.data.classroom_id}`);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('materials')
    .insert({
      ...parsed.data,
      teacher_id: teacher.teacherId,
      file_path: filePath,
      published_at: parsed.data.status === 'published' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) {
    await removeLmsFile(filePath);
    return dbError(error, 'Gagal menyimpan materi. Pastikan Anda mengampu kelas dan mapel tersebut.');
  }
  await writeAudit('create_material', 'materials', data.id, { status: parsed.data.status });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Materi berhasil disimpan.' };
}

export async function updateMaterialAction(input: MaterialUpdateInput, file: File | null): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = materialUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { id, remove_file, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('materials')
    .select('file_path, status, published_at')
    .eq('id', id)
    .eq('teacher_id', teacher.teacherId)
    .maybeSingle();
  if (!existing) return { success: false, error: 'Materi tidak ditemukan.', code: 'NOT_FOUND' };

  const keepsFile = !remove_file && Boolean(existing.file_path);
  if (!fields.content && !fields.external_url && !keepsFile && !hasFile(file)) {
    return { success: false, error: 'Isi teks, tautan/video, atau berkas materi wajib diisi.', code: 'VALIDATION_ERROR' };
  }

  let newPath: string | null = null;
  try {
    newPath = await uploadLmsFile(file, `materials/${fields.classroom_id}`);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }
  const filePath = newPath ?? (remove_file ? null : existing.file_path);

  const { data, error } = await supabase
    .from('materials')
    .update({
      ...fields,
      file_path: filePath,
      published_at:
        fields.status === 'published' ? existing.published_at ?? new Date().toISOString() : existing.published_at,
    })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) {
    await removeLmsFile(newPath);
    return error ? dbError(error, 'Gagal memperbarui materi.') : { success: false, error: 'Materi tidak dapat diubah.', code: 'FORBIDDEN' };
  }
  if (existing.file_path && existing.file_path !== filePath) await removeLmsFile(existing.file_path);
  await writeAudit('update_material', 'materials', id, { status: fields.status });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Materi berhasil diperbarui.' };
}

export async function setMaterialStatusAction(input: MaterialStatusInput): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = materialStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('materials')
    .select('published_at')
    .eq('id', parsed.data.id)
    .eq('teacher_id', teacher.teacherId)
    .maybeSingle();
  if (!existing) return { success: false, error: 'Materi tidak ditemukan.', code: 'NOT_FOUND' };
  const { error } = await supabase
    .from('materials')
    .update({
      status: parsed.data.status,
      published_at:
        parsed.data.status === 'published' ? existing.published_at ?? new Date().toISOString() : existing.published_at,
    })
    .eq('id', parsed.data.id);
  if (error) return dbError(error, 'Gagal mengubah status materi.');
  await writeAudit('update_material_status', 'materials', parsed.data.id, { status: parsed.data.status });
  revalidateDashboards();
  const label = { draft: 'dijadikan draf', published: 'dipublikasikan', archived: 'diarsipkan' }[parsed.data.status];
  return { success: true, data: undefined, message: `Materi berhasil ${label}.` };
}

export async function deleteMaterialAction(id: string): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = lmsFileRequestSchema.shape.id.safeParse(id);
  if (!parsed.success) return { success: false, error: 'Materi tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('materials')
    .delete()
    .eq('id', parsed.data)
    .eq('teacher_id', teacher.teacherId)
    .select('file_path');
  if (error) return dbError(error, 'Gagal menghapus materi.');
  if (!data?.length) return { success: false, error: 'Materi tidak ditemukan.', code: 'NOT_FOUND' };
  await removeLmsFile(data[0].file_path);
  await writeAudit('delete_material', 'materials', parsed.data, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Materi berhasil dihapus.' };
}

// ============================================================================
// TUGAS
// ============================================================================

function publishDeadlineError(status: string, dueAt: string): ActionError | null {
  if (status === 'published' && new Date(dueAt).getTime() <= Date.now()) {
    return { success: false, error: 'Batas waktu harus di masa depan saat tugas dipublikasikan.', code: 'VALIDATION_ERROR' };
  }
  return null;
}

export async function createAssignmentAction(input: AssignmentInput, file: File | null): Promise<IdResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const deadlineError = publishDeadlineError(parsed.data.status, parsed.data.due_at);
  if (deadlineError) return deadlineError;

  let filePath: string | null = null;
  try {
    filePath = await uploadLmsFile(file, `assignments/${parsed.data.classroom_id}`);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      ...parsed.data,
      late_tolerance_minutes: parsed.data.allow_late_submission ? parsed.data.late_tolerance_minutes : null,
      teacher_id: teacher.teacherId,
      file_path: filePath,
    })
    .select('id')
    .single();
  if (error || !data) {
    await removeLmsFile(filePath);
    return dbError(error, 'Gagal membuat tugas. Pastikan Anda mengampu kelas dan mapel tersebut.');
  }
  await writeAudit('create_assignment', 'assignments', data.id, { status: parsed.data.status, max_score: parsed.data.max_score });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Tugas berhasil disimpan.' };
}

export async function updateAssignmentAction(input: AssignmentUpdateInput, file: File | null): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = assignmentUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { id, remove_file, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('assignments')
    .select('file_path, status')
    .eq('id', id)
    .eq('teacher_id', teacher.teacherId)
    .maybeSingle();
  if (!existing) return { success: false, error: 'Tugas tidak ditemukan.', code: 'NOT_FOUND' };
  // Deadline di masa depan hanya diwajibkan saat tugas baru dipublikasikan.
  if (existing.status !== 'published') {
    const deadlineError = publishDeadlineError(fields.status, fields.due_at);
    if (deadlineError) return deadlineError;
  }

  let newPath: string | null = null;
  try {
    newPath = await uploadLmsFile(file, `assignments/${fields.classroom_id}`);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }
  const filePath = newPath ?? (remove_file ? null : existing.file_path);

  const { data, error } = await supabase
    .from('assignments')
    .update({
      ...fields,
      late_tolerance_minutes: fields.allow_late_submission ? fields.late_tolerance_minutes : null,
      file_path: filePath,
    })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) {
    await removeLmsFile(newPath);
    return error ? dbError(error, 'Gagal memperbarui tugas.') : { success: false, error: 'Tugas tidak dapat diubah.', code: 'FORBIDDEN' };
  }
  if (existing.file_path && existing.file_path !== filePath) await removeLmsFile(existing.file_path);
  await writeAudit('update_assignment', 'assignments', id, { status: fields.status, max_score: fields.max_score });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tugas berhasil diperbarui.' };
}

export async function closeAssignmentAction(id: string): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = lmsFileRequestSchema.shape.id.safeParse(id);
  if (!parsed.success) return { success: false, error: 'Tugas tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments')
    .update({ status: 'closed' })
    .eq('id', parsed.data)
    .eq('teacher_id', teacher.teacherId)
    .select('id');
  if (error) return dbError(error, 'Gagal menutup tugas.');
  if (!data?.length) return { success: false, error: 'Tugas tidak ditemukan.', code: 'NOT_FOUND' };
  await writeAudit('close_assignment', 'assignments', parsed.data, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tugas ditutup. Murid tidak dapat mengumpulkan lagi.' };
}

export async function deleteAssignmentAction(id: string): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = lmsFileRequestSchema.shape.id.safeParse(id);
  if (!parsed.success) return { success: false, error: 'Tugas tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { count } = await supabase
    .from('assignment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', parsed.data);
  if ((count ?? 0) > 0) {
    return { success: false, error: 'Tugas yang sudah memiliki pengumpulan tidak dapat dihapus. Tutup tugas sebagai gantinya.', code: 'FORBIDDEN' };
  }
  const { data, error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', parsed.data)
    .eq('teacher_id', teacher.teacherId)
    .select('file_path');
  if (error) return dbError(error, 'Gagal menghapus tugas.');
  if (!data?.length) return { success: false, error: 'Tugas tidak ditemukan.', code: 'NOT_FOUND' };
  await removeLmsFile(data[0].file_path);
  await writeAudit('delete_assignment', 'assignments', parsed.data, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tugas berhasil dihapus.' };
}

// ============================================================================
// PENGUMPULAN & PENILAIAN
// ============================================================================

export async function submitAssignmentAction(input: SubmissionInput, file: File | null): Promise<IdResult> {
  const { user } = await requireRole(['murid']);
  if (!(await allowRequest('assignmentSubmit', user.id))) {
    return rateLimitedError('Terlalu banyak pengumpulan tugas. Silakan coba lagi dalam 1 jam.');
  }
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', user.id).maybeSingle();
  if (!student) return { success: false, error: 'Profil murid tidak ditemukan.', code: 'FORBIDDEN' };

  const { data: existing } = await supabase
    .from('assignment_submissions')
    .select('id, file_path, status')
    .eq('assignment_id', parsed.data.assignment_id)
    .eq('student_id', student.id)
    .maybeSingle();
  if (existing?.status === 'graded') {
    return { success: false, error: 'Tugas sudah dinilai dan tidak dapat dikumpulkan ulang.', code: 'FORBIDDEN' };
  }
  if (!parsed.data.answer_text && !hasFile(file) && !existing?.file_path) {
    return { success: false, error: 'Jawaban teks atau berkas wajib diisi.', code: 'VALIDATION_ERROR' };
  }

  let newPath: string | null = null;
  try {
    newPath = await uploadLmsFile(file, `submissions/${parsed.data.assignment_id}/${student.id}`);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }

  const { data, error } = await supabase
    .from('assignment_submissions')
    .upsert(
      {
        assignment_id: parsed.data.assignment_id,
        student_id: student.id,
        answer_text: parsed.data.answer_text,
        file_path: newPath ?? existing?.file_path ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id, status')
    .single();
  if (error || !data) {
    await removeLmsFile(newPath);
    return dbError(error, 'Gagal mengumpulkan tugas.');
  }
  if (newPath && existing?.file_path) await removeLmsFile(existing.file_path);
  revalidateDashboards();
  return {
    success: true,
    data: { id: data.id },
    message: data.status === 'late' ? 'Tugas terkumpul (terlambat).' : 'Tugas berhasil dikumpulkan.',
  };
}

export async function gradeSubmissionAction(input: GradeSubmissionInput): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = gradeSubmissionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_submissions')
    .update({
      score: parsed.data.score,
      feedback: parsed.data.feedback,
      graded_by: teacher.teacherId,
      graded_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.submission_id)
    .select('id');
  if (error) return dbError(error, 'Gagal menyimpan nilai.');
  if (!data?.length) return { success: false, error: 'Pengumpulan tidak ditemukan atau bukan tugas Anda.', code: 'FORBIDDEN' };
  await writeAudit('grade_submission', 'assignment_submissions', parsed.data.submission_id, { score: parsed.data.score });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Nilai dan umpan balik berhasil disimpan.' };
}

export async function saveFinalGradeAction(input: FinalGradeInput): Promise<IdResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  const parsed = finalGradeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const scope = {
    student_id: parsed.data.student_id,
    subject_id: parsed.data.subject_id,
    classroom_id: parsed.data.classroom_id,
    semester_id: parsed.data.semester_id,
  };
  const { data: existing } = await supabase
    .from('grades')
    .select('id')
    .match({ ...scope, grade_type: 'final' })
    .maybeSingle();

  const values = {
    ...scope,
    score: parsed.data.score,
    description: parsed.data.description,
    teacher_id: teacher.teacherId,
    grade_type: 'final',
  };
  const { data, error } = existing
    ? await supabase.from('grades').update(values).eq('id', existing.id).select('id').single()
    : await supabase.from('grades').insert(values).select('id').single();
  if (error || !data) return dbError(error, 'Gagal menyimpan nilai akhir. Pastikan Anda mengampu kelas dan mapel ini.');
  await writeAudit('save_final_grade', 'grades', data.id, { score: parsed.data.score });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Nilai akhir semester berhasil disimpan.' };
}

// ============================================================================
// JADWAL
// ============================================================================

async function ensureTeachingAssignment(input: {
  teacher_id: string; subject_id: string; classroom_id: string; semester_id: string;
}): Promise<ActionError | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('teaching_assignments')
    .select('id')
    .match(input)
    .maybeSingle();
  return data
    ? null
    : { success: false, error: 'Guru belum ditugaskan pada rombel, mapel, dan semester tersebut.', code: 'FORBIDDEN' };
}

export async function createScheduleAction(input: ScheduleInput): Promise<IdResult> {
  await requireRole(['admin', 'super_admin']);
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { semester_id, ...fields } = parsed.data;
  const missing = await ensureTeachingAssignment({
    teacher_id: fields.teacher_id,
    subject_id: fields.subject_id,
    classroom_id: fields.classroom_id,
    semester_id,
  });
  if (missing) return missing;
  const supabase = await createClient();
  const { data, error } = await supabase.from('schedules').insert(fields).select('id').single();
  if (error || !data) return dbError(error, 'Gagal menyimpan jadwal.');
  await writeAudit('create_schedule', 'schedules', data.id, { day_of_week: fields.day_of_week });
  revalidateDashboards();
  return { success: true, data: { id: data.id }, message: 'Jadwal berhasil disimpan.' };
}

export async function updateScheduleAction(input: ScheduleUpdateInput): Promise<VoidResult> {
  await requireRole(['admin', 'super_admin']);
  const parsed = scheduleUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { id, semester_id, ...fields } = parsed.data;
  const missing = await ensureTeachingAssignment({
    teacher_id: fields.teacher_id,
    subject_id: fields.subject_id,
    classroom_id: fields.classroom_id,
    semester_id,
  });
  if (missing) return missing;
  const supabase = await createClient();
  const { data, error } = await supabase.from('schedules').update(fields).eq('id', id).select('id');
  if (error) return dbError(error, 'Gagal memperbarui jadwal.');
  if (!data?.length) return { success: false, error: 'Jadwal tidak ditemukan.', code: 'NOT_FOUND' };
  await writeAudit('update_schedule', 'schedules', id, { day_of_week: fields.day_of_week });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Jadwal berhasil diperbarui.' };
}

export async function deleteScheduleAction(id: string): Promise<VoidResult> {
  await requireRole(['admin', 'super_admin']);
  const parsed = lmsFileRequestSchema.shape.id.safeParse(id);
  if (!parsed.success) return { success: false, error: 'Jadwal tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('schedules').delete().eq('id', parsed.data).select('id');
  if (error) return dbError(error, 'Gagal menghapus jadwal.');
  if (!data?.length) return { success: false, error: 'Jadwal tidak ditemukan.', code: 'NOT_FOUND' };
  await writeAudit('delete_schedule', 'schedules', parsed.data, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Jadwal berhasil dihapus.' };
}

// ============================================================================
// PRESENSI
// ============================================================================

export async function recordTeacherAttendanceAction(session: 'check_in' | 'check_out'): Promise<IdResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  if (session !== 'check_in' && session !== 'check_out') {
    return { success: false, error: 'Sesi presensi tidak valid.', code: 'VALIDATION_ERROR' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teacher_attendances')
    // attendance_date & status ditentukan trigger memakai jam server (Asia/Jakarta).
    .insert({ teacher_id: teacher.teacherId, attendance_date: jakartaToday(), session, recorded_by: teacher.userId })
    .select('id, status')
    .single();
  if (error || !data) {
    if (error?.code === '23505') {
      return {
        success: false,
        error: session === 'check_in' ? 'Anda sudah check-in hari ini.' : 'Anda sudah check-out hari ini.',
        code: 'DUPLICATE_ENTRY',
      };
    }
    return dbError(error, 'Presensi tidak dapat dicatat.');
  }
  await writeAudit(`teacher_${session}`, 'teacher_attendances', data.id, { session, status: data.status });
  revalidateDashboards();
  const message =
    session === 'check_out'
      ? 'Check-out berhasil dicatat.'
      : data.status === 'late'
        ? 'Check-in tercatat terlambat (setelah 07.00 WIB).'
        : 'Check-in tepat waktu berhasil dicatat.';
  return { success: true, data: { id: data.id }, message };
}

export async function recordStudentAttendanceAction(input: StudentAttendanceInput): Promise<VoidResult> {
  const { user } = await requireRole(['guru']);
  const parsed = studentAttendanceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const today = jakartaToday();
  const supabase = await createClient();
  const rows = parsed.data.records.map((record) => ({
    ...record,
    schedule_id: parsed.data.schedule_id,
    classroom_id: parsed.data.classroom_id,
    attendance_date: today,
    recorded_by: user.id,
  }));
  const { error } = await supabase
    .from('student_attendances')
    .upsert(rows, { onConflict: 'student_id,schedule_id,attendance_date' });
  if (error) return dbError(error, 'Presensi murid tidak dapat disimpan.');
  await writeAudit('record_student_attendance', 'student_attendances', parsed.data.schedule_id, { count: rows.length });
  revalidateDashboards();
  return { success: true, data: undefined, message: `Presensi ${rows.length} murid berhasil disimpan.` };
}

export async function updateWeekendAttendanceAction(enabled: boolean): Promise<VoidResult> {
  const teacher = await requireTeacher();
  if ('success' in teacher) return teacher;
  if (typeof enabled !== 'boolean') return { success: false, error: 'Nilai tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data: position } = await supabase
    .from('teacher_positions')
    .select('id, positions!inner(code)')
    .eq('teacher_id', teacher.teacherId)
    .eq('is_active', true)
    .eq('positions.code', 'kepala_sekolah')
    .limit(1)
    .maybeSingle();
  if (!position) {
    return { success: false, error: 'Hanya kepala sekolah yang dapat mengubah presensi akhir pekan.', code: 'FORBIDDEN' };
  }

  const admin = createAdminClient();
  const { data: year } = await admin.from('academic_years').select('id').eq('is_active', true).maybeSingle();
  if (!year) return { success: false, error: 'Belum ada tahun ajaran aktif.', code: 'NOT_FOUND' };
  const { data, error } = await admin
    .from('school_period_settings')
    .update({ teacher_weekend_attendance_enabled: enabled })
    .eq('academic_year_id', year.id)
    .select('id');
  if (error) return dbError(error, 'Gagal memperbarui pengaturan presensi.');
  if (!data?.length) {
    return { success: false, error: 'Pengaturan periode sekolah untuk tahun ajaran aktif belum dibuat admin.', code: 'NOT_FOUND' };
  }
  await writeAudit('update_weekend_attendance', 'school_period_settings', data[0].id, { enabled });
  revalidateDashboards();
  return {
    success: true,
    data: undefined,
    message: enabled ? 'Presensi guru akhir pekan diaktifkan.' : 'Presensi guru akhir pekan dinonaktifkan.',
  };
}

// ============================================================================
// BERKAS LMS (signed URL)
// ============================================================================

/**
 * Hak akses dibuktikan dengan membaca baris lewat client ber-RLS. Hanya jika baris
 * terbaca, server membuat signed URL berumur 5 menit memakai admin client.
 */
export async function getLmsFileUrlAction(input: LmsFileRequest): Promise<ActionResult<{ url: string }>> {
  await requireUser();
  const parsed = lmsFileRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Permintaan berkas tidak valid.', code: 'VALIDATION_ERROR' };
  const table = {
    material: 'materials',
    assignment: 'assignments',
    submission: 'assignment_submissions',
  }[parsed.data.kind];

  const supabase = await createClient();
  const { data } = await supabase.from(table).select('file_path').eq('id', parsed.data.id).maybeSingle();
  if (!data?.file_path) return { success: false, error: 'Berkas tidak ditemukan atau Anda tidak memiliki akses.', code: 'NOT_FOUND' };
  try {
    const url = await createAdminSignedUrl('lms-files', data.file_path, 300);
    return { success: true, data: { url } };
  } catch {
    return { success: false, error: 'Berkas tidak dapat dibuka saat ini.', code: 'STORAGE_ERROR' };
  }
}
