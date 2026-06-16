import { supabase } from "@/integrations/supabase/client";
import { formatClassName } from "@/utils/className";

export interface AcademicYearSnapshot {
  id: string;
  name: string;
}

export interface ExamClassSnapshot {
  class_name_at_exam: string | null;
  grade_at_exam: number | null;
  academic_year_id: string | null;
}

export async function getActiveAcademicYear(): Promise<AcademicYearSnapshot | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function buildExamClassSnapshot(studentId: string): Promise<ExamClassSnapshot> {
  const [{ data: student, error: studentError }, activeYear] = await Promise.all([
    supabase
      .from("students")
      .select("class_id, classes(name, grade, section)")
      .eq("id", studentId)
      .maybeSingle(),
    getActiveAcademicYear(),
  ]);

  if (studentError) throw studentError;

  const classInfo = student?.classes as
    | { name?: string | null; grade?: number | null; section?: string | null }
    | null
    | undefined;

  return {
    class_name_at_exam: classInfo ? formatClassName(classInfo) || null : null,
    grade_at_exam:
      classInfo?.grade === null || classInfo?.grade === undefined
        ? null
        : Number(classInfo.grade) || null,
    academic_year_id: activeYear?.id || null,
  };
}

export function resolveExamClassName(
  ujian: { class_name_at_exam?: string | null } | null | undefined,
  fallbackClass?: string | { name?: string | null; grade?: number | string | null; section?: string | null } | null,
) {
  const snapshotClass = formatClassName(ujian?.class_name_at_exam || "");
  if (snapshotClass) return snapshotClass;
  return formatClassName(fallbackClass || "");
}

export function resolveExamGrade(
  ujian: { grade_at_exam?: number | null } | null | undefined,
  fallbackGrade?: number | string | null,
) {
  const snapshotGrade = Number(ujian?.grade_at_exam);
  if (Number.isFinite(snapshotGrade) && snapshotGrade > 0) return snapshotGrade;

  const nextFallback = Number(fallbackGrade);
  if (Number.isFinite(nextFallback) && nextFallback > 0) return nextFallback;

  return 0;
}
