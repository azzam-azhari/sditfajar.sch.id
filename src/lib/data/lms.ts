import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ClassroomRef {
  id: string;
  name: string;
}

export interface SubjectRef {
  id: string;
  name: string;
  code: string | null;
}

export interface TeachingAssignmentRef {
  id: string;
  semester_id: string;
  classroom: ClassroomRef;
  subject: SubjectRef;
}

export interface TeacherContext {
  teacherId: string;
  positions: string[];
  isPrincipal: boolean;
  assignments: TeachingAssignmentRef[];
  homerooms: ClassroomRef[];
  activeSemesterId: string | null;
}

export interface StudentContext {
  studentId: string;
  name: string;
  nis: string;
  classroom: ClassroomRef | null;
}

export interface ChildRef {
  studentId: string;
  name: string;
  nis: string;
  relationship: string;
  classroom: ClassroomRef | null;
}

type Maybe<T> = T | T[] | null;
function one<T>(value: Maybe<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getActiveSemester(): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('semesters')
    .select('id, name, academic_years!inner(is_active)')
    .eq('is_active', true)
    .eq('academic_years.is_active', true)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

export async function getTeacherContext(profileId: string): Promise<TeacherContext | null> {
  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle();
  if (!teacher) return null;

  const activeSemester = await getActiveSemester();
  const [{ data: positionRows }, { data: assignmentRows }, { data: homeroomRows }] = await Promise.all([
    supabase
      .from('teacher_positions')
      .select('positions(code)')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true),
    supabase
      .from('teaching_assignments')
      .select('id, semester_id, classrooms(id, name), subjects(id, name, code)')
      .eq('teacher_id', teacher.id),
    supabase.from('classrooms').select('id, name').eq('homeroom_teacher_id', teacher.id).order('name'),
  ]);

  // Set: teacher_positions tidak punya unique constraint, baris ganda tidak boleh menggandakan jabatan.
  const positions = Array.from(
    new Set(
      (positionRows ?? [])
        .map((row) => one(row.positions as Maybe<{ code: string }>)?.code)
        .filter((code): code is string => Boolean(code))
    )
  );

  const assignments: TeachingAssignmentRef[] = (assignmentRows ?? [])
    .map((row) => {
      const classroom = one(row.classrooms as Maybe<ClassroomRef>);
      const subject = one(row.subjects as Maybe<SubjectRef>);
      return classroom && subject ? { id: row.id, semester_id: row.semester_id, classroom, subject } : null;
    })
    .filter((row): row is TeachingAssignmentRef => row !== null)
    .filter((row) => !activeSemester || row.semester_id === activeSemester.id)
    .sort((a, b) => `${a.classroom.name}${a.subject.name}`.localeCompare(`${b.classroom.name}${b.subject.name}`));

  return {
    teacherId: teacher.id,
    positions,
    isPrincipal: positions.includes('kepala_sekolah'),
    assignments,
    homerooms: (homeroomRows ?? []) as ClassroomRef[],
    activeSemesterId: activeSemester?.id ?? null,
  };
}

export async function getStudentContext(profileId: string): Promise<StudentContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('students')
    .select('id, nis, profiles(name), class_students(status, left_at, classrooms(id, name))')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!data) return null;
  return mapStudent(data);
}

interface StudentRow {
  id: string;
  nis: string;
  profiles: Maybe<{ name: string }>;
  class_students: Maybe<{ status: string; left_at: string | null; classrooms: Maybe<ClassroomRef> }>;
}

function mapStudent(row: StudentRow): StudentContext {
  const memberships = Array.isArray(row.class_students)
    ? row.class_students
    : row.class_students
      ? [row.class_students]
      : [];
  const active = memberships.find((m) => m.status === 'active' && !m.left_at);
  return {
    studentId: row.id,
    nis: row.nis,
    name: one(row.profiles)?.name ?? 'Murid',
    classroom: active ? one(active.classrooms) : null,
  };
}

export async function getParentChildren(profileId: string): Promise<ChildRef[]> {
  const supabase = await createClient();
  const { data: parent } = await supabase.from('parents').select('id').eq('profile_id', profileId).maybeSingle();
  if (!parent) return [];
  const { data } = await supabase
    .from('parent_students')
    .select(
      'relationship, students(id, nis, profiles(name), class_students(status, left_at, classrooms(id, name)))'
    )
    .eq('parent_id', parent.id);

  return (data ?? [])
    .map((row) => {
      const student = one(row.students as Maybe<StudentRow>);
      if (!student) return null;
      const mapped = mapStudent(student);
      return { ...mapped, relationship: row.relationship } satisfies ChildRef;
    })
    .filter((child): child is ChildRef => child !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Pilih anak dari query `?anak=`; hanya anak milik wali ini yang dapat dipilih. */
export function resolveSelectedChild(children: ChildRef[], requested: string | undefined): ChildRef | null {
  if (children.length === 0) return null;
  return children.find((child) => child.studentId === requested) ?? children[0];
}

export const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'Hadir',
  late: 'Terlambat',
  excused: 'Izin',
  sick: 'Sakit',
  absent: 'Alpa',
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  not_submitted: 'Belum mengumpulkan',
  submitted: 'Terkumpul',
  late: 'Terlambat',
  graded: 'Dinilai',
};
