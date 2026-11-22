import { connection } from 'next/server';
import { getAttendance, summarizeAttendance } from '@/lib/data/student-overview';
import { jakartaMonth } from '@/lib/date';
import { SectionCard } from '@/components/lms/section-card';
import { AttendanceSummary, AttendanceTable } from '@/components/lms/student-views';
import { ChildPage } from '../_components/child-page';

export const instant = false;

export default async function WaliAbsensiPage(props: { searchParams: Promise<{ anak?: string; bulan?: string }> }) {
  await connection(); // bulan berjalan dihitung dari jam saat request
  const { anak, bulan } = await props.searchParams;
  const month = /^\d{4}-\d{2}$/.test(bulan ?? '') ? (bulan as string) : jakartaMonth();
  return (
    <ChildPage anak={anak} title="Presensi Anak" description={`kehadiran bulan ${month}.`}>
      {async (child) => {
        const rows = await getAttendance(child.studentId, month);
        return (
          <div className="space-y-6">
            <SectionCard title="Ringkasan"><AttendanceSummary summary={summarizeAttendance(rows)} /></SectionCard>
            <AttendanceTable rows={rows} />
          </div>
        );
      }}
    </ChildPage>
  );
}
