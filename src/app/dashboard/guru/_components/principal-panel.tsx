import { createClient } from '@/lib/supabase/server';
import { formatTime, jakartaMonth, jakartaToday, monthRange } from '@/lib/date';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { SectionCard } from '@/components/lms/section-card';

type TeacherRow = { id: string; profiles: { name: string } | null };
type TeacherAttendanceRow = { teacher_id: string; session: string; status: string; recorded_at: string };
type ClassroomRow = { id: string; name: string };

interface TeacherRecap {
  id: string;
  name: string;
  checkIn: TeacherAttendanceRow | null;
  checkOut: TeacherAttendanceRow | null;
}

interface ClassRecap {
  id: string;
  name: string;
  students: number;
  assignments: number;
  completion: number | null;
  averageScore: number | null;
  present: number;
  excused: number;
  sick: number;
  absent: number;
  attendanceRate: number | null;
}

function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function timeOf(iso: string): string {
  return formatTime(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  );
}

/** Panel jabatan kepala sekolah: rekap presensi seluruh guru/murid dan laporan akademik lintas kelas. */
export async function PrincipalPanel({ activeSemesterId }: { activeSemesterId: string | null }) {
  const supabase = await createClient();
  const today = jakartaToday();
  const month = jakartaMonth();
  const { start, end } = monthRange(month);

  const [
    { data: teachers },
    { data: teacherAttendance },
    { data: classrooms },
    { data: members },
    { data: studentAttendance },
    { data: assignments },
    { data: submissions },
  ] = await Promise.all([
    supabase.from('teachers').select('id, profiles(name)').eq('is_active', true),
    supabase.from('teacher_attendances').select('teacher_id, session, status, recorded_at').eq('attendance_date', today),
    supabase
      .from('classrooms')
      .select('id, name, academic_years!inner(is_active)')
      .eq('academic_years.is_active', true)
      .order('name'),
    supabase.from('class_students').select('classroom_id').eq('status', 'active').is('left_at', null),
    supabase.from('student_attendances').select('classroom_id, status').gte('attendance_date', start).lte('attendance_date', end),
    activeSemesterId
      ? supabase.from('assignments').select('id, classroom_id').eq('semester_id', activeSemesterId).in('status', ['published', 'closed'])
      : Promise.resolve({ data: [] as { id: string; classroom_id: string }[] }),
    activeSemesterId
      ? supabase
          .from('assignment_submissions')
          .select('status, score, assignments!inner(classroom_id, semester_id)')
          .eq('assignments.semester_id', activeSemesterId)
      : Promise.resolve({ data: [] as { status: string; score: number | null; assignments: { classroom_id: string } }[] }),
  ]);

  const attendanceRows = (teacherAttendance ?? []) as TeacherAttendanceRow[];
  const teacherRecap: TeacherRecap[] = ((teachers ?? []) as unknown as TeacherRow[])
    .map((t) => ({
      id: t.id,
      name: t.profiles?.name ?? '-',
      checkIn: attendanceRows.find((a) => a.teacher_id === t.id && a.session === 'check_in') ?? null,
      checkOut: attendanceRows.find((a) => a.teacher_id === t.id && a.session === 'check_out') ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const onTime = teacherRecap.filter((t) => t.checkIn?.status === 'present').length;
  const late = teacherRecap.filter((t) => t.checkIn?.status === 'late').length;
  const notYet = teacherRecap.length - onTime - late;

  const submissionRows = (submissions ?? []) as unknown as {
    status: string;
    score: number | null;
    assignments: { classroom_id: string } | null;
  }[];

  const classRecap: ClassRecap[] = ((classrooms ?? []) as unknown as ClassroomRow[]).map((c) => {
    const students = (members ?? []).filter((m) => m.classroom_id === c.id).length;
    const classAssignments = (assignments ?? []).filter((a) => a.classroom_id === c.id).length;
    const classSubs = submissionRows.filter((s) => s.assignments?.classroom_id === c.id);
    const submitted = classSubs.filter((s) => s.status !== 'not_submitted').length;
    const scores = classSubs.map((s) => s.score).filter((s): s is number => s !== null).map(Number);
    const att = (studentAttendance ?? []).filter((a) => a.classroom_id === c.id);
    const count = (status: string) => att.filter((a) => a.status === status).length;
    const presentLike = count('present') + count('late');
    return {
      id: c.id,
      name: c.name,
      students,
      assignments: classAssignments,
      completion: percent(submitted, students * classAssignments),
      averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      present: presentLike,
      excused: count('excused'),
      sick: count('sick'),
      absent: count('absent'),
      attendanceRate: percent(presentLike, att.length),
    };
  });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Kepala Sekolah · Presensi Guru Hari Ini"
        description={`Tepat waktu ${onTime} · Terlambat ${late} · Belum check-in ${notYet}`}
      >
        <ZebraDataTable<TeacherRecap>
          data={teacherRecap}
          keyExtractor={(row) => row.id}
          emptyText="Belum ada data guru aktif."
          columns={[
            { header: 'Guru', accessorKey: 'name' },
            {
              header: 'Check-in',
              cell: (row) =>
                row.checkIn ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{timeOf(row.checkIn.recorded_at)}</span>
                    <StatusBadge
                      status={row.checkIn.status === 'late' ? 'Terlambat' : 'Tepat waktu'}
                      variant={row.checkIn.status === 'late' ? 'warning' : 'success'}
                      size="sm"
                    />
                  </span>
                ) : (
                  <StatusBadge status="Belum" variant="neutral" size="sm" />
                ),
            },
            {
              header: 'Check-out',
              isMono: true,
              cell: (row) => (row.checkOut ? timeOf(row.checkOut.recorded_at) : '-'),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Kepala Sekolah · Laporan Akademik & Presensi Murid per Kelas"
        description={`Pengumpulan dan nilai semester aktif · presensi murid bulan ${month}`}
      >
        <ZebraDataTable<ClassRecap>
          data={classRecap}
          keyExtractor={(row) => row.id}
          emptyText="Belum ada rombel pada tahun ajaran aktif."
          columns={[
            { header: 'Kelas', accessorKey: 'name' },
            { header: 'Murid', accessorKey: 'students', isMono: true, align: 'right' },
            { header: 'Tugas', accessorKey: 'assignments', isMono: true, align: 'right' },
            { header: '% Pengumpulan', isMono: true, align: 'right', cell: (row) => (row.completion === null ? '-' : `${row.completion}%`) },
            { header: 'Rata-rata Nilai', isMono: true, align: 'right', cell: (row) => row.averageScore ?? '-' },
            { header: 'H / I / S / A', isMono: true, align: 'right', cell: (row) => `${row.present} / ${row.excused} / ${row.sick} / ${row.absent}` },
            { header: '% Hadir', isMono: true, align: 'right', cell: (row) => (row.attendanceRate === null ? '-' : `${row.attendanceRate}%`) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
