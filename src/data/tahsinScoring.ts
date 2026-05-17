// Tahsin Dasar & Lanjutan scoring logic

export type RumusVersion = "baru" | "lama";

export const RUMUS_OPTIONS: {
  value: RumusVersion;
  label: string;
  desc: string;
}[] = [
  {
    value: "baru",
    label: "Rumus Baru (Direkomendasikan)",
    desc: "Nilai = Kelancaran - ΣPenalty (langsung)",
  },
  {
    value: "lama",
    label: "Rumus Lama (Bobot 60/40)",
    desc: "Nilai = (Koreksi × bobot) + (Kelancaran × bobot)",
  },
];

export interface TahsinPenaltyConfig {
  penalti_lahn_jali: number;
  penalti_lahn_khofi: number;
  bobot_kelancaran: number;
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
  salah_tasydid: number;
  kesalahan_mad: number;
  kesalahan_qalqalah: number;
  kesalahan_tajwid: number;
  kesalahan_waqaf: number;
  kelancaran: number;
}

export interface TahsinLanjutanEntry {
  surah: string;
  ayat: string;
  salah_huruf: number;
  salah_harakat: number;
  salah_tasydid: number;
  kesalahan_mad: number;
  kesalahan_qalqalah: number;
  kesalahan_tajwid: number;
  waqaf_ibtida: number;
  kelancaran: number;
}

export interface WaqafSymbolTest {
  waqaf_lazim: boolean;
  waqaf_mustahab: boolean;
  waqaf_jaiz: boolean;
  waqaf_mujawwaz: boolean;
  waqaf_mamnu: boolean;
  waqaf_muanaqah: boolean;
}

export const WAQAF_SYMBOLS = [
  { key: "waqaf_lazim", label: "Waqaf Lazim (مـ)", desc: "Wajib berhenti" },
  { key: "waqaf_mustahab", label: "Waqaf Mustahab (قلى)", desc: "Lebih baik berhenti" },
  { key: "waqaf_jaiz", label: "Waqaf Jaiz (ج)", desc: "Boleh berhenti atau lanjut" },
  { key: "waqaf_mujawwaz", label: "Waqaf Mujawwaz (صلى)", desc: "Lebih baik lanjut" },
  { key: "waqaf_mamnu", label: "Waqaf Mamnu' (لا)", desc: "Tidak boleh berhenti" },
  { key: "waqaf_muanaqah", label: "Waqaf Muanaqah (∴)", desc: "Berhenti di salah satu tanda" },
];

export const EBTA_ITEMS = [
  "EBTA 1",
  "EBTA 2",
  "EBTA 3",
  "EBTA 4",
  "EBTA 5",
  "Iqra 6 - Halaman Acak 1",
  "Iqra 6 - Halaman Acak 2",
];

function numberOrZero(value: unknown): number {
  return Number(value || 0);
}

function getSalahTasydid(entry: any): number {
  return Number(entry.salah_tasydid ?? entry.salah_makhraj ?? 0);
}

function getKesalahanQalqalah(entry: any): number {
  return Number(entry.kesalahan_qalqalah ?? entry.kesalahan_ghunnah ?? 0);
}

export function createEmptyTahsinDasarEntry(
  nama: string
): TahsinDasarEntry {
  return {
    nama_ebta: nama,
    salah_huruf: 0,
    salah_harakat: 0,
    salah_tasydid: 0,
    kesalahan_mad: 0,
    kesalahan_qalqalah: 0,
    kesalahan_tajwid: 0,
    kesalahan_waqaf: 0,
    kelancaran: 90,
  };
}

export function createEmptyTahsinLanjutanEntry(): TahsinLanjutanEntry {
  return {
    surah: "",
    ayat: "",
    salah_huruf: 0,
    salah_harakat: 0,
    salah_tasydid: 0,
    kesalahan_mad: 0,
    kesalahan_qalqalah: 0,
    kesalahan_tajwid: 0,
    waqaf_ibtida: 0,
    kelancaran: 90,
  };
}

export function createEmptyWaqafTest(): WaqafSymbolTest {
  return {
    waqaf_lazim: false,
    waqaf_mustahab: false,
    waqaf_jaiz: false,
    waqaf_mujawwaz: false,
    waqaf_mamnu: false,
    waqaf_muanaqah: false,
  };
}

export function isWaqafTestPassed(
  test?: WaqafSymbolTest | null
): boolean {

  if (!test) return false;

  const benar =
    Object.values(test)
      .filter(Boolean)
      .length;

  return benar >= 3;
}

export function calculateNilaiTahsinDasar(
  entry: TahsinDasarEntry,
  config: TahsinPenaltyConfig,
  rumus: RumusVersion = "baru"
): number {
  const totalLahnJali =
    numberOrZero(entry.salah_huruf) +
    numberOrZero(entry.salah_harakat) +
    getSalahTasydid(entry);

  const totalLahnKhofi =
    numberOrZero(entry.kesalahan_mad) +
    getKesalahanQalqalah(entry) +
    numberOrZero(entry.kesalahan_tajwid) +
    numberOrZero(entry.kesalahan_waqaf);

  const kelancaran = numberOrZero(entry.kelancaran);
  const penaltiLahnJali = numberOrZero(config.penalti_lahn_jali);
  const penaltiLahnKhofi = numberOrZero(config.penalti_lahn_khofi);
  const bobotKelancaranConfig = numberOrZero(config.bobot_kelancaran);

  if (rumus === "baru") {
    const nilai =
      kelancaran -
      totalLahnJali * penaltiLahnJali -
      totalLahnKhofi * penaltiLahnKhofi;

    return Math.round(Math.max(0, Math.min(100, nilai)));
  }

  const bobotKoreksi = (100 - bobotKelancaranConfig) / 100;
  const bobotKelancaran = bobotKelancaranConfig / 100;

  const nilaiKoreksi = Math.max(
    0,
    100 -
      totalLahnJali * penaltiLahnJali -
      totalLahnKhofi * penaltiLahnKhofi
  );

  const nilaiAkhir =
    nilaiKoreksi * bobotKoreksi + kelancaran * bobotKelancaran;

  return Math.round(Math.max(0, Math.min(100, nilaiAkhir)));
}

export function calculateNilaiTahsinLanjutan(
  entry: TahsinLanjutanEntry,
  config: TahsinPenaltyConfig,
  penaltiWaqaf: number = 2,
  rumus: RumusVersion = "baru"
): number {
  const totalLahnJali =
    numberOrZero(entry.salah_huruf) +
    numberOrZero(entry.salah_harakat) +
    getSalahTasydid(entry);

  const totalLahnKhofi =
    numberOrZero(entry.kesalahan_mad) +
    getKesalahanQalqalah(entry) +
    numberOrZero(entry.kesalahan_tajwid);

  const kelancaran = numberOrZero(entry.kelancaran);
  const waqaf = numberOrZero(entry.waqaf_ibtida);
  const penaltiLahnJali = numberOrZero(config.penalti_lahn_jali);
  const penaltiLahnKhofi = numberOrZero(config.penalti_lahn_khofi);
  const penaltiWaqafAman = numberOrZero(penaltiWaqaf);
  const bobotKelancaranConfig = numberOrZero(config.bobot_kelancaran);

  if (rumus === "baru") {
    const nilai =
      kelancaran -
      totalLahnJali * penaltiLahnJali -
      totalLahnKhofi * penaltiLahnKhofi -
      waqaf * penaltiWaqafAman;

    return Math.round(Math.max(0, Math.min(100, nilai)));
  }

  const bobotKoreksi = (100 - bobotKelancaranConfig) / 100;
  const bobotKelancaran = bobotKelancaranConfig / 100;

  const nilaiKoreksi = Math.max(
    0,
    100 -
      totalLahnJali * penaltiLahnJali -
      totalLahnKhofi * penaltiLahnKhofi -
      waqaf * penaltiWaqafAman
  );

  const nilaiAkhir =
    nilaiKoreksi * bobotKoreksi + kelancaran * bobotKelancaran;

  return Math.round(Math.max(0, Math.min(100, nilaiAkhir)));
}

export function calculateTahsinDasarResult(
  entries: TahsinDasarEntry[],
  config: TahsinPenaltyConfig,
  rumus: RumusVersion = "baru"
): {
  nilaiAkhir: number;
  status: "Lulus" | "Tidak Lulus";
  grade: string;
  predikat: string;
} {
  if (entries.length === 0) {
    return {
      nilaiAkhir: 0,
      status: "Tidak Lulus",
      grade: "D",
      predikat: "Perlu Perbaikan",
    };
  }

  const scores = entries.map((e) =>
    calculateNilaiTahsinDasar(e, config, rumus)
  );

  const nilaiAkhir = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length
  );

  return getGrading(nilaiAkhir);
}

export function calculateTahsinLanjutanResult(
  entries: TahsinLanjutanEntry[],
  config: TahsinPenaltyConfig,
  penaltiWaqaf: number,
  waqafTest: WaqafSymbolTest,
  rumus: RumusVersion = "baru"
): {
  nilaiAkhir: number;
  status: "Lulus" | "Tidak Lulus";
  grade: string;
  predikat: string;
} {
  if (entries.length === 0) {
    return {
      nilaiAkhir: 0,
      status: "Tidak Lulus",
      grade: "D",
      predikat: "Perlu Perbaikan",
    };
  }

  const scores = entries.map((e) =>
    calculateNilaiTahsinLanjutan(e, config, penaltiWaqaf, rumus)
  );

  let nilaiAkhir = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length
  );

  if (!isWaqafTestPassed(waqafTest)) {
    nilaiAkhir = Math.min(nilaiAkhir, 70);
  }

  return getGrading(nilaiAkhir);
}

function getGrading(nilaiAkhir: number): {
  nilaiAkhir: number;
  status: "Lulus" | "Tidak Lulus";
  grade: string;
  predikat: string;
} {
  const status = nilaiAkhir >= 70 ? "Lulus" : "Tidak Lulus";

  let grade = "D";
  let predikat = "Perlu Perbaikan";

  if (nilaiAkhir >= 90) {
    grade = "A";
    predikat = "Mumtaz";
  } else if (nilaiAkhir >= 80) {
    grade = "B";
    predikat = "Jayyid Jiddan";
  } else if (nilaiAkhir >= 70) {
    grade = "C";
    predikat = "Jayyid";
  }

  return {
    nilaiAkhir,
    status,
    grade,
    predikat,
  };
}