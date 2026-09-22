import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

const DEFAULT_DATA: Omit<BankData, "loading" | "connectionError" | "retry"> = {
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

function mapRowToBankData(row: Record<string, unknown> | null): Omit<BankData, "loading" | "connectionError" | "retry"> {
  if (!row) return DEFAULT_DATA;

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

export function BankDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<Omit<BankData, "retry">>({
    ...DEFAULT_DATA,
    loading: true,
    connectionError: null,
  });

  const fetchData = useCallback(async () => {
    if (!user) {
      setData({
        ...DEFAULT_DATA,
        loading: false,
        connectionError: null,
      });
      return;
    }

    setData((prev) => ({
      ...prev,
      loading: true,
      connectionError: null,
    }));

    try {
      const { data: row, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (isNetworkError(error) || error.message?.toLowerCase().includes("jwt") || error.code === "PGRST301") {
          setData((prev) => ({
            ...prev,
            loading: false,
            connectionError: CONNECTION_PROBLEM_MESSAGE,
          }));
          return;
        }

        // Profile missing is different from a connectivity failure.
        setData({
          ...DEFAULT_DATA,
          loading: false,
          connectionError: null,
        });
        return;
      }

      setData({
        ...mapRowToBankData(row),
        loading: false,
        connectionError: null,
      });
    } catch (error) {
      setData((prev) => ({
        ...prev,
        loading: false,
        connectionError: isNetworkError(error)
          ? CONNECTION_PROBLEM_MESSAGE
          : CONNECTION_PROBLEM_MESSAGE,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData({
        ...DEFAULT_DATA,
        loading: false,
        connectionError: null,
      });
      return;
    }

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      await fetchData();
      if (!active) return;

      try {
        channel = supabase
          .channel(`user-data-${user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "users", filter: `id=eq.${user.id}` },
            () => {
              void fetchData();
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              // Realtime can fail on restricted networks without blocking the dashboard.
              setData((prev) =>
                prev.connectionError
                  ? prev
                  : {
                      ...prev,
                      connectionError:
                        "Live updates unavailable on this network. Account data may be delayed — tap Retry if details look wrong.",
                    }
              );
            }
          });
      } catch {
        // Ignore realtime setup failures; REST fetch is enough for the dashboard.
      }
    };

    void run();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [user, fetchData]);

  return (
    <BankDataContext.Provider value={{ ...data, retry: fetchData }}>
      {children}
    </BankDataContext.Provider>
  );
}

export function useBankData() {
  return useContext(BankDataContext);
}
