import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getParentChildren, getStudentContext, getTeacherContext, resolveSelectedChild } from '@/lib/data/lms';
import { getAnnouncements } from '@/lib/data/student-overview';
import { PageHeader } from '@/components/common/page-header';
import { ChildSelector } from '@/components/lms/child-selector';
import { AnnouncementList } from '@/components/lms/student-views';
import { AnnouncementManager, type AnnouncementRow } from './_components/announcement-manager';

export const instant = false;

export default async function PengumumanPage(props: { searchParams: Promise<{ anak?: string }> }) {
  const { user, profile } = await requireRole(['super_admin', 'admin', 'guru', 'murid', 'wali_murid']);
  const { anak } = await props.searchParams;
  const supabase = await createClient();

  let isManager = profile.role === 'super_admin' || profile.role === 'admin';
  if (profile.role === 'guru') {
    const ctx = await getTeacherContext(user.id);
    isManager = Boolean(ctx?.isPrincipal);
  }

  if (isManager) {
    const [{ data: rows }, { data: classrooms }, { data: students }] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, title, content, target_type, target_role, classroom_id, student_id, status, published_at, created_at, created_by, classrooms(name), students(nis, profiles(name)), profiles(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('classrooms')
        .select('id, name, academic_years!inner(is_active)')
        .eq('academic_years.is_active', true)
        .order('name'),
      supabase.from('students').select('id, nis, profiles(name)').eq('is_active', true).order('nis'),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Pengumuman Sekolah"
          description="Buat pengumuman untuk seluruh warga sekolah, peran tertentu, satu kelas, atau satu murid (beserta wali muridnya). Draf tidak terlihat oleh penerima."
        />
        <AnnouncementManager
          currentUserId={user.id}
          canManageAll={profile.role === 'super_admin' || profile.role === 'admin'}
          rows={(rows ?? []) as unknown as AnnouncementRow[]}
          classrooms={(classrooms ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
          students={((students ?? []) as unknown as { id: string; nis: string; profiles: { name: string } | null }[]).map((s) => ({
            id: s.id,
            label: `${s.profiles?.name ?? '-'} (${s.nis})`,
          }))}
        />
      </div>
    );
  }

  // Penerima: murid, wali (per anak), guru biasa.
  if (profile.role === 'wali_murid') {
    const children = await getParentChildren(user.id);
    const child = resolveSelectedChild(children, anak);
    const items = child
      ? await getAnnouncements(50, { studentId: child.studentId, classroomId: child.classroom?.id ?? null })
      : await getAnnouncements(50);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pengumuman"
          description={child ? `Pengumuman sekolah untuk ${child.name}${child.classroom ? ` · kelas ${child.classroom.name}` : ''}.` : 'Pengumuman sekolah.'}
        >
          {child && (
            <ChildSelector
              childrenList={children.map((c) => ({ studentId: c.studentId, name: c.name, classroomName: c.classroom?.name ?? null }))}
              selectedId={child.studentId}
            />
          )}
        </PageHeader>
        <AnnouncementList items={items} />
      </div>
    );
  }

  if (profile.role === 'murid') {
    const student = await getStudentContext(user.id);
    const items = student
      ? await getAnnouncements(50, { studentId: student.studentId, classroomId: student.classroom?.id ?? null })
      : [];
    return (
      <div className="space-y-6">
        <PageHeader title="Pengumuman" description="Pengumuman sekolah untuk Anda dan kelas Anda." />
        <AnnouncementList items={items} />
      </div>
    );
  }

  const items = await getAnnouncements(50);
  return (
    <div className="space-y-6">
      <PageHeader title="Pengumuman" description="Pengumuman sekolah yang ditujukan kepada Anda dan kelas binaan Anda." />
      <AnnouncementList items={items} />
    </div>
  );
}
