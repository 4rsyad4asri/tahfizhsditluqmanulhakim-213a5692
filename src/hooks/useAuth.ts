import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "penguji";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { full_name: string } | null;
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
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    return {
      role: (roleRes.data?.role as AppRole) ?? null,
      profile: profileRes.data ?? null,
    };
  }, []);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid deadlocks with Supabase auth
          setTimeout(async () => {
            const { role, profile } = await fetchRoleAndProfile(session.user.id);
            setState({ user: session.user, session, role, profile, loading: false });
          }, 0);
        } else {
          setState({ user: null, session: null, role: null, profile: null, loading: false });
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { role, profile } = await fetchRoleAndProfile(session.user.id);
        setState({ user: session.user, session, role, profile, loading: false });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoleAndProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = state.role === "admin";
  const isPenguji = state.role === "penguji";

  return { ...state, signIn, signOut, isAdmin, isPenguji };
}
