import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !anonKey || !serviceKey) {
  throw new Error('Integration test butuh NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY di .env.local.');
}

/** Kata sandi akun seed demo dibaca dari migration seed (sama untuk 7 akun demo). */
function seedPassword(): string {
  const fromEnv = process.env.TEST_SEED_PASSWORD;
  if (fromEnv) return fromEnv;
  const sql = fs.readFileSync(path.resolve('supabase/migrations/20261026_000007_seed_auth_users.sql'), 'utf8');
  const match = sql.match(/crypt\('([^']+)'/);
  if (!match) throw new Error('Kata sandi seed tidak ditemukan; set TEST_SEED_PASSWORD.');
  return match[1];
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} di .env.local untuk integration test.`);
  return v;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const service: SupabaseClient = createClient(url, serviceKey, noSession);
export const anon: SupabaseClient = createClient(url, anonKey, noSession);

export const ACCOUNTS = {
  admin: { email: 'admin@sditfajar.sch.id', password: () => seedPassword() },
  guruSiti: { email: 'ustsiti@sditfajar.sch.id', password: () => seedPassword() },
  guruAhmad: { email: 'ustahmad@sditfajar.sch.id', password: () => seedPassword() },
  muridQa: { email: '990001@siswa.sdit-fajar.sch.id', password: () => requiredEnv('TEST_MURID_QA_PASSWORD') },
  waliQa: { email: '089900000001@wali.sdit-fajar.sch.id', password: () => requiredEnv('TEST_WALI_QA_PASSWORD') },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Client ber-sesi untuk satu akun (RLS berlaku penuh, sama seperti browser). */
export async function signIn(key: AccountKey): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession);
  const { email, password } = ACCOUNTS[key];
  const { error } = await client.auth.signInWithPassword({ email, password: password() });
  if (error) throw new Error(`Login ${key} gagal: ${error.message}`);
  return client;
}

/**
 * Akun penyerang sementara (murid tanpa nilai, wali tanpa anak) dibuat lewat service role,
 * agar tes tidak bergantung pada kata sandi akun nyata yang bisa diganti pemiliknya.
 * Wajib dihapus dengan removeTempUsers() di afterAll.
 */
export interface TempUser { id: string; client: SupabaseClient }

export async function createTempUser(role: 'murid' | 'wali_murid'): Promise<TempUser> {
  const tag = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `qa-attacker-${role}-${tag}@test.sdit-fajar.invalid`;
  const password = `Qa!${tag}xY`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Gagal membuat akun uji ${role}: ${error?.message}`);
  const id = data.user.id;
  const { error: pErr } = await service.from('profiles').upsert({
    id, name: `QA Attacker ${role}`, email, login_identifier: email, role, is_active: true, must_change_password: false,
  });
  if (pErr) throw new Error(`Gagal membuat profil uji: ${pErr.message}`);
  const domain = role === 'murid'
    ? await service.from('students').insert({ profile_id: id, nis: `QAX${tag}` })
    : await service.from('parents').insert({ profile_id: id });
  if (domain.error) throw new Error(`Gagal membuat data domain uji: ${domain.error.message}`);
  const client = createClient(url, anonKey, noSession);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Login akun uji gagal: ${signedIn.error.message}`);
  return { id, client };
}

export async function removeTempUsers(users: TempUser[]): Promise<void> {
  for (const u of users) {
    await service.from('students').delete().eq('profile_id', u.id);
    await service.from('parents').delete().eq('profile_id', u.id);
    await service.from('profiles').delete().eq('id', u.id);
    await service.auth.admin.deleteUser(u.id);
  }
}

/** ID data milik QA Murid Satu / QA Wali Satu yang menjadi sasaran uji IDOR. */
export async function qaFixtures() {
  const { data: student } = await service.from('students').select('id').eq('nis', '990001').single();
  if (!student) throw new Error('Murid QA (NIS 990001) tidak ditemukan.');
  const sid = student.id as string;
  const [paidInvoice, submission, proof, material, regDoc] = await Promise.all([
    service.from('payment_invoices').select('id').eq('student_id', sid).eq('status', 'paid').limit(1).maybeSingle(),
    service.from('assignment_submissions').select('id, file_path').eq('student_id', sid).not('file_path', 'is', null).limit(1).maybeSingle(),
    service.from('payment_proofs').select('id, file_path').limit(1).maybeSingle(),
    service.from('materials').select('id, file_path, teacher_id, subject_id, classroom_id, semester_id').not('file_path', 'is', null).limit(1).maybeSingle(),
    service.from('student_registration_documents').select('file_path').not('file_path', 'is', null).limit(1).maybeSingle(),
  ]);
  return {
    studentId: sid,
    paidInvoiceId: paidInvoice.data?.id as string | undefined,
    submission: submission.data as { id: string; file_path: string } | null,
    proof: proof.data as { id: string; file_path: string } | null,
    material: material.data as {
      id: string; file_path: string; teacher_id: string; subject_id: string; classroom_id: string; semester_id: string;
    } | null,
    regDocPath: regDoc.data?.file_path as string | undefined,
  };
}
