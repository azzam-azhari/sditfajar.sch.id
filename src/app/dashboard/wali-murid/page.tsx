import { getAnnouncements, getAttendance, getStudentAssignments, getTodaySchedule, averageAssignmentScore, summarizeAttendance } from '@/lib/data/student-overview';
import { jakartaMonth } from '@/lib/date';
import { SectionCard } from '@/components/lms/section-card';
import { AnnouncementList, AssignmentTable, AttendanceSummary, TodayScheduleTable } from '@/components/lms/student-views';
import { ChildPage } from './_components/child-page';

export const instant = false;

export default async function WaliDashboardPage(props: { searchParams: Promise<{ anak?: string }> }) {
  const { anak } = await props.searchParams;
  return (
    <ChildPage anak={anak} title="Dashboard Wali Murid" description="pantau nilai, kehadiran, dan pengumuman.">
      {async (child) => {
        const cid = child.classroom?.id ?? null;
        const [schedule, assignments, attendance, announcements] = await Promise.all([
          getTodaySchedule(cid), getStudentAssignments(child.studentId, cid), getAttendance(child.studentId, jakartaMonth()), getAnnouncements(5, { studentId: child.studentId, classroomId: cid }),
        ]);
        const graded = assignments.filter((a) => a.submission?.status === 'graded');
        return (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Kehadiran Bulan Ini"><AttendanceSummary summary={summarizeAttendance(attendance)} /></SectionCard>
              <SectionCard title="Pengumuman"><AnnouncementList items={announcements} /></SectionCard>
            </div>
            <SectionCard title="Jadwal Hari Ini"><TodayScheduleTable slots={schedule} /></SectionCard>
            <SectionCard title="Nilai Tugas Terbaru" description={`Rata-rata ${averageAssignmentScore(assignments) ?? '-'} (skala 100)`}>
              <AssignmentTable assignments={graded.slice(0, 5)} emptyText="Nilai belum tersedia." />
            </SectionCard>
          </div>
        );
      }}
    </ChildPage>
  );
}
