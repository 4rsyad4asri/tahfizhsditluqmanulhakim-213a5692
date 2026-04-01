export interface Student {
  id: string;
  name: string;
  class: string;
  targetJuz: number;
  level: 'Tahsin Dasar' | 'Tahsin Lanjutan' | 'Tahfizh';
  progressHafalan: number;
  statusSertifikasi: 'Belum Ujian' | 'Lulus' | 'Tidak Lulus';
  setoran: Setoran[];
  ujian: Ujian[];
  catatanPenguji: string;
}

export interface Setoran {
  id: string;
  tanggal: string;
  juz: number;
  surah: string;
  ayatMulai: number;
  ayatAkhir: number;
  nilai: number;
  koreksi: Koreksi;
}

export interface Koreksi {
  kesalahanMakhraj: number;
  kesalahanTajwid: number;
  kesalahanMad: number;
  kelancaran: number; // 1-10
}

export interface Ujian {
  id: string;
  tanggal: string;
  mode: 'Tahsin' | 'Tahfizh';
  nilaiAspek: Record<string, number>;
  nilaiAkhir: number;
  status: 'Lulus' | 'Tidak Lulus';
  grade: string;
}

export interface ClassInfo {
  name: string;
  grade: number;
  section: string;
  students: Student[];
}

export const SURAH_LIST: { name: string; juz: number; ayatCount: number }[] = [
  { name: "Al-Fatihah", juz: 1, ayatCount: 7 },
  { name: "Al-Baqarah", juz: 1, ayatCount: 286 },
  { name: "Ali 'Imran", juz: 3, ayatCount: 200 },
  { name: "An-Nisa'", juz: 4, ayatCount: 176 },
  { name: "Al-Ma'idah", juz: 6, ayatCount: 120 },
  { name: "Al-An'am", juz: 7, ayatCount: 165 },
  { name: "Al-A'raf", juz: 8, ayatCount: 206 },
  { name: "Al-Anfal", juz: 9, ayatCount: 75 },
  { name: "At-Taubah", juz: 10, ayatCount: 129 },
  { name: "Yunus", juz: 11, ayatCount: 109 },
  { name: "An-Nas", juz: 30, ayatCount: 6 },
  { name: "Al-Falaq", juz: 30, ayatCount: 5 },
  { name: "Al-Ikhlas", juz: 30, ayatCount: 4 },
  { name: "Al-Lahab", juz: 30, ayatCount: 5 },
  { name: "An-Nasr", juz: 30, ayatCount: 3 },
  { name: "Al-Kafirun", juz: 30, ayatCount: 6 },
  { name: "Al-Kautsar", juz: 30, ayatCount: 3 },
  { name: "Al-Ma'un", juz: 30, ayatCount: 7 },
  { name: "Quraisy", juz: 30, ayatCount: 4 },
  { name: "Al-Fil", juz: 30, ayatCount: 5 },
  { name: "Al-Humazah", juz: 30, ayatCount: 9 },
  { name: "Al-'Asr", juz: 30, ayatCount: 3 },
  { name: "At-Takatsur", juz: 30, ayatCount: 8 },
  { name: "Al-Qari'ah", juz: 30, ayatCount: 11 },
  { name: "Al-'Adiyat", juz: 30, ayatCount: 11 },
  { name: "Az-Zalzalah", juz: 30, ayatCount: 8 },
  { name: "Al-Bayyinah", juz: 30, ayatCount: 8 },
  { name: "Al-Qadr", juz: 30, ayatCount: 5 },
  { name: "Al-'Alaq", juz: 30, ayatCount: 19 },
  { name: "At-Tin", juz: 30, ayatCount: 8 },
  { name: "Al-Insyirah", juz: 30, ayatCount: 8 },
  { name: "Ad-Dhuha", juz: 30, ayatCount: 11 },
];

const NAMES = [
  "Ahmad Fauzan", "Muhammad Rizki", "Aisyah Putri", "Fatimah Azzahra", "Umar Abdullah",
  "Khadijah Sari", "Ibrahim Hasan", "Zainab Rahmah", "Yusuf Hakim", "Maryam Salwa",
  "Ali Akbar", "Hafsa Nabila", "Bilal Rahman", "Safiya Nur", "Hamza Fadhil",
  "Ruqayyah Amira", "Idris Mahdi", "Layla Zahra", "Khalid Aiman", "Sumayya Hana",
];

const LEVELS: Student['level'][] = ['Tahsin Dasar', 'Tahsin Lanjutan', 'Tahfizh'];
const STATUS: Student['statusSertifikasi'][] = ['Belum Ujian', 'Lulus', 'Tidak Lulus'];

function generateStudent(id: number, className: string): Student {
  const name = NAMES[id % NAMES.length];
  const level = LEVELS[Math.floor(Math.random() * 3)];
  const progress = Math.floor(Math.random() * 100);
  const status = STATUS[Math.floor(Math.random() * 3)];
  const targetJuz = Math.floor(Math.random() * 3) + (className.startsWith('1') ? 30 : className.startsWith('6') ? 1 : 28);
  
  return {
    id: `student-${className}-${id}`,
    name: `${name}`,
    class: className,
    targetJuz: Math.min(targetJuz, 30),
    level,
    progressHafalan: progress,
    statusSertifikasi: status,
    setoran: [
      {
        id: `setoran-${id}-1`,
        tanggal: '2025-02-20',
        juz: 30,
        surah: 'An-Nas',
        ayatMulai: 1,
        ayatAkhir: 6,
        nilai: 85,
        koreksi: { kesalahanMakhraj: 1, kesalahanTajwid: 2, kesalahanMad: 0, kelancaran: 8 },
      },
    ],
    ujian: [],
    catatanPenguji: '',
  };
}

const SECTIONS = ['A', 'B', 'C', 'D'];

export function generateMockData(): ClassInfo[] {
  const classes: ClassInfo[] = [];
  let studentId = 0;

  for (let grade = 1; grade <= 6; grade++) {
    for (const section of SECTIONS) {
      const className = `${grade}${section}`;
      const numStudents = 15 + Math.floor(Math.random() * 10);
      const students: Student[] = [];
      
      for (let i = 0; i < numStudents; i++) {
        students.push(generateStudent(studentId++, className));
      }

      classes.push({
        name: `Kelas ${grade}${section}`,
        grade,
        section,
        students,
      });
    }
  }

  return classes;
}

export function calculateNilaiSetoran(koreksi: Koreksi): number {
  const base = 100;
  const penguranganMakhraj = koreksi.kesalahanMakhraj * 3;
  const penguranganTajwid = koreksi.kesalahanTajwid * 2;
  const penguranganMad = koreksi.kesalahanMad * 2;
  const nilaiKelancaran = (koreksi.kelancaran / 10) * 20;
  const nilai = base - penguranganMakhraj - penguranganTajwid - penguranganMad - (20 - nilaiKelancaran);
  return Math.max(0, Math.min(100, Math.round(nilai)));
}

export interface TahfizhSurahEntry {
  surah: string;
  juz: number;
  lahn_jali: number;
  lahn_khofi: number;
  kelancaran: number; // 100, 90, 80, 70, 60
  waqaf_ibtida: number; // 100, 90, 80, 70, 60
}

export function calculateNilaiSurah(entry: TahfizhSurahEntry): number {
  const nilaiKoreksi = Math.max(0, 100 - (entry.lahn_jali * 4) - (entry.lahn_khofi * 2));
  const waqafScore = entry.waqaf_ibtida ?? 100;
  const nilaiAkhir = (nilaiKoreksi * 0.4) + (entry.kelancaran * 0.4) + (waqafScore * 0.2);
  return Math.round(Math.max(0, Math.min(100, nilaiAkhir)));
}

export function calculateNilaiTahfizh(entries: TahfizhSurahEntry[]): { nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string; predikat: string } {
  if (entries.length === 0) return { nilaiAkhir: 0, status: 'Tidak Lulus', grade: 'D', predikat: 'Perlu Perbaikan' };
  const nilaiPerSurah = entries.map(calculateNilaiSurah);
  const nilaiAkhir = Math.round(nilaiPerSurah.reduce((a, b) => a + b, 0) / nilaiPerSurah.length);
  const status = nilaiAkhir >= 85 ? 'Lulus' : 'Tidak Lulus';
  let grade = 'D';
  let predikat = 'Perlu Perbaikan';
  if (nilaiAkhir >= 90) { grade = 'A'; predikat = 'Mumtaz'; }
  else if (nilaiAkhir >= 80) { grade = 'B'; predikat = 'Jiddan Jayyid'; }
  else if (nilaiAkhir >= 70) { grade = 'C'; predikat = 'Jayyid'; }
  return { nilaiAkhir, status, grade, predikat };
}

export function calculateNilaiUjian(nilaiAspek: Record<string, number>): { nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string } {
  const values = Object.values(nilaiAspek);
  const nilaiAkhir = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const status = nilaiAkhir >= 70 ? 'Lulus' : 'Tidak Lulus';
  let grade = 'D';
  if (nilaiAkhir >= 90) grade = 'A';
  else if (nilaiAkhir >= 80) grade = 'B';
  else if (nilaiAkhir >= 70) grade = 'C';
  return { nilaiAkhir, status, grade };
}
