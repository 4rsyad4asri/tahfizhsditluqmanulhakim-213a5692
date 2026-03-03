import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2, Download, Filter, CheckCircle2, XCircle, Edit2, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { generateCertificatePDF } from "@/utils/generateCertificatePDF";

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
}

const generateNomorSertifikat = (tanggal: string, index: number): string => {
  const date = new Date(tanggal);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `SDIT-TH/${year}${month}/${String(index + 1).padStart(4, "0")}`;
};

const RekapSertifikat = () => {
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [filterJuz, setFilterJuz] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
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
        .order("tanggal", { ascending: false });

      if (!showAll) {
        query = query.eq("status", "Lulus");
      }

      const { data: ujianData, error: ujianError } = await query;
      if (ujianError) throw ujianError;

      const studentIds = [...new Set((ujianData || []).map((u) => u.student_id))];
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

      // For certificate numbering, only count "Lulus" items
      let lulusIndex = 0;
      const items: RekapItem[] = (ujianData || []).map((u) => {
        const student = studentMap.get(u.student_id);
        const cls = student ? classMap.get(student.class_id) : null;
        const aspek = u.nilai_aspek as any;
        const entries = aspek?.surahEntries || [];
        const juzList = [...new Set(entries.map((e: any) => e.juz))].sort((a: number, b: number) => a - b);
        const isLulus = u.status === "Lulus";

        const item: RekapItem = {
          id: u.id,
          studentId: u.student_id,
          studentName: student?.name || "Unknown",
          className: cls?.name || "Unknown",
          classGrade: cls?.grade || 0,
          juz: juzList.length > 0 ? juzList.join(", ") : "-",
          nilaiAkhir: u.nilai_akhir,
          predikat: aspek?.predikat || (u.nilai_akhir >= 90 ? "Mumtaz" : u.nilai_akhir >= 80 ? "Jiddan Jayyid" : u.nilai_akhir >= 70 ? "Jayyid" : "Perlu Perbaikan"),
          tanggal: u.tanggal,
          nomorSertifikat: isLulus ? generateNomorSertifikat(u.tanggal, lulusIndex++) : "-",
          status: u.status,
        };
        return item;
      });

      const uniqueClasses = [...new Set(items.map((i) => i.className))].sort();
      return { items, classes: uniqueClasses };
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
    const ws = XLSX.utils.json_to_sheet(
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
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Sertifikat");
    XLSX.writeFile(wb, "rekap_sertifikat_tahfizh.xlsx");
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Lulus</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">{lulusItems.filter((i) => i.predikat === "Mumtaz").length}</p>
                <p className="text-xs text-muted-foreground">Mumtaz</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-accent">{lulusItems.filter((i) => i.predikat === "Jiddan Jayyid").length}</p>
                <p className="text-xs text-muted-foreground">Jiddan Jayyid</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-secondary">{lulusItems.filter((i) => i.predikat === "Jayyid").length}</p>
                <p className="text-xs text-muted-foreground">Jayyid</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
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
                          <span className={`font-bold ${item.nilaiAkhir >= 90 ? "text-success" : item.nilaiAkhir >= 80 ? "text-primary" : item.nilaiAkhir >= 70 ? "text-accent" : "text-destructive"}`}>
                            {item.nilaiAkhir}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.predikat === "Mumtaz" ? "bg-success/10 text-success" :
                            item.predikat === "Jiddan Jayyid" ? "bg-primary/10 text-primary" :
                            item.predikat === "Jayyid" ? "bg-accent/10 text-accent" :
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
                                <button
                                  onClick={() => generateCertificatePDF(item)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  title="Cetak Sertifikat"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
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
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default RekapSertifikat;
