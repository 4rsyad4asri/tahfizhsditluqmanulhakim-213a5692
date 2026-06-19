import { useEffect, useState, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
const Index = lazy(() => import("./pages/Index"));
const ClassStudents = lazy(() => import("./pages/ClassStudents"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const ManageStudents = lazy(() => import("./pages/ManageStudents"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const RekapSertifikat = lazy(() => import("./pages/RekapSertifikat"));
const RekapGlobal = lazy(() => import("./pages/RekapGlobal"));
const SearchStudents = lazy(() => import("./pages/SearchStudents"));
const AcademicYears = lazy(() => import("./pages/AcademicYears"));
const MassClassPromotion = lazy(() => import("./pages/MassClassPromotion"));

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Profile = lazy(() => import("./pages/Profile"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const ProfilPenguji = lazy(() => import("./pages/ProfilPenguji"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TahfizhVerification = lazy(() => import("./pages/TahfizhVerification"));
const VerificationCenter = lazy(() => import("./pages/VerificationCenter"));

const queryClient = new QueryClient();

function ScrollControls() {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setCanScrollUp(window.scrollY > 120);
      setCanScrollDown(window.scrollY < maxScroll - 120);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const scrollTo = (top: number) => {
    window.scrollTo({ top, behavior: "smooth" });
  };

  if (!canScrollUp && !canScrollDown) return null;

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => scrollTo(0)}
        disabled={!canScrollUp}
        className="rounded-full border border-border bg-card p-3 text-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        title="Scroll ke atas"
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollTo(document.documentElement.scrollHeight)}
        disabled={!canScrollDown}
        className="rounded-full border border-border bg-card p-3 text-foreground shadow-lg transition-all hover:translate-y-0.5 hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        title="Scroll ke bawah"
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-muted-foreground">Memuat halaman...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/kelas/:classId" element={<ClassStudents />} />
            <Route path="/siswa/:studentId" element={<StudentDetail />} />
            <Route path="/tahun-ajaran" element={<ProtectedRoute requiredRole="admin"><AcademicYears /></ProtectedRoute>} />
            <Route path="/naik-kelas-massal" element={<ProtectedRoute requiredRole="admin"><MassClassPromotion /></ProtectedRoute>} />
            <Route path="/kelola-siswa" element={<ProtectedRoute requiredRole="admin"><ManageStudents /></ProtectedRoute>} />
            <Route path="/kelola-user" element={<ProtectedRoute requiredRole="admin"><ManageUsers /></ProtectedRoute>} />
            <Route path="/rekap-sertifikat" element={<ProtectedRoute><RekapSertifikat /></ProtectedRoute>} />
            <Route path="/rekap-global" element={<RekapGlobal />} />
            <Route path="/cari-siswa" element={<SearchStudents />} />
            <Route path="/ganti-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profil" element={<ProtectedRoute><ProfilPenguji /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-muted-foreground">Memuat verifikasi...</div>}>
          <Routes>
            <Route path="/verifikasi/:type/:token" element={<VerificationCenter />} />
            <Route path="/verifikasi/tahfizh/:token" element={<TahfizhVerification />} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </Suspense>
        <ScrollControls />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
