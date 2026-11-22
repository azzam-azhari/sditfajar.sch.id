import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { jakartaIsoDow, monthRange } from '@/lib/date';

/**
 * Data akademik satu murid untuk dashboard murid dan wali murid.
 * Semua query memakai client ber-RLS: murid hanya melihat datanya sendiri,
 * wali hanya melihat data anak yang terhubung lewat parent_students.
 */

export interface TodaySlot {
  id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  subjects: { name: string } | null;
  teachers: { profiles: { name: string } | null } | null;
}

export interface MaterialView {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  external_url: string | null;
  file_path: string | null;
  published_at: string | null;
  subjects: { name: string } | null;
}

export interface AssignmentView {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  file_path: string | null;
  status: 'published' | 'closed';
  due_at: string | null;
  allow_late_submission: boolean;
  late_tolerance_minutes: number | null;
  max_score: number;
  subjects: { name: string } | null;
  submission: {
    id: string;
    status: 'not_submitted' | 'submitted' | 'late' | 'graded';
    answer_text: string | null;
    file_path: string | null;
    submitted_at: string | null;
    score: number | null;
    feedback: string | null;
  } | null;
}

export interface FinalGradeView {
  id: string;
  score: number;
  description: string | null;
  subjects: { name: string } | null;
  semesters: { name: string } | null;
}

export interface AttendanceView {
  id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
  schedules: { start_time: string; subjects: { name: string } | null } | null;
}

export interface AnnouncementView {
  id: string;
  title: string;
  content: string;
  published_at: string | null;
  created_at: string;
}

export async function getTodaySchedule(classroomId: string | null): Promise<TodaySlot[]> {
  if (!classroomId) return [];
  const dow = jakartaIsoDow();
  if (dow > 5) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('schedules')
    .select('id, start_time, end_time, room, subjects(name), teachers(profiles(name))')
    .eq('classroom_id', classroomId)
    .eq('day_of_week', dow)
    .order('start_time');
  return (data ?? []) as unknown as TodaySlot[];
}

export async function getClassMaterials(classroomId: string | null, limit?: number): Promise<MaterialView[]> {
  if (!classroomId) return [];
  const supabase = await createClient();
  let query = supabase
    .from('materials')
    .select('id, title, description, content, external_url, file_path, published_at, subjects(name)')
    .eq('classroom_id', classroomId)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return (data ?? []) as unknown as MaterialView[];
}

export async function getStudentAssignments(studentId: string, classroomId: string | null): Promise<AssignmentView[]> {
  if (!classroomId) return [];
  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, description, instructions, file_path, status, due_at, allow_late_submission, late_tolerance_minutes, max_score, subjects(name)')
    .eq('classroom_id', classroomId)
    .in('status', ['published', 'closed'])
    .order('due_at', { ascending: true, nullsFirst: false });
  const ids = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = ids.length
    ? await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, status, answer_text, file_path, submitted_at, score, feedback')
        .eq('student_id', studentId)
        .in('assignment_id', ids)
    : { data: [] };
  return ((assignments ?? []) as unknown as Omit<AssignmentView, 'submission'>[]).map((a) => {
    const sub = (submissions ?? []).find((s) => s.assignment_id === a.id);
    return {
      ...a,
      max_score: Number(a.max_score),
      submission: sub
        ? {
            id: sub.id,
            status: sub.status,
            answer_text: sub.answer_text,
            file_path: sub.file_path,
            submitted_at: sub.submitted_at,
            score: sub.score === null ? null : Number(sub.score),
            feedback: sub.feedback,
          }
        : null,
    };
  });
}

export async function getFinalGrades(studentId: string): Promise<FinalGradeView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('grades')
    .select('id, score, description, subjects(name), semesters(name)')
    .eq('student_id', studentId)
    .eq('grade_type', 'final')
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as FinalGradeView[]).map((g) => ({ ...g, score: Number(g.score) }));
}

export async function getAttendance(studentId: string, month: string): Promise<AttendanceView[]> {
  const { start, end } = monthRange(month);
  const supabase = await createClient();
  const { data } = await supabase
    .from('student_attendances')
    .select('id, attendance_date, status, notes, schedules(start_time, subjects(name))')
    .eq('student_id', studentId)
    .gte('attendance_date', start)
    .lte('attendance_date', end)
    .order('attendance_date', { ascending: false });
  return (data ?? []) as unknown as AttendanceView[];
}

export function summarizeAttendance(rows: { status: string }[]) {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const present = count('present') + count('late');
  return {
    present,
    excused: count('excused'),
    sick: count('sick'),
    absent: count('absent'),
    total: rows.length,
    rate: rows.length ? Math.round((present / rows.length) * 100) : null,
  };
}

/**
 * Pengumuman terpublikasi yang terlihat oleh pengguna (penyaringan target oleh RLS).
 * `forStudent` mempersempit hasil untuk satu anak (dipakai wali dengan banyak anak).
 */
export async function getAnnouncements(
  limit = 5,
  forStudent?: { studentId: string; classroomId: string | null }
): Promise<AnnouncementView[]> {
  const supabase = await createClient();
  let query = supabase
    .from('announcements')
    .select('id, title, content, published_at, created_at')
    .eq('status', 'published');
  if (forStudent) {
    // Nilai berasal dari server (UUID tervalidasi), bukan input pengguna.
    const parts = ['target_type.eq.all', 'target_type.eq.role', `and(target_type.eq.student,student_id.eq.${forStudent.studentId})`];
    if (forStudent.classroomId) parts.push(`and(target_type.eq.class,classroom_id.eq.${forStudent.classroomId})`);
    query = query.or(parts.join(','));
  }
  const { data } = await query.order('published_at', { ascending: false, nullsFirst: false }).limit(limit);
  return (data ?? []) as AnnouncementView[];
}

export function averageAssignmentScore(assignments: AssignmentView[]): number | null {
  const scores = assignments
    .filter((a) => a.submission?.score !== null && a.submission?.score !== undefined)
    .map((a) => ((a.submission!.score as number) / a.max_score) * 100);
  return scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;
}
