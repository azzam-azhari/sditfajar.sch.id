import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/auth-helpers';
import { getTeacherContext } from '@/lib/data/lms';
import { createClient } from '@/lib/supabase/server';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarAutoClose } from '@/components/sidebar-auto-close';

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const profile = await getCurrentProfile();
  // Jabatan guru menentukan menu tambahan (mis. Keuangan untuk bendahara).
  const positions = profile?.role === 'guru' ? (await getTeacherContext(profile.id))?.positions ?? [] : [];

  // Pemilih tahun ajaran di header hanya untuk admin & super admin.
  let academicYears: { id: string; name: string; is_active: boolean }[] | undefined;
  if (profile?.role === 'admin' || profile?.role === 'super_admin') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('academic_years')
      .select('id, name, is_active')
      .order('start_date', { ascending: false });
    academicYears = data ?? [];
  }

  const user = profile
    ? {
        name: profile.name,
        email: profile.email || profile.login_identifier,
        role: profile.role,
        avatar: profile.avatar_url,
      }
    : {
        name: 'Pengguna',
        email: '',
        role: 'murid' as const,
        avatar: null,
      };

  return (
    <SidebarProvider>
      <SidebarAutoClose />
      <AppSidebar variant="inset" user={user} positions={positions} />
      {/* min-w-0: tabel lebar tidak boleh mendorong lebar halaman melebihi viewport */}
      <SidebarInset className="min-w-0">
        <SiteHeader academicYears={academicYears} />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center min-h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
