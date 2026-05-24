import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Lock, Plus, Square, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DEFAULT_TAHFIZH_PENALTY,
  JUZ_30_CERTIFICATE_SEQUENCE,
  calculateTahfizhExamResult,
  calculateTahfizhSurahScore,
  createCertificateAssessment,
  createEmptyTahfizhAssessment,
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
    status: "Lulus" | "Tidak Lulus";
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

function initialRows(mode: TahfizhExamMode, initialAssessments?: TahfizhSurahAssessment[]) {
  if (initialAssessments?.length) return initialAssessments.map(normalizeTahfizhAssessment);
  if (mode === "Sertifikat") return [createCertificateAssessment(0)];
  return getSurahsForJuz(30).map((item) => ({
    ...createEmptyTahfizhAssessment(30),
    surah: item.name,
    ayatRange: item.ayatRange,
  }));
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

  const examResult = useMemo(
    () => calculateTahfizhExamResult(assessments, mode, penaltyConfig, isManualStopped ? manualStopReason || "Dihentikan manual" : ""),
    [assessments, mode, penaltyConfig, isManualStopped, manualStopReason]
  );

  const isCertificate = mode === "Sertifikat";
  const isStopped = isManualStopped || examResult.autoFail.isFailed;
  const progress = isCertificate
    ? Math.round((assessments.length / JUZ_30_CERTIFICATE_SEQUENCE.length) * 100)
    : 100;

  const updateAssessment = (index: number, field: keyof TahfizhSurahAssessment, value: any) => {
    setAssessments((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "juz") {
          const juz = Number(value);
          const first = getSurahsForJuz(juz)[0];
          return { ...item, juz, surah: first?.name || "", ayatRange: first?.ayatRange };
        }

        return { ...item, [field]: value };
      })
    );
  };

  const addAssessment = () => {
    if (isCertificate) {
      if (assessments.length >= JUZ_30_CERTIFICATE_SEQUENCE.length) return;
      setAssessments((current) => [...current, createCertificateAssessment(current.length)]);
      return;
    }

    setAssessments((current) => [...current, createEmptyTahfizhAssessment(current[0]?.juz || 30)]);
  };

  const removeAssessment = (index: number) => {
    if (assessments.length <= 1 || isCertificate) return;
    setAssessments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const hydrateRegularRows = (juz: number) => {
    setAssessments(
      getSurahsForJuz(juz).map((item) => ({
        ...createEmptyTahfizhAssessment(juz),
        surah: item.name,
        ayatRange: item.ayatRange,
      }))
    );
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
    <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground">Form Ujian Tahfizh - Mode {mode}</h4>
          <p className="text-xs text-muted-foreground">
            {isCertificate
              ? `Surat ke-${assessments.length} dari ${JUZ_30_CERTIFICATE_SEQUENCE.length} urutan sertifikat Juz 30`
              : "Semua soal tampil sekaligus dan bisa diedit manual."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-right">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-semibold text-foreground">{examResult.statusLabel}</p>
        </div>
      </div>

      {isCertificate && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Progress urutan Juz 30</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tanggal">
          <input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} className="field-input" />
        </Field>
        <Field label="Waktu">
          <input type="time" value={waktu} onChange={(event) => setWaktu(event.target.value)} className="field-input" />
        </Field>
        {!isCertificate && (
          <Field label="Tampilkan Juz">
            <select
              value={assessments[0]?.juz || 30}
              onChange={(event) => hydrateRegularRows(Number(event.target.value))}
              className="field-input"
            >
              {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                <option key={juz} value={juz}>Juz {juz}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="text-sm font-semibold text-foreground">Rumus Penalti</h5>
            <p className="text-xs text-muted-foreground">Nilai = rata kelancaran - akumulasi penalti per juz.</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["lahnJali", "lahnKhofi", "waqaf", "salahSambung"] as const).map((key) => (
              <input
                key={key}
                type="number"
                min={0}
                value={penaltyConfig[key]}
                title={`Penalti ${key}`}
                onChange={(event) => setPenaltyConfig((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))}
                className="h-8 w-14 rounded-md border border-input bg-background px-2 text-xs"
              />
            ))}
          </div>
        </div>
      </div>

      {examResult.autoFail.isFailed && (
        <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{examResult.autoFail.log} Ujian otomatis ditandai gagal dan siap disimpan.</span>
        </div>
      )}

      {isManualStopped && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <Square className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ujian dihentikan manual. Data akan tersimpan sebagai ujian diulang/gagal.</span>
        </div>
      )}

      <div className="space-y-3">
        {assessments.map((assessment, index) => (
          <TahfizhAssessmentInput
            key={`${assessment.surah}-${index}`}
            assessment={assessment}
            index={index}
            mode={mode}
            penaltyConfig={penaltyConfig}
            disabled={isStopped}
            onUpdate={updateAssessment}
            onRemove={removeAssessment}
            showRemove={!isCertificate && assessments.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addAssessment}
          disabled={isStopped || (isCertificate && assessments.length >= JUZ_30_CERTIFICATE_SEQUENCE.length)}
          className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isCertificate ? "Tambah Surat Berikutnya" : "Tambah Baris Soal"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <Field label="Catatan Guru">
          <textarea
            value={catatanGuru}
            onChange={(event) => setCatatanGuru(event.target.value)}
            placeholder="Catatan otomatis lama tetap digunakan saat kolom ini dikosongkan di rapor."
            className="min-h-[86px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Preview Hasil</p>
          <p className="text-3xl font-bold text-foreground">{examResult.nilaiAkhir}</p>
          <p className="text-sm font-semibold text-primary">{examResult.predikat} - Grade {examResult.grade}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            LJ+Sambung: {examResult.autoFail.totalBlockingErrors}/10
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3">
        <button
          type="button"
          onClick={() => setIsManualStopped(true)}
          disabled={isStopped}
          className="mb-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" /> Hentikan Ujian Manual
        </button>
        <input
          value={manualStopReason}
          onChange={(event) => setManualStopReason(event.target.value)}
          placeholder="Alasan opsional penghentian manual"
          className="field-input"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-4 py-2 text-sm font-medium">
          Batal
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
        >
          Simpan Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1 block">{label}</span>
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
  onUpdate: (index: number, field: keyof TahfizhSurahAssessment, value: any) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  const nilaiSurah = calculateTahfizhSurahScore(assessment, penaltyConfig);
  const regularMode = mode === "Reguler";

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Soal #{index + 1}</p>
          <p className="text-xs text-muted-foreground">{assessment.surah || "Belum ada surat"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> {nilaiSurah}
          </span>
          {showRemove && (
            <button type="button" onClick={() => onRemove(index)} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <Field label="Juz">
          <select
            value={assessment.juz}
            disabled={disabled || mode === "Sertifikat"}
            onChange={(event) => onUpdate(index, "juz", Number(event.target.value))}
            className="field-input"
          >
            {Array.from({ length: 30 }, (_, itemIndex) => itemIndex + 1).map((juz) => (
              <option key={juz} value={juz}>Juz {juz}</option>
            ))}
          </select>
        </Field>

        <Field label="Surat / Grup Surat">
          {regularMode ? (
            <input
              value={assessment.surah}
              disabled={disabled}
              onChange={(event) => onUpdate(index, "surah", event.target.value)}
              className="field-input"
            />
          ) : (
            <select value={assessment.surah} disabled className="field-input">
              <option value={assessment.surah}>{assessment.surah}</option>
            </select>
          )}
        </Field>

        <Field label="Ayat Awal">
          <input
            value={assessment.ayatAwal ?? ""}
            disabled={disabled || mode === "Sertifikat"}
            onChange={(event) => onUpdate(index, "ayatAwal", event.target.value)}
            placeholder={assessment.ayatRange || "-"}
            className="field-input"
          />
        </Field>

        <Field label="Ayat Akhir">
          <input
            value={assessment.ayatAkhir ?? ""}
            disabled={disabled || mode === "Sertifikat"}
            onChange={(event) => onUpdate(index, "ayatAkhir", event.target.value)}
            placeholder={assessment.ayatRange || "-"}
            className="field-input"
          />
        </Field>
      </div>

      {regularMode && (
        <div className="mt-2">
          <Field label="Pilih cepat dari database juz">
            <select
              value={assessment.surah}
              disabled={disabled}
              onChange={(event) => {
                const selected = getSurahsForJuz(assessment.juz).find((item) => item.name === event.target.value);
                onUpdate(index, "surah", event.target.value);
                onUpdate(index, "ayatRange", selected?.ayatRange || "");
              }}
              className="field-input"
            >
              <option value={assessment.surah}>{assessment.surah || "Custom"}</option>
              {getSurahsForJuz(assessment.juz).map((item) => (
                <option key={`${item.name}-${item.ayatRange || "full"}`} value={item.name}>
                  {getSurahLabel(item)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-6">
        <Field label="Kelancaran">
          <select
            value={assessment.kelancaran}
            disabled={disabled}
            onChange={(event) => onUpdate(index, "kelancaran", Number(event.target.value))}
            className="field-input"
          >
            {KELANCARAN_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </Field>
        <NumberField label="Lahn Jali" value={assessment.lahnJali} disabled={disabled} onChange={(value) => onUpdate(index, "lahnJali", value)} />
        <NumberField label="Lahn Khofi" value={assessment.lahnKhofi} disabled={disabled} onChange={(value) => onUpdate(index, "lahnKhofi", value)} />
        <NumberField label="Waqaf" value={assessment.waqaf} disabled={disabled} onChange={(value) => onUpdate(index, "waqaf", value)} />
        <NumberField label="Sambung Ayat" value={assessment.salahSambung} disabled={disabled} onChange={(value) => onUpdate(index, "salahSambung", value)} />
        <Field label="Nilai">
          <div className="rounded-md border border-input bg-muted px-3 py-2 text-center text-sm font-semibold">{nilaiSurah}</div>
        </Field>
      </div>

      {regularMode && (
        <div className="mt-3">
          <Field label="Detail kesalahan / catatan baris">
            <textarea
              value={assessment.catatan || ""}
              disabled={disabled}
              onChange={(event) => onUpdate(index, "catatan", event.target.value)}
              className="min-h-[58px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
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
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="field-input"
      />
    </Field>
  );
}
