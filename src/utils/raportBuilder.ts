import { generateCatatanOtomatisFromUjian } from "@/utils/catatanOtomatis";
import { aggregateTahfizhAssessmentsForDisplay } from "@/data/tahfizhSystem";
import { getStandardExamGrading } from "@/data/grading";
import { buildVerificationUrlForExam, inferTahfizhModeForExam } from "@/utils/verificationUrl";
import type {
  RaportData,
  RaportHeader,
  RaportAssets,
  RaportPdfOptions,
} from "@/utils/raportPdf";
import type { TahfizhSurahEntry } from "@/data/mockData";
import type {
  TahsinDasarEntry,
  TahsinLanjutanEntry,
  TahsinPenaltyConfig,
  WaqafSymbolTest,
} from "@/data/tahsinScoring";

const STORAGE_KEY = "raport_settings_v3";

export const DEFAULT_HEADER: RaportHeader = {
  schoolName: "SDIT Luqmanul Hakim",
  programName: "Program Tahfizh & Tahsin Al-Qur'an",
  address:
    "Jl. Jati No.4, Tj. Selamat, Kec. Sunggal, Kabupaten Deli Serdang, Sumatera Utara 20351",
  headmaster: "Amrullah Rozy Dalimunthe, S.Si",
  headmasterTitle: "Kepala Sekolah",
  nip: "-",
  city: "Sunggal",
  examinerTitle: "Guru Tahfizh",
};

export const DEFAULT_OPTS: RaportPdfOptions = {
  orientation: "landscape",
  fontSize: 9,
  tableFontSize: 8,
  showWatermark: false,
  showQR: true,
};

export interface RaportSettings {
  header: RaportHeader;
  assets: RaportAssets;
  opts: RaportPdfOptions;
}

export function loadRaportSettings(): RaportSettings {
  let header = { ...DEFAULT_HEADER };
  let assets: RaportAssets = {};
  let opts = { ...DEFAULT_OPTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.header) header = { ...header, ...p.header };
      if (p.assets) assets = p.assets;
      if (p.opts) opts = { ...opts, ...p.opts };
    }
  } catch {}
  return { header, assets, opts };
}

function getSalahTasydid(entry: any) {
  return Number(entry.salah_tasydid ?? entry.salah_makhraj ?? 0);
}
function getKesalahanQalqalah(entry: any) {
  return Number(entry.kesalahan_qalqalah ?? entry.kesalahan_ghunnah ?? 0);
}
function normalizeTahsinEntry<T extends Record<string, any>>(entry: T): T {
  return {
    ...entry,
    salah_tasydid: getSalahTasydid(entry),
    kesalahan_qalqalah: getKesalahanQalqalah(entry),
  };
}

export function buildRaportData(
  ujian: any,
  studentName: string,
  className: string,
  assessorName?: string,
  tanggalOverride?: string,
  nis?: string | null,
  nisn?: string | null
): RaportData {
  const aspek = ujian?.nilai_aspek || {};
  const normalizedEntries = (aspek.entries || []).map(normalizeTahsinEntry);
  const rawTahfizhEntries = Array.isArray(aspek.surahEntries) ? aspek.surahEntries : [];
  const tahfizhMode =
    inferTahfizhModeForExam({
      mode: ujian?.mode,
      tahfizhMode: aspek.tahfizhMode,
      verificationType: aspek.verificationType,
      assessedBy: ujian?.assessed_by,
      tanggal: ujian?.tanggal,
    }) || "Reguler";
  const rawTahfizhJuzList = [
    ...new Set(rawTahfizhEntries.map((entry: any) => Number(entry.juz || 30))),
  ];
  const useRegularFiveQuestionDetail =
    ujian?.mode === "Tahfizh" &&
    tahfizhMode === "Reguler" &&
    rawTahfizhJuzList.length === 1 &&
    rawTahfizhEntries.length <= 5;
  const tahfizhReportType = useRegularFiveQuestionDetail ? "detail" : "summary";

  const grading = getStandardExamGrading(ujian?.nilai_akhir ?? 0);
  const predikat = aspek.predikat || grading.predikat;

  const savedCatatanMode = aspek?.catatanMode || "auto";
  const manualCatatan = savedCatatanMode === "manual" ? aspek?.catatanGuru ?? "" : "";
  const finalCatatan =
    (manualCatatan || "").trim() || generateCatatanOtomatisFromUjian(ujian, studentName);

  const verificationToken =
    ujian?.verification_token || aspek?.verificationToken;

  return {
    mode: ujian?.mode,
    studentName,
    className,
    nis: nis || undefined,
    nisn: nisn || undefined,
    assessorName: assessorName || aspek?.assessorName,
    tanggal: tanggalOverride || ujian?.tanggal || new Date().toISOString().split("T")[0],
    nilaiAkhir: ujian?.nilai_akhir ?? 0,
    status: ujian?.status ?? "-",
    grade: ujian?.grade ?? grading.grade,
    predikat,
    catatanGuru: finalCatatan,
    verificationToken,
    tahfizhMode,
    tahfizhReportType,
    tahfizhConfig: aspek.config,
    tahfizhEntries:
      rawTahfizhEntries.length > 0
        ? ((tahfizhReportType === "summary"
            ? aggregateTahfizhAssessmentsForDisplay(rawTahfizhEntries)
            : rawTahfizhEntries) as unknown as TahfizhSurahEntry[])
        : undefined,
    dasarEntries: normalizedEntries as TahsinDasarEntry[] | undefined,
    dasarConfig: aspek.config as TahsinPenaltyConfig | undefined,
    lanjutanEntries: normalizedEntries as TahsinLanjutanEntry[] | undefined,
    lanjutanConfig: aspek.config as TahsinPenaltyConfig | undefined,
    penaltiWaqaf: aspek.penaltiWaqaf,
    waqafTest: aspek.waqafTest as WaqafSymbolTest | undefined,
    ujianId: ujian?.id,
  };
}

export function buildEffectiveOpts(
  opts: RaportPdfOptions,
  data: Pick<RaportData, "mode" | "tahfizhMode" | "verificationToken">,
  ujian?: { assessed_by?: string | null; tanggal?: string | null; nilai_aspek?: Record<string, unknown> | null }
): RaportPdfOptions {
  const verifyUrl =
    buildVerificationUrlForExam(
      {
        mode: data.mode,
        tahfizhMode: data.tahfizhMode,
        verificationType: ujian?.nilai_aspek?.verificationType as string | undefined,
        assessedBy: ujian?.assessed_by,
        tanggal: ujian?.tanggal,
      },
      data.verificationToken
    ) ||
    opts.verifyUrl;
  return { ...opts, verifyUrl };
}
