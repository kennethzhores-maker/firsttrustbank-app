import { useState } from "react";
import { Save, Check } from "lucide-react";
import { getBankData, setBankData, BankData } from "@/lib/store";

export default function AdminPanel() {
  const [data, setData] = useState<BankData>(getBankData);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof BankData, value: string | number) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    setBankData(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields: { key: keyof BankData; label: string; type?: string }[] = [
    { key: "userName", label: "User Name" },
    { key: "accountNumber", label: "Account Number" },
    { key: "balance", label: "Account Balance", type: "number" },
    { key: "cardholderName", label: "Cardholder Name" },
    { key: "cardNumber", label: "Card Number" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "adminPin", label: "Activation PIN" },
  ];

  return (
    <div className="glass-card p-6 md:p-8 animate-slide-up max-w-lg w-full">
      <h2 className="text-xl font-bold mb-1">Admin Control Panel</h2>
      <p className="text-sm text-muted-foreground mb-6">Edit dashboard data (stored in localStorage)</p>

      <div className="space-y-4">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
            <input
              type={type || "text"}
              value={data[key]}
              onChange={(e) =>
                update(key, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
              }
              className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
        ))}
      </div>

      <button
        onClick={save}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                   btn-glow hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
