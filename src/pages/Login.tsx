import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { BookOpen, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { signIn, user, loading } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email dan password wajib diisi");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error("Email atau password salah");
    } else {
      toast.success("Berhasil login!");
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[sidebar-accent-foreground] bg-gray-500 text-primary-foreground">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-islamic text-primary-foreground mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-center">Sistem ​Laporan Ujian Tahfizh      
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Masuk ke sistem</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="email" />

          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-10"
                autoComplete="current-password" />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">

                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">

            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {submitting ? "Masuk..." : "Masuk"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Hubungi Admin untuk mendapatkan akun
          </p>
        </form>
      </div>
    </div>);

}