import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import {
  getActiveSemester, getParentChildren, getStudentContext, getTeacherContext, resolveSelectedChild,
} from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ChildSelector } from '@/components/lms/child-selector';
import { WeeklySchedule, type ScheduleSlot } from './_components/weekly-schedule';
import { ScheduleAdmin, type ClassTeachingOption } from './_components/schedule-admin';

export const instant = false;

const SCHEDULE_SELECT =
  'id, day_of_week, start_time, end_time, room, classroom_id, subject_id, teacher_id, classrooms(name), subjects(name), teachers(profiles(name))';

export default async function JadwalPage(props: { searchParams: Promise<{ kelas?: string; anak?: string }> }) {
  const { user, profile } = await requireRole(['admin', 'super_admin', 'guru', 'murid', 'wali_murid']);
  const params = await props.searchParams;
  const supabase = await createClient();

  // ADMIN: kelola jadwal per rombel
  if (profile.role === 'admin' || profile.role === 'super_admin') {
    const { data: classrooms } = await supabase
      .from('classrooms')
      .select('id, name, academic_years!inner(is_active)')
      .eq('academic_years.is_active', true)
      .order('name');
    const classList = (classrooms ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
    const selected = classList.find((c) => c.id === params.kelas) ?? classList[0] ?? null;
    const semester = await getActiveSemester();

    const [{ data: slots }, { data: teaching }] = selected
      ? await Promise.all([
          supabase.from('schedules').select(SCHEDULE_SELECT).eq('classroom_id', selected.id).order('day_of_week').order('start_time'),
          semester
            ? supabase
                .from('teaching_assignments')
                .select('teacher_id, subject_id, subjects(name), teachers(profiles(name))')
                .eq('classroom_id', selected.id)
                .eq('semester_id', semester.id)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }];

    return (
      <div className="space-y-6">
        <PageHeader
          title="Jadwal Pelajaran"
          description="Tata jadwal mingguan Senin–Jumat per rombel. Hanya kombinasi guru dan mapel yang sudah memiliki penugasan mengajar yang dapat dijadwalkan; jadwal yang bentrok ditolak otomatis."
        />
        {!selected || !semester ? (
          <EmptyState
            title="Belum dapat menata jadwal"
            description={!selected ? 'Belum ada rombel pada tahun ajaran aktif.' : 'Belum ada semester aktif.'}
          />
        ) : (
          <ScheduleAdmin
            key={selected.id}
            classrooms={classList}
            selectedClassroomId={selected.id}
            semesterId={semester.id}
            slots={(slots ?? []) as unknown as ScheduleSlot[]}
            options={(teaching ?? []) as unknown as ClassTeachingOption[]}
          />
        )}
      </div>
    );
  }

  // GURU: jadwal mengajar sendiri
  if (profile.role === 'guru') {
    const ctx = await getTeacherContext(user.id);
    const { data } = ctx
      ? await supabase.from('schedules').select(SCHEDULE_SELECT).eq('teacher_id', ctx.teacherId).order('start_time')
      : { data: [] };
    return (
      <div className="space-y-6">
        <PageHeader title="Jadwal Mengajar" description="Jadwal mingguan seluruh kelas yang Anda ampu." />
        <WeeklySchedule slots={(data ?? []) as unknown as ScheduleSlot[]} showClass />
      </div>
    );
  }

  // MURID: jadwal kelasnya
  if (profile.role === 'murid') {
    const student = await getStudentContext(user.id);
    const classroom = student?.classroom ?? null;
    const { data } = classroom
      ? await supabase.from('schedules').select(SCHEDULE_SELECT).eq('classroom_id', classroom.id).order('start_time')
      : { data: [] };
    return (
      <div className="space-y-6">
        <PageHeader title="Jadwal Pelajaran" description={classroom ? `Jadwal mingguan kelas ${classroom.name}.` : 'Anda belum terdaftar di rombel aktif.'} />
        <WeeklySchedule slots={(data ?? []) as unknown as ScheduleSlot[]} showTeacher />
      </div>
    );
  }

  // WALI MURID: jadwal kelas anak
  const children = await getParentChildren(user.id);
  const child = resolveSelectedChild(children, params.anak);
  const classroom = child?.classroom ?? null;
  const { data } = classroom
    ? await supabase.from('schedules').select(SCHEDULE_SELECT).eq('classroom_id', classroom.id).order('start_time')
    : { data: [] };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Pelajaran Anak"
        description={child ? `${child.name}${classroom ? ` · kelas ${classroom.name}` : ' · belum terdaftar di rombel aktif'}` : 'Belum ada anak yang terhubung dengan akun Anda.'}
      >
        {child && (
          <ChildSelector
            childrenList={children.map((c) => ({ studentId: c.studentId, name: c.name, classroomName: c.classroom?.name ?? null }))}
            selectedId={child.studentId}
          />
        )}
      </PageHeader>
      <WeeklySchedule slots={(data ?? []) as unknown as ScheduleSlot[]} showTeacher />
    </div>
  );
}
