import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  if (!loading && user) {
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
      const status = (error as any)?.status;
      if (status === "pending") toast.error("Akun Anda masih menunggu persetujuan admin");
      else if (status === "rejected") toast.error("Pendaftaran akun Anda ditolak admin");
      else if (status === "inactive") toast.error("Akun Anda dinonaktifkan. Hubungi admin");
      else toast.error("Email atau password salah");
    } else {
      toast.success("Berhasil login!");
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-background via-muted to-background">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-sm animate-fade-in relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground shadow-lg mb-4 transform hover:scale-105 hover:rotate-3 transition-all duration-300">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight text-center">
            Sistem Laporan <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
              Ujian Tahfizh
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Masuk ke sistem untuk melanjutkan</p>
        </div>

        {/* Form with Glassmorphism */}
        <form onSubmit={handleSubmit} className="bg-card/70 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 md:p-8 space-y-5 transition-all duration-300 hover:shadow-primary/5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide uppercase">Email</label>
            <input type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              className="w-full px-4 py-3 rounded-xl border border-input/50 bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
              autoComplete="email" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80 tracking-wide uppercase">Password</label>
            <div className="relative group">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-input/50 bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 pr-10"
                autoComplete="current-password" />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-200">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {submitting ? "Memproses..." : "Masuk ke Akun"}
          </button>

          <p className="text-sm text-center text-muted-foreground pt-4 border-t border-border/50">
            Belum punya akun?{" "}
            <Link to="/register" className="text-primary font-bold hover:text-primary/80 hover:underline transition-colors duration-200">
              Daftar di sini
            </Link>
          </p>
        </form>
        <Link to="/" className="mt-6 block text-center text-sm font-medium text-muted-foreground hover:text-primary hover:underline transition-colors duration-200 flex items-center justify-center gap-1">
          <span aria-hidden="true">&larr;</span> Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
