import { supabase } from "@/integrations/supabase/client";
import type { RaportHeader } from "@/utils/raportPdf";

const RAPORT_SETTINGS_ID = "raport-identity";

export const DEFAULT_RAPORT_HEADER: RaportHeader = {
  schoolName: "SDIT Luqmanul Hakim",
  programName: "Program Tahfizh & Tahsin Al-Qur'an",
  address:
    "Jl. Jati No.4, Tj. Selamat, Kec. Sunggal, Kabupaten Deli Serdang, Sumatera Utara 20351",
  headmaster: "Amrullah Rozy Dalimunthe, S.Si",
  headmasterTitle: "Kepala Sekolah",
  nip: "-",
  city: "Sunggal",
  examinerTitle: "Guru Tahfizh",
};

export function normalizeRaportHeader(value?: Partial<RaportHeader> | null): RaportHeader {
  return {
    ...DEFAULT_RAPORT_HEADER,
    ...(value && typeof value === "object" ? value : {}),
  };
}

export async function loadGlobalRaportHeader(): Promise<RaportHeader> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("id", RAPORT_SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;

  return normalizeRaportHeader(
    (data?.value && typeof data.value === "object" ? data.value : null) as Partial<RaportHeader> | null
  );
}

export async function saveGlobalRaportHeader(header: RaportHeader) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("app_settings").upsert({
    id: RAPORT_SETTINGS_ID,
    value: normalizeRaportHeader(header),
    updated_by: userData.user?.id || null,
  });

  if (error) throw error;
}
