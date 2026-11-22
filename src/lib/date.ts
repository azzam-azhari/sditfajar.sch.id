/** Zona waktu resmi sekolah. Semua aturan jam presensi memakai jam server di zona ini. */
export const SCHOOL_TIME_ZONE = 'Asia/Jakarta';

const pad = (value: number) => String(value).padStart(2, '0');

function jakartaParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    isoDow: weekdayIndex, // 1 = Senin ... 7 = Minggu
  };
}

/** Tanggal hari ini di Asia/Jakarta dalam format YYYY-MM-DD. */
export function jakartaToday(date: Date = new Date()): string {
  const p = jakartaParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Hari ISO (1 = Senin ... 7 = Minggu) di Asia/Jakarta. */
export function jakartaIsoDow(date: Date = new Date()): number {
  return jakartaParts(date).isoDow;
}

/** Bulan aktif (YYYY-MM) di Asia/Jakarta. */
export function jakartaMonth(date: Date = new Date()): string {
  const p = jakartaParts(date);
  return `${p.year}-${pad(p.month)}`;
}

/** Rentang tanggal [awal, akhir] untuk bulan YYYY-MM. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { start: `${year}-${pad(mon)}-01`, end: `${year}-${pad(mon)}-${pad(lastDay)}` };
}

export const DAY_LABELS: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

/** "08:00:00" -> "08.00" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '-';
  return time.slice(0, 5).replace(':', '.');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: SCHOOL_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: SCHOOL_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value));
}
