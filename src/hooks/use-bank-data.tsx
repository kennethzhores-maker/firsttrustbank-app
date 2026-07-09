import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface BankData {
  userName: string;
  accountNumber: string;
  balance: number;
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  adminPin: string;
  loading: boolean;
}

const DEFAULT_DATA: Omit<BankData, "loading"> = {
  userName: "User",
  accountNumber: "0000 0000 0000 0000",
  balance: 0,
  cardholderName: "USER",
  cardNumber: "0000 0000 0000 0000",
  expiryDate: "00/00",
  adminPin: "12345",
};

const BankDataContext = createContext<BankData>({
  ...DEFAULT_DATA,
  loading: true,
});

function mapRowToBankData(row: Record<string, unknown> | null): Omit<BankData, "loading"> {
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
  const [data, setData] = useState<BankData>({ ...DEFAULT_DATA, loading: true });

  useEffect(() => {
    if (!user) {
      setData({ ...DEFAULT_DATA, loading: false });
      return;
    }

    let active = true;

    const fetchData = async () => {
      try {
        const { data: row, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!active) return;

        setData({
          ...mapRowToBankData(error || !row ? null : row),
          loading: false,
        });
      } catch {
        if (!active) return;
        setData({ ...DEFAULT_DATA, loading: false });
      }
    };

    void fetchData();

    const channel = supabase
      .channel(`user-data-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users", filter: `id=eq.${user.id}` },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return <BankDataContext.Provider value={data}>{children}</BankDataContext.Provider>;
}

export function useBankData() {
  return useContext(BankDataContext);
}
