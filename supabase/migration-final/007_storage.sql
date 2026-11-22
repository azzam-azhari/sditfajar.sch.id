-- ==============================================================================
-- 007 - STORAGE BUCKETS & POLICIES
-- 5 bucket: images (publik), lms-files, registration-files, marketplace-files, payment-files.
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'images',
    'images',
    true, -- Bucket gambar/avatar/banner publik
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'lms-files',
    'lms-files',
    false, -- Privat: Akses via Signed URL
    10485760, -- 10 MB
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  ),
  (
    'registration-files',
    'registration-files',
    false, -- Privat: Dokumen SPMB via Signed URL
    5242880, -- 5 MB
    array['application/pdf', 'image/jpeg', 'image/png']
  ),
  (
    'marketplace-files',
    'marketplace-files',
    false, -- Privat: E-book/modul via Signed URL pasca bayar
    52428800, -- 50 MB
    array['application/pdf', 'application/epub+zip']
  ),
  (
    'payment-files',
    'payment-files',
    false, -- Privat: bukti transfer via Signed URL
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket privat (lms-files, registration-files, marketplace-files, payment-files) tidak punya
-- policy langsung: hanya diakses via Signed URL dari Server Action (service role).
-- Jangan menjalankan "alter table storage.objects enable row level security" (milik supabase_storage_admin).

drop policy if exists "Public Access for Images" on storage.objects;
-- Policy 1: Siapapun (publik) dapat melihat asset gambar di bucket 'images'
create policy "Public Access for Images"
  on storage.objects for select
  to public
  using (bucket_id = 'images');

drop policy if exists "Staff upload images" on storage.objects;
create policy "Staff upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images' and public.is_admin_or_super());
