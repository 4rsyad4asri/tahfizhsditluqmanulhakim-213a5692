import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateNilaiSetoran, calculateNilaiUjian, calculateNilaiTahfizh } from "@/data/mockData";
import type { TahfizhSurahEntry } from "@/data/mockData";
import type { TahsinDasarEntry, TahsinLanjutanEntry, TahsinPenaltyConfig, WaqafSymbolTest } from "@/data/tahsinScoring";

export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: async () => {
      if (!studentId) throw new Error("No student ID");

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", student.class_id)
        .single();

      const { data: setoran } = await supabase
        .from("setoran")
        .select("*")
        .eq("student_id", studentId)
        .order("tanggal", { ascending: false });

      const { data: ujian } = await supabase
        .from("ujian")
        .select("*")
        .eq("student_id", studentId)
        .order("tanggal", { ascending: false });

      // Fetch assessor profiles for setoran and ujian
      const assessorIds = new Set<string>();
      (setoran || []).forEach((s: any) => s.assessed_by && assessorIds.add(s.assessed_by));
      (ujian || []).forEach((u: any) => u.assessed_by && assessorIds.add(u.assessed_by));

      let assessorMap: Record<string, string> = {};
      if (assessorIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(assessorIds));
        if (profiles) {
          profiles.forEach((p: any) => { assessorMap[p.id] = p.full_name; });
        }
      }

      return {
        student,
        classInfo: classData,
        setoran: setoran || [],
        ujian: ujian || [],
        assessorMap,
      };
    },
    enabled: !!studentId,
  });
}

export function useAddSetoran() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      tanggal: string;
      juz: number;
      surah: string;
      ayat_mulai: number;
      ayat_akhir: number;
      kesalahan_makhraj: number;
      kesalahan_tajwid: number;
      kesalahan_mad: number;
      kelancaran: number;
      lupa_ayat: number;
      terhenti_terbata: number;
      catatan_guru: string;
      assessed_by?: string;
    }) => {
      const nilai = calculateNilaiSetoran({
        kesalahanMakhraj: data.kesalahan_makhraj,
        kesalahanTajwid: data.kesalahan_tajwid,
        kesalahanMad: data.kesalahan_mad,
        kelancaran: data.kelancaran,
      });

      const { error } = await supabase.from("setoran").insert({
        student_id: data.student_id,
        tanggal: data.tanggal,
        juz: data.juz,
        surah: data.surah,
        ayat_mulai: data.ayat_mulai,
        ayat_akhir: data.ayat_akhir,
        kesalahan_makhraj: data.kesalahan_makhraj,
        kesalahan_tajwid: data.kesalahan_tajwid,
        kesalahan_mad: data.kesalahan_mad,
        kelancaran: data.kelancaran,
        lupa_ayat: data.lupa_ayat,
        terhenti_terbata: data.terhenti_terbata,
        catatan_guru: data.catatan_guru,
        nilai,
        assessed_by: data.assessed_by || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
    },
  });
}

export function useAddUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      mode: "Tahsin" | "Tahfizh";
      nilai_aspek: Record<string, number>;
    }) => {
      const { nilaiAkhir, status, grade } = calculateNilaiUjian(data.nilai_aspek);

      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: data.mode,
        nilai_aspek: data.nilai_aspek,
        nilai_akhir: nilaiAkhir,
        status,
        grade,
      });
      if (ujianError) throw ujianError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ status_sertifikasi: status })
        .eq("id", data.student_id);
      if (studentError) throw studentError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useAddTahfizhUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      entries: TahfizhSurahEntry[];
      catatan_guru: string;
      nilaiAkhir: number;
      status: 'Lulus' | 'Tidak Lulus';
      grade: string;
      predikat: string;
      assessed_by?: string;
      tanggal?: string;
    }) => {
      const nilai_aspek = {
        surahEntries: data.entries,
        catatanGuru: data.catatan_guru,
        predikat: data.predikat,
      } as unknown as Record<string, unknown>;

      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: 'Tahfizh' as const,
        nilai_aspek: nilai_aspek as any,
        nilai_akhir: data.nilaiAkhir,
        status: data.status,
        grade: data.grade,
        assessed_by: data.assessed_by || null,
        tanggal: data.tanggal || new Date().toISOString().split("T")[0],
      } as any);
      if (ujianError) throw ujianError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ status_sertifikasi: data.status })
        .eq("id", data.student_id);
      if (studentError) throw studentError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
    },
  });
}

export function useAddTahsinUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      mode: 'Tahsin Dasar' | 'Tahsin Lanjutan';
      nilai_aspek: Record<string, unknown>;
      nilaiAkhir: number;
      status: 'Lulus' | 'Tidak Lulus';
      grade: string;
      assessed_by?: string;
      tanggal?: string;
      waktu?: string;
    }) => {
      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: data.mode as any,
        nilai_aspek: data.nilai_aspek as any,
        nilai_akhir: data.nilaiAkhir,
        status: data.status,
        grade: data.grade,
        assessed_by: data.assessed_by || null,
        tanggal: data.tanggal || new Date().toISOString().split("T")[0],
      } as any);
      if (ujianError) throw ujianError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useUpdateCatatan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { student_id: string; catatan: string }) => {
      const { error } = await supabase
        .from("students")
        .update({ catatan_penguji: data.catatan })
        .eq("id", data.student_id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
    },
  });
}
