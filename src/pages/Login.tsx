import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { BookOpen, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

export default function Login() {
  const { signIn, user, loading, isParent } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate(isParent ? "/anak-saya" : "/", { replace: true });
    }
  }, [loading, user, isParent, navigate]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Gagal masuk dengan Google. Coba lagi.");
      return;
    }
    if (result.redirected) return;
    navigate("/anak-saya", { replace: true });
  };

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
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-sm animate-fade-in relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-islamic text-primary-foreground shadow-lg mb-4 transform hover:scale-105 hover:rotate-3 transition-all duration-300">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight text-center">
            Sistem Laporan <br />
            <span className="text-black drop-shadow-sm text-xl md:text-2xl mt-2 block">
              Setoran dan Ujian Tahsin & Tahfizh
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium text-center">Masuk ke sistem untuk melanjutkan</p>
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
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl text-sm font-bold gradient-islamic text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {submitting ? "Memproses..." : "Masuk ke Akun"}
          </button>

          <div className="flex items-center gap-3 pt-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Khusus Orang Tua</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-input bg-background/70 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-accent disabled:opacity-50">
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
            )}
            {googleLoading ? "Menghubungkan..." : "Masuk dengan Google"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Setelah masuk, isi nama dan NIS/NISN anak untuk melihat laporannya.
          </p>

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
