'use client';

import * as React from 'react';
import { ZebraDataTable, ZebraColumn } from '@/components/common/zebra-data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { createNewsAction, updateNewsAction, deleteNewsAction } from '@/actions/news.actions';
import { Newspaper, Plus, Edit, Trash2, Globe, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

// Server action menerima body via proxy (batas ~10MB); cover dibatasi 5 MB di client
// agar request tidak terpotong ("Unexpected end of form").
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function coverError(file: File | null): string | null {
  if (!file) return null;
  if (!COVER_TYPES.includes(file.type)) return 'Format cover harus JPG, PNG, atau WebP.';
  if (file.size > MAX_COVER_BYTES) return `Ukuran cover ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas 5 MB.`;
  return null;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  cover_path: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  profiles?: {
    name: string;
  };
}

export function BeritaClient({ initialPosts }: { initialPosts: NewsItem[] }) {
  const [posts, setPosts] = React.useState<NewsItem[]>(initialPosts);
  const [isPending, startTransition] = React.useTransition();

  // Modal State
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingPost, setEditingPost] = React.useState<NewsItem | null>(null);

  // Form State
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [excerpt, setExcerpt] = React.useState('');
  const [content, setContent] = React.useState('');
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [removeCover, setRemoveCover] = React.useState(false);
  const [status, setStatus] = React.useState<'draft' | 'published'>('draft');

  const openCreateModal = () => {
    setEditingPost(null);
    setTitle('');
    setSlug('');
    setExcerpt('');
    setContent('');
    setCoverFile(null);
    setRemoveCover(false);
    setStatus('draft');
    setIsOpen(true);
  };

  const openEditModal = (item: NewsItem) => {
    setEditingPost(item);
    setTitle(item.title);
    setSlug(item.slug);
    setExcerpt(item.excerpt || '');
    setContent(item.content);
    setCoverFile(null);
    setRemoveCover(false);
    setStatus(item.status === 'published' ? 'published' : 'draft');
    setIsOpen(true);
  };

  // Helper Auto Generate Slug dari Judul
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingPost) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 60);
      setSlug(generated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidCover = coverError(coverFile);
    if (invalidCover) {
      toast.error(invalidCover);
      return;
    }
    startTransition(async () => {
      if (editingPost) {
        const res = await updateNewsAction(
          editingPost.id,
          { title, slug, excerpt, content, status },
          { file: coverFile, remove: removeCover }
        );

        if (res.success) {
          toast.success(res.message);
          setIsOpen(false);
          window.location.reload();
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createNewsAction({ title, slug, excerpt, content, status }, coverFile);

        if (res.success) {
          toast.success(res.message);
          setIsOpen(false);
          window.location.reload();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus artikel berita ini?')) return;

    startTransition(async () => {
      const res = await deleteNewsAction(id);
      if (res.success) {
        toast.success(res.message);
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        toast.error(res.error);
      }
    });
  };

  const columns: ZebraColumn<NewsItem>[] = [
    {
      header: 'Judul Warta Berita',
      cell: (item) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">
            {item.title}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            /{item.slug}
          </span>
        </div>
      ),
    },
    {
      header: 'Status Tayang',
      cell: (item) => (
        item.status === 'published' ? (
          <Badge variant="outline" className="text-emerald-600 border-emerald-400 font-mono text-[11px]">
            Terbit (Publik)
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground border-border font-mono text-[11px]">
            Konsep (Draft)
          </Badge>
        )
      ),
    },
    {
      header: 'Penerbit',
      cell: (item) => (
        <span className="text-xs text-foreground font-medium">
          {item.profiles?.name || 'Humas SDIT Fajar'}
        </span>
      ),
    },
    {
      header: 'Tanggal Terbit',
      cell: (item) => (
        <span className="text-[11px] text-muted-foreground font-mono">
          {item.published_at
            ? new Date(item.published_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })
            : 'Belum Terbit'}
        </span>
      ),
    },
    {
      header: 'Aksi',
      align: 'right',
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Buka menu aksi"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Aksi Berita</DropdownMenuLabel>
            {item.status === 'published' && (
              <DropdownMenuItem asChild>
                <Link href={`/berita/${item.slug}`} target="_blank" className="cursor-pointer">
                  <Globe className="size-3.5 mr-2 text-primary" />
                  Lihat Publikasi
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => openEditModal(item)} className="cursor-pointer">
              <Edit className="size-3.5 mr-2" />
              Edit Artikel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDelete(item.id)}
              className="cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-2" />
              Hapus Berita
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Total artikel tersimpan: <span className="font-semibold text-foreground">{posts.length}</span> berita.
        </p>
        <Button size="sm" className="text-xs h-9" onClick={openCreateModal}>
          <Plus className="size-3.5 mr-1.5" />
          Tulis Berita Baru
        </Button>
      </div>

      <ZebraDataTable data={posts} columns={columns} emptyText="Belum ada artikel berita yang dibuat." />

      {/* Modal Tulis / Edit Berita */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Newspaper className="size-4 text-primary" />
              {editingPost ? 'Edit Artikel Berita' : 'Tulis Berita Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Publikasikan kegiatan murid, artikel keagamaan, dan kabar prestasi sekolah.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="news-title" className="text-xs font-medium">Judul Artikel Berita</Label>
              <Input
                id="news-title"
                required
                placeholder="Contoh: Murid SDIT Fajar Raih Juara 1 MHQ Tingkat Kota Depok"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="h-9 w-full text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="news-slug" className="text-xs font-medium">Slug URL</Label>
                <Input
                  id="news-slug"
                  required
                  placeholder="murid-raih-juara-1-mhq"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 w-full font-mono text-sm"
                />
                <p className="truncate text-[11px] text-muted-foreground">
                  Alamat: /berita/{slug || 'slug-artikel'}
                </p>
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="news-status" className="text-xs font-medium">Status Publikasi</Label>
                <Select
                  value={status}
                  onValueChange={(v: 'draft' | 'published') => setStatus(v)}
                >
                  <SelectTrigger id="news-status" className="h-9 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Konsep (Draft - Belum Tayang)</SelectItem>
                    <SelectItem value="published">Terbit (Published - Tayang di Web)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Hanya artikel berstatus Terbit yang tampil di website.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="news-excerpt" className="text-xs font-medium">Cuplikan Ringkas (Excerpt)</Label>
              <Input
                id="news-excerpt"
                placeholder="Ringkasan 1–2 kalimat untuk kartu cuplikan..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="h-9 w-full text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Tampil di kartu berita & hasil pencarian Google.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="news-cover" className="text-xs font-medium">
                Foto Cover <span className="font-normal text-muted-foreground">(Opsional · JPG/PNG/WebP, maks. 5 MB)</span>
              </Label>
              {editingPost?.cover_url && !coverFile && !removeCover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editingPost.cover_url} alt="Cover saat ini" className="h-20 w-36 rounded-md border border-border/80 object-cover" />
              )}
              <Input
                id="news-cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  const invalid = coverError(file);
                  if (invalid) {
                    toast.error(invalid);
                    e.target.value = '';
                    setCoverFile(null);
                    return;
                  }
                  setCoverFile(file);
                  setRemoveCover(false);
                }}
                className="h-9 w-full cursor-pointer py-1 text-sm text-muted-foreground file:mr-3 file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-xs file:font-medium file:text-foreground"
              />
              {editingPost?.cover_url && !coverFile && (
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={removeCover} onChange={(e) => setRemoveCover(e.target.checked)} />
                  Hapus cover saat ini
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="news-content" className="text-xs font-medium">Isi Lengkap Berita</Label>
              <Textarea
                id="news-content"
                required
                rows={8}
                placeholder="Tuliskan isi berita selengkapnya di sini... (pisahkan paragraf dengan baris kosong)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-40 w-full resize-y text-sm"
              />
            </div>

            <DialogFooter className="gap-2 border-t pt-4">
              <Button type="button" variant="outline" className="h-9" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="h-9" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan Artikel'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
