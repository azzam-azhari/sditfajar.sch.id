import { requireRole } from '@/lib/supabase/auth-helpers';
import { getStudentContext } from '@/lib/data/lms';
import { getTahfidzRecords, summarizeTahfidz } from '@/lib/data/tahfidz';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/lms/section-card';
import { TahfidzHistoryTable, TahfidzSummaryCards } from '@/components/lms/tahfidz-views';

export const instant = false;

export default async function MuridTahfidzPage() {
  const { user } = await requireRole(['murid']);
  const student = await getStudentContext(user.id);
  if (!student) return <EmptyState title="Data murid belum terhubung" description="Hubungi admin sekolah." />;
  const records = await getTahfidzRecords([student.studentId]);
  return (
    <div className="space-y-6">
      <PageHeader title="Hafalan Qur'an Saya" description="Progres dan riwayat setoran hafalan yang dicatat ustadz/ustadzah." />
      <SectionCard title="Progres Hafalan"><TahfidzSummaryCards summary={summarizeTahfidz(records)} /></SectionCard>
      <SectionCard title="Riwayat Setoran"><TahfidzHistoryTable records={records} /></SectionCard>
    </div>
  );
}
