import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Identitas akun minimal 3 karakter')
    .max(100, 'Identitas akun maksimal 100 karakter')
    // Pertahanan berlapis: hanya karakter NIS, nomor HP (termasuk spasi/kurung/strip),
    // username, dan email. Query login sendiri memakai filter .eq/.ilike terpisah.
    .regex(/^[A-Za-z0-9@.+_() -]+$/, 'Identitas akun hanya boleh berisi huruf, angka, spasi, dan simbol @ . + _ - ( )'),
  password: z
    .string()
    .min(6, 'Kata sandi minimal 6 karakter')
    .max(128, 'Kata sandi maksimal 128 karakter'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Kata sandi baru minimal 8 karakter')
      .regex(/[A-Za-z]/, 'Kata sandi harus mengandung minimal 1 huruf')
      .regex(/[0-9]/, 'Kata sandi harus mengandung minimal 1 angka'),
    confirmPassword: z.string().min(8, 'Konfirmasi kata sandi minimal 8 karakter'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const PASSWORD_RULES = [
  { label: 'Minimal 8 karakter', test: (v: string) => v.length >= 8 },
  { label: 'Huruf kecil (a-z)', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Huruf besar (A-Z)', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Angka (0-9)', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Simbol (!@#$...)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password lama wajib diisi').max(72),
    newPassword: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      // bcrypt (Supabase Auth) hanya memakai 72 byte pertama.
      .max(72, 'Password baru maksimal 72 karakter')
      .regex(/[a-z]/, 'Harus mengandung huruf kecil')
      .regex(/[A-Z]/, 'Harus mengandung huruf besar')
      .regex(/[0-9]/, 'Harus mengandung angka')
      .regex(/[^A-Za-z0-9]/, 'Harus mengandung simbol'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Password baru harus berbeda dari password lama',
    path: ['newPassword'],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
