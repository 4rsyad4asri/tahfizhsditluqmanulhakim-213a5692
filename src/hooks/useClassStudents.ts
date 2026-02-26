import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentRow {
  id: string;
  name: string;
  class_id: string;
  target_juz: number;
  level: string;
  progress_hafalan: number;
  status_sertifikasi: string;
  catatan_penguji: string | null;
}

export function useClassStudents(grade: number, section: string) {
  return useQuery({
    queryKey: ["class-students", grade, section],
    queryFn: async () => {
      // Get class
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("grade", grade)
        .eq("section", section)
        .single();

      if (classError) throw classError;

      // Get students
      const { data: students, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classData.id)
        .order("name");

      if (studentError) throw studentError;

      return {
        classInfo: classData,
        students: (students || []) as StudentRow[],
      };
    },
    enabled: !!grade && !!section,
  });
}
