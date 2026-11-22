import { z } from 'zod';

const uuid = z.guid('Referensi data tidak valid.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const materialSchema = z.object({
  title: z.string().trim().min(3, 'Judul materi minimal 3 karakter.').max(160),
  description: optionalText(1000),
  content: optionalText(20000),
  external_url: z
    .union([z.url('Tautan materi tidak valid.'), z.literal('')])
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  subject_id: uuid,
  classroom_id: uuid,
  semester_id: uuid,
  status: z.enum(['draft', 'published', 'archived']),
});

export const materialUpdateSchema = materialSchema.extend({
  id: uuid,
  remove_file: z.boolean().default(false),
});

export const materialStatusSchema = z.object({
  id: uuid,
  status: z.enum(['draft', 'published', 'archived']),
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(3, 'Judul tugas minimal 3 karakter.').max(160),
  description: z.string().trim().min(3, 'Deskripsi tugas wajib diisi.').max(5000),
  instructions: optionalText(20000),
  subject_id: uuid,
  classroom_id: uuid,
  semester_id: uuid,
  due_at: z.string().datetime({ offset: true, message: 'Batas waktu tidak valid.' }),
  status: z.enum(['draft', 'published', 'closed']),
  allow_late_submission: z.boolean().default(true),
  late_tolerance_minutes: z
    .number()
    .int('Toleransi harus bilangan bulat menit.')
    .min(0, 'Toleransi tidak boleh negatif.')
    .max(43200, 'Toleransi maksimal 30 hari.')
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? null : value)),
  max_score: z.number().min(1).max(100).default(100),
});

export const assignmentUpdateSchema = assignmentSchema.extend({
  id: uuid,
  remove_file: z.boolean().default(false),
});

export const submissionSchema = z.object({
  assignment_id: uuid,
  answer_text: optionalText(20000),
});

export const gradeSubmissionSchema = z.object({
  submission_id: uuid,
  score: z.number().min(0, 'Nilai minimal 0.').max(100, 'Nilai maksimal 100.'),
  feedback: optionalText(4000),
});

export const finalGradeSchema = z.object({
  student_id: uuid,
  subject_id: uuid,
  classroom_id: uuid,
  semester_id: uuid,
  score: z.number().min(0, 'Nilai minimal 0.').max(100, 'Nilai maksimal 100.'),
  description: optionalText(2000),
});

const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:MM.');

export const scheduleSchema = z
  .object({
    classroom_id: uuid,
    subject_id: uuid,
    teacher_id: uuid,
    semester_id: uuid,
    day_of_week: z.number().int().min(1, 'Hari tidak valid.').max(5, 'Jadwal hanya Senin–Jumat.'),
    start_time: timeField,
    end_time: timeField,
    room: optionalText(80),
  })
  .refine((value) => value.end_time > value.start_time, {
    message: 'Jam selesai harus setelah jam mulai.',
    path: ['end_time'],
  });

export const scheduleUpdateSchema = z
  .object({
    id: uuid,
    classroom_id: uuid,
    subject_id: uuid,
    teacher_id: uuid,
    semester_id: uuid,
    day_of_week: z.number().int().min(1, 'Hari tidak valid.').max(5, 'Jadwal hanya Senin–Jumat.'),
    start_time: timeField,
    end_time: timeField,
    room: optionalText(80),
  })
  .refine((value) => value.end_time > value.start_time, {
    message: 'Jam selesai harus setelah jam mulai.',
    path: ['end_time'],
  });

export const STUDENT_ATTENDANCE_STATUSES = ['present', 'excused', 'sick', 'absent'] as const;

export const studentAttendanceSchema = z.object({
  schedule_id: uuid,
  classroom_id: uuid,
  records: z
    .array(
      z.object({
        student_id: uuid,
        status: z.enum(STUDENT_ATTENDANCE_STATUSES),
        notes: optionalText(500),
      })
    )
    .min(1, 'Pilih minimal satu murid.'),
});

export const lmsFileRequestSchema = z.object({
  kind: z.enum(['material', 'assignment', 'submission']),
  id: uuid,
});

export type MaterialInput = z.input<typeof materialSchema>;
export type MaterialUpdateInput = z.input<typeof materialUpdateSchema>;
export type MaterialStatusInput = z.input<typeof materialStatusSchema>;
export type AssignmentInput = z.input<typeof assignmentSchema>;
export type AssignmentUpdateInput = z.input<typeof assignmentUpdateSchema>;
export type SubmissionInput = z.input<typeof submissionSchema>;
export type GradeSubmissionInput = z.input<typeof gradeSubmissionSchema>;
export type FinalGradeInput = z.input<typeof finalGradeSchema>;
export type ScheduleInput = z.input<typeof scheduleSchema>;
export type ScheduleUpdateInput = z.input<typeof scheduleUpdateSchema>;
export type StudentAttendanceInput = z.input<typeof studentAttendanceSchema>;
export type LmsFileRequest = z.input<typeof lmsFileRequestSchema>;
