import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import ClassStudents from "./pages/ClassStudents";
import StudentDetail from "./pages/StudentDetail";
import ManageStudents from "./pages/ManageStudents";
import ManageUsers from "./pages/ManageUsers";
import RekapSertifikat from "./pages/RekapSertifikat";
import RekapGlobal from "./pages/RekapGlobal";
import SearchStudents from "./pages/SearchStudents";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import ProfilPenguji from "./pages/ProfilPenguji";
import NotFound from "./pages/NotFound";
import TahfizhVerification from "./pages/TahfizhVerification";
import VerificationCenter from "./pages/VerificationCenter";

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/kelas/:classId" element={<ClassStudents />} />
          <Route path="/siswa/:studentId" element={<StudentDetail />} />
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
    </AuthProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/verifikasi/:type/:token" element={<VerificationCenter />} />
          <Route path="/verifikasi/tahfizh/:token" element={<TahfizhVerification />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
        <ScrollControls />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
