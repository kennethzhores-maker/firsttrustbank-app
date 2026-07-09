import { useState } from "react";
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import { useBankData } from "@/hooks/use-bank-data";

export default function AccountSummary() {
  const data = useBankData();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyAccount = () => {
    navigator.clipboard.writeText(data.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card-elevated p-6 md:p-8 animate-slide-up">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-muted-foreground font-medium">Total Balance</p>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
        {showBalance
          ? `$${(Number(data.balance) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : "••••••••"}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
        <div className="flex-1">
          <p className="text-muted-foreground text-xs mb-0.5">Account</p>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{data.accountNumber}</span>
            <button
              onClick={copyAccount}
              className="p-1 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          Last updated just now
        </div>
      </div>
    </div>
  );
}
