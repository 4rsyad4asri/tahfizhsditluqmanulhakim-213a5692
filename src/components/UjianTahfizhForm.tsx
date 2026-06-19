import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG,
  DEFAULT_TAHFIZH_PENALTY,
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhExamResult,
  calculateTahfizhSurahScore,
  createEmptyTahfizhAssessment,
  getTahfizhAutoFailState,
  getCertificateSequenceForJuz,
  normalizeTahfizhAssessment,
  toSafeNumber,
  type TahfizhAutoFailConfig,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { getSurahsForJuz, getSurahLabel } from "@/data/quranData";

interface UjianTahfizhFormProps {
  mode: TahfizhExamMode;
  initialAssessments?: TahfizhSurahAssessment[];
  initialPenalty?: TahfizhPenaltyConfig;
  isPending?: boolean;
  onSubmit: (data: {
    assessments: TahfizhSurahAssessment[];
    config: TahfizhPenaltyConfig;
    nilaiAkhir: number;
    predikat: string;
    status: "Lulus" | "Tidak Lulus";
    grade: string;
    catatanGuru: string;
    tanggal: string;
    waktu: string;
    statusLabel: string;
    documentStatus: "Draft" | "Published";
    manualStopReason?: string;
    autoFailLog?: string;
    autoFailConfig?: TahfizhAutoFailConfig;
  }) => void;
  onCancel: () => void;
}

const KELANCARAN_OPTIONS = [100, 90, 80, 70, 60];
const DEFAULT_REGULAR_ROWS = 5;
const AUTO_FAIL_STORAGE_KEY = "tahfizhAutoFailConfig";
type AssessmentFieldValue = string | number | undefined;

function getSelectedJuzList(assessments: TahfizhSurahAssessment[]) {
  return Array.from(new Set(assessments.map((item) => Number(item.juz || 30)))).sort((a, b) => b - a);
}

function getInitialJuz(initialAssessments?: TahfizhSurahAssessment[]) {
  const [firstJuz] = getSelectedJuzList(
    (initialAssessments || []).map((assessment) =>
      normalizeTahfizhAssessment(assessment)
    )
  );
  return firstJuz || 30;
}

function getRegularJuzOptions(assessments: TahfizhSurahAssessment[]) {
  return getSelectedJuzList(assessments);
}

function createRegularRows(juz = 30, count = DEFAULT_REGULAR_ROWS) {
  return Array.from({ length: count }, (_, index) => {
    return {
      ...createEmptyTahfizhAssessment(juz),
      surah: "",
      ayatRange: "",
      sequenceLabel: `Soal ${index + 1}`,
    };
  });
}

function initialRows(mode: TahfizhExamMode, initialAssessments?: TahfizhSurahAssessment[]) {
  if (initialAssessments?.length) return aggregateTahfizhAssessmentsForDisplay(initialAssessments);
  if (mode === "Sertifikat") return getCertificateSequenceForJuz(30);
  return createRegularRows(30);
}

function getAutoKelancaran(assessment: TahfizhSurahAssessment) {
  const highestBlockingError = Math.max(Number(assessment.lahnJali || 0), Number(assessment.salahSambung || 0));
  if (highestBlockingError >= 9) return 60;
  if (highestBlockingError >= 6) return 70;
  if (highestBlockingError >= 3) return 80;
  if (highestBlockingError >= 1) return 90;
  return 100;
}

function getStoredAutoFailConfig(): TahfizhAutoFailConfig {
  if (typeof window === "undefined") return DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG;

  try {
    const raw = window.localStorage.getItem(AUTO_FAIL_STORAGE_KEY);
    if (!raw) return DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TahfizhAutoFailConfig>;
    return {
      lahnJaliMax: Number(parsed.lahnJaliMax || DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG.lahnJaliMax),
      salahSambungMax: Number(parsed.salahSambungMax || DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG.salahSambungMax),
      ignoreMaxErrors: Boolean(parsed.ignoreMaxErrors),
    };
  } catch {
    return DEFAULT_TAHFIZH_AUTO_FAIL_CONFIG;
  }
}

function saveStoredAutoFailConfig(config: TahfizhAutoFailConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_FAIL_STORAGE_KEY, JSON.stringify(config));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function findBestSurahMatch(juz: number, input: string) {
  const keyword = normalizeSearchText(input);
  if (!keyword) return undefined;

  return getSurahsForJuz(juz)
    .map((item) => {
      const name = normalizeSearchText(item.name);
      const label = normalizeSearchText(getSurahLabel(item));
      const distanceToName = getDistance(keyword, name.slice(0, Math.max(keyword.length, 1)));
      const distanceToLabel = getDistance(keyword, label.slice(0, Math.max(keyword.length, 1)));
      const score =
        (name === keyword ? 100 : 0) +
        (name.startsWith(keyword) ? 70 : 0) +
        (name.includes(keyword) || label.includes(keyword) ? 45 : 0) +
        Math.max(0, 35 - Math.min(distanceToName, distanceToLabel) * 5);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function getSurahSearchResults(juz: number, input: string) {
  const keyword = normalizeSearchText(input);
  return getSurahsForJuz(juz)
    .map((item) => {
      const name = normalizeSearchText(item.name);
      const label = normalizeSearchText(getSurahLabel(item));
      const distanceToName = keyword ? getDistance(keyword, name.slice(0, Math.max(keyword.length, 1))) : 0;
      const distanceToLabel = keyword ? getDistance(keyword, label.slice(0, Math.max(keyword.length, 1))) : 0;
      const score = !keyword
        ? 20
        : (name === keyword ? 100 : 0) +
          (name.startsWith(keyword) ? 75 : 0) +
          (name.includes(keyword) || label.includes(keyword) ? 50 : 0) +
          Math.max(0, 35 - Math.min(distanceToName, distanceToLabel) * 5);
      return { item, score };
    })
    .filter((result) => !keyword || result.score >= 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function normalizeAssessmentsForJuz(assessments: TahfizhSurahAssessment[], juz: number) {
  return assessments.map((item) => {
    if (Number(item.juz || 30) !== juz || !item.surah?.trim()) return item;
    const match = findBestSurahMatch(juz, item.surah);
    if (!match || match.score < 25) return item;
    return { ...item, surah: match.item.name, ayatRange: match.item.ayatRange || "" };
  });
}

export default function UjianTahfizhForm({
  mode,
  initialAssessments,
  initialPenalty = DEFAULT_TAHFIZH_PENALTY,
  isPending = false,
  onSubmit,
  onCancel,
}: UjianTahfizhFormProps) {
  const [assessments, setAssessments] = useState<TahfizhSurahAssessment[]>(
    initialRows(mode, initialAssessments)
  );
  const [penaltyConfig, setPenaltyConfig] = useState<TahfizhPenaltyConfig>(initialPenalty);
  const [catatanGuru, setCatatanGuru] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [waktu, setWaktu] = useState(new Date().toTimeString().slice(0, 5));
  const [manualStopReason, setManualStopReason] = useState("");
  const [isManualStopped, setIsManualStopped] = useState(false);
  const [juzToAdd, setJuzToAdd] = useState(getInitialJuz(initialAssessments));
  const [activeJuz, setActiveJuz] = useState(getInitialJuz(initialAssessments));
  const [manualKelancaranRows, setManualKelancaranRows] = useState<Set<number>>(new Set());
  const [autoFailConfig, setAutoFailConfig] = useState<TahfizhAutoFailConfig>(getStoredAutoFailConfig);

  const isCertificate = mode === "Sertifikat";
  const selectedJuzList = useMemo(() => getSelectedJuzList(assessments), [assessments]);
  const activeJuzList = isCertificate ? selectedJuzList : getRegularJuzOptions(assessments);
  const visibleAssessments = assessments
    .map((assessment, index) => ({ assessment, index }))
    .filter((item) => Number(item.assessment.juz || 30) === activeJuz);
  const examResult = useMemo(
    () =>
      calculateTahfizhExamResult(
        assessments,
        mode,
        penaltyConfig,
        isManualStopped ? manualStopReason || "Dihentikan manual" : "",
        false,
        autoFailConfig
      ),
    [assessments, mode, penaltyConfig, isManualStopped, manualStopReason, autoFailConfig]
  );

  const isStopped = isManualStopped || examResult.autoFail.isFailed;
  const totalCertificateRows = selectedJuzList.reduce(
    (sum, juz) => sum + getCertificateSequenceForJuz(juz).length,
    0
  );
  const progress = isCertificate
    ? Math.min(100, Math.round((assessments.length / Math.max(totalCertificateRows, 1)) * 100))
    : 100;

  const promptMaxErrorDecision = (nextAssessments: TahfizhSurahAssessment[]) => {
    if (!isCertificate || autoFailConfig.ignoreMaxErrors || isManualStopped) return;

    const failState = getTahfizhAutoFailState(
      aggregateTahfizhAssessmentsForDisplay(nextAssessments),
      autoFailConfig
    );
    if (!failState.isFailed) return;

    const message = `${failState.log}\n\nPilih OK untuk melanjutkan ujian dan abaikan batas maksimal kesalahan pada sesi ini.\nPilih Batal untuk menghentikan ujian.`;
    if (window.confirm(message)) {
      setAutoFailConfig((current) => ({ ...current, ignoreMaxErrors: true }));
      toast.warning("Batas maksimal kesalahan diabaikan untuk sesi ujian ini.");
      return;
    }

    setIsManualStopped(true);
    setManualStopReason(failState.log || "Batas maksimal kesalahan tercapai");
    toast.error("Ujian dihentikan karena batas maksimal kesalahan tercapai.");
  };

  const updateAssessment = (index: number, field: keyof TahfizhSurahAssessment, value: AssessmentFieldValue) => {
    if (field === "kelancaran") {
      setManualKelancaranRows((current) => new Set(current).add(index));
    }

    let nextAssessments: TahfizhSurahAssessment[] = [];
    setAssessments((current) =>
      {
        nextAssessments = current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "juz") {
          const juz = Number(value);
          const first = getSurahsForJuz(juz)[0];
          return { ...item, juz, surah: first?.name || "", ayatRange: first?.ayatRange };
        }

        const next = { ...item, [field]: value };
        if ((field === "lahnJali" || field === "salahSambung") && !manualKelancaranRows.has(index)) {
          return { ...next, kelancaran: getAutoKelancaran(next) };
        }

        return next;
        });
        return nextAssessments;
      }
    );

    if (field === "lahnJali" || field === "salahSambung") {
      setTimeout(() => promptMaxErrorDecision(nextAssessments), 0);
    }
  };

  const addAssessment = () => {
    if (isCertificate) {
      addCertificateJuz();
      return;
    }

    setAssessments((current) => [...current, createEmptyTahfizhAssessment(activeJuz || current[0]?.juz || 30)]);
  };

  const removeAssessment = (index: number) => {
    if (assessments.length <= 1 || isCertificate) return;
    setAssessments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const normalizeRegularJuzRows = (juz: number) => {
    setAssessments((current) =>
      normalizeAssessmentsForJuz(current, juz)
    );
  };

  const hydrateRegularRows = (juz: number, count = DEFAULT_REGULAR_ROWS) => {
    setActiveJuz(juz);
    setAssessments((current) => {
      const otherRows = current.filter((item) => Number(item.juz || 30) !== juz);
      return [...otherRows, ...createRegularRows(juz, count)];
    });
    setManualKelancaranRows(new Set());
  };

  const openRegularJuz = (juz: number) => {
    normalizeRegularJuzRows(activeJuz);
    setActiveJuz(juz);
    if (assessments.some((item) => Number(item.juz || 30) === juz)) return;
    setAssessments((current) => [...current, ...createRegularRows(juz)]);
  };

  const addRegularJuz = () => {
    if (isCertificate) return;
    if (selectedJuzList.includes(juzToAdd)) {
      toast.warning("Juz ini sudah ditambahkan.");
      setActiveJuz(juzToAdd);
      return;
    }
    setAssessments((current) => [...current, ...createRegularRows(juzToAdd)]);
    setActiveJuz(juzToAdd);
    toast.success(`Juz ${juzToAdd} ditambahkan.`);
  };

  const removeRegularJuz = (juz: number) => {
    if (isCertificate) return;
    if (selectedJuzList.length <= 1) {
      toast.warning("Minimal harus ada satu juz.");
      return;
    }

    setAssessments((current) => current.filter((item) => Number(item.juz || 30) !== juz));
    if (activeJuz === juz) {
      setActiveJuz(selectedJuzList.find((item) => item !== juz) || 30);
    }
    setManualKelancaranRows(new Set());
    toast.success(`Juz ${juz} dihapus.`);
  };

  const addCertificateJuz = () => {
    if (!isCertificate) return;
    if (selectedJuzList.includes(juzToAdd)) {
      toast.warning("Juz ini sudah ditambahkan.");
      return;
    }

    setAssessments((current) => [...current, ...getCertificateSequenceForJuz(juzToAdd)]);
    setActiveJuz(juzToAdd);
    toast.success(`Juz ${juzToAdd} ditambahkan.`);
  };

  const removeCertificateJuz = (juz: number) => {
    if (!isCertificate) return;
    if (selectedJuzList.length <= 1) {
      toast.warning("Minimal harus ada satu juz.");
      return;
    }

    setAssessments((current) => current.filter((item) => Number(item.juz || 30) !== juz));
    if (activeJuz === juz) {
      setActiveJuz(selectedJuzList.find((item) => item !== juz) || 30);
    }
    setManualKelancaranRows(new Set());
    toast.success(`Juz ${juz} dihapus.`);
  };

  const handleSubmit = (publish: boolean) => {
    const finalAssessments = isCertificate ? assessments : normalizeAssessmentsForJuz(assessments, activeJuz);
    if (!isCertificate) setAssessments(finalAssessments);

    const errors = finalAssessments
      .map((item, index) => ({ index, error: validateRow(item) }))
      .filter((item) => item.error);

    if (errors.length > 0) {
      alert(`Validasi gagal:\n${errors.map((item) => `Baris ${item.index + 1}: ${item.error}`).join("\n")}`);
      return;
    }

    onSubmit({
      assessments: finalAssessments,
      config: penaltyConfig,
      nilaiAkhir: examResult.nilaiAkhir,
      predikat: examResult.predikat,
      status: examResult.status,
      grade: examResult.grade,
      statusLabel: examResult.statusLabel,
      catatanGuru,
      tanggal,
      waktu,
      documentStatus: publish ? "Published" : "Draft",
      manualStopReason: isManualStopped ? manualStopReason || "Dihentikan manual oleh penguji" : undefined,
      autoFailLog: examResult.autoFail.log,
      autoFailConfig,
    });
  };

  return (
    <div className="w-full min-w-0 space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </button>

      <div className="grid gap-4 rounded-2xl border border-border bg-muted/30 p-4 shadow-sm lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forum Ujian Tahfizh</p>
              <h4 className="break-words text-lg font-semibold text-foreground">Mode {mode}</h4>
              <p className="text-xs text-muted-foreground">
                {isCertificate
                  ? `${selectedJuzList.length} juz aktif, ${assessments.length} baris penilaian`
                  : "Mode Reguler memakai 5 soal default dan bisa diedit manual."}
              </p>
            </div>
            <StatusPill status={examResult.statusLabel} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tanggal">
              <input
                type="date"
                value={tanggal}
                disabled={isStopped}
                onChange={(event) => setTanggal(event.target.value)}
                className="field-input min-w-0"
              />
            </Field>
            <Field label="Waktu">
              <input
                type="time"
                value={waktu}
                disabled={isStopped}
                onChange={(event) => setWaktu(event.target.value)}
                className="field-input min-w-0"
              />
            </Field>
            {!isCertificate && (
              <Field label="Tampilkan Juz">
                <select
                  value={activeJuz}
                  disabled={isStopped}
                  onChange={(event) => openRegularJuz(Number(event.target.value))}
                  className="field-input min-w-0"
                >
                  {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                    <option key={juz} value={juz}>
                      Juz {juz}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Progress">
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Terisi</span>
                  <span className="font-semibold text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Preview Hasil</p>
          <p className="mt-1 text-4xl font-bold text-foreground">{examResult.nilaiAkhir}</p>
          <p className="text-sm font-semibold text-primary">{examResult.predikat} - Grade {examResult.grade}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Lahn Jali: {examResult.autoFail.totalLahnJali || 0}/{autoFailConfig.lahnJaliMax} | Salah Sambung: {examResult.autoFail.totalSalahSambung || 0}/{autoFailConfig.salahSambungMax}
          </p>
        </div>
      </div>

      <JuzTabs
        activeJuz={activeJuz}
        disabled={isStopped}
        juzToAdd={juzToAdd}
        juzList={activeJuzList}
        summaries={examResult.summaries}
        onAdd={isCertificate ? addCertificateJuz : addRegularJuz}
        onChangeJuzToAdd={setJuzToAdd}
        onRemove={isCertificate ? removeCertificateJuz : removeRegularJuz}
        onSelect={(juz) => (isCertificate ? setActiveJuz(juz) : openRegularJuz(juz))}
      />

      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h5 className="text-sm font-semibold text-foreground">Rumus Penalti dan Batas Maksimal Kesalahan</h5>
            <p className="text-xs text-muted-foreground">
              Kelancaran otomatis: 0 kesalahan = 100, 1-2 = 90, 3-5 = 80, 6-8 = 70, 9+ = 60. Batas maksimal hanya untuk Lahn Jali dan Salah Sambung.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["lahnJali", "lahnKhofi", "waqaf", "salahSambung"] as const).map((key) => (
              <Field key={key} label={penaltyLabel(key)}>
                <input
                  type="number"
                  min={0}
                  value={penaltyConfig[key]}
                  disabled={isStopped}
                  onChange={(event) =>
                    setPenaltyConfig((current) => ({
                      ...current,
                      [key]: Math.max(0, toSafeNumber(event.target.value, current[key])),
                    }))
                  }
                  className="field-input min-w-0"
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Maksimal Lahn Jali">
            <input
              type="number"
              min={1}
              value={autoFailConfig.lahnJaliMax}
              disabled={isManualStopped}
              onChange={(event) =>
                setAutoFailConfig((current) => ({
                  ...current,
                  lahnJaliMax: Math.max(1, toSafeNumber(event.target.value, current.lahnJaliMax)),
                }))
              }
              className="field-input min-w-0"
            />
          </Field>
          <Field label="Maksimal Salah Sambung">
            <input
              type="number"
              min={1}
              value={autoFailConfig.salahSambungMax}
              disabled={isManualStopped}
              onChange={(event) =>
                setAutoFailConfig((current) => ({
                  ...current,
                  salahSambungMax: Math.max(1, toSafeNumber(event.target.value, current.salahSambungMax)),
                }))
              }
              className="field-input min-w-0"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={Boolean(autoFailConfig.ignoreMaxErrors)}
                onChange={(event) =>
                  setAutoFailConfig((current) => ({ ...current, ignoreMaxErrors: event.target.checked }))
                }
              />
              Abaikan batas
            </label>
            <button
              type="button"
              onClick={() => toast.success("Batas maksimal dipakai untuk sesi ujian ini.")}
              className="rounded-xl border border-input px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              Simpan sesi ini
            </button>
            <button
              type="button"
              onClick={() => {
                saveStoredAutoFailConfig({ ...autoFailConfig, ignoreMaxErrors: false });
                toast.success("Default batas maksimal untuk ujian Tahfizh mendatang tersimpan.");
              }}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Simpan default mendatang
            </button>
          </div>
        </div>
      </div>

      {examResult.autoFail.isFailed && (
        <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{examResult.autoFail.log} Ujian otomatis ditandai gagal dan siap disimpan.</span>
        </div>
      )}

      {isManualStopped && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <Square className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ujian dihentikan manual. Data akan tersimpan sebagai ujian diulang/gagal.</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h5 className="text-sm font-semibold text-foreground">Penilaian</h5>
            <p className="text-xs text-muted-foreground">
              {isCertificate ? "Field Juz dan Surat/Grup dikunci untuk menjaga sequence sertifikat." : "Juz, surat, dan ayat bisa diedit per baris."}
            </p>
          </div>
          {!isCertificate && (
            <button
              type="button"
              onClick={() => hydrateRegularRows(activeJuz)}
              disabled={isStopped}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              Reset 5 Soal
            </button>
          )}
        </div>

        {visibleAssessments.map(({ assessment, index }) => (
          <TahfizhAssessmentInput
            key={`${assessment.juz}-${index}`}
            assessment={assessment}
            index={index}
            mode={mode}
            penaltyConfig={penaltyConfig}
            disabled={isStopped}
            onUpdate={updateAssessment}
            onRemove={removeAssessment}
            showRemove={!isCertificate && visibleAssessments.length > 1}
          />
        ))}

        {!isCertificate && (
          <button
            type="button"
            onClick={addAssessment}
            disabled={isStopped}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah Soal
          </button>
        )}
      </div>

      {isCertificate && examResult.summaries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {examResult.summaries.map((summary) => (
            <div key={summary.juz} className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-foreground">Ringkasan Juz {summary.juz}</p>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {summary.nilaiJuz}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Soal: {summary.jumlahSoal}</span>
                <span>Rata: {summary.rataKelancaran}</span>
                <span>Lahn Jali: {summary.totalLahnJali}</span>
                <span>Lahn Khofi: {summary.totalLahnKhofi}</span>
                <span>Waqaf: {summary.totalWaqaf}</span>
                <span>Sambung: {summary.totalSalahSambung}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <Field label="Catatan Guru">
          <textarea
            value={catatanGuru}
            disabled={isStopped}
            onChange={(event) => setCatatanGuru(event.target.value)}
            placeholder="Catatan otomatis lama tetap digunakan saat kolom ini dikosongkan di rapor."
            className="min-h-[92px] w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>

        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <button
            type="button"
            onClick={() => setIsManualStopped(true)}
            disabled={isStopped}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" /> Hentikan Ujian Manual
          </button>
          <input
            value={manualStopReason}
            disabled={examResult.autoFail.isFailed}
            onChange={(event) => setManualStopReason(event.target.value)}
            placeholder="Alasan opsional penghentian manual"
            className="field-input min-w-0"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
        >
          Simpan Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Lock className="h-4 w-4" /> Publish & Kunci
        </button>
      </div>
    </div>
  );
}

function validateRow(assessment: TahfizhSurahAssessment) {
  if (!assessment.surah?.trim()) return "Nama surat wajib diisi";
  if (!Number.isFinite(assessment.juz) || assessment.juz < 1 || assessment.juz > 30) return "Juz harus antara 1-30";
  if (!Number.isFinite(assessment.kelancaran) || assessment.kelancaran < 0 || assessment.kelancaran > 100) return "Kelancaran harus 0-100";
  if ([assessment.lahnJali, assessment.lahnKhofi, assessment.waqaf, assessment.salahSambung].some((value) => !Number.isFinite(value) || value < 0)) {
    return "Jumlah kesalahan harus berupa angka 0 atau lebih";
  }
  return "";
}

function penaltyLabel(key: keyof TahfizhPenaltyConfig) {
  const labels: Record<keyof TahfizhPenaltyConfig, string> = {
    lahnJali: "Lahn Jali",
    lahnKhofi: "Lahn Khofi",
    waqaf: "Waqaf",
    salahSambung: "Salah Sambung",
  };
  return labels[key];
}

function JuzTabs({
  activeJuz,
  disabled,
  juzToAdd,
  juzList,
  summaries,
  onAdd,
  onChangeJuzToAdd,
  onRemove,
  onSelect,
}: {
  activeJuz: number;
  disabled: boolean;
  juzToAdd: number;
  juzList: number[];
  summaries: { juz: number; jumlahSoal: number; nilaiJuz: number }[];
  onAdd: () => void;
  onChangeJuzToAdd: (juz: number) => void;
  onRemove: (juz: number) => void;
  onSelect: (juz: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h5 className="text-sm font-semibold text-foreground">Navigasi Juz</h5>
          <p className="text-xs text-muted-foreground">
            Klik satu juz untuk fokus menginput baris juz tersebut saja.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[150px_auto]">
          <select
            value={juzToAdd}
            disabled={disabled}
            onChange={(event) => onChangeJuzToAdd(Number(event.target.value))}
            className="field-input min-w-0"
          >
            {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
              <option key={juz} value={juz}>
                Juz {juz}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah Juz
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {juzList.map((juz) => {
          const summary = summaries.find((item) => item.juz === juz);
          const active = activeJuz === juz;
          return (
            <div
              key={juz}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-muted/30 text-foreground hover:border-primary hover:bg-primary/10"
              }`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(juz)}
                className="pr-2 text-left disabled:cursor-not-allowed"
              >
                <span className="block font-semibold">Juz {juz}</span>
                <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>
                  {summary ? `${summary.jumlahSoal} soal | ${summary.nilaiJuz}` : "Belum diisi"}
                </span>
              </button>
              <button
                type="button"
                disabled={disabled || juzList.length <= 1}
                onClick={() => onRemove(juz)}
                title={`Hapus Juz ${juz}`}
                className={`ml-1 rounded-lg p-1 align-top disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? "text-primary-foreground hover:bg-primary-foreground/15" : "text-destructive hover:bg-destructive/10"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
      <span className="truncate">{status}</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-xs font-medium text-muted-foreground">
      <span className="mb-1 block truncate">{label}</span>
      {children}
    </label>
  );
}

function TahfizhAssessmentInput({
  assessment,
  index,
  mode,
  penaltyConfig,
  disabled,
  onUpdate,
  onRemove,
  showRemove,
}: {
  assessment: TahfizhSurahAssessment;
  index: number;
  mode: TahfizhExamMode;
  penaltyConfig: TahfizhPenaltyConfig;
  disabled: boolean;
  onUpdate: (index: number, field: keyof TahfizhSurahAssessment, value: AssessmentFieldValue) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  const nilaiSurah = calculateTahfizhSurahScore(assessment, penaltyConfig);
  const regularMode = mode === "Reguler";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const surahSuggestions = useMemo(() => {
    return getSurahSearchResults(assessment.juz, assessment.surah);
  }, [assessment.juz, assessment.surah]);
  const topSuggestion = surahSuggestions[0]?.item;
  const commitBestSurahMatch = () => {
    if (!regularMode || !assessment.surah?.trim()) return;
    const match = findBestSurahMatch(assessment.juz, assessment.surah);
    if (!match || match.score < 25) return;
    onUpdate(index, "surah", match.item.name);
    onUpdate(index, "ayatRange", match.item.ayatRange || "");
  };

  return (
    <div className="w-full min-w-0 rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">No {index + 1}</p>
          <p className="break-words text-xs text-muted-foreground">{assessment.sequenceLabel || assessment.surah || "Belum ada surat"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-3 w-3" /> {nilaiSurah}
          </span>
          {showRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
              title="Hapus baris"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Juz">
          <select
            value={assessment.juz}
            disabled={disabled || mode === "Sertifikat"}
            onChange={(event) => onUpdate(index, "juz", Number(event.target.value))}
            className="field-input min-w-0"
          >
            {Array.from({ length: 30 }, (_, itemIndex) => itemIndex + 1).map((juz) => (
              <option key={juz} value={juz}>
                Juz {juz}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Surat / Grup">
          {regularMode ? (
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={assessment.surah}
                disabled={disabled}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => {
                  commitBestSurahMatch();
                  setTimeout(() => setIsSearchOpen(false), 120);
                }}
                onChange={(event) => {
                  onUpdate(index, "surah", event.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && topSuggestion) {
                    event.preventDefault();
                    onUpdate(index, "surah", topSuggestion.name);
                    onUpdate(index, "ayatRange", topSuggestion.ayatRange || "");
                    setIsSearchOpen(false);
                  }
                  if (event.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
                autoComplete="off"
                placeholder="Ketik nama surat atau grup"
                className="field-input min-w-0 pr-9"
              />
              {isSearchOpen && !disabled && (
                <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-sm shadow-xl">
                  <div className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Hasil pencarian surat Juz {assessment.juz}
                  </div>
                  {surahSuggestions.length > 0 ? (
                    surahSuggestions.map(({ item }, itemIndex) => (
                      <button
                        key={`${item.name}-${item.ayatRange || "full"}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onUpdate(index, "surah", item.name);
                          onUpdate(index, "ayatRange", item.ayatRange || "");
                          setIsSearchOpen(false);
                        }}
                        className={`block w-full rounded-xl px-3 py-2 text-left transition-colors ${
                          itemIndex === 0 ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="block font-medium">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">{item.ayatRange ? `Ayat ${item.ayatRange}` : `${item.ayatCount} ayat`}</span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl bg-muted/40 px-3 py-3 text-muted-foreground">
                      Tidak ada hasil. Tetap boleh tulis manual.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <input
              value={assessment.sequenceLabel || assessment.surah}
              disabled
              className="field-input min-w-0"
            />
          )}
        </Field>

        <Field label="Ayat Awal">
          <input
            value={assessment.ayatAwal ?? ""}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "ayatAwal", event.target.value)}
            placeholder={assessment.ayatRange || "-"}
            className="field-input min-w-0"
          />
        </Field>

        <Field label="Ayat Akhir">
          <input
            value={assessment.ayatAkhir ?? ""}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "ayatAkhir", event.target.value)}
            placeholder={assessment.ayatRange || "-"}
            className="field-input min-w-0"
          />
        </Field>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="Kelancaran">
          <select
            value={assessment.kelancaran}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "kelancaran", Number(event.target.value))}
            className="field-input min-w-0"
          >
            {KELANCARAN_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <NumberField label="Lahn Jali" value={assessment.lahnJali} disabled={disabled} onChange={(value) => onUpdate(index, "lahnJali", value)} />
        <NumberField label="Lahn Khofi" value={assessment.lahnKhofi} disabled={disabled} onChange={(value) => onUpdate(index, "lahnKhofi", value)} />
        <NumberField label="Waqaf" value={assessment.waqaf} disabled={disabled} onChange={(value) => onUpdate(index, "waqaf", value)} />
        <NumberField label="Sambung" value={assessment.salahSambung} disabled={disabled} onChange={(value) => onUpdate(index, "salahSambung", value)} />
        <Field label="Nilai">
          <div className="rounded-xl border border-input bg-muted px-3 py-2 text-center text-sm font-semibold text-foreground">
            {nilaiSurah}
          </div>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Catatan">
          <textarea
            value={assessment.catatan || ""}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "catatan", event.target.value)}
            className="min-h-[58px] w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Math.max(0, toSafeNumber(event.target.value, value)))}
        className="field-input min-w-0"
      />
    </Field>
  );
}
