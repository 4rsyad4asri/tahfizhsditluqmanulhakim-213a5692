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
  calculateNilaiSurahWithRumus,
  calculateNilaiTahfizh,
  type TahfizhSurahEntry,
  type TahfizhRumus,
} from "@/data/mockData";
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
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";

interface Props {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName?: string;
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
  const [rumus, setRumus] = useState<RumusVersion | TahfizhRumus>(
    aspek.rumus || "baru"
  );
  const [catatanGuru, setCatatanGuru] = useState<string>(
    aspek.catatanGuru || ""
  );
  const [catatanMode, setCatatanMode] = useState<"auto" | "manual">(
    aspek.catatanMode || "auto"
  );

  const [tahfizhEntries, setTahfizhEntries] = useState<TahfizhSurahEntry[]>(
    aspek.surahEntries || []
  );

  const [dasarEntries, setDasarEntries] = useState<TahsinDasarEntry[]>(
    aspek.entries || []
  );
  const [dasarConfig, setDasarConfig] = useState<TahsinPenaltyConfig>(
    aspek.config || DEFAULT_TAHSIN_CONFIG
  );

  const [lanjutanEntries, setLanjutanEntries] = useState<TahsinLanjutanEntry[]>(
    aspek.entries || []
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

    setTanggal(ujian?.tanggal || "");
    setRumus(currentAspek.rumus || "baru");
    setCatatanGuru(currentAspek.catatanGuru || "");
    setCatatanMode(currentAspek.catatanGuru ? "manual" : "auto");

    setTahfizhEntries(currentAspek.surahEntries || []);
    setDasarEntries(currentAspek.entries || []);
    setDasarConfig(currentAspek.config || DEFAULT_TAHSIN_CONFIG);
    setLanjutanEntries(currentAspek.entries || []);
    setLanjutanConfig(currentAspek.config || DEFAULT_TAHSIN_CONFIG);
    setPenaltiWaqaf(currentAspek.penaltiWaqaf || 2);
    setWaqafTest(currentAspek.waqafTest || DEFAULT_WAQAF_TEST);
  }, [open, ujian]);

  const computed = useMemo(() => {
    if (mode === "Tahfizh") {
      const r = calculateNilaiTahfizh(tahfizhEntries, rumus as TahfizhRumus);

      return {
        nilai_akhir: r.nilaiAkhir,
        status: r.status,
        grade: r.grade,
        predikat: r.predikat,
        threshold: 85,
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
      const totalLahnJali = tahfizhEntries.reduce(
        (a, b) => a + Number(b.lahn_jali || 0),
        0
      );

      const totalLahnKhofi = tahfizhEntries.reduce(
        (a, b) => a + Number(b.lahn_khofi || 0),
        0
      );

      const totalWaqaf = tahfizhEntries.reduce(
        (a, b) => a + Number(b.waqaf_ibtida || 0),
        0
      );

      const totalSambung = tahfizhEntries.reduce(
        (a, b) => a + Number(b.salah_sambung_ayat || 0),
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
        kelancaran: getRataKelancaran(tahfizhEntries),
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
        (a, b) => a + Number(b.kesalahan_qalqalah || 0),
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
          Number(b.salah_makhraj || 0),
        0
      );

      const totalLahnKhofi = lanjutanEntries.reduce(
        (a, b) =>
          a +
          Number(b.kesalahan_tajwid || 0) +
          Number(b.kesalahan_mad || 0) +
          Number(b.kesalahan_qalqalah || 0),
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

  const handleSave = async () => {
    let nilai_aspek: any;

    if (mode === "Tahfizh") {
      nilai_aspek = {
        ...aspek,
        surahEntries: tahfizhEntries,
        rumus,
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    } else if (mode === "Tahsin Dasar") {
      nilai_aspek = {
        ...aspek,
        entries: dasarEntries,
        config: dasarConfig,
        rumus,
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    } else {
      nilai_aspek = {
        ...aspek,
        entries: lanjutanEntries,
        config: lanjutanConfig,
        penaltiWaqaf,
        waqafTest,
        rumus,
        catatanGuru,
        catatanMode,
        predikat: computed.predikat,
      };
    }

    try {
      await supabase
        .from("ujian")
        .update({
          status_sertifikasi: computed.status,
        })
        .eq("id", ujian.student_id);

      onSave({
        nilai_aspek,
        nilai_akhir: computed.nilai_akhir,
        status: computed.status,
        grade: computed.grade,
        tanggal,
      });
    } catch (e) {
      toast.error(getSafeErrorMessage(e));
    }
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
                <option value="baru">Rumus Baru: Nilai = Kelancaran - Penalti</option>
                <option value="lama">Rumus Lama (Bobot 60/40)</option>
              </select>
            </div>
          </div>

          {mode === "Tahfizh" && (
            <div className="space-y-3">
              {tahfizhEntries.map((e, i) => (
                <div key={i} className="p-3 rounded-md border border-border bg-muted/30">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Surat #{i + 1}: {e.surah} (Juz {e.juz})
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[
                      { k: "lahn_jali", l: "Lahn Jali" },
                      { k: "lahn_khofi", l: "Lahn Khofi" },
                      { k: "waqaf_ibtida", l: "Waqaf" },
                      { k: "salah_sambung_ayat", l: "Sambung Ayat" },
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
                          value={(e as any)[f.k] ?? 0}
                          onChange={(ev) => {
                            const updated = [...tahfizhEntries];
                            (updated[i] as any)[f.k] = parseInt(ev.target.value) || 0;
                            setTahfizhEntries(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-right mt-2 text-primary font-bold">
                    Nilai: {calculateNilaiSurahWithRumus(e, rumus as TahfizhRumus)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {mode === "Tahsin Dasar" && (
            <div className="space-y-3">
              {dasarEntries.map((e, i) => (
                <div key={i} className="p-3 rounded-md border border-border bg-muted/30">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    {e.nama_ebta}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      "salah_huruf",
                      "salah_harakat",
                      "salah_makhraj",
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
                            (updated[i] as any)[k] = parseInt(ev.target.value) || 0;
                            setDasarEntries(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-right mt-2 text-primary font-bold">
                    Nilai: {calculateNilaiTahsinDasar(e, dasarConfig, rumus as RumusVersion)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {mode === "Tahsin Lanjutan" && (
            <div className="space-y-3">
              {lanjutanEntries.map((e, i) => (
                <div key={i} className="p-3 rounded-md border border-border bg-muted/30">
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
                      "salah_makhraj",
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
                            (updated[i] as any)[k] = parseInt(ev.target.value) || 0;
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
                  {computed.status === "Lulus" ? "LULUS" : "TIDAK LULUS"} · Grade{" "}
                  {computed.grade}
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