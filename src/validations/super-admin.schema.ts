import { z } from 'zod';

export const schoolSettingsSchema = z.object({
  school_name: z.string().min(3, 'Nama sekolah minimal 3 karakter'),
  address: z.string().min(5, 'Alamat sekolah wajib diisi'),
  phone: z.string().min(6, 'Nomor telepon resmi minimal 6 karakter'),
  whatsapp: z.string().min(9, 'Nomor WhatsApp resmi minimal 9 karakter'),
  email: z.string().email('Format email tidak valid'),
  maps_url: z.string().url('Format URL maps tidak valid').optional().nullable().or(z.literal('')),
});

export const createStaffUserSchema = z.object({
  name: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(9, 'Nomor WhatsApp/HP minimal 9 karakter').optional().nullable(),
  role: z.enum(['admin', 'guru'], { message: 'Role staf hanya boleh Admin atau Guru' }),
  nuptk: z.string().trim().optional().nullable(),
  bio: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // NUPTK adalah nomor induk guru: wajib 16 digit untuk akun guru.
  if (data.role === 'guru' && !/^\d{16}$/.test(data.nuptk ?? '')) {
    ctx.addIssue({ code: 'custom', path: ['nuptk'], message: 'NUPTK wajib 16 digit angka' });
  }
});

export const assignTeacherPositionSchema = z.object({
  teacher_id: z.guid('ID Guru tidak valid'),
  position_id: z.guid('ID Jabatan tidak valid'),
  classroom_id: z.guid('ID Rombel tidak valid').optional().nullable(),
  academic_year_id: z.guid('ID Tahun Ajaran tidak valid').optional().nullable(),
});

export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type AssignTeacherPositionInput = z.infer<typeof assignTeacherPositionSchema>;
