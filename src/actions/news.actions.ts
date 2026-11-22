'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { ActionResult } from '@/types/action.types';
import { revalidatePath, revalidateTag } from 'next/cache';
import { randomUUID } from 'crypto';
import { newsPostSchema, NewsPostInput } from '@/validations/news.schema';
import { deleteStorageFile, uploadStorageFile } from '@/lib/supabase/storage';

type CoverChange = { file: File | null; remove: boolean };

/** Unggah cover baru ke bucket publik `images` di bawah `news/<id>/`. */
async function uploadNewsCover(file: File, newsId: string): Promise<{ cover_url: string; cover_path: string }> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const res = await uploadStorageFile('images', `news/${newsId}/${randomUUID()}-${safe}`, await file.arrayBuffer(), file.name, file.type, file.size);
  return { cover_url: res.publicUrl ?? '', cover_path: res.path };
}

/** Hanya berkas milik berita (prefix `news/`) yang boleh dihapus dari storage. */
async function removeNewsCover(path: string | null | undefined) {
  if (!path || !path.startsWith('news/')) return;
  await deleteStorageFile('images', path).catch((err) =>
    console.warn('[Berita] Gagal menghapus cover lama:', err instanceof Error ? err.message : err)
  );
}

const hasFile = (file: File | null): file is File => Boolean(file && file.size > 0);

export async function createNewsAction(
  input: NewsPostInput,
  cover: File | null = null
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const parsed = newsPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Data artikel berita tidak valid.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createClient();

  const isPublished = parsed.data.status === 'published';
  const publishedAt = isPublished ? new Date().toISOString() : null;

  const id = randomUUID();
  let coverValues: { cover_url: string | null; cover_path: string | null } = { cover_url: null, cover_path: null };
  if (hasFile(cover)) {
    try {
      coverValues = await uploadNewsCover(cover, id);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah cover.', code: 'VALIDATION_ERROR' };
    }
  }

  const { data, error } = await supabase
    .from('news_posts')
    .insert({
      id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      content: parsed.data.content,
      ...coverValues,
      status: parsed.data.status,
      author_id: user.id,
      published_at: publishedAt,
    })
    .select('id')
    .single();

  if (error || !data) {
    await removeNewsCover(coverValues.cover_path);
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan artikel berita.',
      code: 'SERVER_ERROR',
    };
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create_news_post',
    entity_type: 'news_posts',
    entity_id: data.id,
    metadata: { title: parsed.data.title, status: parsed.data.status },
  });

  revalidateTag('news', 'max');
  revalidatePath('/dashboard/admin/berita');
  revalidatePath('/berita');
  return { success: true, data: { id: data.id }, message: 'Artikel berita berhasil disimpan.' };
}

export async function updateNewsAction(
  id: string,
  input: NewsPostInput,
  coverChange: CoverChange = { file: null, remove: false }
): Promise<ActionResult<void>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const parsed = newsPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Data artikel berita tidak valid.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    };
  }

  const supabase = await createClient();

  const isPublished = parsed.data.status === 'published';
  const publishedAt = isPublished ? new Date().toISOString() : null;

  const { data: current } = await supabase.from('news_posts').select('cover_path').eq('id', id).maybeSingle();
  if (!current) return { success: false, error: 'Artikel berita tidak ditemukan.', code: 'NOT_FOUND' };

  let coverValues: { cover_url?: string | null; cover_path?: string | null } = {};
  if (hasFile(coverChange.file)) {
    try {
      coverValues = await uploadNewsCover(coverChange.file, id);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah cover.', code: 'VALIDATION_ERROR' };
    }
  } else if (coverChange.remove) {
    coverValues = { cover_url: null, cover_path: null };
  }

  const { error } = await supabase
    .from('news_posts')
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      content: parsed.data.content,
      ...coverValues,
      status: parsed.data.status,
      published_at: publishedAt,
    })
    .eq('id', id);

  if (error) {
    await removeNewsCover(coverValues.cover_path);
    return { success: false, error: error.message, code: 'SERVER_ERROR' };
  }
  if ('cover_path' in coverValues) await removeNewsCover(current.cover_path);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'update_news_post',
    entity_type: 'news_posts',
    entity_id: id,
    metadata: { title: parsed.data.title, status: parsed.data.status },
  });

  revalidateTag('news', 'max');
  revalidateTag(`news:${parsed.data.slug}`, 'max');
  revalidatePath('/dashboard/admin/berita');
  revalidatePath('/berita');
  revalidatePath(`/berita/${parsed.data.slug}`);
  return { success: true, data: undefined, message: 'Artikel berita berhasil diperbarui.' };
}

export async function deleteNewsAction(id: string): Promise<ActionResult<void>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const supabase = await createClient();

  const { data: current } = await supabase.from('news_posts').select('cover_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('news_posts').delete().eq('id', id);
  if (error) {
    return { success: false, error: error.message, code: 'SERVER_ERROR' };
  }
  await removeNewsCover(current?.cover_path);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'delete_news_post',
    entity_type: 'news_posts',
    entity_id: id,
  });

  revalidateTag('news', 'max');
  revalidatePath('/dashboard/admin/berita');
  revalidatePath('/berita');
  return { success: true, data: undefined, message: 'Artikel berita berhasil dihapus.' };
}
