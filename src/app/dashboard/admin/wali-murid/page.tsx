import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { ZebraDataTable, ZebraColumn } from '@/components/common/zebra-data-table';
import { Badge } from '@/components/ui/badge';
import { LinkChildDialog, type StudentOption } from './_components/link-child-dialog';
import { UnlinkChildButton } from './_components/unlink-child-button';

interface ParentItem {
  id: string;
  occupation: string | null;
  address: string | null;
  created_at: string;
  profiles?: {
    name: string;
    phone: string | null;
    email: string | null;
    login_identifier: string;
  };
  parent_students?: {
    id: string;
    relationship: string;
    students?: {
      id: string;
      nis: string;
      profiles?: {
        name: string;
      };
    };
  }[];
}

export const instant = false;

export default async function AdminWaliMuridPage() {
  await requireRole(['admin', 'super_admin']);
  const supabase = await createClient();

  const { data: parents } = await supabase
    .from('parents')
    .select(`
      id,
      occupation,
      address,
      created_at,
      profiles (
        name,
        phone,
        email,
        login_identifier
      ),
      parent_students (
        id,
        relationship,
        students (
          id,
          nis,
          profiles (
            name
          )
        )
      )
    `)
    .order('created_at', { ascending: false });

  // Daftar murid aktif untuk dialog "Tautkan Anak".
  const { data: studentRows } = await supabase
    .from('students')
    .select('id, nis, profiles(name), class_students(status, classrooms(name))')
    .eq('is_active', true);

  type StudentRow = {
    id: string;
    nis: string;
    profiles: { name: string } | { name: string }[] | null;
    class_students: { status: string; classrooms: { name: string } | { name: string }[] | null }[] | null;
  };
  const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const students: StudentOption[] = ((studentRows ?? []) as unknown as StudentRow[])
    .map((row) => ({
      id: row.id,
      nis: row.nis,
      name: first(row.profiles)?.name ?? 'Tanpa Nama',
      className: first((row.class_students ?? []).find((c) => c.status === 'active')?.classrooms)?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const columns: ZebraColumn<ParentItem>[] = [
    {
      header: 'Nama Orang Tua / Wali',
      cell: (item) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">
            {item.profiles?.name || 'Tanpa Nama'}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {item.occupation ? `Pekerjaan: ${item.occupation}` : '-'}
          </span>
        </div>
      ),
    },
    {
      header: 'No. WhatsApp (Login ID)',
      isMono: true,
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-emerald-600">
          {item.profiles?.phone || item.profiles?.login_identifier}
        </span>
      ),
    },
    {
      header: 'Anak / Murid Terhubung',
      cell: (item) => {
        const relations = item.parent_students ?? [];
        const parentName = item.profiles?.name || 'Tanpa Nama';
        return (
          <div className="space-y-1.5">
            {relations.length > 0 ? (
              relations.map((rel) => (
                <div key={rel.id} className="flex items-center gap-1.5 text-xs">
                  <Badge variant="outline" className="border-primary/40 text-primary font-mono text-[10px]">
                    {rel.relationship}
                  </Badge>
                  <span className="font-medium text-foreground">
                    {rel.students?.profiles?.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({rel.students?.nis})
                  </span>
                  <UnlinkChildButton
                    linkId={rel.id}
                    childName={rel.students?.profiles?.name ?? 'Murid'}
                    parentName={parentName}
                  />
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic block">Belum ada anak terhubung</span>
            )}
            <LinkChildDialog
              parentId={item.id}
              parentName={parentName}
              students={students}
              linkedStudentIds={relations.map((rel) => rel.students?.id).filter((id): id is string => Boolean(id))}
            />
          </div>
        );
      },
    },
    {
      header: 'Alamat Domisili',
      cell: (item) => (
        <span className="text-xs text-muted-foreground truncate max-w-xs block">
          {item.address || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Data Wali Murid & Relasi Siswa
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Daftar seluruh wali murid terdaftar yang memiliki hak akses terhadap pemantauan akademik dan pembayaran tagihan anak.
        </p>
      </div>

      <ZebraDataTable
        data={(parents as unknown as ParentItem[]) || []}
        columns={columns}
        emptyText="Belum ada data wali murid terdaftar."
      />
    </div>
  );
}
