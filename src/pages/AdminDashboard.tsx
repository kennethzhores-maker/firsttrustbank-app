import { useState, useEffect } from "react";
import { Shield, Sun, Moon, LogOut, Plus, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase, EDGE_FUNCTION_NAME } from "@/lib/supabase";
import { Save, Check } from "lucide-react";


interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  account_number: string;
  balance: number;
  card_number: string;
  expiry_date: string;
  pin_code: string;
  role: string;
}

async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const payload = await response.json();
        if (payload?.error) {
          throw new Error(payload.error);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== error.message) {
          throw parseError;
        }
      }
    }
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export default function AdminDashboard() {
  const { signOut, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "", password: "", full_name: "", account_number: "", balance: 0,
    card_number: "", expiry_date: "", pin_code: "12345",
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin-login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("users").select("*").order("full_name");
      if (error) throw error;
      setUsers(data || []);
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase.from("users").update({
        full_name: selectedUser.full_name,
        account_number: selectedUser.account_number,
        balance: selectedUser.balance,
        card_number: selectedUser.card_number,
        expiry_date: selectedUser.expiry_date,
        pin_code: selectedUser.pin_code,
      }).eq("id", selectedUser.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetchUsers();
    } catch {
      setError("Failed to save. Please try again.");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    setDeleting(userId);
    setError("");
    try {
      const { error: dbError } = await supabase.from("users").delete().eq("id", userId);
      if (dbError) throw dbError;

      try {
        await invokeEdgeFunction(EDGE_FUNCTION_NAME, { action: "delete", userId });
      } catch {
        // Auth delete needs the updated super-worker function deployed.
        // Profile is already removed from the app.
      }

      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setDeleting(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await invokeEdgeFunction(EDGE_FUNCTION_NAME, {
        action: "create",
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        account_number: newUser.account_number,
        balance: newUser.balance,
        card_number: newUser.card_number,
        expiry_date: newUser.expiry_date,
        pin_code: newUser.pin_code,
      });

      setShowCreate(false);
      setNewUser({
        email: "", password: "", full_name: "", account_number: "", balance: 0,
        card_number: "", expiry_date: "", pin_code: "12345",
      });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/admin-login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const fields: { key: keyof UserRecord; label: string; type?: string }[] = [
    { key: "full_name", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "account_number", label: "Account Number" },
    { key: "balance", label: "Balance", type: "number" },
    { key: "card_number", label: "Card Number" },
    { key: "expiry_date", label: "Expiry Date" },
    { key: "pin_code", label: "PIN Code" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold">Admin Panel</span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-destructive/20 text-destructive text-xs font-semibold">ADMIN</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDark(!dark)} className="p-2.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-8 py-8 max-w-5xl mx-auto w-full">
        <div className="animate-slide-up mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage users and their data</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4 p-3 rounded-xl bg-destructive/10 animate-fade-scale">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* User list */}
          <div className="glass-card p-4 lg:w-72 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Users</h3>
              <button onClick={() => setShowCreate(!showCreate)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedUser({ ...u }); setShowCreate(false); }}
                      className={`flex-1 text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                        selectedUser?.id === u.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"
                      }`}
                    >
                      <p className="font-medium truncate">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </button>
                    {u.role !== "admin" && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deleting === u.id}
                        className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Delete user"
                      >
                        {deleting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit / Create panel */}
          <div className="flex-1">
            {showCreate ? (
              <div className="glass-card p-6 md:p-8 animate-slide-up max-w-lg">
                <h2 className="text-xl font-bold mb-1">Create New User</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Creates the account instantly — no email confirmation required.
                </p>
                <form onSubmit={handleCreate} className="space-y-4">
                  {[
                    { key: "email", label: "Email", type: "email" },
                    { key: "password", label: "Password", type: "password" },
                    { key: "full_name", label: "Full Name" },
                    { key: "account_number", label: "Account Number" },
                    { key: "balance", label: "Balance", type: "number" },
                    { key: "card_number", label: "Card Number" },
                    { key: "expiry_date", label: "Expiry Date" },
                    { key: "pin_code", label: "PIN Code" },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                      <input
                        type={type || "text"}
                        required
                        value={(newUser as any)[key]}
                        onChange={(e) => setNewUser({ ...newUser, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
                        className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  ))}
                  <button type="submit" disabled={creating}
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground btn-glow hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create User
                  </button>
                </form>
              </div>
            ) : selectedUser ? (
              <div className="glass-card p-6 md:p-8 animate-slide-up max-w-lg">
                <h2 className="text-xl font-bold mb-1">Edit User</h2>
                <p className="text-sm text-muted-foreground mb-6">Changes are saved to Supabase</p>
                <div className="space-y-4">
                  {fields.map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                      <input
                        type={type || "text"}
                        value={selectedUser[key]}
                        disabled={key === "email"}
                        onChange={(e) => setSelectedUser({ ...selectedUser, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
                        className="mt-1.5 w-full rounded-xl border bg-secondary/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
                <button onClick={handleSave}
                  className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground btn-glow hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? "Saved!" : "Save Changes"}
                </button>
              </div>
            ) : (
              <div className="glass-card p-8 flex items-center justify-center text-muted-foreground text-sm animate-slide-up">
                Select a user to edit or create a new one
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
