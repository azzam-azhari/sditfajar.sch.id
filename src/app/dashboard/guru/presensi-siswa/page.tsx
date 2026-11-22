import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { DAY_LABELS, formatDate, jakartaIsoDow, jakartaMonth, jakartaToday, monthRange } from '@/lib/date';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { StudentAttendanceClient, type SessionItem, type RosterItem, type RecapRow } from './_components/student-attendance-client';

export const instant = false;

type ScheduleRow = {
  id: string;
  classroom_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  classrooms: { name: string } | null;
  subjects: { name: string } | null;
};
type MemberRow = { classroom_id: string; student_id: string; students: { nis: string; profiles: { name: string } | null } | null };

export default async function PresensiSiswaPage(props: {
  searchParams: Promise<{ sesi?: string; bulan?: string; kelas?: string; tab?: string }>;
}) {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;

  const params = await props.searchParams;
  const supabase = await createClient();
  const dow = jakartaIsoDow();
  const today = jakartaToday();
  const homeroomIds = ctx.homerooms.map((h) => h.id);

  // Sesi hari ini: jadwal mengajar sendiri + jadwal kelas binaan (wali kelas).
  const sessionQueries = [
    supabase
      .from('schedules')
      .select('id, classroom_id, teacher_id, start_time, end_time, classrooms(name), subjects(name)')
      .eq('teacher_id', ctx.teacherId)
      .eq('day_of_week', dow),
  ];
  if (homeroomIds.length) {
    sessionQueries.push(
      supabase
        .from('schedules')
        .select('id, classroom_id, teacher_id, start_time, end_time, classrooms(name), subjects(name)')
        .in('classroom_id', homeroomIds)
        .eq('day_of_week', dow)
    );
  }
  const sessionResults = dow <= 5 ? await Promise.all(sessionQueries) : [];
  const sessionMap = new Map<string, ScheduleRow>();
  for (const res of sessionResults) for (const row of (res.data ?? []) as unknown as ScheduleRow[]) sessionMap.set(row.id, row);
  const sessions: SessionItem[] = Array.from(sessionMap.values())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s) => ({
      id: s.id,
      classroomId: s.classroom_id,
      label: `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} · ${s.subjects?.name ?? '-'} · ${s.classrooms?.name ?? '-'}`,
      isHomeroomOnly: s.teacher_id !== ctx.teacherId,
    }));
  const selectedSession = sessions.find((s) => s.id === params.sesi) ?? sessions[0] ?? null;

  // Kelas untuk rekap: kelas yang diampu + kelas binaan.
  const recapClasses = new Map<string, string>();
  for (const a of ctx.assignments) recapClasses.set(a.classroom.id, a.classroom.name);
  for (const h of ctx.homerooms) recapClasses.set(h.id, h.name);
  const recapClassList = Array.from(recapClasses, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const recapClassId = recapClassList.find((c) => c.id === params.kelas)?.id ?? recapClassList[0]?.id ?? null;
  const month = /^\d{4}-\d{2}$/.test(params.bulan ?? '') ? (params.bulan as string) : jakartaMonth();
  const { start, end } = monthRange(month);

  const classIdsNeeded = Array.from(new Set([selectedSession?.classroomId, recapClassId].filter((v): v is string => Boolean(v))));
  const [{ data: members }, { data: todayRecords }, { data: monthRecords }] = await Promise.all([
    classIdsNeeded.length
      ? supabase
          .from('class_students')
          .select('classroom_id, student_id, students(nis, profiles(name))')
          .in('classroom_id', classIdsNeeded)
          .eq('status', 'active')
          .is('left_at', null)
      : Promise.resolve({ data: [] }),
    selectedSession
      ? supabase
          .from('student_attendances')
          .select('student_id, status, notes')
          .eq('schedule_id', selectedSession.id)
          .eq('attendance_date', today)
      : Promise.resolve({ data: [] }),
    recapClassId
      ? supabase
          .from('student_attendances')
          .select('student_id, status')
          .eq('classroom_id', recapClassId)
          .gte('attendance_date', start)
          .lte('attendance_date', end)
      : Promise.resolve({ data: [] }),
  ]);

  const memberRows = (members ?? []) as unknown as MemberRow[];
  const roster: RosterItem[] = selectedSession
    ? memberRows
        .filter((m) => m.classroom_id === selectedSession.classroomId)
        .map((m) => {
          const existing = (todayRecords ?? []).find((r) => r.student_id === m.student_id);
          return {
            studentId: m.student_id,
            nis: m.students?.nis ?? '-',
            name: m.students?.profiles?.name ?? '-',
            status: (existing?.status as RosterItem['status']) ?? null,
            notes: existing?.notes ?? '',
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const recap: RecapRow[] = recapClassId
    ? memberRows
        .filter((m) => m.classroom_id === recapClassId)
        .map((m) => {
          const rec = (monthRecords ?? []).filter((r) => r.student_id === m.student_id);
          const count = (s: string) => rec.filter((r) => r.status === s).length;
          const present = count('present') + count('late');
          return {
            studentId: m.student_id,
            nis: m.students?.nis ?? '-',
            name: m.students?.profiles?.name ?? '-',
            present,
            excused: count('excused'),
            sick: count('sick'),
            absent: count('absent'),
            rate: rec.length ? Math.round((present / rec.length) * 100) : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Murid"
        description={`${DAY_LABELS[dow]}, ${formatDate(today)} · Presensi per sesi jadwal oleh guru mapel atau wali kelas. Hanya Senin–Jumat; koreksi dapat dilakukan pada hari yang sama.`}
      />
      <StudentAttendanceClient
        key={`${selectedSession?.id ?? 'none'}-${recapClassId ?? 'none'}-${month}`}
        isWeekend={dow > 5}
        sessions={sessions}
        selectedSessionId={selectedSession?.id ?? null}
        roster={roster}
        recapClasses={recapClassList}
        recapClassId={recapClassId}
        month={month}
        recap={recap}
        initialTab={params.tab === 'rekap' ? 'rekap' : 'hari-ini'}
      />
    </div>
  );
}
