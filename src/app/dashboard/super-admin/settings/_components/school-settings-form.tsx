'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { removeSchoolLogoAction, updateSchoolSettingsAction, updateSchoolLogoAction } from '@/actions/super-admin.actions';
import { useRouter } from 'next/navigation';
import { School, Phone, Mail, MapPin, Globe, Save, ImageUp, Trash2 } from 'lucide-react';

interface SchoolSettingsItem {
  id?: string;
  school_name?: string;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  maps_url?: string | null;
  logo_url?: string | null;
}

export function SchoolSettingsForm({
  initialSettings,
}: {
  initialSettings?: SchoolSettingsItem | null;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [logoPending, startLogoTransition] = React.useTransition();
  const router = useRouter();
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = React.useState(0);
  const logoUrl = initialSettings?.logo_url ?? null;

  const uploadLogo = () =>
    startLogoTransition(async () => {
      const res = await updateSchoolLogoAction(logoFile);
      if (res.success) {
        toast.success(res.message);
        setLogoFile(null);
        setLogoInputKey((k) => k + 1);
        router.refresh();
      } else toast.error(res.error);
    });

  const removeLogo = () =>
    startLogoTransition(async () => {
      const res = await removeSchoolLogoAction();
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });

  const [schoolName, setSchoolName] = React.useState(
    initialSettings?.school_name || 'SDIT Fajar'
  );
  const [address, setAddress] = React.useState(
    initialSettings?.address || 'Jl. H. Dimun Raya No. 45, Sukamaju, Cilodong, Kota Depok, Jawa Barat'
  );
  const [phone, setPhone] = React.useState(
    initialSettings?.phone || '(021) 7782-9901'
  );
  const [whatsapp, setWhatsapp] = React.useState(
    initialSettings?.whatsapp || '0812-9876-5430'
  );
  const [email, setEmail] = React.useState(
    initialSettings?.email || 'info@sdit-fajar.sch.id'
  );
  const [mapsUrl, setMapsUrl] = React.useState(
    initialSettings?.maps_url || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSchoolSettingsAction({
        school_name: schoolName,
        address,
        phone,
        whatsapp,
        email,
        maps_url: mapsUrl || null,
      });

      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageUp className="size-4 text-primary" />
            Logo Sekolah
          </CardTitle>
          <CardDescription className="text-xs">
            Tampil pada kuitansi pembayaran. JPG, PNG, atau WebP, maks. 5 MB; disarankan persegi dengan latar transparan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/30">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo sekolah saat ini" className="size-16 object-contain" />
            ) : (
              <span className="text-[11px] text-muted-foreground">Belum ada</span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              key={logoInputKey}
              type="file"
              aria-label="Berkas logo sekolah"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="text-xs h-9"
            />
            <Button type="button" size="sm" className="text-xs h-9" disabled={!logoFile || logoPending} onClick={uploadLogo}>
              <ImageUp className="size-3.5 mr-1.5" />
              {logoPending ? 'Memproses...' : 'Unggah Logo'}
            </Button>
            {logoUrl && (
              <Button type="button" size="sm" variant="outline" className="text-xs h-9 text-destructive" disabled={logoPending} onClick={removeLogo}>
                <Trash2 className="size-3.5 mr-1.5" />
                Hapus
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    <form onSubmit={handleSubmit}>
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <School className="size-4 text-primary" />
            Profil & Kontak Resmi SDIT Fajar
          </CardTitle>
          <CardDescription className="text-xs">
            Perubahan identitas ini langsung berdampak pada footer web publik, kwitansi cetak, dan portal SPMB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nama Resmi Institusi Sekolah</Label>
            <Input
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <MapPin className="size-3 text-muted-foreground" />
              Alamat Lengkap Sekolah
            </Label>
            <Input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground" />
                Nomor Telepon Kantor
              </Label>
              <Input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Phone className="size-3 text-emerald-600" />
                Nomor WhatsApp Layanan SPMB / Sekolah
              </Label>
              <Input
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Mail className="size-3 text-muted-foreground" />
                Alamat Email Resmi Sekolah
              </Label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Globe className="size-3 text-muted-foreground" />
                Tautan Embed Google Maps (Opsional)
              </Label>
              <Input
                type="url"
                placeholder="https://maps.google.com/..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2 border-t border-border/60">
          <Button type="submit" size="sm" className="text-xs h-9" disabled={isPending}>
            <Save className="size-3.5 mr-1.5" />
            {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </CardFooter>
      </Card>
    </form>
    </div>
  );
}
