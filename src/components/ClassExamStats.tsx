import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  classId: string;
}

export default function ClassExamStats({ classId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["class-exam-stats", classId],
    queryFn: async () => {
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId);

      if (!students || students.length === 0) return null;

      const studentIds = students.map((student) => student.id);
      const { data: ujianData, error: ujianError } = await supabase
        .from("ujian")
        .select("mode, status, nilai_akhir, student_id")
        .in("student_id", studentIds);

      if (ujianError) throw ujianError;
      if (!ujianData) return null;

      const modes = ["Tahsin Dasar", "Tahsin Lanjutan", "Tahfizh"] as const;
      const stats = modes.map((mode) => {
        const exams = ujianData.filter((exam) => exam.mode === mode);
        const lulus = exams.filter((exam) => exam.status === "Lulus").length;
        const validScores = exams
          .map((exam) => Number(exam.nilai_akhir))
          .filter((score) => Number.isFinite(score));
        const avgNilai = exams.length > 0
          ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / Math.max(validScores.length, 1))
          : 0;

        return {
          mode,
          total: exams.length,
          lulus,
          avgNilai,
        };
      });

      return {
        stats,
        totalStudents: students.length,
        testedStudents: new Set(ujianData.map((exam) => exam.student_id)).size,
      };
    },
    enabled: !!classId,
  });

  if (isLoading || !data) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 shadow-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold text-foreground">
          Statistik Ujian: {data.testedStudents}/{data.totalStudents} siswa sudah ujian
        </span>
        {data.stats.map((stat) => (
          <span key={stat.mode} className="text-muted-foreground">
            <span className="font-medium text-foreground">{stat.mode}</span>: {stat.total} ujian, {stat.lulus} lulus, rata-rata {stat.avgNilai}
          </span>
        ))}
      </div>
    </div>
  );
}
