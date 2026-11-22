import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { getTahfidzRecords, isTahfidzSubject, summarizeTahfidz } from '@/lib/data/tahfidz';
import { jakartaToday } from '@/lib/date';
import { getSurah } from '@/constants/quran';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/lms/section-card';
import { TahfidzSummaryCards } from '@/components/lms/tahfidz-views';
import { TahfidzClient, type StudentOption, type RecapRow } from './_components/tahfidz-client';

export const instant = false;

type MemberRow = {
  student_id: string;
  classroom_id: string;
  classrooms: { name: string } | null;
  students: { nis: string; profiles: { name: string } | null } | null;
};

export default async function GuruTahfidzPage(props: { searchParams: Promise<{ murid?: string; tab?: string }> }) {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;
  const params = await props.searchParams;
  const isCoordinator = ctx.positions.includes('koordinator_tahfidz');

  const classIds = Array.from(
    new Set([
      ...ctx.homerooms.map((h) => h.id),
      ...ctx.assignments.filter((a) => isTahfidzSubject(a.subject)).map((a) => a.classroom.id),
    ])
  );

  const supabase = await createClient();
  let memberQuery = supabase
    .from('class_students')
    .select('student_id, classroom_id, classrooms(name), students(nis, profiles(name))')
    .eq('status', 'active')
    .is('left_at', null);
  if (!isCoordinator) memberQuery = memberQuery.in('classroom_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: members } = await memberQuery;

  const students: StudentOption[] = ((members ?? []) as unknown as MemberRow[])
    .map((m) => ({
      id: m.student_id,
      label: `${m.students?.profiles?.name ?? '-'} · ${m.classrooms?.name ?? '-'}`,
      name: m.students?.profiles?.name ?? '-',
      nis: m.students?.nis ?? '-',
      classroom: m.classrooms?.name ?? '-',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const header = (
    <PageHeader
      title="Tahfidz & Tahsin"
      description="Catat setoran hafalan harian murid (mutaba'ah). Pencatat: wali kelas murid, pengampu mapel Tahfidz di kelasnya, dan koordinator tahfidz."
    />
  );

  if (students.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title="Belum ada murid yang dapat Anda catat"
          description="Anda belum menjadi wali kelas, pengampu mapel Tahfidz, atau koordinator tahfidz."
        />
      </div>
    );
  }

  const selected = students.find((s) => s.id === params.murid) ?? students[0];
  const allRecords = isCoordinator ? await getTahfidzRecords(students.map((s) => s.id)) : await getTahfidzRecords([selected.id]);
  const selectedRecords = allRecords.filter((r) => r.student_id === selected.id);

  const recap: RecapRow[] = isCoordinator
    ? students.map((s) => {
        const summary = summarizeTahfidz(allRecords.filter((r) => r.student_id === s.id));
        return {
          studentId: s.id,
          nis: s.nis,
          name: s.name,
          classroom: s.classroom,
          records: summary.totalRecords,
          ayat: summary.totalAyat,
          pages: summary.totalPages,
          highestJuz: summary.highestJuz,
          lastDate: summary.last?.record_date ?? null,
          lastSurah: summary.last ? `${getSurah(summary.last.surah_number)?.name ?? '-'} ${summary.last.ayat_start}–${summary.last.ayat_end}` : null,
          lastPredicate: summary.last?.predicate ?? null,
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {header}
      <SectionCard title={`Progres ${selected.name}`} description={`NIS ${selected.nis} · ${selected.classroom}`}>
        <TahfidzSummaryCards summary={summarizeTahfidz(selectedRecords)} />
      </SectionCard>
      <TahfidzClient
        key={selected.id}
        currentUserId={user.id}
        students={students}
        selectedStudentId={selected.id}
        records={selectedRecords}
        today={jakartaToday()}
        isCoordinator={isCoordinator}
        recap={recap}
        initialTab={params.tab === 'rekap' && isCoordinator ? 'rekap' : 'setoran'}
      />
    </div>
  );
}
