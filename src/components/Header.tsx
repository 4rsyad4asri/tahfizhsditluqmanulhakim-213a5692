import { BookOpen, Star, Moon, Settings, Shield, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, profile, signOut, isAdmin } = useAuthContext();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="gradient-islamic islamic-pattern text-primary-foreground">
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Monitoring Hafalan
              </h1>
              <p className="text-sm opacity-80">
                Sistem Tahsin & Tahfizh SD
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/kelola-siswa")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === "/kelola-siswa"
                  ? "bg-primary-foreground/20 backdrop-blur-sm"
                  : "bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-sm"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Kelola Siswa</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => navigate("/kelola-user")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/kelola-user"
                    ? "bg-primary-foreground/20 backdrop-blur-sm"
                    : "bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-sm"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Kelola User</span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline text-xs opacity-70">
                  {profile?.full_name || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-sm transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 opacity-60">
              <Star className="w-4 h-4" />
              <Moon className="w-4 h-4" />
              <Star className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
