import * as React from 'react';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { getParentChildren, resolveSelectedChild, type ChildRef } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ChildSelector } from '@/components/lms/child-selector';

/** Kerangka halaman wali murid: memuat anak terhubung dan pemilih anak (`?anak=`). */
export async function ChildPage({
  anak,
  title,
  description,
  children,
}: {
  anak: string | undefined;
  title: string;
  description: string;
  children: (child: ChildRef) => Promise<React.ReactNode> | React.ReactNode;
}) {
  const { user } = await requireRole(['wali_murid']);
  const list = await getParentChildren(user.id);
  const child = resolveSelectedChild(list, anak);
  if (!child) {
    return <EmptyState title="Belum ada anak terhubung" description="Hubungi admin sekolah untuk menautkan data anak ke akun Anda." />;
  }
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={`${child.name}${child.classroom ? ` · kelas ${child.classroom.name}` : ''} · ${description}`}>
        <ChildSelector
          childrenList={list.map((c) => ({ studentId: c.studentId, name: c.name, classroomName: c.classroom?.name ?? null }))}
          selectedId={child.studentId}
        />
      </PageHeader>
      {await children(child)}
    </div>
  );
}
