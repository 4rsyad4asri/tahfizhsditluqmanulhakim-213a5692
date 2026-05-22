/**
 * SISTEM UJIAN TAHFIZH - SERTIFIKAT & REGULER MODE
 * 
 * RUMUS SCORING TAHFIZH:
 * nilaiAkhir = kelancaran - (lahnJali × 2) - (lahnKhofi × 1) - (waqaf × 1) - (salahSambung × 2)
 * 
 * PERHITUNGAN:
 * 1. Hitung nilai setiap surat
 * 2. Group hasil berdasarkan Juz
 * 3. Hitung rata-rata per Juz (gunakan Math.round)
 * 4. Hitung final average dari juz averages
 * 5. JANGAN display per surah di laporan - HANYA per juz
 */

export interface TahfizhSurahAssessment {
  surah: string;
  juz: number;
  ayatAwal?: number;
  ayatAkhir?: number;
  kelancaran: number; // 60-100
  lahnJali: number; // jumlah kesalahan
  lahnKhofi: number; // jumlah kesalahan
  waqaf: number; // jumlah kesalahan
  salahSambung: number; // jumlah kesalahan
}

export interface TahfizhJuzResult {
  juz: number;
  surahs: TahfizhSurahAssessment[];
  nilaiPerSurah: number[];
  rataRataJuz: number; // Math.round
}

export interface TahfizhExamResult {
  mode: 'Sertifikat' | 'Reguler';
  nilaiPerJuz: TahfizhJuzResult[];
  nilaiAkhir: number; // Math.round
  rataRataAkhir: number; // dari rata-rata juz
  predikat: string;
  status: 'Lulus' | 'Tidak Lulus';
  grade: string;
}

export interface TahfizhPenaltyConfig {
  lahnJali: number; // default: 2
  lahnKhofi: number; // default: 1
  waqaf: number; // default: 1
  salahSambung: number; // default: 2
}

const DEFAULT_PENALTY: TahfizhPenaltyConfig = {
  lahnJali: 2,
  lahnKhofi: 1,
  waqaf: 1,
  salahSambung: 2,
};

/**
 * Hitung nilai satu surat menggunakan rumus:
 * nilaiSurah = kelancaran - (lahnJali × 2) - (lahnKhofi × 1) - (waqaf × 1) - (salahSambung × 2)
 */
export function calculateTahfizhSurahScore(
  assessment: TahfizhSurahAssessment,
  config: TahfizhPenaltyConfig = DEFAULT_PENALTY
): number {
  const nilai =
    assessment.kelancaran -
    assessment.lahnJali * config.lahnJali -
    assessment.lahnKhofi * config.lahnKhofi -
    assessment.waqaf * config.waqaf -
    assessment.salahSambung * config.salahSambung;

  return Math.round(Math.max(0, Math.min(100, nilai)));
}

/**
 * Kelompokkan surat berdasarkan Juz
 */
function groupByJuz(assessments: TahfizhSurahAssessment[]): Map<number, TahfizhSurahAssessment[]> {
  const grouped = new Map<number, TahfizhSurahAssessment[]>();

  assessments.forEach(assessment => {
    if (!grouped.has(assessment.juz)) {
      grouped.set(assessment.juz, []);
    }
    grouped.get(assessment.juz)!.push(assessment);
  });

  // Sort by juz number
  const sortedGrouped = new Map([...grouped.entries()].sort());
  return sortedGrouped;
}

/**
 * Hitung nilai per Juz (rata-rata dari surat-surat dalam juz)
 */
function calculateJuzResults(
  grouped: Map<number, TahfizhSurahAssessment[]>,
  config: TahfizhPenaltyConfig
): TahfizhJuzResult[] {
  const results: TahfizhJuzResult[] = [];

  grouped.forEach((surahs, juz) => {
    const nilaiPerSurah = surahs.map(surah =>
      calculateTahfizhSurahScore(surah, config)
    );

    // Rata-rata per Juz (gunakan Math.round)
    const rataRataJuz = Math.round(
      nilaiPerSurah.reduce((a, b) => a + b, 0) / nilaiPerSurah.length
    );

    results.push({
      juz,
      surahs,
      nilaiPerSurah,
      rataRataJuz,
    });
  });

  return results;
}

/**
 * Tentukan predikat dan grade berdasarkan nilai
 */
function getPredikatAndGrade(nilai: number): { predikat: string; grade: string; status: 'Lulus' | 'Tidak Lulus' } {
  // Standar: Lulus jika >= 85
  if (nilai >= 90) {
    return { predikat: 'Mumtaz', grade: 'A', status: 'Lulus' };
  }
  if (nilai >= 80) {
    return { predikat: 'Jayyid Jiddan', grade: 'B', status: 'Lulus' };
  }
  if (nilai >= 70) {
    return { predikat: 'Jayyid', grade: 'C', status: 'Tidak Lulus' };
  }
  return { predikat: 'Perlu Perbaikan', grade: 'D', status: 'Tidak Lulus' };
}

/**
 * Hitung hasil ujian Tahfizh (Sertifikat atau Reguler)
 * 
 * PENTING: 
 * - Group by Juz terlebih dahulu
 * - Hitung rata-rata per Juz
 * - Hitung final dari rata-rata juz (bukan dari surah individual)
 * - Gunakan Math.round untuk semua hasil
 */
export function calculateTahfizhExamResult(
  assessments: TahfizhSurahAssessment[],
  mode: 'Sertifikat' | 'Reguler' = 'Reguler',
  config: TahfizhPenaltyConfig = DEFAULT_PENALTY
): TahfizhExamResult {
  if (assessments.length === 0) {
    return {
      mode,
      nilaiPerJuz: [],
      nilaiAkhir: 0,
      rataRataAkhir: 0,
      predikat: 'Perlu Perbaikan',
      status: 'Tidak Lulus',
      grade: 'D',
    };
  }

  // Step 1: Group by Juz
  const grouped = groupByJuz(assessments);

  // Step 2: Calculate per-juz results
  const nilaiPerJuz = calculateJuzResults(grouped, config);

  // Step 3: Calculate final average from juz averages (NOT from individual surahs)
  const juzAverages = nilaiPerJuz.map(j => j.rataRataJuz);
  const rataRataAkhir = Math.round(
    juzAverages.reduce((a, b) => a + b, 0) / juzAverages.length
  );

  // Step 4: Determine predikat and status
  const { predikat, grade, status } = getPredikatAndGrade(rataRataAkhir);

  return {
    mode,
    nilaiPerJuz,
    nilaiAkhir: rataRataAkhir, // Gunakan rata-rata dari juz averages
    rataRataAkhir,
    predikat,
    status,
    grade,
  };
}

/**
 * Convert old TahfizhSurahEntry format to new format
 */
export function convertToTahfizhAssessment(
  entry: any
): TahfizhSurahAssessment {
  return {
    surah: entry.surah,
    juz: entry.juz,
    kelancaran: entry.kelancaran,
    lahnJali: entry.lahn_jali,
    lahnKhofi: entry.lahn_khofi,
    waqaf: entry.waqaf_ibtida || 0,
    salahSambung: entry.salah_sambung_ayat || 0,
  };
}

/**
 * Helper: Generate report yang HANYA menampilkan rata-rata per Juz
 * (BUKAN detail per surah)
 */
export function generateTahfizhReport(result: TahfizhExamResult): string {
  let report = `LAPORAN UJIAN TAHFIZH - MODE ${result.mode}\n`;
  report += `${'='.repeat(50)}\n\n`;

  report += `NILAI PER JUZ:\n`;
  report += `${'-'.repeat(50)}\n`;
  result.nilaiPerJuz.forEach(juzResult => {
    report += `Juz ${juzResult.juz.toString().padStart(2, '0')} → ${juzResult.rataRataJuz}\n`;
  });
  report += `${'-'.repeat(50)}\n\n`;

  report += `RINGKASAN:\n`;
  report += `Rata-rata Akhir     → ${result.rataRataAkhir}\n`;
  report += `Predikat            → ${result.predikat}\n`;
  report += `Grade               → ${result.grade}\n`;
  report += `Status              → ${result.status}\n`;

  return report;
}

/**
 * Validasi assessment data
 */
export function validateTahfizhAssessment(
  assessment: TahfizhSurahAssessment
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (assessment.kelancaran < 0 || assessment.kelancaran > 100) {
    errors.push('Kelancaran harus antara 0-100');
  }

  if (assessment.lahnJali < 0) {
    errors.push('Lahn Jali tidak boleh negatif');
  }

  if (assessment.lahnKhofi < 0) {
    errors.push('Lahn Khofi tidak boleh negatif');
  }

  if (assessment.waqaf < 0) {
    errors.push('Waqaf tidak boleh negatif');
  }

  if (assessment.salahSambung < 0) {
    errors.push('Salah Sambung tidak boleh negatif');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
