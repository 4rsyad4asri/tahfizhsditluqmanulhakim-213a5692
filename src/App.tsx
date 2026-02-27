import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import ClassStudents from "./pages/ClassStudents";
import StudentDetail from "./pages/StudentDetail";
import ManageStudents from "./pages/ManageStudents";
import ManageUsers from "./pages/ManageUsers";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/kelas/:classId" element={<ProtectedRoute><ClassStudents /></ProtectedRoute>} />
            <Route path="/siswa/:studentId" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
            <Route path="/kelola-siswa" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />
            <Route path="/kelola-user" element={<ProtectedRoute requiredRole="admin"><ManageUsers /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
