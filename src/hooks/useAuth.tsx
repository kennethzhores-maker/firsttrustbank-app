import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const getAdminBypass = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("admin_authenticated") === "true";
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshSession: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBypass, setAdminBypass] = useState(getAdminBypass);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setLoading(false);
    if (session?.user) {
      await checkAdminRole(session.user.id);
    } else {
      setIsAdmin(false);
    }
    return session;
  }, [checkAdminRole]);

  useEffect(() => {
    const syncAdminBypass = () => {
      setAdminBypass(getAdminBypass());
    };

    window.addEventListener("storage", syncAdminBypass);
    window.addEventListener("admin-auth-changed", syncAdminBypass);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        void checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    void refreshSession();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", syncAdminBypass);
      window.removeEventListener("admin-auth-changed", syncAdminBypass);
    };
  }, [checkAdminRole, refreshSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem("admin_authenticated");
    setAdminBypass(false);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, isAdmin: isAdmin || adminBypass, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
