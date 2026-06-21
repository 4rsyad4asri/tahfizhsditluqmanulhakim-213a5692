import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateNilaiSetoran, calculateNilaiUjian } from "@/data/mockData";
import type { TahfizhSurahEntry } from "@/data/mockData";
import type { TahsinDasarEntry, TahsinLanjutanEntry, TahsinPenaltyConfig, WaqafSymbolTest } from "@/data/tahsinScoring";
import {
  normalizeTahfizhPayload,
  validateTahfizhAssessment,
  type TahfizhDocumentStatus,
  type TahfizhExamMode,
  type TahfizhAutoFailConfig,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import {
  getVerificationTypeForExam,
  inferTahfizhModeForExam,
} from "@/utils/verificationUrl";
import { publishTahfizhDocument } from "@/utils/publishTahfizhDocument";
import { buildExamClassSnapshot } from "@/utils/examSnapshot";
import { syncSingleStudentStatus } from "@/utils/syncStudentStatus";

function createVerificationToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getAssessorName(assessorId?: string | null) {
  if (!assessorId) return undefined;

  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assessorId)
    .maybeSingle();

  return data?.full_name || undefined;
}

function invalidateStudentStatusQueries(queryClient: ReturnType<typeof useQueryClient>, studentId: string) {
  queryClient.invalidateQueries({ queryKey: ["student-detail", studentId] });
  queryClient.invalidateQueries({ queryKey: ["classes"] });
  queryClient.invalidateQueries({ queryKey: ["all-students"] });
  queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
  queryClient.invalidateQueries({ queryKey: ["rekap-ujian-global"] });
}

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
        .select("*, academic_years(name), academic_semesters(name, semester_number)")
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
      const examSnapshot = await buildExamClassSnapshot(data.student_id);
      const { nilaiAkhir, status, grade } = calculateNilaiUjian(data.nilai_aspek);

      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: data.mode,
        nilai_aspek: data.nilai_aspek,
        nilai_akhir: nilaiAkhir,
        status,
        grade,
        ...examSnapshot,
      });
      if (ujianError) throw ujianError;
      await syncSingleStudentStatus(data.student_id);
    },
    onSuccess: (_, variables) => {
      invalidateStudentStatusQueries(queryClient, variables.student_id);
    },
  });
}

export function useAddTahfizhUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      entries: TahfizhSurahEntry[] | TahfizhSurahAssessment[];
      catatan_guru: string;
      nilaiAkhir: number;
      status: 'Lulus' | 'Tidak Lulus';
      grade: string;
      predikat: string;
      assessed_by?: string;
      tanggal?: string;
      waktu?: string;
      tahfizh_mode?: TahfizhExamMode;
      config?: TahfizhPenaltyConfig;
      status_label?: string;
      document_status?: TahfizhDocumentStatus;
      manual_stop_reason?: string;
      auto_fail_log?: string;
      auto_fail_config?: TahfizhAutoFailConfig;
    }) => {
      const tahfizhMode = data.tahfizh_mode || "Sertifikat";
      const normalized = normalizeTahfizhPayload({
        entries: data.entries,
        tahfizhMode,
        config: data.config,
        manualStopReason: data.manual_stop_reason,
        autoFailConfig: data.auto_fail_config,
        nilaiAspek: {
          catatanGuru: data.catatan_guru,
          catatanMode: data.catatan_guru?.trim() ? "manual" : "auto",
          documentStatus: data.document_status || "Draft",
        },
      });
      if (!normalized.assessments.length) {
        throw new Error("Detail nilai Ujian Tahfizh wajib diisi sebelum disimpan");
      }
      const invalidAssessment = normalized.assessments
        .map(validateTahfizhAssessment)
        .find((validation) => !validation.valid);
      if (invalidAssessment) {
        throw new Error(invalidAssessment.errors.join(", "));
      }
      const verificationToken = createVerificationToken();
      const assessorName = await getAssessorName(data.assessed_by);
      const examSnapshot = await buildExamClassSnapshot(data.student_id);

      const nilai_aspek = {
        ...normalized.nilaiAspek,
        statusLabel: data.status_label || normalized.result.statusLabel,
        autoFailLog: data.auto_fail_log || normalized.result.autoFail.log,
        verificationToken,
        assessorName,
      } as unknown as Record<string, unknown>;

      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: 'Tahfizh' as const,
        nilai_aspek: nilai_aspek as any,
        nilai_akhir: normalized.nilaiAkhir,
        status: normalized.status,
        grade: normalized.grade,
        assessed_by: data.assessed_by || null,
        tanggal: data.tanggal || new Date().toISOString().split("T")[0],
        document_status: data.document_status || "Draft",
        verification_token: verificationToken,
        published_at: data.document_status === "Published" ? new Date().toISOString() : null,
        ...examSnapshot,
      } as any);
      if (ujianError) throw ujianError;
      await syncSingleStudentStatus(data.student_id);
    },
    onSuccess: (_, variables) => {
      invalidateStudentStatusQueries(queryClient, variables.student_id);
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
      const examSnapshot = await buildExamClassSnapshot(data.student_id);
      const { error: ujianError } = await supabase.from("ujian").insert({
        student_id: data.student_id,
        mode: data.mode as any,
        nilai_aspek: data.nilai_aspek as any,
        nilai_akhir: data.nilaiAkhir,
        status: data.status,
        grade: data.grade,
        assessed_by: data.assessed_by || null,
        tanggal: data.tanggal || new Date().toISOString().split("T")[0],
        ...examSnapshot,
      } as any);
      if (ujianError) throw ujianError;
      await syncSingleStudentStatus(data.student_id);
    },
    onSuccess: (_, variables) => {
      invalidateStudentStatusQueries(queryClient, variables.student_id);
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

// Update existing ujian (edit penalti / kelancaran / nilai_akhir / status / catatan)
export function useUpdateUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      ujian_id: string;
      student_id: string;
      nilai_aspek: Record<string, unknown>;
      nilai_akhir: number;
      status: 'Lulus' | 'Tidak Lulus';
      grade: string;
      tanggal?: string;
      document_status?: TahfizhDocumentStatus;
    }) => {
      const { data: existingUjian, error: fetchError } = await supabase
        .from("ujian")
        .select("mode, nilai_aspek, nilai_akhir, status, grade")
        .eq("id", data.ujian_id)
        .single();
      if (fetchError) throw fetchError;

      let nextNilaiAspek = data.nilai_aspek;
      let nextNilaiAkhir = data.nilai_akhir;
      let nextStatus = data.status;
      let nextGrade = data.grade;

      if (existingUjian.mode === "Tahfizh") {
        const existingNilaiAspek =
          existingUjian.nilai_aspek && typeof existingUjian.nilai_aspek === "object"
            ? existingUjian.nilai_aspek as Record<string, unknown>
            : {};
        const normalized = normalizeTahfizhPayload({
          nilaiAspek: data.nilai_aspek,
          existingNilaiAspek,
          tahfizhMode:
            (data.nilai_aspek.tahfizhMode as TahfizhExamMode | undefined) ||
            (existingNilaiAspek.tahfizhMode as TahfizhExamMode | undefined),
          config: data.nilai_aspek.config as Record<string, unknown> | undefined,
          manualStopReason: data.nilai_aspek.manualStopReason as string | undefined,
          autoFailConfig: data.nilai_aspek.autoFailConfig as TahfizhAutoFailConfig | undefined,
        });
        if (!normalized.assessments.length) {
          throw new Error("Detail nilai Ujian Tahfizh wajib diisi sebelum diperbarui");
        }
        const invalidAssessment = normalized.assessments
          .map(validateTahfizhAssessment)
          .find((validation) => !validation.valid);
        if (invalidAssessment) {
          throw new Error(invalidAssessment.errors.join(", "));
        }
        nextNilaiAspek = normalized.nilaiAspek;
        nextNilaiAkhir = normalized.nilaiAkhir;
        nextStatus = normalized.status;
        nextGrade = normalized.grade;
      }

      const payload: any = {
        nilai_aspek: nextNilaiAspek,
        nilai_akhir: nextNilaiAkhir,
        status: nextStatus,
        grade: nextGrade,
      };
      if (data.tanggal) payload.tanggal = data.tanggal;
      if (data.document_status) {
        payload.document_status = data.document_status;
        if (data.document_status === "Published") payload.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from("ujian").update(payload).eq("id", data.ujian_id);
      if (error) throw error;

      await syncSingleStudentStatus(data.student_id);
    },
    onSuccess: (_, variables) => {
      invalidateStudentStatusQueries(queryClient, variables.student_id);
    },
  });
}

export function usePublishUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ujian_id: string; student_id: string }) => {
      await publishTahfizhDocument({ ujianId: data.ujian_id });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-detail", variables.student_id] });
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["rekap-ujian-global"] });
    },
  });
}

export function useVerificationDocument(token: string | undefined) {
  return useQuery({
    queryKey: ["verification-document", token],
    queryFn: async () => {
      if (!token) throw new Error("Token verifikasi tidak valid");

      const { data, error } = await supabase
        .from("ujian")
        .select("*, students(name, nis, nisn, class_id, classes(name, grade, section))")
        .eq("verification_token", token)
        .eq("document_status", "Published")
        .single();

      if (error) throw error;

      const rawAspek =
        data.nilai_aspek && typeof data.nilai_aspek === "object"
          ? (data.nilai_aspek as Record<string, unknown>)
          : {};
      const tahfizhMode = inferTahfizhModeForExam({
        mode: data.mode,
        tahfizhMode: rawAspek.tahfizhMode as string | undefined,
        verificationType: rawAspek.verificationType as string | undefined,
        assessedBy: data.assessed_by,
        tanggal: data.tanggal,
      });
      const normalizedAspek = tahfizhMode
        ? {
            ...rawAspek,
            tahfizhMode,
            reportType:
              (rawAspek.reportType as string | undefined) ||
              (tahfizhMode === "Sertifikat" ? "summary" : "detail"),
            verificationType:
              (rawAspek.verificationType as string | undefined) ||
              getVerificationTypeForExam({
                mode: data.mode,
                tahfizhMode,
                assessedBy: data.assessed_by,
                tanggal: data.tanggal,
              }),
          }
        : rawAspek;

      if (!data.assessed_by) {
        return {
          ...data,
          nilai_aspek: normalizedAspek,
        };
      }

      const assessorName = await getAssessorName(data.assessed_by);

      return {
        ...data,
        nilai_aspek: normalizedAspek,
        assessor_name: assessorName,
      };
    },
    enabled: !!token,
    retry: false,
  });
}

export const useTahfizhVerification = useVerificationDocument;

export function useDeleteUjian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ujian_id: string; student_id: string }) => {
      const { error } = await supabase.from("ujian").delete().eq("id", data.ujian_id);
      if (error) throw error;
      await syncSingleStudentStatus(data.student_id);
    },
    onSuccess: (_, variables) => {
      invalidateStudentStatusQueries(queryClient, variables.student_id);
    },
  });
}
