import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** "staff" = semua peran kecuali orang tua */
  requiredRole?: "admin" | "penguji" | "guru" | "parent" | "staff";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === "parent" && (requiredRole === "staff" || requiredRole === "admin")) {
    return <Navigate to="/anak-saya" replace />;
  }

  if (requiredRole === "admin" && role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-foreground mb-2">Akses Ditolak</h2>
          <p className="text-muted-foreground">Halaman ini hanya untuk Admin.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
