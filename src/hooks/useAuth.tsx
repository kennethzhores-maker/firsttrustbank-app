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
    localStorage.setItem(
      SESSION_BACKUP_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
        expires_at: session.expires_at,
      } satisfies SessionBackup)
    );
  } catch {
    // Ignore storage failures.
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

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Request timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  acceptSession: (session: Session) => void;
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
  acceptSession: () => {},
  clearConnectionError: () => {},
});

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
  const hadSessionRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
    if (session) hadSessionRef.current = true;
  }, [session]);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const applySession = useCallback((next: Session | null, options?: { backup?: boolean }) => {
    setSession(next);
    sessionRef.current = next;
    if (next) {
      hadSessionRef.current = true;
      if (options?.backup !== false) writeSessionBackup(next);
    }
  }, []);

  const acceptSession = useCallback(
    (next: Session) => {
      signOutIntentRef.current = false;
      recoveringRef.current = false;
      setIsRecovering(false);
      setConnectionError(null);
      setLoading(false);
      applySession(next);
    },
    [applySession]
  );

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("users").select("role").eq("id", userId).maybeSingle(),
        8000
      );

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
      }
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<RefreshSessionResult> => {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession(), 8000);

      if (error) {
        setLoading(false);
        // Keep current UI session if we already had one.
        if (sessionRef.current) {
          setConnectionError(CONNECTION_PROBLEM_MESSAGE);
          return {
            session: sessionRef.current,
            networkError: true,
            message: CONNECTION_PROBLEM_MESSAGE,
          };
        }
        return { session: null, networkError: isNetworkError(error), message: error.message };
      }

      if (data.session) {
        applySession(data.session);
        setLoading(false);
        setConnectionError(null);
        void checkAdminRole(data.session.user.id);
        return { session: data.session, networkError: false };
      }

      setLoading(false);
      return { session: sessionRef.current, networkError: false };
    } catch (error) {
      setLoading(false);
      if (sessionRef.current) {
        setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        return {
          session: sessionRef.current,
          networkError: true,
          message: CONNECTION_PROBLEM_MESSAGE,
        };
      }
      return {
        session: null,
        networkError: true,
        message: error instanceof Error ? error.message : CONNECTION_PROBLEM_MESSAGE,
      };
    }
  }, [applySession, checkAdminRole]);

  const recoverSession = useCallback(async () => {
    // Only recover if we actually had a live session this visit (not a cold login page).
    if (signOutIntentRef.current || recoveringRef.current || !hadSessionRef.current) {
      return;
    }

    const backup = readSessionBackup();
    if (!backup && !sessionRef.current) return;

    recoveringRef.current = true;
    setIsRecovering(true);
    setConnectionError(CONNECTION_PROBLEM_MESSAGE);
    setLoading(false);

    if (!sessionRef.current && backup) {
      applySession(sessionFromBackup(backup), { backup: false });
    }

    if (!backup) {
      recoveringRef.current = false;
      setIsRecovering(false);
      return;
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.setSession({
          access_token: backup.access_token,
          refresh_token: backup.refresh_token,
        }),
        8000
      );

      if (data.session) {
        applySession(data.session);
        setConnectionError(null);
        void checkAdminRole(data.session.user.id);
      } else if (error && !isNetworkError(error)) {
        const message = error.message?.toLowerCase() ?? "";
        const authDead =
          message.includes("invalid") ||
          message.includes("expired") ||
          message.includes("refresh token");
        if (authDead) {
          clearSessionBackup();
          // Keep soft UI session until user logs out manually; avoid surprise kick.
          setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        }
      }
    } catch {
      // Soft session already applied — stay logged in in the UI.
      setConnectionError(CONNECTION_PROBLEM_MESSAGE);
    } finally {
      recoveringRef.current = false;
      setIsRecovering(false);
    }
  }, [applySession, checkAdminRole]);

  useEffect(() => {
    const syncAdminBypass = () => {
      setAdminBypass(getAdminBypass());
    };

    window.addEventListener("storage", syncAdminBypass);
    window.addEventListener("admin-auth-changed", syncAdminBypass);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
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
        hadSessionRef.current = false;
        applySession(null);
        setIsAdmin(false);
        setLoading(false);
        setIsRecovering(false);
        recoveringRef.current = false;
        return;
      }

      // Only recover after an unexpected sign-out of an active session.
      if (event === "SIGNED_OUT" && hadSessionRef.current) {
        // Keep UI session instantly from backup before any async work.
        const backup = readSessionBackup();
        if (backup) {
          applySession(sessionFromBackup(backup), { backup: false });
          setConnectionError(CONNECTION_PROBLEM_MESSAGE);
        }
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
    hadSessionRef.current = false;
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000);
    } catch {
      // Clear local app state anyway.
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
        acceptSession,
        clearConnectionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
