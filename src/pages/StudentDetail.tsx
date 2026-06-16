import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMyAssignedClasses } from "@/hooks/useMyAssignedClasses";
import { calculateNilaiSetoran } from "@/data/mockData";
import type { Koreksi, TahfizhSurahEntry } from "@/data/mockData";
import { useStudentDetail, useAddSetoran, useAddTahfizhUjian, useAddTahsinUjian, useUpdateCatatan, useUpdateUjian, useDeleteUjian, usePublishUjian } from "@/hooks/useStudentDetail";
import { JUZ_SURAH_MAP, getSurahsForJuz, getSurahLabel } from "@/data/quranData";
import { ArrowLeft, Plus, FileText, Award, BookOpen, PenLine, Loader2, Trash2, Info, Calendar, Clock, Download, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import UjianTahsinDasarForm from "@/components/UjianTahsinDasarForm";
import UjianTahsinLanjutanForm from "@/components/UjianTahsinLanjutanForm";
import UjianTahfizhForm from "@/components/UjianTahfizhForm";
import { calculateNilaiTahsinDasar, calculateNilaiTahsinLanjutan } from "@/data/tahsinScoring";
import type { TahsinDasarEntry, TahsinLanjutanEntry, TahsinPenaltyConfig, WaqafSymbolTest } from "@/data/tahsinScoring";
import { generateTahsinPDF } from "@/utils/generateTahsinPDF";
import { getEffectiveCatatanGuru } from "@/utils/catatanOtomatis";
import { getStandardExamGrading } from "@/data/grading";
import EditUjianDialog from "@/components/EditUjianDialog";
import RaportPreviewDialog from "@/components/RaportPreviewDialog";
import { handleSmartFormKey } from "@/utils/smartFormNav";
import { usesLegacyTahfizhScoring } from "@/utils/verificationUrl";
import { formatClassName } from "@/utils/className";
import { formatStudentName } from "@/utils/formatName";
import {
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhExamResult,
  calculateTahfizhSummary,
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  normalizeTahfizhPayload,
  normalizeTahfizhPenaltyConfig,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig as TahfizhSystemPenaltyConfig,
} from "@/data/tahfizhSystem";

const KELANCARAN_OPTIONS = [
  { value: 90, label: "Lancar (90)" },
  { value: 100, label: "Sangat Lancar (100)" },
  { value: 80, label: "Cukup Lancar (80)" },
  { value: 70, label: "Kurang Lancar (70)" },
  { value: 60, label: "Tidak Lancar (60)" },
];

const DETAIL_META_KEYS = ["catatanGuru", "catatanMode", "rumus", "predikat", "statusLabel", "documentStatus", "manualStopReason", "autoFailLog", "autoFailConfig", "verificationToken", "reportType", "tahfizhMode"];
const WAQAF_LABELS: Record<string, string> = {
  waqaf_lazim: "Waqaf Lazim",
  waqaf_mustahab: "Waqaf Mustahab",
  waqaf_jaiz: "Waqaf Jaiz",
  waqaf_mujawwaz: "Waqaf Mujawwaz",
  waqaf_mamnu: "Waqaf Mamnu",
  waqaf_muanaqah: "Waqaf Muanaqah",
};

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return String(value);
}

function getEntryNumber(entry: any, keys: string[]) {
  const key = keys.find((item) => entry?.[item] !== undefined && entry?.[item] !== null);
  return Number(key ? entry[key] : 0) || 0;
}

function getEntryValue(entry: any, keys: string[]) {
  const key = keys.find((item) => entry?.[item] !== undefined && entry?.[item] !== null && entry?.[item] !== "");
  return key ? entry[key] : undefined;
}

function getTahfizhDisplayScore(entry: any, config?: any) {
  return calculateTahfizhSurahScore(normalizeTahfizhAssessment(entry), getTahfizhPenaltyConfig(config));
}

function getTahfizhAyatLabel(entry: any) {
  const explicitRange = getEntryValue(entry, ["ayat_range", "ayatRange"]);
  if (explicitRange) return valueText(explicitRange);

  const ayatAwal = getEntryValue(entry, ["ayat_awal", "ayatAwal", "ayat_mulai"]);
  const ayatAkhir = getEntryValue(entry, ["ayat_akhir", "ayatAkhir"]);

  if (ayatAwal && ayatAkhir) return `${valueText(ayatAwal)} - ${valueText(ayatAkhir)}`;
  if (ayatAwal) return valueText(ayatAwal);
  if (ayatAkhir) return valueText(ayatAkhir);

  return "-";
}

function getTahfizhPenaltyConfig(config: any): TahfizhSystemPenaltyConfig {
  return normalizeTahfizhPenaltyConfig(config);
}

function getTahfizhJuzSummaryRows(entries: any[], config: any, tahfizhMode: TahfizhExamMode = "Reguler") {
  const normalizedEntries = aggregateTahfizhAssessmentsForDisplay(entries).map((entry) => ({
    surah: valueText(getEntryValue(entry, ["surah", "nama_surah", "namaSurah"])),
    juz: Number(getEntryValue(entry, ["juz"]) || 30),
    kelancaran: getEntryNumber(entry, ["kelancaran"]),
    lahnJali: getEntryNumber(entry, ["lahn_jali", "lahnJali"]),
    lahnKhofi: getEntryNumber(entry, ["lahn_khofi", "lahnKhofi"]),
    waqaf: getEntryNumber(entry, ["waqaf_ibtida", "waqaf"]),
    salahSambung: getEntryNumber(entry, ["salah_sambung_ayat", "salahSambung"]),
  }));

  const summaries = calculateTahfizhSummary(normalizedEntries, getTahfizhPenaltyConfig(config));
  const ayatByJuz = new Map<number, string>();

  aggregateTahfizhAssessmentsForDisplay(entries).forEach((entry) => {
    const juz = Number(getEntryValue(entry, ["juz"]) || 30);
    const ayat = getTahfizhAyatLabel(entry);
    if (ayat === "-") return;

    const existing = ayatByJuz.get(juz);
    ayatByJuz.set(juz, existing ? `${existing}; ${ayat}` : ayat);
  });

  const isCertificate = tahfizhMode === "Sertifikat";
  const rows = summaries.map((summary, index) => {
    const baseRow = [
      index + 1,
      `Juz ${summary.juz}`,
      summary.rataKelancaran,
      summary.totalLahnJali,
      summary.totalLahnKhofi,
      summary.totalWaqaf,
      summary.totalSalahSambung,
      summary.nilaiJuz,
    ];

    if (isCertificate) return baseRow;

    return [
      index + 1,
      `Juz ${summary.juz}`,
      ayatByJuz.get(summary.juz) || "-",
      summary.rataKelancaran,
      summary.totalLahnJali,
      summary.totalLahnKhofi,
      summary.totalWaqaf,
      summary.totalSalahSambung,
      summary.nilaiJuz,
    ];
  });
  const columns = isCertificate
    ? [
        "No",
        "Juz Diujikan",
        "Kelancaran Rata-rata",
        "Total Lahn Jali",
        "Total Lahn Khofi",
        "Total Waqaf",
        "Total Salah Sambung",
        "Nilai Juz",
      ]
    : [
        "No",
        "Juz Diujikan",
        "Ayat",
        "Kelancaran Rata-rata",
        "Total Lahn Jali",
        "Total Lahn Khofi",
        "Total Waqaf",
        "Total Salah Sambung",
        "Nilai Juz",
      ];

  const nilaiAkhir =
    summaries.length > 0
      ? Math.round(summaries.reduce((sum, summary) => sum + summary.nilaiJuz, 0) / summaries.length)
      : 0;

  return { rows, nilaiAkhir, columns };
}

function getTahfizhResultFromEntries(entries: any[], config?: any, mode: TahfizhExamMode = "Reguler") {
  return calculateTahfizhExamResult(
    aggregateTahfizhAssessmentsForDisplay(entries),
    mode,
    getTahfizhPenaltyConfig(config)
  );
}

function getSyncedTahfizhUjian(ujian: any) {
  if (ujian?.mode !== "Tahfizh") return ujian;

  const nilaiAspek =
    ujian.nilai_aspek && typeof ujian.nilai_aspek === "object" && !Array.isArray(ujian.nilai_aspek)
      ? ujian.nilai_aspek
      : {};
  const entries = Array.isArray(nilaiAspek.surahEntries)
    ? aggregateTahfizhAssessmentsForDisplay(nilaiAspek.surahEntries)
    : [];

  if (entries.length === 0) return ujian;

  const legacyScoring = usesLegacyTahfizhScoring({
    mode: ujian.mode,
    assessedBy: ujian.assessed_by,
    tanggal: ujian.tanggal,
  });
  const normalized = normalizeTahfizhPayload({
    entries,
    nilaiAspek,
    tahfizhMode: nilaiAspek.tahfizhMode || "Reguler",
    config: nilaiAspek.config,
    manualStopReason: legacyScoring ? "" : nilaiAspek.manualStopReason || "",
    ignoreAutoFail: legacyScoring,
    autoFailConfig: nilaiAspek.autoFailConfig,
  });
  const result = normalized.result;

  return {
    ...ujian,
    nilai_akhir: normalized.nilaiAkhir,
    grade: result.grade,
    status: result.status,
    status_sertifikasi: result.status,
    nilai_aspek: {
      ...nilaiAspek,
      predikat: result.predikat,
      statusLabel: result.statusLabel,
    },
  };
}

function prettyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DetailSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "blue" | "amber" | "rose" | "violet";
  children: ReactNode;
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    blue: "border-blue-200 bg-blue-50/70 text-blue-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-900",
    rose: "border-rose-200 bg-rose-50/70 text-rose-900",
    violet: "border-violet-200 bg-violet-50/70 text-violet-900",
  };

  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function DetailTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<unknown>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-current/10 bg-background/75">
      <table className="w-full min-w-[620px] text-xs">
        <thead>
          <tr className="border-b border-current/10 bg-muted/50">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-semibold text-foreground">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-current/10 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-muted-foreground">
                  {valueText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueGrid({ items }: { items: Array<[string, unknown]> }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">Tidak ada data tambahan.</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-current/10 bg-background/75 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">{prettyKey(key)}</p>
          <p className="break-words text-sm font-semibold text-foreground">{valueText(value)}</p>
        </div>
      ))}
    </div>
  );
}

function getRumusLabel(nilaiAspek: any, mode?: string) {
  if (mode === "Tahfizh") return "Rumus Baru (Kelancaran dikurangi penalti)";
  const rumus = nilaiAspek?.rumus || "baru";
  if (rumus === "lama") return "Rumus Lama (Bobot 60/40)";
  return "Rumus Baru (Kelancaran dikurangi penalti)";
}

function ExamDetailTables({
  mode,
  nilaiAspek,
  catatanGuruText,
  tahfizhEntries,
  tahsinEntries,
  detailEntries,
}: {
  mode: string;
  nilaiAspek: any;
  catatanGuruText?: string;
  tahfizhEntries: any[];
  tahsinEntries: any[];
  detailEntries: Array<[string, unknown]>;
}) {
  const catatanGuru = catatanGuruText || nilaiAspek?.catatanGuru || nilaiAspek?.catatan_guru || "";
  const rumusLabel = getRumusLabel(nilaiAspek, mode);
  const isTahfizh = mode === "Tahfizh";
  const isTahsinDasar = mode === "Tahsin Dasar";
  const isTahsinLanjutan = mode === "Tahsin Lanjutan";
  const tahfizhJuzSummary = isTahfizh
    ? getTahfizhJuzSummaryRows(tahfizhEntries, nilaiAspek?.config, nilaiAspek?.tahfizhMode || "Reguler")
    : { rows: [], nilaiAkhir: 0, columns: [] };

  const tableTone = isTahfizh
    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
    : isTahsinDasar
      ? "border-blue-200 bg-blue-50/70 text-blue-900"
      : "border-violet-200 bg-violet-50/70 text-violet-900";

  const tableTitle = isTahfizh
    ? "Detail Ujian Tahfizh"
    : isTahsinDasar
      ? "Detail Ujian Tahsin Dasar"
      : isTahsinLanjutan
        ? "Detail Ujian Tahsin Lanjutan"
        : "Detail Penilaian";

  const tableData = (() => {
    if (isTahfizh && tahfizhEntries.length > 0) {
      return {
        columns: ["No", "Juz", "Surat / Grup", "Ayat", "Kelancaran", "Lahn Jali", "Lahn Khofi", "Waqaf", "Salah Sambung", "Nilai", "Catatan"],
        rows: tahfizhEntries.map((entry, index) => [
          index + 1,
          entry.juz,
          entry.surah,
          getEntryValue(entry, ["ayat_range", "ayatRange"]) || `${valueText(getEntryValue(entry, ["ayat_awal", "ayatAwal", "ayat_mulai"]))} - ${valueText(getEntryValue(entry, ["ayat_akhir", "ayatAkhir"]))}`,
          entry.kelancaran,
          getEntryNumber(entry, ["lahn_jali", "lahnJali"]),
          getEntryNumber(entry, ["lahn_khofi", "lahnKhofi"]),
          getEntryNumber(entry, ["waqaf_ibtida", "waqaf"]),
          getEntryNumber(entry, ["salah_sambung_ayat", "salahSambung"]),
          getTahfizhDisplayScore(entry, nilaiAspek?.config),
          getEntryValue(entry, ["catatan", "note"]),
        ]),
      };
    }

    if (isTahsinDasar && tahsinEntries.length > 0) {
      const config = nilaiAspek?.config || {};
      return {
        columns: ["No", "Materi EBTA", "Kelancaran", "Salah Huruf", "Salah Harakat", "Salah Tasydid", "Mad", "Qalqalah / Ghunnah", "Tajwid", "Waqaf", "Nilai"],
        rows: tahsinEntries.map((entry, index) => [
          index + 1,
          entry.nama_ebta || entry.namaEbta || `Baris ${index + 1}`,
          entry.kelancaran,
          getEntryNumber(entry, ["salah_huruf"]),
          getEntryNumber(entry, ["salah_harakat"]),
          getEntryNumber(entry, ["salah_tasydid", "salah_makhraj"]),
          getEntryNumber(entry, ["kesalahan_mad"]),
          getEntryNumber(entry, ["kesalahan_qalqalah", "kesalahan_ghunnah"]),
          getEntryNumber(entry, ["kesalahan_tajwid"]),
          getEntryNumber(entry, ["kesalahan_waqaf"]),
          calculateNilaiTahsinDasar(entry, config, nilaiAspek?.rumus || "baru"),
        ]),
      };
    }

    if (isTahsinLanjutan && tahsinEntries.length > 0) {
      const config = nilaiAspek?.config || {};
      return {
        columns: ["No", "Surat", "Ayat", "Kelancaran", "Salah Huruf", "Salah Harakat", "Salah Tasydid", "Mad", "Qalqalah / Ghunnah", "Tajwid", "Waqaf / Ibtida", "Nilai"],
        rows: tahsinEntries.map((entry, index) => [
          index + 1,
          entry.surah,
          entry.ayat,
          entry.kelancaran,
          getEntryNumber(entry, ["salah_huruf"]),
          getEntryNumber(entry, ["salah_harakat"]),
          getEntryNumber(entry, ["salah_tasydid", "salah_makhraj"]),
          getEntryNumber(entry, ["kesalahan_mad"]),
          getEntryNumber(entry, ["kesalahan_qalqalah", "kesalahan_ghunnah"]),
          getEntryNumber(entry, ["kesalahan_tajwid"]),
          getEntryNumber(entry, ["waqaf_ibtida", "kesalahan_waqaf"]),
          calculateNilaiTahsinLanjutan(entry, config, nilaiAspek?.penaltiWaqaf ?? 2, nilaiAspek?.rumus || "baru"),
        ]),
      };
    }

    return {
      columns: ["Poin", "Nilai"],
      rows: detailEntries.map(([key, value]) => [prettyKey(key), value]),
    };
  })();

  return (
    <div className={`mt-3 rounded-xl border p-3 ${tableTone}`}>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{tableTitle}</p>
          <p className="text-xs text-muted-foreground">Menampilkan poin yang sesuai dengan jenis ujian ini saja.</p>
        </div>
        <div className="rounded-lg border border-current/10 bg-background/75 px-3 py-2 text-xs">
          <span className="font-medium text-foreground">Rumus: </span>
          <span className="text-muted-foreground">{rumusLabel}</span>
        </div>
      </div>

      {isTahfizh && tahfizhJuzSummary.rows.length > 0 && (
        <div className="mb-3 rounded-xl border border-emerald-300/70 bg-background/80 p-3 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Ringkasan Tahfizh per Juz</p>
              <p className="text-xs text-muted-foreground">
                Rekap singkat untuk membaca hasil setiap juz tanpa membuka seluruh detail baris.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <span className="font-medium">Nilai akhir: </span>
              <span>{tahfizhJuzSummary.nilaiAkhir}</span>
            </div>
          </div>

          <DetailTable columns={tahfizhJuzSummary.columns} rows={tahfizhJuzSummary.rows} />
        </div>
      )}

      {tableData.rows.length > 0 ? (
        <DetailTable columns={tableData.columns} rows={tableData.rows} />
      ) : (
        <div className="rounded-lg bg-background/75 p-3 text-xs text-muted-foreground">
          Detail aspek penilaian belum tersedia untuk ujian ini.
        </div>
      )}

      <div className="mt-3 rounded-lg border border-current/10 bg-background/75 p-3">
        <p className="text-xs font-semibold text-foreground">Catatan Guru</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{catatanGuru || "Tidak ada catatan guru."}</p>
      </div>
    </div>
  );
}
const StudentDetail = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStudentDetail(studentId);
  const { data: assignedClassIds } = useMyAssignedClasses();
  const { isPenguji, user } = useAuthContext();
  const addSetoran = useAddSetoran();
  
  const addTahfizhUjian = useAddTahfizhUjian();
  const addTahsinUjian = useAddTahsinUjian();
  const updateCatatan = useUpdateCatatan();
  const updateUjian = useUpdateUjian();
  const deleteUjian = useDeleteUjian();
  const publishUjian = usePublishUjian();
  const [editingUjian, setEditingUjian] = useState<any | null>(null);
  const [raportUjian, setRaportUjian] = useState<any | null>(null);

  const [showSetoranForm, setShowSetoranForm] = useState(false);
  const [showUjianForm, setShowUjianForm] = useState(false);
  const [ujianMode, setUjianMode] = useState<"Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan" | null>(null);
  const [tahfizhExamMode, setTahfizhExamMode] = useState<TahfizhExamMode>("Sertifikat");

  const [tahfizhEntries, setTahfizhEntries] = useState<TahfizhSurahEntry[]>([
    { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }
  ]);
  const [tahfizhTanggal, setTahfizhTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatanGuru, setCatatanGuru] = useState("");

  const [tahsinDasarEntries, setTahsinDasarEntries] = useState<TahsinDasarEntry[]>([
    { nama_ebta: "", kelancaran: 90, salah_huruf: 0, salah_harakat: 0, salah_tasydid: 0, kesalahan_tajwid: 0, kesalahan_mad: 0, kesalahan_qalqalah: 0, kesalahan_waqaf: 0 }
  ]);
  const [tahsinDasarTanggal, setTahsinDasarTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [tahsinDasarCatatan, setTahsinDasarCatatan] = useState("");
  const [tahsinDasarConfig, setTahsinDasarConfig] = useState<TahsinPenaltyConfig>({
    penalti_lahn_jali: 2,
    penalti_lahn_khofi: 1,
    bobot_kelancaran: 40,
  });

  const [tahsinLanjutanEntries, setTahsinLanjutanEntries] = useState<TahsinLanjutanEntry[]>([
    { surah: "", ayat: "", kelancaran: 90, salah_huruf: 0, salah_harakat: 0, salah_tasydid: 0, kesalahan_tajwid: 0, kesalahan_mad: 0, kesalahan_qalqalah: 0, waqaf_ibtida: 0 }
  ]);
  const [tahsinLanjutanTanggal, setTahsinLanjutanTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [tahsinLanjutanCatatan, setTahsinLanjutanCatatan] = useState("");
  const [tahsinLanjutanConfig, setTahsinLanjutanConfig] = useState<TahsinPenaltyConfig>({
    penalti_lahn_jali: 2,
    penalti_lahn_khofi: 1,
    bobot_kelancaran: 40,
  });
  const [waqafTest, setWaqafTest] = useState<WaqafSymbolTest>({
    waqaf_lazim: false,
    waqaf_mustahab: false,
    waqaf_jaiz: false,
    waqaf_mujawwaz: false,
    waqaf_mamnu: false,
    waqaf_muanaqah: false,
  });

  const [catatan, setCatatan] = useState("");

  const student = data?.student;
  const formattedStudentName = formatStudentName(student?.name || "Siswa");
  const classInfo = data?.classInfo;
  const setoran = data?.setoran || [];
  const ujian = data?.ujian || [];
  const assessorMap = data?.assessorMap || {};

  const isLoggedIn = !!user;
  const hasAccess = !isPenguji || assignedClassIds === null || assignedClassIds === undefined || (classInfo?.id && assignedClassIds.includes(classInfo.id));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-20 text-destructive">
          Siswa tidak ditemukan
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">Anda tidak memiliki akses ke siswa ini</p>
          <button onClick={() => navigate("/")} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const handleSaveCatatan = () => {
    if (!studentId) return;
    updateCatatan.mutate({ student_id: studentId, catatan }, {
      onSuccess: () => toast.success("Catatan berhasil disimpan!"),
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const handleTahfizhSubmit = () => {
    if (!studentId) return;
    const result = getTahfizhResultFromEntries(tahfizhEntries);
    addTahfizhUjian.mutate({
      student_id: studentId,
      entries: tahfizhEntries,
      catatan_guru: catatanGuru,
      assessed_by: user?.id,
      tanggal: tahfizhTanggal,
      ...result,
    }, {
      onSuccess: () => {
        toast.success("Hasil ujian Tahfizh berhasil disimpan!");
        setShowUjianForm(false);
        setUjianMode(null);
        setTahfizhEntries([{ surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }]);
        setCatatanGuru("");
        setTahfizhTanggal(new Date().toISOString().split('T')[0]);
      },
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const tahfizhPreview = tahfizhEntries.length > 0 ? getTahfizhResultFromEntries(tahfizhEntries) : null;

  const addTahfizhEntry = () => {
    setTahfizhEntries([...tahfizhEntries, { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }]);
  };

  const removeTahfizhEntry = (index: number) => {
    if (tahfizhEntries.length <= 1) return;
    setTahfizhEntries(tahfizhEntries.filter((_, i) => i !== index));
  };

  const updateTahfizhEntry = (index: number, field: keyof TahfizhSurahEntry, value: any) => {
    const updated = [...tahfizhEntries];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'juz') {
      const surahs = getSurahsForJuz(value as number);
      if (surahs.length > 0) {
        updated[index].surah = surahs[0].name;
      }
    }
    setTahfizhEntries(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{formattedStudentName}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {(student as any)?.nisn && <p>NISN: {(student as any).nisn}</p>}
            {classInfo?.name && <p>Kelas: {formatClassName(classInfo)}</p>}
          </div>
        </div>

        <Tabs defaultValue="ujian" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ujian">📋 Ujian</TabsTrigger>
            <TabsTrigger value="setoran">📖 Setoran</TabsTrigger>
            <TabsTrigger value="catatan">💬 Catatan</TabsTrigger>
            <TabsTrigger value="raport">📄 Raport</TabsTrigger>
          </TabsList>

          {/* UJIAN TAB */}
          <TabsContent value="ujian" className="space-y-6">
            {isLoggedIn && (
              <div className="p-6 rounded-lg border border-border bg-card space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Ujian Baru
                </h3>

                <div className="flex flex-wrap gap-2">
                  {[
                    { mode: "Tahsin Dasar" as const, icon: "🎓" },
                    { mode: "Tahsin Lanjutan" as const, icon: "🎓" },
                  ].map(({ mode, icon }) => (
                    <button
                      key={mode}
                      onClick={() => { setUjianMode(mode); setShowUjianForm(true); }}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      disabled={showUjianForm}
                    >
                      {icon} {mode}
                    </button>
                  ))}
                  <button
                    onClick={() => { setTahfizhExamMode("Sertifikat"); setUjianMode("Tahfizh"); setShowUjianForm(true); }}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={showUjianForm}
                  >
                    Tahfizh Sertifikat
                  </button>
                  <button
                    onClick={() => { setTahfizhExamMode("Reguler"); setUjianMode("Tahfizh"); setShowUjianForm(true); }}
                    className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
                    disabled={showUjianForm}
                  >
                    Tahfizh Reguler
                  </button>
                </div>

                {showUjianForm && ujianMode === "Tahsin Dasar" && (
                  <UjianTahsinDasarForm
                    onCancel={() => { setShowUjianForm(false); setUjianMode(null); }}
                    onSubmit={(formData) => {
                      if (!studentId) return;
                      addTahsinUjian.mutate({
                        student_id: studentId,
                        mode: "Tahsin Dasar",
                        nilai_aspek: {
                          rumus: "baru",
                          entries: formData.entries,
                          config: formData.config,
                          predikat: formData.predikat,
                          catatanGuru: formData.catatan_guru,
                          catatanMode: formData.catatan_guru?.trim() ? "manual" : "auto",
                        },
                        assessed_by: user?.id,
                        tanggal: formData.tanggal,
                        waktu: formData.waktu,
                        nilaiAkhir: formData.nilaiAkhir,
                        status: formData.status,
                        grade: formData.grade,
                      }, {
                        onSuccess: () => { toast.success("Hasil Ujian Tahsin Dasar berhasil disimpan!"); setShowUjianForm(false); setUjianMode(null); },
                        onError: (err) => toast.error(getSafeErrorMessage(err)),
                      });
                    }}
                    isPending={addTahsinUjian.isPending}
                  />
                )}

                {showUjianForm && ujianMode === "Tahsin Lanjutan" && (
                  <UjianTahsinLanjutanForm
                    onCancel={() => { setShowUjianForm(false); setUjianMode(null); }}
                    onSubmit={(formData) => {
                      if (!studentId) return;
                      addTahsinUjian.mutate({
                        student_id: studentId,
                        mode: "Tahsin Lanjutan",
                        nilai_aspek: {
                          rumus: "baru",
                          entries: formData.entries,
                          config: formData.config,
                          penaltiWaqaf: formData.penaltiWaqaf,
                          waqafTest: formData.waqafTest,
                          predikat: formData.predikat,
                          catatanGuru: formData.catatan_guru,
                          catatanMode: formData.catatan_guru?.trim() ? "manual" : "auto",
                        },
                        assessed_by: user?.id,
                        tanggal: formData.tanggal,
                        waktu: formData.waktu,
                        nilaiAkhir: formData.nilaiAkhir,
                        status: formData.status,
                        grade: formData.grade,
                      }, {
                        onSuccess: () => { toast.success("Hasil Ujian Tahsin Lanjutan berhasil disimpan!"); setShowUjianForm(false); setUjianMode(null); },
                        onError: (err) => toast.error(getSafeErrorMessage(err)),
                      });
                    }}
                    isPending={addTahsinUjian.isPending}
                  />
                )}

                {showUjianForm && ujianMode === "Tahfizh" && (
                  <UjianTahfizhForm
                    mode={tahfizhExamMode}
                    onCancel={() => { setShowUjianForm(false); setUjianMode(null); }}
                    onSubmit={(formData) => {
                      if (!studentId) return;
                      addTahfizhUjian.mutate({
                        student_id: studentId,
                        entries: formData.assessments,
                        config: formData.config,
                        tahfizh_mode: tahfizhExamMode,
                        catatan_guru: formData.catatanGuru,
                        assessed_by: user?.id,
                        tanggal: formData.tanggal,
                        waktu: formData.waktu,
                        nilaiAkhir: formData.nilaiAkhir,
                        status: formData.status,
                        grade: formData.grade,
                        predikat: formData.predikat,
                        status_label: formData.statusLabel,
                        document_status: formData.documentStatus,
                        manual_stop_reason: formData.manualStopReason,
                        auto_fail_log: formData.autoFailLog,
                        auto_fail_config: formData.autoFailConfig,
                      }, {
                        onSuccess: () => {
                          toast.success(formData.documentStatus === "Published" ? "Ujian Tahfizh dipublish dan dikunci" : "Draft Ujian Tahfizh tersimpan");
                          setShowUjianForm(false);
                          setUjianMode(null);
                        },
                        onError: (err) => toast.error(getSafeErrorMessage(err)),
                      });
                    }}
                    isPending={addTahfizhUjian.isPending}
                  />
                )}

                {false && showUjianForm && ujianMode === "Tahfizh" && (
                  <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                    <h4 className="font-semibold text-foreground">📖 Form Ujian Tahfizh</h4>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tanggal</label>
                      <input type="date" value={tahfizhTanggal} onChange={e => setTahfizhTanggal(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium text-sm text-foreground">Surat yang Diujikan</h5>
                        <button onClick={addTahfizhEntry} className="text-xs text-primary hover:underline">+ Tambah</button>
                      </div>
                      {tahfizhEntries.map((entry, idx) => (
                        <div key={idx} className="p-3 rounded-md border border-border bg-background space-y-2">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-foreground">Surat #{idx + 1}</p>
                            {tahfizhEntries.length > 1 && (
                              <button onClick={() => removeTahfizhEntry(idx)} className="text-destructive text-xs hover:underline">Hapus</button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Surah</label>
                              <select value={entry.surah} onChange={e => updateTahfizhEntry(idx, 'surah', e.target.value)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {getSurahsForJuz(entry.juz).map(s => (
                                  <option key={s.name} value={s.name}>{getSurahLabel(s)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Juz</label>
                              <select value={entry.juz} onChange={e => updateTahfizhEntry(idx, 'juz', parseInt(e.target.value))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                                  <option key={j} value={j}>{j}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Kelancaran</label>
                              <select value={entry.kelancaran} onChange={e => updateTahfizhEntry(idx, 'kelancaran', parseInt(e.target.value))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {KELANCARAN_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.value}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Lahn Jali</label>
                              <input type="number" min={0} value={entry.lahn_jali} onChange={e => updateTahfizhEntry(idx, 'lahn_jali', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Lahn Khofi</label>
                              <input type="number" min={0} value={entry.lahn_khofi} onChange={e => updateTahfizhEntry(idx, 'lahn_khofi', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Waqaf</label>
                              <input type="number" min={0} value={entry.waqaf_ibtida} onChange={e => updateTahfizhEntry(idx, 'waqaf_ibtida', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Sambung Ayat</label>
                              <input type="number" min={0} value={entry.salah_sambung_ayat} onChange={e => updateTahfizhEntry(idx, 'salah_sambung_ayat', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Nilai Surat</label>
                              <div className="text-center py-1 px-2 rounded-md border border-input bg-muted text-foreground text-xs font-semibold">
                                {getTahfizhDisplayScore(entry)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Catatan Guru</label>
                      <textarea value={catatanGuru} onChange={e => setCatatanGuru(e.target.value)}
                        placeholder="Catatan untuk siswa..."
                        className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm resize-y" />
                    </div>

                    {tahfizhPreview && (
                      <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 space-y-1">
                        <p className="text-xs text-muted-foreground">Preview Hasil</p>
                        <p className="text-2xl font-bold text-emerald-600">{tahfizhPreview.nilaiAkhir}</p>
                        <p className="text-sm font-medium text-emerald-700">{tahfizhPreview.predikat} - Grade {tahfizhPreview.grade}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => { setShowUjianForm(false); setUjianMode(null); }}
                        className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        Batal
                      </button>
                      <button onClick={handleTahfizhSubmit} disabled={addTahfizhUjian.isPending}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {addTahfizhUjian.isPending ? "Menyimpan..." : "Simpan Ujian"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Panduan simpan ujian</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="font-medium text-foreground">Simpan Draft</p>
                  <p className="mt-1 text-xs">
                    Gunakan jika nilai masih ingin dicek atau dilengkapi. Draft masih bisa diedit, dipublish, atau dihapus dari daftar ujian.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="font-medium text-foreground">Publish & Kunci</p>
                  <p className="mt-1 text-xs">
                    Gunakan jika nilai sudah final. Setelah dipublish, dokumen tidak bisa diedit, tetapi masih bisa dihapus dari daftar ujian jika memang salah input lalu dibuat ulang.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4" /> Daftar Ujian ({ujian.length})
              </h3>
              {ujian.map((u: any, idx: number) => {
                const statusBadge = (status: string) => {
                  switch (status) {
                    case 'Lulus':
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">✅ Lulus</span>;
                    case 'Tidak Lulus':
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">❌ Tidak Lulus</span>;
                    default:
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-700">⏳ Proses</span>;
                  }
                };
                const displayUjian = getSyncedTahfizhUjian(u);
                const ujianStatus = displayUjian.status || displayUjian.status_sertifikasi || "Proses";
                const documentStatus = displayUjian.document_status || displayUjian.nilai_aspek?.documentStatus || "Draft";
                const isPublished = documentStatus === "Published";
                const nilaiAspek =
                  displayUjian.nilai_aspek && typeof displayUjian.nilai_aspek === "object" && !Array.isArray(displayUjian.nilai_aspek)
                    ? displayUjian.nilai_aspek
                    : {};
                const effectiveCatatanGuru = getEffectiveCatatanGuru(displayUjian, formattedStudentName);
                const tahfizhEntries = Array.isArray(nilaiAspek.surahEntries)
                  ? aggregateTahfizhAssessmentsForDisplay(nilaiAspek.surahEntries)
                  : [];
                const tahsinEntries = Array.isArray(nilaiAspek.entries)
                  ? nilaiAspek.entries
                  : [];
                const detailEntries = Object.entries(nilaiAspek as Record<string, unknown>)
                  .filter(([key, val]) =>
                    !["entries", "surahEntries", "config", "waqafTest", "catatanGuru", "catatanMode", "rumus", "predikat", "autoFailConfig"].includes(key) &&
                    (typeof val === "string" || typeof val === "number" || typeof val === "boolean")
                  );

                return (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{displayUjian.mode}</p>
                        <p className="text-xs text-muted-foreground">
                          {displayUjian.tanggal && new Date(displayUjian.tanggal).toLocaleDateString("id-ID")}
                          {u.assessed_by && ` • Penguji: ${assessorMap[u.assessed_by] || u.assessed_by}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {statusBadge(ujianStatus)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Nilai Akhir</p>
                        <p className="text-xl font-bold text-foreground">{displayUjian.nilai_akhir}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Grade</p>
                        <p className="text-xl font-bold text-foreground">{displayUjian.grade}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-bold text-foreground">{ujianStatus}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Predikat</p>
                        <p className="text-sm font-bold text-primary">{nilaiAspek.predikat || "-"}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Dokumen</p>
                        <p className="text-sm font-bold text-foreground">{documentStatus}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {isLoggedIn && (
                        <>
                          <button
                            onClick={() => setEditingUjian(displayUjian)}
                            disabled={isPublished}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              const message = isPublished
                                ? "Ujian ini sudah dipublish dan terkunci. Hapus tetap diperbolehkan jika data final ini salah. Lanjut hapus ujian?"
                                : "Hapus hasil ujian ini?";
                              if (!window.confirm(message)) return;

                              deleteUjian.mutate({
                                ujian_id: u.id,
                                student_id: studentId!,
                              }, {
                                onSuccess: () => toast.success("Hasil ujian dihapus"),
                                onError: (err) => toast.error(getSafeErrorMessage(err)),
                              });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                          {!isPublished && (
                            <button
                              onClick={() => {
                                publishUjian.mutate({
                                  ujian_id: u.id,
                                  student_id: studentId!,
                                }, {
                                  onSuccess: () => toast.success("Dokumen dipublish dan dikunci"),
                                  onError: (err) => toast.error(getSafeErrorMessage(err)),
                                });
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-700 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                            >
                              Publish
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => setRaportUjian(displayUjian)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-600 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                      >
                        <FileText className="w-3 h-3" /> Lihat Raport
                      </button>
                      {displayUjian.mode === "Tahsin Dasar" && (
                        <button
                          onClick={() => {
                            (generateTahsinPDF as any)(formattedStudentName, displayUjian.mode, tahsinEntries, displayUjian.nilai_akhir);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Unduh PDF
                        </button>
                      )}
                    </div>

                    <ExamDetailTables
                      mode={displayUjian.mode}
                      nilaiAspek={nilaiAspek}
                      catatanGuruText={effectiveCatatanGuru}
                      tahfizhEntries={tahfizhEntries}
                      tahsinEntries={tahsinEntries}
                      detailEntries={detailEntries}
                    />
                  </div>
                );
              })}
              {ujian.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Belum ada ujian</p>
              )}
            </div>
          </TabsContent>

          {/* SETORAN TAB */}
          <TabsContent value="setoran" className="space-y-6">
            {isLoggedIn && (
              <div className="p-6 rounded-lg border border-border bg-card space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Setoran
                </h3>
                {/* Form setoran bisa ditambahkan di sini */}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Daftar Setoran ({setoran.length})
              </h3>
              {setoran.map((s: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-card">
                  <p className="text-sm font-semibold text-foreground">
                    {s.surah} (Ayat {s.ayat_mulai}-{s.ayat_akhir})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.tanggal && new Date(s.tanggal).toLocaleDateString("id-ID")}
                  </p>
                  <p className="text-sm font-bold text-primary mt-2">Nilai: {s.nilai}</p>
                </div>
              ))}
              {setoran.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Belum ada setoran</p>
              )}
            </div>
          </TabsContent>

          {/* CATATAN TAB */}
          <TabsContent value="catatan" className="space-y-4">
            <h3 className="font-semibold text-foreground">Catatan Penguji</h3>
            {isLoggedIn ? (
              <>
                <textarea
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  placeholder="Tulis catatan, evaluasi, dan saran perbaikan untuk siswa..."
                  className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
                <button
                  onClick={handleSaveCatatan}
                  disabled={updateCatatan.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updateCatatan.isPending ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </>
            ) : (
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{catatan || "Belum ada catatan"}</p>
              </div>
            )}
          </TabsContent>

          {/* RAPORT TAB */}
          <TabsContent value="raport" className="space-y-4">
            <h3 className="font-semibold text-foreground">Raport</h3>
            <p className="text-sm text-muted-foreground">Pilih ujian untuk melihat raport</p>
          </TabsContent>
        </Tabs>
      </main>

      {editingUjian && (
        <EditUjianDialog
          open={!!editingUjian}
          onClose={() => setEditingUjian(null)}
          ujian={editingUjian}
          studentName={formattedStudentName}
          classInfo={classInfo}
          isSaving={updateUjian.isPending}
          onSave={(updated) => {
            updateUjian.mutate({
              ujian_id: editingUjian.id,
              student_id: studentId!,
              nilai_aspek: updated.nilai_aspek,
              nilai_akhir: updated.nilai_akhir,
              status: updated.status,
              grade: updated.grade,
              tanggal: updated.tanggal,
            }, {
              onSuccess: () => { toast.success("Hasil ujian diperbarui"); setEditingUjian(null); },
              onError: (err) => toast.error(getSafeErrorMessage(err)),
            });
          }}
        />
      )}
      {raportUjian && (
        <RaportPreviewDialog
          open={!!raportUjian}
          onClose={() => setRaportUjian(null)}
          ujian={raportUjian}
          studentName={formattedStudentName}
          className={formatClassName(classInfo)}
          nis={student.nis}
          nisn={student.nisn}
          assessorName={raportUjian.assessed_by ? assessorMap[raportUjian.assessed_by] : undefined}
        />
      )}
    </div>
  );
};

export default StudentDetail;
