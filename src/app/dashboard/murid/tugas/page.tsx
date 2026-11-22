import { requireRole } from '@/lib/supabase/auth-helpers';
import { getStudentContext } from '@/lib/data/lms';
import { getStudentAssignments } from '@/lib/data/student-overview';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { AssignmentTable } from '@/components/lms/student-views';
import { SubmitAssignmentDialog } from './_components/submit-assignment-dialog';

export const instant = false;

export default async function MuridTugasPage() {
  const { user } = await requireRole(['murid']);
  const student = await getStudentContext(user.id);
  if (!student) return <EmptyState title="Data murid belum terhubung" description="Hubungi admin sekolah." />;
  const assignments = await getStudentAssignments(student.studentId, student.classroom?.id ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tugas Saya"
        description="Kumpulkan jawaban berupa teks atau berkas (maks. 10 MB). Satu pengumpulan per tugas dan dapat diperbarui sebelum dinilai selama masih dalam batas waktu. Status terlambat ditentukan otomatis oleh jam server."
      />
      <AssignmentTable
        assignments={assignments}
        action={(a) => <SubmitAssignmentDialog assignment={a} />}
      />
    </div>
  );
}
