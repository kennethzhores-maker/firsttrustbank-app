import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { CONNECTION_PROBLEM_MESSAGE, isNetworkError } from "@/lib/network";

export interface BankData {
  userName: string;
  accountNumber: string;
  balance: number;
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  adminPin: string;
  loading: boolean;
  connectionError: string | null;
  retry: () => Promise<void>;
}

type ProfileData = Omit<BankData, "loading" | "connectionError" | "retry">;

const DEFAULT_DATA: ProfileData = {
  userName: "User",
  accountNumber: "0000 0000 0000 0000",
  balance: 0,
  cardholderName: "USER",
  cardNumber: "0000 0000 0000 0000",
  expiryDate: "00/00",
  adminPin: "12345",
};

const noopRetry = async () => {};

const BankDataContext = createContext<BankData>({
  ...DEFAULT_DATA,
  loading: true,
  connectionError: null,
  retry: noopRetry,
});

function cacheKey(userId: string) {
  return `scb_bank_data_${userId}`;
}

function readCachedProfile(userId: string): ProfileData | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileData;
    if (!parsed?.userName) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: ProfileData) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(profile));
  } catch {
    // Ignore storage failures.
  }
}

function mapRowToBankData(row: Record<string, unknown>): ProfileData {
  return {
    userName: (row.full_name as string) || DEFAULT_DATA.userName,
    accountNumber: (row.account_number as string) || DEFAULT_DATA.accountNumber,
    balance: Number(row.balance) || 0,
    cardholderName: ((row.full_name as string) || DEFAULT_DATA.cardholderName).toUpperCase(),
    cardNumber: (row.card_number as string) || DEFAULT_DATA.cardNumber,
    expiryDate: (row.expiry_date as string) || DEFAULT_DATA.expiryDate,
    adminPin: (row.pin_code as string) || DEFAULT_DATA.adminPin,
  };
}

function hasRealProfile(profile: ProfileData) {
  return (
    profile.userName !== DEFAULT_DATA.userName ||
    profile.accountNumber !== DEFAULT_DATA.accountNumber ||
    profile.balance !== 0 ||
    profile.cardNumber !== DEFAULT_DATA.cardNumber
  );
}

function isAuthOrConnectivityError(error: { message?: string; code?: string; status?: number } | null) {
  if (!error) return false;
  if (isNetworkError(error)) return true;

  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toUpperCase();

  return (
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("permission") ||
    message.includes("not authenticated") ||
    message.includes("failed to fetch") ||
    code === "PGRST301" ||
    code === "42501" ||
    error.status === 401 ||
    error.status === 403
  );
}

export function BankDataProvider({ children }: { children: ReactNode }) {
  const { user, isRecovering } = useAuth();
  const [data, setData] = useState<Omit<BankData, "retry">>({
    ...DEFAULT_DATA,
    loading: true,
    connectionError: null,
  });
  const loadedUserIdRef = useRef<string | null>(null);
  const lastGoodRef = useRef<ProfileData | null>(null);

  const keepLastKnown = useCallback(
    (message: string) => {
      setData((prev) => {
        const fallback =
          (hasRealProfile(prev) ? prev : null) ||
          lastGoodRef.current ||
          (user ? readCachedProfile(user.id) : null) ||
          prev;

        return {
          ...fallback,
          loading: false,
          connectionError: message,
        };
      });
    },
    [user]
  );

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Don't clear a good profile while reconnecting.
    setData((prev) => ({
      ...prev,
      loading: !hasRealProfile(prev) && !lastGoodRef.current,
      connectionError: prev.connectionError,
    }));

    try {
      const { data: row, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        // Empty/unauthorized results after a successful load are usually flaky auth/network.
        if (isAuthOrConnectivityError(error) || loadedUserIdRef.current === user.id) {
          keepLastKnown(CONNECTION_PROBLEM_MESSAGE);
          return;
        }

        keepLastKnown(CONNECTION_PROBLEM_MESSAGE);
        return;
      }

      if (!row) {
        // RLS/auth blip often returns zero rows instead of a hard error.
        if (loadedUserIdRef.current === user.id || lastGoodRef.current || readCachedProfile(user.id)) {
          keepLastKnown(CONNECTION_PROBLEM_MESSAGE);
          return;
        }

        setData({
          ...DEFAULT_DATA,
          loading: false,
          connectionError: null,
        });
        return;
      }

      const profile = mapRowToBankData(row);
      lastGoodRef.current = profile;
      loadedUserIdRef.current = user.id;
      writeCachedProfile(user.id, profile);
      setData({
        ...profile,
        loading: false,
        connectionError: null,
      });
    } catch {
      keepLastKnown(CONNECTION_PROBLEM_MESSAGE);
    }
  }, [user, keepLastKnown]);

  useEffect(() => {
    if (!user) {
      if (!isRecovering) {
        loadedUserIdRef.current = null;
        lastGoodRef.current = null;
        setData({
          ...DEFAULT_DATA,
          loading: false,
          connectionError: null,
        });
      }
      return;
    }

    // Hydrate instantly from cache so a later network blip can't blank the UI.
    const cached = readCachedProfile(user.id);
    if (cached) {
      lastGoodRef.current = cached;
      setData({
        ...cached,
        loading: true,
        connectionError: null,
      });
    }

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      await fetchData();
      if (!active || isRecovering) return;

      try {
        channel = supabase
          .channel(`user-data-${user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "users", filter: `id=eq.${user.id}` },
            () => {
              if (!isRecovering) void fetchData();
            }
          )
          .subscribe();
      } catch {
        // Realtime is optional.
      }
    };

    void run();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [user, fetchData, isRecovering]);

  return (
    <BankDataContext.Provider value={{ ...data, retry: fetchData }}>
      {children}
    </BankDataContext.Provider>
  );
}

export function useBankData() {
  return useContext(BankDataContext);
}
