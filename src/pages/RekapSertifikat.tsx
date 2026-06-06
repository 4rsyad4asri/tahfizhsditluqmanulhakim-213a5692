import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhExamResult,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2, Download, Filter, CheckCircle2, XCircle, Edit2, FileText, X, Eye, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportJsonToExcel } from "@/utils/excel";
import {
  downloadCertificatePDF,
  type CertificateData,
} from "@/utils/generateCertificatePDF";
import CertificatePreviewDialog from "@/components/CertificatePreviewDialog";
import {
  buildVerificationUrl,
  inferTahfizhModeForExam,
  isLegacyTahfizhCertificateCandidate,
} from "@/utils/verificationUrl";

interface RekapItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  classGrade: number;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
  status: string;
  verificationToken?: string | null;
}

interface EditModalState {
  isOpen: boolean;
  ujianId: string | null;
  studentName: string;
  currentNomorSertifikat: string;
  newNomorSertifikat: string;
}

interface LegacyMigrationCandidate {
  id: string;
  student_id: string;
  tanggal: string | null;
  assessed_by: string | null;
  verification_token?: string | null;
  nilai_aspek?: Record<string, unknown> | null;
}

const BULAN_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const generateNomorSertifikat = (tanggal: string, index: number): string => {
  const date = new Date(tanggal);
  const month = date.getMonth() + 1;
  const bulanRoman = BULAN_ROMAN[month];
  const nomorUrut = index + 134; // Mulai dari 134
  
  return `${nomorUrut}/SDITLH/STQ/2526/${bulanRoman}/2026`;
};

const isTahfizhCertificateExam = (ujian: any) => {
  if (ujian?.mode !== "Tahfizh") return false;
  const aspek = (ujian?.nilai_aspek || {}) as {
    tahfizhMode?: string;
    verificationType?: string;
  };
  const context = {
    mode: ujian?.mode,
    tahfizhMode: aspek.tahfizhMode,
    verificationType: aspek.verificationType,
    assessedBy: ujian?.assessed_by,
    tanggal: ujian?.tanggal,
  };
  return (
    aspek.tahfizhMode === "Sertifikat" ||
    aspek.verificationType === "sertifikat-tahfizh" ||
    isLegacyTahfizhCertificateCandidate(context)
  );
};

const getSyncedTahfizhCertificateResult = (
  ujian: any,
): {
  entries: TahfizhSurahAssessment[];
  nilaiAkhir: number;
  predikat: string;
  grade: string;
  status: "Lulus" | "Tidak Lulus";
} => {
  const aspek = ujian.nilai_aspek as any;
  const rawEntries = Array.isArray(aspek?.surahEntries) ? aspek.surahEntries : [];
  const entries = aggregateTahfizhAssessmentsForDisplay(rawEntries) as TahfizhSurahAssessment[];

  const result = calculateTahfizhExamResult(
    entries,
    (inferTahfizhModeForExam({
      mode: ujian?.mode,
      tahfizhMode: aspek?.tahfizhMode,
      verificationType: aspek?.verificationType,
      assessedBy: ujian?.assessed_by,
      tanggal: ujian?.tanggal,
    }) || "Reguler") as TahfizhExamMode,
    aspek?.config as TahfizhPenaltyConfig | undefined,
    aspek?.manualStopReason || "",
    false,
    aspek?.autoFailConfig,
  );

  return {
    entries,
    nilaiAkhir: result.nilaiAkhir,
    predikat: result.predikat,
    grade: result.grade,
    status: result.status,
  };
};

const RekapSertifikat = () => {
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [filterJuz, setFilterJuz] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<RekapItem | null>(null);
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    ujianId: null,
    studentName: "",
    currentNomorSertifikat: "",
    newNomorSertifikat: "",
  });
  const { role } = useAuthContext();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["rekap-sertifikat", showAll],
    queryFn: async () => {
      let query = supabase
        .from("ujian")
        .select("*")
        .eq("mode", "Tahfizh")
        .order("tanggal", { ascending: true }); // Ascending untuk mendapatkan urutan input awal

      const { data: ujianData, error: ujianError } = await query;
      if (ujianError) throw ujianError;

      const certificateUjianData = (ujianData || []).filter(isTahfizhCertificateExam);
      const studentIds = [...new Set(certificateUjianData.map((u) => u.student_id))];
      if (studentIds.length === 0) return { items: [] as RekapItem[], classes: [] as string[] };

      const { data: students } = await supabase
        .from("students")
        .select("id, name, class_id")
        .in("id", studentIds);

      const classIds = [...new Set((students || []).map((s) => s.class_id))];
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, grade")
        .in("id", classIds);

      const studentMap = new Map((students || []).map((s) => [s.id, s]));
      const classMap = new Map((classes || []).map((c) => [c.id, c]));

      // Buat array dengan nomor urut berdasarkan urutan input
      let lulusIndex = 0;
      const itemsWithSequence: Array<any> = certificateUjianData.map((u) => {
        const student = studentMap.get(u.student_id);
        const cls = student ? classMap.get(student.class_id) : null;
        const classGrade = cls?.grade || 0;
        const syncedResult = getSyncedTahfizhCertificateResult(u);
        const entries = syncedResult.entries;
        const juzList = [...new Set(entries.map((e: any) => e.juz))].sort((a: number, b: number) => a - b);
        const isLulus = syncedResult.status === "Lulus";

        const sequenceNumber = isLulus ? lulusIndex++ : -1;

        // Gunakan nomor sertifikat dari database jika sudah ada, jika tidak generate otomatis
        const nomorSertifikatFromDb = (u as any).nomor_sertifikat;
        const nomorSertifikat = isLulus 
          ? (nomorSertifikatFromDb || generateNomorSertifikat(u.tanggal, sequenceNumber))
          : "-";

        const item: RekapItem = {
          id: u.id,
          studentId: u.student_id,
          studentName: student?.name || "Unknown",
          className: cls?.name || "Unknown",
          classGrade,
          juz: juzList.length > 0 ? juzList.join(", ") : "-",
          nilaiAkhir: syncedResult.nilaiAkhir,
          predikat: syncedResult.predikat,
          tanggal: u.tanggal,
          nomorSertifikat,
          status: syncedResult.status,
          verificationToken: (u as any).verification_token ?? null,
        };
        return item;
      });

      // Reverse untuk menampilkan yang terakhir diinput di atas
      const allItems = itemsWithSequence.reverse();
      const items = showAll ? allItems : allItems.filter((item) => item.status === "Lulus");

      const uniqueClasses = [...new Set(items.map((i) => i.className))].sort();
      return { items, classes: uniqueClasses };
    },
  });

  const legacyMigrationQuery = useQuery({
    queryKey: ["legacy-tahfizh-certificate-candidates", isAdmin],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("ujian")
        .select("id, student_id, tanggal, assessed_by, verification_token, nilai_aspek, mode")
        .eq("mode", "Tahfizh")
        .order("tanggal", { ascending: true });
      if (error) throw error;

      return ((rows || []) as any[]).filter((row) =>
        isLegacyTahfizhCertificateCandidate({
          mode: row.mode,
          tahfizhMode: row?.nilai_aspek?.tahfizhMode,
          verificationType: row?.nilai_aspek?.verificationType,
          assessedBy: row.assessed_by,
          tanggal: row.tanggal,
        })
      ) as LegacyMigrationCandidate[];
    },
  });

  const migrateLegacyTahfizhMutation = useMutation({
    mutationFn: async () => {
      const rows = legacyMigrationQuery.data || [];
      if (rows.length === 0) return 0;

      for (const row of rows) {
        const currentAspek =
          row.nilai_aspek && typeof row.nilai_aspek === "object" && !Array.isArray(row.nilai_aspek)
            ? row.nilai_aspek
            : {};
        const nextAspek = {
          ...currentAspek,
          tahfizhMode: "Sertifikat",
          reportType: "summary",
          verificationType: "sertifikat-tahfizh",
        };

        const { error } = await supabase
          .from("ujian")
          .update({ nilai_aspek: nextAspek as any })
          .eq("id", row.id);
        if (error) throw error;
      }

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["rekap-ujian-global"] });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["legacy-tahfizh-certificate-candidates"] });
      toast({
        title: "Migrasi selesai",
        description:
          count > 0
            ? `${count} data Tahfizh lama berhasil diubah menjadi Sertifikat`
            : "Tidak ada data legacy yang perlu dimigrasikan",
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Migrasi gagal",
        description: "Gagal memperbarui metadata Tahfizh lama",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ ujianId, studentId, newStatus }: { ujianId: string; studentId: string; newStatus: "Lulus" | "Tidak Lulus" }) => {
      const { error: ujianError } = await supabase
        .from("ujian")
        .update({ status: newStatus })
        .eq("id", ujianId);
      if (ujianError) throw ujianError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ status_sertifikasi: newStatus })
        .eq("id", studentId);
      if (studentError) throw studentError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      toast({
        title: "Status diperbarui",
        description: `Status berhasil diubah ke "${variables.newStatus}"`,
      });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal mengubah status", variant: "destructive" });
    },
  });

  const editNomorSertifikatMutation = useMutation({
    mutationFn: async ({ ujianId, nomorSertifikat }: { ujianId: string; nomorSertifikat: string }) => {
      const { error } = await supabase
        .from("ujian")
        .update({ nomor_sertifikat: nomorSertifikat } as any)
        .eq("id", ujianId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      toast({
        title: "Berhasil",
        description: "Nomor sertifikat berhasil diperbarui",
      });
      setEditModal({
        isOpen: false,
        ujianId: null,
        studentName: "",
        currentNomorSertifikat: "",
        newNomorSertifikat: "",
      });
    },
    onError: () => {
      toast({
        title: "Gagal",
        description: "Gagal mengubah nomor sertifikat",
        variant: "destructive",
      });
    },
  });

  const openEditModal = (ujianId: string, studentName: string, currentNomorSertifikat: string) => {
    setEditModal({
      isOpen: true,
      ujianId,
      studentName,
      currentNomorSertifikat,
      newNomorSertifikat: currentNomorSertifikat,
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      ujianId: null,
      studentName: "",
      currentNomorSertifikat: "",
      newNomorSertifikat: "",
    });
  };

  const handleSaveNomorSertifikat = () => {
    if (!editModal.ujianId || !editModal.newNomorSertifikat.trim()) {
      toast({
        title: "Gagal",
        description: "Nomor sertifikat tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    if (
      editModal.newNomorSertifikat === editModal.currentNomorSertifikat
    ) {
      toast({
        title: "Tidak ada perubahan",
        description: "Nomor sertifikat sama dengan sebelumnya",
        variant: "destructive",
      });
      return;
    }

    if (
      confirm(
        `Ubah nomor sertifikat ${editModal.studentName} dari:\n"${editModal.currentNomorSertifikat}"\n\nmenjadi:\n"${editModal.newNomorSertifikat}"?`
      )
    ) {
      editNomorSertifikatMutation.mutate({
        ujianId: editModal.ujianId,
        nomorSertifikat: editModal.newNomorSertifikat,
      });
    }
  };

  const items = data?.items || [];
  const classOptions = data?.classes || [];

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterKelas !== "all" && item.className !== filterKelas) return false;
      if (filterJuz !== "all" && !item.juz.includes(filterJuz)) return false;
      return true;
    });
  }, [items, filterKelas, filterJuz]);

  const lulusItems = useMemo(() => filtered.filter((i) => i.status === "Lulus"), [filtered]);

  const chartData = useMemo(() => {
    const classCount: Record<string, number> = {};
    lulusItems.forEach((item) => {
      classCount[item.className] = (classCount[item.className] || 0) + 1;
    });
    return Object.entries(classCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lulusItems]);

  const juzOptions = useMemo(() => {
    const juzSet = new Set<string>();
    items.forEach((item) => {
      item.juz.split(", ").forEach((j) => {
        if (j !== "-") juzSet.add(j);
      });
    });
    return [...juzSet].sort((a, b) => parseInt(a) - parseInt(b));
  }, [items]);

  const handleExportExcel = () => {
    exportJsonToExcel(
      filtered.map((item, i) => ({
        No: i + 1,
        "Nama Siswa": item.studentName,
        Kelas: item.className,
        "Juz Diujikan": item.juz,
        "Nilai Akhir": item.nilaiAkhir,
        Predikat: item.predikat,
        Status: item.status,
        "Tanggal Lulus": item.tanggal,
        "Nomor Sertifikat": item.nomorSertifikat,
      })),
      "Rekap Sertifikat",
      "rekap_sertifikat_tahfizh.xlsx",
    );
  };

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(142 76% 36%)",
    "hsl(48 96% 53%)",
    "hsl(0 84% 60%)",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">📁 Rekap Siswa Bersertifikat</h2>
            <p className="text-sm text-muted-foreground">Data siswa yang lulus sertifikasi Tahfizh</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => {
                  const count = legacyMigrationQuery.data?.length || 0;
                  if (
                    !confirm(
                      count > 0
                        ? `Migrasikan ${count} data Tahfizh lama menjadi Sertifikat sekarang?`
                        : "Tidak ada data legacy yang terdeteksi. Tetap jalankan pengecekan ulang?"
                    )
                  ) {
                    return;
                  }

                  if (count === 0) {
                    legacyMigrationQuery.refetch();
                    return;
                  }

                  migrateLegacyTahfizhMutation.mutate();
                }}
                disabled={legacyMigrationQuery.isLoading || migrateLegacyTahfizhMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {legacyMigrationQuery.isLoading || migrateLegacyTahfizhMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Migrasi Tahfizh Lama
              </button>
            )}
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterJuz}
              onChange={(e) => setFilterJuz(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Juz</option>
              {juzOptions.map((j) => (
                <option key={j} value={j}>Juz {j}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-input text-primary focus:ring-ring h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">Tampilkan semua hasil ujian</span>
            </label>
          )}
        </div>

        {isAdmin && (
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Migrasi Praktis Tahfizh Lama</p>
                <p className="text-xs text-muted-foreground">
                  Kandidat legacy terdeteksi:{" "}
                  {legacyMigrationQuery.isLoading ? "memuat..." : legacyMigrationQuery.data?.length ?? 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => legacyMigrationQuery.refetch()}
                disabled={legacyMigrationQuery.isFetching}
                className="inline-flex items-center gap-2 self-start rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground hover:bg-muted disabled:opacity-50"
              >
                {legacyMigrationQuery.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Cek Ulang Kandidat
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tombol ini hanya mengubah metadata `tahfizhMode`, `reportType`, dan `verificationType`.
              Nilai, token, NIS/NISN, dan data ujian lain tidak diubah.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Chart */}
            {chartData.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6 shadow-card mb-6">
                <h3 className="font-semibold text-foreground mb-4">📊 Jumlah Siswa Lulus per Kelas</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="count" name="Siswa Lulus" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Lulus</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">{lulusItems.filter((i) => i.predikat === "Mumtaz Murtafi").length}</p>
                <p className="text-xs text-muted-foreground">A+ Mumtaz Murtafi</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">{lulusItems.filter((i) => i.predikat === "Mumtaz").length}</p>
                <p className="text-xs text-muted-foreground">A Mumtaz</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-[#0f2a55] dark:text-blue-200">{lulusItems.filter((i) => i.predikat === "Jayyid Jiddan").length}</p>
                <p className="text-xs text-muted-foreground">B+ Jayyid Jiddan</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-foreground">{lulusItems.filter((i) => i.predikat === "Jayyid").length}</p>
                <p className="text-xs text-muted-foreground">B Jayyid</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.filter((i) => i.predikat === "Maqbul").length}</p>
                <p className="text-xs text-muted-foreground">C Maqbul</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-destructive">{filtered.filter((i) => i.predikat === "Rosib").length}</p>
                <p className="text-xs text-muted-foreground">D Rosib</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border shadow-card">
              <table className="min-w-[1180px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">No</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama Siswa</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kelas</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Juz</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Nilai</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Predikat</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tanggal</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. Sertifikat</th>
                      {isAdmin && <th className="px-4 py-3 text-center font-medium text-muted-foreground">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => (
                      <tr key={item.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${item.status === "Tidak Lulus" ? "bg-destructive/5" : ""}`}>
                        <td className="px-4 py-3 text-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{item.studentName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.className}</td>
                        <td className="px-4 py-3 text-muted-foreground">Juz {item.juz}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex min-w-12 items-center justify-center rounded-full border px-2.5 py-1 text-sm font-bold ${
                            item.nilaiAkhir >= 96 ? "border-success/30 bg-success/10 text-success" :
                            item.nilaiAkhir >= 90 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                            item.nilaiAkhir >= 86 ? "border-blue-950/30 bg-blue-950/10 text-[#0f2a55] dark:border-blue-200/30 dark:bg-blue-200/10 dark:text-blue-200" :
                            item.nilaiAkhir >= 80 ? "border-foreground/30 bg-foreground/10 text-foreground" :
                            item.nilaiAkhir >= 70 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" :
                            "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}>
                            {item.nilaiAkhir}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.predikat === "Mumtaz Murtafi" ? "bg-success/10 text-success" :
                            item.predikat === "Mumtaz" ? "bg-emerald-500/10 text-emerald-700" :
                            item.predikat === "Jayyid Jiddan" ? "bg-blue-950/10 text-[#0f2a55] border border-blue-950/30 dark:bg-blue-200/10 dark:text-blue-200 dark:border-blue-200/30" :
                            item.predikat === "Jayyid" ? "bg-foreground/10 text-foreground border border-foreground/30" :
                            item.predikat === "Maqbul" ? "bg-yellow-500/10 text-yellow-700" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {item.predikat}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "Lulus" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          }`}>
                            {item.status === "Lulus" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.tanggal}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.nomorSertifikat}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {item.status === "Lulus" && (
                                <>
                                  <button
                                    onClick={() => setPreviewItem(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    title="Preview Sertifikat"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        setDownloadingId(item.id);
                                        await downloadCertificatePDF({
                                          ...item,
                                          verificationUrl: buildVerificationUrl("sertifikat-tahfizh", item.verificationToken),
                                        } as CertificateData);
                                        toast({ title: "Berhasil", description: "Sertifikat berhasil diunduh" });
                                      } catch (err) {
                                        console.error(err);
                                        toast({ title: "Gagal", description: "Gagal membuat PDF", variant: "destructive" });
                                      } finally {
                                        setDownloadingId(null);
                                      }
                                    }}
                                    disabled={downloadingId === item.id}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                                    title="Download Sertifikat PDF"
                                  >
                                    {downloadingId === item.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Download className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      openEditModal(
                                        item.id,
                                        item.studentName,
                                        item.nomorSertifikat
                                      )
                                    }
                                    disabled={editNomorSertifikatMutation.isPending}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                                    title="Edit Nomor Sertifikat"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  const newStatus = item.status === "Lulus" ? "Tidak Lulus" : "Lulus";
                                  if (confirm(`Ubah status ${item.studentName} menjadi "${newStatus}"?`)) {
                                    toggleStatusMutation.mutate({
                                      ujianId: item.id,
                                      studentId: item.studentId,
                                      newStatus,
                                    });
                                  }
                                }}
                                disabled={toggleStatusMutation.isPending}
                                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                                  item.status === "Lulus"
                                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                    : "bg-success/10 text-success hover:bg-success/20"
                                }`}
                              >
                                <Edit2 className="w-3 h-3" />
                                {item.status === "Lulus" ? "Batalkan" : "Luluskan"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} className="px-4 py-12 text-center text-muted-foreground">
                          {showAll ? "Belum ada hasil ujian Tahfizh" : "Belum ada siswa yang lulus sertifikasi Tahfizh"}
                        </td>
                      </tr>
                    )}
                  </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <CertificatePreviewDialog
        open={!!previewItem}
        onOpenChange={(o) => { if (!o) setPreviewItem(null); }}
        data={
          previewItem
            ? {
                studentName: previewItem.studentName,
                className: previewItem.className,
                juz: previewItem.juz,
                nilaiAkhir: previewItem.nilaiAkhir,
                predikat: previewItem.predikat,
                tanggal: previewItem.tanggal,
                nomorSertifikat: previewItem.nomorSertifikat,
                verificationToken: previewItem.verificationToken,
                verificationUrl: buildVerificationUrl("sertifikat-tahfizh", previewItem.verificationToken),
              }
            : null
        }
      />

      {/* Modal Edit Nomor Sertifikat */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Edit Nomor Sertifikat</h3>
              <button
                onClick={closeEditModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nama Siswa
                </label>
                <p className="text-foreground font-medium">{editModal.studentName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nomor Sertifikat Saat Ini
                </label>
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="font-mono text-sm text-foreground">
                    {editModal.currentNomorSertifikat}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nomor Sertifikat Baru
                </label>
                <input
                  type="text"
                  value={editModal.newNomorSertifikat}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      newNomorSertifikat: e.target.value,
                    })
                  }
                  placeholder="Masukkan nomor sertifikat baru"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveNomorSertifikat}
                  disabled={editNomorSertifikatMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editNomorSertifikatMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RekapSertifikat;
