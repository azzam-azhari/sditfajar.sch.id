import Link from 'next/link';
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap } from 'lucide-react';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { getStudentContext } from '@/lib/data/lms';
import {
  averageAssignmentScore, getAnnouncements, getAttendance, getClassMaterials, getStudentAssignments,
  getTodaySchedule, summarizeAttendance,
} from '@/lib/data/student-overview';
import { DAY_LABELS, jakartaIsoDow, jakartaMonth } from '@/lib/date';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/lms/section-card';
import {
  AnnouncementList, AssignmentTable, AttendanceSummary, MaterialTable, TodayScheduleTable,
} from '@/components/lms/student-views';
import { Button } from '@/components/ui/button';

export const instant = false;

export default async function MuridDashboardPage() {
  const { user } = await requireRole(['murid']);
  const student = await getStudentContext(user.id);
  if (!student) return <EmptyState title="Data murid belum terhubung" description="Hubungi admin sekolah." />;

  const classroomId = student.classroom?.id ?? null;
  const month = jakartaMonth();
  const [schedule, materials, assignments, attendance, announcements] = await Promise.all([
    getTodaySchedule(classroomId),
    getClassMaterials(classroomId, 5),
    getStudentAssignments(student.studentId, classroomId),
    getAttendance(student.studentId, month),
    getAnnouncements(5),
  ]);

  const upcoming = assignments.filter(
    (a) => a.status === 'published' && (!a.submission || a.submission.status === 'not_submitted')
  );
  const graded = assignments.filter((a) => a.submission?.status === 'graded');
  const average = averageAssignmentScore(assignments);
  const summary = summarizeAttendance(attendance);
  const dow = jakartaIsoDow();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Assalamu'alaikum, ${student.name}`}
        description={student.classroom ? `Kelas ${student.classroom.name} · NIS ${student.nis}` : 'Anda belum terdaftar di rombel aktif.'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pelajaran Hari Ini" value={schedule.length} description={DAY_LABELS[dow]} icon={<CalendarCheck className="size-4" />} isMono />
        <StatCard title="Tugas Belum Dikumpulkan" value={upcoming.length} description="Tugas yang masih dibuka" icon={<ClipboardList className="size-4" />} isMono />
        <StatCard title="Rata-rata Nilai Tugas" value={average ?? '-'} description={`${graded.length} tugas dinilai`} icon={<GraduationCap className="size-4" />} isMono />
        <StatCard title="Kehadiran Bulan Ini" value={summary.rate === null ? '-' : `${summary.rate}%`} description={`${summary.total} sesi tercatat`} icon={<BookOpen className="size-4" />} isMono />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={`Jadwal Hari Ini · ${DAY_LABELS[dow]}`}
          action={<Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link href="/dashboard/jadwal">Jadwal mingguan</Link></Button>}
        >
          <TodayScheduleTable slots={schedule} emptyText={dow > 5 ? 'Akhir pekan, tidak ada pelajaran.' : undefined} />
        </SectionCard>
        <SectionCard title="Pengumuman">
          <AnnouncementList items={announcements} />
        </SectionCard>
      </div>

      <SectionCard
        title="Tenggat Tugas"
        description="Tugas yang belum Anda kumpulkan, diurutkan dari batas waktu terdekat."
        action={<Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link href="/dashboard/murid/tugas">Semua tugas</Link></Button>}
      >
        <AssignmentTable assignments={upcoming.slice(0, 5)} emptyText="Tidak ada tugas yang menunggu. Mantap!" />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Materi Terbaru"
          action={<Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link href="/dashboard/murid/materi">Semua materi</Link></Button>}
        >
          <MaterialTable materials={materials} />
        </SectionCard>
        <SectionCard
          title="Kehadiran Bulan Ini"
          action={<Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link href="/dashboard/murid/nilai">Nilai saya</Link></Button>}
        >
          <AttendanceSummary summary={summary} />
        </SectionCard>
      </div>
    </div>
  );
}
