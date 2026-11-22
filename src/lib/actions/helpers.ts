import 'server-only';
import { revalidatePath } from 'next/cache';
import type { PostgrestError } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import type { ActionError } from '@/types/action.types';

/** Helper bersama untuk Server Actions (validasi, error database, audit, revalidasi). */

export function validationError(fieldErrors: Record<string, string[] | undefined>): ActionError {
  const normalized = Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]))
  );
  const first = Object.values(normalized)[0]?.[0];
  return {
    success: false,
    error: first ?? 'Data yang dimasukkan tidak valid.',
    fieldErrors: normalized,
    code: 'VALIDATION_ERROR',
  };
}

/**
 * Ubah error database menjadi pesan yang aman ditampilkan.
 * Pesan dari trigger/fungsi (RAISE EXCEPTION, kode P0001) memang ditulis untuk pengguna.
 */
export function dbError(error: PostgrestError | null, fallback: string): ActionError {
  if (error?.code === '23505') {
    return { success: false, error: 'Data yang sama sudah tercatat sebelumnya.', code: 'DUPLICATE_ENTRY' };
  }
  if (error?.code === 'P0001' && error.message) {
    return { success: false, error: error.message, code: 'VALIDATION_ERROR' };
  }
  if (error?.code === '42501') {
    return { success: false, error: 'Anda tidak memiliki akses untuk tindakan ini.', code: 'FORBIDDEN' };
  }
  if (error) console.error('[Action] Database error:', error.code, error.message);
  return { success: false, error: fallback, code: 'SERVER_ERROR' };
}

export function revalidateDashboards(): void {
  revalidatePath('/dashboard', 'layout');
}

export async function writeAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean | null>
): Promise<void> {
  const { user } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('audit_logs')
    .insert({ actor_id: user.id, action, entity_type: entityType, entity_id: entityId, metadata });
  if (error) console.warn('[Action] Gagal menulis audit log:', error.message);
}
