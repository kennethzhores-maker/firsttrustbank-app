import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const session = await refreshSession();
      if (!session) {
        throw new Error("Login succeeded but session was not established. Please try again.");
      }

      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="glass-card-elevated w-full max-w-md p-6 md:p-8 animate-fade-scale">
        <h2 className="text-xl font-bold mb-1">Create Your Debit Card</h2>
        <p className="text-sm text-muted-foreground mb-6">Please Enter your Email and password</p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4 p-3 rounded-xl bg-destructive/10">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none
                         focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                       btn-glow hover:brightness-110 transition-all active:scale-[0.98]
                       disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
