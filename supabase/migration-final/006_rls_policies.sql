-- ==============================================================================
-- 006 - ROW LEVEL SECURITY & POLICIES
-- Hanya policy yang berlaku saat ini.
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel public
alter table public.profiles enable row level security;
alter table public.school_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.school_period_settings enable row level security;
alter table public.classes enable row level security;
alter table public.positions enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_students enable row level security;
alter table public.classrooms enable row level security;
alter table public.teacher_positions enable row level security;
alter table public.class_students enable row level security;
alter table public.subjects enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.schedules enable row level security;
alter table public.admission_waves enable row level security;
alter table public.student_registration_applications enable row level security;
alter table public.student_registration_documents enable row level security;
alter table public.teacher_attendances enable row level security;
alter table public.student_attendances enable row level security;
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.news_posts enable row level security;
alter table public.tahfidz_records enable row level security;
alter table public.import_batches enable row level security;
alter table public.payment_settings enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.payment_invoices enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.login_attempts enable row level security;
alter table public.rate_limit_hits enable row level security;
alter table public.payment_proofs enable row level security;

-- Tabel internal rate limit: tanpa policy, hanya service role
revoke all on public.login_attempts from anon, authenticated;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Policy (versi final). payment_proofs, marketplace & transaksi ditulis lewat fungsi security definer.
drop policy if exists "School settings public read" on public.school_settings;
create policy "School settings public read"
  on public.school_settings for select
  to public
  using (true);

drop policy if exists "School settings super admin only write" on public.school_settings;
create policy "School settings super admin only write"
  on public.school_settings for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Audit logs super admin read only" on public.audit_logs;
create policy "Audit logs super admin read only"
  on public.audit_logs for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "Audit logs insert policy" on public.audit_logs;
create policy "Audit logs insert policy"
  on public.audit_logs for insert
  to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

drop policy if exists "Academic years read" on public.academic_years;
create policy "Academic years read" on public.academic_years for select to authenticated using (true);

drop policy if exists "Academic years admin write" on public.academic_years;
create policy "Academic years admin write" on public.academic_years for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Semesters read" on public.semesters;
create policy "Semesters read" on public.semesters for select to authenticated using (true);

drop policy if exists "Semesters admin write" on public.semesters;
create policy "Semesters admin write" on public.semesters for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Period settings read" on public.school_period_settings;
create policy "Period settings read" on public.school_period_settings for select to authenticated using (true);

drop policy if exists "Period settings write" on public.school_period_settings;
create policy "Period settings write" on public.school_period_settings for all to authenticated using (public.is_admin_or_super() or public.has_teacher_position('kepala_sekolah')) with check (public.is_admin_or_super() or public.has_teacher_position('kepala_sekolah'));

drop policy if exists "Classes read" on public.classes;
create policy "Classes read" on public.classes for select to authenticated using (true);

drop policy if exists "Classes admin write" on public.classes;
create policy "Classes admin write" on public.classes for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Positions read" on public.positions;
create policy "Positions read" on public.positions for select to authenticated using (true);

drop policy if exists "Positions admin write" on public.positions;
create policy "Positions admin write" on public.positions for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Classrooms read" on public.classrooms;
create policy "Classrooms read" on public.classrooms for select to authenticated using (true);

drop policy if exists "Classrooms admin write" on public.classrooms;
create policy "Classrooms admin write" on public.classrooms for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Subjects read" on public.subjects;
create policy "Subjects read" on public.subjects for select to authenticated using (true);

drop policy if exists "Subjects admin write" on public.subjects;
create policy "Subjects admin write" on public.subjects for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Schedules read" on public.schedules;
create policy "Schedules read" on public.schedules for select to authenticated using (true);

drop policy if exists "Schedules admin write" on public.schedules;
create policy "Schedules admin write" on public.schedules for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Teachers read" on public.teachers;
create policy "Teachers read" on public.teachers for select to authenticated using (true);

drop policy if exists "Teachers admin write" on public.teachers;
create policy "Teachers admin write" on public.teachers for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Teacher positions read" on public.teacher_positions;
create policy "Teacher positions read" on public.teacher_positions for select to authenticated using (true);

drop policy if exists "Teacher positions admin write" on public.teacher_positions;
create policy "Teacher positions admin write" on public.teacher_positions for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Students admin write" on public.students;
create policy "Students admin write"
  on public.students for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Parents read policy" on public.parents;
create policy "Parents read policy"
  on public.parents for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin_or_super());

drop policy if exists "Parents admin write" on public.parents;
create policy "Parents admin write"
  on public.parents for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Parent students admin write" on public.parent_students;
create policy "Parent students admin write"
  on public.parent_students for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Class students read" on public.class_students;
create policy "Class students read" on public.class_students for select to authenticated using (true);

drop policy if exists "Class students admin write" on public.class_students;
create policy "Class students admin write" on public.class_students for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Teaching assignments read" on public.teaching_assignments;
create policy "Teaching assignments read" on public.teaching_assignments for select to authenticated using (true);

drop policy if exists "Teaching assignments admin write" on public.teaching_assignments;
create policy "Teaching assignments admin write" on public.teaching_assignments for all to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists "Admission waves public read" on public.admission_waves;
create policy "Admission waves public read"
  on public.admission_waves for select
  to public
  using ((status = 'open' and is_active = true) or public.is_admin_or_super());

drop policy if exists "Admission waves admin write" on public.admission_waves;
create policy "Admission waves admin write"
  on public.admission_waves for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Registration apps public insert" on public.student_registration_applications;
create policy "Registration apps public insert"
  on public.student_registration_applications for insert
  to public
  with check (
    exists (
      select 1 from public.admission_waves w
      where w.id = admission_wave_id and w.status = 'open' and w.is_active = true
    )
  );

drop policy if exists "Registration apps admin read" on public.student_registration_applications;
create policy "Registration apps admin read"
  on public.student_registration_applications for select
  to authenticated
  using (public.is_admin_or_super());

drop policy if exists "Registration apps admin write" on public.student_registration_applications;
create policy "Registration apps admin write"
  on public.student_registration_applications for update
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Registration docs public insert" on public.student_registration_documents;
create policy "Registration docs public insert"
  on public.student_registration_documents for insert
  to public
  with check (
    exists (
      select 1 from public.student_registration_applications a
      join public.admission_waves w on w.id = a.admission_wave_id
      where a.id = application_id and w.status = 'open' and w.is_active = true
    )
  );

drop policy if exists "Registration docs admin read and write" on public.student_registration_documents;
create policy "Registration docs admin read and write"
  on public.student_registration_documents for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Grades read policy" on public.grades;
create policy "Grades read policy"
  on public.grades for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.students s where s.id = grades.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = grades.student_id and p.profile_id = auth.uid()
    )
    or exists (select 1 from public.teachers t where t.id = grades.teacher_id and t.profile_id = auth.uid())
    or exists (select 1 from public.classrooms c join public.teachers t on t.id = c.homeroom_teacher_id where c.id = grades.classroom_id and t.profile_id = auth.uid())
  );

drop policy if exists "Teacher attendances read" on public.teacher_attendances;
create policy "Teacher attendances read"
  on public.teacher_attendances for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.teachers t where t.id = teacher_attendances.teacher_id and t.profile_id = auth.uid())
  );

drop policy if exists "Teacher attendances write" on public.teacher_attendances;
create policy "Teacher attendances write"
  on public.teacher_attendances for insert
  to authenticated
  with check (
    public.is_admin_or_super()
    or exists (select 1 from public.teachers t where t.id = teacher_id and t.profile_id = auth.uid())
  );

drop policy if exists "Student attendances read" on public.student_attendances;
create policy "Student attendances read"
  on public.student_attendances for select
  to authenticated
  using (
    public.is_admin_or_super()
    or public.has_teacher_position('kepala_sekolah')
    or exists (select 1 from public.students s where s.id = student_attendances.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = student_attendances.student_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.schedules sch
      join public.teachers t on t.id = sch.teacher_id
      where sch.id = student_attendances.schedule_id and t.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.classrooms c
      join public.teachers t on t.id = c.homeroom_teacher_id
      where c.id = student_attendances.classroom_id and t.profile_id = auth.uid()
    )
  );

drop policy if exists "News posts public read" on public.news_posts;
create policy "News posts public read"
  on public.news_posts for select
  to public
  using (status = 'published' or public.is_admin_or_super());

drop policy if exists "News posts admin write" on public.news_posts;
create policy "News posts admin write"
  on public.news_posts for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Import batches super admin only" on public.import_batches;
create policy "Import batches super admin only"
  on public.import_batches for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Payment settings super admin only" on public.payment_settings;
create policy "Payment settings super admin only"
  on public.payment_settings for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Marketplace products public read" on public.marketplace_products;
create policy "Marketplace products public read"
  on public.marketplace_products for select
  to public
  using (is_published = true or public.is_admin_or_super());

drop policy if exists "Marketplace products admin write" on public.marketplace_products;
create policy "Marketplace products admin write"
  on public.marketplace_products for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Marketplace orders read" on public.marketplace_orders;
create policy "Marketplace orders read"
  on public.marketplace_orders for select
  to authenticated
  using (
    public.is_admin_or_super()
    or exists (select 1 from public.parents p where p.id = marketplace_orders.parent_id and p.profile_id = auth.uid())
  );

drop policy if exists "Marketplace orders admin update" on public.marketplace_orders;
create policy "Marketplace orders admin update"
  on public.marketplace_orders for update
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Marketplace order items read" on public.marketplace_order_items;
create policy "Marketplace order items read"
  on public.marketplace_order_items for select
  to authenticated
  using (
    public.is_admin_or_super()
    or exists (
      select 1 from public.marketplace_orders o
      join public.parents p on p.id = o.parent_id
      where o.id = marketplace_order_items.order_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists "Invoices admin write" on public.payment_invoices;
create policy "Invoices admin write"
  on public.payment_invoices for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Receipts admin manage" on public.payment_receipts;
create policy "Receipts admin manage"
  on public.payment_receipts for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Parent students read policy" on public.parent_students;
create policy "Parent students read policy"
  on public.parent_students for select
  to authenticated
  using (
    public.is_admin_or_super()
    or parent_id = public.get_current_parent_id()
    or student_id = public.get_current_student_id()
    or public.is_teacher()
  );

drop policy if exists "Profiles read policy" on public.profiles;
create policy "Profiles read policy"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin_or_super()
    or public.is_teacher()
    or id in (select public.get_my_children_profile_ids())
  );

drop policy if exists "Materials manage assigned teaching" on public.materials;
create policy "Materials manage assigned teaching" on public.materials for all to authenticated
using ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)))
with check ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)));

drop policy if exists "Assignments manage assigned teaching" on public.assignments;
create policy "Assignments manage assigned teaching" on public.assignments for all to authenticated
using ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)))
with check ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)));

drop policy if exists "Submissions own assigned task insert" on public.assignment_submissions;
create policy "Submissions own assigned task insert" on public.assignment_submissions for insert to authenticated
with check (
  exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid()))
  and exists (select 1 from public.assignments a join public.class_students cs on cs.classroom_id = a.classroom_id
    where a.id = assignment_id and cs.student_id = assignment_submissions.student_id and cs.status = 'active' and cs.left_at is null)
);

drop policy if exists "Submissions owner or assigned teacher update" on public.assignment_submissions;
create policy "Submissions owner or assigned teacher update" on public.assignment_submissions for update to authenticated
using (
  exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid())) or
  exists (select 1 from public.assignments a where a.id = assignment_id and
    (select public.can_manage_teaching_scope(a.teacher_id, a.subject_id, a.classroom_id, a.semester_id)))
)
with check (
  exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid())) or
  exists (select 1 from public.assignments a where a.id = assignment_id and
    (select public.can_manage_teaching_scope(a.teacher_id, a.subject_id, a.classroom_id, a.semester_id)))
);

drop policy if exists "Student attendance assigned teacher or homeroom" on public.student_attendances;
create policy "Student attendance assigned teacher or homeroom" on public.student_attendances for all to authenticated
using (
  public.is_admin_or_super() or (select public.is_my_homeroom(classroom_id)) or
  exists (select 1 from public.schedules sch join public.teaching_assignments ta on ta.teacher_id = sch.teacher_id
    where sch.id = schedule_id and ta.classroom_id = student_attendances.classroom_id and ta.subject_id = sch.subject_id
      and ta.teacher_id = public.current_teacher_id())
)
with check (
  public.is_admin_or_super() or (select public.is_my_homeroom(classroom_id)) or
  exists (select 1 from public.schedules sch join public.teaching_assignments ta on ta.teacher_id = sch.teacher_id
    where sch.id = schedule_id and ta.classroom_id = student_attendances.classroom_id and ta.subject_id = sch.subject_id
      and ta.teacher_id = public.current_teacher_id())
);

drop policy if exists "Registration apps admin delete" on public.student_registration_applications;
create policy "Registration apps admin delete"
  on public.student_registration_applications for delete
  to authenticated
  using (public.is_admin_or_super());

drop policy if exists "Profiles admin update policy" on public.profiles;
create policy "Profiles admin update policy"
  on public.profiles for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_or_super() and role <> 'super_admin')
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_or_super() and role <> 'super_admin')
  );

drop policy if exists "Teacher attendances update" on public.teacher_attendances;
create policy "Teacher attendances update"
  on public.teacher_attendances for update
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Grades manage assigned teaching" on public.grades;
create policy "Grades manage assigned teaching"
  on public.grades for all
  to authenticated
  using ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)))
  with check ((select public.can_manage_teaching_scope(teacher_id, subject_id, classroom_id, semester_id)));

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

drop policy if exists "Announcements manage" on public.announcements;
create policy "Announcements manage"
  on public.announcements for all
  to authenticated
  using (public.is_admin_or_super() or (public.can_manage_announcements() and created_by = auth.uid()))
  with check (public.is_admin_or_super() or (public.can_manage_announcements() and created_by = auth.uid()));

drop policy if exists "Announcements read" on public.announcements;
create policy "Announcements read"
  on public.announcements for select
  to authenticated
  using (
    public.can_manage_announcements()
    or (
      status = 'published' and (published_at is null or published_at <= now()) and (
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
            or public.is_my_homeroom(announcements.classroom_id)
          )
        )
        or (
          target_type = 'student' and (
            exists (select 1 from public.students s where s.id = announcements.student_id and s.profile_id = auth.uid())
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

drop policy if exists "Tahfidz records write" on public.tahfidz_records;
create policy "Tahfidz records write"
  on public.tahfidz_records for all
  to authenticated
  using (public.is_admin_or_super() or (public.can_record_tahfidz(student_id) and teacher_id = auth.uid()))
  with check (public.is_admin_or_super() or (public.can_record_tahfidz(student_id) and teacher_id = auth.uid()));

drop policy if exists "Tahfidz records read" on public.tahfidz_records;
create policy "Tahfidz records read"
  on public.tahfidz_records for select
  to authenticated
  using (
    public.can_record_tahfidz(student_id)
    or teacher_id = auth.uid()
    or exists (select 1 from public.students s where s.id = tahfidz_records.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = tahfidz_records.student_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists "Marketplace order items admin write" on public.marketplace_order_items;
create policy "Marketplace order items admin write"
  on public.marketplace_order_items for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

drop policy if exists "Marketplace orders admin insert" on public.marketplace_orders;
create policy "Marketplace orders admin insert"
  on public.marketplace_orders for insert
  to authenticated
  with check (public.is_admin_or_super());

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

drop policy if exists "Payment proofs read" on public.payment_proofs;
create policy "Payment proofs read"
  on public.payment_proofs for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (select 1 from public.parents p where p.id = payment_proofs.parent_id and p.profile_id = auth.uid())
  );

drop policy if exists "Invoices read policy" on public.payment_invoices;
create policy "Invoices read policy"
  on public.payment_invoices for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (select 1 from public.students s where s.id = payment_invoices.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.parents p where p.id = payment_invoices.parent_id and p.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = payment_invoices.student_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists "Transactions read policy" on public.payment_transactions;
create policy "Transactions read policy"
  on public.payment_transactions for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (
      select 1 from public.payment_invoices inv
      join public.parents p on p.id = inv.parent_id
      where inv.id = payment_transactions.invoice_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.payment_invoices inv
      join public.parent_students ps on ps.student_id = inv.student_id
      join public.parents p on p.id = ps.parent_id
      where inv.id = payment_transactions.invoice_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists "Receipts read policy" on public.payment_receipts;
create policy "Receipts read policy"
  on public.payment_receipts for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (
      select 1 from public.payment_invoices inv
      join public.parents p on p.id = inv.parent_id
      where inv.id = payment_receipts.invoice_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = payment_receipts.student_id and p.profile_id = auth.uid()
    )
  );
