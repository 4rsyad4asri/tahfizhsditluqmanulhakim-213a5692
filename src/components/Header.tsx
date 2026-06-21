import {
  ExternalLink,
  KeyRound,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { TAHSIN_URL } from "@/utils/systemLink";

type HeaderProps = {
  onMenuClick: () => void;
  collapsed: boolean;
};

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,252,251,0.88)_100%)] backdrop-blur-xl">
      <div className="flex min-h-[73px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 hover:shadow-md"
            aria-label="Buka atau tutup sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button type="button" onClick={() => navigate("/")} className="min-w-0 text-left">
            <div className="text-sm sm:text-lg font-bold leading-snug text-slate-900">Tahfizh SDIT Luqmanul Hakim</div>
            <div className="hidden text-xs text-slate-500 sm:block">by Web Developer: Miftahul Arsyad Asri, S.H</div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/cari-siswa")}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 md:inline-flex"
          >
            <Search className="h-4 w-4" />
            Cari Siswa
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = TAHSIN_URL;
            }}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 md:inline-flex"
          >
            <ExternalLink className="h-4 w-4" />
            Sistem Tahsin
          </button>

          {user ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/cari-siswa")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 md:hidden"
                title="Cari Siswa"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/profil")}
                className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 md:inline-flex"
                title="Profil Saya"
              >
                <UserCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                title="Tanda Tangan & Profil"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/ganti-password")}
                className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:inline-flex"
                title="Ganti Password"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-rose-500 transition-all duration-150 hover:border-rose-200 hover:bg-rose-50"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
