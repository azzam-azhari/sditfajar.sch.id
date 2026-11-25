/**
 * FAQ publik — dipakai bersama oleh UI (Beranda, Pendaftaran) dan schema FAQPage Google.
 * Jawaban hanya memuat fakta yang sudah ada di situs. Item bertanda TODO perlu dilengkapi pihak sekolah.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_UMUM: FaqItem[] = [
  {
    q: "Di mana lokasi SDIT Fajar?",
    a: "SDIT Fajar berlokasi di Jl. Jati III No.04 RT 07/07, Jatijajar, Kec. Tapos, Kota Depok, Jawa Barat 16466. Lokasi dapat dibuka langsung melalui Google Maps di halaman Kontak.",
  },
  {
    q: "Apakah SDIT Fajar sekolah tahfidz?",
    a: "Ya. SDIT Fajar adalah Sekolah Dasar Islam Terpadu dengan program tahfidz Al-Qur'an terstruktur, target hafalan minimal 3 juz selama 6 tahun, melalui bimbingan talaqqi setiap pagi pukul 07.00–08.30 dengan rasio halaqah 1 guru untuk 12 murid.",
  },
  {
    q: "Kurikulum apa yang digunakan SDIT Fajar?",
    a: "SDIT Fajar memadukan Kurikulum Merdeka nasional dengan kurikulum khas sekolah Islam terpadu: tahfidz dan tahsin Al-Qur'an, pembiasaan adab, serta pendidikan karakter Islami.",
  },
  {
    q: "Berapa kuota penerimaan murid baru setiap tahunnya?",
    a: "SDIT Fajar membatasi kuota 100 murid baru setiap tahun ajaran (4 rombel, masing-masing 25 murid) demi menjaga efektivitas pembelajaran talaqqi dan pendampingan personal guru.",
  },
  {
    q: "Ekstrakurikuler apa saja yang tersedia di SDIT Fajar?",
    a: "Tersedia Pramuka SIT, Panahan, Robotik & Koding Dasar, Futsal, Khat & Kaligrafi Al-Qur'an, Dokter Kecil (UKS), serta English & Arabic Young Club, dijadwalkan Senin–Sabtu di luar jam pelajaran.",
  },
  {
    q: "Apakah SDIT Fajar sudah terakreditasi?",
    a: "Ya, SDIT Fajar terakreditasi A dengan NPSN 10814529.",
  },
  {
    q: "Bagaimana alur pembayaran SPP dan biaya pendidikan?",
    a: "Seluruh tagihan SPP dan daftar ulang dikelola transparan melalui portal resmi orang tua. Orang tua membayar lewat transfer bank lalu mengunggah bukti, atau tunai di sekolah, dan kuitansi resmi terbit setelah diverifikasi petugas keuangan.",
  },
  // TODO: tambahkan bila datanya sudah pasti — jam pulang sekolah (full day?), layanan antar-jemput, rincian biaya SPP.
];

export const FAQ_SPMB: FaqItem[] = [
  {
    q: "Bagaimana cara mendaftar di SDIT Fajar?",
    a: "Pendaftaran murid baru (SPMB) dilakukan secara online di sditfajar.sch.id/spmb: pilih gelombang pendaftaran yang dibuka, isi formulir data calon murid dan orang tua, lalu simpan nomor pendaftaran yang diberikan.",
  },
  {
    q: "Kapan pendaftaran SPMB SDIT Fajar dibuka?",
    a: "Jadwal setiap gelombang pendaftaran beserta biaya pendaftarannya ditampilkan langsung di halaman Pendaftaran SDIT Fajar. Kuota terbatas 100 murid per tahun, sehingga disarankan mendaftar di gelombang awal.",
  },
  {
    q: "Berapa biaya pendaftaran di SDIT Fajar?",
    a: "Besaran infaq pendaftaran berbeda untuk setiap gelombang dan tercantum pada kartu gelombang di halaman Pendaftaran.",
  },
  {
    q: "Apakah calon siswa harus sudah hafal huruf hijaiyah saat mendaftar?",
    a: "Tidak wajib. Tim guru melakukan tes pemetaan kesiapan belajar dan penempatan kelas tahsin yang ramah anak saat observasi, sehingga murid dibimbing bertahap dari tingkat dasar.",
  },
  {
    q: "Bagaimana cara cek status pendaftaran?",
    a: "Status pendaftaran dapat dicek kapan saja di halaman sditfajar.sch.id/spmb/status menggunakan nomor pendaftaran dan nomor WhatsApp orang tua yang didaftarkan.",
  },
  // TODO: tambahkan syarat usia masuk kelas 1 dan dokumen yang diperlukan bila sudah ditetapkan sekolah.
];
