// Tahsin Dasar & Lanjutan scoring logic

export interface TahsinPenaltyConfig {
  penalti_lahn_jali: number; // default -2 for Dasar
  penalti_lahn_khofi: number; // default -1 for Dasar
  bobot_kelancaran: number; // default 40 (%)
}

export const DEFAULT_TAHSIN_DASAR_CONFIG: TahsinPenaltyConfig = {
  penalti_lahn_jali: 2,
  penalti_lahn_khofi: 1,
  bobot_kelancaran: 40,
};

export const DEFAULT_TAHSIN_LANJUTAN_CONFIG: TahsinPenaltyConfig = {
  penalti_lahn_jali: 2,
  penalti_lahn_khofi: 1,
  bobot_kelancaran: 40,
};

export interface TahsinDasarEntry {
  nama_ebta: string;
  salah_huruf: number;
  salah_harakat: number;
  salah_makhraj: number;
  kesalahan_mad: number;
  kesalahan_ghunnah: number;
  kesalahan_tajwid: number;
  kesalahan_waqaf: number;
  kelancaran: number; // 60-100
}

export interface TahsinLanjutanEntry {
  surah: string;
  ayat: string;
  salah_huruf: number;
  salah_harakat: number;
  salah_makhraj: number;
  kesalahan_mad: number;
  kesalahan_ghunnah: number;
  kesalahan_tajwid: number;
  waqaf_ibtida: number;
  kelancaran: number; // 60-100
}

export interface WaqafSymbolTest {
  waqaf_lazim: boolean;
  waqaf_mustahab: boolean;
  waqaf_jaiz: boolean;
  waqaf_mujawwaz: boolean;
  waqaf_mamnu: boolean;
  washol_lazim: boolean;
}

export const WAQAF_SYMBOLS = [
  { key: 'waqaf_lazim', label: 'Waqaf Lazim (مـ)', desc: 'Wajib berhenti' },
  { key: 'waqaf_mustahab', label: 'Waqaf Mustahab (قلى)', desc: 'Lebih baik berhenti' },
  { key: 'waqaf_jaiz', label: 'Waqaf Jaiz (ج)', desc: 'Boleh berhenti atau lanjut' },
  { key: 'waqaf_mujawwaz', label: 'Waqaf Mujawwaz (صلى)', desc: 'Lebih baik lanjut' },
  { key: 'waqaf_mamnu', label: 'Waqaf Mamnu\' (لا)', desc: 'Tidak boleh berhenti' },
  { key: 'washol_lazim', label: 'Washol Lazim (∴)', desc: 'Wajib disambung' },
];

export const EBTA_ITEMS = [
  'EBTA 1',
  'EBTA 2',
  'EBTA 3',
  'EBTA 4',
  'EBTA 5',
  'Iqra 6 - Halaman Acak 1',
  'Iqra 6 - Halaman Acak 2',
];

export function createEmptyTahsinDasarEntry(nama: string): TahsinDasarEntry {
  return {
    nama_ebta: nama,
    salah_huruf: 0, salah_harakat: 0, salah_makhraj: 0,
    kesalahan_mad: 0, kesalahan_ghunnah: 0, kesalahan_tajwid: 0, kesalahan_waqaf: 0,
    kelancaran: 100,
  };
}

export function createEmptyTahsinLanjutanEntry(): TahsinLanjutanEntry {
  return {
    surah: '', ayat: '',
    salah_huruf: 0, salah_harakat: 0, salah_makhraj: 0,
    kesalahan_mad: 0, kesalahan_ghunnah: 0, kesalahan_tajwid: 0,
    waqaf_ibtida: 0,
    kelancaran: 100,
  };
}

export function createEmptyWaqafTest(): WaqafSymbolTest {
  return {
    waqaf_lazim: false, waqaf_mustahab: false, waqaf_jaiz: false,
    waqaf_mujawwaz: false, waqaf_mamnu: false, washol_lazim: false,
  };
}

export function isWaqafTestPassed(test: WaqafSymbolTest): boolean {
  return Object.values(test).every(v => v === true);
}

export function calculateNilaiTahsinDasar(entry: TahsinDasarEntry, config: TahsinPenaltyConfig): number {
  const totalLahnJali = entry.salah_huruf + entry.salah_harakat + entry.salah_makhraj;
  const totalLahnKhofi = entry.kesalahan_mad + entry.kesalahan_ghunnah + entry.kesalahan_tajwid + entry.kesalahan_waqaf;
  const bobotKoreksi = (100 - config.bobot_kelancaran) / 100;
  const bobotKelancaran = config.bobot_kelancaran / 100;
  const nilaiKoreksi = Math.max(0, 100 - (totalLahnJali * config.penalti_lahn_jali) - (totalLahnKhofi * config.penalti_lahn_khofi));
  const nilaiAkhir = (nilaiKoreksi * bobotKoreksi) + (entry.kelancaran * bobotKelancaran);
  return Math.round(Math.max(0, Math.min(100, nilaiAkhir)));
}

export function calculateNilaiTahsinLanjutan(entry: TahsinLanjutanEntry, config: TahsinPenaltyConfig, penaltiWaqaf: number = 2): number {
  const totalLahnJali = entry.salah_huruf + entry.salah_harakat + entry.salah_makhraj;
  const totalLahnKhofi = entry.kesalahan_mad + entry.kesalahan_ghunnah + entry.kesalahan_tajwid;
  const bobotKoreksi = (100 - config.bobot_kelancaran) / 100;
  const bobotKelancaran = config.bobot_kelancaran / 100;
  const nilaiKoreksi = Math.max(0, 100 - (totalLahnJali * config.penalti_lahn_jali) - (totalLahnKhofi * config.penalti_lahn_khofi) - (entry.waqaf_ibtida * penaltiWaqaf));
  const nilaiAkhir = (nilaiKoreksi * bobotKoreksi) + (entry.kelancaran * bobotKelancaran);
  return Math.round(Math.max(0, Math.min(100, nilaiAkhir)));
}

export function calculateTahsinDasarResult(entries: TahsinDasarEntry[], config: TahsinPenaltyConfig): {
  nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string; predikat: string;
} {
  if (entries.length === 0) return { nilaiAkhir: 0, status: 'Tidak Lulus', grade: 'D', predikat: 'Perlu Perbaikan' };
  const scores = entries.map(e => calculateNilaiTahsinDasar(e, config));
  const nilaiAkhir = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return getGrading(nilaiAkhir);
}

export function calculateTahsinLanjutanResult(entries: TahsinLanjutanEntry[], config: TahsinPenaltyConfig, penaltiWaqaf: number, waqafTest: WaqafSymbolTest): {
  nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string; predikat: string;
} {
  if (entries.length === 0) return { nilaiAkhir: 0, status: 'Tidak Lulus', grade: 'D', predikat: 'Perlu Perbaikan' };
  const scores = entries.map(e => calculateNilaiTahsinLanjutan(e, config, penaltiWaqaf));
  let nilaiAkhir = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  // Waqaf symbol test: if not all passed, cap grade
  if (!isWaqafTestPassed(waqafTest)) {
    nilaiAkhir = Math.min(nilaiAkhir, 69); // auto fail
  }
  return getGrading(nilaiAkhir);
}

function getGrading(nilaiAkhir: number): { nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string; predikat: string } {
  const status = nilaiAkhir >= 70 ? 'Lulus' : 'Tidak Lulus';
  let grade = 'D', predikat = 'Perlu Perbaikan';
  if (nilaiAkhir >= 90) { grade = 'A'; predikat = 'Mumtaz'; }
  else if (nilaiAkhir >= 80) { grade = 'B'; predikat = 'Jayyid Jiddan'; }
  else if (nilaiAkhir >= 70) { grade = 'C'; predikat = 'Jayyid'; }
  return { nilaiAkhir, status, grade, predikat };
}
