-- ==============================================================================
-- 008 - HAK EKSEKUSI FUNGSI & SEARCH_PATH
-- Supabase memberi EXECUTE ke anon/authenticated untuk setiap fungsi baru di schema
-- public, sehingga fungsi SECURITY DEFINER bisa dipanggil lewat /rest/v1/rpc.
-- File ini menutup akses yang tidak dibutuhkan:
--   * fungsi trigger: tidak perlu EXECUTE bagi pemanggil (dicek saat CREATE TRIGGER saja);
--   * helper RLS: hanya authenticated (policy dievaluasi sebagai role pemanggil);
--     is_admin_or_super tetap untuk anon karena dipakai policy "to public"
--     (admission_waves, news_posts, marketplace_products) dan selalu false untuk anon;
--   * generate_registration_number: hanya service role (dipanggil adminClient);
--   * log_audit_event & current_profile_id: tidak dipakai aplikasi, ditutup.
-- RPC bisnis (marketplace, pembayaran, tahfidz) tetap untuk authenticated; validasi
-- peran ada di dalam fungsinya. Idempotent.
-- ==============================================================================

-- 1. search_path tetap untuk fungsi yang belum menetapkannya
alter function public.handle_updated_at() set search_path = public;
alter function public.current_profile_id() set search_path = public;
alter function public.generate_registration_number() set search_path = public;

-- 2. Fungsi trigger: tidak dapat dipanggil langsung oleh siapa pun lewat API
revoke all on function public.handle_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_submission_integrity() from public, anon, authenticated;
revoke all on function public.enforce_teacher_attendance_integrity() from public, anon, authenticated;
revoke all on function public.enforce_student_attendance_integrity() from public, anon, authenticated;
revoke all on function public.prevent_schedule_overlap() from public, anon, authenticated;
revoke all on function public.set_invoice_number() from public, anon, authenticated;
revoke all on function public.guard_invoice_paid() from public, anon, authenticated;

-- 3. Fungsi yang tidak dipakai aplikasi / hanya untuk server
revoke all on function public.log_audit_event(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.current_profile_id() from public, anon, authenticated;
revoke all on function public.generate_registration_number() from public, anon, authenticated;
revoke all on sequence public.seq_registration_number from public, anon, authenticated;
grant execute on function public.generate_registration_number() to service_role;
grant usage on sequence public.seq_registration_number to service_role;

-- 4. Helper RLS: hanya pengguna login
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.is_student() from public, anon;
revoke all on function public.is_parent() from public, anon;
revoke all on function public.has_teacher_position(text) from public, anon;
revoke all on function public.get_current_parent_id() from public, anon;
revoke all on function public.get_current_student_id() from public, anon;
revoke all on function public.get_my_children_profile_ids() from public, anon;
revoke all on function public.current_teacher_id() from public, anon;
revoke all on function public.can_manage_teaching_scope(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.is_my_homeroom(uuid) from public, anon;
revoke all on function public.can_manage_announcements() from public, anon;
revoke all on function public.can_record_tahfidz(uuid) from public, anon;
revoke all on function public.is_finance_staff() from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_student() to authenticated;
grant execute on function public.is_parent() to authenticated;
grant execute on function public.has_teacher_position(text) to authenticated;

-- is_admin_or_super: dipakai policy publik, jadi anon tetap boleh (hasilnya selalu false).
grant execute on function public.is_admin_or_super() to anon, authenticated;
