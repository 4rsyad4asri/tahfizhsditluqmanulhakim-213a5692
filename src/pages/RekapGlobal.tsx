import { useMemo, useState } from "react";
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
import { Loader2, Download, BarChart3, Award, BookOpen, Users, Eye, FileArchive } from "lucide-react";
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
  nilai: number;
  status: string;
  predikat: string;
  ujian: any;
  assessorName?: string;
}

const MODE_COLORS: Record<string, string> = {
  "Tahfizh": "hsl(var(--primary))",
  "Tahsin Dasar": "hsl(var(--success))",
  "Tahsin Lanjutan": "hsl(var(--warning))",
};

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

export default function RekapGlobal() {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [onlyLatest, setOnlyLatest] = useState<boolean>(true);
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rekap-global"],
    queryFn: async () => {
      const { data: ujianData, error: e1 } = await supabase
        .from("ujian")
        .select("id, student_id, mode, tanggal, nilai_akhir, status, nilai_aspek, grade, verification_token, document_status, assessed_by")
        .order("tanggal", { ascending: false });
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
    if (onlyLatest) {
      const seen = new Set<string>();
      const out: Row[] = [];
      for (const row of r) {
        const key = `${row.studentId}::${row.mode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
      }
      r = out;
    }
    return r;
  }, [data, filterMode, filterGrade, onlyLatest]);

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
    } catch (e: any) {
      toast.error("Gagal mengunduh raport: " + (e?.message || ""));
    } finally {
      setDownloadingId(null);
    }
  };

  const sanitize = (s: string) => s.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");

  const handleBulkDownload = async () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diunduh");
      return;
    }
    if (filtered.length > 100) {
      if (!confirm(`Anda akan mengunduh ${filtered.length} raport sekaligus. Lanjutkan?`)) return;
    }
    const { header, assets, opts } = loadRaportSettings();
    const zip = new JSZip();
    setBulkProgress({ current: 0, total: filtered.length });
    try {
      for (let i = 0; i < filtered.length; i++) {
        const r = filtered[i];
        setBulkProgress({ current: i + 1, total: filtered.length });
        try {
          const data = buildRaportData(r.ujian, r.studentName, r.className, r.assessorName);
          const eff = buildEffectiveOpts(opts, data.verificationToken);
          const doc = await generateRaportPDF(data, header, assets, eff);
          const blob = doc.output("blob") as Blob;
          const fname = `Raport_${sanitize(r.mode)}_${sanitize(r.className)}_${sanitize(r.studentName)}.pdf`;
          zip.file(fname, blob);
        } catch (e) {
          console.error("Gagal generate raport untuk", r.studentName, e);
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Raport_Global_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Berhasil mengunduh ${filtered.length} raport`);
    } catch (e: any) {
      toast.error("Gagal bulk download: " + (e?.message || ""));
    } finally {
      setBulkProgress(null);
    }
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
            <button onClick={handleBulkDownload} disabled={!!bulkProgress}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-50">
              {bulkProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" /> Download Massal (ZIP)
                </>
              )}
            </button>
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
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLatest}
                onChange={(e) => setOnlyLatest(e.target.checked)}
                className="rounded border-input"
              />
              Hanya ujian terakhir per siswa
            </label>
          </div>
        </div>

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
