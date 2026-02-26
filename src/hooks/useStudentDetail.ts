import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateNilaiSetoran, calculateNilaiUjian } from "@/data/mockData";

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

      return {
        student,
        classInfo: classData,
        setoran: setoran || [],
        ujian: ujian || [],
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
    }) => {
      const nilai = calculateNilaiSetoran({
        kesalahanMakhraj: data.kesalahan_makhraj,
        kesalahanTajwid: data.kesalahan_tajwid,
        kesalahanMad: data.kesalahan_mad,
        kelancaran: data.kelancaran,
      });

      const { error } = await supabase.from("setoran").insert({
        ...data,
        nilai,
      });
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

      // Update student status
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
