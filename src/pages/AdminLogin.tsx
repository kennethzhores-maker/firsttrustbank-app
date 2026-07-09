import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login failed");

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profile?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Access denied. This account is not an admin.");
      }

      localStorage.setItem("admin_authenticated", "true");
      window.dispatchEvent(new Event("admin-auth-changed"));
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="glass-card-elevated w-full max-w-md p-6 md:p-8 animate-fade-scale">
        <div className="flex items-center justify-center mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <span className="ml-2 px-2 py-0.5 rounded-md bg-destructive/20 text-destructive text-xs font-semibold">ADMIN</span>
        </div>

        <h2 className="text-xl font-bold mb-1">Admin Login</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Sign in with the admin account you created in Supabase.
        </p>

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
              placeholder="your-email@example.com"
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
            Admin Login
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to User Login
          </Link>
        </div>
      </div>
    </div>
  );
}
