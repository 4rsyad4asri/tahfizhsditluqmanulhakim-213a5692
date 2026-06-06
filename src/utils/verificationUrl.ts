export const VERIFICATION_TYPES = [
  "rapor-tahsin",
  "rapor-tahsin-lanjutan",
  "tahfizh-reguler",
  "sertifikat-tahfizh",
] as const;

export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export function getPublicSiteOrigin() {
  const envOrigin = import.meta.env.VITE_PUBLIC_SITE_URL;

  if (envOrigin) return String(envOrigin).replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");

  return "";
}

export function buildVerificationUrl(
  type: VerificationType,
  token?: string | null
) {
  if (!token) return undefined;

  const origin = getPublicSiteOrigin();
  const path = `/verifikasi/${type}/${encodeURIComponent(token)}`;

  return origin ? `${origin}${path}` : path;
}

export function getVerificationTypeForExam(
  mode?: string | null,
  tahfizhMode?: string | null
): VerificationType | undefined {
  if (mode === "Tahsin Dasar") return "rapor-tahsin";
  if (mode === "Tahsin Lanjutan") return "rapor-tahsin-lanjutan";
  if (mode === "Tahfizh" && tahfizhMode === "Sertifikat") return "sertifikat-tahfizh";
  if (mode === "Tahfizh") return "tahfizh-reguler";
  return undefined;
}

export function buildVerificationUrlForExam(
  mode?: string | null,
  tahfizhMode?: string | null,
  token?: string | null
) {
  const type = getVerificationTypeForExam(mode, tahfizhMode);
  if (!type) return undefined;
  return buildVerificationUrl(type, token);
}

export function buildTahfizhVerificationUrl(token?: string | null) {
  return buildVerificationUrl("tahfizh-reguler", token);
}
