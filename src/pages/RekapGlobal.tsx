import { useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhExamResult,
  DEFAULT_TAHFIZH_PENALTY,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { getStandardExamGrading } from "@/data/grading";
import { Loader2, Download, BarChart3, Award, BookOpen, Users, Eye, FileArchive, RotateCcw, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { exportJsonToExcel } from "@/utils/excel";
import RaportPreviewDialog from "@/components/RaportPreviewDialog";
import {
  buildRaportData,
  buildEffectiveOpts,
  loadRaportSettings,
} from "@/utils/raportBuilder";
import { generateRaportPDF, downloadRaportPDF } from "@/utils/raportPdf";
import JSZip from "jszip";
import { toast } from "sonner";

interface Row {
  ujianId: string;
  studentId: string;
  studentName: string;
  className: string;
  grade: number;
  mode: string;
  tanggal: string;
  createdAt: string;
  nilai: number;
  status: string;
  predikat: string;
  ujian: any;
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

const MODE_COLORS: Record<string, string> = {
  "Tahfizh": "hsl(var(--primary))",
  "Tahsin Dasar": "hsl(var(--success))",
  "Tahsin Lanjutan": "hsl(var(--warning))",
};

const BULK_BATCH_SIZE = 10;

function getTahfizhPenaltyConfig(config: any): TahfizhPenaltyConfig {
  return {
    lahnJali: Number(config?.lahnJali ?? config?.penalti_lahn_jali ?? DEFAULT_TAHFIZH_PENALTY.lahnJali),
    lahnKhofi: Number(config?.lahnKhofi ?? config?.penalti_lahn_khofi ?? DEFAULT_TAHFIZH_PENALTY.lahnKhofi),
    waqaf: Number(config?.waqaf ?? config?.penalti_waqaf ?? DEFAULT_TAHFIZH_PENALTY.waqaf),
    salahSambung: Number(config?.salahSambung ?? config?.penalti_salah_sambung ?? DEFAULT_TAHFIZH_PENALTY.salahSambung),
  };
}

function isLegacyClassSixExam(classInfo: any, ujian: any) {
  const grade = Number(classInfo?.grade ?? String(classInfo?.name || "").match(/\d+/)?.[0]);
  return grade === 6 && !!ujian?.id;
}

function getLegacyClassSixTahfizhState(nilai: number) {
  const grading = getStandardExamGrading(nilai);
  return { ...grading, statusLabel: grading.status };
}

function getSyncedUjian(ujian: any, classInfo?: any) {
  if (ujian?.mode !== "Tahfizh") return ujian;

  const aspek =
    ujian.nilai_aspek && typeof ujian.nilai_aspek === "object" && !Array.isArray(ujian.nilai_aspek)
      ? ujian.nilai_aspek
      : {};
  const rawEntries = Array.isArray(aspek.surahEntries) ? aspek.surahEntries : [];
  if (rawEntries.length === 0) return ujian;

  const entries = aggregateTahfizhAssessmentsForDisplay(rawEntries) as TahfizhSurahAssessment[];
  const result = calculateTahfizhExamResult(
    entries,
    (aspek.tahfizhMode || "Reguler") as TahfizhExamMode,
    getTahfizhPenaltyConfig(aspek.config),
    aspek.manualStopReason || "",
    isLegacyClassSixExam(classInfo, ujian),
    aspek.autoFailConfig,
  );
  const legacyState = isLegacyClassSixExam(classInfo, ujian)
    ? getLegacyClassSixTahfizhState(result.nilaiAkhir || result.rataRataAkhir)
    : undefined;
  const finalState = legacyState || result;

  return {
    ...ujian,
    nilai_akhir: result.nilaiAkhir,
    status: finalState.status,
    grade: finalState.grade,
    nilai_aspek: {
      ...aspek,
      predikat: finalState.predikat,
      statusLabel: finalState.statusLabel,
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

export default function RekapGlobal() {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [onlyLatest, setOnlyLatest] = useState<boolean>(true);
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const bulkCancelRef = useRef(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["rekap-global"],
    queryFn: async () => {
      const { data: ujianData, error: e1 } = await supabase
        .from("ujian")
        .select("id, student_id, mode, tanggal, created_at, nilai_akhir, status, nilai_aspek, grade, verification_token, document_status, assessed_by")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      const studentIds = [...new Set((ujianData || []).map((u) => u.student_id))];
      const { data: students } = studentIds.length
        ? await supabase.from("students").select("id, name, class_id").in("id", studentIds)
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
        const syncedUjian = getSyncedUjian(u, c);
        const aspek = syncedUjian.nilai_aspek as any;
        return {
          ujianId: syncedUjian.id,
          studentId: syncedUjian.student_id,
          studentName: s?.name || "Unknown",
          className: c?.name || "Unknown",
          grade: c?.grade || 0,
          mode: syncedUjian.mode,
          tanggal: syncedUjian.tanggal,
          createdAt: syncedUjian.created_at,
          nilai: syncedUjian.nilai_akhir,
          status: syncedUjian.status,
          predikat: aspek?.predikat || "-",
          ujian: syncedUjian,
          assessorName: p?.full_name || aspek?.assessorName,
        };
      });
      return rows;
    },
  });

  const filtered = useMemo(() => {
    let r = data || [];
    if (filterMode !== "all") r = r.filter((x) => x.mode === filterMode);
    if (filterGrade !== "all") r = r.filter((x) => x.grade === parseInt(filterGrade));
    if (filterClass !== "all") r = r.filter((x) => x.className === filterClass);
    if (filterStatus !== "all") r = r.filter((x) => x.status === filterStatus);
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
    return r;
  }, [data, filterMode, filterGrade, filterClass, filterStatus, onlyLatest]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const lulus = filtered.filter((r) => r.status === "Lulus").length;
    const avg = total ? Math.round(filtered.reduce((s, r) => s + r.nilai, 0) / total) : 0;
    const uniqueStudents = new Set(filtered.map((r) => r.studentId)).size;
    return { total, lulus, avg, uniqueStudents };
  }, [filtered]);

  const byMode = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { m[r.mode] = (m[r.mode] || 0) + 1; });
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

  const grades = useMemo(() => [...new Set((data || []).map((r) => r.grade))].sort(), [data]);
  const classNames = useMemo(() => [...new Set((data || []).map((r) => r.className))].sort((a, b) => a.localeCompare(b)), [data]);

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
        Mode: r.mode, Tanggal: r.tanggal, Nilai: r.nilai, Status: r.status, Predikat: r.predikat,
      })),
      "Rekap Global",
      `Rekap_Global_${new Date().toISOString().slice(0,10)}.xlsx`
    );
  };

  const handleDownloadOne = async (r: Row) => {
    setDownloadingId(r.ujianId);
    try {
      const { header, assets, opts } = loadRaportSettings();
      const data = buildRaportData(r.ujian, r.studentName, r.className, r.assessorName);
      const eff = buildEffectiveOpts(opts, data.verificationToken);
      await downloadRaportPDF(data, header, assets, eff);
      toast.success(`Raport ${r.studentName} berhasil diunduh`);
    } catch (e) {
      toast.error("Gagal mengunduh raport: " + getErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const sanitize = (s: string) => s.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");

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

    const { header, assets, opts } = loadRaportSettings();
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
            const data = buildRaportData(r.ujian, r.studentName, r.className, r.assessorName);
            const eff = buildEffectiveOpts(opts, data.verificationToken);
            const doc = await generateRaportPDF(data, header, assets, eff);
            const blob = doc.output("blob") as Blob;
            const fname = `Raport_${sanitize(r.mode)}_${sanitize(r.className)}_${sanitize(r.studentName)}.pdf`;
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Rekap Global Ujian
            </h1>
            <p className="text-sm text-muted-foreground">Ringkasan seluruh ujian Tahfizh & Tahsin lintas kelas</p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 rounded-lg border border-border bg-card">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mode Ujian</label>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
              <option value="all">Semua Mode</option>
              <option value="Tahfizh">Tahfizh</option>
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
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={byMode} dataKey="value" nameKey="name" outerRadius={80} label>
                      {byMode.map((d) => (
                        <Cell key={d.name} fill={MODE_COLORS[d.name] || "hsl(var(--muted))"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
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
                      <td className="py-2 px-2"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.mode}</span></td>
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
          assessorName={previewRow.assessorName}
        />
      )}
    </div>
  );
}
