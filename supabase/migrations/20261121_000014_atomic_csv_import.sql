-- ==============================================================================
-- MIGRATION 14 - IMPORT CSV ATOMIK (hasil QA 2026-11-21)
-- Seluruh insert data domain hasil import (profiles, students/teachers/parents,
-- class_students, parent_students, import_batches, audit_logs) dijalankan dalam
-- SATU transaksi. Akun auth.users dibuat lebih dulu oleh Server Action
-- (commitCsvBatchAction); jika fungsi ini gagal, Server Action menghapus akun
-- auth tersebut sehingga tidak ada komit parsial.
-- Hanya dapat dipanggil oleh service role.
-- ==============================================================================

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

      insert into public.teachers (profile_id, nip, nuptk, is_active)
      values ((r->>'profile_id')::uuid, r->>'nip', nullif(r->>'nuptk', ''), true);

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

revoke all on function public.import_csv_batch(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_csv_batch(text, uuid, jsonb) to service_role;
