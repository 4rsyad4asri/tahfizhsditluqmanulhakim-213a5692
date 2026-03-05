import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Penguji {
  id: string;
  name: string;
}

export function usePengujiList() {
  return useQuery({
    queryKey: ["penguji"],
    queryFn: async (): Promise<Penguji[]> => {
      const { data, error } = await supabase
        .from("penguji")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useClassPenguji(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-penguji", classId],
    queryFn: async (): Promise<Penguji[]> => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("class_penguji")
        .select("penguji_id, penguji:penguji_id(id, name)")
        .eq("class_id", classId);
      if (error) throw error;
      return (data || []).map((row: any) => row.penguji as Penguji);
    },
    enabled: !!classId,
  });
}

export function useAssignPenguji() {
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: async ({ classId, pengujiId }: { classId: string; pengujiId: string }) => {
      const { error } = await supabase
        .from("class_penguji")
        .insert({ class_id: classId, penguji_id: pengujiId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["class-penguji", vars.classId] });
    },
  });

  const unassign = useMutation({
    mutationFn: async ({ classId, pengujiId }: { classId: string; pengujiId: string }) => {
      const { error } = await supabase
        .from("class_penguji")
        .delete()
        .eq("class_id", classId)
        .eq("penguji_id", pengujiId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["class-penguji", vars.classId] });
    },
  });

  return { assign, unassign };
}
