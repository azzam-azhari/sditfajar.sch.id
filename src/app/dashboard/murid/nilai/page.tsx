import { requireRole } from '@/lib/supabase/auth-helpers';
import { getStudentContext } from '@/lib/data/lms';
import { averageAssignmentScore, getFinalGrades, getStudentAssignments } from '@/lib/data/student-overview';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/lms/section-card';
import { AssignmentTable, FinalGradeTable } from '@/components/lms/student-views';

export const instant = false;

export default async function MuridNilaiPage() {
  const { user } = await requireRole(['murid']);
  const student = await getStudentContext(user.id);
  if (!student) return <EmptyState title="Data murid belum terhubung" description="Hubungi admin sekolah." />;

  const [assignments, finals] = await Promise.all([
    getStudentAssignments(student.studentId, student.classroom?.id ?? null),
    getFinalGrades(student.studentId),
  ]);
  const graded = assignments.filter((a) => a.submission?.status === 'graded');
  const average = averageAssignmentScore(assignments);

  return (
    <div className="space-y-6">
      <PageHeader title="Nilai Saya" description="Rekap nilai tugas dan nilai akhir semester." />
      <SectionCard title="Nilai Tugas" description={`${graded.length} tugas dinilai · rata-rata ${average ?? '-'} (skala 100)`}>
        <AssignmentTable assignments={graded} emptyText="Nilai belum tersedia." />
      </SectionCard>
      <SectionCard title="Nilai Akhir Semester">
        <FinalGradeTable grades={finals} />
      </SectionCard>
    </div>
  );
}
