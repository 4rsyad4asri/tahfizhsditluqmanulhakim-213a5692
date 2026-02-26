import { BookOpen, Users, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ClassWithStats } from "@/hooks/useClasses";

interface ClassCardProps {
  classInfo: ClassWithStats;
}

const ClassCard = ({ classInfo }: ClassCardProps) => {
  const navigate = useNavigate();

  return (
    <div
      className="group relative bg-card rounded-lg border border-border p-5 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer animate-fade-in"
      onClick={() => navigate(`/kelas/${classInfo.grade}${classInfo.section}`)}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg gradient-islamic" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">{classInfo.name}</h3>
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
          {classInfo.section}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4 text-primary" />
          <span>{classInfo.studentCount} Siswa</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-4 h-4 text-secondary" />
              <span>Progress Hafalan</span>
            </div>
            <span className="font-semibold text-foreground">{classInfo.avgProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full gradient-islamic transition-all duration-500"
              style={{ width: `${classInfo.avgProgress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="w-4 h-4 text-accent" />
          <span>{classInfo.lulusCount} Siswa Lulus Sertifikasi</span>
        </div>
      </div>

      <button
        className="mt-4 w-full py-2.5 rounded-md text-sm font-semibold gradient-islamic text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/kelas/${classInfo.grade}${classInfo.section}`);
        }}
      >
        Masuk Kelas
      </button>
    </div>
  );
};

export default ClassCard;
