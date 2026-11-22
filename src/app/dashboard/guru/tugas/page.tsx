import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { TugasClient, type AssignmentItem, type SubmissionItem, type MemberItem } from './_components/tugas-client';

export const instant = false;

export default async function GuruTugasPage() {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) {
    return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;
  }

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from('assignments')
    .select(
      'id, title, description, instructions, file_path, status, due_at, allow_late_submission, late_tolerance_minutes, max_score, classroom_id, subject_id, semester_id, created_at, classrooms(name), subjects(name)'
    )
    .eq('teacher_id', ctx.teacherId)
    .order('due_at', { ascending: false, nullsFirst: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const classroomIds = Array.from(new Set((assignments ?? []).map((a) => a.classroom_id)));

  const [{ data: submissions }, { data: members }] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from('assignment_submissions')
          .select('id, assignment_id, student_id, answer_text, file_path, status, submitted_at, score, feedback, students(nis, profiles(name))')
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] }),
    classroomIds.length
      ? supabase
          .from('class_students')
          .select('classroom_id, student_id, students(nis, profiles(name))')
          .in('classroom_id', classroomIds)
          .eq('status', 'active')
          .is('left_at', null)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tugas & Penilaian"
        description="Buat tugas dengan batas waktu dan toleransi keterlambatan, pantau pengumpulan murid, lalu beri nilai 0–100 beserta umpan balik."
      />
      <TugasClient
        initialAssignments={(assignments ?? []) as unknown as AssignmentItem[]}
        submissions={(submissions ?? []) as unknown as SubmissionItem[]}
        members={(members ?? []) as unknown as MemberItem[]}
        teachingAssignments={ctx.assignments}
      />
    </div>
  );
}
