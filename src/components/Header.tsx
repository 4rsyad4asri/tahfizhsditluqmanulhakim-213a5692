import { Award, BarChart3, BookOpen, ExternalLink, KeyRound, LogOut, Moon, Search, Settings, Shield, Star, UserCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { TAHSIN_URL } from "@/utils/systemLink";

const navButtonClass = (active: boolean) =>
  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
    active
      ? "bg-primary-foreground/20 backdrop-blur-sm"
      : "bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-sm"
  }`;

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, isAdmin } = useAuthContext();
  const goToTahsinSystem = () => {
    window.location.href = TAHSIN_URL;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="gradient-islamic islamic-pattern text-primary-foreground">
      <div className="container mx-auto px-4 py-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 cursor-pointer items-center gap-3" onClick={() => navigate("/")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-sm">
              <BookOpen className="h-6 w-6 bg-background text-slate-950" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`${user ? "" : "max-w-[260px] sm:max-w-none"} break-words text-sm font-bold tracking-tight text-slate-950 md:text-2xl`}>
                Sistem Laporan Ujian Tahfizh SDIT Luqmanul Hakim
              </h1>
              <p className={`${user ? "" : "max-w-[260px] sm:max-w-none"} break-words text-xs text-gray-800 opacity-80`}>Web Developer : Miftahul Arsyad Asri, S.H</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <button onClick={() => navigate("/cari-siswa")} className={navButtonClass(location.pathname === "/cari-siswa")}>
              <Search className="h-4 w-4 text-slate-950" />
              <span className="hidden text-center text-xs text-gray-950 sm:inline">Cari Siswa</span>
            </button>
            <button onClick={() => navigate("/rekap-sertifikat")} className={navButtonClass(location.pathname === "/rekap-sertifikat")}>
              <Award className="h-4 w-4 text-slate-950" />
              <span className="hidden text-center text-xs text-gray-950 sm:inline">Rekap Sertifikat</span>
            </button>
            <button onClick={() => navigate("/rekap-global")} className={navButtonClass(location.pathname === "/rekap-global")}>
              <BarChart3 className="h-4 w-4 text-slate-950" />
              <span className="hidden text-center text-xs text-gray-950 sm:inline">Rekap Global</span>
            </button>

            {isAdmin && (
              <button onClick={() => navigate("/kelola-siswa")} className={navButtonClass(location.pathname === "/kelola-siswa")}>
                <Settings className="h-4 w-4 bg-zinc-50 text-slate-950" />
                <span className="hidden bg-[#f0f5fa] text-center text-xs text-gray-950 sm:inline">Kelola Siswa</span>
              </button>
            )}

            {isAdmin && (
              <button onClick={() => navigate("/kelola-user")} className={navButtonClass(location.pathname === "/kelola-user")}>
                <Shield className="h-4 w-4 text-slate-800" />
                <span className="hidden text-center text-xs text-black sm:inline">Kelola User</span>
              </button>
            )}

            <button onClick={goToTahsinSystem} className={navButtonClass(false)}>
              <ExternalLink className="h-4 w-4 text-slate-950" />
              <span className="hidden text-center text-xs text-gray-950 sm:inline">Buka Sistem Tahsin</span>
            </button>

            {user ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="hidden max-w-[160px] truncate text-xs opacity-70 md:inline">
                  {profile?.full_name || user.email}
                </span>
                <button
                  onClick={() => navigate("/profil")}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
                  title="Profil Saya"
                >
                  <UserCircle className="h-4 w-4 text-slate-950" />
                </button>
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
                  title="Edit Profil & Tanda Tangan"
                >
                  <Settings className="h-4 w-4 text-slate-950" />
                </button>
                <button
                  onClick={() => navigate("/ganti-password")}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
                  title="Ganti Password"
                >
                  <KeyRound className="h-4 w-4 text-slate-950" />
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs font-medium text-slate-950 backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
              >
                Login
              </button>
            )}

            <div className="hidden items-center gap-2 opacity-60 md:flex">
              <Star className="h-4 w-4 text-neutral-950" />
              <Moon className="h-4 w-4 text-slate-900" />
              <Star className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
