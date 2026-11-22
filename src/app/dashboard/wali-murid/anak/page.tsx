import { requireRole } from '@/lib/supabase/auth-helpers';
import { getParentChildren, type ChildRef } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { ZebraDataTable } from '@/components/common/zebra-data-table';

export const instant = false;

export default async function WaliAnakPage() {
  const { user } = await requireRole(['wali_murid']);
  const children = await getParentChildren(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Data Anak" description="Anak yang terhubung dengan akun Anda." />
      <ZebraDataTable<ChildRef>
        data={children}
        keyExtractor={(c) => c.studentId}
        emptyText="Belum ada anak terhubung."
        columns={[
          { header: 'NIS', accessorKey: 'nis', isMono: true },
          { header: 'Nama', accessorKey: 'name' },
          { header: 'Kelas', cell: (c) => c.classroom?.name ?? '-' },
          { header: 'Hubungan', accessorKey: 'relationship' },
        ]}
      />
    </div>
  );
}
