'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loginSchema,
  changePasswordSchema,
  updatePasswordSchema,
  LoginInput,
  ChangePasswordInput,
  UpdatePasswordInput,
} from '@/validations/auth.schema';
import { createClient as createStatelessClient } from '@supabase/supabase-js';
import { ActionError, ActionResult } from '@/types/action.types';
import { Profile } from '@/types/auth.types';
import { ROLE_DASHBOARD_PATH, UserRole } from '@/constants/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getClientIp } from '@/lib/rate-limit';
import { looksLikePhone, normalizePhone } from '@/lib/phone';

const LOGIN_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IDENTIFIER = 5;
const MAX_FAILURES_PER_IP = 30;

const INVALID_CREDENTIALS: ActionError = {
  success: false,
  title: 'Gagal Masuk',
  error: 'Identitas akun atau kata sandi tidak sesuai.',
  hint: 'Lupa kata sandi? Hubungi Bagian Tata Usaha atau Layanan Bantuan IT sekolah.',
  code: 'UNAUTHORIZED',
};

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Rate limit login berbasis tabel login_attempts (migration 000013).
 * Jika tabel belum ada (migration belum dijalankan), login tetap berjalan
 * dan peringatan dicatat di log server.
 */
async function isLoginRateLimited(admin: AdminClient, keys: { id: string; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const count = async (key: string) => {
    const { count: total, error } = await admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_key', key)
      .gte('attempted_at', since);
    if (error) {
      console.warn('[Auth] Rate limit tidak aktif (tabel login_attempts belum tersedia?):', error.message);
      return 0;
    }
    return total ?? 0;
  };
  const [idFailures, ipFailures] = await Promise.all([count(keys.id), count(keys.ip)]);
  return idFailures >= MAX_FAILURES_PER_IDENTIFIER || ipFailures >= MAX_FAILURES_PER_IP;
}

async function recordLoginFailure(admin: AdminClient, keys: { id: string; ip: string }): Promise<void> {
  const { error } = await admin
    .from('login_attempts')
    .insert([{ attempt_key: keys.id }, { attempt_key: keys.ip }]);
  if (error) {
    console.warn('[Auth] Gagal mencatat percobaan login:', error.message);
    return;
  }
  // Bersihkan catatan lama secara oportunistik.
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await admin.from('login_attempts').delete().lt('attempted_at', cutoff);
}

/**
 * Server Action untuk autentikasi pengguna dengan multi-identifier (NIS, No WA, atau Email).
 * Pesan gagal dibuat seragam agar tidak bisa dipakai menebak akun yang terdaftar.
 */
export async function loginAction(
  input: LoginInput
): Promise<ActionResult<{ redirectTo: string }>> {
  // 1. Validasi Skema Zod
  const validation = loginSchema.safeParse(input);
  if (!validation.success) {
    const firstErrorMessage =
      Object.values(validation.error.flatten().fieldErrors)[0]?.[0] ||
      'Data yang dimasukkan tidak memenuhi format yang ditentukan.';
    return {
      success: false,
      title: 'Format Data Tidak Sesuai',
      error: firstErrorMessage,
      fieldErrors: validation.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const { identifier, password } = validation.data;
  const cleanId = identifier.trim();
  const isEmail = cleanId.includes('@');
  // Nomor HP disimpan ternormalisasi; coba juga bentuk aslinya untuk data lama.
  const candidates =
    !isEmail && looksLikePhone(cleanId)
      ? Array.from(new Set([normalizePhone(cleanId), cleanId]))
      : [cleanId];

  try {
    const adminSupabase = createAdminClient();
    const rateKeys = {
      id: `id:${candidates[0].toLowerCase()}`,
      ip: `ip:${await getClientIp()}`,
    };

    if (await isLoginRateLimited(adminSupabase, rateKeys)) {
      return {
        success: false,
        title: 'Terlalu Banyak Percobaan',
        error: `Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi dalam ${LOGIN_WINDOW_MINUTES} menit.`,
        code: 'RATE_LIMITED',
      };
    }

    // 2. Cari profil di semua role. Kolom dipilih dari bentuk input
    // (email vs NIS/username/No. HP). Filter .eq / .ilike terpisah, bukan string .or(),
    // agar input pengguna tidak pernah menjadi sintaks filter PostgREST.
    const columns: Array<'login_identifier' | 'phone' | 'email'> = isEmail
      ? ['email', 'login_identifier']
      : ['login_identifier', 'phone'];

    const found = new Map<string, Profile>();
    for (const value of candidates) {
      for (const column of columns) {
        let query = adminSupabase.from('profiles').select('*');
        query =
          column === 'email'
            ? query.ilike(column, value.replace(/[\\%_]/g, '\\$&'))
            : query.eq(column, value);
        const { data, error } = await query.limit(3);
        if (error) {
          console.error('[Auth] Query profil gagal:', error.message);
          return {
            success: false,
            title: 'Kendala Database',
            error: 'Gagal membaca basis data sekolah. Silakan coba beberapa saat lagi.',
            code: 'SERVER_ERROR',
          };
        }
        for (const row of (data ?? []) as Profile[]) found.set(row.id, row);
      }
    }

    // 3. Akun tidak ditemukan: pesan sama dengan kata sandi salah.
    if (found.size === 0) {
      await recordLoginFailure(adminSupabase, rateKeys);
      return INVALID_CREDENTIALS;
    }

    // 4. Autentikasi ke Supabase Auth. Bila identitas cocok dengan >1 akun
    // (mis. NIS sama dengan No. HP wali), kata sandi yang menentukan akunnya.
    const serverSupabase = await createClient();
    let profile: Profile | null = null;
    for (const candidate of Array.from(found.values()).slice(0, 3)) {
      const { error: authError } = await serverSupabase.auth.signInWithPassword({
        email: candidate.email,
        password,
      });
      if (!authError) {
        profile = candidate;
        break;
      }
      if (authError.status && authError.status >= 500) {
        console.error('[Auth] Layanan otentikasi error:', authError.status, authError.message);
        return {
          success: false,
          title: 'Kendala Server Otentikasi',
          error: `Terjadi kendala pada layanan otentikasi (status ${authError.status}). Silakan laporkan kepada administrator sistem.`,
          code: 'SERVER_ERROR',
        };
      }
    }

    if (!profile) {
      await recordLoginFailure(adminSupabase, rateKeys);
      return INVALID_CREDENTIALS;
    }

    // 5. Akun nonaktif: hanya diberitahukan kepada pemilik kata sandi yang benar.
    if (!profile.is_active) {
      await serverSupabase.auth.signOut();
      return {
        success: false,
        title: 'Akun Dinonaktifkan',
        error: 'Akun ini berstatus tidak aktif. Silakan hubungi Administrator Sekolah atau Bagian Tata Usaha untuk pengaktifan kembali.',
        code: 'ACCOUNT_INACTIVE',
      };
    }

    await adminSupabase.from('login_attempts').delete().eq('attempt_key', rateKeys.id);

    // 6. Tentukan alur redirect
    const redirectTo = profile.must_change_password
      ? '/ganti-password'
      : ROLE_DASHBOARD_PATH[profile.role as UserRole] || '/dashboard';

    revalidatePath('/', 'layout');
    return {
      success: true,
      data: { redirectTo },
      message: 'Berhasil masuk ke akun Anda.',
    };
  } catch (err) {
    console.error('[Auth] Kesalahan sistem saat login:', err);
    return {
      success: false,
      title: 'Kendala Sistem',
      error: 'Terjadi kesalahan sistem saat proses masuk. Silakan coba beberapa saat lagi.',
      code: 'SERVER_ERROR',
    };
  }
}

/**
 * Ganti password dari menu profil. Wajib verifikasi password lama,
 * dibatasi rate limit yang sama dengan login, dan mengeluarkan sesi lain.
 */
export async function updatePasswordAction(input: UpdatePasswordInput): Promise<ActionResult<null>> {
  const validation = updatePasswordSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Data password tidak memenuhi syarat keamanan.',
      fieldErrors: validation.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }
  const { currentPassword, newPassword } = validation.data;

  try {
    const serverSupabase = await createClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    if (!user?.email) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.', code: 'UNAUTHORIZED' };
    }

    const admin = createAdminClient();
    const rateKeys = { id: `pw:${user.id}`, ip: `ip:${await getClientIp()}` };
    if (await isLoginRateLimited(admin, rateKeys)) {
      return {
        success: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${LOGIN_WINDOW_MINUTES} menit.`,
        code: 'RATE_LIMITED',
      };
    }

    // Verifikasi password lama dengan client terpisah tanpa cookie/sesi tersimpan,
    // agar sesi aktif pengguna tidak tersentuh.
    const verifier = createStatelessClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      if (verifyError.status && verifyError.status >= 500) {
        return { success: false, error: 'Layanan otentikasi sedang bermasalah. Coba lagi nanti.', code: 'SERVER_ERROR' };
      }
      await recordLoginFailure(admin, rateKeys);
      return {
        success: false,
        error: 'Password lama tidak sesuai.',
        fieldErrors: { currentPassword: ['Password lama tidak sesuai.'] },
        code: 'UNAUTHORIZED',
      };
    }
    await verifier.auth.signOut({ scope: 'local' });

    const { error: updateError } = await serverSupabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return { success: false, error: updateError.message || 'Gagal memperbarui password.', code: 'SERVER_ERROR' };
    }

    // Keluarkan sesi di perangkat lain; sesi saat ini tetap aktif.
    await serverSupabase.auth.signOut({ scope: 'others' });
    await admin.from('login_attempts').delete().eq('attempt_key', rateKeys.id);
    await admin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'change_password',
      entity_type: 'profiles',
      entity_id: user.id,
      metadata: {},
    });

    return { success: true, data: null, message: 'Password berhasil diperbarui. Sesi di perangkat lain telah dikeluarkan.' };
  } catch (err) {
    console.error('[Auth] Gagal ganti password:', err instanceof Error ? err.message : 'unknown');
    return { success: false, error: 'Terjadi kesalahan sistem. Coba beberapa saat lagi.', code: 'SERVER_ERROR' };
  }
}

/**
 * Server Action untuk kewajiban ganti password perdana (must_change_password = true)
 */
export async function changePasswordAction(
  input: ChangePasswordInput
): Promise<ActionResult<{ redirectTo: string }>> {
  const validation = changePasswordSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Data kata sandi baru tidak memenuhi syarat keamanan.',
      fieldErrors: validation.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const { newPassword } = validation.data;

  try {
    const serverSupabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await serverSupabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan login kembali.',
        code: 'UNAUTHORIZED',
      };
    }

    // 1. Update password di Supabase Auth
    const { error: updateAuthError } = await serverSupabase.auth.updateUser({
      password: newPassword,
    });

    if (updateAuthError) {
      return {
        success: false,
        error: updateAuthError.message || 'Gagal memperbarui kata sandi.',
        code: 'SERVER_ERROR',
      };
    }

    // 2. Set must_change_password = false di tabel profiles via admin client
    const adminSupabase = createAdminClient();
    const { data: updatedProfile, error: updateProfileError } = await adminSupabase
      .from('profiles')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('role')
      .single();

    if (updateProfileError) {
      return {
        success: false,
        error: 'Gagal memperbarui status keamanan akun.',
        code: 'SERVER_ERROR',
      };
    }

    const userRole = (updatedProfile?.role as UserRole) || 'murid';
    const redirectTo = ROLE_DASHBOARD_PATH[userRole] || '/dashboard';

    revalidatePath('/', 'layout');
    return {
      success: true,
      data: { redirectTo },
      message: 'Kata sandi berhasil diperbarui. Selamat datang di SDIT Fajar.',
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengganti kata sandi.';
    return {
      success: false,
      error: errorMessage,
      code: 'SERVER_ERROR',
    };
  }
}

/**
 * Server Action untuk keluar akun (Logout)
 */
export async function logoutAction(): Promise<void> {
  const serverSupabase = await createClient();
  await serverSupabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
