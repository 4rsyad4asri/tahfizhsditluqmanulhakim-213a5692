import { supabase } from "@/integrations/supabase/client";

export async function syncSingleStudentStatus(studentId: string) {
  const { data: latestExam, error: latestExamError } = await supabase
    .from("ujian")
    .select("status")
    .eq("student_id", studentId)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestExamError) throw latestExamError;

  const nextStatus = latestExam?.status || "Belum Ujian";
  const { error: updateError } = await supabase
    .from("students")
    .update({ status_sertifikasi: nextStatus })
    .eq("id", studentId);

  if (updateError) throw updateError;
}

export async function syncStudentStatus() {
  const { data: ujianData, error } = await supabase
    .from("ujian")
    .select("student_id, status, created_at, tanggal")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!ujianData || ujianData.length === 0) {
    return 0;
  }

  const latestMap = new Map();

  for (const ujian of ujianData) {
    if (!latestMap.has(ujian.student_id)) {
      latestMap.set(ujian.student_id, ujian.status);
    }
  }

  for (const [studentId, status] of latestMap.entries()) {
    const { error: updateError } = await supabase
      .from("students")
      .update({
        status_sertifikasi: status
      })
      .eq("id", studentId);
    if (updateError) throw updateError;
  }

  return latestMap.size;
}
