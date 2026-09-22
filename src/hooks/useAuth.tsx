import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CONNECTION_PROBLEM_MESSAGE, isNetworkError } from "@/lib/network";

const SESSION_BACKUP_KEY = "scb_session_backup";

type SessionBackup = {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_at?: number;
};

const getAdminBypass = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("admin_authenticated") === "true";
};

function readSessionBackup(): SessionBackup | null {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionBackup;
    if (!parsed?.access_token || !parsed?.refresh_token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionBackup(session: Session) {
  try {
    const backup: SessionBackup = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: session.user,
      expires_at: session.expires_at,
    };
    localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function clearSessionBackup() {
  try {
    localStorage.removeItem(SESSION_BACKUP_KEY);
  } catch {
    // Ignore.
  }
}

function sessionFromBackup(backup: SessionBackup): Session {
  return {
    access_token: backup.access_token,
    refresh_token: backup.refresh_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: backup.expires_at,
    user: backup.user,
  } as Session;
}

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
  isRecovering: boolean;
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
  isRecovering: false,
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
  const [isRecovering, setIsRecovering] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const signOutIntentRef = useRef(false);
  const recoveringRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const applySession = useCallback((next: Session | null, options?: { backup?: boolean }) => {
    setSession(next);
    sessionRef.current = next;
    if (next) {
      if (options?.backup !== false) writeSessionBackup(next);
    }
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

  const restoreFromBackup = useCallback(async (): Promise<RefreshSessionResult> => {
    const backup = readSessionBackup();
    if (!backup) {
      return { session: null, networkError: false };
    }

    // Keep the UI logged in while we try to re-attach tokens to the Supabase client.
    const softSession = sessionFromBackup(backup);
    applySession(softSession, { backup: false });
    setConnectionError(CONNECTION_PROBLEM_MESSAGE);

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: backup.access_token,
        refresh_token: backup.refresh_token,
      });

      if (data.session) {
        applySession(data.session);
        setConnectionError(null);
        await checkAdminRole(data.session.user.id);
        return { session: data.session, networkError: false };
      }

      if (error && isNetworkError(error)) {
        return {
          session: softSession,
          networkError: true,
          message: CONNECTION_PROBLEM_MESSAGE,
        };
      }

      // Invalid/expired refresh token — only then force logout.
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        const authDead =
          message.includes("invalid") ||
          message.includes("expired") ||
          message.includes("refresh token");

        if (authDead && !isNetworkError(error)) {
          clearSessionBackup();
          applySession(null);
          setIsAdmin(false);
          setConnectionError(null);
          return { session: null, networkError: false, message: error.message };
        }

        return {
          session: softSession,
          networkError: true,
          message: CONNECTION_PROBLEM_MESSAGE,
        };
      }

      return {
        session: softSession,
        networkError: true,
        message: CONNECTION_PROBLEM_MESSAGE,
      };
    } catch (error) {
      return {
        session: softSession,
        networkError: true,
        message: CONNECTION_PROBLEM_MESSAGE,
      };
    }
  }, [applySession, checkAdminRole]);

  const refreshSession = useCallback(async (): Promise<RefreshSessionResult> => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        if (sessionRef.current || readSessionBackup()) {
          return restoreFromBackup();
        }
        setLoading(false);
        return { session: null, networkError: isNetworkError(error), message: error.message };
      }

      if (data.session) {
        applySession(data.session);
        setLoading(false);
        setConnectionError(null);
        await checkAdminRole(data.session.user.id);
        return { session: data.session, networkError: false };
      }

      // Supabase storage was cleared (common after failed refresh on bad networks).
      if (sessionRef.current || readSessionBackup()) {
        const restored = await restoreFromBackup();
        setLoading(false);
        return restored;
      }

      setLoading(false);
      setIsAdmin(false);
      return { session: null, networkError: false };
    } catch {
      if (sessionRef.current || readSessionBackup()) {
        const restored = await restoreFromBackup();
        setLoading(false);
        return restored;
      }
      setLoading(false);
      return {
        session: null,
        networkError: true,
        message: CONNECTION_PROBLEM_MESSAGE,
      };
    }
  }, [applySession, checkAdminRole, restoreFromBackup]);

  const recoverSession = useCallback(async () => {
    if (signOutIntentRef.current || recoveringRef.current) return;

    recoveringRef.current = true;
    setIsRecovering(true);
    setConnectionError(CONNECTION_PROBLEM_MESSAGE);
    setLoading(false);

    // Immediately keep UI session from memory/backup so Index does not redirect.
    const backup = readSessionBackup();
    if (!sessionRef.current && backup) {
      applySession(sessionFromBackup(backup), { backup: false });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      if (signOutIntentRef.current) break;

      const recovered = await restoreFromBackup();
      if (recovered.session && !recovered.networkError) {
        setConnectionError(null);
        recoveringRef.current = false;
        setIsRecovering(false);
        return;
      }

      // Keep soft session; wait and retry.
      await sleep(2000 * (attempt + 1));
    }

    recoveringRef.current = false;
    setIsRecovering(false);
    // Still keep soft session if we have one — do not auto-logout.
    if (sessionRef.current || readSessionBackup()) {
      setConnectionError(CONNECTION_PROBLEM_MESSAGE);
      return;
    }

    applySession(null);
    setIsAdmin(false);
  }, [applySession, restoreFromBackup]);

  useEffect(() => {
    const syncAdminBypass = () => {
      setAdminBypass(getAdminBypass());
    };

    window.addEventListener("storage", syncAdminBypass);
    window.addEventListener("admin-auth-changed", syncAdminBypass);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession) {
        signOutIntentRef.current = false;
        recoveringRef.current = false;
        setIsRecovering(false);
        applySession(nextSession);
        setLoading(false);
        setConnectionError(null);
        void checkAdminRole(nextSession.user.id);
        return;
      }

      if (signOutIntentRef.current) {
        clearSessionBackup();
        applySession(null);
        setIsAdmin(false);
        setLoading(false);
        setIsRecovering(false);
        recoveringRef.current = false;
        return;
      }

      // Unexpected sign-out (usually failed token refresh on flaky networks).
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        void recoverSession();
      }
    });

    void refreshSession();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", syncAdminBypass);
      window.removeEventListener("admin-auth-changed", syncAdminBypass);
    };
  }, [applySession, checkAdminRole, recoverSession, refreshSession]);

  const signOut = async () => {
    signOutIntentRef.current = true;
    recoveringRef.current = false;
    setIsRecovering(false);
    setConnectionError(null);
    clearSessionBackup();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Even if network fails, clear local app state.
    }
    window.localStorage.removeItem("admin_authenticated");
    setAdminBypass(false);
    setIsAdmin(false);
    applySession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAdmin: isAdmin || adminBypass,
        connectionError,
        isRecovering,
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
