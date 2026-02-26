import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClassWithStats {
  id: string;
  name: string;
  grade: number;
  section: string;
  studentCount: number;
  avgProgress: number;
  lulusCount: number;
}

export function useClasses() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async (): Promise<ClassWithStats[]> => {
      const { data: classes, error: classError } = await supabase
        .from("classes")
        .select("*")
        .order("grade")
        .order("section");

      if (classError) throw classError;

      const { data: students, error: studentError } = await supabase
        .from("students")
        .select("class_id, progress_hafalan, status_sertifikasi");

      if (studentError) throw studentError;

      return (classes || []).map((c) => {
        const classStudents = (students || []).filter((s) => s.class_id === c.id);
        const count = classStudents.length;
        const avgProgress = count > 0
          ? Math.round(classStudents.reduce((sum, s) => sum + s.progress_hafalan, 0) / count)
          : 0;
        const lulusCount = classStudents.filter((s) => s.status_sertifikasi === "Lulus").length;

        return {
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          studentCount: count,
          avgProgress,
          lulusCount,
        };
      });
    },
  });
}
