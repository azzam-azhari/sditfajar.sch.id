-- ==============================================================================
-- MIGRATION 15 - FASE 5: PENYEMPURNAAN LMS, JADWAL & PRESENSI
-- 1. Toleransi keterlambatan tugas (late_tolerance_minutes).
-- 2. Integritas pengumpulan tugas (resubmit tetap dicek deadline, tidak menimpa
--    jawaban yang sudah dinilai).
-- 3. Presensi guru: 06.30-07.00 hadir, setelah 07.00 terlambat (sampai 23.59),
--    check-out >= 14.30 setelah check-in, akhir pekan mengikuti tahun ajaran aktif,
--    guru tidak dapat mengubah catatan sendiri.
-- 4. Presensi murid dapat dikoreksi pada hari yang sama.
-- 5. Nilai akhir unik per siswa/mapel/kelas/semester dan hanya oleh pengampu.
-- 6. Jadwal: jam selesai > jam mulai, tolak bentrok kelas/guru.
-- 7. RLS baca materi/tugas hanya keanggotaan kelas aktif; pengumuman kelas/siswa
--    juga terbaca oleh wali murid.
-- Idempotent: aman dijalankan ulang.
-- ==============================================================================

begin;

-- 1. TOLERANSI KETERLAMBATAN ---------------------------------------------------------
alter table public.assignments
  add column if not exists late_tolerance_minutes integer;

alter table public.assignments drop constraint if exists chk_assignments_late_tolerance;
alter table public.assignments
  add constraint chk_assignments_late_tolerance
  check (late_tolerance_minutes is null or late_tolerance_minutes >= 0);

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

drop trigger if exists enforce_teacher_attendance_integrity on public.teacher_attendances;
create trigger enforce_teacher_attendance_integrity before insert or update on public.teacher_attendances
for each row execute function public.enforce_teacher_attendance_integrity();

drop policy if exists "Teacher attendances update" on public.teacher_attendances;
create policy "Teacher attendances update"
  on public.teacher_attendances for update
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

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

-- 5. NILAI AKHIR ----------------------------------------------------------------------
create unique index if not exists uq_grades_final_per_scope
  on public.grades (student_id, subject_id, classroom_id, semester_id)
  where grade_type = 'final';

drop policy if exists "Grades manage policy" on public.grades;
drop policy if exists "Grades manage assigned teaching" on public.grades;
create policy "Grades manage assigned teaching"
  on public.grades for all
  to authenticated
  using ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)))
  with check ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)));

-- 6. JADWAL --------------------------------------------------------------------------
alter table public.schedules drop constraint if exists chk_schedules_time_order;
alter table public.schedules
  add constraint chk_schedules_time_order check (end_time > start_time) not valid;

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

-- 7. RLS BACA ------------------------------------------------------------------------
drop policy if exists "Materials read policy" on public.materials;
create policy "Materials read policy"
  on public.materials for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.teachers t where t.id = materials.teacher_id and t.profile_id = auth.uid())
    or exists (select 1 from public.classrooms c join public.teachers t on t.id = c.homeroom_teacher_id where c.id = materials.classroom_id and t.profile_id = auth.uid())
    or (
      status = 'published' and (
        exists (
          select 1 from public.class_students cs
          join public.students s on s.id = cs.student_id
          where cs.classroom_id = materials.classroom_id and s.profile_id = auth.uid()
            and cs.status = 'active' and cs.left_at is null
        )
        or exists (
          select 1 from public.parent_students ps
          join public.parents p on p.id = ps.parent_id
          join public.class_students cs on cs.student_id = ps.student_id
          where cs.classroom_id = materials.classroom_id and p.profile_id = auth.uid()
            and cs.status = 'active' and cs.left_at is null
        )
      )
    )
  );

drop policy if exists "Assignments read policy" on public.assignments;
create policy "Assignments read policy"
  on public.assignments for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.teachers t where t.id = assignments.teacher_id and t.profile_id = auth.uid())
    or exists (select 1 from public.classrooms c join public.teachers t on t.id = c.homeroom_teacher_id where c.id = assignments.classroom_id and t.profile_id = auth.uid())
    or (
      status in ('published', 'closed') and (
        exists (
          select 1 from public.class_students cs
          join public.students s on s.id = cs.student_id
          where cs.classroom_id = assignments.classroom_id and s.profile_id = auth.uid()
            and cs.status = 'active' and cs.left_at is null
        )
        or exists (
          select 1 from public.parent_students ps
          join public.parents p on p.id = ps.parent_id
          join public.class_students cs on cs.student_id = ps.student_id
          where cs.classroom_id = assignments.classroom_id and p.profile_id = auth.uid()
            and cs.status = 'active' and cs.left_at is null
        )
      )
    )
  );

-- Kepala sekolah (laporan akademik) dan wali kelas (monitoring kelas binaan)
-- dapat membaca pengumpulan tugas; mengubah tetap hanya oleh guru pengampu.
drop policy if exists "Submissions read policy" on public.assignment_submissions;
create policy "Submissions read policy"
  on public.assignment_submissions for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.students s where s.id = assignment_submissions.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = assignment_submissions.student_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id and t.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id and public.is_my_homeroom(a.classroom_id)
    )
  );

drop policy if exists "Announcements read" on public.announcements;
create policy "Announcements read"
  on public.announcements for select
  to authenticated
  using (
    public.is_admin_or_super()
    or (
      status = 'published' and (
        target_type = 'all'
        or (target_type = 'role' and target_role = public.current_user_role())
        or (
          target_type = 'class' and (
            exists (
              select 1 from public.class_students cs
              join public.students s on s.id = cs.student_id
              where cs.classroom_id = announcements.classroom_id and s.profile_id = auth.uid()
            )
            or exists (
              select 1 from public.class_students cs
              join public.parent_students ps on ps.student_id = cs.student_id
              join public.parents p on p.id = ps.parent_id
              where cs.classroom_id = announcements.classroom_id and p.profile_id = auth.uid()
            )
          )
        )
        or (
          target_type = 'student' and (
            exists (
              select 1 from public.students s
              where s.id = announcements.student_id and s.profile_id = auth.uid()
            )
            or exists (
              select 1 from public.parent_students ps
              join public.parents p on p.id = ps.parent_id
              where ps.student_id = announcements.student_id and p.profile_id = auth.uid()
            )
          )
        )
      )
    )
  );

commit;
