import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ClassCard from "@/components/ClassCard";
import { useClasses } from "@/hooks/useClasses";
import { useMyAssignedClasses } from "@/hooks/useMyAssignedClasses";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, Award, TrendingUp, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const LEVEL_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

const Dashboard = () => {
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const { data: classes, isLoading, error } = useClasses();
  const { data: assignedClassIds } = useMyAssignedClasses();
  const { isPenguji } = useAuthContext();

  // Fetch student level distribution
  const { data: levelData } = useQuery({
    queryKey: ["student-level-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("level");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((s) => {
        counts[s.level] = (counts[s.level] || 0) + 1;
      });
      const total = data?.length || 1;
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / total) * 100),
      }));
    },
  });

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    let result = classes;
    // Penguji only sees assigned classes
    if (isPenguji && assignedClassIds !== null && assignedClassIds !== undefined) {
      result = result.filter(c => assignedClassIds.includes(c.id));
    }
    if (selectedGrade !== null) {
      result = result.filter(c => c.grade === selectedGrade);
    }
    return result;
  }, [classes, selectedGrade, isPenguji, assignedClassIds]);

  const statsClasses = isPenguji && assignedClassIds !== null && assignedClassIds !== undefined
    ? (classes || []).filter(c => assignedClassIds.includes(c.id))
    : classes;
  const totalStudents = statsClasses?.reduce((sum, c) => sum + c.studentCount, 0) || 0;
  const avgProgress = totalStudents > 0
    ? Math.round((statsClasses?.reduce((sum, c) => sum + c.avgProgress * c.studentCount, 0) || 0) / totalStudents)
    : 0;
  const totalLulus = statsClasses?.reduce((sum, c) => sum + c.lulusCount, 0) || 0;

  const stats = [
    { icon: Users, label: "Total Siswa", value: totalStudents, color: "text-primary" },
    { icon: BookOpen, label: "Rata-rata Hafalan", value: `${avgProgress}%`, color: "text-secondary" },
    { icon: Award, label: "Lulus Sertifikasi", value: totalLulus, color: "text-accent" },
    { icon: TrendingUp, label: "Total Kelas", value: classes?.length || 0, color: "text-info" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20 text-destructive">
          Gagal memuat data: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card rounded-lg border border-border p-4 shadow-card animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Onboarding banner for penguji with no classes */}
        {isPenguji && filteredClasses.length === 0 && !isLoading && (
          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-semibold">Selamat Datang, Penguji!</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              Akun Anda belum ditugaskan ke kelas manapun. Hubungi Admin untuk mendapatkan akses ke kelas. Setelah ditugaskan, Anda dapat melihat daftar siswa dan mulai memberikan penilaian.
            </AlertDescription>
          </Alert>
        )}

        {/* Grade Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setSelectedGrade(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedGrade === null
                ? 'gradient-islamic text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Semua Kelas
          </button>
          {[1, 2, 3, 4, 5, 6].map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedGrade === grade
                  ? 'gradient-islamic text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Kelas {grade}
            </button>
          ))}
        </div>

        {/* Level Distribution Chart */}
        {levelData && levelData.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 shadow-card mb-6">
            <h3 className="font-semibold text-foreground mb-4">📊 Distribusi Level Siswa</h3>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-1/2" style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, pct }) => `${name} (${pct}%)`}
                      labelLine={false}
                    >
                      {levelData.map((_, i) => (
                        <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [`${value} siswa`, name]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full md:w-1/2">
                {levelData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.value} siswa ({item.pct}%)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bismillah */}
        <div className="text-center mb-6">
          <p className="font-arabic text-2xl text-primary opacity-70">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
        </div>

        {/* Class Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredClasses.map((classInfo) => (
            <ClassCard key={classInfo.id} classInfo={classInfo} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
