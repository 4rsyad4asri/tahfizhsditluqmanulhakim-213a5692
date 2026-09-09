import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export type ParentChild = {
  linkId: string;
  studentId: string;
  name: string;
  className: string;
  nis: string | null;
  nisn: string | null;
};

export function useParentChildren() {
  const { user, isParent } = useAuthContext();

  return useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: Boolean(user?.id) && isParent,
    queryFn: async (): Promise<ParentChild[]> => {
      const { data, error } = await supabase
        .from("parent_students")
        .select("id, student_id, students(id, name, nis, nisn, classes(name))")
        .eq("parent_user_id", user!.id);
      if (error) throw error;

      return (data || []).map((row: any) => ({
        linkId: row.id,
        studentId: row.student_id,
        name: row.students?.name ?? "Siswa",
        className: row.students?.classes?.name ?? "-",
        nis: row.students?.nis ?? null,
        nisn: row.students?.nisn ?? null,
      }));
    },
  });
}
