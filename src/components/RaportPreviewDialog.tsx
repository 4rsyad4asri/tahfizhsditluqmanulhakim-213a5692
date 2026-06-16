import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import PdfAssetsLayoutEditor from "@/components/PdfAssetsLayoutEditor";
import PdfTableLayoutEditor from "@/components/PdfTableLayoutEditor";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Download,
  Printer,
  Settings2,
  Loader2,
  Upload,
  X,
  ImageIcon,
  Move,
  RefreshCw,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateCatatanOtomatisFromUjian } from "@/utils/catatanOtomatis";
import {
  aggregateTahfizhAssessmentsForDisplay,
  normalizeTahfizhPayload,
  toSafeNumber,
} from "@/data/tahfizhSystem";
import { getStandardExamGrading } from "@/data/grading";
import { buildVerificationUrlForExam, inferTahfizhModeForExam, usesLegacyTahfizhScoring } from "@/utils/verificationUrl";
import {
  generateRaportPDF,
  downloadRaportPDF,
  printRaportPDF,
  type RaportData,
  type RaportHeader,
  type RaportAssets,
  type RaportPdfOptions,
  type Orientation,
  type RaportMode,
} from "@/utils/raportPdf";
import {
  applySharedRaportSignatureLayout,
  applyExaminerRaportSignatureLayout,
  EXAMINER_RAPORT_SIGNATURE_LAYOUT_PREFIX,
  GLOBAL_RAPORT_SIGNATURE_SETTINGS_ID,
  loadRaportVisualLayout,
  saveRaportVisualLayout,
  syncGlobalRaportSignatureLayout,
  type RaportVisualLayout,
} from "@/utils/pdfAssetsLayout";
import { resolveRaportSignatureAssets } from "@/utils/officialSignatures";
import { DEFAULT_RAPORT_HEADER, loadGlobalRaportHeader } from "@/utils/raportSettings";
import {
  getDefaultRaportTableLayout,
  loadGlobalRaportTableLayoutSettings,
  normalizeGlobalRaportTableLayout,
  saveGlobalRaportTableLayoutSettings,
  type GlobalRaportTableLayoutSettings,
  type RaportTableLayoutSettings,
} from "@/utils/raportTableLayout";
import { formatStudentName } from "@/utils/formatName";
import { resolveExamClassName } from "@/utils/examSnapshot";
import type {
  TahsinDasarEntry,
  TahsinLanjutanEntry,
  TahsinPenaltyConfig,
  WaqafSymbolTest,
} from "@/data/tahsinScoring";
import type { TahfizhSurahEntry } from "@/data/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName: string;
  className: string;
  nis?: string | null;
  nisn?: string | null;
  assessorName?: string;
}

const STORAGE_KEY = "raport_settings_v3";

const DEFAULT_OPTS: RaportPdfOptions = {
  orientation: "landscape",
  fontSize: 9,
  tableFontSize: 8,
  showWatermark: false,
  showQR: true,
};

function createVerificationToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export default function RaportPreviewDialog({
  open,
  onClose,
  ujian,
  studentName,
  className,
  nis,
  nisn,
  assessorName,
}: Props) {
  const { isAdmin } = useAuthContext();
  const [header, setHeader] = useState<RaportHeader>(DEFAULT_RAPORT_HEADER);
  const [assets, setAssets] = useState<RaportAssets>({});
  const [profileAssets, setProfileAssets] = useState<RaportAssets>({});
  const [opts, setOpts] = useState<RaportPdfOptions>(DEFAULT_OPTS);
  const [editing, setEditing] = useState(false);
  const [assetEditing, setAssetEditing] = useState(false);
  const [tableEditing, setTableEditing] = useState(false);
  const [savingTableLayout, setSavingTableLayout] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [localUjian, setLocalUjian] = useState<any | null>(ujian);
  const previewSeqRef = useRef(0);
  const activeUjian = localUjian || ujian;
  const activeMode = (activeUjian?.mode || "Tahfizh") as RaportMode;
  const examinerId = activeUjian?.assessed_by as string | null | undefined;
  const [visualLayout, setVisualLayout] = useState<RaportVisualLayout>(() =>
    loadRaportVisualLayout(activeMode, DEFAULT_OPTS.orientation, examinerId)
  );
  const [tableLayouts, setTableLayouts] = useState<GlobalRaportTableLayoutSettings>(() =>
    normalizeGlobalRaportTableLayout(null)
  );
  const [tableLayoutDraft, setTableLayoutDraft] = useState<RaportTableLayoutSettings>(() =>
    getDefaultRaportTableLayout(DEFAULT_OPTS.orientation)
  );

  const generatedCatatan = useMemo(
    () => generateCatatanOtomatisFromUjian(activeUjian, studentName),
    [activeUjian, studentName]
  );

  const [catatan, setCatatan] = useState("");

  const finalCatatan = catatan.trim() || generatedCatatan;

  const [tanggal, setTanggal] = useState<string>(
    ujian?.tanggal || new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    setLocalUjian(ujian);
  }, [ujian]);

  useEffect(() => {
    if (!open) return;
    setVisualLayout(loadRaportVisualLayout(activeMode, opts.orientation, examinerId));
  }, [activeMode, examinerId, open, opts.orientation]);

  useEffect(() => {
    if (!open) return;
    const next = tableLayouts[opts.orientation];
    setTableLayoutDraft(next);
  }, [open, opts.orientation, tableLayouts]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    syncGlobalRaportSignatureLayout(examinerId)
      .then(() => {
        if (alive) {
          setVisualLayout(loadRaportVisualLayout(activeMode, opts.orientation, examinerId));
        }
      })
      .catch((error) => console.error("Gagal menyinkronkan layout tanda tangan:", error));

    let channel = supabase
      .channel(`raport-signature-layout-${activeMode}-${opts.orientation}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `id=eq.${GLOBAL_RAPORT_SIGNATURE_SETTINGS_ID}`,
        },
        (payload) => {
          const value = (payload.new as { value?: unknown } | null)?.value;
          if (applySharedRaportSignatureLayout(value)) {
            setVisualLayout(loadRaportVisualLayout(activeMode, opts.orientation, examinerId));
          }
        },
      );
    if (examinerId) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `id=eq.${EXAMINER_RAPORT_SIGNATURE_LAYOUT_PREFIX}${examinerId}`,
        },
        (payload) => {
          const value = (payload.new as { value?: unknown } | null)?.value;
          if (applyExaminerRaportSignatureLayout(examinerId, value)) {
            setVisualLayout(loadRaportVisualLayout(activeMode, opts.orientation, examinerId));
          }
        },
      );
    }
    channel.subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [activeMode, examinerId, open, opts.orientation]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.assets) setAssets(p.assets);
        if (p.opts) setOpts((o) => ({ ...o, ...p.opts }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ assets, opts })
      );
    } catch {}
  }, [assets, opts]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    Promise.all([
      loadGlobalRaportHeader(),
      loadGlobalRaportTableLayoutSettings(),
    ])
      .then(([globalHeader, globalTableLayouts]) => {
        if (!alive) return;
        setHeader(globalHeader);
        setTableLayouts(globalTableLayouts);
      })
      .catch((error) => console.error("Gagal memuat pengaturan rapor global:", error));

    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const savedCatatanMode = activeUjian?.nilai_aspek?.catatanMode || "auto";

      setCatatan(
        savedCatatanMode === "manual"
          ? activeUjian?.nilai_aspek?.catatanGuru ?? ""
          : ""
      );

      setTanggal(activeUjian?.tanggal || new Date().toISOString().split("T")[0]);
    }
  }, [open, activeUjian]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    resolveRaportSignatureAssets(activeUjian?.assessed_by)
      .then((resolved) => {
        if (alive) setProfileAssets(resolved);
      })
      .catch((error) => {
        console.error("Gagal memuat tanda tangan profil:", error);
        if (alive) setProfileAssets({});
      });

    return () => {
      alive = false;
    };
  }, [open, activeUjian?.assessed_by]);

  useEffect(() => {
    if (!open || !activeUjian?.id || activeUjian?.mode !== "Tahfizh") return;

    const documentStatus = activeUjian.document_status || activeUjian.nilai_aspek?.documentStatus;
    if (documentStatus !== "Published") return;

    const currentAspek =
      activeUjian.nilai_aspek && typeof activeUjian.nilai_aspek === "object"
        ? activeUjian.nilai_aspek
        : {};
    const token = activeUjian.verification_token || currentAspek.verificationToken || createVerificationToken();
    const currentAssessorName = currentAspek.assessorName;
    const nextAssessorName = currentAssessorName || assessorName;

    if (
      activeUjian.verification_token &&
      currentAspek.verificationToken &&
      (!assessorName || currentAssessorName)
    ) return;

    const nextAspek = {
      ...currentAspek,
      documentStatus: "Published",
      verificationToken: token,
      assessorName: nextAssessorName,
    };
    const nextUjian = {
      ...activeUjian,
      verification_token: token,
      nilai_aspek: nextAspek,
    };

    setLocalUjian(nextUjian);

    supabase
      .from("ujian")
      .update({
        verification_token: token,
        nilai_aspek: nextAspek as any,
      } as any)
      .eq("id", activeUjian.id)
      .then(({ error }) => {
        if (error) {
          toast.error("Gagal menyiapkan link QR verifikasi");
        }
      });
  }, [open, activeUjian, assessorName]);

  const verificationToken = activeUjian?.verification_token || activeUjian?.nilai_aspek?.verificationToken;
  const effectiveTahfizhMode = inferTahfizhModeForExam({
    mode: activeUjian?.mode,
    tahfizhMode: activeUjian?.nilai_aspek?.tahfizhMode,
    verificationType: activeUjian?.nilai_aspek?.verificationType,
    assessedBy: activeUjian?.assessed_by,
    tanggal: activeUjian?.tanggal,
  });

  const data: RaportData = useMemo(() => {
    const aspek = activeUjian?.nilai_aspek || {};
    const normalizedEntries = (aspek.entries || []).map(normalizeTahsinEntry);
    const rawTahfizhEntries = Array.isArray(aspek.surahEntries) ? aspek.surahEntries : [];
    const legacyScoring = usesLegacyTahfizhScoring({
      mode: activeUjian?.mode,
      assessedBy: activeUjian?.assessed_by,
      tanggal: activeUjian?.tanggal,
    });
    const tahfizhMode =
      inferTahfizhModeForExam({
        mode: activeUjian?.mode,
        tahfizhMode: aspek.tahfizhMode,
        verificationType: aspek.verificationType,
        assessedBy: activeUjian?.assessed_by,
        tanggal: activeUjian?.tanggal,
      }) || "Reguler";
    const rawTahfizhJuzList = [...new Set(rawTahfizhEntries.map((entry: any) => Number(entry.juz || 30)))];
    const useRegularFiveQuestionDetail =
      activeUjian?.mode === "Tahfizh" &&
      tahfizhMode === "Reguler" &&
      rawTahfizhJuzList.length === 1 &&
      rawTahfizhEntries.length <= 5;
    const tahfizhReportType = useRegularFiveQuestionDetail ? "detail" : "summary";
    const normalizedTahfizh =
      activeUjian?.mode === "Tahfizh" && rawTahfizhEntries.length > 0
        ? normalizeTahfizhPayload({
            entries: rawTahfizhEntries,
            nilaiAspek: aspek,
            tahfizhMode,
            config: aspek.config,
            manualStopReason: legacyScoring ? "" : aspek.manualStopReason,
            ignoreAutoFail: legacyScoring,
            autoFailConfig: aspek.autoFailConfig,
          })
        : null;
    const effectiveNilaiAkhir = normalizedTahfizh
      ? normalizedTahfizh.nilaiAkhir
      : toSafeNumber(activeUjian?.nilai_akhir, 0);

    const grading = getStandardExamGrading(effectiveNilaiAkhir);
    const predikat = normalizedTahfizh?.predikat ?? aspek.predikat ?? grading.predikat;

    return {
      mode: activeUjian?.mode,
      studentName: formatStudentName(studentName),
      className: resolveExamClassName(activeUjian, className) || className,
      nis: nis || undefined,
      nisn: nisn || undefined,
      assessorName,
      tanggal,
      nilaiAkhir: effectiveNilaiAkhir,
      status: normalizedTahfizh?.status ?? activeUjian?.status ?? "-",
      grade: normalizedTahfizh?.grade ?? activeUjian?.grade ?? grading.grade,
      predikat,
      catatanGuru: finalCatatan,
      verificationToken,
      tahfizhMode,
      tahfizhReportType,
      tahfizhConfig: aspek.config,
      tahfizhEntries: rawTahfizhEntries.length > 0
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
      ujianId: activeUjian?.id,
    };
  }, [activeUjian, studentName, className, nis, nisn, assessorName, tanggal, finalCatatan, verificationToken]);

  const verifyUrl = useMemo(
    () =>
      buildVerificationUrlForExam(
        {
          mode: activeUjian?.mode,
          tahfizhMode: effectiveTahfizhMode,
          verificationType: activeUjian?.nilai_aspek?.verificationType,
          assessedBy: activeUjian?.assessed_by,
          tanggal: activeUjian?.tanggal,
        },
        verificationToken
      ) || opts.verifyUrl,
    [
      activeUjian?.assessed_by,
      activeUjian?.mode,
      activeUjian?.nilai_aspek?.verificationType,
      activeUjian?.tanggal,
      effectiveTahfizhMode,
      opts.verifyUrl,
      verificationToken,
    ]
  );

  const effectiveOpts: RaportPdfOptions = useMemo(
    () => ({
      ...opts,
      verifyUrl,
      visualLayout,
      tableLayout: tableLayoutDraft,
    }),
    [opts, verifyUrl, visualLayout, tableLayoutDraft]
  );
  const effectiveAssets: RaportAssets = useMemo(
    () => ({
      ...assets,
      logoLeft: assets.logoLeft || profileAssets.logoLeft,
      logoRight: assets.logoRight || profileAssets.logoRight,
      sigExaminer: profileAssets.sigExaminer || assets.sigExaminer,
      sigHeadmaster: profileAssets.sigHeadmaster || assets.sigHeadmaster,
    }),
    [assets, profileAssets]
  );

  useEffect(() => {
    if (!open || !activeUjian) return;

    const seq = ++previewSeqRef.current;
    setLoadingPreview(true);

    const t = setTimeout(async () => {
      try {
        const doc = await generateRaportPDF(data, header, effectiveAssets, effectiveOpts);
        if (seq !== previewSeqRef.current) return;

        const blob = doc.output("blob") as Blob;
        const url = URL.createObjectURL(blob);

        setPreviewBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e: any) {
        toast.error("Gagal preview: " + (e?.message || ""));
      } finally {
        if (seq === previewSeqRef.current) setLoadingPreview(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [open, data, header, effectiveAssets, effectiveOpts, activeUjian]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const onUpload =
    (key: keyof RaportAssets) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];

      if (!f) return;

      if (f.size > 2_000_000) {
        toast.error("Ukuran file maksimal 2MB");
        return;
      }

      const reader = new FileReader();

      reader.onload = () =>
        setAssets((a) => ({
          ...a,
          [key]: reader.result as string,
        }));

      reader.readAsDataURL(f);
    };

  const handleDownload = async () => {
    setExporting(true);

    try {
      await downloadRaportPDF(data, header, effectiveAssets, effectiveOpts);
      toast.success("Raport berhasil diunduh");
    } catch (e: any) {
      toast.error("Gagal export PDF: " + (e?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    try {
      await printRaportPDF(data, header, effectiveAssets, effectiveOpts);
    } catch (e: any) {
      toast.error("Gagal print: " + (e?.message || ""));
    }
  };

  const handleOpenVerification = () => {
    if (!verifyUrl) return;
    window.open(verifyUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenPdfPreview = () => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyVerification = async () => {
    if (!verifyUrl) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard tidak tersedia");
      await navigator.clipboard.writeText(verifyUrl);
      toast.success("Link verifikasi berhasil disalin");
    } catch {
      toast.error("Gagal menyalin link verifikasi");
    }
  };

  const refreshPreview = () => {
    previewSeqRef.current += 1;
    setPreviewBlob(null);
    setPreviewUrl(null);
    setVisualLayout((current) => ({ ...current }));
  };

  const handleSaveVisualLayout = async () => {
    try {
      const saved = await saveRaportVisualLayout(
        activeMode,
        opts.orientation,
        visualLayout,
        examinerId,
      );
      setVisualLayout(saved);
      toast.success(`Layout aset ${activeMode} berhasil disimpan dan disinkronkan`);
    } catch (error: any) {
      toast.error(`Gagal menyinkronkan layout tanda tangan: ${error?.message || ""}`);
    }
  };

  const handleApplyTableLayout = () => {
    refreshPreview();
    toast.success("Preview diperbarui");
  };

  const persistTableLayout = async (message: string) => {
    if (!isAdmin) return;
    setSavingTableLayout(true);
    try {
      const next = normalizeGlobalRaportTableLayout({
        ...tableLayouts,
        [opts.orientation]: tableLayoutDraft,
        applyToAllExamTypes: true,
      });
      const saved = await saveGlobalRaportTableLayoutSettings(next);
      setTableLayouts(saved);
      toast.success(message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      toast.error(`Gagal menyimpan pengaturan tabel: ${message}`);
    } finally {
      setSavingTableLayout(false);
    }
  };

  const handleTableLayoutPreset = (orientation: Orientation) => {
    const reset = getDefaultRaportTableLayout(orientation);
    setTableLayouts((current) => ({
      ...current,
      [orientation]: reset,
    }));
    setOpts((current) => ({ ...current, orientation }));
    setTableLayoutDraft(reset);
  };

  if (!activeUjian) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Raport Ujian {activeUjian.mode}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing((v) => !v)}
            >
              <Settings2 className="w-4 h-4 mr-1" />
              {editing ? "Tutup Editor" : "Editor Raport"}
            </Button>

            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={opts.orientation}
              onChange={(e) =>
                setOpts({
                  ...opts,
                  orientation: e.target.value as Orientation,
                })
              }
            >
              <option value="portrait">A4 Portrait</option>
              <option value="landscape">A4 Landscape</option>
            </select>

            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={opts.showQR}
                onCheckedChange={(v) =>
                  setOpts({
                    ...opts,
                    showQR: v,
                  })
                }
              />
              QR Verifikasi
            </label>

            {verifyUrl && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                <span className="font-medium">Link Verifikasi</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 bg-white px-2 text-xs"
                  onClick={handleOpenVerification}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Buka
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 bg-white px-2 text-xs"
                  onClick={handleCopyVerification}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Salin Link
                </Button>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={opts.showWatermark}
                onCheckedChange={(v) =>
                  setOpts({
                    ...opts,
                    showWatermark: v,
                  })
                }
              />
              Watermark
            </label>
          </div>

          <div className="flex gap-2">
            {previewUrl && (
              <Button variant="outline" size="sm" onClick={handleOpenPdfPreview}>
                <ExternalLink className="w-4 h-4 mr-1" /> Buka Preview
              </Button>
            )}

            {verifyUrl && (
              <Button variant="outline" size="sm" onClick={handleOpenVerification}>
                <ExternalLink className="w-4 h-4 mr-1" /> Buka Verifikasi
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Cetak
            </Button>

            <Button
              variant={assetEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setAssetEditing((value) => !value)}
            >
              <Move className="mr-1 h-4 w-4" />
              {assetEditing ? "Tutup Pengaturan Aset" : "Pengaturan Aset PDF"}
            </Button>

            {isAdmin && (
              <Button
                variant={tableEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setTableEditing((value) => !value)}
              >
                <Settings2 className="mr-1 h-4 w-4" />
                {tableEditing ? "Tutup Editor Tabel" : "Editor Tabel PDF"}
              </Button>
            )}

            <Button size="sm" onClick={handleDownload} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        {editing && (
          <div className="space-y-4 p-3 rounded-md bg-muted/50 border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama Sekolah</Label>
                <Input
                  value={header.schoolName}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      schoolName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Program</Label>
                <Input
                  value={header.programName}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      programName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Alamat</Label>
                <Input
                  value={header.address}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      address: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kepala Sekolah</Label>
                <Input
                  value={header.headmaster}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      headmaster: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">NIP</Label>
                <Input
                  value={header.nip}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      nip: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Jabatan Penguji</Label>
                <Input
                  value={header.examinerTitle}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      examinerTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kota</Label>
                <Input
                  value={header.city}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      city: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tanggal Raport</Label>
                <Input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Catatan Guru</Label>
                <Textarea
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan otomatis akan muncul berdasarkan nilai siswa"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">
                  Ukuran Font Body ({opts.fontSize}pt)
                </Label>
                <Input
                  type="range"
                  min={7}
                  max={12}
                  value={opts.fontSize}
                  onChange={(e) =>
                    setOpts({
                      ...opts,
                      fontSize: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
              {(
                [
                  ["logoLeft", "Logo Kiri"],
                  ["logoRight", "Logo Kanan"],
                  ["sigExaminer", "TTD Penguji"],
                  ["sigHeadmaster", "TTD Kepsek"],
                  ["watermark", "Watermark"],
                ] as [keyof RaportAssets, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>

                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer inline-flex items-center justify-center h-9 px-2 rounded-md border border-input bg-background hover:bg-accent text-xs">
                      {assets[key] ? (
                        <ImageIcon className="w-3 h-3 mr-1" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      {assets[key] ? "Ganti" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={onUpload(key)}
                      />
                    </label>

                    {assets[key] && (
                      <button
                        type="button"
                        onClick={() =>
                          setAssets((a) => ({
                            ...a,
                            [key]: undefined,
                          }))
                        }
                        className="h-9 w-9 rounded-md border border-input hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                        title="Hapus"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {(assets[key] || profileAssets[key]) && (
                    <img
                      src={assets[key] || profileAssets[key]}
                      alt={label}
                      className="h-10 mt-1 object-contain bg-white border rounded"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && tableEditing && (
          <PdfTableLayoutEditor
            orientation={opts.orientation}
            value={tableLayoutDraft}
            saving={savingTableLayout}
            onChange={setTableLayoutDraft}
            onApply={handleApplyTableLayout}
            onSave={() => void persistTableLayout("Pengaturan tabel global berhasil disimpan")}
            onPreset={handleTableLayoutPreset}
            onApplyAll={() =>
              void persistTableLayout("Pengaturan diterapkan ke semua jenis ujian")
            }
          />
        )}

        {assetEditing ? (
          <PdfAssetsLayoutEditor
            orientation={opts.orientation}
            assets={assets}
            layout={visualLayout}
            pdfBlob={previewBlob}
            onChange={setVisualLayout}
            onSave={handleSaveVisualLayout}
            onApply={refreshPreview}
            onPreviewAgain={refreshPreview}
          />
        ) : (
          <div
            className="relative bg-muted/30 rounded-md border overflow-hidden"
            style={{ height: "70vh" }}
          >
          {loadingPreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm">Memperbarui preview...</span>
            </div>
          )}

          {previewUrl ? (
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                <p>Browser memblokir preview PDF di dalam halaman ini.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleOpenPdfPreview}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Buka Preview di Tab Baru
                </Button>
              </div>
            </object>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              Memuat preview...
            </div>
          )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic text-center">
          Preview di atas adalah PDF persis yang akan diunduh & dicetak (single
          source of truth).
        </p>
      </DialogContent>
    </Dialog>
  );
}
