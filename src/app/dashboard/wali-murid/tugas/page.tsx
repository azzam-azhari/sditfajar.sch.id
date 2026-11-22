import { getStudentAssignments } from '@/lib/data/student-overview';
import { AssignmentTable } from '@/components/lms/student-views';
import { ChildPage } from '../_components/child-page';

export const instant = false;

export default async function WaliTugasPage(props: { searchParams: Promise<{ anak?: string }> }) {
  const { anak } = await props.searchParams;
  return (
    <ChildPage anak={anak} title="Tugas Anak" description="status pengumpulan dan nilai tugas.">
      {async (child) => <AssignmentTable assignments={await getStudentAssignments(child.studentId, child.classroom?.id ?? null)} />}
    </ChildPage>
  );
}
