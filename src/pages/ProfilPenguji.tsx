import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMyAssignedClasses } from "@/hooks/useMyAssignedClasses";
import { useClasses } from "@/hooks/useClasses";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpen, Users, ArrowRight, Loader2, Mail, Shield, Info } from "lucide-react";

const ProfilPenguji = () => {
  const navigate = useNavigate();
  const { user, profile, role } = useAuthContext();
  const { data: assignedClassIds, isLoading: loadingAssigned } = useMyAssignedClasses();
  const { data: allClasses, isLoading: loadingClasses } = useClasses();

  const isAdmin = role === "admin";
  const assignedClasses = isAdmin
    ? allClasses || []
    : (allClasses || []).filter((c) => assignedClassIds?.includes(c.id));

  const initials = (profile?.full_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const loading = loadingAssigned || loadingClasses;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <Avatar className="h-16 w-16 text-lg">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                {profile?.full_name || "Penguji"}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                {isAdmin ? "Admin" : "Penguji"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {isAdmin ? "Semua Kelas" : "Kelas yang Ditugaskan"}
              {!loading && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({assignedClasses.length} kelas)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : assignedClasses.length === 0 ? (
              <Alert className="border-primary/30 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm font-semibold">Belum Ada Kelas</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                  Anda belum ditugaskan ke kelas manapun. Silakan hubungi Admin agar Anda ditambahkan ke kelas yang sesuai. Setelah ditugaskan, daftar kelas akan muncul di sini dan Anda dapat mulai menilai siswa.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {assignedClasses.map((cls) => (
                  <Button
                    key={cls.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    onClick={() => navigate(`/kelas/${cls.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-medium">{cls.name}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProfilPenguji;
