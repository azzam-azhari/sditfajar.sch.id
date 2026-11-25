'use server';

import { normalizePhone } from '@/lib/phone';

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { ActionResult } from '@/types/action.types';
import { revalidatePath } from 'next/cache';
import { createSignedUrl, createAdminSignedUrl } from '@/lib/supabase/storage';
import { allowRequest, getClientIp, rateLimitedError } from '@/lib/rate-limit';
import {
  publicRegistrationSchema,
  updateRegistrationStatusSchema,
  promoteRegistrationSchema,
  PublicRegistrationInput,
  UpdateRegistrationStatusInput,
  PromoteRegistrationInput,
} from '@/validations/spmb.schema';

/**
 * Kata sandi awal akun wali murid hasil promosi SPMB. Akun dibuat dengan
 * must_change_password = true, sehingga wali wajib menggantinya saat login pertama.
 */
const DEFAULT_PARENT_PASSWORD = 'sditfajar.sch.id';

/**
 * Validasi Magic Bytes untuk tipe file PDF, JPEG, dan PNG
 */
function validateFileMagicBytes(buffer: Uint8Array): { isValid: boolean; mime: string; ext: string } {
  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, mime: 'application/pdf', ext: 'pdf' };
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { isValid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, mime: 'image/png', ext: 'png' };
  }

  return { isValid: false, mime: '', ext: '' };
}

/**
 * 1. SUBMIT FORMULIR PENDAFTARAN OLEH TAMU (GUEST)
 */
export async function submitPublicRegistrationAction(
  input: FormData | PublicRegistrationInput
): Promise<ActionResult<{ registrationNumber: string }>> {
  let file: File | null = null;
  let rawInput: Record<string, unknown>;

  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    file = (input.get('file') as File | null) || (input.get('berkas') as File | null) || null;
    const text = (key: string) => input.get(key)?.toString() ?? '';
    const int = (key: string) => {
      const v = input.get(key)?.toString();
      return v === undefined || v === '' ? undefined : Number(v);
    };
    rawInput = {
      admission_wave_id: text('admission_wave_id'),
      student_name: text('student_name'),
      nickname: text('nickname'),
      birth_place: text('birth_place'),
      birth_date: text('birth_date'),
      gender: text('gender'),
      total_siblings: int('total_siblings'),
      child_number: int('child_number'),
      phone: text('phone'),
      address: text('address'),
      hobby: text('hobby'),
      achievements: text('achievements'),
      medical_history: text('medical_history'),
      father_name: text('father_name'),
      father_education: text('father_education'),
      father_occupation: text('father_occupation'),
      mother_name: text('mother_name'),
      mother_education: text('mother_education'),
      mother_occupation: text('mother_occupation'),
      parent_address: text('parent_address'),
      hp_tambahan: text('hp_tambahan'),
      form_started_at: Number(input.get('form_started_at')) || undefined,
    };
  } else {
    rawInput = input as Record<string, unknown>;
  }

  // 2. Proteksi Spam Honeypot: jika field ini terisi, kembalikan sukses palsu tanpa simpan
  if (typeof rawInput.hp_tambahan === 'string' && rawInput.hp_tambahan.trim().length > 0) {
    return {
      success: true,
      data: { registrationNumber: 'SPMB-2026-0000' },
      message: 'Formulir pendaftaran berhasil dikirim.',
    };
  }

  // 3. Proteksi Spam Kecepatan Pengisian: jika kurang dari 2 detik, kembalikan sukses palsu
  if (typeof rawInput.form_started_at === 'number') {
    const elapsed = Date.now() - rawInput.form_started_at;
    if (elapsed < 2000) {
      return {
        success: true,
        data: { registrationNumber: 'SPMB-2026-0000' },
        message: 'Formulir pendaftaran berhasil dikirim.',
      };
    }
  }

  // 3b. Rate limit per IP (setelah honeypot agar bot tetap menerima sukses palsu)
  if (!(await allowRequest('spmbSubmit', await getClientIp()))) {
    return rateLimitedError('Terlalu banyak pendaftaran dari jaringan ini. Silakan coba lagi dalam 1 jam atau hubungi panitia SPMB.');
  }

  // 4. Validasi Zod Skema
  const parsed = publicRegistrationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Data formulir tidak lengkap atau format tidak sesuai.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  // 5. Validasi bukti transfer (wajib): maks 5 MB, magic bytes PDF/JPG/PNG
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    file = (input.get('document') as File | null) || (input.get('file') as File | null) || file;
  }
  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      error: 'Foto bukti transfer biaya formulir wajib diunggah.',
      fieldErrors: { document: ['Foto bukti transfer wajib diunggah'] },
      code: 'VALIDATION_ERROR',
    };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Ukuran berkas melebihi batas maksimum 5 MB.', code: 'VALIDATION_ERROR' };
  }
  const fileBuffer = new Uint8Array(await file.arrayBuffer());
  const validatedFile = validateFileMagicBytes(fileBuffer);
  if (!validatedFile.isValid) {
    return {
      success: false,
      error: 'Tipe berkas tidak didukung. Harap unggah berkas JPG, PNG, atau PDF.',
      code: 'VALIDATION_ERROR',
    };
  }

  // Gunakan admin client untuk query server aman
  const adminClient = createAdminClient();

  // 6. Verifikasi gelombang harus berstatus 'open' dan is_active = true
  const { data: wave, error: waveErr } = await adminClient
    .from('admission_waves')
    .select('id, title, status, is_active')
    .eq('id', parsed.data.admission_wave_id)
    .eq('status', 'open')
    .eq('is_active', true)
    .maybeSingle();

  if (waveErr || !wave) {
    return {
      success: false,
      error: 'Gelombang pendaftaran yang dipilih sedang tidak aktif atau telah ditutup.',
      code: 'NOT_FOUND',
    };
  }

  // 7. Generate nomor registrasi berurutan melalui Database Function
  let registrationNumber: string;
  try {
    const { data: dbNumber, error: rpcErr } = await adminClient.rpc('generate_registration_number');
    if (rpcErr || !dbNumber) {
      const yearStr = new Date().getFullYear().toString();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      registrationNumber = `SPMB-${yearStr}-${randomSuffix}`;
    } else {
      registrationNumber = dbNumber as string;
    }
  } catch {
    const yearStr = new Date().getFullYear().toString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    registrationNumber = `SPMB-${yearStr}-${randomSuffix}`;
  }

  // 8. Pemetaan data: nomor WhatsApp/HP menjadi kontak utama (cek status & akun wali)
  const d = parsed.data;
  const parentPhone = normalizePhone(d.phone);

  // 9. Insert pendaftaran ke tabel student_registration_applications
  const { data: application, error: insertError } = await adminClient
    .from('student_registration_applications')
    .insert({
      admission_wave_id: wave.id,
      registration_number: registrationNumber,
      student_name: d.student_name,
      nickname: d.nickname,
      gender: d.gender,
      birth_place: d.birth_place,
      birth_date: d.birth_date,
      total_siblings: d.total_siblings,
      child_number: d.child_number,
      address: d.address,
      hobby: d.hobby,
      achievements: d.achievements,
      medical_history: d.medical_history,
      parent_name: d.father_name,
      parent_phone: parentPhone,
      father_name: d.father_name,
      father_phone: parentPhone,
      father_education: d.father_education,
      father_occupation: d.father_occupation,
      mother_name: d.mother_name,
      mother_education: d.mother_education,
      mother_occupation: d.mother_occupation,
      parent_address: d.parent_address,
      status: 'submitted',
    })
    .select('id')
    .single();

  if (insertError || !application) {
    return {
      success: false,
      error: 'Gagal mengirimkan formulir pendaftaran. Silakan periksa kembali kelengkapan data Anda.',
      code: 'SERVER_ERROR',
    };
  }

  // 10. Unggah bukti transfer biaya formulir
  const fileUuid = crypto.randomUUID();
  const storagePath = `applications/${application.id}/${fileUuid}.${validatedFile.ext}`;

  const { error: uploadError } = await adminClient.storage
    .from('registration-files')
    .upload(storagePath, fileBuffer, {
      contentType: validatedFile.mime,
      upsert: false,
    });

  if (uploadError) {
    // Hapus data pendaftaran jika upload gagal (Transaction Rollback Clean-Up)
    await adminClient
      .from('student_registration_applications')
      .delete()
      .eq('id', application.id);

    return {
      success: false,
      error: 'Gagal mengunggah bukti transfer. Formulir pendaftaran dibatalkan, silakan coba kirim kembali.',
      code: 'SERVER_ERROR',
    };
  }

  // Catat referensi berkas di tabel student_registration_documents
  await adminClient.from('student_registration_documents').insert({
    application_id: application.id,
    document_type: 'bukti_transfer',
    file_path: storagePath,
    original_filename: file.name,
    mime_type: validatedFile.mime,
    file_size: file.size,
    verification_status: 'pending',
  });

  revalidatePath('/dashboard/admin/spmb');

  return {
    success: true,
    data: { registrationNumber },
    message: 'Formulir pendaftaran berhasil dikirim.',
  };
}

/**
 * 2. CEK STATUS PENDAFTARAN OLEH TAMU (GUEST - ISOLASI KETAT ANTI LEAKAGE)
 */
export async function checkRegistrationStatusAction(
  registrationNumber: string,
  parentPhone: string
): Promise<ActionResult<{
  studentName: string;
  registrationNumber: string;
  status: string;
  waveTitle: string;
  submittedAt: string;
  adminNotes: string | null;
}>> {
  // Batasi percobaan per IP agar pasangan nomor registrasi + HP tidak bisa ditebak massal.
  if (!(await allowRequest('spmbStatus', await getClientIp()))) {
    return rateLimitedError('Terlalu banyak pengecekan status. Silakan coba lagi dalam 15 menit.');
  }

  const adminClient = createAdminClient();

  const cleanReg = registrationNumber.trim();
  const cleanPhone = normalizePhone(parentPhone.trim());

  const { data, error } = await adminClient
    .from('student_registration_applications')
    .select(`
      registration_number,
      student_name,
      status,
      admin_notes,
      created_at,
      admission_waves (
        title
      )
    `)
    .eq('registration_number', cleanReg)
    .eq('parent_phone', cleanPhone)
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: 'Data pendaftaran tidak ditemukan. Mohon pastikan Nomor Registrasi dan Nomor WhatsApp sesuai.',
      code: 'NOT_FOUND',
    };
  }

  const waveData = data.admission_waves as unknown;
  const waveTitle = Array.isArray(waveData)
    ? (waveData[0] as { title?: string })?.title
    : (waveData as { title?: string })?.title;
  const wave = waveTitle || 'Gelombang SPMB';

  return {
    success: true,
    data: {
      studentName: data.student_name,
      registrationNumber: data.registration_number,
      status: data.status,
      waveTitle: wave,
      submittedAt: data.created_at,
      adminNotes: data.admin_notes,
    },
  };
}

/**
 * 3. UPDATE STATUS PENDAFTARAN OLEH ADMIN
 */
export async function updateRegistrationStatusAction(
  input: UpdateRegistrationStatusInput
): Promise<ActionResult<void>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const parsed = updateRegistrationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Data verifikasi tidak valid.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('student_registration_applications')
    .update({
      status: parsed.data.status,
      admin_notes: parsed.data.admin_notes || null,
      observation_score: parsed.data.observation_score || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.application_id);

  if (error) {
    return { success: false, error: error.message, code: 'SERVER_ERROR' };
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'update_spmb_status',
    entity_type: 'student_registration_applications',
    entity_id: parsed.data.application_id,
    metadata: { status: parsed.data.status, notes: parsed.data.admin_notes },
  });

  revalidatePath('/dashboard/admin/spmb');
  return { success: true, data: undefined, message: 'Status verifikasi pendaftaran berhasil diperbarui.' };
}

/**
 * 4. AMBIL SIGNED URL BERKAS PENDAFTARAN (5 MENIT)
 */
export async function getRegistrationDocumentSignedUrlAction(
  filePath: string
): Promise<ActionResult<{ signedUrl: string }>> {
  await requireRole(['admin', 'super_admin']);

  try {
    const signedUrl = await createAdminSignedUrl('registration-files', filePath, 3600);
    return { success: true, data: { signedUrl } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal memuat dokumen pendaftaran.';
    return { success: false, error: errorMsg, code: 'SERVER_ERROR' };
  }
}

/**
 * 5. PROMOSI CALON MURID MENJADI SISWA AKTIF & GENERATE AKUN AUTH
 */
export async function promoteRegistrationToStudentAction(
  input: PromoteRegistrationInput
): Promise<ActionResult<{ studentId: string; nis: string; credentials: { name: string; login: string; initialPassword: string }[] }>> {
  const { user: currentUser } = await requireRole(['admin', 'super_admin']);
  const parsed = promoteRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Data promosi tidak valid.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const adminClient = createAdminClient();

  // 1. Ambil data aplikasi pendaftaran
  const { data: application, error: appError } = await adminClient
    .from('student_registration_applications')
    .select('*')
    .eq('id', parsed.data.application_id)
    .single();

  if (appError || !application) {
    return { success: false, error: 'Data pendaftaran tidak ditemukan.', code: 'NOT_FOUND' };
  }

  if (application.status === 'approved') {
    return { success: false, error: 'Pendaftar ini sudah pernah disetujui dan dipromosikan.', code: 'VALIDATION_ERROR' };
  }

  if (application.status !== 'under_review') {
    return {
      success: false,
      error: 'Pendaftar harus diverifikasi terlebih dahulu sebelum dipromosikan menjadi murid aktif.',
      code: 'VALIDATION_ERROR',
    };
  }

  // Tentukan NIS
  let finalNis = parsed.data.nis?.trim();
  if (!finalNis) {
    const currentYear = new Date().getFullYear();
    const randomNis = Math.floor(1000 + Math.random() * 9000);
    finalNis = `${currentYear}${randomNis}`;
  }

  // Tentukan password awal murid: tempatlahir + ddmmyyyy
  const cleanPlace = (application.birth_place || 'fajar').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Format resmi: tempat lahir + ddmmyyyy
  const cleanDate = (application.birth_date || '2019-01-01').split('-').reverse().join('');
  const initialStudentPassword = `${cleanPlace}${cleanDate}`;
  const syntheticEmail = `${finalNis}@siswa.sdit-fajar.sch.id`;

  let studentAuthId: string | null = null;
  let parentProfileId: string | null = null;
  let createdParentAuthId: string | null = null;
  const credentials: { name: string; login: string; initialPassword: string }[] = [];

  try {
    // 2. Buat akun Auth Murid
    const { data: studentAuth, error: studentAuthErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: initialStudentPassword,
      email_confirm: true,
      user_metadata: {
        name: application.student_name,
        role: 'murid',
        login_identifier: finalNis,
      },
    });

    if (studentAuthErr || !studentAuth.user) {
      throw new Error(`Gagal membuat akun murid: ${studentAuthErr?.message}`);
    }
    studentAuthId = studentAuth.user.id;

    // 3. Buat Profile Murid
    await adminClient.from('profiles').insert({
      id: studentAuthId,
      name: application.student_name,
      email: syntheticEmail,
      login_identifier: finalNis,
      role: 'murid',
      is_active: true,
      must_change_password: true,
    });

    // 4. Buat Record Students
    const { data: studentRecord, error: studentErr } = await adminClient
      .from('students')
      .insert({
        profile_id: studentAuthId,
        nis: finalNis,
        nisn: application.nisn || null,
        gender: application.gender,
        birth_place: application.birth_place,
        birth_date: application.birth_date,
        address: application.address,
        is_active: true,
      })
      .select('id')
      .single();

    if (studentErr || !studentRecord) {
      throw new Error(`Gagal menyimpan data pokok murid: ${studentErr?.message}`);
    }

    // 5. Cek / Buat Akun Wali Murid
    const parentPhone = application.parent_phone;
    const { data: existingParentProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('login_identifier', parentPhone)
      .eq('role', 'wali_murid')
      .maybeSingle();

    if (existingParentProfile) {
      parentProfileId = existingParentProfile.id;
    } else {
      const parentEmail = application.parent_email || `${parentPhone}@wali.sdit-fajar.sch.id`;

      const { data: parentAuth, error: parentAuthErr } = await adminClient.auth.admin.createUser({
        email: parentEmail,
        password: DEFAULT_PARENT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: application.parent_name,
          role: 'wali_murid',
          login_identifier: parentPhone,
        },
      });

      if (parentAuthErr || !parentAuth.user) {
        throw new Error(`Gagal membuat akun wali murid: ${parentAuthErr?.message}`);
      }

      parentProfileId = parentAuth.user.id;
      createdParentAuthId = parentAuth.user.id;
      credentials.push({ name: application.parent_name, login: parentPhone, initialPassword: DEFAULT_PARENT_PASSWORD });

      await adminClient.from('profiles').insert({
        id: parentProfileId,
        name: application.parent_name,
        email: parentEmail,
        login_identifier: parentPhone,
        role: 'wali_murid',
        phone: parentPhone,
        is_active: true,
        must_change_password: true,
      });

      await adminClient.from('parents').insert({
        profile_id: parentProfileId,
        occupation: application.father_occupation || application.mother_occupation || null,
        address: application.address,
      });
    }

    // Ambil ID dari tabel parents
    const { data: parentRecord } = await adminClient
      .from('parents')
      .select('id')
      .eq('profile_id', parentProfileId)
      .single();

    if (parentRecord) {
      await adminClient.from('parent_students').insert({
        parent_id: parentRecord.id,
        student_id: studentRecord.id,
        relationship: 'Orang Tua',
        is_primary: true,
      });
    }

    // 6. Jika classroom_id dipilih, daftarkan siswa ke rombel
    if (parsed.data.classroom_id) {
      await adminClient.from('class_students').insert({
        classroom_id: parsed.data.classroom_id,
        student_id: studentRecord.id,
        status: 'active',
      });
    }

    // 7. Update status pendaftaran menjadi approved
    await adminClient
      .from('student_registration_applications')
      .update({
        status: 'approved',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', application.id);

    // 8. Catat audit log
    await adminClient.from('audit_logs').insert({
      actor_id: currentUser.id,
      action: 'promote_spmb_to_student',
      entity_type: 'students',
      entity_id: studentRecord.id,
      metadata: {
        application_id: application.id,
        student_name: application.student_name,
        nis: finalNis,
      },
    });

    revalidatePath('/dashboard/admin/spmb');
    revalidatePath('/dashboard/admin/siswa');

    return {
      success: true,
      data: {
        studentId: studentRecord.id,
        nis: finalNis,
        credentials: [
          { name: application.student_name, login: finalNis, initialPassword: initialStudentPassword },
          ...credentials,
        ],
      },
      message: `Ananda ${application.student_name} berhasil dipromosikan menjadi murid aktif dengan NIS ${finalNis}.`,
    };
  } catch (err: unknown) {
    if (studentAuthId) {
      await adminClient.auth.admin.deleteUser(studentAuthId).catch(() => {});
    }
    if (createdParentAuthId) {
      await adminClient.auth.admin.deleteUser(createdParentAuthId).catch(() => {});
    }
    const errText = err instanceof Error ? err.message : 'Kesalahan sistem';
    return {
      success: false,
      error: `Promosi murid digagalkan: ${errText}`,
      code: 'SERVER_ERROR',
    };
  }
}
