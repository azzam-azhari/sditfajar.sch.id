-- ==============================================================================
-- 005 - FUNGSI, TRIGGER & HAK EKSEKUSI
-- Versi terakhir tiap fungsi/trigger (urut sesuai dependensi).
-- import_csv_batch memakai NUPTK; nomor registrasi format SPMB-YYYY-XXXX.
-- ==============================================================================

-- 3. Trigger Function untuk otomatisasi updated_at (tidak bergantung tabel manapun)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4. Helper Base Auth Function (hanya memanggil auth.uid(), tidak butuh tabel domain)
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_school_settings_updated_at on public.school_settings;
create trigger set_school_settings_updated_at
  before update on public.school_settings
  for each row execute function public.handle_updated_at();

-- Prosedur helper pencatatan audit log
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata)
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

drop trigger if exists set_academic_years_updated_at on public.academic_years;
create trigger set_academic_years_updated_at
  before update on public.academic_years
  for each row execute function public.handle_updated_at();

drop trigger if exists set_semesters_updated_at on public.semesters;
create trigger set_semesters_updated_at
  before update on public.semesters
  for each row execute function public.handle_updated_at();

drop trigger if exists set_school_period_settings_updated_at on public.school_period_settings;
create trigger set_school_period_settings_updated_at
  before update on public.school_period_settings
  for each row execute function public.handle_updated_at();

drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at
  before update on public.classes
  for each row execute function public.handle_updated_at();

drop trigger if exists set_positions_updated_at on public.positions;
create trigger set_positions_updated_at
  before update on public.positions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_teachers_updated_at on public.teachers;
create trigger set_teachers_updated_at
  before update on public.teachers
  for each row execute function public.handle_updated_at();

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at
  before update on public.students
  for each row execute function public.handle_updated_at();

drop trigger if exists set_parents_updated_at on public.parents;
create trigger set_parents_updated_at
  before update on public.parents
  for each row execute function public.handle_updated_at();

drop trigger if exists set_classrooms_updated_at on public.classrooms;
create trigger set_classrooms_updated_at
  before update on public.classrooms
  for each row execute function public.handle_updated_at();

drop trigger if exists set_teacher_positions_updated_at on public.teacher_positions;
create trigger set_teacher_positions_updated_at
  before update on public.teacher_positions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at
  before update on public.subjects
  for each row execute function public.handle_updated_at();

drop trigger if exists set_schedules_updated_at on public.schedules;
create trigger set_schedules_updated_at
  before update on public.schedules
  for each row execute function public.handle_updated_at();

drop trigger if exists set_admission_waves_updated_at on public.admission_waves;
create trigger set_admission_waves_updated_at
  before update on public.admission_waves
  for each row execute function public.handle_updated_at();

drop trigger if exists set_student_registration_applications_updated_at on public.student_registration_applications;
create trigger set_student_registration_applications_updated_at
  before update on public.student_registration_applications
  for each row execute function public.handle_updated_at();

drop trigger if exists set_teacher_attendances_updated_at on public.teacher_attendances;
create trigger set_teacher_attendances_updated_at
  before update on public.teacher_attendances
  for each row execute function public.handle_updated_at();

drop trigger if exists set_student_attendances_updated_at on public.student_attendances;
create trigger set_student_attendances_updated_at
  before update on public.student_attendances
  for each row execute function public.handle_updated_at();

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
  before update on public.materials
  for each row execute function public.handle_updated_at();

drop trigger if exists set_assignments_updated_at on public.assignments;
create trigger set_assignments_updated_at
  before update on public.assignments
  for each row execute function public.handle_updated_at();

drop trigger if exists set_assignment_submissions_updated_at on public.assignment_submissions;
create trigger set_assignment_submissions_updated_at
  before update on public.assignment_submissions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_grades_updated_at on public.grades;
create trigger set_grades_updated_at
  before update on public.grades
  for each row execute function public.handle_updated_at();

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row execute function public.handle_updated_at();

drop trigger if exists set_news_posts_updated_at on public.news_posts;
create trigger set_news_posts_updated_at
  before update on public.news_posts
  for each row execute function public.handle_updated_at();

drop trigger if exists set_tahfidz_records_updated_at on public.tahfidz_records;
create trigger set_tahfidz_records_updated_at
  before update on public.tahfidz_records
  for each row execute function public.handle_updated_at();

drop trigger if exists set_payment_settings_updated_at on public.payment_settings;
create trigger set_payment_settings_updated_at
  before update on public.payment_settings
  for each row execute function public.handle_updated_at();

drop trigger if exists set_marketplace_products_updated_at on public.marketplace_products;
create trigger set_marketplace_products_updated_at
  before update on public.marketplace_products
  for each row execute function public.handle_updated_at();

drop trigger if exists set_marketplace_orders_updated_at on public.marketplace_orders;
create trigger set_marketplace_orders_updated_at
  before update on public.marketplace_orders
  for each row execute function public.handle_updated_at();

drop trigger if exists set_payment_invoices_updated_at on public.payment_invoices;
create trigger set_payment_invoices_updated_at
  before update on public.payment_invoices
  for each row execute function public.handle_updated_at();

drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.handle_updated_at();

-- ==============================================================================
-- FASE 3: MIGRATION 06 - SECURITY HELPER FUNCTIONS, ENABLE RLS & POLICIES
-- Sesuai Dokumen PRD 09 (RLS & Keamanan Data) & Safety Guardrails
-- ==============================================================================

-- ==============================================================================
-- 1. SECURITY HELPER FUNCTIONS (Tabel profiles, teachers, positions sudah tercipta)
-- ==============================================================================

create or replace function public.current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

create or replace function public.is_admin_or_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin') and is_active = true
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'guru' and is_active = true
  );
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'murid' and is_active = true
  );
$$;

create or replace function public.is_parent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'wali_murid' and is_active = true
  );
$$;

create or replace function public.has_teacher_position(pos_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teachers t
    join public.teacher_positions tp on tp.teacher_id = t.id
    join public.positions p on p.id = tp.position_id
    where t.profile_id = auth.uid()
      and p.code = pos_code
      and tp.is_active = true
      and p.is_active = true
  );
$$;

-- 1. Helper function: Mendapatkan parent.id milik auth.uid() tanpa memicu RLS rekursif
create or replace function public.get_current_parent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.parents where profile_id = auth.uid() limit 1;
$$;

-- 2. Helper function: Mendapatkan student.id milik auth.uid() tanpa memicu RLS rekursif
create or replace function public.get_current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students where profile_id = auth.uid() limit 1;
$$;

-- 3. Helper function: Mendapatkan daftar profile_id anak untuk wali murid aktif
create or replace function public.get_my_children_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.profile_id
  from public.students s
  join public.parent_students ps on ps.student_id = s.id
  join public.parents p on p.id = ps.parent_id
  where p.profile_id = auth.uid();
$$;

-- Berikan hak eksekusi helper functions ke role authenticated
grant execute on function public.get_current_parent_id() to authenticated;

grant execute on function public.get_current_student_id() to authenticated;

grant execute on function public.get_my_children_profile_ids() to authenticated;

create or replace function public.current_teacher_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.teachers where profile_id = (select auth.uid()) and is_active = true limit 1;
$$;

create or replace function public.can_manage_teaching_scope(
  p_teacher_id uuid, p_subject_id uuid, p_classroom_id uuid, p_semester_id uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super() or exists (
    select 1 from public.teaching_assignments ta
    where ta.teacher_id = p_teacher_id
      and ta.subject_id = p_subject_id
      and ta.classroom_id = p_classroom_id
      and ta.semester_id = p_semester_id
      and ta.teacher_id = public.current_teacher_id()
  );
$$;

create or replace function public.is_my_homeroom(p_classroom_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classrooms c
    where c.id = p_classroom_id and c.homeroom_teacher_id = public.current_teacher_id()
  );
$$;

revoke all on function public.current_teacher_id() from public;

revoke all on function public.can_manage_teaching_scope(uuid, uuid, uuid, uuid) from public;

revoke all on function public.is_my_homeroom(uuid) from public;

grant execute on function public.current_teacher_id() to authenticated;

grant execute on function public.can_manage_teaching_scope(uuid, uuid, uuid, uuid) to authenticated;

grant execute on function public.is_my_homeroom(uuid) to authenticated;

-- 2. INTEGRITAS PENGUMPULAN TUGAS ------------------------------------------------------
create or replace function public.enforce_submission_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_assignment public.assignments%rowtype;
  v_is_student boolean;
  v_answer_changed boolean;
  v_deadline timestamptz;
begin
  select * into v_assignment from public.assignments where id = new.assignment_id;
  if not found then raise exception 'Tugas tidak ditemukan.'; end if;

  select exists (
    select 1 from public.students s where s.id = new.student_id and s.profile_id = (select auth.uid())
  ) into v_is_student;

  v_answer_changed := tg_op = 'INSERT' or (
    v_is_student and (
      new.answer_text is distinct from old.answer_text
      or new.file_path is distinct from old.file_path
      or new.submitted_at is distinct from old.submitted_at
    )
  );

  if v_answer_changed then
    if tg_op = 'UPDATE' and old.status = 'graded' then
      raise exception 'Tugas sudah dinilai dan tidak dapat dikumpulkan ulang.';
    end if;
    if v_assignment.status <> 'published' then
      raise exception 'Tugas tidak sedang dibuka untuk pengumpulan.';
    end if;
    if v_assignment.due_at is null then
      raise exception 'Tugas belum memiliki batas waktu yang valid.';
    end if;
    if not exists (
      select 1 from public.class_students cs
      where cs.student_id = new.student_id and cs.classroom_id = v_assignment.classroom_id
        and cs.status = 'active' and cs.left_at is null
    ) then raise exception 'Murid bukan anggota rombel tugas ini.'; end if;

    if now() > v_assignment.due_at then
      if not v_assignment.allow_late_submission then
        raise exception 'Batas waktu pengumpulan tugas telah berakhir.';
      end if;
      v_deadline := v_assignment.due_at
        + make_interval(mins => coalesce(v_assignment.late_tolerance_minutes, 0));
      if v_assignment.late_tolerance_minutes is not null and now() > v_deadline then
        raise exception 'Batas toleransi keterlambatan pengumpulan tugas telah berakhir.';
      end if;
      new.status := 'late';
    else
      new.status := 'submitted';
    end if;
    new.submitted_at := now();
    new.score := null;
    new.feedback := case when tg_op = 'INSERT' then null else old.feedback end;
  end if;

  if v_is_student and tg_op = 'UPDATE' and (
    new.score is distinct from old.score or new.feedback is distinct from old.feedback or
    new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at
  ) and not v_answer_changed then
    raise exception 'Murid tidak dapat mengubah penilaian.';
  end if;

  if new.score is not null then
    if new.score < 0 or new.score > least(100, v_assignment.max_score) then
      raise exception 'Nilai harus berada dalam rentang 0 sampai skor maksimum tugas.';
    end if;
    new.status := 'graded';
    if new.graded_at is null then new.graded_at := now(); end if;
  end if;
  return new;
end;
$$;

-- 3. PRESENSI GURU ---------------------------------------------------------------------
create or replace function public.enforce_teacher_attendance_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := now() at time zone 'Asia/Jakarta';
  v_dow int := extract(isodow from (now() at time zone 'Asia/Jakarta'));
begin
  if tg_op = 'UPDATE' and not public.is_admin_or_super() then
    raise exception 'Catatan presensi guru tidak dapat diubah.';
  end if;
  if tg_op = 'UPDATE' then
    return new; -- koreksi oleh admin
  end if;

  if v_dow in (6, 7) and not exists (
    select 1 from public.school_period_settings sps
    join public.academic_years ay on ay.id = sps.academic_year_id
    where ay.is_active = true and sps.teacher_weekend_attendance_enabled = true
  ) then raise exception 'Presensi guru akhir pekan belum diaktifkan oleh kepala sekolah.'; end if;

  if new.session = 'check_in' then
    if v_local::time < time '06:30' then
      raise exception 'Check-in dibuka mulai pukul 06.30 WIB.';
    end if;
    new.status := case when v_local::time <= time '07:00' then 'present' else 'late' end;
  else
    if v_local::time < time '14:30' then
      raise exception 'Check-out tersedia mulai pukul 14.30 WIB.';
    end if;
    if not exists (
      select 1 from public.teacher_attendances ta
      where ta.teacher_id = new.teacher_id and ta.attendance_date = v_local::date and ta.session = 'check_in'
    ) then raise exception 'Lakukan check-in terlebih dahulu sebelum check-out.'; end if;
    new.status := 'present';
  end if;

  new.attendance_date := v_local::date;
  new.recorded_at := now();
  return new;
end;
$$;

-- 4. PRESENSI MURID: koreksi pada hari yang sama --------------------------------------
create or replace function public.enforce_student_attendance_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_schedule public.schedules%rowtype;
begin
  if tg_op = 'UPDATE' then
    if old.attendance_date <> v_local_date and not public.is_admin_or_super() then
      raise exception 'Presensi hari sebelumnya tidak dapat diubah.';
    end if;
    new.attendance_date := old.attendance_date;
    new.student_id := old.student_id;
    new.schedule_id := old.schedule_id;
    new.classroom_id := old.classroom_id;
    return new;
  end if;

  if extract(isodow from v_local_date) not between 1 and 5 then
    raise exception 'Presensi murid hanya dapat dicatat Senin sampai Jumat.';
  end if;
  select * into v_schedule from public.schedules where id = new.schedule_id;
  if not found or v_schedule.classroom_id <> new.classroom_id then raise exception 'Jadwal tidak sesuai rombel.'; end if;
  if v_schedule.day_of_week <> extract(isodow from v_local_date) then raise exception 'Jadwal tidak berlangsung hari ini.'; end if;
  if not exists (
    select 1 from public.class_students cs where cs.classroom_id = new.classroom_id
      and cs.student_id = new.student_id and cs.status = 'active' and cs.left_at is null
  ) then raise exception 'Murid bukan anggota rombel.'; end if;
  new.attendance_date := v_local_date;
  return new;
end;
$$;

drop trigger if exists enforce_assignment_submission_integrity on public.assignment_submissions;
create trigger enforce_assignment_submission_integrity before insert or update on public.assignment_submissions
for each row execute function public.enforce_submission_integrity();

drop trigger if exists enforce_student_attendance_integrity on public.student_attendances;
create trigger enforce_student_attendance_integrity before insert or update on public.student_attendances
for each row execute function public.enforce_student_attendance_integrity();

-- Nomor registrasi SPMB-YYYY-XXXX dari sequence (aman konkurensi).

create or replace function public.generate_registration_number()
returns text
language plpgsql
security definer
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char(now(), 'YYYY');
  v_seq := nextval('public.seq_registration_number');
  return 'SPMB-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

grant usage on sequence public.seq_registration_number to public, authenticated, service_role;

-- 4. NORMALISASI NOMOR HP ----------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p is null then null
    when regexp_replace(p, '[[:space:]().-]', '', 'g') like '+62%'
      then '0' || substr(regexp_replace(p, '[[:space:]().-]', '', 'g'), 4)
    when regexp_replace(p, '[[:space:]().-]', '', 'g') ~ '^62[0-9]{8,}$'
      then '0' || substr(regexp_replace(p, '[[:space:]().-]', '', 'g'), 3)
    else regexp_replace(p, '[[:space:]().-]', '', 'g')
  end;
$$;

-- Import CSV atomik (siswa, guru via NUPTK, wali murid). Hanya service role.
create or replace function public.import_csv_batch(
  p_type text,
  p_actor uuid,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_student_id uuid;
  v_parent_id uuid;
  v_classroom_id uuid;
  v_batch_id uuid;
  v_count int := 0;
begin
  if p_type not in ('siswa', 'guru', 'wali_murid') then
    raise exception 'Tipe import tidak dikenal: %', p_type;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    if p_type = 'siswa' then
      insert into public.profiles (id, name, email, login_identifier, role, is_active, must_change_password)
      values ((r->>'profile_id')::uuid, r->>'name', r->>'email', r->>'nis', 'murid', true, true);

      insert into public.students (profile_id, nis, gender, birth_place, birth_date, address, is_active)
      values ((r->>'profile_id')::uuid, r->>'nis', r->>'gender', r->>'birth_place',
              (r->>'birth_date')::date, nullif(r->>'address', ''), true)
      returning id into v_student_id;

      if coalesce(r->>'classroom_name', '') <> '' then
        select c.id into v_classroom_id
        from public.classrooms c
        where lower(trim(c.name)) = lower(trim(r->>'classroom_name'))
        limit 1;

        if v_classroom_id is null then
          raise exception 'Rombel "%" untuk NIS % tidak ditemukan', r->>'classroom_name', r->>'nis';
        end if;

        insert into public.class_students (classroom_id, student_id, status)
        values (v_classroom_id, v_student_id, 'active');
      end if;

    elsif p_type = 'guru' then
      insert into public.profiles (id, name, email, login_identifier, role, phone, is_active, must_change_password)
      values ((r->>'profile_id')::uuid, r->>'name', r->>'email', r->>'email', 'guru',
              r->>'phone', true, true);

      insert into public.teachers (profile_id, nuptk, is_active)
      values ((r->>'profile_id')::uuid, btrim(r->>'nuptk'), true);

    else -- wali_murid
      if (r->>'is_new')::boolean then
        insert into public.profiles (id, name, email, login_identifier, role, phone, is_active, must_change_password)
        values ((r->>'profile_id')::uuid, r->>'parent_name', r->>'email', r->>'phone',
                'wali_murid', r->>'phone', true, true)
        on conflict (id) do nothing; -- satu wali bisa muncul di beberapa baris (beberapa anak)

        insert into public.parents (profile_id)
        values ((r->>'profile_id')::uuid)
        on conflict (profile_id) do nothing;
      end if;

      select p.id into v_parent_id from public.parents p where p.profile_id = (r->>'profile_id')::uuid;
      if v_parent_id is null then
        raise exception 'Data wali murid % tidak ditemukan', r->>'phone';
      end if;

      select s.id into v_student_id from public.students s where s.nis = r->>'student_nis';
      if v_student_id is null then
        raise exception 'Siswa dengan NIS % tidak ditemukan', r->>'student_nis';
      end if;

      insert into public.parent_students (parent_id, student_id, relationship, is_primary)
      values (v_parent_id, v_student_id, r->>'relationship', true)
      on conflict (parent_id, student_id) do nothing;
    end if;

    v_count := v_count + 1;
  end loop;

  insert into public.import_batches (imported_by, entity_type, template_version, total_rows, success_rows, failed_rows)
  values (p_actor, p_type, '1.0', v_count, v_count, 0)
  returning id into v_batch_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'commit_csv_batch', 'import_batches', v_batch_id,
          jsonb_build_object('type', p_type, 'total_rows', v_count, 'success_rows', v_count));

  return v_batch_id;
end;
$$;

drop trigger if exists enforce_teacher_attendance_integrity on public.teacher_attendances;
create trigger enforce_teacher_attendance_integrity before insert or update on public.teacher_attendances
for each row execute function public.enforce_teacher_attendance_integrity();

create or replace function public.prevent_schedule_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.schedules s
    where s.id <> new.id
      and s.day_of_week = new.day_of_week
      and s.start_time < new.end_time
      and new.start_time < s.end_time
      and (s.classroom_id = new.classroom_id or s.teacher_id = new.teacher_id)
  ) then
    raise exception 'Jadwal bentrok dengan jadwal lain pada rombel atau guru yang sama.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_schedule_overlap on public.schedules;
create trigger prevent_schedule_overlap before insert or update on public.schedules
for each row execute function public.prevent_schedule_overlap();

create or replace function public.can_manage_announcements()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super() or public.has_teacher_position('kepala_sekolah');
$$;

revoke all on function public.can_manage_announcements() from public;

grant execute on function public.can_manage_announcements() to authenticated;

create or replace function public.can_record_tahfidz(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super()
    or public.has_teacher_position('koordinator_tahfidz')
    or exists (
      select 1 from public.class_students cs
      join public.classrooms c on c.id = cs.classroom_id
      where cs.student_id = p_student_id and cs.status = 'active' and cs.left_at is null
        and c.homeroom_teacher_id = public.current_teacher_id()
    )
    or exists (
      select 1 from public.class_students cs
      join public.teaching_assignments ta on ta.classroom_id = cs.classroom_id
      join public.subjects sub on sub.id = ta.subject_id
      where cs.student_id = p_student_id and cs.status = 'active' and cs.left_at is null
        and ta.teacher_id = public.current_teacher_id()
        and (upper(sub.code) in ('TFZ', 'TAHFIDZ') or sub.name ilike '%tahfidz%')
    );
$$;

revoke all on function public.can_record_tahfidz(uuid) from public;

grant execute on function public.can_record_tahfidz(uuid) to authenticated;

create or replace function public.create_marketplace_order(p_student_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parent_id uuid;
  v_order_id uuid;
  v_year_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product public.marketplace_products%rowtype;
  v_qty int;
  v_number text;
begin
  if public.current_user_role() is distinct from 'wali_murid' then
    raise exception 'Hanya wali murid yang dapat melakukan pemesanan.';
  end if;
  select p.id into v_parent_id from public.parents p where p.profile_id = auth.uid();
  if v_parent_id is null then raise exception 'Data wali murid tidak ditemukan.'; end if;
  if not exists (select 1 from public.parent_students ps where ps.parent_id = v_parent_id and ps.student_id = p_student_id) then
    raise exception 'Murid yang dipilih bukan anak Anda.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Keranjang masih kosong.'; end if;
  select id into v_year_id from public.academic_years where is_active = true limit 1;
  if v_year_id is null then raise exception 'Belum ada tahun ajaran aktif.'; end if;

  v_number := 'MP-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || nextval('public.seq_marketplace_order_number');
  insert into public.marketplace_orders (parent_id, student_id, status, total_amount, order_number)
  values (v_parent_id, p_student_id, 'pending_payment', 0, v_number)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then raise exception 'Jumlah barang tidak valid.'; end if;
    select * into v_product from public.marketplace_products
      where id = (v_item->>'product_id')::uuid and is_published = true
      for update;
    if not found then raise exception 'Produk tidak tersedia.'; end if;
    if v_product.product_type = 'digital' then
      v_qty := 1;
    elsif v_product.stock is not null then
      if v_product.stock < v_qty then
        raise exception 'Stok "%" tidak mencukupi (tersisa %).', v_product.title, v_product.stock;
      end if;
      update public.marketplace_products set stock = stock - v_qty where id = v_product.id;
    end if;
    insert into public.marketplace_order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_product.price);
    v_total := v_total + v_product.price * v_qty;
  end loop;

  if v_total <= 0 then raise exception 'Total pesanan harus lebih dari 0.'; end if;
  update public.marketplace_orders set total_amount = v_total where id = v_order_id;

  insert into public.payment_invoices (student_id, parent_id, marketplace_order_id, academic_year_id, type, title, amount, due_date, status, created_by)
  values (p_student_id, v_parent_id, v_order_id, v_year_id, 'marketplace', 'Pesanan Marketplace ' || v_number, v_total,
          ((now() at time zone 'Asia/Jakarta')::date + 3), 'unpaid', auth.uid());

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'create_marketplace_order', 'marketplace_orders', v_order_id,
          jsonb_build_object('order_number', v_number, 'total', v_total));
  return v_order_id;
end;
$$;

revoke all on function public.create_marketplace_order(uuid, jsonb) from public, anon;

grant execute on function public.create_marketplace_order(uuid, jsonb) to authenticated;

create or replace function public.cancel_marketplace_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.marketplace_orders%rowtype;
begin
  select o.* into v_order from public.marketplace_orders o
    join public.parents p on p.id = o.parent_id
    where o.id = p_order_id and (p.profile_id = auth.uid() or public.is_admin_or_super())
    for update of o;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  if v_order.status <> 'pending_payment' then raise exception 'Pesanan ini tidak dapat dibatalkan.'; end if;
  if exists (select 1 from public.payment_invoices i where i.marketplace_order_id = p_order_id and i.status = 'paid') then
    raise exception 'Pesanan yang sudah lunas tidak dapat dibatalkan.';
  end if;
  update public.marketplace_products mp set stock = mp.stock + oi.quantity
    from public.marketplace_order_items oi
    where oi.order_id = p_order_id and oi.product_id = mp.id and mp.stock is not null and mp.product_type = 'physical';
  update public.marketplace_orders set status = 'cancelled' where id = p_order_id;
  update public.payment_invoices set status = 'cancelled' where marketplace_order_id = p_order_id and status <> 'paid';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'cancel_marketplace_order', 'marketplace_orders', p_order_id, '{}'::jsonb);
end;
$$;

revoke all on function public.cancel_marketplace_order(uuid) from public, anon;

grant execute on function public.cancel_marketplace_order(uuid) to authenticated;

-- 1. HELPER ---------------------------------------------------------------------------
create or replace function public.is_finance_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super() or public.has_teacher_position('bendahara');
$$;

revoke all on function public.is_finance_staff() from public;

grant execute on function public.is_finance_staff() to authenticated;

create or replace function public.set_invoice_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM') || '-'
      || lpad(nextval('public.seq_invoice_number')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_number on public.payment_invoices;
create trigger set_invoice_number before insert on public.payment_invoices
for each row execute function public.set_invoice_number();

-- 3. STATUS 'PAID' HANYA LEWAT FUNGSI PEMBAYARAN -------------------------------------
create or replace function public.guard_invoice_paid()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.payment_settlement', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status = 'paid' then
    raise exception 'Tagihan baru tidak dapat langsung berstatus lunas.';
  end if;
  if tg_op = 'UPDATE' and (
    (new.status = 'paid' and old.status is distinct from 'paid')
    or (old.status = 'paid' and new.status is distinct from 'paid')
  ) then
    raise exception 'Status lunas hanya dapat diubah melalui verifikasi pembayaran.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_invoice_paid on public.payment_invoices;
create trigger guard_invoice_paid before insert or update on public.payment_invoices
for each row execute function public.guard_invoice_paid();

drop trigger if exists set_payment_proofs_updated_at on public.payment_proofs;
create trigger set_payment_proofs_updated_at before update on public.payment_proofs
for each row execute function public.handle_updated_at();

-- 7. FUNGSI PEMBAYARAN -----------------------------------------------------------------
create or replace function public.submit_payment_proof(
  p_invoice_id uuid, p_file_path text, p_amount numeric, p_transfer_date date,
  p_sender_name text, p_sender_bank text, p_notes text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parent_id uuid;
  v_invoice public.payment_invoices%rowtype;
  v_proof_id uuid;
begin
  if public.current_user_role() is distinct from 'wali_murid' then
    raise exception 'Hanya wali murid yang dapat mengunggah bukti pembayaran.';
  end if;
  select id into v_parent_id from public.parents where profile_id = auth.uid();
  if v_parent_id is null then raise exception 'Data wali murid tidak ditemukan.'; end if;

  select * into v_invoice from public.payment_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Tagihan tidak ditemukan.'; end if;
  if not (
    v_invoice.parent_id = v_parent_id
    or exists (select 1 from public.parent_students ps where ps.parent_id = v_parent_id and ps.student_id = v_invoice.student_id)
  ) then raise exception 'Tagihan ini bukan milik anak Anda.'; end if;
  if v_invoice.status <> 'unpaid' then
    raise exception 'Tagihan tidak sedang menunggu pembayaran.';
  end if;
  if p_amount <> v_invoice.amount then
    raise exception 'Nominal transfer harus sama dengan nominal tagihan (Rp %).', to_char(v_invoice.amount, 'FM999G999G999');
  end if;
  if p_transfer_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal transfer tidak boleh di masa depan.';
  end if;

  insert into public.payment_proofs (invoice_id, parent_id, file_path, amount, transfer_date, sender_name, sender_bank, notes)
  values (p_invoice_id, v_parent_id, p_file_path, p_amount, p_transfer_date, trim(p_sender_name), trim(p_sender_bank), nullif(trim(p_notes), ''))
  returning id into v_proof_id;
  update public.payment_invoices set status = 'pending' where id = p_invoice_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'submit_payment_proof', 'payment_invoices', p_invoice_id, jsonb_build_object('proof_id', v_proof_id));
  return v_proof_id;
end;
$$;

-- Internal: catat transaksi, tandai lunas, buat kuitansi, lunasi pesanan marketplace.
create or replace function public._settle_invoice(
  p_invoice_id uuid, p_provider text, p_payer_bank text, p_payer_name text, p_payload jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.payment_invoices%rowtype;
  v_tx_id uuid;
  v_student_name text;
  v_class_name text;
  v_logo text;
begin
  select * into v_invoice from public.payment_invoices where id = p_invoice_id for update;
  if v_invoice.status = 'paid' then raise exception 'Tagihan sudah lunas.'; end if;
  if v_invoice.status not in ('unpaid', 'pending') then raise exception 'Tagihan tidak dapat dilunasi pada status ini.'; end if;

  perform set_config('app.payment_settlement', 'on', true);

  insert into public.payment_transactions (invoice_id, provider, order_id, gross_amount, status, paid_at, payer_bank_name, payer_bank_account_name, raw_payload)
  values (p_invoice_id, p_provider, upper(p_provider) || '-' || v_invoice.invoice_number || '-' || substr(gen_random_uuid()::text, 1, 6),
          v_invoice.amount, 'paid', now(), p_payer_bank, p_payer_name, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('recorded_by', auth.uid()))
  returning id into v_tx_id;

  update public.payment_invoices set status = 'paid' where id = p_invoice_id;

  select pr.name into v_student_name from public.students s join public.profiles pr on pr.id = s.profile_id where s.id = v_invoice.student_id;
  select c.name into v_class_name from public.class_students cs join public.classrooms c on c.id = cs.classroom_id
    where cs.student_id = v_invoice.student_id and cs.status = 'active' and cs.left_at is null limit 1;
  select logo_url into v_logo from public.school_settings limit 1;

  insert into public.payment_receipts (invoice_id, transaction_id, student_id, class_name, school_logo_url, paid_at, invoice_number, student_name, amount, status, payer_bank_name, payer_bank_account_name)
  values (p_invoice_id, v_tx_id, v_invoice.student_id, v_class_name, v_logo, now(), v_invoice.invoice_number,
          coalesce(v_student_name, '-'), v_invoice.amount, 'paid', p_payer_bank, p_payer_name);

  if v_invoice.marketplace_order_id is not null then
    update public.marketplace_orders set status = 'paid' where id = v_invoice.marketplace_order_id and status = 'pending_payment';
  end if;

  perform set_config('app.payment_settlement', 'off', true);
  return v_tx_id;
end;
$$;

revoke all on function public._settle_invoice(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.approve_payment_proof(p_proof_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proof public.payment_proofs%rowtype;
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat memverifikasi pembayaran.'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof_id for update;
  if not found then raise exception 'Bukti pembayaran tidak ditemukan.'; end if;
  if v_proof.status <> 'pending' then raise exception 'Bukti pembayaran ini sudah diproses.'; end if;

  perform public._settle_invoice(v_proof.invoice_id, 'manual_transfer', v_proof.sender_bank, v_proof.sender_name,
    jsonb_build_object('proof_id', v_proof.id, 'transfer_date', v_proof.transfer_date));
  update public.payment_proofs
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(p_notes), '')
    where id = p_proof_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'approve_payment_proof', 'payment_invoices', v_proof.invoice_id, jsonb_build_object('proof_id', p_proof_id));
end;
$$;

create or replace function public.reject_payment_proof(p_proof_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proof public.payment_proofs%rowtype;
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat memverifikasi pembayaran.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Alasan penolakan wajib diisi.'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof_id for update;
  if not found then raise exception 'Bukti pembayaran tidak ditemukan.'; end if;
  if v_proof.status <> 'pending' then raise exception 'Bukti pembayaran ini sudah diproses.'; end if;

  update public.payment_proofs
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = trim(p_reason)
    where id = p_proof_id;
  update public.payment_invoices set status = 'unpaid' where id = v_proof.invoice_id and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'reject_payment_proof', 'payment_invoices', v_proof.invoice_id, jsonb_build_object('proof_id', p_proof_id));
end;
$$;

create or replace function public.record_cash_payment(p_invoice_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat mencatat pembayaran tunai.'; end if;
  perform public._settle_invoice(p_invoice_id, 'cash', null, null, jsonb_build_object('notes', nullif(trim(p_notes), '')));
  update public.payment_proofs
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = 'Tagihan dilunasi tunai di sekolah.'
    where invoice_id = p_invoice_id and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'record_cash_payment', 'payment_invoices', p_invoice_id, jsonb_build_object('notes', nullif(trim(p_notes), '')));
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, numeric, date, text, text, text) from public, anon;

revoke all on function public.approve_payment_proof(uuid, text) from public, anon;

revoke all on function public.reject_payment_proof(uuid, text) from public, anon;

revoke all on function public.record_cash_payment(uuid, text) from public, anon;

grant execute on function public.submit_payment_proof(uuid, text, numeric, date, text, text, text) to authenticated;

grant execute on function public.approve_payment_proof(uuid, text) to authenticated;

grant execute on function public.reject_payment_proof(uuid, text) to authenticated;

grant execute on function public.record_cash_payment(uuid, text) to authenticated;

revoke all on function public.import_csv_batch(text, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.import_csv_batch(text, uuid, jsonb) to service_role;

grant execute on function public.generate_registration_number() to public, authenticated, service_role;

/**
 * Mengembalikan true bila aksi DIIZINKAN (hit ke-n <= p_max dalam p_window_seconds).
 * Hit yang ditolak tidak dicatat, agar penyerang tidak memperpanjang blokirnya sendiri tanpa batas.
 */
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'Kunci rate limit tidak valid';
  end if;
  if p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Parameter rate limit tidak valid';
  end if;

  perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_key));

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket_key = p_key
    and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_key);

  -- Bersihkan catatan lama secara oportunistik (~1% panggilan).
  if random() < 0.01 then
    delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

grant execute on function public.hit_rate_limit(text, int, int) to service_role;
