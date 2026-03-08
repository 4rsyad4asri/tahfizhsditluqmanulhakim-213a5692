import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, ArrowLeft, BookOpen, Award } from "lucide-react";

interface StudentWithClass {
  id: string;
  name: string;
  level: string;
  progress_hafalan: number;
  status_sertifikasi: string;
  target_juz: number;
  class_name: string;
  grade: number;
  section: string;
}

const SearchStudents = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  const { data: students, isLoading } = useQuery({
    queryKey: ["all-students-search"],
    queryFn: async (): Promise<StudentWithClass[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, level, progress_hafalan, status_sertifikasi, target_juz, class_id")
        .order("name");
      if (error) throw error;

      const { data: classes, error: classError } = await supabase
        .from("classes")
        .select("id, name, grade, section");
      if (classError) throw classError;

      const classMap = new Map(classes?.map(c => [c.id, c]) || []);

      return (data || []).map(s => {
        const cls = classMap.get(s.class_id);
        return {
          id: s.id,
          name: s.name,
          level: s.level,
          progress_hafalan: s.progress_hafalan,
          status_sertifikasi: s.status_sertifikasi,
          target_juz: s.target_juz,
          class_name: cls?.name || "-",
          grade: cls?.grade || 0,
          section: cls?.section || "",
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const matchName = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLevel = filterLevel === "all" || s.level === filterLevel;
      const matchGrade = filterGrade === "all" || s.grade === Number(filterGrade);
      return matchName && matchLevel && matchGrade;
    });
  }, [students, searchQuery, filterLevel, filterGrade]);

  const statusColor = (status: string) => {
    if (status === "Lulus") return "bg-green-100 text-green-800 border-green-200";
    if (status === "Tidak Lulus") return "bg-red-100 text-red-800 border-red-200";
    return "bg-muted text-muted-foreground";
  };

  const levelColor = (level: string) => {
    if (level === "Tahfizh") return "bg-primary/10 text-primary border-primary/20";
    if (level === "Tahsin Lanjutan") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Back button & title */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">🔍 Pencarian Siswa</h2>
            <p className="text-sm text-muted-foreground">Cari siswa di seluruh kelas</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6 shadow-card">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ketik nama siswa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Level Bacaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Level</SelectItem>
                <SelectItem value="Tahsin Dasar">Tahsin Dasar</SelectItem>
                <SelectItem value="Tahsin Lanjutan">Tahsin Lanjutan</SelectItem>
                <SelectItem value="Tahfizh">Tahfizh</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {[1, 2, 3, 4, 5, 6].map(g => (
                  <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isLoading ? "Memuat..." : `${filtered.length} siswa ditemukan`}
          </p>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Tidak ada siswa yang ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div
                key={s.id}
                onClick={() => navigate(`/siswa/${s.id}`)}
                className="bg-card rounded-lg border border-border p-4 shadow-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-sm truncate flex-1">{s.name}</h3>
                  <Badge variant="outline" className={`text-xs ml-2 shrink-0 ${statusColor(s.status_sertifikasi)}`}>
                    {s.status_sertifikasi}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{s.class_name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${levelColor(s.level)}`}>
                    <BookOpen className="w-3 h-3 mr-1" />
                    {s.level}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Award className="w-3 h-3 mr-1" />
                    Target Juz {s.target_juz}
                  </Badge>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Hafalan</span>
                    <span>{s.progress_hafalan}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${s.progress_hafalan}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchStudents;
