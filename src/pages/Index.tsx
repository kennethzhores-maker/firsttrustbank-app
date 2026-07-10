import { useState, useEffect } from "react";
import { Sun, Moon, LogOut, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AccountSummary from "@/components/AccountSummary";
import VirtualCard from "@/components/VirtualCard";
import ActivationModal from "@/components/ActivationModal";
import ServiceUnavailableModal from "@/components/ServiceUnavailableModal";
import { useBankData, BankDataProvider } from "@/hooks/use-bank-data";
import { useAuth } from "@/hooks/useAuth";
import { BANK_NAME } from "@/lib/brand";
import { Loader2 } from "lucide-react";


export default function Index() {
  const { user, loading: authLoading, signOut, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") !== "light";
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    let active = true;

    const verifyAuth = async () => {
      if (authLoading) return;

      if (user) {
        setCheckingAuth(false);
        return;
      }

      const session = await refreshSession();
      if (!active) return;

      if (session?.user) {
        setCheckingAuth(false);
        return;
      }

      navigate("/login", { replace: true });
    };

    void verifyAuth();

    return () => {
      active = false;
    };
  }, [authLoading, user, navigate, refreshSession]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (authLoading || checkingAuth || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BankDataProvider>
      <DashboardView
        dark={dark}
        setDark={setDark}
        onLogout={handleLogout}
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        serviceModalOpen={serviceModalOpen}
        setServiceModalOpen={setServiceModalOpen}
      />
    </BankDataProvider>
  );
}

function DashboardView({
  dark,
  setDark,
  onLogout,
  modalOpen,
  setModalOpen,
  serviceModalOpen,
  setServiceModalOpen,
}: {
  dark: boolean;
  setDark: (value: boolean) => void;
  onLogout: () => void;
  modalOpen: boolean;
  setModalOpen: (value: boolean) => void;
  serviceModalOpen: boolean;
  setServiceModalOpen: (value: boolean) => void;
}) {
  const data = useBankData();

  const sidebarItems = [
    { label: "Deposit", icon: ArrowDownToLine },
    { label: "Fund Transfer", icon: ArrowLeftRight },
    { label: "Withdraw", icon: ArrowUpFromLine },
    { label: "Transactions", icon: Receipt },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{BANK_NAME}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                       hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r py-6 px-3 gap-1 shrink-0">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setServiceModalOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                         text-muted-foreground hover:text-foreground hover:bg-secondary/70
                         transition-all active:scale-[0.98]"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Mobile bottom bar for sidebar items */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur-lg flex justify-around py-2 px-1">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setServiceModalOpen(true)}
              className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground
                         hover:text-foreground transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 px-4 md:px-8 py-8 max-w-5xl mx-auto w-full pb-20 md:pb-8">
          <div className="space-y-8">
            {/* Welcome */}
            <div className="animate-slide-up">
              <p className="text-sm text-muted-foreground font-medium">Welcome back,</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{data.userName}</h1>
            </div>

            {/* Account summary */}
            <AccountSummary />

            {/* Card section */}
            <div className="space-y-5" style={{ animationDelay: "0.1s" }}>
              <h2 className="text-lg font-semibold animate-slide-up" style={{ animationDelay: "0.15s" }}>
                Your Card
              </h2>
              <div className="flex flex-col items-center sm:items-start gap-5 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                <VirtualCard />
                <button
                  onClick={() => setModalOpen(true)}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground
                             btn-glow hover:brightness-110 transition-all active:scale-[0.98]"
                >
                  Activate Card
                </button>
              </div>
            </div>

            {/* Transactions section */}
            <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
              <h2 className="text-lg font-semibold mb-4">Transactions</h2>
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground text-sm">No transactions yet</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ActivationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ServiceUnavailableModal open={serviceModalOpen} onClose={() => setServiceModalOpen(false)} />
    </div>
  );
}
