import { supabase } from "@/integrations/supabase/client";

export const CERTIFICATE_WIDTH = 1448;
export const CERTIFICATE_HEIGHT = 1086;
export const CERTIFICATE_LAYOUT_ID = "tahfizh";
const LOCAL_STORAGE_KEY = "tahfizh_certificate_layout_v1";

export type CertificateElementId =
  | "studentName"
  | "certificateNumber"
  | "className"
  | "juzInfo"
  | "qrCode"
  | "date";

export type CertificateTextAlign = "left" | "center" | "right";

export interface CertificateElementLayout {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  letterSpacing: number;
  color: string;
  textAlign: CertificateTextAlign;
}

export interface CertificateQrLayout {
  x: number;
  y: number;
  size: number;
}

export interface CertificateLayout {
  studentName: CertificateElementLayout;
  certificateNumber: CertificateElementLayout;
  className: CertificateElementLayout;
  juzInfo: CertificateElementLayout;
  qrCode: CertificateQrLayout;
  date: CertificateElementLayout;
}

export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  certificateNumber: {
    x: 751,
    y: 309,
    width: 330,
    fontSize: 18,
    fontFamily: "Arial",
    fontWeight: 600,
    letterSpacing: 0.8,
    color: "#072346",
    textAlign: "center",
  },
  studentName: {
    x: 724,
    y: 470,
    width: 930,
    fontSize: 48,
    fontFamily: "Georgia",
    fontWeight: 700,
    letterSpacing: 0.8,
    color: "#072346",
    textAlign: "center",
  },
  className: {
    x: 833,
    y: 529,
    width: 220,
    fontSize: 27,
    fontFamily: "Arial",
    fontWeight: 600,
    letterSpacing: 0,
    color: "#ffffff",
    textAlign: "center",
  },
  juzInfo: {
    x: 724,
    y: 600,
    width: 960,
    fontSize: 20,
    fontFamily: "Arial",
    fontWeight: 600,
    letterSpacing: 0,
    color: "#072346",
    textAlign: "center",
  },
  date: {
    x: 1082,
    y: 729,
    width: 230,
    fontSize: 19,
    fontFamily: "Arial",
    fontWeight: 700,
    letterSpacing: 0,
    color: "#5f237c",
    textAlign: "center",
  },
  qrCode: {
    x: 724,
    y: 862,
    size: 118,
  },
};

let cachedLayout: CertificateLayout | null = null;

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const normalizeTextElement = (
  value: unknown,
  fallback: CertificateElementLayout,
): CertificateElementLayout => {
  const raw = value && typeof value === "object"
    ? value as Partial<CertificateElementLayout>
    : {};
  const align = raw.textAlign;

  return {
    x: clamp(raw.x, fallback.x, 0, CERTIFICATE_WIDTH),
    y: clamp(raw.y, fallback.y, 0, CERTIFICATE_HEIGHT),
    width: clamp(raw.width, fallback.width, 40, CERTIFICATE_WIDTH),
    fontSize: clamp(raw.fontSize, fallback.fontSize, 8, 96),
    fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily.trim()
      ? raw.fontFamily
      : fallback.fontFamily,
    fontWeight: clamp(raw.fontWeight, fallback.fontWeight, 400, 800),
    letterSpacing: clamp(raw.letterSpacing, fallback.letterSpacing, -2, 12),
    color: typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color)
      ? raw.color
      : fallback.color,
    textAlign: align === "left" || align === "right" || align === "center"
      ? align
      : fallback.textAlign,
  };
};

export const normalizeCertificateLayout = (value: unknown): CertificateLayout => {
  const raw = value && typeof value === "object"
    ? value as Partial<CertificateLayout>
    : {};
  const qr = raw.qrCode && typeof raw.qrCode === "object"
    ? raw.qrCode as Partial<CertificateQrLayout>
    : {};

  return {
    studentName: normalizeTextElement(raw.studentName, DEFAULT_CERTIFICATE_LAYOUT.studentName),
    certificateNumber: normalizeTextElement(
      raw.certificateNumber,
      DEFAULT_CERTIFICATE_LAYOUT.certificateNumber,
    ),
    className: normalizeTextElement(raw.className, DEFAULT_CERTIFICATE_LAYOUT.className),
    juzInfo: normalizeTextElement(raw.juzInfo, DEFAULT_CERTIFICATE_LAYOUT.juzInfo),
    date: normalizeTextElement(raw.date, DEFAULT_CERTIFICATE_LAYOUT.date),
    qrCode: {
      x: clamp(qr.x, DEFAULT_CERTIFICATE_LAYOUT.qrCode.x, 0, CERTIFICATE_WIDTH),
      y: clamp(qr.y, DEFAULT_CERTIFICATE_LAYOUT.qrCode.y, 0, CERTIFICATE_HEIGHT),
      size: clamp(qr.size, DEFAULT_CERTIFICATE_LAYOUT.qrCode.size, 48, 260),
    },
  };
};

const readLocalLayout = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? normalizeCertificateLayout(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const writeLocalLayout = (layout: CertificateLayout) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layout));
};

export const loadCertificateLayout = async (
  forceRefresh = false,
): Promise<CertificateLayout> => {
  if (!forceRefresh && cachedLayout) return cachedLayout;

  const localLayout = readLocalLayout();
  try {
    const { data, error } = await supabase
      .from("certificate_layouts")
      .select("layout")
      .eq("id", CERTIFICATE_LAYOUT_ID)
      .maybeSingle();

    if (error) throw error;
    cachedLayout = normalizeCertificateLayout(data?.layout ?? localLayout);
  } catch (error) {
    console.warn("Layout sertifikat Supabase tidak tersedia, memakai fallback lokal:", error);
    cachedLayout = localLayout ?? DEFAULT_CERTIFICATE_LAYOUT;
  }

  writeLocalLayout(cachedLayout);
  return cachedLayout;
};

export const saveCertificateLayout = async (value: CertificateLayout) => {
  const layout = normalizeCertificateLayout(value);
  cachedLayout = layout;
  writeLocalLayout(layout);

  try {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("certificate_layouts")
      .upsert({
        id: CERTIFICATE_LAYOUT_ID,
        layout,
        updated_by: userData.user?.id ?? null,
      });
    if (error) throw error;
    return { layout, synced: true };
  } catch (error) {
    console.warn("Layout tersimpan lokal tetapi belum tersinkron ke Supabase:", error);
    return { layout, synced: false };
  }
};

export const exportCertificateLayout = (value: CertificateLayout) =>
  JSON.stringify(
    {
      type: "tahfizh-certificate-layout",
      version: 1,
      exportedAt: new Date().toISOString(),
      layout: normalizeCertificateLayout(value),
    },
    null,
    2,
  );

export const importCertificateLayout = (value: unknown): CertificateLayout => {
  if (!value || typeof value !== "object") {
    throw new Error("File layout tidak valid");
  }

  const raw = value as {
    type?: unknown;
    version?: unknown;
    layout?: unknown;
  };
  if (raw.type !== "tahfizh-certificate-layout" || raw.version !== 1) {
    throw new Error("Format file bukan layout sertifikat Tahfizh");
  }

  return normalizeCertificateLayout(raw.layout);
};

export const resetCertificateLayoutCache = () => {
  cachedLayout = null;
};
