import { createClient } from '@/lib/supabase/server';
import { jakartaMonth, monthRange } from '@/lib/date';
import type { ClassroomRef } from '@/lib/data/lms';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { SectionCard } from '@/components/lms/section-card';

type MemberRow = { student_id: string; students: { nis: string; profiles: { name: string } | null } | null };
type SubmissionRow = { student_id: string; status: string; score: number | null };

interface StudentProgress {
  id: string;
  nis: string;
  name: string;
  averageScore: number | null;
  missing: number;
  attendanceRate: number | null;
  absent: number;
}

/** Panel wali kelas: progres nilai, tugas belum dikumpulkan, dan kehadiran murid kelas binaan. */
export async function HomeroomPanel({
  classroom,
  activeSemesterId,
}: {
  classroom: ClassroomRef;
  activeSemesterId: string | null;
}) {
  const supabase = await createClient();
  const month = jakartaMonth();
  const { start, end } = monthRange(month);

  const [{ data: members }, { data: assignments }, { data: attendance }] = await Promise.all([
    supabase
      .from('class_students')
      .select('student_id, students(nis, profiles(name))')
      .eq('classroom_id', classroom.id)
      .eq('status', 'active')
      .is('left_at', null),
    activeSemesterId
      ? supabase
          .from('assignments')
          .select('id')
          .eq('classroom_id', classroom.id)
          .eq('semester_id', activeSemesterId)
          .in('status', ['published', 'closed'])
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase
      .from('student_attendances')
      .select('student_id, status')
      .eq('classroom_id', classroom.id)
      .gte('attendance_date', start)
      .lte('attendance_date', end),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase.from('assignment_submissions').select('student_id, status, score').in('assignment_id', assignmentIds)
    : { data: [] as SubmissionRow[] };

  const rows: StudentProgress[] = ((members ?? []) as unknown as MemberRow[])
    .map((m) => {
      const subs = ((submissions ?? []) as SubmissionRow[]).filter((s) => s.student_id === m.student_id);
      const submitted = subs.filter((s) => s.status !== 'not_submitted').length;
      const scores = subs.map((s) => s.score).filter((s): s is number => s !== null).map(Number);
      const att = (attendance ?? []).filter((a) => a.student_id === m.student_id);
      const presentLike = att.filter((a) => a.status === 'present' || a.status === 'late').length;
      return {
        id: m.student_id,
        nis: m.students?.nis ?? '-',
        name: m.students?.profiles?.name ?? '-',
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        missing: Math.max(assignmentIds.length - submitted, 0),
        attendanceRate: att.length ? Math.round((presentLike / att.length) * 100) : null,
        absent: att.filter((a) => a.status === 'absent').length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const needAttention = rows.filter(
    (r) => r.missing > 0 || (r.averageScore !== null && r.averageScore < 70) || r.absent > 0
  ).length;

  return (
    <SectionCard
      title={`Wali Kelas · ${classroom.name}`}
      description={`${rows.length} murid · ${assignmentIds.length} tugas semester ini · ${needAttention} murid perlu perhatian · presensi bulan ${month}`}
    >
      <ZebraDataTable<StudentProgress>
        data={rows}
        keyExtractor={(row) => row.id}
        emptyText="Belum ada murid aktif di kelas binaan ini."
        columns={[
          { header: 'NIS', accessorKey: 'nis', isMono: true },
          { header: 'Nama', accessorKey: 'name' },
          { header: 'Rata-rata Nilai', isMono: true, align: 'right', cell: (row) => row.averageScore ?? '-' },
          {
            header: 'Tugas Belum Dikumpulkan',
            align: 'right',
            cell: (row) =>
              row.missing > 0 ? (
                <StatusBadge status={`${row.missing} tugas`} variant="warning" size="sm" />
              ) : (
                <span className="font-mono text-xs">0</span>
              ),
          },
          { header: '% Hadir', isMono: true, align: 'right', cell: (row) => (row.attendanceRate === null ? '-' : `${row.attendanceRate}%`) },
          { header: 'Alpa', isMono: true, align: 'right', accessorKey: 'absent' },
        ]}
      />
    </SectionCard>
  );
}
