import { z } from 'zod';

export const EDUCATION_LEVELS = ['SD/MI', 'SMP/MTs', 'SMA/SMK/MA', 'D1/D2/D3', 'S1/S2/S3'] as const;

export const MIN_STUDENT_AGE = 4;
export const MAX_STUDENT_AGE = 12;

/** Usia penuh (tahun) pada tanggal acuan dari tanggal lahir YYYY-MM-DD. */
export function ageInYears(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age;
}

const requiredText = (min: number, message: string, max = 500) =>
  z.string().trim().min(min, message).max(max, `Maksimal ${max} karakter`);

const education = (who: string) =>
  z.enum(EDUCATION_LEVELS, { message: `Pendidikan terakhir ${who} wajib dipilih` });

export const publicRegistrationSchema = z.object({
  admission_wave_id: z.guid('Gelombang pendaftaran tidak valid'),

  // Langkah 1: Data Calon Siswa
  student_name: requiredText(3, 'Nama lengkap siswa minimal 3 karakter', 120),
  nickname: requiredText(1, 'Nama panggilan wajib diisi', 60),
  birth_place: requiredText(2, 'Tempat lahir wajib diisi', 80),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal lahir wajib diisi')
    .refine((v) => {
      const age = ageInYears(v);
      return age >= MIN_STUDENT_AGE && age <= MAX_STUDENT_AGE;
    }, `Usia calon siswa harus ${MIN_STUDENT_AGE}–${MAX_STUDENT_AGE} tahun`),
  gender: z.enum(['L', 'P'], { message: 'Jenis kelamin wajib dipilih' }),
  total_siblings: z
    .number({ message: 'Jumlah saudara kandung wajib diisi' })
    .int('Jumlah saudara kandung harus bilangan bulat')
    .min(0, 'Jumlah saudara kandung tidak valid')
    .max(20, 'Jumlah saudara kandung tidak valid'),
  child_number: z
    .number({ message: 'Anak ke- wajib diisi' })
    .int('Anak ke- harus bilangan bulat')
    .min(1, 'Anak ke- minimal 1')
    .max(21, 'Anak ke- tidak valid'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{9,20}$/, 'Nomor WhatsApp/HP minimal 9 digit angka'),
  address: requiredText(5, 'Alamat lengkap siswa minimal 5 karakter'),
  hobby: requiredText(1, 'Hobi siswa wajib diisi', 200),
  achievements: requiredText(1, 'Isi "-" jika belum ada prestasi'),
  medical_history: requiredText(1, 'Isi "-" jika tidak ada riwayat penyakit berat'),

  // Langkah 2: Data Orang Tua
  father_name: requiredText(3, 'Nama lengkap ayah/wali minimal 3 karakter', 120),
  father_education: education('ayah'),
  father_occupation: requiredText(2, 'Pekerjaan ayah wajib diisi', 120),
  mother_name: requiredText(3, 'Nama lengkap ibu minimal 3 karakter', 120),
  mother_education: education('ibu'),
  mother_occupation: requiredText(2, 'Pekerjaan ibu wajib diisi', 120),
  parent_address: requiredText(5, 'Alamat lengkap orang tua minimal 5 karakter'),

  // Anti-Spam: Honeypot field (wajib kosong di sisi client & server)
  hp_tambahan: z.string().max(0, 'Spam terdeteksi').optional().or(z.literal('')),
  // Anti-Spam: Timestamp saat form dimuat
  form_started_at: z.number().optional(),
});

export const STEP1_FIELDS = [
  'student_name',
  'nickname',
  'birth_place',
  'birth_date',
  'gender',
  'total_siblings',
  'child_number',
  'phone',
  'address',
  'hobby',
  'achievements',
  'medical_history',
] as const;

export const STEP2_FIELDS = [
  'father_name',
  'father_education',
  'father_occupation',
  'mother_name',
  'mother_education',
  'mother_occupation',
  'parent_address',
] as const;

export const updateRegistrationStatusSchema = z.object({
  application_id: z.guid('ID Pendaftaran tidak valid'),
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected'], { message: 'Status tidak valid' }),
  admin_notes: z.string().optional().nullable(),
  observation_score: z.number().optional().nullable(),
});

export const promoteRegistrationSchema = z.object({
  application_id: z.guid('ID Pendaftaran tidak valid'),
  classroom_id: z.guid('Rombel kelas wajib dipilih').optional().nullable(),
  nis: z.string().optional().nullable(),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
export type UpdateRegistrationStatusInput = z.infer<typeof updateRegistrationStatusSchema>;
export type PromoteRegistrationInput = z.infer<typeof promoteRegistrationSchema>;
