import { useMemo, useState } from "react";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, BarChart3, Award, BookOpen, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { exportJsonToExcel } from "@/utils/excel";

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
}

const MODE_COLORS: Record<string, string> = {
  "Tahfizh": "hsl(var(--primary))",
  "Tahsin Dasar": "hsl(var(--success))",
  "Tahsin Lanjutan": "hsl(var(--warning))",
};

export default function RekapGlobal() {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["rekap-global"],
    queryFn: async () => {
      const { data: ujianData, error: e1 } = await supabase
        .from("ujian")
        .select("id, student_id, mode, tanggal, nilai_akhir, status, nilai_aspek")
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

      const sMap = new Map((students || []).map((s: any) => [s.id, s]));
      const cMap = new Map((classes || []).map((c: any) => [c.id, c]));

      const rows: Row[] = (ujianData || []).map((u: any) => {
        const s = sMap.get(u.student_id) as any;
        const c = s ? cMap.get(s.class_id) as any : null;
        const aspek = u.nilai_aspek as any;
        return {
          ujianId: u.id,
          studentId: u.student_id,
          studentName: s?.name || "Unknown",
          className: c?.name || "Unknown",
          grade: c?.grade || 0,
          mode: u.mode,
          tanggal: u.tanggal,
          nilai: u.nilai_akhir,
          status: u.status,
          predikat: aspek?.predikat || "-",
        };
      });
      return rows;
    },
  });

  const filtered = useMemo(() => {
    let r = data || [];
    if (filterMode !== "all") r = r.filter((x) => x.mode === filterMode);
    if (filterGrade !== "all") r = r.filter((x) => x.grade === parseInt(filterGrade));
    return r;
  }, [data, filterMode, filterGrade]);

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
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90">
            <Download className="w-4 h-4" /> Export Excel
          </button>
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
            <div className="p-4 rounded-lg border border-border bg-card overflow-x-auto">
              <h3 className="text-sm font-semibold text-foreground mb-3">Detail Ujian ({filtered.length})</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Nama</th>
                    <th className="text-left py-2 px-2">Kelas</th>
                    <th className="text-left py-2 px-2">Mode</th>
                    <th className="text-left py-2 px-2">Tanggal</th>
                    <th className="text-center py-2 px-2">Nilai</th>
                    <th className="text-left py-2 px-2">Predikat</th>
                    <th className="text-center py-2 px-2">Status</th>
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
    </div>
  );
}
