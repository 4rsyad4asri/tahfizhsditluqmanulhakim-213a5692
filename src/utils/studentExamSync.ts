import { aggregateTahfizhAssessmentsForDisplay, normalizeTahfizhAssessment } from "@/data/tahfizhSystem";
import type { Database, Json } from "@/integrations/supabase/types";

type StudentLevel = Database["public"]["Enums"]["student_level"];
type CertStatus = Database["public"]["Enums"]["certification_status"];
type ExamMode = Database["public"]["Enums"]["exam_mode"];
type ExamStatus = Database["public"]["Enums"]["exam_status"];

export type StudentExamSyncRow = {
  created_at?: string | null;
  mode?: ExamMode | null;
  nilai_aspek?: Json;
  status?: ExamStatus | null;
  student_id: string;
  tanggal?: string | null;
};

type TahsinDasarEntryLike = {
  nama_ebta?: string | null;
};

type TahsinLanjutanEntryLike = {
  ayat?: string | null;
  surah?: string | null;
};

function asObject(value: Json | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getTahsinDasarEntries(value: Json | null | undefined): TahsinDasarEntryLike[] {
  const aspek = asObject(value);
  const entries = aspek?.entries;
  return Array.isArray(entries) ? (entries as TahsinDasarEntryLike[]) : [];
}

function getTahsinLanjutanEntries(value: Json | null | undefined): TahsinLanjutanEntryLike[] {
  const aspek = asObject(value);
  const entries = aspek?.entries;
  return Array.isArray(entries) ? (entries as TahsinLanjutanEntryLike[]) : [];
}

function getTahfizhLatestJuz(value: Json | null | undefined): number | null {
  const aspek = asObject(value);
  const rawEntries = Array.isArray(aspek?.surahEntries) ? aspek.surahEntries : [];
  if (!rawEntries.length) return null;

  const entries = aggregateTahfizhAssessmentsForDisplay(rawEntries).map((entry) => normalizeTahfizhAssessment(entry));
  const juzList = entries
    .map((entry) => Number(entry.juz || 0))
    .filter((juz) => juz >= 1 && juz <= 30);

  if (!juzList.length) return null;

  // Smaller juz means the student has progressed further in the sequence 30 -> 1.
  return Math.min(...juzList);
}

export function getStudentLevelFromExam(mode?: ExamMode | null): StudentLevel | null {
  if (mode === "Tahsin Dasar" || mode === "Tahsin Lanjutan" || mode === "Tahfizh") return mode;
  return null;
}

export function getStudentTargetLabelFromExam(exam?: Pick<StudentExamSyncRow, "mode" | "nilai_aspek"> | null): string | null {
  if (!exam?.mode) return null;

  if (exam.mode === "Tahsin Dasar") {
    const lastEntry = [...getTahsinDasarEntries(exam.nilai_aspek)].reverse().find((entry) => entry.nama_ebta?.trim());
    return lastEntry?.nama_ebta?.trim() || "EBTA terakhir";
  }

  if (exam.mode === "Tahsin Lanjutan") {
    const lastEntry = [...getTahsinLanjutanEntries(exam.nilai_aspek)]
      .reverse()
      .find((entry) => entry.surah?.trim() || entry.ayat?.trim());

    if (!lastEntry) return "Materi terakhir";

    const surah = lastEntry.surah?.trim();
    const ayat = lastEntry.ayat?.trim();
    if (surah && ayat) return `${surah} (${ayat})`;
    return surah || ayat || "Materi terakhir";
  }

  if (exam.mode === "Tahfizh") {
    const juz = getTahfizhLatestJuz(exam.nilai_aspek);
    return juz ? `Juz ${juz}` : "Tahfizh";
  }

  return null;
}

export function getStudentSyncUpdateFromExam(exam?: StudentExamSyncRow | null): {
  level?: StudentLevel;
  status_sertifikasi: CertStatus;
  target_juz?: number;
} {
  const nextStatus = (exam?.status || "Belum Ujian") as CertStatus;
  const nextLevel = getStudentLevelFromExam(exam?.mode);

  if (!exam) {
    return { status_sertifikasi: nextStatus };
  }

  if (exam.mode === "Tahfizh") {
    const latestJuz = getTahfizhLatestJuz(exam.nilai_aspek);
    return {
      status_sertifikasi: nextStatus,
      ...(nextLevel ? { level: nextLevel } : {}),
      ...(latestJuz ? { target_juz: latestJuz } : {}),
    };
  }

  return {
    status_sertifikasi: nextStatus,
    ...(nextLevel ? { level: nextLevel } : {}),
  };
}
