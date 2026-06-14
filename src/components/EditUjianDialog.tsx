import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  calculateNilaiTahsinDasar,
  calculateNilaiTahsinLanjutan,
  calculateTahsinDasarResult,
  calculateTahsinLanjutanResult,
  type TahsinDasarEntry,
  type TahsinLanjutanEntry,
  type TahsinPenaltyConfig,
  type WaqafSymbolTest,
  type RumusVersion,
} from "@/data/tahsinScoring";
import generateCatatanOtomatis from "@/utils/catatanOtomatis";
import { usesLegacyTahfizhScoring } from "@/utils/verificationUrl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhSummary,
  calculateTahfizhSurahScore,
  normalizeTahfizhPayload,
  normalizeTahfizhPenaltyConfig,
  toSafeNumber,
  toLegacyTahfizhEntry,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";

interface Props {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName?: string;
  classInfo?: any;
  onSave: (updated: {
    nilai_aspek: any;
    nilai_akhir: number;
    status: "Lulus" | "Tidak Lulus";
    grade: string;
    tanggal: string;
  }) => void;
  isSaving: boolean;
}

const DEFAULT_TAHSIN_CONFIG: TahsinPenaltyConfig = {
  penalti_lahn_jali: 2,
  penalti_lahn_khofi: 1,
  bobot_kelancaran: 40,
};

const DEFAULT_WAQAF_TEST: WaqafSymbolTest = {
  waqaf_lazim: false,
  waqaf_mustahab: false,
  waqaf_jaiz: false,
  waqaf_mujawwaz: false,
  waqaf_mamnu: false,
  waqaf_muanaqah: false,
};

function getRataKelancaran(entries: { kelancaran?: number }[]) {
  if (!entries.length) return 90;

  const total = entries.reduce(
    (a, b) => a + Number(b.kelancaran || 0),
    0
  );

  return Math.round(total / entries.length);
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

function getTahfizhPenaltyConfig(config: any): TahfizhPenaltyConfig {
  return normalizeTahfizhPenaltyConfig(config);
}

function getEntryAyatLabel(entry: TahfizhSurahAssessment) {
  if (entry.ayatRange) return entry.ayatRange;
  if (entry.ayatAwal && entry.ayatAkhir) return `${entry.ayatAwal} - ${entry.ayatAkhir}`;
  if (entry.ayatAwal) return String(entry.ayatAwal);
  if (entry.ayatAkhir) return String(entry.ayatAkhir);
  return "-";
}

export function confirmQuestionRemoval(
  questionCount: number,
  questionNumber: number,
  onRemove: () => void
) {
  if (questionCount <= 1) {
    toast.error("Minimal harus ada satu soal dalam hasil ujian.");
    return;
  }

  if (
    window.confirm(
      `Hapus soal ${questionNumber}? Nilai dan catatan pada soal ini juga akan dihapus.`
    )
  ) {
    onRemove();
  }
}

export default function EditUjianDialog({
  open,
  onClose,
  ujian,
  studentName,
  onSave,
  isSaving,
}: Props) {
  const mode = ujian?.mode as "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan";
  const aspek = ujian?.nilai_aspek || {};

  const [tanggal, setTanggal] = useState<string>(ujian?.tanggal || "");
  const [rumus, setRumus] = useState<RumusVersion | "baru" | "lama">(
    aspek.rumus || "baru"
  );
  const [catatanGuru, setCatatanGuru] = useState<string>(
    aspek.catatanGuru || ""
  );
  const [catatanMode, setCatatanMode] = useState<"auto" | "manual">(
    aspek.catatanMode || "auto"
  );

  const [tahfizhEntries, setTahfizhEntries] = useState<TahfizhSurahAssessment[]>(
    Array.isArray(aspek.surahEntries)
      ? aggregateTahfizhAssessmentsForDisplay(aspek.surahEntries)
      : []
  );
  const [tahfizhConfig, setTahfizhConfig] = useState<TahfizhPenaltyConfig>(
    getTahfizhPenaltyConfig(aspek.config)
  );
  const [tahfizhMode, setTahfizhMode] = useState<TahfizhExamMode>(
    aspek.tahfizhMode || "Reguler"
  );
  const [manualStopReason, setManualStopReason] = useState<string>(
    aspek.manualStopReason || ""
  );

  const [dasarEntries, setDasarEntries] = useState<TahsinDasarEntry[]>(
    (aspek.entries || []).map(normalizeTahsinEntry)
  );
  const [dasarConfig, setDasarConfig] = useState<TahsinPenaltyConfig>(
    aspek.config || DEFAULT_TAHSIN_CONFIG
  );

  const [lanjutanEntries, setLanjutanEntries] = useState<TahsinLanjutanEntry[]>(
    (aspek.entries || []).map(normalizeTahsinEntry)
  );
  const [lanjutanConfig, setLanjutanConfig] = useState<TahsinPenaltyConfig>(
    aspek.config || DEFAULT_TAHSIN_CONFIG
  );
  const [penaltiWaqaf, setPenaltiWaqaf] = useState<number>(
    aspek.penaltiWaqaf || 2
  );
  const [waqafTest, setWaqafTest] = useState<WaqafSymbolTest>(
    aspek.waqafTest || DEFAULT_WAQAF_TEST
  );

  useEffect(() => {
    if (!open) return;

    const currentAspek = ujian?.nilai_aspek || {};
    const normalizedEntries = (currentAspek.entries || []).map(
      normalizeTahsinEntry
    );

    setTanggal(ujian?.tanggal || "");
    setRumus(currentAspek.rumus || "baru");

    const savedCatatanMode = currentAspek.catatanMode || "auto";

    setCatatanMode(savedCatatanMode);

    setCatatanGuru(
      savedCatatanMode === "manual"
        ? currentAspek.catatanGuru || ""
        : ""
    );

    setTahfizhEntries(
      Array.isArray(currentAspek.surahEntries)
        ? aggregateTahfizhAssessmentsForDisplay(currentAspek.surahEntries)
        : []
    );
    setTahfizhConfig(getTahfizhPenaltyConfig(currentAspek.config));
    setTahfizhMode(currentAspek.tahfizhMode || "Reguler");
    setManualStopReason(currentAspek.manualStopReason || "");
    setDasarEntries(normalizedEntries);
    setDasarConfig(currentAspek.config || DEFAULT_TAHSIN_CONFIG);
    setLanjutanEntries(normalizedEntries);
    setLanjutanConfig(currentAspek.config || DEFAULT_TAHSIN_CONFIG);
    setPenaltiWaqaf(currentAspek.penaltiWaqaf || 2);
    setWaqafTest(currentAspek.waqafTest || DEFAULT_WAQAF_TEST);
  }, [open, ujian]);

  const computed = useMemo(() => {
    if (mode === "Tahfizh") {
      const legacyScoring = usesLegacyTahfizhScoring({
        mode: ujian?.mode,
        assessedBy: ujian?.assessed_by,
        tanggal: ujian?.tanggal,
      });
      const normalized = normalizeTahfizhPayload({
        entries: tahfizhEntries,
        nilaiAspek: aspek,
        tahfizhMode,
        config: tahfizhConfig,
        manualStopReason: legacyScoring ? "" : manualStopReason,
        ignoreAutoFail: legacyScoring,
        autoFailConfig: aspek.autoFailConfig,
      });
      const r = normalized.result;

      return {
        nilai_akhir: r.nilaiAkhir,
        status: r.status,
        grade: r.grade,
        predikat: r.predikat,
        threshold: 70,
        tahfizhResult: r,
      };
    }

    if (mode === "Tahsin Dasar") {
      const r = calculateTahsinDasarResult(
        dasarEntries,
        dasarConfig,
        rumus as RumusVersion
      );

      return {
        nilai_akhir: r.nilaiAkhir,
        status: r.status,
        grade: r.grade,
        predikat: r.predikat,
        threshold: 70,
      };
    }

    const r = calculateTahsinLanjutanResult(
      lanjutanEntries,
      lanjutanConfig,
      penaltiWaqaf,
      waqafTest,
      rumus as RumusVersion
    );

    return {
      nilai_akhir: r.nilaiAkhir,
      status: r.status,
      grade: r.grade,
      predikat: r.predikat,
      threshold: 70,
    };
  }, [
    mode,
    tahfizhEntries,
    tahfizhConfig,
    tahfizhMode,
    manualStopReason,
    ujian,
    dasarEntries,
    dasarConfig,
    lanjutanEntries,
    lanjutanConfig,
    penaltiWaqaf,
    waqafTest,
    rumus,
  ]);

  const buatCatatanOtomatis = useCallback(() => {
    if (mode === "Tahfizh") {
      const displayEntries = aggregateTahfizhAssessmentsForDisplay(tahfizhEntries);
      const totalLahnJali = displayEntries.reduce(
        (a, b) => a + Number(b.lahnJali || 0),
        0
      );

      const totalLahnKhofi = displayEntries.reduce(
        (a, b) => a + Number(b.lahnKhofi || 0),
        0
      );

      const totalWaqaf = displayEntries.reduce(
        (a, b) => a + Number(b.waqaf || 0),
        0
      );

      const totalSambung = displayEntries.reduce(
        (a, b) => a + Number(b.salahSambung || 0),
        0
      );

      return generateCatatanOtomatis({
        mode: "Tahfizh",
        nilaiAkhir: computed.nilai_akhir,
        namaSiswa: studentName,
        lahnJali: totalLahnJali,
        lahnKhofi: totalLahnKhofi,
        waqaf: totalWaqaf,
        salahSambungAyat: totalSambung,
        kelancaran: getRataKelancaran(displayEntries),
      });
    }

    if (mode === "Tahsin Dasar") {
      const totalHarakat = dasarEntries.reduce(
        (a, b) => a + Number(b.salah_harakat || 0),
        0
      );

      const totalTajwid = dasarEntries.reduce(
        (a, b) => a + Number(b.kesalahan_tajwid || 0),
        0
      );

      const totalMad = dasarEntries.reduce(
        (a, b) => a + Number(b.kesalahan_mad || 0),
        0
      );

      const totalQalqalah = dasarEntries.reduce(
        (a, b) => a + getKesalahanQalqalah(b),
        0
      );

      return generateCatatanOtomatis({
        mode: "Tahsin Dasar",
        nilaiAkhir: computed.nilai_akhir,
        namaSiswa: studentName,
        harakat: totalHarakat,
        tajwid: totalTajwid,
        mad: totalMad,
        qalqalah: totalQalqalah,
        kelancaran: getRataKelancaran(dasarEntries),
      });
    }

    if (mode === "Tahsin Lanjutan") {
      const totalLahnJali = lanjutanEntries.reduce(
        (a, b) =>
          a +
          Number(b.salah_huruf || 0) +
          Number(b.salah_harakat || 0) +
          getSalahTasydid(b),
        0
      );

      const totalLahnKhofi = lanjutanEntries.reduce(
        (a, b) =>
          a +
          Number(b.kesalahan_tajwid || 0) +
          Number(b.kesalahan_mad || 0) +
          getKesalahanQalqalah(b),
        0
      );

      const totalWaqaf = lanjutanEntries.reduce(
        (a, b) => a + Number(b.waqaf_ibtida || 0),
        0
      );

      return generateCatatanOtomatis({
        mode: "Tahsin Lanjutan",
        nilaiAkhir: computed.nilai_akhir,
        namaSiswa: studentName,
        lahnJali: totalLahnJali,
        lahnKhofi: totalLahnKhofi,
        waqaf: totalWaqaf,
        kelancaran: getRataKelancaran(lanjutanEntries),
      });
    }

    return "";
  }, [
    mode,
    computed.nilai_akhir,
    studentName,
    tahfizhEntries,
    dasarEntries,
    lanjutanEntries,
  ]);

  useEffect(() => {
    if (catatanMode === "auto") {
      setCatatanGuru(buatCatatanOtomatis());
    }
  }, [catatanMode, buatCatatanOtomatis]);

  if (!ujian) return null;

  const tahfizhSummaries =
    mode === "Tahfizh" ? calculateTahfizhSummary(tahfizhEntries, tahfizhConfig) : [];
  const tahfizhResult = (computed as any).tahfizhResult;

  const handleSave = async () => {
    let nilai_aspek: any;

    if (mode === "Tahfizh") {
      nilai_aspek = {
        ...aspek,
        surahEntries: aggregateTahfizhAssessmentsForDisplay(tahfizhEntries).map(toLegacyTahfizhEntry),
        config: tahfizhConfig,
        tahfizhMode,
        manualStopReason,
        autoFailConfig: aspek.autoFailConfig,
        summaries: tahfizhResult?.summaries || [],
        nilaiPerJuz: tahfizhResult?.nilaiPerJuz || [],
        autoFailLog: tahfizhResult?.autoFail?.log || aspek.autoFailLog || "",
        statusLabel: tahfizhResult?.statusLabel || computed.status,
        rumus: "baru",
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    } else if (mode === "Tahsin Dasar") {
      nilai_aspek = {
        ...aspek,
        entries: dasarEntries.map(normalizeTahsinEntry),
        config: dasarConfig,
        rumus,
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    } else {
      nilai_aspek = {
        ...aspek,
        entries: lanjutanEntries.map(normalizeTahsinEntry),
        config: lanjutanConfig,
        penaltiWaqaf,
        waqafTest,
        rumus,
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    }

    onSave({
      nilai_aspek,
      nilai_akhir: computed.nilai_akhir,
      status: computed.status,
      grade: computed.grade,
      tanggal,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            Edit Nilai Ujian {mode}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Tanggal Ujian
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Pilih Rumus Penilaian
              </label>
              <select
                value={rumus}
                onChange={(e) => setRumus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                <option value="baru">
                  Rumus Baru: Nilai = Kelancaran - Penalti
                </option>
                {mode !== "Tahfizh" && <option value="lama">Rumus Lama (Bobot 60/40)</option>}
              </select>
            </div>
          </div>

          {mode === "Tahfizh" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ringkasan Tahfizh per Juz</p>
                    <p className="text-xs text-muted-foreground">
                      Sama seperti Detail Ujian Tahfizh. Nilai akhir diambil dari rata-rata nilai semua juz.
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-background px-3 py-2 text-xs text-emerald-900">
                    <span className="font-medium">Nilai akhir: </span>
                    <span>{computed.nilai_akhir}</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-emerald-100/70 text-emerald-950">
                      <tr>
                        {["No", "Juz", "Kelancaran", "Lahn Jali", "Lahn Khofi", "Waqaf", "Salah Sambung", "Nilai"].map((head) => (
                          <th key={head} className="px-3 py-2 text-left font-semibold">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tahfizhSummaries.map((summary, index) => (
                        <tr key={summary.juz} className="border-t border-emerald-100">
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2">Juz {summary.juz}</td>
                          <td className="px-3 py-2">{summary.rataKelancaran}</td>
                          <td className="px-3 py-2">{summary.totalLahnJali}</td>
                          <td className="px-3 py-2">{summary.totalLahnKhofi}</td>
                          <td className="px-3 py-2">{summary.totalWaqaf}</td>
                          <td className="px-3 py-2">{summary.totalSalahSambung}</td>
                          <td className="px-3 py-2 font-bold text-primary">{summary.nilaiJuz}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {tahfizhEntries.map((e, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm"
                >
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Detail #{i + 1}: {e.surah}</p>
                      <p className="text-xs text-muted-foreground">Juz {e.juz} - Ayat {getEntryAyatLabel(e)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                        Nilai {calculateTahfizhSurahScore(e, tahfizhConfig)}
                      </div>
                      <button
                        type="button"
                        aria-label={`Hapus soal ${i + 1}`}
                        title="Hapus soal"
                        onClick={() =>
                          confirmQuestionRemoval(
                            tahfizhEntries.length,
                            i + 1,
                            () =>
                              setTahfizhEntries((current) =>
                                current.filter(
                                  (_, entryIndex) => entryIndex !== i
                                )
                              )
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Surat / Grup</label>
                      <input
                        type="text"
                        value={e.surah}
                        onChange={(ev) => {
                          const updated = [...tahfizhEntries];
                          updated[i] = { ...updated[i], surah: ev.target.value };
                          setTahfizhEntries(updated);
                        }}
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Juz</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={e.juz}
                        onChange={(ev) => {
                          const updated = [...tahfizhEntries];
                          updated[i] = {
                            ...updated[i],
                            juz: Math.min(30, Math.max(1, toSafeNumber(ev.target.value, updated[i].juz))),
                          };
                          setTahfizhEntries(updated);
                        }}
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Ayat</label>
                      <input
                        type="text"
                        value={e.ayatRange || ""}
                        onChange={(ev) => {
                          const updated = [...tahfizhEntries];
                          updated[i] = { ...updated[i], ayatRange: ev.target.value };
                          setTahfizhEntries(updated);
                        }}
                        placeholder="-"
                        className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[
                      { k: "lahnJali", l: "Lahn Jali" },
                      { k: "lahnKhofi", l: "Lahn Khofi" },
                      { k: "waqaf", l: "Waqaf" },
                      { k: "salahSambung", l: "Salah Sambung" },
                      { k: "kelancaran", l: "Kelancaran (60-100)" },
                    ].map((f) => (
                      <div key={f.k}>
                        <label className="block text-[10px] text-muted-foreground mb-0.5">
                          {f.l}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={(e as any)[f.k] ?? (f.k === "kelancaran" ? 90 : 0)}
                          onChange={(ev) => {
                            const updated = [...tahfizhEntries];
                            updated[i] = {
                              ...updated[i],
                              [f.k]: Math.max(
                                0,
                                toSafeNumber(
                                  ev.target.value,
                                  (updated[i] as any)[f.k] ?? (f.k === "kelancaran" ? 90 : 0)
                                )
                              ),
                            };
                            setTahfizhEntries(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode === "Tahsin Dasar" && (
            <div className="space-y-3">
              {dasarEntries.map((e, i) => (
                <div
                  key={i}
                  className="p-3 rounded-md border border-border bg-muted/30"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      Soal {i + 1}: {e.nama_ebta}
                    </p>
                    <button
                      type="button"
                      aria-label={`Hapus soal ${i + 1}`}
                      title="Hapus soal"
                      onClick={() =>
                        confirmQuestionRemoval(
                          dasarEntries.length,
                          i + 1,
                          () =>
                            setDasarEntries((current) =>
                              current.filter(
                                (_, entryIndex) => entryIndex !== i
                              )
                            )
                        )
                      }
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      "salah_huruf",
                      "salah_harakat",
                      "salah_tasydid",
                      "kesalahan_mad",
                      "kesalahan_qalqalah",
                      "kesalahan_tajwid",
                      "kesalahan_waqaf",
                      "kelancaran",
                    ].map((k) => (
                      <div key={k}>
                        <label className="block text-[10px] text-muted-foreground mb-0.5 capitalize">
                          {k.replace(/_/g, " ")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={(e as any)[k] ?? 0}
                          onChange={(ev) => {
                            const updated = [...dasarEntries];
                            (updated[i] as any)[k] =
                              parseInt(ev.target.value) || 0;
                            setDasarEntries(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-right mt-2 text-primary font-bold">
                    Nilai:{" "}
                    {calculateNilaiTahsinDasar(
                      e,
                      dasarConfig,
                      rumus as RumusVersion
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {mode === "Tahsin Lanjutan" && (
            <div className="space-y-3">
              {lanjutanEntries.map((e, i) => (
                <div
                  key={i}
                  className="p-3 rounded-md border border-border bg-muted/30"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      Soal {i + 1}
                    </p>
                    <button
                      type="button"
                      aria-label={`Hapus soal ${i + 1}`}
                      title="Hapus soal"
                      onClick={() =>
                        confirmQuestionRemoval(
                          lanjutanEntries.length,
                          i + 1,
                          () =>
                            setLanjutanEntries((current) =>
                              current.filter(
                                (_, entryIndex) => entryIndex !== i
                              )
                            )
                        )
                      }
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Surat"
                      value={e.surah}
                      onChange={(ev) => {
                        const updated = [...lanjutanEntries];
                        updated[i].surah = ev.target.value;
                        setLanjutanEntries(updated);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Ayat"
                      value={e.ayat}
                      onChange={(ev) => {
                        const updated = [...lanjutanEntries];
                        updated[i].ayat = ev.target.value;
                        setLanjutanEntries(updated);
                      }}
                      className="w-32 px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      "salah_huruf",
                      "salah_harakat",
                      "salah_tasydid",
                      "kesalahan_mad",
                      "kesalahan_qalqalah",
                      "kesalahan_tajwid",
                      "waqaf_ibtida",
                      "kelancaran",
                    ].map((k) => (
                      <div key={k}>
                        <label className="block text-[10px] text-muted-foreground mb-0.5 capitalize">
                          {k.replace(/_/g, " ")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={(e as any)[k] ?? 0}
                          onChange={(ev) => {
                            const updated = [...lanjutanEntries];
                            (updated[i] as any)[k] =
                              parseInt(ev.target.value) || 0;
                            setLanjutanEntries(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-right mt-2 text-primary font-bold">
                    Nilai:{" "}
                    {calculateNilaiTahsinLanjutan(
                      e,
                      lanjutanConfig,
                      penaltiWaqaf,
                      rumus as RumusVersion
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-md border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-foreground">
                Catatan Guru
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {catatanMode === "auto" ? "Auto" : "Manual"}
                </span>
              </h5>

              {catatanMode === "manual" && (
                <button
                  type="button"
                  onClick={() => {
                    setCatatanMode("auto");
                    setCatatanGuru(buatCatatanOtomatis());
                  }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  Jadikan Auto
                </button>
              )}
            </div>

            <textarea
              value={catatanGuru}
              onChange={(e) => {
                setCatatanGuru(e.target.value);
                setCatatanMode("manual");
              }}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm resize-y"
            />
          </div>

          <div
            className={`p-4 rounded-md border-2 ${
              computed.status === "Lulus"
                ? "bg-success/10 border-success/30"
                : "bg-destructive/10 border-destructive/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Nilai Akhir (real-time)
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {computed.nilai_akhir}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`text-lg font-bold ${
                    computed.status === "Lulus"
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {computed.predikat}
                </p>
                <p className="text-sm font-medium">
                  {computed.status === "Lulus" ? "LULUS" : "TIDAK LULUS"} ·
                  Grade {computed.grade}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Ambang: {computed.threshold}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
