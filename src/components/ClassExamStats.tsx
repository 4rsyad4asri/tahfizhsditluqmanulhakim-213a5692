import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface Props {
  classId: string;
}

export default function ClassExamStats({ classId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["class-exam-stats", classId],
    queryFn: async () => {
      // Get students in class
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId);
      if (!students || students.length === 0) return null;

      const studentIds = students.map(s => s.id);
      const { data: ujianData } = await supabase
        .from("ujian")
        .select("mode, status, nilai_akhir, student_id")
        .in("student_id", studentIds);

      if (!ujianData) return null;

      const modes = ['Tahsin Dasar', 'Tahsin Lanjutan', 'Tahfizh'] as const;
      const stats = modes.map(mode => {
        const exams = ujianData.filter(u => u.mode === mode);
        const lulus = exams.filter(u => u.status === 'Lulus').length;
        const tidakLulus = exams.filter(u => u.status === 'Tidak Lulus').length;
        const avgNilai = exams.length > 0
          ? Math.round(exams.reduce((s, u) => s + u.nilai_akhir, 0) / exams.length)
          : 0;
        const uniqueStudents = new Set(exams.map(e => e.student_id)).size;
        return { mode, total: exams.length, lulus, tidakLulus, avgNilai, uniqueStudents };
      });

      const totalStudents = students.length;
      const testedStudents = new Set(ujianData.map(u => u.student_id)).size;

      return { stats, totalStudents, testedStudents };
    },
    enabled: !!classId,
  });

  if (isLoading || !data) return null;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))"];

  const chartData = data.stats.filter(s => s.total > 0).map(s => ({
    name: s.mode.replace('Tahsin ', 'T.'),
    'Rata-rata': s.avgNilai,
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-card space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        📊 Rekap Statistik Ujian
      </h3>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-2xl font-bold text-foreground">{data.totalStudents}</p>
          <p className="text-xs text-muted-foreground">Total Siswa</p>
        </div>
        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-2xl font-bold text-primary">{data.testedStudents}</p>
          <p className="text-xs text-muted-foreground">Sudah Ujian</p>
        </div>
      </div>

      {/* Per-mode stats */}
      <div className="space-y-3">
        {data.stats.map((stat, i) => (
          <div key={stat.mode} className="p-3 rounded-md border border-border bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">{stat.mode}</p>
              <span className="text-xs text-muted-foreground">{stat.total} ujian · {stat.uniqueStudents} siswa</span>
            </div>
            {stat.total > 0 ? (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-success/10">
                  <p className="font-bold text-success">{stat.lulus}</p>
                  <p className="text-muted-foreground">Lulus</p>
                </div>
                <div className="p-2 rounded bg-destructive/10">
                  <p className="font-bold text-destructive">{stat.tidakLulus}</p>
                  <p className="text-muted-foreground">Tidak Lulus</p>
                </div>
                <div className="p-2 rounded bg-primary/10">
                  <p className="font-bold text-primary">{stat.avgNilai}</p>
                  <p className="text-muted-foreground">Rata-rata</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-1">Belum ada data ujian</p>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                formatter={(value: number) => [`${value}`, "Rata-rata Nilai"]}
              />
              <Bar dataKey="Rata-rata" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
