import { useMemo } from "react";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, GraduationCap, BookOpen } from "lucide-react";

interface LulusStudent {
  id: string;
  name: string;
  className: string;
  grade: number;
  level: string;
  juzList: number[];
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
}

const AlumniLulus = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["alumni-lulus"],
    queryFn: async () => {
      const { data: ujianData, error: ujianError } = await supabase
        .from("ujian")
        .select("*")
        .eq("mode", "Tahfizh")
        .eq("status", "Lulus")
        .order("tanggal", { ascending: false });

      if (ujianError) throw ujianError;

      const studentIds = [...new Set((ujianData || []).map((u) => u.student_id))];
      if (studentIds.length === 0) return [] as LulusStudent[];

      const { data: students } = await supabase
        .from("students")
        .select("id, name, class_id, level")
        .in("id", studentIds);

      const classIds = [...new Set((students || []).map((s) => s.class_id))];
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, grade")
        .in("id", classIds);

      const classMap = new Map((classes || []).map((c) => [c.id, c]));

      // Group ujian by student
      const ujianByStudent = new Map<string, typeof ujianData>();
      (ujianData || []).forEach((u) => {
        if (!ujianByStudent.has(u.student_id)) ujianByStudent.set(u.student_id, []);
        ujianByStudent.get(u.student_id)!.push(u);
      });

      return (students || []).map((s) => {
        const cls = classMap.get(s.class_id);
        const ujianList = ujianByStudent.get(s.id) || [];
        const allJuz = new Set<number>();
        let bestNilai = 0;
        let bestPredikat = "";
        let latestTanggal = "";

        ujianList.forEach((u) => {
          const aspek = u.nilai_aspek as any;
          const entries = aspek?.surahEntries || [];
          entries.forEach((e: any) => allJuz.add(e.juz));
          if (u.nilai_akhir > bestNilai) {
            bestNilai = u.nilai_akhir;
            bestPredikat = aspek?.predikat || (u.nilai_akhir >= 90 ? "Mumtaz" : u.nilai_akhir >= 80 ? "Jiddan Jayyid" : u.nilai_akhir >= 70 ? "Jayyid" : "Maqbul");
          }
          if (!latestTanggal || u.tanggal > latestTanggal) latestTanggal = u.tanggal;
        });

        return {
          id: s.id,
          name: s.name,
          className: cls?.name || "-",
          grade: cls?.grade || 0,
          level: s.level,
          juzList: [...allJuz].sort((a, b) => a - b),
          nilaiAkhir: bestNilai,
          predikat: bestPredikat,
          tanggal: latestTanggal,
        } as LulusStudent;
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const students = data || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-success/10">
            <GraduationCap className="w-6 h-6 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Daftar Siswa Lulus Sertifikasi</h2>
            <p className="text-sm text-muted-foreground">Siswa yang telah lulus ujian sertifikasi Tahfizh beserta detail juz</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Belum ada siswa yang lulus sertifikasi.
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s, i) => (
              <div key={s.id} className="bg-card rounded-lg border border-border p-4 shadow-card hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">{s.className} • {s.level}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-11 sm:ml-0">
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        s.predikat === "Mumtaz" ? "bg-success/10 text-success" :
                        s.predikat === "Jiddan Jayyid" ? "bg-primary/10 text-primary" :
                        "bg-accent/10 text-accent-foreground"
                      }`}>
                        {s.predikat} ({s.nilaiAkhir})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.tanggal}</div>
                  </div>
                </div>
                <div className="mt-3 ml-11 flex flex-wrap gap-1.5">
                  <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5" />
                  {s.juzList.map((juz) => (
                    <span key={juz} className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                      Juz {juz}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AlumniLulus;
