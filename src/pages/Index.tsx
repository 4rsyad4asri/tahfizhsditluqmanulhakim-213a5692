import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import ClassCard from "@/components/ClassCard";
import { useClasses } from "@/hooks/useClasses";
import { useMyAssignedClasses } from "@/hooks/useMyAssignedClasses";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Info,
  Layers,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSafeErrorMessage } from "@/utils/errorMessages";
// Removing static recharts import
const LevelDistributionChart = lazy(() => import("@/components/LevelDistributionChart"));

const LEVEL_COLORS = [
  "#2F7D5F",
  "#C7A44C",
  "#6F9F86",
  "#D98C6B",
  "#7FA8C9",
];

const GRADES = [1, 2, 3, 4, 5, 6];

type MonitoringMode = "class" | "grade";

type PublicDashboardSummary = {
  activeClassIds: string[];
  passedExamStudents: number;
  certifiedStudents: number;
  averageExamScore: number | null;
  completedExamStudents: number;
};

const isTahfizhCertificateExam = (row: { mode?: string | null; nilai_aspek?: unknown }) => {
  if (row.mode !== "Tahfizh") return false;
  const aspek = (row.nilai_aspek || {}) as { surahEntries?: unknown[]; tahfizhMode?: string };
  const entryCount = Array.isArray(aspek.surahEntries) ? aspek.surahEntries.length : 0;

  if (aspek.tahfizhMode === "Sertifikat") return true;
  if (!aspek.tahfizhMode) return true;

  // Data Tahfizh lama belum dipisah rapi; beberapa sertifikat lama tersimpan sebagai Reguler.
  return aspek.tahfizhMode === "Reguler" && entryCount >= 13;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [monitoringMode, setMonitoringMode] = useState<MonitoringMode>("class");
  const { data: classes, isLoading, error } = useClasses();
  const { data: assignedClassIds } = useMyAssignedClasses();
  const { user, isPenguji } = useAuthContext();

  const { data: studentLevels } = useQuery({
    queryKey: ["dashboard-student-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("class_id, level");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: publicSummary } = useQuery({
    queryKey: ["public-dashboard-summary"],
    queryFn: async (): Promise<PublicDashboardSummary> => {
      const fallback: PublicDashboardSummary = {
        activeClassIds: [],
        passedExamStudents: 0,
        certifiedStudents: 0,
        averageExamScore: null,
        completedExamStudents: 0,
      };

      const [assignmentsResult, ujianResult] = await Promise.all([
        supabase.from("class_penguji").select("class_id"),
        supabase.from("ujian").select("student_id, mode, status, nilai_akhir, nilai_aspek"),
      ]);

      const activeClassIds = assignmentsResult.error
        ? []
        : [...new Set((assignmentsResult.data || []).map((row) => row.class_id).filter(Boolean))];

      if (ujianResult.error) {
        return { ...fallback, activeClassIds };
      }

      const ujianRows = ujianResult.data || [];
      const certificateRows = ujianRows.filter(isTahfizhCertificateExam);
      const regularExamRows = ujianRows.filter((row) => row.mode === "Tahfizh" && !isTahfizhCertificateExam(row));
      const passedExamStudents = new Set(
        regularExamRows
          .filter((row) => row.status === "Lulus")
          .map((row) => row.student_id)
          .filter(Boolean)
      ).size;
      const certifiedStudents = new Set(
        certificateRows
          .filter((row) => row.status === "Lulus")
          .map((row) => row.student_id)
          .filter(Boolean)
      ).size;
      const completedExamStudents = new Set(
        ujianRows
          .map((row) => row.student_id)
          .filter(Boolean)
      ).size;
      const scoredRows = ujianRows
        .map((row) => Number(row.nilai_akhir))
        .filter((score) => Number.isFinite(score) && score > 0);

      return {
        activeClassIds,
        passedExamStudents,
        certifiedStudents,
        completedExamStudents,
        averageExamScore: scoredRows.length
          ? Math.round(scoredRows.reduce((sum, score) => sum + score, 0) / scoredRows.length)
          : null,
      };
    },
  });

  const accessibleClasses = useMemo(() => {
    if (!classes) return [];
    if (isPenguji && assignedClassIds !== null && assignedClassIds !== undefined) {
      return classes.filter((classInfo) => assignedClassIds.includes(classInfo.id));
    }
    return classes;
  }, [classes, isPenguji, assignedClassIds]);

  const filteredClasses = useMemo(() => {
    if (selectedGrade === null) return accessibleClasses;
    return accessibleClasses.filter((classInfo) => classInfo.grade === selectedGrade);
  }, [accessibleClasses, selectedGrade]);

  const levelData = useMemo(() => {
    if (!studentLevels?.length || !filteredClasses.length) return [];

    const visibleClassIds = new Set(filteredClasses.map((classInfo) => classInfo.id));
    const counts: Record<string, number> = {};
    let total = 0;

    studentLevels.forEach((student) => {
      if (!student.class_id || !visibleClassIds.has(student.class_id) || !student.level) return;
      counts[student.level] = (counts[student.level] || 0) + 1;
      total += 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [filteredClasses, studentLevels]);

  const publicActiveClasses = useMemo(() => {
    if (!publicSummary?.activeClassIds.length) return accessibleClasses;
    return accessibleClasses.filter((classInfo) => publicSummary.activeClassIds.includes(classInfo.id));
  }, [accessibleClasses, publicSummary?.activeClassIds]);

  const publicFilteredClasses = useMemo(() => {
    if (selectedGrade === null) return publicActiveClasses;
    return publicActiveClasses.filter((classInfo) => classInfo.grade === selectedGrade);
  }, [publicActiveClasses, selectedGrade]);

  const monitoringClasses = useMemo(() => {
    if (monitoringMode === "class" && selectedClassId !== "all") {
      return accessibleClasses.filter((classInfo) => classInfo.id === selectedClassId);
    }
    if (monitoringMode === "grade" && selectedGrade !== null) {
      return accessibleClasses.filter((classInfo) => classInfo.grade === selectedGrade);
    }
    return filteredClasses;
  }, [accessibleClasses, filteredClasses, monitoringMode, selectedClassId, selectedGrade]);

  const publicMonitoringClasses = useMemo(() => {
    if (monitoringMode === "class" && selectedClassId !== "all") {
      return publicActiveClasses.filter((classInfo) => classInfo.id === selectedClassId);
    }
    if (monitoringMode === "grade" && selectedGrade !== null) {
      return publicActiveClasses.filter((classInfo) => classInfo.grade === selectedGrade);
    }
    return publicFilteredClasses;
  }, [monitoringMode, publicActiveClasses, publicFilteredClasses, selectedClassId, selectedGrade]);

  const totalStudents = accessibleClasses.reduce((sum, classInfo) => sum + classInfo.studentCount, 0);
  const publicTotalStudents = publicActiveClasses.reduce((sum, classInfo) => sum + classInfo.studentCount, 0);
  const publicTotalClasses = publicActiveClasses.length;
  const publicAvgProgress = publicTotalStudents > 0
    ? Math.round(publicActiveClasses.reduce((sum, classInfo) => sum + classInfo.avgProgress * classInfo.studentCount, 0) / publicTotalStudents)
    : 0;
  const publicStudentsWithoutExam = Math.max(publicTotalStudents - (publicSummary?.completedExamStudents ?? 0), 0);

  const monitoringStudentCount = monitoringClasses.reduce((sum, classInfo) => sum + classInfo.studentCount, 0);
  const publicMonitoringStudentCount = publicMonitoringClasses.reduce((sum, classInfo) => sum + classInfo.studentCount, 0);

  const summaryStats = [
    { icon: Users, label: "Total Siswa", value: publicTotalStudents, tone: "bg-[#E3F2E9] text-[#1F5F49]" },
    { icon: Layers, label: "Kelas Aktif", value: publicTotalClasses, hint: "Berdasarkan kelas yang terhubung ke guru", tone: "bg-[#FBF7EB] text-[#8A6F26]" },
    { icon: ClipboardCheck, label: "Sudah Ujian", value: publicSummary?.completedExamStudents ?? 0, hint: "Sudah punya nilai tersimpan", tone: "bg-[#DCE9DD] text-[#1F5F49]" },
    { icon: Award, label: "Lulus Ujian Tahfizh Sertifikat", value: publicSummary?.certifiedStudents ?? 0, hint: "Masuk Rekap Sertifikat", tone: "bg-[#F6EBC6] text-[#7A6120]" },
    { icon: ClipboardCheck, label: "Lulus Ujian Tahfizh Reguler", value: publicSummary?.passedExamStudents ?? 0, hint: "Di luar ujian sertifikat", tone: "bg-white text-[#2F7D5F]" },
    { icon: Search, label: "Belum Ujian", value: publicStudentsWithoutExam, hint: "Belum ada nilai ujian tersimpan", tone: "bg-white text-[#667A70]" },
    { icon: BarChart3, label: "Rata-rata Nilai Ujian", value: publicSummary?.averageExamScore ?? "-", tone: "bg-white text-[#1F5F49]" },
  ];

  const loggedInStats = [
    { icon: Users, label: "Total Siswa", value: totalStudents, color: "text-primary", path: "/kelola-siswa" },
    { icon: ClipboardCheck, label: "Sudah Ujian", value: publicSummary?.completedExamStudents ?? 0, color: "text-secondary", path: "/rekap-global" },
    { icon: Award, label: "Lulus Sertifikasi", value: publicSummary?.certifiedStudents ?? 0, color: "text-accent", path: "/rekap-sertifikat" },
    { icon: TrendingUp, label: "Total Kelas", value: accessibleClasses.length, color: "text-info", path: "#kelas-diampu" },
  ];

  const heroActions = [
    { label: "Input Nilai Ujian", icon: ClipboardCheck, path: "/cari-siswa", variant: "primary" },
    { label: "Lihat Rekap Global", icon: BarChart3, path: "/rekap-global", variant: "soft" },
    { label: "Monitoring Statistik", icon: TrendingUp, path: "#monitoring", variant: "soft" },
    { label: "Cetak Rapor", icon: Award, path: "/rekap-sertifikat", variant: "soft" },
  ];

  const examModes = [
    {
      title: "Tahsin Dasar",
      icon: BookOpen,
      description: "Capaian EBTA + nilai akhir",
      metrics: ["EBTA tertinggi", "Rata-rata nilai", "Perlu pendampingan"],
      empty: "Data ujian Tahsin Dasar akan muncul setelah nilai tersimpan.",
    },
    {
      title: "Tahsin Lanjutan",
      icon: GraduationCap,
      description: "Nilai akhir + status",
      metrics: ["Status terbaik", "Rata-rata nilai", "Perlu pendampingan"],
      empty: "Data ujian Tahsin Lanjutan akan muncul setelah nilai tersimpan.",
    },
    {
      title: "Tahfizh",
      icon: Trophy,
      description: "Juz pencapaian + nilai akhir",
      metrics: ["Juz tertinggi", "Rata-rata nilai", "Perlu pendampingan"],
      empty: "Data ujian Tahfizh akan muncul setelah nilai tersimpan.",
    },
  ];

  const insightItems = useMemo(() => {
    if (publicTotalStudents === 0) {
      return ["Insight akan muncul setelah data ujian tersedia."];
    }

    const items = [`Terdapat ${publicTotalStudents} siswa dalam ${publicTotalClasses} kelas aktif yang terhubung ke data guru.`];
    items.push(
      (publicSummary?.completedExamStudents ?? 0) > 0
        ? `${publicSummary?.completedExamStudents} siswa sudah memiliki hasil ujian tersimpan dan siap dipantau lebih lanjut.`
        : "Belum ada hasil ujian yang tersimpan. Input nilai pertama akan langsung mengisi ringkasan ini."
    );
    items.push(
      (publicSummary?.certifiedStudents ?? 0) > 0
        ? `${publicSummary?.certifiedStudents} siswa sudah berstatus lulus sertifikasi Tahfizh.`
        : "Data kelulusan sertifikasi akan bertambah setelah penilaian tersimpan."
    );
    return items;
  }, [publicSummary?.certifiedStudents, publicSummary?.completedExamStudents, publicTotalClasses, publicTotalStudents]);

  const handleAction = (path: string) => {
    if (path.startsWith("#")) {
      document.getElementById(path.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(path);
  };

  const getProgressTone = (progress: number) => {
    if (progress >= 85) return "border-[#9ED4B4] bg-[#E3F2E9] text-[#1F5F49]";
    if (progress >= 70) return "border-[#E6D28F] bg-[#FBF7EB] text-[#765D18]";
    return "border-[#E9B5A8] bg-[#FFF1ED] text-[#8A3A29]";
  };

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-student-levels-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-student-levels"] });
          queryClient.invalidateQueries({ queryKey: ["classes"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAF5]">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2F7D5F]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAF5]">
        <div className="flex items-center justify-center px-4 py-20 text-destructive">
          Gagal memuat data: {getSafeErrorMessage(error)}
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-5 sm:py-8">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:gap-4 md:grid-cols-4">
            {loggedInStats.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => handleAction(stat.path)}
                className="animate-fade-in rounded-xl border border-border bg-card p-3 text-left shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg sm:p-4"
              >
                <div className="flex min-h-16 items-center gap-3 sm:min-h-[72px]">
                  <div className={`rounded-xl bg-muted p-2 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-foreground sm:text-2xl">{stat.value}</p>
                    <p className="text-xs leading-5 text-muted-foreground sm:text-sm">{stat.label}</p>
                  </div>
                </div>
              </button>
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
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedGrade(null)}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                selectedGrade === null
                  ? "gradient-islamic text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Semua Kelas
            </button>
            {GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  selectedGrade === grade
                    ? "gradient-islamic text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Kelas {grade}
              </button>
            ))}
          </div>

          {/* Level Distribution Chart */}
          {levelData && levelData.length > 0 && (
            <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-card sm:p-6">
              <h3 className="mb-4 font-semibold text-foreground">Distribusi Level Siswa</h3>
              <div className="flex flex-col items-center gap-6 md:flex-row">
                <div className="w-full md:w-1/2" style={{ height: 250 }}>
                  <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                    <LevelDistributionChart levelData={levelData} levelColors={LEVEL_COLORS} />
                  </Suspense>
                </div>
                <div className="grid w-full grid-cols-1 gap-3 md:w-1/2">
                  {levelData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
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
          <div className="mb-6 text-center">
            <p className="font-arabic text-2xl text-primary opacity-70">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          </div>

          {/* Class Cards Grid */}
          <div id="kelas-diampu" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredClasses.map((classInfo) => (
              <ClassCard key={classInfo.id} classInfo={classInfo} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-[#F8FAF5] text-[#18332A]">
      <main className="mx-auto flex w-[100vw] max-w-[100vw] flex-col gap-6 overflow-x-hidden px-4 py-4 sm:gap-8 sm:px-6 sm:py-6 lg:max-w-7xl lg:px-8">
        <section className="w-[calc(100vw-2rem)] max-w-full overflow-hidden rounded-3xl border border-[#DCE9DD] bg-[#FBF7EB] shadow-[0_20px_70px_rgba(31,95,73,0.12)] lg:w-full">
          <div className="grid min-w-0 gap-5 p-5 sm:gap-6 sm:p-6 md:grid-cols-[1.3fr_0.7fr] md:gap-8 md:p-10">
            <div className="flex min-w-0 flex-col justify-center">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#C7A44C]/40 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#1F5F49] sm:mb-5">
                <Sparkles className="h-3.5 w-3.5 text-[#C7A44C]" />
                Rekap Global & Monitoring Ujian
              </div>

              <h1 className="max-w-4xl break-words text-2xl font-bold leading-tight text-[#18332A] sm:text-3xl md:text-5xl">
                Sistem digital untuk memantau nilai ujian Al-Qur'an seluruh kelas.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#667A70] sm:mt-5 sm:text-base md:text-lg">
                Pantau hasil ujian Tahsin Dasar, Tahsin Lanjutan, dan Tahfizh dalam satu dashboard: dari capaian EBTA, nilai akhir, juz pencapaian, status kelulusan, sampai ranking siswa.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-7 sm:flex sm:flex-wrap">
                {heroActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleAction(action.path)}
                    className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:min-h-11 sm:w-auto sm:py-2.5 ${
                      action.variant === "primary"
                        ? "bg-[#2F7D5F] text-white shadow-lg shadow-[#2F7D5F]/20 hover:bg-[#1F5F49]"
                        : "border border-[#DCE9DD] bg-white text-[#1F5F49] hover:border-[#2F7D5F]/40 hover:bg-[#E3F2E9]"
                    }`}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(24,51,42,0.08)] sm:p-5">
              <div className="flex items-center justify-between border-b border-[#DCE9DD] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667A70]">Command Center</p>
                  <p className="mt-1 text-lg font-bold text-[#18332A]">Ujian Al-Qur'an</p>
                </div>
                <div className="rounded-2xl bg-[#E3F2E9] p-3 text-[#2F7D5F]">
                  <BarChart3 className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#E3F2E9] p-4">
                    <p className="text-2xl font-bold text-[#1F5F49]">{publicSummary?.completedExamStudents ?? 0}</p>
                    <p className="text-xs text-[#667A70]">Sudah ujian</p>
                  </div>
                  <div className="rounded-2xl bg-[#FBF7EB] p-4">
                    <p className="text-2xl font-bold text-[#8A6F26]">{publicStudentsWithoutExam}</p>
                    <p className="text-xs text-[#667A70]">Belum ujian</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 sm:col-span-2">
                    <p className="text-2xl font-bold text-[#18332A]">{publicSummary?.certifiedStudents ?? 0}</p>
                    <p className="text-xs text-[#667A70]">Lulus ujian sertifikat</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Onboarding banner for penguji with no classes */}
        {isPenguji && filteredClasses.length === 0 && !isLoading && (
          <Alert className="border-[#2F7D5F]/30 bg-[#E3F2E9] text-[#18332A]">
            <Info className="h-4 w-4 text-[#2F7D5F]" />
            <AlertTitle className="text-sm font-semibold">Selamat Datang, Penguji!</AlertTitle>
            <AlertDescription className="text-sm text-[#667A70]">
              Akun Anda belum ditugaskan ke kelas manapun. Hubungi Admin untuk mendapatkan akses ke kelas. Setelah ditugaskan, Anda dapat melihat daftar siswa dan mulai memberikan penilaian.
            </AlertDescription>
          </Alert>
        )}

        <section className="w-[calc(100vw-2rem)] max-w-full lg:w-full">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2F7D5F]">Ringkasan Ujian</p>
              <h2 className="text-xl font-bold text-[#18332A] sm:text-2xl">Statistik utama sekolah</h2>
            </div>
            <p className="max-w-xl text-sm text-[#667A70]">
              Angka ujian khusus akan tetap kosong sampai data ujian tersimpan dan siap direkap.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[#DCE9DD] bg-white p-3 shadow-sm sm:p-4">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl sm:mb-4 sm:h-11 sm:w-11 ${stat.tone}`}>
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <p className="text-xl font-bold text-[#18332A] sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#667A70] sm:text-sm">{stat.label}</p>
                {stat.hint && <p className="mt-2 text-xs leading-5 text-[#667A70]">{stat.hint}</p>}
              </div>
            ))}
          </div>
        </section>

        <section id="monitoring" className="w-[calc(100vw-2rem)] max-w-full rounded-3xl border border-[#DCE9DD] bg-white p-4 shadow-sm sm:p-5 md:p-6 lg:w-full">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2F7D5F]">Monitoring Statistik Ujian Siswa</p>
              <h2 className="text-xl font-bold text-[#18332A] sm:text-2xl">Pantau mode ujian per kelas atau jenjang</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667A70]">
                Filter ini hanya memakai kelas yang tersedia untuk akun saat ini, termasuk pembatasan kelas untuk penguji.
              </p>
            </div>

            <div className="inline-flex w-full rounded-2xl bg-[#E3F2E9] p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setMonitoringMode("class")}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all sm:flex-none ${
                  monitoringMode === "class" ? "bg-white text-[#1F5F49] shadow-sm" : "text-[#667A70]"
                }`}
              >
                Per Kelas
              </button>
              <button
                type="button"
                onClick={() => setMonitoringMode("grade")}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all sm:flex-none ${
                  monitoringMode === "grade" ? "bg-white text-[#1F5F49] shadow-sm" : "text-[#667A70]"
                }`}
              >
                Per Jenjang
              </button>
            </div>
          </div>

          <div className="mt-5">
            {monitoringMode === "class" ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassId("all")}
                  className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    selectedClassId === "all" ? "bg-[#2F7D5F] text-white" : "border border-[#DCE9DD] bg-[#F8FAF5] text-[#667A70]"
                  }`}
                >
                  Semua Rombel
                </button>
                {publicActiveClasses.map((classInfo) => (
                  <button
                    key={classInfo.id}
                    type="button"
                    onClick={() => setSelectedClassId(classInfo.id)}
                    className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      selectedClassId === classInfo.id ? "bg-[#2F7D5F] text-white" : "border border-[#DCE9DD] bg-[#F8FAF5] text-[#667A70]"
                    }`}
                  >
                    {classInfo.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGrade(null)}
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    selectedGrade === null ? "bg-[#2F7D5F] text-white" : "border border-[#DCE9DD] bg-[#F8FAF5] text-[#667A70]"
                  }`}
                >
                  Semua Jenjang
                </button>
                {GRADES.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      selectedGrade === grade ? "bg-[#2F7D5F] text-white" : "border border-[#DCE9DD] bg-[#F8FAF5] text-[#667A70]"
                    }`}
                  >
                    Kelas {grade}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {examModes.map((mode) => (
              <div key={mode.title} className="rounded-2xl border border-[#DCE9DD] bg-[#F8FAF5] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#E3F2E9] p-3 text-[#2F7D5F]">
                    <mode.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#18332A]">{mode.title}</h3>
                    <p className="text-sm text-[#667A70]">{mode.description}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {mode.metrics.map((metric) => (
                    <div key={metric} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                      <span className="text-[#667A70]">{metric}</span>
                      <span className="font-semibold text-[#18332A]">-</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-xl border border-dashed border-[#C7A44C]/60 bg-[#FBF7EB] px-3 py-2 text-xs leading-5 text-[#667A70]">
                  {mode.empty}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#DCE9DD] bg-[#E3F2E9] p-4">
            <p className="text-sm font-semibold text-[#1F5F49]">
              Ringkasan filter: {publicMonitoringStudentCount} siswa dalam cakupan monitoring saat ini.
            </p>
          </div>
        </section>

        <section className="grid w-[calc(100vw-2rem)] max-w-full gap-4 lg:w-full lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-[#DCE9DD] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-[#E3F2E9] p-3 text-[#2F7D5F]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2F7D5F]">Smart Insight</p>
                <h2 className="text-2xl font-bold text-[#18332A]">Ringkasan otomatis</h2>
              </div>
            </div>
            <div className="space-y-3">
              {insightItems.map((insight) => (
                <div key={insight} className="rounded-2xl bg-[#F8FAF5] px-4 py-3 text-sm leading-6 text-[#667A70]">
                  {insight}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#DCE9DD] bg-[#1F5F49] p-5 text-white shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/12 p-3">
                <BarChart3 className="h-5 w-5 text-[#F6EBC6]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F6EBC6]">Rekap Global</p>
                <h2 className="text-2xl font-bold">Rekap Global Hasil Ujian</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/80">
              Buka halaman rekap untuk melihat rangkuman hasil ujian dan ranking siswa secara menyeluruh.
            </p>
            <button
              type="button"
              onClick={() => navigate("/rekap-global")}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1F5F49] transition-all hover:-translate-y-0.5 hover:bg-[#FBF7EB]"
            >
              <BarChart3 className="h-4 w-4" />
              Lihat Rekap Global
            </button>
          </div>
        </section>

        <section className="w-[calc(100vw-2rem)] max-w-full lg:w-full">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2F7D5F]">Peta Capaian Kelas</p>
              <h2 className="text-xl font-bold text-[#18332A] sm:text-2xl">Performa ringkas tiap rombel</h2>
            </div>
            <p className="max-w-xl text-sm text-[#667A70]">
              Warna kartu mengikuti rata-rata progress hafalan: hijau tinggi, gold sedang, merah lembut perlu pendampingan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {publicFilteredClasses.map((classInfo) => (
              <div key={classInfo.id} className={`rounded-2xl border p-4 shadow-sm ${getProgressTone(classInfo.avgProgress)}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">{classInfo.name}</h3>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">{classInfo.avgProgress}%</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs opacity-75">Siswa</p>
                    <p className="text-lg font-bold">{classInfo.studentCount}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-75">Lulus</p>
                    <p className="text-lg font-bold">{classInfo.lulusCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default Dashboard;
