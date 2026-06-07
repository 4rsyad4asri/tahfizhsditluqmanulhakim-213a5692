import type { Orientation, RaportMode } from "@/utils/raportPdf";

export interface PdfAssetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface PdfAssetsLayout {
  leftLogo: PdfAssetPosition;
  rightLogo: PdfAssetPosition;
  examinerSignature: PdfAssetPosition;
  headmasterSignature: PdfAssetPosition;
  qrCode: PdfAssetPosition;
}

export interface PdfTextLayout {
  color: string;
  bold: boolean;
}

export interface RaportVisualLayout {
  assets: PdfAssetsLayout;
  text: PdfTextLayout;
}

export const PDF_PAGE_SIZE: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 },
};

const STORAGE_KEYS: Record<RaportMode, string> = {
  "Tahsin Dasar": "tahsin-dasar-pdf-assets-layout",
  "Tahsin Lanjutan": "tahsin-lanjutan-pdf-assets-layout",
  Tahfizh: "tahfizh-pdf-assets-layout",
};

const createAsset = (
  x: number,
  y: number,
  width: number,
  height: number,
): PdfAssetPosition => ({ x, y, width, height, visible: true });

export const getDefaultRaportVisualLayout = (
  orientation: Orientation,
): RaportVisualLayout => {
  if (orientation === "portrait") {
    return {
      assets: {
        leftLogo: createAsset(10, 10, 17, 17),
        rightLogo: createAsset(183, 10, 17, 17),
        examinerSignature: createAsset(70, 247, 42, 18),
        headmasterSignature: createAsset(145, 247, 42, 18),
        qrCode: createAsset(184, 35, 16, 16),
      },
      text: { color: "#374151", bold: false },
    };
  }

  return {
    assets: {
      leftLogo: createAsset(10, 10, 17, 17),
      rightLogo: createAsset(270, 10, 17, 17),
      examinerSignature: createAsset(124, 165, 42, 18),
      headmasterSignature: createAsset(222, 165, 42, 18),
      qrCode: createAsset(271, 35, 16, 16),
    },
    text: { color: "#374151", bold: false },
  };
};

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const normalizeAsset = (
  value: unknown,
  fallback: PdfAssetPosition,
  pageWidth: number,
  pageHeight: number,
): PdfAssetPosition => {
  const raw = value && typeof value === "object"
    ? value as Partial<PdfAssetPosition>
    : {};
  const width = clamp(raw.width, fallback.width, 4, pageWidth);
  const height = clamp(raw.height, fallback.height, 4, pageHeight);

  return {
    x: clamp(raw.x, fallback.x, 0, Math.max(0, pageWidth - width)),
    y: clamp(raw.y, fallback.y, 0, Math.max(0, pageHeight - height)),
    width,
    height,
    visible: typeof raw.visible === "boolean" ? raw.visible : fallback.visible,
  };
};

export const normalizeRaportVisualLayout = (
  value: unknown,
  orientation: Orientation,
): RaportVisualLayout => {
  const fallback = getDefaultRaportVisualLayout(orientation);
  const page = PDF_PAGE_SIZE[orientation];
  const raw = value && typeof value === "object"
    ? value as Partial<RaportVisualLayout>
    : {};
  const assets = raw.assets && typeof raw.assets === "object"
    ? raw.assets as Partial<PdfAssetsLayout>
    : {};
  const text = raw.text && typeof raw.text === "object"
    ? raw.text as Partial<PdfTextLayout>
    : {};

  return {
    assets: {
      leftLogo: normalizeAsset(assets.leftLogo, fallback.assets.leftLogo, page.width, page.height),
      rightLogo: normalizeAsset(assets.rightLogo, fallback.assets.rightLogo, page.width, page.height),
      examinerSignature: normalizeAsset(
        assets.examinerSignature,
        fallback.assets.examinerSignature,
        page.width,
        page.height,
      ),
      headmasterSignature: normalizeAsset(
        assets.headmasterSignature,
        fallback.assets.headmasterSignature,
        page.width,
        page.height,
      ),
      qrCode: normalizeAsset(assets.qrCode, fallback.assets.qrCode, page.width, page.height),
    },
    text: {
      color: typeof text.color === "string" && /^#[0-9a-f]{6}$/i.test(text.color)
        ? text.color
        : fallback.text.color,
      bold: typeof text.bold === "boolean" ? text.bold : fallback.text.bold,
    },
  };
};

export const loadRaportVisualLayout = (
  mode: RaportMode,
  orientation: Orientation,
): RaportVisualLayout => {
  if (typeof window === "undefined") return getDefaultRaportVisualLayout(orientation);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[mode]);
    if (!raw) return getDefaultRaportVisualLayout(orientation);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const orientationLayout = parsed?.[orientation] ?? parsed;
    return normalizeRaportVisualLayout(orientationLayout, orientation);
  } catch {
    return getDefaultRaportVisualLayout(orientation);
  }
};

export const saveRaportVisualLayout = (
  mode: RaportMode,
  orientation: Orientation,
  value: RaportVisualLayout,
) => {
  const layout = normalizeRaportVisualLayout(value, orientation);
  if (typeof window !== "undefined") {
    let current: Record<string, unknown> = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS[mode]);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") current = parsed;
      }
    } catch {
      current = {};
    }
    window.localStorage.setItem(
      STORAGE_KEYS[mode],
      JSON.stringify({ ...current, [orientation]: layout }),
    );
  }
  return layout;
};
