-- ==============================================================================
-- MIGRATION 17 - KOORDINATOR TAHFIDZ DAPAT MEMBACA DATA POKOK MURID
-- Rekap tahfidz seluruh murid (Fase 6) membutuhkan NIS dan nama murid.
-- Sama dengan policy 000010, ditambah has_teacher_position('koordinator_tahfidz').
-- Idempotent.
-- ==============================================================================

drop policy if exists "Students read policy" on public.students;
create policy "Students read policy"
  on public.students for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or public.has_teacher_position('koordinator_tahfidz')
    or id in (
      select ps.student_id from public.parent_students ps
      where ps.parent_id = public.get_current_parent_id()
    )
    or exists (
      select 1 from public.class_students cs
      join public.teaching_assignments ta on ta.classroom_id = cs.classroom_id
      join public.teachers t on t.id = ta.teacher_id
      where cs.student_id = public.students.id and t.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.class_students cs
      join public.classrooms c on c.id = cs.classroom_id
      join public.teachers t on t.id = c.homeroom_teacher_id
      where cs.student_id = public.students.id and t.profile_id = (select auth.uid())
    )
  );
