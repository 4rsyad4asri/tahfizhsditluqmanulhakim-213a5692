export const VERIFICATION_TYPES = [
  "rapor-tahsin",
  "rapor-tahsin-lanjutan",
  "tahfizh-reguler",
  "sertifikat-tahfizh",
] as const;

export type VerificationType = (typeof VERIFICATION_TYPES)[number];
export type TahfizhVerificationMode = "Reguler" | "Sertifikat";

const LEGACY_TAHFIZH_CERTIFICATE_ASSESSOR_IDS = new Set([
  "846588ce-5957-4f00-811f-f03121226abe",
]);
const LEGACY_TAHFIZH_CERTIFICATE_CUTOFF = "2026-05-24";

export interface VerificationExamContext {
  mode?: string | null;
  tahfizhMode?: string | null;
  verificationType?: string | null;
  assessedBy?: string | null;
  tanggal?: string | null;
}

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

function isBeforeLegacyCutoff(tanggal?: string | null) {
  if (!tanggal) return false;
  return tanggal < LEGACY_TAHFIZH_CERTIFICATE_CUTOFF;
}

export function isLegacyTahfizhCertificate(
  context: VerificationExamContext
) {
  if (context.mode !== "Tahfizh") return false;
  if (context.tahfizhMode) return context.tahfizhMode === "Sertifikat";
  if (context.verificationType) {
    return context.verificationType === "sertifikat-tahfizh";
  }

  return (
    !!context.assessedBy &&
    LEGACY_TAHFIZH_CERTIFICATE_ASSESSOR_IDS.has(context.assessedBy) &&
    isBeforeLegacyCutoff(context.tanggal)
  );
}

export function isLegacyTahfizhCertificateCandidate(
  context: VerificationExamContext
) {
  if (context.mode !== "Tahfizh") return false;
  if (context.tahfizhMode) return false;
  if (context.verificationType) return false;

  return (
    !!context.assessedBy &&
    LEGACY_TAHFIZH_CERTIFICATE_ASSESSOR_IDS.has(context.assessedBy) &&
    isBeforeLegacyCutoff(context.tanggal)
  );
}

export function usesLegacyTahfizhScoring(
  context: VerificationExamContext
) {
  return (
    context.mode === "Tahfizh" &&
    !!context.assessedBy &&
    LEGACY_TAHFIZH_CERTIFICATE_ASSESSOR_IDS.has(context.assessedBy) &&
    isBeforeLegacyCutoff(context.tanggal)
  );
}

export function inferTahfizhModeForExam(
  context: VerificationExamContext
): TahfizhVerificationMode | undefined {
  if (context.mode !== "Tahfizh") return undefined;
  if (context.tahfizhMode === "Sertifikat" || context.tahfizhMode === "Reguler") {
    return context.tahfizhMode;
  }
  if (context.verificationType === "sertifikat-tahfizh") return "Sertifikat";
  if (context.verificationType === "tahfizh-reguler") return "Reguler";
  if (isLegacyTahfizhCertificate(context)) return "Sertifikat";
  return "Reguler";
}

export function getVerificationTypeForExam(
  context: VerificationExamContext
): VerificationType | undefined {
  if (context.mode === "Tahsin Dasar") return "rapor-tahsin";
  if (context.mode === "Tahsin Lanjutan") return "rapor-tahsin-lanjutan";
  if (context.mode === "Tahfizh" && inferTahfizhModeForExam(context) === "Sertifikat") {
    return "sertifikat-tahfizh";
  }
  if (context.mode === "Tahfizh") return "tahfizh-reguler";
  return undefined;
}

export function buildVerificationUrlForExam(
  context: VerificationExamContext,
  token?: string | null
) {
  const type = getVerificationTypeForExam(context);
  if (!type) return undefined;
  return buildVerificationUrl(type, token);
}

export function buildTahfizhVerificationUrl(token?: string | null) {
  return buildVerificationUrl("tahfizh-reguler", token);
}
