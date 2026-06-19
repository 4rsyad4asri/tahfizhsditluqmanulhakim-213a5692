import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateTahfizhAssessmentsForDisplay,
  normalizeTahfizhPayload,
  normalizeTahfizhPenaltyConfig,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { Loader2, Download, BarChart3, Award, BookOpen, Users, Eye, FileArchive, FileText, RotateCcw, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { exportJsonToExcel } from "@/utils/excel";
import RaportPreviewDialog from "@/components/RaportPreviewDialog";
import {
  buildRaportData,
  buildEffectiveOpts,
  loadRaportSettings,
} from "@/utils/raportBuilder";
import { inferTahfizhModeForExam, usesLegacyTahfizhScoring } from "@/utils/verificationUrl";
import { generateRaportPDF, downloadRaportPDF } from "@/utils/raportPdf";
import { resolveRaportSignatureAssets } from "@/utils/officialSignatures";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { formatStudentName } from "@/utils/formatName";
import { resolveExamClassName, resolveExamGrade } from "@/utils/examSnapshot";

interface Row {
  ujianId: string;
  studentId: string;
  studentName: string;
  className: string;
  grade: number;
  mode: string;
  displayMode: string;
  tanggal: string;
  createdAt: string;
  nilai: number;
  status: string;
  predikat: string;
  ujian: any;
  nis?: string | null;
  nisn?: string | null;
  assessorName?: string;
}

interface BulkFailedItem {
  row: Row;
  message: string;
}

interface BulkJob {
  status: "running" | "failed" | "completed" | "cancelled";
  current: number;
  total: number;
  batch: number;
  totalBatches: number;
  failed: BulkFailedItem[];
  message?: string;
}

interface CombinedPdfProgress {
  current: number;
  total: number;
  failed: number;
  message?: string;
}

interface RekapGlobalQueryResult {
  rows: Row[];
  classOptions: string[];
}

const MODE_COLORS: Record<string, string> = {
  "Tahfizh Reguler": "hsl(var(--primary))",
  "Tahfizh Sertifikat": "hsl(var(--accent))",
  "Tahsin Dasar": "hsl(var(--success))",
  "Tahsin Lanjutan": "hsl(var(--warning))",
};

const BULK_BATCH_SIZE = 10;

function getTahfizhPenaltyConfig(config: any): TahfizhPenaltyConfig {
  return normalizeTahfizhPenaltyConfig(config);
}

function getSyncedUjian(ujian: any) {
  if (ujian?.mode !== "Tahfizh") return ujian;

  const aspek =
    ujian.nilai_aspek && typeof ujian.nilai_aspek === "object" && !Array.isArray(ujian.nilai_aspek)
      ? ujian.nilai_aspek
      : {};
  const rawEntries = Array.isArray(aspek.surahEntries) ? aspek.surahEntries : [];
  if (rawEntries.length === 0) return ujian;

  const entries = aggregateTahfizhAssessmentsForDisplay(rawEntries) as TahfizhSurahAssessment[];
  const legacyScoring = usesLegacyTahfizhScoring({
    mode: ujian.mode,
    assessedBy: ujian.assessed_by,
    tanggal: ujian.tanggal,
  });
  const normalized = normalizeTahfizhPayload({
    entries,
    nilaiAspek: aspek,
    tahfizhMode: (inferTahfizhModeForExam({
      mode: ujian?.mode,
      tahfizhMode: aspek.tahfizhMode,
      verificationType: aspek.verificationType,
      assessedBy: ujian?.assessed_by,
      tanggal: ujian?.tanggal,
    }) || "Reguler") as TahfizhExamMode,
    config: getTahfizhPenaltyConfig(aspek.config),
    manualStopReason: legacyScoring ? "" : aspek.manualStopReason || "",
    ignoreAutoFail: legacyScoring,
    autoFailConfig: aspek.autoFailConfig,
  });
  const result = normalized.result;

  return {
    ...ujian,
    nilai_akhir: result.nilaiAkhir,
    status: result.status,
    grade: result.grade,
    nilai_aspek: {
      ...aspek,
      predikat: result.predikat,
      statusLabel: result.statusLabel,
    },
  };
}

function getRowTimestamp(row: Row) {
  const tanggalTime = row.tanggal ? new Date(row.tanggal).getTime() : 0;
  const createdTime = row.createdAt ? new Date(row.createdAt).getTime() : 0;
  return {
    tanggalTime: Number.isNaN(tanggalTime) ? 0 : tanggalTime,
    createdTime: Number.isNaN(createdTime) ? 0 : createdTime,
  };
}

function sortRowsNewestFirst(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const at = getRowTimestamp(a);
    const bt = getRowTimestamp(b);
    return bt.tanggalTime - at.tanggalTime || bt.createdTime - at.createdTime;
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

const rowDisplayCollator = new Intl.Collator("id-ID", {
  numeric: true,
  sensitivity: "base",
});

function sortRowsForDisplay(rows: Row[]) {
  return [...rows].sort((a, b) => {
    return (
      a.grade - b.grade ||
      rowDisplayCollator.compare(a.className, b.className) ||
      rowDisplayCollator.compare(a.studentName, b.studentName) ||
      rowDisplayCollator.compare(a.displayMode, b.displayMode) ||
      rowDisplayCollator.compare(a.tanggal, b.tanggal)
    );
  });
}

function getDisplayMode(ujian: any) {
  if (ujian?.mode !== "Tahfizh") return ujian?.mode || "-";

  const aspek =
    ujian?.nilai_aspek && typeof ujian.nilai_aspek === "object" && !Array.isArray(ujian.nilai_aspek)
      ? ujian.nilai_aspek
      : {};
  const tahfizhMode = inferTahfizhModeForExam({
    mode: ujian?.mode,
    tahfizhMode: aspek?.tahfizhMode,
    verificationType: aspek?.verificationType,
    assessedBy: ujian?.assessed_by,
    tanggal: ujian?.tanggal,
  }) || "Reguler";

  return `Tahfizh ${tahfizhMode}`;
}

export default function RekapGlobal() {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPredikat, setFilterPredikat] = useState<string>("all");
  const [onlyLatest, setOnlyLatest] = useState<boolean>(true);
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDownloadingCombinedPdf, setIsDownloadingCombinedPdf] = useState(false);
  const [combinedPdfProgress, setCombinedPdfProgress] = useState<CombinedPdfProgress | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const combinedPdfCancelRef = useRef(false);
  const bulkCancelRef = useRef(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["rekap-global"],
    queryFn: async () => {
      const { data: ujianData, error: e1 } = await supabase
        .from("ujian")
        .select("id, student_id, mode, tanggal, created_at, nilai_akhir, status, nilai_aspek, grade, verification_token, document_status, assessed_by, class_name_at_exam, grade_at_exam, academic_year_id")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      const studentIds = [...new Set((ujianData || []).map((u) => u.student_id))];
      const { data: students } = studentIds.length
        ? await supabase.from("students").select("id, name, class_id, nis, nisn").in("id", studentIds)
        : { data: [] as any[] };
      const classIds = [...new Set((students || []).map((s: any) => s.class_id))];
      const { data: classes } = classIds.length
        ? await supabase.from("classes").select("id, name, grade").in("id", classIds)
        : { data: [] as any[] };

      const assessorIds = [...new Set((ujianData || []).map((u: any) => u.assessed_by).filter(Boolean))];
      const { data: profiles } = assessorIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", assessorIds)
        : { data: [] as any[] };

      const sMap = new Map((students || []).map((s: any) => [s.id, s]));
      const cMap = new Map((classes || []).map((c: any) => [c.id, c]));
      const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const rows: Row[] = (ujianData || []).map((u: any) => {
        const s = sMap.get(u.student_id) as any;
        const c = s ? cMap.get(s.class_id) as any : null;
        const p = u.assessed_by ? (pMap.get(u.assessed_by) as any) : null;
        const syncedUjian = getSyncedUjian(u);
        const aspek = syncedUjian.nilai_aspek as any;
        return {
          ujianId: syncedUjian.id,
          studentId: syncedUjian.student_id,
          studentName: formatStudentName(s?.name || "Unknown"),
          className: resolveExamClassName(syncedUjian, c) || "Unknown",
          grade: resolveExamGrade(syncedUjian, c?.grade),
          mode: syncedUjian.mode,
          displayMode: getDisplayMode(syncedUjian),
          tanggal: syncedUjian.tanggal,
          createdAt: syncedUjian.created_at,
          nilai: syncedUjian.nilai_akhir,
          status: syncedUjian.status,
          predikat: aspek?.predikat || "-",
          ujian: syncedUjian,
          nis: s?.nis,
          nisn: s?.nisn,
          assessorName: p?.full_name || aspek?.assessorName,
        };
      });
      const classOptions = [...new Set((classes || []).map((c: any) => c?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      return { rows, classOptions } satisfies RekapGlobalQueryResult;
    },
  });

  const filtered = useMemo(() => {
    let r = data?.rows || [];
    if (filterMode !== "all") r = r.filter((x) => x.displayMode === filterMode);
    if (filterGrade !== "all") r = r.filter((x) => x.grade === parseInt(filterGrade));
    if (filterClass !== "all") r = r.filter((x) => x.className === filterClass);
    if (filterStatus !== "all") r = r.filter((x) => x.status === filterStatus);
    if (filterPredikat !== "all") r = r.filter((x) => x.predikat === filterPredikat);
    r = sortRowsNewestFirst(r);
    if (onlyLatest) {
      const seen = new Set<string>();
      const out: Row[] = [];
      for (const row of r) {
        if (seen.has(row.studentId)) continue;
        seen.add(row.studentId);
        out.push(row);
      }
      r = out;
    }
    return sortRowsForDisplay(r);
  }, [data, filterMode, filterGrade, filterClass, filterStatus, filterPredikat, onlyLatest]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const lulus = filtered.filter((r) => r.status === "Lulus").length;
    const avg = total ? Math.round(filtered.reduce((s, r) => s + r.nilai, 0) / total) : 0;
    const uniqueStudents = new Set(filtered.map((r) => r.studentId)).size;
    return { total, lulus, avg, uniqueStudents };
  }, [filtered]);

  const byMode = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { m[r.displayMode] = (m[r.displayMode] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byClass = useMemo(() => {
    const m: Record<string, { lulus: number; tidak: number }> = {};
    filtered.forEach((r) => {
      if (!m[r.className]) m[r.className] = { lulus: 0, tidak: 0 };
      if (r.status === "Lulus") m[r.className].lulus++;
      else m[r.className].tidak++;
    });
    return Object.entries(m).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const byPredikat = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { m[r.predikat] = (m[r.predikat] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const grades = useMemo(() => [...new Set((data?.rows || []).map((r) => r.grade))].sort(), [data]);
  const classNames = useMemo(() => data?.classOptions || [], [data]);
  const predikatOptions = useMemo(
    () => [...new Set((data?.rows || []).map((r) => r.predikat).filter((predikat) => predikat && predikat !== "-"))].sort((a, b) => a.localeCompare(b)),
    [data]
  );
  const totalByMode = useMemo(() => byMode.reduce((sum, item) => sum + item.value, 0), [byMode]);

  const renderModeLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    value?: number;
  }) => {
    if (!value || !cx || !cy || midAngle === undefined || innerRadius === undefined || outerRadius === undefined) {
      return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[11px] font-semibold"
      >
        {value}
      </text>
    );
  };

  const handleOnlyLatestChange = async (checked: boolean) => {
    setOnlyLatest(checked);
    if (!checked) return;

    try {
      toast.info("Menyinkronkan data ujian terbaru...");
      await refetch();
      toast.success("Data ujian terbaru sudah disinkronkan");
    } catch (e) {
      toast.error("Gagal menyinkronkan data terbaru: " + getErrorMessage(e));
    }
  };

  const handleExport = () => {
    exportJsonToExcel(
      filtered.map((r) => ({
        Nama: r.studentName, Kelas: r.className, Kelas_Tingkat: r.grade,
        Mode: r.displayMode, Tanggal: r.tanggal, Nilai: r.nilai, Status: r.status, Predikat: r.predikat,
      })),
      "Rekap Global",
      `Rekap_Global_${new Date().toISOString().slice(0,10)}.xlsx`
    );
  };

  const getCombinedPdfFileName = () => {
    const activeFilters: string[] = [];

    if (filterMode !== "all") activeFilters.push(filterMode);
    if (filterGrade !== "all") activeFilters.push(`Kelas ${filterGrade}`);
    if (filterClass !== "all") activeFilters.push(`Kelas ${filterClass}`);
    if (filterStatus !== "all") activeFilters.push(filterStatus);
    if (filterPredikat !== "all") activeFilters.push(`Predikat ${filterPredikat}`);

    const suffix = activeFilters.length > 0
      ? activeFilters.map(sanitizeFileName).filter(Boolean).join("_")
      : "Semua_Data";

    return `Rekap_Global_${suffix}.pdf`;
  };

  const handleDownloadCombinedPdf = async () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk didownload sesuai filter yang dipilih.");
      return;
    }

    setIsDownloadingCombinedPdf(true);
    combinedPdfCancelRef.current = false;
    setCombinedPdfProgress({ current: 0, total: filtered.length, failed: 0, message: "Menyiapkan pengaturan raport..." });
    try {
      const { header, assets, opts } = await loadRaportSettings();
      const mergedPdf = await PDFDocument.create();
      const failed: BulkFailedItem[] = [];
      let successCount = 0;

      for (let index = 0; index < filtered.length; index++) {
        if (combinedPdfCancelRef.current) {
          toast.info("Download gabungan PDF dibatalkan.");
          return;
        }

        const row = filtered[index];
        const current = index + 1;
        setCombinedPdfProgress({
          current: index,
          total: filtered.length,
          failed: failed.length,
          message: `Membuat raport ${current}/${filtered.length}: ${row.studentName}`,
        });

        try {
          const raportData = buildRaportData(
            row.ujian,
            row.studentName,
            row.className,
            row.assessorName,
            undefined,
            row.nis,
            row.nisn
          );
          const effectiveOpts = await buildEffectiveOpts(opts, raportData, row.ujian);
          const resolvedAssets = await resolveRaportSignatureAssets(row.ujian?.assessed_by, assets);
          const raportPdf = await generateRaportPDF(raportData, header, resolvedAssets, effectiveOpts);
          const sourcePdf = await PDFDocument.load(raportPdf.output("arraybuffer"));
          const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          successCount++;
        } catch (error) {
          const message = getErrorMessage(error) || "Gagal membuat PDF";
          failed.push({ row, message });
          console.error("Gagal generate raport gabungan untuk", row.studentName, error);
        }

        if (combinedPdfCancelRef.current) {
          setCombinedPdfProgress({
            current,
            total: filtered.length,
            failed: failed.length,
            message: "Download gabungan PDF dibatalkan",
          });
          toast.info("Download gabungan PDF dibatalkan.");
          return;
        }

        setCombinedPdfProgress({
          current,
          total: filtered.length,
          failed: failed.length,
          message: `Diproses ${current}/${filtered.length}`,
        });
      }

      if (successCount === 0) {
        toast.error(`Tidak ada PDF yang berhasil dibuat. ${failed.length} gagal.`);
        return;
      }

      if (combinedPdfCancelRef.current) {
        toast.info("Download gabungan PDF dibatalkan.");
        return;
      }

      setCombinedPdfProgress({
        current: filtered.length,
        total: filtered.length,
        failed: failed.length,
        message: "Menggabungkan file PDF...",
      });

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getCombinedPdfFileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (failed.length > 0) {
        toast.error(`${failed.length} raport gagal dibuat. ${successCount} berhasil digabung.`);
      } else {
        toast.success(`PDF gabungan berhasil diunduh: ${successCount} raport.`);
      }
    } catch (error) {
      toast.error(`Gagal membuat PDF gabungan: ${getErrorMessage(error) || "Terjadi kesalahan."}`);
    } finally {
      setIsDownloadingCombinedPdf(false);
      setCombinedPdfProgress(null);
      combinedPdfCancelRef.current = false;
    }
  };

  const handleDownloadOne = async (r: Row) => {
    setDownloadingId(r.ujianId);
    try {
      const { header, assets, opts } = await loadRaportSettings();
      const data = buildRaportData(
        r.ujian,
        r.studentName,
        r.className,
        r.assessorName,
        undefined,
        r.nis,
        r.nisn
      );
      const eff = await buildEffectiveOpts(opts, data, r.ujian);
      const resolvedAssets = await resolveRaportSignatureAssets(r.ujian?.assessed_by, assets);
      await downloadRaportPDF(data, header, resolvedAssets, eff);
      toast.success(`Raport ${r.studentName} berhasil diunduh`);
    } catch (e) {
      toast.error("Gagal mengunduh raport: " + getErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadZipBlob = (zipBlob: Blob, retry = false) => {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Raport_Global_${retry ? "Retry_" : ""}${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runBulkDownload = async (rows: Row[], retry = false) => {
    if (rows.length === 0) {
      toast.error("Tidak ada data untuk diunduh");
      return;
    }
    if (!retry && rows.length > 100) {
      if (!confirm(`Anda akan mengunduh ${rows.length} raport sekaligus. Lanjutkan?`)) return;
    }

    const { header, assets, opts } = await loadRaportSettings();
    const zip = new JSZip();
    const failed: BulkFailedItem[] = [];
    const totalBatches = Math.ceil(rows.length / BULK_BATCH_SIZE);
    let successCount = 0;
    bulkCancelRef.current = false;
    setBulkJob({ status: "running", current: 0, total: rows.length, batch: 1, totalBatches, failed: [] });

    try {
      for (let start = 0; start < rows.length; start += BULK_BATCH_SIZE) {
        if (bulkCancelRef.current) {
          setBulkJob({
            status: "cancelled",
            current: start,
            total: rows.length,
            batch: Math.min(Math.floor(start / BULK_BATCH_SIZE) + 1, totalBatches),
            totalBatches,
            failed,
            message: "Download massal dibatalkan",
          });
          toast.info("Download massal dibatalkan");
          return;
        }

        const batchRows = rows.slice(start, start + BULK_BATCH_SIZE);
        const batch = Math.floor(start / BULK_BATCH_SIZE) + 1;
        setBulkJob({ status: "running", current: start, total: rows.length, batch, totalBatches, failed });

        for (let index = 0; index < batchRows.length; index++) {
          const r = batchRows[index];
          const current = start + index + 1;
          setBulkJob({ status: "running", current, total: rows.length, batch, totalBatches, failed });

          if (bulkCancelRef.current) {
            setBulkJob({
              status: "cancelled",
              current: current - 1,
              total: rows.length,
              batch,
              totalBatches,
              failed,
              message: "Download massal dibatalkan",
            });
            toast.info("Download massal dibatalkan");
            return;
          }

          try {
            const data = buildRaportData(
              r.ujian,
              r.studentName,
              r.className,
              r.assessorName,
              undefined,
              r.nis,
              r.nisn
            );
            const eff = await buildEffectiveOpts(opts, data, r.ujian);
            const resolvedAssets = await resolveRaportSignatureAssets(r.ujian?.assessed_by, assets);
            const doc = await generateRaportPDF(data, header, resolvedAssets, eff);
            const blob = doc.output("blob") as Blob;
            const fname = `Raport_${sanitizeFileName(r.displayMode)}_${sanitizeFileName(r.className)}_${sanitizeFileName(r.studentName)}.pdf`;
            zip.file(fname, blob);
            successCount++;
          } catch (e) {
            const message = getErrorMessage(e) || "Gagal membuat PDF";
            failed.push({ row: r, message });
            console.error("Gagal generate raport untuk", r.studentName, e);
          }
        }
      }

      if (successCount > 0) {
        setBulkJob({ status: "running", current: rows.length, total: rows.length, batch: totalBatches, totalBatches, failed, message: "Membuat file ZIP..." });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadZipBlob(zipBlob, retry);
      }

      if (failed.length > 0) {
        setBulkJob({
          status: "failed",
          current: rows.length,
          total: rows.length,
          batch: totalBatches,
          totalBatches,
          failed,
          message: `${failed.length} raport gagal dibuat. Gunakan tombol retry untuk mencoba ulang.`,
        });
        toast.error(`${failed.length} raport gagal dibuat. ${successCount} berhasil.`);
        return;
      }

      setBulkJob({
        status: "completed",
        current: rows.length,
        total: rows.length,
        batch: totalBatches,
        totalBatches,
        failed: [],
        message: `${successCount} raport berhasil diunduh`,
      });
      toast.success(`Berhasil mengunduh ${successCount} raport`);
    } catch (e) {
      setBulkJob({
        status: "failed",
        current: 0,
        total: rows.length,
        batch: 0,
        totalBatches,
        failed,
        message: "Gagal bulk download: " + getErrorMessage(e),
      });
      toast.error("Gagal bulk download: " + getErrorMessage(e));
    }
  };

  const handleBulkDownload = async () => {
    await runBulkDownload(filtered);
  };

  const handleRetryBulkDownload = async () => {
    const failedRows = bulkJob?.failed.map((item) => item.row) || [];
    await runBulkDownload(failedRows, true);
  };

  const handleCancelBulkDownload = () => {
    bulkCancelRef.current = true;
    setBulkJob((job) => job ? { ...job, message: "Membatalkan setelah proses saat ini selesai..." } : job);
  };

  const handleCancelCombinedPdf = () => {
    combinedPdfCancelRef.current = true;
    setCombinedPdfProgress((progress) =>
      progress ? { ...progress, message: "Membatalkan setelah raport saat ini selesai..." } : progress
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Rekap Global Ujian
            </h1>
            <p className="text-sm text-muted-foreground">Ringkasan seluruh ujian Tahfizh & Tahsin lintas kelas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleDownloadCombinedPdf} disabled={isDownloadingCombinedPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-50">
              {isDownloadingCombinedPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {combinedPdfProgress ? `${combinedPdfProgress.current}/${combinedPdfProgress.total}` : "Memproses"}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Download Gabungan PDF
                </>
              )}
            </button>
            {isDownloadingCombinedPdf && (
              <button onClick={handleCancelCombinedPdf}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/5">
                <XCircle className="w-4 h-4" /> Batal Gabungan
              </button>
            )}
            <button onClick={handleBulkDownload} disabled={bulkJob?.status === "running"}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-50">
              {bulkJob?.status === "running" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {bulkJob.current}/{bulkJob.total}
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" /> Download Massal (ZIP)
                </>
              )}
            </button>
            {bulkJob?.status === "running" && (
              <button onClick={handleCancelBulkDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/5">
                <XCircle className="w-4 h-4" /> Batal
              </button>
            )}
            {bulkJob?.status === "failed" && bulkJob.failed.length > 0 && (
              <button onClick={handleRetryBulkDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-warning/30 text-warning hover:bg-warning/5">
                <RotateCcw className="w-4 h-4" /> Retry Gagal ({bulkJob.failed.length})
              </button>
            )}
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90">
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        </div>

        {combinedPdfProgress && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">Status Download Gabungan PDF</p>
                <p className="text-xs text-muted-foreground">
                  {combinedPdfProgress.current}/{combinedPdfProgress.total} raport diproses
                  {combinedPdfProgress.failed > 0 ? ` - ${combinedPdfProgress.failed} gagal` : ""}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Berjalan</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${combinedPdfProgress.total ? Math.round((combinedPdfProgress.current / combinedPdfProgress.total) * 100) : 0}%` }}
              />
            </div>
            {combinedPdfProgress.message && <p className="text-xs text-muted-foreground">{combinedPdfProgress.message}</p>}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 rounded-lg border border-border bg-card">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mode Ujian</label>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Mode</option>
              <option value="Tahfizh Reguler">Tahfizh Reguler</option>
              <option value="Tahfizh Sertifikat">Tahfizh Sertifikat</option>
              <option value="Tahsin Dasar">Tahsin Dasar</option>
              <option value="Tahsin Lanjutan">Tahsin Lanjutan</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Kelas Tingkat</label>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Tingkat</option>
              {grades.map((g) => <option key={g} value={g}>Kelas {g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Kelas</label>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Kelas</option>
              {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status Kelulusan</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Status</option>
              <option value="Lulus">Lulus</option>
              <option value="Tidak Lulus">Tidak Lulus</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Predikat</label>
            <select value={filterPredikat} onChange={(e) => setFilterPredikat(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Predikat</option>
              {predikatOptions.map((predikat) => <option key={predikat} value={predikat}>{predikat}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLatest}
                onChange={(e) => handleOnlyLatestChange(e.target.checked)}
                className="rounded border-input"
              />
              <span className="inline-flex items-center gap-1">
                Hanya ujian terakhir per siswa
                {isFetching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </span>
            </label>
          </div>
          {onlyLatest && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => handleOnlyLatestChange(true)}
                disabled={isFetching}
                className="px-3 py-2 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Sinkronkan Terbaru
              </button>
            </div>
          )}
        </div>

        {bulkJob && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">Status Download Massal ZIP</p>
                <p className="text-xs text-muted-foreground">
                  Batch {Math.max(bulkJob.batch, 1)} dari {Math.max(bulkJob.totalBatches, 1)} • {bulkJob.current}/{bulkJob.total} raport diproses
                  {bulkJob.failed.length > 0 ? ` • ${bulkJob.failed.length} gagal` : ""}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                bulkJob.status === "failed" ? "bg-destructive/10 text-destructive" :
                bulkJob.status === "completed" ? "bg-success/10 text-success" :
                bulkJob.status === "cancelled" ? "bg-muted text-muted-foreground" :
                "bg-primary/10 text-primary"
              }`}>
                {bulkJob.status === "running" ? "Berjalan" :
                 bulkJob.status === "failed" ? "Ada Error" :
                 bulkJob.status === "cancelled" ? "Dibatalkan" : "Selesai"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${bulkJob.total ? Math.round((bulkJob.current / bulkJob.total) * 100) : 0}%` }}
              />
            </div>
            {bulkJob.message && <p className="text-xs text-muted-foreground">{bulkJob.message}</p>}
            {bulkJob.failed.length > 0 && (
              <div className="max-h-28 overflow-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {bulkJob.failed.slice(0, 5).map((item) => (
                  <p key={item.row.ujianId}>{item.row.studentName} - {item.message}</p>
                ))}
                {bulkJob.failed.length > 5 && <p>Dan {bulkJob.failed.length - 5} error lainnya.</p>}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: BookOpen, label: "Total Ujian", val: stats.total, color: "text-primary" },
                { icon: Users, label: "Siswa Diuji", val: stats.uniqueStudents, color: "text-info" },
                { icon: Award, label: "Lulus", val: stats.lulus, color: "text-success" },
                { icon: BarChart3, label: "Rata-rata Nilai", val: stats.avg, color: "text-warning" },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-lg border border-border bg-card shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-2xl font-bold text-foreground">{s.val}</p>
                    </div>
                    <s.icon className={`w-8 h-8 ${s.color}`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-3">Distribusi Mode Ujian</h3>
                <div className="relative h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byMode}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                        cornerRadius={10}
                        stroke="none"
                        labelLine={false}
                        label={renderModeLabel}
                      >
                        {byMode.map((d) => (
                          <Cell key={d.name} fill={MODE_COLORS[d.name] || "hsl(var(--muted))"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} ujian`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-background/88 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
                      <p className="text-3xl font-bold text-foreground">{totalByMode}</p>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Total Ujian</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {byMode.map((item) => {
                    const pct = totalByMode > 0 ? Math.round((item.value / totalByMode) * 100) : 0;
                    return (
                      <div key={item.name} className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: MODE_COLORS[item.name] || "hsl(var(--muted))" }}
                          />
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                        </div>
                        <div className="mt-1 flex items-end justify-between gap-3">
                          <p className="text-lg font-bold text-foreground">{item.value}</p>
                          <p className="text-xs font-medium text-muted-foreground">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-3">Lulus vs Tidak Lulus per Kelas</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byClass}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="lulus" name="Lulus" fill="hsl(var(--success))" />
                    <Bar dataKey="tidak" name="Tidak Lulus" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Sebaran Predikat</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPredikat}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Detail Ujian ({filtered.length})</h3>
              <table className="min-w-[1040px] text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Nama</th>
                    <th className="text-left py-2 px-2">Kelas</th>
                    <th className="text-left py-2 px-2">Mode</th>
                    <th className="text-left py-2 px-2">Tanggal</th>
                    <th className="text-center py-2 px-2">Nilai</th>
                    <th className="text-left py-2 px-2">Predikat</th>
                    <th className="text-center py-2 px-2">Status</th>
                    <th className="text-center py-2 px-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => (
                    <tr key={r.ujianId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium text-foreground">{r.studentName}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.className}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.displayMode === "Tahfizh Sertifikat"
                            ? "bg-accent/15 text-accent-foreground"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {r.displayMode}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{r.tanggal}</td>
                      <td className="py-2 px-2 text-center font-semibold text-foreground">{r.nilai}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.predikat}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "Lulus" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setPreviewRow(r)}
                            title="Preview Raport"
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadOne(r)}
                            disabled={downloadingId === r.ujianId}
                            title="Download PDF"
                            className="p-1.5 rounded-md hover:bg-success/10 text-success disabled:opacity-50"
                          >
                            {downloadingId === r.ujianId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">Menampilkan 200 baris pertama. Export Excel untuk data lengkap.</p>
              )}
            </div>
          </>
        )}
      </div>

      {previewRow && (
        <RaportPreviewDialog
          open={!!previewRow}
          onClose={() => setPreviewRow(null)}
          ujian={previewRow.ujian}
          studentName={previewRow.studentName}
          className={previewRow.className}
          nis={previewRow.nis}
          nisn={previewRow.nisn}
          assessorName={previewRow.assessorName}
        />
      )}
    </div>
  );
}
