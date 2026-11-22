import { getFinalGrades, getStudentAssignments } from '@/lib/data/student-overview';
import { SectionCard } from '@/components/lms/section-card';
import { AssignmentTable, FinalGradeTable } from '@/components/lms/student-views';
import { ChildPage } from '../_components/child-page';

export const instant = false;

export default async function WaliNilaiPage(props: { searchParams: Promise<{ anak?: string }> }) {
  const { anak } = await props.searchParams;
  return (
    <ChildPage anak={anak} title="Nilai Anak" description="nilai tugas dan nilai akhir semester.">
      {async (child) => {
        const [assignments, finals] = await Promise.all([getStudentAssignments(child.studentId, child.classroom?.id ?? null), getFinalGrades(child.studentId)]);
        return (
          <div className="space-y-6">
            <SectionCard title="Nilai Tugas"><AssignmentTable assignments={assignments.filter((a) => a.submission?.status === 'graded')} emptyText="Nilai belum tersedia." /></SectionCard>
            <SectionCard title="Nilai Akhir Semester"><FinalGradeTable grades={finals} /></SectionCard>
          </div>
        );
      }}
    </ChildPage>
  );
}
