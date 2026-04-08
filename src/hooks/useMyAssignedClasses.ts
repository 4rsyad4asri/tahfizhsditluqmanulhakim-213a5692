import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Returns the list of class IDs assigned to the current penguji user.
 * For admin users, returns null (meaning "all classes").
 * For unauthenticated users, returns null (public access).
 */
export function useMyAssignedClasses() {
  const { user, role } = useAuthContext();

  return useQuery({
    queryKey: ["my-assigned-classes", user?.id, role],
    queryFn: async (): Promise<string[] | null> => {
      // Admin or not logged in = no restriction
      if (!user || role === "admin") return null;

      // Find penguji record linked to this user
      const { data: pengujiRecord } = await supabase
        .from("penguji")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!pengujiRecord) return [];

      // Get assigned class IDs
      const { data: assignments } = await supabase
        .from("class_penguji")
        .select("class_id")
        .eq("penguji_id", pengujiRecord.id);

      return (assignments || []).map((a) => a.class_id);
    },
    enabled: true,
  });
}
