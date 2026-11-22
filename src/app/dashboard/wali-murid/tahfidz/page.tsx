import { getTahfidzRecords, summarizeTahfidz } from '@/lib/data/tahfidz';
import { SectionCard } from '@/components/lms/section-card';
import { TahfidzHistoryTable, TahfidzSummaryCards } from '@/components/lms/tahfidz-views';
import { ChildPage } from '../_components/child-page';

export const instant = false;

export default async function WaliTahfidzPage(props: { searchParams: Promise<{ anak?: string }> }) {
  const { anak } = await props.searchParams;
  return (
    <ChildPage anak={anak} title="Hafalan Qur'an Anak" description="progres dan riwayat setoran hafalan.">
      {async (child) => {
        const records = await getTahfidzRecords([child.studentId]);
        return (
          <div className="space-y-6">
            <SectionCard title="Progres Hafalan"><TahfidzSummaryCards summary={summarizeTahfidz(records)} /></SectionCard>
            <SectionCard title="Riwayat Setoran"><TahfidzHistoryTable records={records} /></SectionCard>
          </div>
        );
      }}
    </ChildPage>
  );
}
