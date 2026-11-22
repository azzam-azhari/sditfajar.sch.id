'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { ActionResult } from '@/types/action.types';
import { revalidatePath } from 'next/cache';
import { randomInt } from 'crypto';
import { normalizePhone } from '@/lib/phone';
import {
  studentCsvRowSchema,
  teacherCsvRowSchema,
  parentCsvRowSchema,
  StudentCsvRow,
  TeacherCsvRow,
  ParentCsvRow,
} from '@/validations/import.schema';

export interface CsvValidationError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface CsvValidationResult<T> {
  isValid: boolean;
  totalRows: number;
  validRows: T[];
  errors: CsvValidationError[];
}

function parseCsvString(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

export type ImportCsvRow = StudentCsvRow | TeacherCsvRow | ParentCsvRow;

/**
 * 1. PARSE & VALIDASI BARIS DEMI BARIS CSV
 */
export async function validateCsvDataAction(
  type: 'siswa' | 'guru' | 'wali_murid',
  csvText: string
): Promise<ActionResult<CsvValidationResult<ImportCsvRow>>> {
  await requireRole(['super_admin']);

  const { rows } = parseCsvString(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      error: 'Berkas CSV kosong atau tidak memiliki baris data.',
      code: 'VALIDATION_ERROR',
    };
  }

  const errors: CsvValidationError[] = [];
  const validRows: ImportCsvRow[] = [];
  const adminClient = createAdminClient();

  if (type === 'siswa') {
    const seenNis = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header baris 1
      const row = rows[i];

      const parsed = studentCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          errors.push({
            rowNumber: rowNum,
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
        continue;
      }

      if (seenNis.has(parsed.data.nis)) {
        errors.push({
          rowNumber: rowNum,
          field: 'nis',
          message: `Duplikasi NIS '${parsed.data.nis}' terdeteksi di dalam berkas CSV.`,
        });
        continue;
      }
      seenNis.add(parsed.data.nis);

      // Cek apakah NIS sudah ada di database
      const { data: existing } = await adminClient
        .from('students')
        .select('id')
        .eq('nis', parsed.data.nis)
        .maybeSingle();

      if (existing) {
        errors.push({
          rowNumber: rowNum,
          field: 'nis',
          message: `NIS '${parsed.data.nis}' sudah terdaftar pada database sistem.`,
        });
        continue;
      }

      validRows.push(parsed.data);
    }
  } else if (type === 'guru') {
    const seenNuptk = new Set<string>();
    const seenEmail = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      const parsed = teacherCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          errors.push({
            rowNumber: rowNum,
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
        continue;
      }

      if (seenNuptk.has(parsed.data.nuptk)) {
        errors.push({
          rowNumber: rowNum,
          field: 'nuptk',
          message: `Duplikasi NUPTK '${parsed.data.nuptk}' terdeteksi di dalam berkas CSV.`,
        });
        continue;
      }
      seenNuptk.add(parsed.data.nuptk);

      if (seenEmail.has(parsed.data.email.toLowerCase())) {
        errors.push({
          rowNumber: rowNum,
          field: 'email',
          message: `Duplikasi Email '${parsed.data.email}' terdeteksi di dalam berkas CSV.`,
        });
        continue;
      }
      seenEmail.add(parsed.data.email.toLowerCase());

      // Cek apakah email sudah terdaftar
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', parsed.data.email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        errors.push({
          rowNumber: rowNum,
          field: 'email',
          message: `Email '${parsed.data.email}' sudah terdaftar pada sistem.`,
        });
        continue;
      }

      // Cek apakah NUPTK sudah dipakai guru lain
      const { data: existingTeacher } = await adminClient
        .from('teachers')
        .select('id')
        .eq('nuptk', parsed.data.nuptk)
        .maybeSingle();

      if (existingTeacher) {
        errors.push({
          rowNumber: rowNum,
          field: 'nuptk',
          message: `NUPTK '${parsed.data.nuptk}' sudah terdaftar pada sistem.`,
        });
        continue;
      }

      validRows.push(parsed.data);
    }
  } else if (type === 'wali_murid') {
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      const parsed = parentCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          errors.push({
            rowNumber: rowNum,
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
        continue;
      }

      // Verifikasi foreign key: pastikan NIS siswa yang ditautkan ada di database
      const { data: student } = await adminClient
        .from('students')
        .select('id')
        .eq('nis', parsed.data.student_nis)
        .maybeSingle();

      if (!student) {
        errors.push({
          rowNumber: rowNum,
          field: 'student_nis',
          message: `Siswa dengan NIS '${parsed.data.student_nis}' tidak ditemukan di database.`,
        });
        continue;
      }

      validRows.push(parsed.data);
    }
  }

  const isValid = errors.length === 0;

  return {
    success: true,
    data: {
      isValid,
      totalRows: rows.length,
      validRows,
      errors,
    },
  };
}

export interface ImportedCredential {
  name: string;
  login: string;
  initialPassword: string;
}

function randomPassword(prefix: string): string {
  return `${prefix}${randomInt(100000, 1000000)}!`;
}

/**
 * Komit import CSV secara atomik:
 * 1. Validasi ulang seluruh baris di server (data dari client tidak dipercaya).
 * 2. Buat akun auth.users (tidak bisa ikut transaksi database).
 * 3. Seluruh data domain disimpan oleh RPC import_csv_batch dalam satu transaksi.
 * 4. Jika langkah 3 gagal, akun auth yang sudah dibuat dihapus kembali.
 * Kata sandi awal dikembalikan sekali ke super admin untuk dibagikan.
 */
export async function commitCsvBatchAction(
  type: 'siswa' | 'guru' | 'wali_murid',
  rows: ImportCsvRow[]
): Promise<ActionResult<{ batchId: string; successCount: number; credentials: ImportedCredential[] }>> {
  const { user: currentUser } = await requireRole(['super_admin']);

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'Tidak ada data valid yang dapat dieksekusi.', code: 'VALIDATION_ERROR' };
  }

  // 1. Validasi ulang di server
  const schema =
    type === 'siswa' ? studentCsvRowSchema : type === 'guru' ? teacherCsvRowSchema : parentCsvRowSchema;
  const parsedRows: ImportCsvRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = schema.safeParse(rows[i]);
    if (!parsed.success) {
      return {
        success: false,
        error: `Baris ${i + 1} tidak valid: ${parsed.error.issues[0]?.message ?? 'format tidak sesuai'}`,
        code: 'VALIDATION_ERROR',
      };
    }
    parsedRows.push(parsed.data);
  }

  const adminClient = createAdminClient();
  const createdUserIds: string[] = [];
  const credentials: ImportedCredential[] = [];
  const rpcRows: Record<string, unknown>[] = [];

  const createAuthUser = async (email: string, password: string, metadata: Record<string, string>) => {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) throw new Error(`Gagal membuat akun ${email}: ${error?.message ?? 'tidak diketahui'}`);
    createdUserIds.push(data.user.id);
    return data.user.id;
  };

  try {
    // 2. Buat akun auth untuk setiap entitas baru
    if (type === 'siswa') {
      for (const row of parsedRows as StudentCsvRow[]) {
        const password = `${row.birth_place.toLowerCase().replace(/[^a-z0-9]/g, '')}${row.birth_date.split('-').reverse().join('')}`;
        const email = `${row.nis}@siswa.sdit-fajar.sch.id`;
        const profileId = await createAuthUser(email, password, { name: row.name, role: 'murid', login_identifier: row.nis });
        rpcRows.push({ ...row, profile_id: profileId, email });
        credentials.push({ name: row.name, login: row.nis, initialPassword: password });
      }
    } else if (type === 'guru') {
      for (const row of parsedRows as TeacherCsvRow[]) {
        const password = randomPassword('FajarGuru');
        const email = row.email.toLowerCase();
        const profileId = await createAuthUser(email, password, { name: row.name, role: 'guru', login_identifier: email });
        rpcRows.push({ ...row, email, phone: normalizePhone(row.phone), profile_id: profileId });
        credentials.push({ name: row.name, login: email, initialPassword: password });
      }
    } else {
      const profileByPhone = new Map<string, { id: string; isNew: boolean }>();
      for (const row of parsedRows as ParentCsvRow[]) {
        const phone = normalizePhone(row.phone);
        let entry = profileByPhone.get(phone);
        if (!entry) {
          const { data: existing, error } = await adminClient
            .from('profiles')
            .select('id')
            .eq('login_identifier', phone)
            .eq('role', 'wali_murid')
            .maybeSingle();
          if (error) throw new Error(`Gagal memeriksa akun wali ${phone}: ${error.message}`);
          if (existing) {
            entry = { id: existing.id, isNew: false };
          } else {
            const password = randomPassword('WaliFajar');
            const email = row.email ? row.email.toLowerCase() : `${phone}@wali.sdit-fajar.sch.id`;
            const id = await createAuthUser(email, password, { name: row.parent_name, role: 'wali_murid', login_identifier: phone });
            entry = { id, isNew: true };
            credentials.push({ name: row.parent_name, login: phone, initialPassword: password });
          }
          profileByPhone.set(phone, entry);
        }
        rpcRows.push({
          ...row,
          phone,
          email: row.email ? row.email.toLowerCase() : `${phone}@wali.sdit-fajar.sch.id`,
          profile_id: entry.id,
          is_new: entry.isNew,
        });
      }
    }

    // 3. Simpan seluruh data domain dalam satu transaksi database
    const { data: batchId, error: rpcError } = await adminClient.rpc('import_csv_batch', {
      p_type: type,
      p_actor: currentUser.id,
      p_rows: rpcRows,
    });
    if (rpcError) throw new Error(rpcError.message);

    revalidatePath('/dashboard/super-admin/import');
    revalidatePath('/dashboard/admin/siswa');
    revalidatePath('/dashboard/admin/guru');
    revalidatePath('/dashboard/admin/wali-murid');

    return {
      success: true,
      data: { batchId: String(batchId), successCount: parsedRows.length, credentials },
      message: `Berhasil mengimpor ${parsedRows.length} baris data ${type}.`,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Kesalahan server';
    // 4. Rollback akun auth yang sempat dibuat
    const leftover: string[] = [];
    for (const id of createdUserIds) {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) leftover.push(id);
    }
    if (leftover.length > 0) {
      console.error('[Import] Akun auth gagal di-rollback, hapus manual:', leftover);
    }

    return {
      success: false,
      error:
        `Import dibatalkan, tidak ada data yang disimpan: ${errorMessage}` +
        (leftover.length > 0 ? ` (${leftover.length} akun auth gagal dihapus, lihat log server)` : ''),
      code: 'SERVER_ERROR',
    };
  }
}
