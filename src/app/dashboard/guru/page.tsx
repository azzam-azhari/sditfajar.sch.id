import Link from 'next/link';
import { BookOpen, ClipboardList, Inbox, School } from 'lucide-react';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { DAY_LABELS, formatDateTime, formatTime, jakartaIsoDow } from '@/lib/date';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { SectionCard } from '@/components/lms/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PrincipalPanel } from './_components/principal-panel';
import { HomeroomPanel } from './_components/homeroom-panel';

export const instant = false;

type ScheduleRow = {
  id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  classrooms: { name: string } | null;
  subjects: { name: string } | null;
};

type PendingRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  assignments: { id: string; title: string; classrooms: { name: string } | null } | null;
  students: { profiles: { name: string } | null } | null;
};

const POSITION_LABELS: Record<string, string> = {
  kepala_sekolah: 'Kepala Sekolah',
  wakil_kepala: 'Wakil Kepala',
  bendahara: 'Bendahara',
  wali_kelas: 'Wali Kelas',
  koordinator_tahfidz: 'Koordinator Tahfidz',
  pustakawan: 'Pustakawan',
  operator: 'Operator',
};

export default async function GuruDashboardPage() {
  const { user, profile } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);

  if (!ctx) {
    return (
      <EmptyState
        title="Profil guru belum terhubung"
        description="Akun Anda belum memiliki data guru aktif. Hubungi admin sekolah."
      />
    );
  }

  const supabase = await createClient();
  const dow = jakartaIsoDow();
  const [
    { data: schedules },
    { count: materialCount },
    { count: assignmentCount },
    { data: pending, count: pendingCount },
  ] = await Promise.all([
    supabase
      .from('schedules')
      .select('id, start_time, end_time, room, classrooms(name), subjects(name)')
      .eq('teacher_id', ctx.teacherId)
      .eq('day_of_week', dow)
      .order('start_time'),
    supabase
      .from('materials')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', ctx.teacherId)
      .eq('status', 'published'),
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', ctx.teacherId)
      .eq('status', 'published'),
    supabase
      .from('assignment_submissions')
      .select(
        'id, status, submitted_at, assignments!inner(id, title, teacher_id, classrooms(name)), students(profiles(name))',
        { count: 'exact' }
      )
      .eq('assignments.teacher_id', ctx.teacherId)
      .in('status', ['submitted', 'late'])
      .order('submitted_at', { ascending: true })
      .limit(8),
  ]);

  const classCount = new Set(ctx.assignments.map((a) => a.classroom.id)).size;
  const todaySchedules = (schedules ?? []) as unknown as ScheduleRow[];
  const pendingRows = (pending ?? []) as unknown as PendingRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Assalamu'alaikum, ${profile.name}`}
        description="Ringkasan kegiatan mengajar Anda hari ini."
      >
        <div className="flex flex-wrap gap-1.5">
          {ctx.positions.map((code) => (
            <Badge key={code} variant="outline" className="text-[11px]">
              {POSITION_LABELS[code] ?? code}
            </Badge>
          ))}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Kelas Diampu" value={classCount} description={`${ctx.assignments.length} penugasan mapel`} icon={<School className="size-4" />} isMono />
        <StatCard title="Materi Aktif" value={materialCount ?? 0} description="Materi terpublikasi" icon={<BookOpen className="size-4" />} isMono />
        <StatCard title="Tugas Aktif" value={assignmentCount ?? 0} description="Tugas sedang dibuka" icon={<ClipboardList className="size-4" />} isMono />
        <StatCard title="Perlu Dinilai" value={pendingCount ?? 0} description="Pengumpulan menunggu nilai" icon={<Inbox className="size-4" />} isMono />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={`Jadwal Hari Ini · ${DAY_LABELS[dow]}`}
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/dashboard/jadwal">Jadwal lengkap</Link>
            </Button>
          }
        >
          <ZebraDataTable<ScheduleRow>
            data={todaySchedules}
            keyExtractor={(row) => row.id}
            emptyText={dow > 5 ? 'Tidak ada kegiatan belajar di akhir pekan.' : 'Tidak ada jadwal mengajar hari ini.'}
            columns={[
              { header: 'Jam', isMono: true, cell: (row) => `${formatTime(row.start_time)}–${formatTime(row.end_time)}` },
              { header: 'Mapel', cell: (row) => row.subjects?.name ?? '-' },
              { header: 'Kelas', cell: (row) => row.classrooms?.name ?? '-' },
              { header: 'Ruang', cell: (row) => row.room ?? '-' },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Pengumpulan Menunggu Nilai"
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/dashboard/guru/tugas">Buka tugas</Link>
            </Button>
          }
        >
          <ZebraDataTable<PendingRow>
            data={pendingRows}
            keyExtractor={(row) => row.id}
            emptyText="Semua pengumpulan sudah dinilai."
            columns={[
              { header: 'Murid', cell: (row) => row.students?.profiles?.name ?? '-' },
              { header: 'Tugas', cell: (row) => row.assignments?.title ?? '-' },
              { header: 'Kelas', cell: (row) => row.assignments?.classrooms?.name ?? '-' },
              {
                header: 'Dikumpulkan',
                cell: (row) => (
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{formatDateTime(row.submitted_at)}</span>
                    {row.status === 'late' && <StatusBadge status="Terlambat" variant="warning" size="sm" />}
                  </span>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>

      {ctx.isPrincipal && <PrincipalPanel activeSemesterId={ctx.activeSemesterId} />}
      {ctx.homerooms.map((classroom) => (
        <HomeroomPanel key={classroom.id} classroom={classroom} activeSemesterId={ctx.activeSemesterId} />
      ))}
    </div>
  );
}
