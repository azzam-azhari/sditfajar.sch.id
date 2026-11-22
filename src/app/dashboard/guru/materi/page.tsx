import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { MateriClient, type MaterialItem } from './_components/materi-client';

export const instant = false;

export default async function GuruMateriPage() {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) {
    return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('materials')
    .select(
      'id, title, description, content, external_url, file_path, status, published_at, created_at, classroom_id, subject_id, semester_id, classrooms(name), subjects(name)'
    )
    .eq('teacher_id', ctx.teacherId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materi Pembelajaran"
        description="Unggah modul, tulis panduan, atau bagikan tautan video untuk rombel dan mapel yang Anda ampu. Materi terpublikasi hanya terlihat oleh murid di kelas tersebut dan wali muridnya."
      />
      <MateriClient
        initialMaterials={(data ?? []) as unknown as MaterialItem[]}
        assignments={ctx.assignments}
      />
    </div>
  );
}
