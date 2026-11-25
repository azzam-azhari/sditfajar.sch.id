"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarRange,
  Check,
  FileText,
  Landmark,
  MessageCircle,
  Phone,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/common/date-picker";
import { cn } from "@/lib/utils";
import {
  EDUCATION_LEVELS,
  MAX_STUDENT_AGE,
  MIN_STUDENT_AGE,
  STEP1_FIELDS,
  STEP2_FIELDS,
  publicRegistrationSchema,
  type PublicRegistrationInput,
} from "@/validations/spmb.schema";
import { submitPublicRegistrationAction } from "@/actions/spmb.actions";
import type { PublicSpmbInfo, SpmbWave } from "@/lib/data/spmb";

const SPMB_CONTACTS = [
  { name: "Ust. M Fadil Riswandi", phone: "0877-3786-0657" },
  { name: "Ustzh. Viny Virzana", phone: "0822-4962-7864" },
] as const;

const REQUIRED_DOCUMENTS = ["Akta Kelahiran siswa", "Kartu Keluarga", "Foto bukti transfer"] as const;

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STEPS = [
  { id: 1, label: "Data Calon Siswa" },
  { id: 2, label: "Data Orang Tua" },
  { id: 3, label: "Pembayaran & Konfirmasi" },
] as const;

const SIBLING_OPTIONS = ["1", "2", "3", "4", "5"] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

const inputClass =
  "w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const textareaClass =
  "w-full rounded-md border border-input bg-background p-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none";

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function monthName(date: string) {
  return MONTHS[Number(date.slice(5, 7)) - 1] ?? "";
}

function wavePeriod(w: SpmbWave) {
  return `${monthName(w.start_date)}–${monthName(w.end_date)}`;
}

function waLink(phone: string) {
  return `https://wa.me/62${phone.replace(/\D/g, "").replace(/^0/, "")}`;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
        {label} <span className="text-destructive">*</span>
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
      {children}
    </h4>
  );
}

export function RegistrationFormClient({ info }: { info: PublicSpmbInfo }) {
  const router = useRouter();
  const { activeWave, waves, academicYearName, bankAccount, transferInstructions } = info;
  const isOpen = activeWave !== null;
  const yearLabel = academicYearName ?? "";

  const [step, setStep] = React.useState(1);
  const [siblingsChoice, setSiblingsChoice] = React.useState<string>("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PublicRegistrationInput>({
    resolver: zodResolver(publicRegistrationSchema),
    defaultValues: {
      admission_wave_id: activeWave?.id ?? "",
      student_name: "",
      nickname: "",
      birth_place: "",
      birth_date: "",
      phone: "",
      address: "",
      hobby: "",
      achievements: "",
      medical_history: "",
      father_name: "",
      father_occupation: "",
      mother_name: "",
      mother_occupation: "",
      parent_address: "",
      hp_tambahan: "",
    },
  });

  // Timestamp anti-spam di-set saat mount agar tidak memicu error prerender Date.now().
  React.useEffect(() => {
    setValue("form_started_at", Date.now());
  }, [setValue]);

  const birthDate = watch("birth_date");
  const gender = watch("gender");
  const fatherEducation = watch("father_education");
  const motherEducation = watch("mother_education");

  const goToStep = async (target: number) => {
    if (!isOpen) return;
    if (target <= step) {
      setStep(target);
      return;
    }
    if (!(await trigger([...STEP1_FIELDS]))) return setStep(1);
    if (target === 3 && !(await trigger([...STEP2_FIELDS]))) return setStep(2);
    setStep(target);
  };

  const handleSiblingsChange = (value: string) => {
    setSiblingsChoice(value);
    if (value === "lainnya") {
      setValue("total_siblings", undefined as unknown as number);
    } else {
      setValue("total_siblings", Number(value), { shouldValidate: true });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!FILE_EXTENSIONS.includes(ext)) {
      setFileError("Tipe berkas tidak didukung. Pilih foto JPG/PNG atau PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Ukuran berkas melebihi batas 5 MB.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (data: PublicRegistrationInput) => {
    if (!selectedFile) {
      setFileError("Foto bukti transfer wajib diunggah.");
      return;
    }
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    }
    formData.append("document", selectedFile);

    try {
      const res = await submitPublicRegistrationAction(formData);
      if (res.success) {
        toast.success(res.message || "Pendaftaran berhasil dikirim!");
        router.push(`/spmb/sukses/${res.data.registrationNumber}`);
      } else {
        toast.error(res.error || "Gagal mengirim formulir pendaftaran.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses formulir.");
    }
  };

  // Jika validasi saat submit gagal di langkah sebelumnya, arahkan ke langkah tersebut.
  const onInvalid = (fieldErrors: Record<string, unknown>) => {
    const keys = Object.keys(fieldErrors);
    if (keys.some((k) => (STEP1_FIELDS as readonly string[]).includes(k))) setStep(1);
    else if (keys.some((k) => (STEP2_FIELDS as readonly string[]).includes(k))) setStep(2);
    toast.error("Masih ada data yang belum lengkap.");
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 space-y-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
            isOpen ? "bg-primary text-primary-foreground" : "bg-destructive/10 text-destructive"
          )}
        >
          {isOpen
            ? `Penerimaan Murid Baru${yearLabel ? ` T.A. ${yearLabel}` : ""} Dibuka`
            : "Pendaftaran Belum Dibuka"}
        </span>
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Formulir Pendaftaran Siswa Baru SDIT Fajar
          </h2>
          {yearLabel && (
            <p className="text-sm font-semibold text-primary">Tahun Ajaran {yearLabel}</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
          Assalamualaikum Wr. Wb. Selamat datang di portal resmi Sistem Penerimaan Murid Baru (SPMB,
          sebelumnya dikenal sebagai PPDB) SDIT Fajar Depok. Silakan lengkapi formulir pendaftaran di
          bawah ini secara bertahap dengan data yang valid dan sesuai dokumen resmi.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {activeWave && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary">
              <CalendarRange className="h-3.5 w-3.5" />
              Gelombang {activeWave.wave_number} Aktif
            </span>
          )}
          {activeWave && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Biaya Formulir: <strong className="font-mono">{formatRupiah(activeWave.registration_fee)}</strong>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
            <Award className="h-3.5 w-3.5 text-primary" />
            Akreditasi A Unggul
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {/* Stepper */}
          <nav aria-label="Langkah pendaftaran" className="rounded-xl border border-border/80 bg-card p-2">
            <ol className="grid grid-cols-3 gap-1 text-center text-xs font-semibold">
              {STEPS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.id)}
                    disabled={!isOpen}
                    aria-current={step === s.id ? "step" : undefined}
                    className={cn(
                      "w-full py-2 px-2 rounded-lg transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 disabled:opacity-50",
                      step === s.id
                        ? "bg-primary text-primary-foreground"
                        : step > s.id
                        ? "text-primary hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="font-mono">
                      {step > s.id ? <Check className="h-3.5 w-3.5 inline" /> : `${s.id}.`}
                    </span>
                    <span>{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {!isOpen ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <h3 className="text-sm font-semibold text-destructive">Pendaftaran Saat Ini Ditutup</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Belum ada gelombang penerimaan murid baru yang aktif. Silakan hubungi panitia SPMB untuk
                informasi pembukaan gelombang berikutnya.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              noValidate
              className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-6"
            >
              {/* Anti-Spam Honeypot */}
              <input
                type="text"
                {...register("hp_tambahan")}
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* LANGKAH 1 */}
              <div className={cn("space-y-6", step !== 1 && "hidden")}>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Langkah 1: Data Calon Siswa</h3>
                  <p className="text-xs text-muted-foreground">Semua kolom wajib diisi (*).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Nama Lengkap Siswa"
                    htmlFor="student_name"
                    hint="Sesuai akta kelahiran"
                    error={errors.student_name?.message}
                    className="sm:col-span-2"
                  >
                    <input id="student_name" {...register("student_name")} placeholder="Contoh: Muhammad Azzam Al-Fath" className={inputClass} />
                  </Field>

                  <Field label="Nama Panggilan" htmlFor="nickname" error={errors.nickname?.message}>
                    <input id="nickname" {...register("nickname")} placeholder="Contoh: Azzam" className={inputClass} />
                  </Field>

                  <Field label="Jenis Kelamin" error={errors.gender?.message}>
                    <Select
                      value={gender ?? ""}
                      onValueChange={(v) => setValue("gender", v as "L" | "P", { shouldValidate: true })}
                    >
                      <SelectTrigger aria-label="Jenis Kelamin" className="w-full h-9 text-xs">
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Tempat Lahir" htmlFor="birth_place" error={errors.birth_place?.message}>
                    <input id="birth_place" {...register("birth_place")} placeholder="Contoh: Depok" className={inputClass} />
                  </Field>

                  <div className="space-y-1.5">
                    <DatePicker
                      label="Tanggal Lahir"
                      value={birthDate}
                      onChange={(val) => setValue("birth_date", val, { shouldValidate: true })}
                      helperText={`Usia ${MIN_STUDENT_AGE}–${MAX_STUDENT_AGE} tahun`}
                      error={errors.birth_date?.message}
                      required
                      startYear={currentYear - MAX_STUDENT_AGE - 1}
                      endYear={currentYear - MIN_STUDENT_AGE}
                      defaultMonth={`${currentYear - 6}-07-01`}
                      placeholder="Pilih tanggal lahir"
                    />
                  </div>

                  <Field
                    label="Jumlah Saudara Kandung"
                    hint="Tidak termasuk calon siswa"
                    error={errors.total_siblings?.message}
                  >
                    <Select value={siblingsChoice} onValueChange={handleSiblingsChange}>
                      <SelectTrigger aria-label="Jumlah Saudara Kandung" className="w-full h-9 text-xs">
                        <SelectValue placeholder="Pilih jumlah" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIBLING_OPTIONS.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                        <SelectItem value="lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                    {siblingsChoice === "lainnya" && (
                      <input
                        type="number"
                        min={0}
                        max={20}
                        inputMode="numeric"
                        aria-label="Jumlah saudara kandung lainnya"
                        placeholder="Tulis jumlah saudara kandung"
                        onChange={(e) =>
                          setValue("total_siblings", e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value), {
                            shouldValidate: true,
                          })
                        }
                        className={cn(inputClass, "mt-2 font-mono")}
                      />
                    )}
                  </Field>

                  <Field label="Anak Ke-" htmlFor="child_number" error={errors.child_number?.message}>
                    <input
                      id="child_number"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      {...register("child_number", { valueAsNumber: true })}
                      placeholder="Contoh: 1"
                      className={cn(inputClass, "font-mono")}
                    />
                  </Field>

                  <Field
                    label="No. WhatsApp/HP yang Dapat Dihubungi"
                    htmlFor="phone"
                    hint="Dipakai untuk konfirmasi panitia dan cek status pendaftaran"
                    error={errors.phone?.message}
                    className="sm:col-span-2"
                  >
                    <input id="phone" type="tel" inputMode="tel" {...register("phone")} placeholder="0812xxxxxxxx" className={cn(inputClass, "font-mono")} />
                  </Field>

                  <Field
                    label="Alamat Lengkap Siswa"
                    htmlFor="address"
                    error={errors.address?.message}
                    className="sm:col-span-2"
                  >
                    <textarea id="address" rows={2} {...register("address")} placeholder="Jalan, RT/RW, kelurahan, kecamatan" className={textareaClass} />
                  </Field>

                  <Field label="Hobi Siswa" htmlFor="hobby" error={errors.hobby?.message} className="sm:col-span-2">
                    <input id="hobby" {...register("hobby")} placeholder="Contoh: Membaca, sepak bola" className={inputClass} />
                  </Field>

                  <Field
                    label="Prestasi yang Pernah Diraih"
                    htmlFor="achievements"
                    hint='Isi "-" jika belum ada'
                    error={errors.achievements?.message}
                    className="sm:col-span-2"
                  >
                    <textarea id="achievements" rows={2} {...register("achievements")} placeholder="-" className={textareaClass} />
                  </Field>

                  <Field
                    label="Riwayat Penyakit Berat"
                    htmlFor="medical_history"
                    hint='Isi "-" jika tidak ada'
                    error={errors.medical_history?.message}
                    className="sm:col-span-2"
                  >
                    <textarea id="medical_history" rows={2} {...register("medical_history")} placeholder="-" className={textareaClass} />
                  </Field>
                </div>

                <div className="flex justify-end pt-4 border-t border-border/60">
                  <Button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold h-9 px-5 gap-1.5">
                    Lanjut ke Data Orang Tua
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* LANGKAH 2 */}
              <div className={cn("space-y-6", step !== 2 && "hidden")}>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Langkah 2: Data Orang Tua</h3>
                  <p className="text-xs text-muted-foreground">Semua kolom wajib diisi (*).</p>
                </div>

                <div className="space-y-4">
                  <SectionTitle>Data Ayah Kandung / Wali</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nama Lengkap Ayah" htmlFor="father_name" error={errors.father_name?.message} className="sm:col-span-2">
                      <input id="father_name" {...register("father_name")} placeholder="Contoh: Ahmad Fauzi" className={inputClass} />
                    </Field>
                    <Field label="Pendidikan Tertinggi Ayah" error={errors.father_education?.message}>
                      <Select
                        value={fatherEducation ?? ""}
                        onValueChange={(v) => setValue("father_education", v as PublicRegistrationInput["father_education"], { shouldValidate: true })}
                      >
                        <SelectTrigger aria-label="Pendidikan Tertinggi Ayah" className="w-full h-9 text-xs">
                          <SelectValue placeholder="Pilih pendidikan" />
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Pekerjaan Ayah" htmlFor="father_occupation" error={errors.father_occupation?.message}>
                      <input id="father_occupation" {...register("father_occupation")} placeholder="Contoh: Karyawan Swasta" className={inputClass} />
                    </Field>
                  </div>

                  <SectionTitle>Data Ibu Kandung</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nama Lengkap Ibu" htmlFor="mother_name" error={errors.mother_name?.message} className="sm:col-span-2">
                      <input id="mother_name" {...register("mother_name")} placeholder="Contoh: Siti Rahmah" className={inputClass} />
                    </Field>
                    <Field label="Pendidikan Tertinggi Ibu" error={errors.mother_education?.message}>
                      <Select
                        value={motherEducation ?? ""}
                        onValueChange={(v) => setValue("mother_education", v as PublicRegistrationInput["mother_education"], { shouldValidate: true })}
                      >
                        <SelectTrigger aria-label="Pendidikan Tertinggi Ibu" className="w-full h-9 text-xs">
                          <SelectValue placeholder="Pilih pendidikan" />
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Pekerjaan Ibu" htmlFor="mother_occupation" error={errors.mother_occupation?.message}>
                      <input id="mother_occupation" {...register("mother_occupation")} placeholder="Contoh: Ibu Rumah Tangga" className={inputClass} />
                    </Field>
                  </div>

                  <SectionTitle>Alamat Tempat Tinggal Orang Tua</SectionTitle>
                  <Field label="Alamat Lengkap Orang Tua" htmlFor="parent_address" error={errors.parent_address?.message}>
                    <textarea id="parent_address" rows={2} {...register("parent_address")} placeholder="Jalan, RT/RW, kelurahan, kecamatan" className={textareaClass} />
                  </Field>
                </div>

                <div className="flex justify-between pt-4 border-t border-border/60">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="text-xs h-9 px-4 gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali
                  </Button>
                  <Button type="button" onClick={() => goToStep(3)} className="text-xs font-semibold h-9 px-5 gap-1.5">
                    Lanjut ke Pembayaran
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* LANGKAH 3 */}
              <div className={cn("space-y-6", step !== 3 && "hidden")}>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Langkah 3: Pembayaran & Konfirmasi</h3>
                  <p className="text-xs text-muted-foreground">
                    Transfer biaya formulir, lalu unggah foto bukti transfer untuk menyelesaikan pendaftaran.
                  </p>
                </div>

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Landmark className="h-4 w-4 text-primary" />
                    Instruksi Transfer Biaya Formulir
                  </div>
                  {bankAccount ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                      <dt className="text-muted-foreground">Bank tujuan</dt>
                      <dd className="font-semibold text-foreground">{bankAccount.bank}</dd>
                      <dt className="text-muted-foreground">Nomor rekening</dt>
                      <dd className="font-mono font-bold text-foreground tracking-wider">{bankAccount.account_number}</dd>
                      <dt className="text-muted-foreground">Atas nama</dt>
                      <dd className="font-semibold text-foreground">{bankAccount.account_name}</dd>
                      <dt className="text-muted-foreground">Nominal</dt>
                      <dd className="font-mono font-bold text-primary">{formatRupiah(activeWave.registration_fee)}</dd>
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Informasi rekening belum diatur. Silakan hubungi panitia SPMB untuk instruksi pembayaran
                      sebesar <strong className="font-mono text-foreground">{formatRupiah(activeWave.registration_fee)}</strong>.
                    </p>
                  )}
                  {transferInstructions && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line border-t border-primary/20 pt-2">
                      {transferInstructions}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="proof-upload" className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      Unggah Foto Bukti Transfer <span className="text-destructive">*</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">JPG, PNG, atau PDF (maks 5 MB)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="proof-upload"
                    accept="image/jpeg,image/png,.pdf"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-medium truncate">{selectedFile.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={clearFile} className="text-xs h-7 text-destructive hover:text-destructive">
                        Ganti
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="proof-upload"
                      className={cn(
                        "cursor-pointer rounded-xl border border-dashed p-5 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-muted/30 transition-colors",
                        fileError ? "border-destructive" : "border-border"
                      )}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Upload className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-medium text-foreground">Klik untuk memilih foto bukti transfer</span>
                    </label>
                  )}
                  {fileError && <p className="text-xs text-destructive">{fileError}</p>}
                </div>

                <div className="flex justify-between pt-4 border-t border-border/60">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isSubmitting} className="text-xs h-9 px-4 gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="text-xs font-bold h-10 px-6 shadow-sm">
                    {isSubmitting ? "Memproses Data..." : "Kirim Formulir Pendaftaran"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Info pendukung */}
        <aside className="rounded-2xl border border-border/80 bg-card p-5 space-y-5 text-xs lg:sticky lg:top-24">
          <h3 className="text-sm font-bold text-foreground">Info Pendukung</h3>

          {activeWave && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Biaya formulir</p>
              <p className="text-muted-foreground leading-relaxed">
                <span className="font-mono font-bold text-foreground">{formatRupiah(activeWave.registration_fee)}</span>
                {bankAccount &&
                  `, transfer ke ${bankAccount.bank} a.n. ${bankAccount.account_name} (rek. ${bankAccount.account_number})`}
              </p>
            </div>
          )}

          {waves.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Jadwal gelombang</p>
              <ul className="space-y-1 text-muted-foreground">
                {waves.map((w) => (
                  <li key={w.id}>
                    Gelombang {w.wave_number}: {wavePeriod(w)}
                    {w.is_open && <span className="ml-1 font-semibold text-primary">(aktif)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Dokumen yang disiapkan</p>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <li key={doc}>{doc}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-foreground">Kontak panitia</p>
            <ul className="space-y-2">
              {SPMB_CONTACTS.map((c) => (
                <li key={c.phone}>
                  <a
                    href={waLink(c.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground truncate">{c.name}</span>
                      <span className="flex items-center gap-1 font-mono text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    </span>
                    <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
