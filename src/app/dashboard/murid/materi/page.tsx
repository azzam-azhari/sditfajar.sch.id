import { requireRole } from '@/lib/supabase/auth-helpers';
import { getStudentContext } from '@/lib/data/lms';
import { getClassMaterials } from '@/lib/data/student-overview';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { MaterialTable } from '@/components/lms/student-views';

export const instant = false;

export default async function MuridMateriPage() {
  const { user } = await requireRole(['murid']);
  const student = await getStudentContext(user.id);
  if (!student) return <EmptyState title="Data murid belum terhubung" description="Hubungi admin sekolah." />;
  const materials = await getClassMaterials(student.classroom?.id ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materi Pembelajaran"
        description={student.classroom ? `Materi yang dipublikasikan guru untuk kelas ${student.classroom.name}. Klik judul untuk membaca teks panduan.` : 'Anda belum terdaftar di rombel aktif.'}
      />
      <MaterialTable materials={materials} />
    </div>
  );
}
