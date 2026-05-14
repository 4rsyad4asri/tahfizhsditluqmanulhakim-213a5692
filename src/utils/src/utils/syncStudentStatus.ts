import { supabase } from "@/integrations/supabase/client";

export async function syncStudentStatus() {

  // ambil semua data ujian
  const { data: ujianData, error } = await supabase
    .from("ujian")
    .select("student_id, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!ujianData || ujianData.length === 0) {
    return 0;
  }

  // ambil status ujian terakhir tiap siswa
  const latestMap = new Map();

  for (const ujian of ujianData) {
    if (!latestMap.has(ujian.student_id)) {
      latestMap.set(ujian.student_id, ujian.status);
    }
  }

  // update semua siswa
  for (const [studentId, status] of latestMap.entries()) {
    await supabase
      .from("students")
      .update({
        status_sertifikasi: status
      })
      .eq("id", studentId);
  }

  return latestMap.size;
}
