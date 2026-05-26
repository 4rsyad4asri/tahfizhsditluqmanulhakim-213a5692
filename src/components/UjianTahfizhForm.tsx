import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Lock, Plus, Square, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  DEFAULT_TAHFIZH_PENALTY,
  calculateTahfizhExamResult,
  calculateTahfizhSurahScore,
  calculateAutoTahfizhKelancaran,
  createCertificateAssessment,
  createEmptyTahfizhAssessment,
  getCertificateSequenceForJuz,
  normalizeTahfizhAssessment,
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
    status: "Lulus" | "Tidak Lulus" | "Ulang";
    grade: string;
    catatanGuru: string;
    tanggal: string;
    waktu: string;
    statusLabel: string;
    documentStatus: "Draft" | "Published";
    manualStopReason?: string;
    autoFailLog?: string;
  }) => void;
  onCancel: () => void;
}

const KELANCARAN_OPTIONS = [100, 90, 80, 70, 60];
const NUMBER_FIELDS = [
  { key: "lahnJali", label: "LJ" },
  { key: "lahnKhofi", label: "LK" },
  { key: "waqaf", label: "Waqaf" },
  { key: "salahSambung", label: "Sambung" },
] as const;

const TAHFIZH_SETTINGS_STORAGE_KEY = "tahfizh_penalty_settings";

function loadTahfizhPenaltySettings(initialPenalty: TahfizhPenaltyConfig): TahfizhPenaltyConfig {
  if (typeof window === "undefined") return initialPenalty;

  try {
    const raw = window.localStorage.getItem(TAHFIZH_SETTINGS_STORAGE_KEY);
    if (!raw) return initialPenalty;

    const parsed = JSON.parse(raw);

    return {
      ...initialPenalty,
      maxLahnJali: Math.max(1, Number(parsed.maxLahnJali ?? initialPenalty.maxLahnJali ?? 10)),
      maxSalahSambung: Math.max(1, Number(parsed.maxSalahSambung ?? initialPenalty.maxSalahSambung ?? 10)),
    };
  } catch {
    return initialPenalty;
  }
}

function createRegularRows(juz = 30) {
  return Array.from({ length: 5 }, () => ({
    ...createEmptyTahfizhAssessment(juz),
    surah: "",
    ayatRange: "",
  }));
}

function getInitialJuz(initialAssessments?: TahfizhSurahAssessment[]) {
  return initialAssessments?.[0]?.juz || 30;
}

function initialRows(mode: TahfizhExamMode, initialAssessments?: TahfizhSurahAssessment[]) {
  if (initialAssessments?.length) return initialAssessments.map(normalizeTahfizhAssessment);
  if (mode === "Sertifikat") return getCertificateSequenceForJuz(30);
  return createRegularRows(30);
}

export default function UjianTahfizhForm({
  mode,
  initialAssessments,
  initialPenalty = DEFAULT_TAHFIZH_PENALTY,
  isPending = false,
  onSubmit,
  onCancel,
}: UjianTahfizhFormProps) {
  const [selectedJuz, setSelectedJuz] = useState(getInitialJuz(initialAssessments));
  const [assessments, setAssessments] = useState<TahfizhSurahAssessment[]>(
    initialRows(mode, initialAssessments)
  );
  const [penaltyConfig, setPenaltyConfig] = useState<TahfizhPenaltyConfig>(() =>
    loadTahfizhPenaltySettings({
      ...DEFAULT_TAHFIZH_PENALTY,
      ...initialPenalty,
    })
  );
  const [isEditingMaxError, setIsEditingMaxError] = useState(false);
  const [catatanGuru, setCatatanGuru] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [waktu, setWaktu] = useState(new Date().toTimeString().slice(0, 5));
  const [manualStopReason, setManualStopReason] = useState("");
  const [isManualStopped, setIsManualStopped] = useState(false);

  const isCertificate = mode === "Sertifikat";
  const certificateSequence = useMemo(
    () => getCertificateSequenceForJuz(selectedJuz),
    [selectedJuz]
  );
  const examResult = useMemo(
    () =>
      calculateTahfizhExamResult(
        assessments,
        mode,
        penaltyConfig,
        isManualStopped ? manualStopReason || "Dihentikan manual" : ""
      ),
    [assessments, mode, penaltyConfig, isManualStopped, manualStopReason]
  );
  const isStopped = isManualStopped || examResult.autoFail.isFailed;
  const progress = isCertificate
    ? Math.round((assessments.length / Math.max(1, certificateSequence.length)) * 100)
    : 100;

  const changeJuz = (juz: number) => {
    setSelectedJuz(juz);
    setIsManualStopped(false);
    setManualStopReason("");
    if (isCertificate) {
      setAssessments(getCertificateSequenceForJuz(juz));
    } else {
      setAssessments((current) =>
        current.map((item) => ({ ...item, juz }))
      );
    }
  };

  const updateAssessment = (index: number, field: keyof TahfizhSurahAssessment, value: any) => {
    setAssessments((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "juz") {
          return { ...item, juz: Number(value) };
        }

        if (field === "kelancaran") {
          return {
            ...item,
            kelancaran: Math.max(0, Math.min(100, Number(value) || 0)),
            kelancaranManual: true,
          };
        }

        const updated = { ...item, [field]: value };

        if (
          (field === "lahnJali" || field === "salahSambung") &&
          !item.kelancaranManual
        ) {
          return {
            ...updated,
            kelancaran: calculateAutoTahfizhKelancaran(updated, penaltyConfig),
          };
        }

        return updated;
      })
    );
  };

  const saveMaxErrorSettings = () => {
    const nextConfig = {
      ...penaltyConfig,
      maxLahnJali: Math.max(1, Number(penaltyConfig.maxLahnJali ?? 10)),
      maxSalahSambung: Math.max(1, Number(penaltyConfig.maxSalahSambung ?? 10)),
    };

    setPenaltyConfig(nextConfig);

    window.localStorage.setItem(
      TAHFIZH_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        maxLahnJali: nextConfig.maxLahnJali,
        maxSalahSambung: nextConfig.maxSalahSambung,
      })
    );

    setIsEditingMaxError(false);
    toast.success("Standar penilaian berhasil disimpan.");
  };

  const quickPickSurah = (index: number, value: string) => {
    const selected = getSurahsForJuz(assessments[index]?.juz || selectedJuz).find(
      (item) => item.name === value
    );

    setAssessments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              surah: value,
              ayatRange: selected?.ayatRange || "",
              ayatAwal: "",
              ayatAkhir: "",
            }
          : item
      )
    );
  };

  const addAssessment = () => {
    if (isCertificate) {
      return;
    }

    setAssessments((current) => [...current, { ...createEmptyTahfizhAssessment(selectedJuz), surah: "" }]);
  };

  const removeAssessment = (index: number) => {
    if (assessments.length <= 1 || isCertificate) return;
    setAssessments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetRegularRows = () => {
    setAssessments(createRegularRows(selectedJuz));
  };

  const handleSubmit = (publish: boolean) => {
    const errors = assessments
      .map((item, index) => ({ index, error: validateRow(item) }))
      .filter((item) => item.error);

    if (errors.length > 0) {
      alert(`Validasi gagal:\n${errors.map((item) => `Baris ${item.index + 1}: ${item.error}`).join("\n")}`);
      return;
    }

    onSubmit({
      assessments,
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
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-base font-semibold text-foreground">Form Ujian Tahfizh - Mode {mode}</h4>
            <p className="text-xs text-muted-foreground">
            {isCertificate
                ? `Urutan sertifikat Juz ${selectedJuz}: ${certificateSequence.length} baris langsung tampil`
                : "Mode reguler memakai 5 soal bebas. Tambah baris hanya bila diperlukan."}
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 items-center justify-center gap-2 self-start rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-muted lg:self-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali
            </button>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <MiniField label="Tanggal">
              <input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} className="sheet-input h-8" />
            </MiniField>
            <MiniField label="Waktu">
              <input type="time" value={waktu} onChange={(event) => setWaktu(event.target.value)} className="sheet-input h-8" />
            </MiniField>
            <MiniField label="Juz">
              <select value={selectedJuz} onChange={(event) => changeJuz(Number(event.target.value))} className="sheet-input h-8">
                {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                  <option key={juz} value={juz}>Juz {juz}</option>
                ))}
              </select>
            </MiniField>
            <Metric label="Nilai" value={String(examResult.nilaiAkhir)} />
            <Metric label="Status" value={examResult.statusLabel} compact />
            </div>
          </div>
        </div>

        {isCertificate && (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_150px] md:items-center">
            <Progress value={progress} className="h-2" />
            <div className="text-xs font-medium text-muted-foreground">{progress}% selesai</div>
          </div>
        )}
      </div>

      <div className="grid gap-3 border-b border-border bg-muted/20 px-4 py-3 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid grid-cols-4 gap-2">
            {NUMBER_FIELDS.map((field) => (
              <MiniField key={field.key} label={`P ${field.label}`}>
                <input
                  type="number"
                  min={0}
                  value={penaltyConfig[field.key]}
                  onChange={(event) =>
                    setPenaltyConfig((current) => ({
                      ...current,
                      [field.key]: Number(event.target.value) || 0,
                    }))
                  }
                  className="sheet-input h-8 w-16"
                />
              </MiniField>
            ))}
          </div>

          {!isCertificate && (
            <button
              type="button"
              onClick={addAssessment}
              disabled={isStopped}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Soal
            </button>
          )}

          {!isCertificate && (
            <button
              type="button"
              onClick={resetRegularRows}
              disabled={isStopped}
              className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Reset 5 Soal
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsManualStopped(true)}
            disabled={isStopped}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            Hentikan Manual
          </button>
        </div>

        <input
          value={manualStopReason}
          onChange={(event) => setManualStopReason(event.target.value)}
          placeholder="Alasan penghentian manual"
          className="sheet-input h-8"
        />
      </div>

      <div className="rounded-md border border-border bg-background p-3 mx-4 my-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Standar Maksimal Kesalahan
            </p>
            <p className="text-[11px] text-muted-foreground">
              Jika batas per juz tercapai, status otomatis menjadi Ulang.
            </p>
          </div>

          {!isEditingMaxError ? (
            <button
              type="button"
              onClick={() => setIsEditingMaxError(true)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              Ubah
            </button>
          ) : (
            <button
              type="button"
              onClick={saveMaxErrorSettings}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Simpan
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniField label="Maks. Lahn Jali">
            <input
              type="number"
              min={1}
              value={penaltyConfig.maxLahnJali ?? 10}
              disabled={!isEditingMaxError}
              onChange={(event) =>
                setPenaltyConfig((current) => ({
                  ...current,
                  maxLahnJali: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              className="sheet-input h-8"
            />
          </MiniField>

          <MiniField label="Maks. Salah Sambung">
            <input
              type="number"
              min={1}
              value={penaltyConfig.maxSalahSambung ?? 10}
              disabled={!isEditingMaxError}
              onChange={(event) =>
                setPenaltyConfig((current) => ({
                  ...current,
                  maxSalahSambung: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              className="sheet-input h-8"
            />
          </MiniField>
        </div>
      </div>

      {(examResult.autoFail.isFailed || isManualStopped) && (
        <div className="border-b border-border px-4 py-2">
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {examResult.autoFail.log ||
                "Ujian dihentikan manual. Data akan tersimpan sebagai ujian diulang/gagal."}
            </span>
          </div>
        </div>
      )}

      <div className="max-h-[430px] overflow-auto">
        <table className="w-full min-w-[1120px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
            <tr className="border-b border-border">
              <SheetTh className="w-10">No</SheetTh>
              <SheetTh className="w-20">Juz</SheetTh>
              <SheetTh className="w-56">Surat / Grup</SheetTh>
              {!isCertificate && <SheetTh className="w-44">Pilih Cepat</SheetTh>}
              {!isCertificate && <SheetTh className="w-24">Ayat Awal</SheetTh>}
              {!isCertificate && <SheetTh className="w-24">Ayat Akhir</SheetTh>}
              <SheetTh className="w-24">Lancar</SheetTh>
              <SheetTh className="w-20">LJ</SheetTh>
              <SheetTh className="w-20">LK</SheetTh>
              <SheetTh className="w-20">Waqaf</SheetTh>
              <SheetTh className="w-20">Sambung</SheetTh>
              <SheetTh className="w-56">Catatan</SheetTh>
              <SheetTh className="w-20">Nilai</SheetTh>
              <SheetTh className="w-12"></SheetTh>
            </tr>
          </thead>
          <tbody>
            {assessments.map((assessment, index) => (
              <SheetRow
                key={`${assessment.surah}-${index}`}
                assessment={assessment}
                index={index}
                mode={mode}
                penaltyConfig={penaltyConfig}
                disabled={isStopped}
                onUpdate={updateAssessment}
                onQuickPick={quickPickSurah}
                onRemove={removeAssessment}
                showRemove={!isCertificate && assessments.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {examResult.summaries.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-3 m-4 text-xs">
          <p className="mb-2 font-semibold text-foreground">Ringkasan Nilai per Juz</p>
          <div className="grid gap-1">
            {examResult.summaries.map((summary) => (
              <div
                key={summary.juz}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-background px-2 py-1"
              >
                <span>Juz {summary.juz}</span>
                <span>{summary.jumlahSoal} soal</span>
                <span>Rata-rata: {summary.nilaiJuz}</span>
                <span>LJ: {summary.totalLahnJali}</span>
                <span>Sambung: {summary.totalSalahSambung}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 border-t border-border px-4 py-3 lg:grid-cols-[1fr_280px]">
        <textarea
          value={catatanGuru}
          onChange={(event) => setCatatanGuru(event.target.value)}
          placeholder="Catatan guru umum. Jika kosong, rapor tetap memakai catatan otomatis lama."
          className="min-h-[68px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Predikat" value={examResult.predikat} />
          <Metric label="Grade" value={examResult.grade} />
          <Metric
            label="Kesalahan Kunci"
            value={`LJ ${examResult.autoFail.totalLahnJali ?? 0}/${examResult.autoFail.maxLahnJali ?? 10} • S ${examResult.autoFail.totalSalahSambung ?? 0}/${examResult.autoFail.maxSalahSambung ?? 10}`}
            compact
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        <button type="button" onClick={onCancel} className="h-9 rounded-md border border-input px-4 text-sm font-medium">
          Batal
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="h-9 rounded-md bg-muted px-4 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
        >
          Simpan Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Lock className="h-4 w-4" /> Publish & Kunci
        </button>
      </div>
    </div>
  );
}

function validateRow(assessment: TahfizhSurahAssessment) {
  if (!assessment.surah?.trim()) return "Nama surat wajib diisi";
  if (assessment.juz < 1 || assessment.juz > 30) return "Juz harus antara 1-30";
  if (assessment.kelancaran < 0 || assessment.kelancaran > 100) return "Kelancaran harus 0-100";
  return "";
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className={compact ? "truncate text-xs font-semibold text-foreground" : "truncate text-lg font-bold text-foreground"}>
        {value}
      </p>
    </div>
  );
}

function SheetTh({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`border-r border-border px-2 py-2 text-left font-semibold ${className}`}>{children}</th>;
}

function SheetTd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-r border-border px-1.5 py-1.5 align-top ${className}`}>{children}</td>;
}

function SheetRow({
  assessment,
  index,
  mode,
  penaltyConfig,
  disabled,
  onUpdate,
  onQuickPick,
  onRemove,
  showRemove,
}: {
  assessment: TahfizhSurahAssessment;
  index: number;
  mode: TahfizhExamMode;
  penaltyConfig: TahfizhPenaltyConfig;
  disabled: boolean;
  onUpdate: (index: number, field: keyof TahfizhSurahAssessment, value: any) => void;
  onQuickPick: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  const nilaiSurah = calculateTahfizhSurahScore(assessment, penaltyConfig);
  const isCertificate = mode === "Sertifikat";
  const quickOptions = getSurahsForJuz(assessment.juz);

  return (
    <tr className="border-b border-border odd:bg-background even:bg-muted/20 hover:bg-primary/5">
      <SheetTd className="text-center font-semibold text-muted-foreground">{index + 1}</SheetTd>
      <SheetTd>
        <select
          value={assessment.juz}
          disabled={disabled || isCertificate}
          onChange={(event) => onUpdate(index, "juz", Number(event.target.value))}
          className="sheet-cell"
        >
          {Array.from({ length: 30 }, (_, itemIndex) => itemIndex + 1).map((juz) => (
            <option key={juz} value={juz}>{juz}</option>
          ))}
        </select>
      </SheetTd>
      <SheetTd>
        <input
          value={assessment.surah}
          disabled={disabled || isCertificate}
          onChange={(event) => onUpdate(index, "surah", event.target.value)}
          className="sheet-cell font-medium"
          placeholder="Nama surat"
        />
      </SheetTd>
      {!isCertificate && (
        <SheetTd>
          <select
            value={quickOptions.some((item) => item.name === assessment.surah) ? assessment.surah : ""}
            disabled={disabled}
            onChange={(event) => onQuickPick(index, event.target.value)}
            className="sheet-cell"
          >
            <option value="">Custom</option>
            {quickOptions.map((item) => (
              <option key={`${item.name}-${item.ayatRange || "full"}`} value={item.name}>
                {getSurahLabel(item)}
              </option>
            ))}
          </select>
        </SheetTd>
      )}
      {!isCertificate && (
        <SheetTd>
          <input
            value={assessment.ayatAwal ?? ""}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "ayatAwal", event.target.value)}
            className="sheet-cell"
            placeholder={assessment.ayatRange || "-"}
          />
        </SheetTd>
      )}
      {!isCertificate && (
        <SheetTd>
          <input
            value={assessment.ayatAkhir ?? ""}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "ayatAkhir", event.target.value)}
            className="sheet-cell"
            placeholder={assessment.ayatRange || "-"}
          />
        </SheetTd>
      )}
      <SheetTd>
        <select
          value={assessment.kelancaran}
          disabled={disabled}
          onChange={(event) => onUpdate(index, "kelancaran", Number(event.target.value))}
          className="sheet-cell"
        >
          {KELANCARAN_OPTIONS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </SheetTd>
      {NUMBER_FIELDS.map((field) => (
        <SheetTd key={field.key}>
          <input
            type="number"
            min={0}
            value={assessment[field.key]}
            disabled={disabled}
            onChange={(event) => onUpdate(index, field.key, Math.max(0, Number(event.target.value) || 0))}
            className="sheet-cell text-center"
          />
        </SheetTd>
      ))}
      <SheetTd>
        <input
          value={assessment.catatan || ""}
          disabled={disabled}
          onChange={(event) => onUpdate(index, "catatan", event.target.value)}
          className="sheet-cell"
          placeholder="Catatan baris"
        />
      </SheetTd>
      <SheetTd className="text-center">
        <span className="inline-flex min-w-10 justify-center rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
          {nilaiSurah}
        </span>
      </SheetTd>
      <SheetTd className="text-center">
        {showRemove && (
          <button type="button" onClick={() => onRemove(index)} className="rounded p-1 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </SheetTd>
    </tr>
  );
}
