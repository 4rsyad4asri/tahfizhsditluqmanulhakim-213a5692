import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "penguji" | "guru" | "parent";
type AccountStatus = "pending" | "approved" | "rejected" | "inactive";

export interface UserProfile {
  full_name: string;
  username?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  signature_url?: string | null;
  display_name_rapor?: string | null;
  display_name_certificate?: string | null;
  title?: string | null;
  jabatan?: string | null;
  nip?: string | null;
  status?: AccountStatus | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: UserProfile | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    profile: null,
    loading: true,
  });

  const fetchRoleAndProfile = useCallback(async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    return {
      role: (roleRes.data?.role as AppRole) ?? null,
      profile: (profileRes.data as UserProfile | null) ?? null,
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const { role, profile } = await fetchRoleAndProfile(session.user.id);
          if (mounted) {
            setState({ user: session.user, session, role, profile, loading: false });
          }
        } else {
          if (mounted) {
            setState({ user: null, session: null, role: null, profile: null, loading: false });
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoleAndProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    // Check approval status
    if (data.user) {
      const { data: prof } = await supabase
        .from("profiles").select("status").eq("id", data.user.id).maybeSingle();
      const status = (prof as any)?.status as AccountStatus | undefined;
      if (status && status !== "approved") {
        await supabase.auth.signOut();
        return { error: { message: status, status } as any };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = state.role === "admin";
  const isPenguji = state.role === "penguji";
  const isGuru = state.role === "guru";
  const isParent = state.role === "parent";

  return { ...state, signIn, signOut, isAdmin, isPenguji, isGuru, isParent };
}
