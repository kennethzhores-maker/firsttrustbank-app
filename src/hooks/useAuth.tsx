import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CONNECTION_PROBLEM_MESSAGE, isNetworkError } from "@/lib/network";

const getAdminBypass = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("admin_authenticated") === "true";
};

export type RefreshSessionResult = {
  session: Session | null;
  networkError: boolean;
  message?: string;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  connectionError: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<RefreshSessionResult>;
  clearConnectionError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  connectionError: null,
  signOut: async () => {},
  refreshSession: async () => ({ session: null, networkError: false }),
  clearConnectionError: () => {},
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBypass, setAdminBypass] = useState(getAdminBypass);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const signOutIntentRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        if (isNetworkError(error)) {
          setConnectionError(CONNECTION_PROBLEM_MESSAGE);
          return;
        }
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === "admin");
    } catch (error) {
      if (isNetworkError(error)) {
        setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        return;
      }
      setIsAdmin(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<RefreshSessionResult> => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        if (isNetworkError(error) && sessionRef.current) {
          setConnectionError(CONNECTION_PROBLEM_MESSAGE);
          setLoading(false);
          return {
            session: sessionRef.current,
            networkError: true,
            message: CONNECTION_PROBLEM_MESSAGE,
          };
        }

        setLoading(false);
        return { session: null, networkError: isNetworkError(error), message: error.message };
      }

      const nextSession = data.session;
      setSession(nextSession);
      setLoading(false);

      if (nextSession?.user) {
        setConnectionError(null);
        await checkAdminRole(nextSession.user.id);
      } else {
        setIsAdmin(false);
      }

      return { session: nextSession, networkError: false };
    } catch (error) {
      if (sessionRef.current) {
        setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        setLoading(false);
        return {
          session: sessionRef.current,
          networkError: true,
          message: CONNECTION_PROBLEM_MESSAGE,
        };
      }

      setLoading(false);
      return {
        session: null,
        networkError: isNetworkError(error),
        message: error instanceof Error ? error.message : CONNECTION_PROBLEM_MESSAGE,
      };
    }
  }, [checkAdminRole]);

  useEffect(() => {
    const syncAdminBypass = () => {
      setAdminBypass(getAdminBypass());
    };

    window.addEventListener("storage", syncAdminBypass);
    window.addEventListener("admin-auth-changed", syncAdminBypass);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (nextSession) {
        signOutIntentRef.current = false;
        setSession(nextSession);
        setLoading(false);
        setConnectionError(null);
        void checkAdminRole(nextSession.user.id);
        return;
      }

      // Keep the current session on flaky token refresh instead of instant logout.
      if (
        !signOutIntentRef.current &&
        sessionRef.current &&
        (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED")
      ) {
        setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        setLoading(false);

        for (let attempt = 0; attempt < 3; attempt++) {
          await sleep(1500 * (attempt + 1));
          if (signOutIntentRef.current) return;

          const recovered = await refreshSession();
          if (recovered.session) {
            setConnectionError(null);
            return;
          }
          // Definite auth failure (not network) — clear session.
          if (!recovered.networkError) {
            setSession(null);
            setIsAdmin(false);
            setConnectionError(null);
            return;
          }
        }

        // Keep the existing session on repeated network failures; show the banner instead of logging out.
        setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        return;
      }

      if (signOutIntentRef.current) {
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
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
    signOutIntentRef.current = true;
    setConnectionError(null);
    await supabase.auth.signOut();
    window.localStorage.removeItem("admin_authenticated");
    setAdminBypass(false);
    setIsAdmin(false);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAdmin: isAdmin || adminBypass,
        connectionError,
        signOut,
        refreshSession,
        clearConnectionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
