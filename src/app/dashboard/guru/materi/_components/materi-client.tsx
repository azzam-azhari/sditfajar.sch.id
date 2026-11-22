'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, Archive, Send, FileEdit } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { LmsFileButton } from '@/components/lms/lms-file-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createMaterialAction, deleteMaterialAction, setMaterialStatusAction, updateMaterialAction,
} from '@/actions/lms.actions';
import type { TeachingAssignmentRef } from '@/lib/data/lms';
import { formatDate } from '@/lib/date';

export interface MaterialItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  external_url: string | null;
  file_path: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  classroom_id: string;
  subject_id: string;
  semester_id: string;
  classrooms: { name: string } | null;
  subjects: { name: string } | null;
}

const STATUS_LABEL = { draft: 'Draf', published: 'Terpublikasi', archived: 'Arsip' } as const;
const STATUS_VARIANT = { draft: 'neutral', published: 'success', archived: 'warning' } as const;

interface FormState {
  id: string | null;
  title: string;
  description: string;
  content: string;
  external_url: string;
  assignmentKey: string;
  status: 'draft' | 'published' | 'archived';
  hasFile: boolean;
  removeFile: boolean;
}

const emptyForm = (assignmentKey: string): FormState => ({
  id: null,
  title: '',
  description: '',
  content: '',
  external_url: '',
  assignmentKey,
  status: 'draft',
  hasFile: false,
  removeFile: false,
});

export function MateriClient({
  initialMaterials,
  assignments,
}: {
  initialMaterials: MaterialItem[];
  assignments: TeachingAssignmentRef[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm(assignments[0]?.id ?? ''));
  const [file, setFile] = React.useState<File | null>(null);
  const [filter, setFilter] = React.useState('all');
  const [toDelete, setToDelete] = React.useState<MaterialItem | null>(null);

  const keyOf = (m: MaterialItem) =>
    assignments.find((a) => a.classroom.id === m.classroom_id && a.subject.id === m.subject_id && a.semester_id === m.semester_id)?.id ?? '';

  const rows = React.useMemo(
    () => (filter === 'all' ? initialMaterials : initialMaterials.filter((m) => keyOf(m) === filter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialMaterials, filter]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm(filter !== 'all' ? filter : assignments[0]?.id ?? ''));
    setFile(null);
    setOpen(true);
  };

  const openEdit = (m: MaterialItem) => {
    setForm({
      id: m.id,
      title: m.title,
      description: m.description ?? '',
      content: m.content ?? '',
      external_url: m.external_url ?? '',
      assignmentKey: keyOf(m),
      status: m.status,
      hasFile: Boolean(m.file_path),
      removeFile: false,
    });
    setFile(null);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scope = assignments.find((a) => a.id === form.assignmentKey);
    if (!scope) {
      toast.error('Pilih kelas dan mapel yang Anda ampu.');
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      content: form.content,
      external_url: form.external_url,
      classroom_id: scope.classroom.id,
      subject_id: scope.subject.id,
      semester_id: scope.semester_id,
      status: form.status,
    };
    startTransition(async () => {
      const res = form.id
        ? await updateMaterialAction({ ...payload, id: form.id, remove_file: form.removeFile }, file)
        : await createMaterialAction(payload, file);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const changeStatus = (m: MaterialItem, status: MaterialItem['status']) => {
    startTransition(async () => {
      const res = await setMaterialStatusAction({ id: m.id, status });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      const res = await deleteMaterialAction(toDelete.id);
      if (res.success) {
        toast.success(res.message);
        setToDelete(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
        Anda belum memiliki penugasan mengajar pada semester aktif. Hubungi admin untuk menambahkan penugasan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-full sm:w-72 text-xs" aria-label="Filter kelas dan mapel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Semua kelas & mapel</SelectItem>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                {a.classroom.name} · {a.subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9 text-xs" onClick={openCreate}>
          <Plus className="size-3.5" /> Materi Baru
        </Button>
      </div>

      <ZebraDataTable<MaterialItem>
        data={rows}
        keyExtractor={(m) => m.id}
        emptyText="Belum ada materi untuk kelas ini."
        columns={[
          {
            header: 'Judul',
            cell: (m) => (
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{m.title}</div>
                {m.description && <div className="text-xs text-muted-foreground line-clamp-1">{m.description}</div>}
              </div>
            ),
          },
          { header: 'Kelas · Mapel', cell: (m) => `${m.classrooms?.name ?? '-'} · ${m.subjects?.name ?? '-'}` },
          {
            header: 'Isi',
            cell: (m) => (
              <div className="flex flex-wrap items-center gap-1.5">
                {m.file_path && <LmsFileButton kind="material" id={m.id} label="Berkas" />}
                {m.external_url && (
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                    <a href={m.external_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" /> Tautan
                    </a>
                  </Button>
                )}
                {m.content && <span className="text-xs text-muted-foreground">Teks panduan</span>}
              </div>
            ),
          },
          {
            header: 'Status',
            cell: (m) => <StatusBadge status={STATUS_LABEL[m.status]} variant={STATUS_VARIANT[m.status]} size="sm" />,
          },
          { header: 'Dibuat', isMono: true, cell: (m) => formatDate(m.created_at) },
          {
            header: 'Aksi',
            align: 'right',
            cell: (m) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Aksi materi ${m.title}`}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => openEdit(m)}>
                    <Pencil className="size-3.5" /> Ubah
                  </DropdownMenuItem>
                  {m.status !== 'published' && (
                    <DropdownMenuItem onClick={() => changeStatus(m, 'published')}>
                      <Send className="size-3.5" /> Publikasikan
                    </DropdownMenuItem>
                  )}
                  {m.status === 'published' && (
                    <DropdownMenuItem onClick={() => changeStatus(m, 'draft')}>
                      <FileEdit className="size-3.5" /> Jadikan draf
                    </DropdownMenuItem>
                  )}
                  {m.status !== 'archived' && (
                    <DropdownMenuItem onClick={() => changeStatus(m, 'archived')}>
                      <Archive className="size-3.5" /> Arsipkan
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(m)}>
                    <Trash2 className="size-3.5" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Materi' : 'Materi Baru'}</DialogTitle>
              <DialogDescription className="text-xs">
                Isi minimal salah satu: teks panduan, tautan/video, atau berkas modul (maks. 10 MB).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="m-title" className="text-xs">Judul</Label>
              <Input id="m-title" value={form.title} onChange={(e) => update('title', e.target.value)} required minLength={3} maxLength={160} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Kelas · Mapel</Label>
                <Select value={form.assignmentKey} onValueChange={(v) => update('assignmentKey', v)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Kelas dan mapel">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.classroom.name} · {a.subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => update('status', v as FormState['status'])}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Status materi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft" className="text-xs">Draf</SelectItem>
                    <SelectItem value="published" className="text-xs">Terpublikasi</SelectItem>
                    <SelectItem value="archived" className="text-xs">Arsip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-desc" className="text-xs">Deskripsi singkat</Label>
              <Input id="m-desc" value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={1000} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-content" className="text-xs">Teks panduan</Label>
              <Textarea id="m-content" rows={5} value={form.content} onChange={(e) => update('content', e.target.value)} maxLength={20000} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-url" className="text-xs">Tautan / video (opsional)</Label>
              <Input id="m-url" type="url" placeholder="https://youtube.com/..." value={form.external_url} onChange={(e) => update('external_url', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-file" className="text-xs">Berkas modul (PDF, dokumen, gambar)</Label>
              <Input id="m-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {form.id && form.hasFile && !file && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={form.removeFile} onCheckedChange={(v) => update('removeFile', v === true)} />
                  Hapus berkas yang sudah ada
                </label>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Materi'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus materi?</DialogTitle>
            <DialogDescription className="text-xs">
              &ldquo;{toDelete?.title}&rdquo; dan berkasnya akan dihapus permanen dan tidak dapat dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isPending}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
