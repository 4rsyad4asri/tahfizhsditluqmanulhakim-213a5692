import { supabase } from "@/integrations/supabase/client";
import type { RaportAssets } from "@/utils/raportPdf";

const OFFICIAL_SIGNATURES_ID = "official-signatures";
const SIGNED_URL_TTL_SECONDS = 3600;

export interface OfficialSignatureSettings {
  headmasterSignaturePath?: string | null;
  logoLeftPath?: string | null;
  logoRightPath?: string | null;
}

async function storagePathToDataUrl(bucket: "signatures" | "avatars", path?: string | null) {
  if (!path) return undefined;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return undefined;

  const signedUrl = new URL(data.signedUrl);
  signedUrl.searchParams.set("v", Date.now().toString());
  const response = await fetch(signedUrl.toString(), { cache: "no-store" });
  if (!response.ok) return undefined;
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca gambar tanda tangan"));
    reader.readAsDataURL(blob);
  });
}

export async function getProfileSignatureDataUrl(userId?: string | null) {
  if (!userId) return undefined;

  const { data } = await supabase
    .from("profiles")
    .select("signature_url")
    .eq("id", userId)
    .maybeSingle();

  return storagePathToDataUrl("signatures", data?.signature_url);
}

export async function loadOfficialSignatureSettings(): Promise<OfficialSignatureSettings> {
  const { data } = await supabase
    .from("app_settings" as any)
    .select("value")
    .eq("id", OFFICIAL_SIGNATURES_ID)
    .maybeSingle();

  const value = (data as { value?: OfficialSignatureSettings } | null)?.value;
  return value && typeof value === "object" ? value : {};
}

export async function saveOfficialSignatureSettings(settings: OfficialSignatureSettings) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("app_settings" as any)
    .upsert({
      id: OFFICIAL_SIGNATURES_ID,
      value: settings,
      updated_by: userData.user?.id || null,
    });

  if (error) throw error;
}

export async function getHeadmasterSignatureDataUrl() {
  const settings = await loadOfficialSignatureSettings();
  return storagePathToDataUrl("signatures", settings.headmasterSignaturePath);
}

export async function getOfficialBrandingDataUrls() {
  const settings = await loadOfficialSignatureSettings();
  const [logoLeft, logoRight] = await Promise.all([
    storagePathToDataUrl("avatars", settings.logoLeftPath),
    storagePathToDataUrl("avatars", settings.logoRightPath),
  ]);

  return { logoLeft, logoRight };
}

export async function resolveRaportSignatureAssets(
  assessedBy?: string | null,
  manualAssets: RaportAssets = {}
): Promise<RaportAssets> {
  const [examinerSignature, headmasterSignature, branding] = await Promise.all([
    getProfileSignatureDataUrl(assessedBy),
    getHeadmasterSignatureDataUrl(),
    manualAssets.logoLeft && manualAssets.logoRight
      ? { logoLeft: undefined, logoRight: undefined }
      : getOfficialBrandingDataUrls(),
  ]);

  return {
    ...manualAssets,
    logoLeft: manualAssets.logoLeft || branding.logoLeft,
    logoRight: manualAssets.logoRight || branding.logoRight,
    sigExaminer: examinerSignature || manualAssets.sigExaminer,
    sigHeadmaster: headmasterSignature || manualAssets.sigHeadmaster,
  };
}

export async function resolveCertificateSignatures(coordinatorUserId?: string | null) {
  const [coordinatorSignatureDataUrl, principalSignatureDataUrl, branding] = await Promise.all([
    getProfileSignatureDataUrl(coordinatorUserId),
    getHeadmasterSignatureDataUrl(),
    getOfficialBrandingDataUrls(),
  ]);

  return {
    coordinatorSignatureDataUrl,
    principalSignatureDataUrl,
    leftLogoDataUrl: branding.logoLeft,
    rightLogoDataUrl: branding.logoRight,
  };
}
