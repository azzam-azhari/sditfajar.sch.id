'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionCard } from '@/components/lms/section-card';
import { updatePaymentSettingsAction } from '@/actions/payment.actions';
import type { BankAccount } from '@/validations/payment.schema';

interface Settings {
  is_enabled: boolean;
  manual_transfer_enabled: boolean;
  is_spp_enabled: boolean;
  is_iuran_enabled: boolean;
  is_pendaftaran_semester_enabled: boolean;
  is_marketplace_enabled: boolean;
  bank_accounts: BankAccount[];
  manual_instructions: string | null;
}

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'is_enabled', label: 'Aktifkan pembayaran', hint: 'Saklar utama. Bila mati, wali tidak dapat membayar tagihan apa pun.' },
  { key: 'manual_transfer_enabled', label: 'Transfer manual + unggah bukti', hint: 'Wali transfer ke rekening sekolah lalu mengunggah bukti untuk diverifikasi.' },
  { key: 'is_spp_enabled', label: 'Tagihan SPP', hint: 'SPP bulanan.' },
  { key: 'is_iuran_enabled', label: 'Iuran kegiatan & lainnya', hint: 'Iuran ekstrakurikuler dan tagihan lain-lain.' },
  { key: 'is_pendaftaran_semester_enabled', label: 'Daftar ulang semester', hint: 'Daftar ulang ganjil/genap.' },
  { key: 'is_marketplace_enabled', label: 'Pesanan marketplace', hint: 'Tagihan dari pesanan marketplace wali murid.' },
];

export function PaymentSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState<Settings>(initial);

  const setToggle = (key: keyof Settings, value: boolean) => setForm((f) => ({ ...f, [key]: value }));
  const setBank = (index: number, field: keyof BankAccount, value: string) =>
    setForm((f) => ({ ...f, bank_accounts: f.bank_accounts.map((b, i) => (i === index ? { ...b, [field]: value } : b)) }));

  const save = () =>
    startTransition(async () => {
      const res = await updatePaymentSettingsAction(form);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Aktivasi" description="Perubahan dicatat di audit log.">
          <div className="space-y-2">
            {TOGGLES.map((t) => (
              <label key={t.key} className="flex items-start gap-3 rounded-lg border border-border/80 p-3 text-xs">
                <Checkbox checked={Boolean(form[t.key])} onCheckedChange={(v) => setToggle(t.key, v === true)} aria-label={t.label} />
                <span>
                  <span className="block font-medium text-foreground">{t.label}</span>
                  <span className="block text-muted-foreground">{t.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Rekening Tujuan Transfer"
            description="Ditampilkan kepada wali murid saat membayar."
            action={
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={form.bank_accounts.length >= 5}
                onClick={() => setForm((f) => ({ ...f, bank_accounts: [...f.bank_accounts, { bank: '', account_number: '', account_name: '' }] }))}
              >
                <Plus className="size-3.5" /> Rekening
              </Button>
            }
          >
            {form.bank_accounts.length === 0 && <p className="text-xs text-muted-foreground">Belum ada rekening.</p>}
            <div className="space-y-3">
              {form.bank_accounts.map((b, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border/80 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Bank</Label>
                    <Input aria-label={`Bank rekening ${i + 1}`} value={b.bank} onChange={(e) => setBank(i, 'bank', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">No. rekening</Label>
                    <Input aria-label={`Nomor rekening ${i + 1}`} className="font-mono" value={b.account_number} onChange={(e) => setBank(i, 'account_number', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Atas nama</Label>
                    <Input aria-label={`Atas nama rekening ${i + 1}`} value={b.account_name} onChange={(e) => setBank(i, 'account_name', e.target.value)} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 self-end p-0 text-destructive"
                    aria-label={`Hapus rekening ${i + 1}`}
                    onClick={() => setForm((f) => ({ ...f, bank_accounts: f.bank_accounts.filter((_, idx) => idx !== i) }))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Instruksi Pembayaran" description="Contoh: cantumkan NIS di berita transfer.">
            <Textarea
              rows={4}
              aria-label="Instruksi pembayaran"
              value={form.manual_instructions ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, manual_instructions: e.target.value }))}
              maxLength={2000}
            />
          </SectionCard>

          <SectionCard title="Payment Gateway (Midtrans)" description="Ditunda sesuai keputusan sekolah. Pembayaran otomatis belum aktif.">
            <p className="text-xs text-muted-foreground">Kunci Midtrans tidak disimpan di database dan tidak diperlukan untuk pembayaran manual.</p>
          </SectionCard>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" className="h-9 text-xs" onClick={save} disabled={isPending}>
          <Save className="size-3.5" /> {isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </Button>
      </div>
    </div>
  );
}
