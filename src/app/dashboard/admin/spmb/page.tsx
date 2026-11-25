import { connection } from 'next/server';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SpmbVerificationClient, ApplicationItem } from './_components/spmb-verification-client';

export const instant = false;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    wave?: string;
    page?: string;
  }>;
}

export default async function AdminSpmbVerificationPage(props: PageProps) {
  await connection();
  await requireRole(['admin', 'super_admin']);
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const PAGE_SIZE = 10;
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Bangun query Supabase dengan filter server-side
  let query = supabase
    .from('student_registration_applications')
    .select(`
      id,
      admission_wave_id,
      registration_number,
      student_name,
      nik,
      nisn,
      gender,
      birth_place,
      birth_date,
      address,
      parent_name,
      parent_phone,
      parent_email,
      father_name,
      father_occupation,
      mother_name,
      mother_occupation,
      nickname,
      total_siblings,
      child_number,
      hobby,
      achievements,
      medical_history,
      father_education,
      mother_education,
      parent_address,
      status,
      observation_score,
      admin_notes,
      created_at,
      admission_waves (
        id,
        title,
        wave_number
      ),
      student_registration_documents (
        id,
        document_type,
        file_path,
        original_filename,
        mime_type,
        file_size,
        file_url
      )
    `, { count: 'exact' });

  // Filter Status
  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  // Filter Gelombang
  if (searchParams.wave && searchParams.wave !== 'all') {
    query = query.eq('admission_wave_id', searchParams.wave);
  }

  // Pencarian (search)
  if (searchParams.search && searchParams.search.trim()) {
    // Buang karakter sintaks filter PostgREST (koma, kurung, kutip) dan wildcard
    // sebelum dirangkai ke .or(), lalu bungkus nilai dengan tanda kutip.
    const s = searchParams.search.trim().replace(/[^\p{L}\p{N}\s@.+-]/gu, '');
    if (s) {
      query = query.or(
        ['student_name', 'registration_number', 'parent_name', 'parent_phone']
          .map((column) => `${column}.ilike."%${s}%"`)
          .join(',')
      );
    }
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const [
    { data: applications, count },
    { data: waves },
    { data: classrooms },
  ] = await Promise.all([
    query,
    supabase.from('admission_waves').select('id, title, wave_number').order('wave_number'),
    supabase.from('classrooms').select('id, name').eq('is_active', true),
  ]);

  // Batch generate signed URL untuk private bucket 'registration-files'
  const adminClient = createAdminClient();
  const rawApplications = (applications || []) as unknown as ApplicationItem[];
  const allDocPaths = rawApplications
    .flatMap((app) => (app.student_registration_documents || []).map((d) => d.file_path))
    .filter(Boolean);

  let signedUrlMap: Record<string, string> = {};
  if (allDocPaths.length > 0) {
    try {
      const { data: signedResults, error: signError } = await adminClient.storage
        .from('registration-files')
        .createSignedUrls(allDocPaths, 3600); // Masa aktif 1 jam

      if (!signError && signedResults) {
        signedUrlMap = signedResults.reduce((acc, item) => {
          if (item.path && item.signedUrl) {
            acc[item.path] = item.signedUrl;
          }
          return acc;
        }, {} as Record<string, string>);
      }
    } catch (err) {
      console.error('Gagal generate batch signed url berkas pendaftaran:', err);
    }
  }

  const enrichedApplications = rawApplications.map((app) => ({
    ...app,
    student_registration_documents: (app.student_registration_documents || []).map((doc) => ({
      ...doc,
      file_url: signedUrlMap[doc.file_path] || doc.file_url || null,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Verifikasi Pendaftaran SPMB Online
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tinjau berkas pendaftaran calon murid baru, periksa kelengkapan administrasi, dan promosikan siswa terpilih ke basis data akademik aktif.
        </p>
      </div>

      <SpmbVerificationClient
        applications={enrichedApplications}
        waves={waves || []}
        classrooms={classrooms || []}
        totalCount={count || 0}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
