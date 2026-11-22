import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { GradebookClient, type GradebookRow } from './_components/gradebook-client';

export const instant = false;

type MemberRow = { student_id: string; students: { nis: string; profiles: { name: string } | null } | null };

export default async function GuruNilaiPage(props: { searchParams: Promise<{ penugasan?: string }> }) {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;

  const { penugasan } = await props.searchParams;
  const selected = ctx.assignments.find((a) => a.id === penugasan) ?? ctx.assignments[0] ?? null;

  const header = (
    <PageHeader
      title="Buku Nilai"
      description="Rekap nilai tugas per murid dan input nilai akhir semester untuk kelas dan mapel yang Anda ampu."
    />
  );

  if (!selected) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState title="Nilai belum tersedia." description="Anda belum memiliki penugasan mengajar pada semester aktif." />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: members }, { data: assignments }, { data: finals }] = await Promise.all([
    supabase
      .from('class_students')
      .select('student_id, students(nis, profiles(name))')
      .eq('classroom_id', selected.classroom.id)
      .eq('status', 'active')
      .is('left_at', null),
    supabase
      .from('assignments')
      .select('id, title, max_score, due_at')
      .eq('teacher_id', ctx.teacherId)
      .eq('classroom_id', selected.classroom.id)
      .eq('subject_id', selected.subject.id)
      .eq('semester_id', selected.semester_id)
      .in('status', ['published', 'closed'])
      .order('due_at'),
    supabase
      .from('grades')
      .select('student_id, score, description')
      .eq('classroom_id', selected.classroom.id)
      .eq('subject_id', selected.subject.id)
      .eq('semester_id', selected.semester_id)
      .eq('grade_type', 'final'),
  ]);

  const assignmentList = (assignments ?? []) as { id: string; title: string; max_score: number }[];
  const ids = assignmentList.map((a) => a.id);
  const { data: submissions } = ids.length
    ? await supabase.from('assignment_submissions').select('assignment_id, student_id, score, status').in('assignment_id', ids)
    : { data: [] as { assignment_id: string; student_id: string; score: number | null; status: string }[] };

  const rows: GradebookRow[] = ((members ?? []) as unknown as MemberRow[])
    .map((m) => {
      const scores: Record<string, number | null> = {};
      for (const a of assignmentList) {
        const sub = (submissions ?? []).find((s) => s.assignment_id === a.id && s.student_id === m.student_id);
        // Nilai tugas dinormalisasi ke skala 100 untuk rata-rata.
        scores[a.id] = sub?.score === null || sub?.score === undefined ? null : Number(sub.score);
      }
      const normalized = assignmentList
        .map((a) => (scores[a.id] === null ? null : ((scores[a.id] as number) / Number(a.max_score)) * 100))
        .filter((v): v is number => v !== null);
      const final = (finals ?? []).find((f) => f.student_id === m.student_id);
      return {
        studentId: m.student_id,
        nis: m.students?.nis ?? '-',
        name: m.students?.profiles?.name ?? '-',
        scores,
        average: normalized.length ? Math.round(normalized.reduce((x, y) => x + y, 0) / normalized.length) : null,
        finalScore: final ? Number(final.score) : null,
        finalNote: final?.description ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {header}
      <GradebookClient
        key={selected.id}
        teachingAssignments={ctx.assignments}
        selectedId={selected.id}
        scope={{
          classroom_id: selected.classroom.id,
          subject_id: selected.subject.id,
          semester_id: selected.semester_id,
        }}
        assignments={assignmentList.map((a) => ({ id: a.id, title: a.title, max_score: Number(a.max_score) }))}
        rows={rows}
      />
    </div>
  );
}
