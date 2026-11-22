'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '@/actions/auth.actions';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const errorParam = searchParams.get('error');

  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(() => {
    if (errorParam === 'inactive') {
      return 'Akun Anda dinonaktifkan. Silakan hubungi administrator sekolah.';
    }
    if (errorParam === 'no_profile') {
      return 'Sesi otentikasi dibuat, namun data profil akun belum dapat diakses (kendala hak akses data RLS). Silakan hubungi administrator sekolah.';
    }
    return null;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('NIS, nomor WhatsApp, atau email belum diisi.');
      toast.error('Identitas Akun Belum Diisi', {
        description: 'Masukkan NIS (murid), nomor WhatsApp (wali murid), atau email sekolah (staf/guru).',
      });
      return;
    }
    if (!password) {
      setErrorMessage('Kata sandi wajib diisi.');
      toast.error('Kata Sandi Belum Diisi', {
        description: 'Silakan masukkan kata sandi akun Anda untuk melanjutkan.',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await loginAction({ identifier: cleanIdentifier, password });

      if (!result.success) {
        const displayDesc = result.hint ? `${result.error} ${result.hint}` : result.error;
        setErrorMessage(displayDesc);
        toast.error(result.title || 'Gagal Masuk', { description: displayDesc, duration: 6000 });
        return;
      }

      toast.success('Berhasil Masuk', {
        description: 'Autentikasi terverifikasi. Mengarahkan ke dashboard...',
        duration: 3000,
      });

      const destination =
        redirectTo && redirectTo !== '/dashboard' && redirectTo !== '/dashboard/'
          ? redirectTo
          : result.data.redirectTo;
      router.push(destination);
      router.refresh();
    } catch {
      const msg =
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Perangkat Anda sedang offline. Periksa sambungan internet Anda.'
          : 'Gagal terhubung ke server sekolah. Periksa koneksi jaringan Anda atau coba beberapa saat lagi.';
      setErrorMessage(msg);
      toast.error('Koneksi Terputus', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Masuk ke Akun Anda</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Satu akun untuk murid, wali murid, guru, dan staf
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="identifier">NIS / No. WhatsApp / Email</Label>
        <Input
          id="identifier"
          type="text"
          placeholder="20261001 · 0812… · nama@sditfajar.sch.id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={loading}
          autoComplete="username"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Kata Sandi</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="pr-10"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memverifikasi...
          </>
        ) : (
          'Masuk'
        )}
      </Button>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Password awal</p>
        <p>
          Murid: <code className="font-mono text-primary">tempatddmmyyyy</code> (mis.{' '}
          <code className="font-mono">jakartaselatan30122015</code>). Wali murid: nomor WhatsApp yang
          didaftarkan saat SPMB.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Kendala masuk?{' '}
        <a
          href="https://wa.me/6287737860657"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          Hubungi Bantuan IT
        </a>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image src="/logo.png" alt="Logo SDIT Fajar" width={28} height={28} className="rounded-md" />
            SDIT Fajar
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-10 lg:text-primary-foreground">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-foreground/20" />
        <div className="relative flex max-w-sm flex-col items-center gap-6 text-center">
          <div className="rounded-2xl bg-primary-foreground/95 p-5 shadow-lg">
            <Image src="/logo.png" alt="" width={120} height={120} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Portal Akademik Terpadu</h2>
          <p className="text-primary-foreground/80">
            Materi, nilai, presensi, dan layanan sekolah SDIT Fajar dalam satu tempat.
          </p>
        </div>
      </div>
    </div>
  );
}
