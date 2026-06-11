import { supabase } from "@/integrations/supabase/client";
import type { Orientation, RaportMode } from "@/utils/raportPdf";

export interface PdfAssetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  placement?: "manual" | "auto";
  offsetY?: number;
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

type GlobalRaportOrientationAssets = Pick<
  PdfAssetsLayout,
  "leftLogo" | "rightLogo" | "examinerSignature" | "headmasterSignature" | "qrCode"
>;

type LegacyRaportSignatureSettings = {
  examinerSignature?: Partial<PdfAssetPosition>;
  headmasterSignature?: Partial<PdfAssetPosition>;
};

export type GlobalRaportAssetsLayout = {
  portrait?: GlobalRaportOrientationAssets;
  landscape?: GlobalRaportOrientationAssets;
  updatedAt: string;
  updatedFromMode: RaportMode;
  updatedFromOrientation: Orientation;
};

export type GlobalRaportSignatureLayout = GlobalRaportAssetsLayout;

export const PDF_PAGE_SIZE: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 },
};

export const GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY = "raport-global-signature-layout-v1";
export const GLOBAL_RAPORT_SIGNATURE_SETTINGS_ID = "raport-global-signature-layout-v1";

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
  placement: PdfAssetPosition["placement"] = "manual",
  offsetY = 0,
): PdfAssetPosition => ({ x, y, width, height, visible: true, placement, offsetY });

export const getDefaultRaportVisualLayout = (
  orientation: Orientation,
): RaportVisualLayout => {
  if (orientation === "portrait") {
    return {
      assets: {
        leftLogo: createAsset(10, 10, 17, 17),
        rightLogo: createAsset(183, 10, 17, 17),
        examinerSignature: createAsset(70, 247, 42, 18, "auto"),
        headmasterSignature: createAsset(145, 247, 42, 18, "auto"),
        qrCode: createAsset(184, 35, 16, 16),
      },
      text: { color: "#374151", bold: false },
    };
  }

  return {
    assets: {
      leftLogo: createAsset(10, 10, 17, 17),
      rightLogo: createAsset(270, 10, 17, 17),
      examinerSignature: createAsset(124, 165, 42, 18, "auto"),
      headmasterSignature: createAsset(222, 165, 42, 18, "auto"),
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
    placement: raw.placement === "auto" || raw.placement === "manual"
      ? raw.placement
      : fallback.placement,
    offsetY: clamp(raw.offsetY, fallback.offsetY ?? 0, -80, 80),
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

const toGlobalAssetsLayout = (
  layout: RaportVisualLayout,
): GlobalRaportOrientationAssets => ({
  leftLogo: { ...layout.assets.leftLogo },
  rightLogo: { ...layout.assets.rightLogo },
  examinerSignature: { ...layout.assets.examinerSignature },
  headmasterSignature: { ...layout.assets.headmasterSignature },
  qrCode: { ...layout.assets.qrCode },
});

const getStoredOrientationLayout = (
  parsed: Record<string, unknown>,
  orientation: Orientation,
  allowAlternateOrientation = false,
) => parsed?.[orientation] ??
  (allowAlternateOrientation
    ? parsed?.portrait ?? parsed?.landscape ?? parsed
    : parsed);

const hasStoredSignatureSettings = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const assets = (value as Partial<RaportVisualLayout>).assets;
  if (!assets || typeof assets !== "object") return false;

  return ["examinerSignature", "headmasterSignature"].some((key) => {
    const signature = (assets as Record<string, unknown>)[key];
    return signature && typeof signature === "object";
  });
};

const hasAssetObject = (value: unknown) =>
  Boolean(value && typeof value === "object");

const hasGlobalAssetsSettings = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Record<string, unknown>;
  const hasOrientation = ["portrait", "landscape"].some((orientation) => {
    const assets = parsed[orientation];
    if (!assets || typeof assets !== "object") return false;
    return ["leftLogo", "rightLogo", "examinerSignature", "headmasterSignature", "qrCode"]
      .some((key) => hasAssetObject((assets as Record<string, unknown>)[key]));
  });
  const hasLegacySignature = ["examinerSignature", "headmasterSignature"]
    .some((key) => hasAssetObject(parsed[key]));
  return hasOrientation || hasLegacySignature;
};

const cacheGlobalRaportSignatureLayout = (value: unknown) => {
  if (typeof window === "undefined" || !value || typeof value !== "object") return false;
  if (!hasGlobalAssetsSettings(value)) return false;

  window.localStorage.setItem(
    GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY,
    JSON.stringify(value),
  );
  return true;
};

export const applySharedRaportSignatureLayout = (value: unknown) =>
  cacheGlobalRaportSignatureLayout(value);

export const syncGlobalRaportSignatureLayout = async () => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("id", GLOBAL_RAPORT_SIGNATURE_SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.value ? cacheGlobalRaportSignatureLayout(data.value) : false;
};

const loadStoredModeLayout = (
  mode: RaportMode,
  orientation: Orientation,
  allowAlternateOrientation = false,
): { layout: RaportVisualLayout; hasStoredLayout: boolean; rawLayout?: unknown } => {
  const fallback = getDefaultRaportVisualLayout(orientation);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[mode]);
    if (!raw) return { layout: fallback, hasStoredLayout: false };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { layout: fallback, hasStoredLayout: false };
    }

    const rawLayout = getStoredOrientationLayout(
      parsed as Record<string, unknown>,
      orientation,
      allowAlternateOrientation,
    );
    return {
      layout: normalizeRaportVisualLayout(rawLayout, orientation),
      hasStoredLayout: true,
      rawLayout,
    };
  } catch {
    return { layout: fallback, hasStoredLayout: false };
  }
};

const getLegacyGlobalSignatures = (value: unknown): LegacyRaportSignatureSettings => {
  if (!value || typeof value !== "object") return {};
  const parsed = value as Record<string, unknown>;
  return {
    examinerSignature: hasAssetObject(parsed.examinerSignature)
      ? parsed.examinerSignature as Partial<PdfAssetPosition>
      : undefined,
    headmasterSignature: hasAssetObject(parsed.headmasterSignature)
      ? parsed.headmasterSignature as Partial<PdfAssetPosition>
      : undefined,
  };
};

const toOrientationSafeSignature = (
  asset: PdfAssetPosition,
): Partial<PdfAssetPosition> => ({
  visible: asset.visible,
  width: asset.width,
  height: asset.height,
  placement: asset.placement,
  offsetY: asset.offsetY,
});

const getGlobalOrientationAssets = (
  value: unknown,
  orientation: Orientation,
): Partial<GlobalRaportOrientationAssets> | null => {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  const orientationValue = parsed[orientation];
  if (orientationValue && typeof orientationValue === "object") {
    return orientationValue as Partial<GlobalRaportOrientationAssets>;
  }

  const legacy = getLegacyGlobalSignatures(value);
  return legacy.examinerSignature || legacy.headmasterSignature
    ? legacy as Partial<GlobalRaportOrientationAssets>
    : null;
};

const loadGlobalRaportAssetsLayout = (
  mode: RaportMode,
  orientation: Orientation,
  baseLayout: RaportVisualLayout,
  baseRawLayout?: unknown,
): Partial<GlobalRaportOrientationAssets> => {
  try {
    const raw = window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const globalAssets = getGlobalOrientationAssets(parsed, orientation);
      if (!globalAssets) throw new Error("Invalid global assets layout");
      return globalAssets;
    }
  } catch {
    // Continue to legacy per-mode storage fallback.
  }

  if (hasStoredSignatureSettings(baseRawLayout)) {
    return {
      examinerSignature: baseLayout.assets.examinerSignature,
      headmasterSignature: baseLayout.assets.headmasterSignature,
    };
  }

  const otherModes = (Object.keys(STORAGE_KEYS) as RaportMode[])
    .filter((candidateMode) => candidateMode !== mode);
  for (const candidateMode of otherModes) {
    const candidate = loadStoredModeLayout(candidateMode, orientation, true);
    if (candidate.hasStoredLayout && hasStoredSignatureSettings(candidate.rawLayout)) {
      return {
        examinerSignature: toOrientationSafeSignature(
          candidate.layout.assets.examinerSignature,
        ),
        headmasterSignature: toOrientationSafeSignature(
          candidate.layout.assets.headmasterSignature,
        ),
      };
    }
  }

  return {};
};

const applyGlobalAssetsLayout = (
  baseLayout: RaportVisualLayout,
  globalAssets: Partial<GlobalRaportOrientationAssets>,
  orientation: Orientation,
): RaportVisualLayout => normalizeRaportVisualLayout({
  ...baseLayout,
  assets: {
    ...baseLayout.assets,
    ...Object.fromEntries(
      Object.entries(globalAssets)
        .filter(([, asset]) => asset && typeof asset === "object")
        .map(([key, asset]) => [
          key,
          {
            ...baseLayout.assets[key as keyof PdfAssetsLayout],
            ...asset,
          },
        ]),
    ),
  },
}, orientation);

export const loadRaportVisualLayout = (
  mode: RaportMode,
  orientation: Orientation,
): RaportVisualLayout => {
  if (typeof window === "undefined") return getDefaultRaportVisualLayout(orientation);

  const stored = loadStoredModeLayout(mode, orientation);
  const globalAssets = loadGlobalRaportAssetsLayout(
    mode,
    orientation,
    stored.layout,
    stored.rawLayout,
  );
  return applyGlobalAssetsLayout(stored.layout, globalAssets, orientation);
};

export const saveRaportVisualLayout = (
  mode: RaportMode,
  orientation: Orientation,
  value: RaportVisualLayout,
): Promise<RaportVisualLayout> => {
  const layout = normalizeRaportVisualLayout(value, orientation);
  let currentGlobal: Record<string, unknown> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") currentGlobal = parsed;
      }
    } catch {
      currentGlobal = {};
    }
  }

  const legacySignatures = getLegacyGlobalSignatures(currentGlobal);
  const buildPreservedOrientation = (
    targetOrientation: Orientation,
  ): GlobalRaportOrientationAssets => {
    const defaults = getDefaultRaportVisualLayout(targetOrientation);
    return toGlobalAssetsLayout(normalizeRaportVisualLayout({
      ...defaults,
      assets: {
        ...defaults.assets,
        examinerSignature: {
          ...defaults.assets.examinerSignature,
          ...legacySignatures.examinerSignature,
        },
        headmasterSignature: {
          ...defaults.assets.headmasterSignature,
          ...legacySignatures.headmasterSignature,
        },
      },
    }, targetOrientation));
  };
  const globalAssets = {
    portrait: orientation === "portrait"
      ? toGlobalAssetsLayout(layout)
      : getGlobalOrientationAssets(currentGlobal, "portrait") ??
        buildPreservedOrientation("portrait"),
    landscape: orientation === "landscape"
      ? toGlobalAssetsLayout(layout)
      : getGlobalOrientationAssets(currentGlobal, "landscape") ??
        buildPreservedOrientation("landscape"),
    updatedAt: new Date().toISOString(),
    updatedFromMode: mode,
    updatedFromOrientation: orientation,
  } satisfies GlobalRaportAssetsLayout;

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
    window.localStorage.setItem(
      GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY,
      JSON.stringify(globalAssets),
    );
  }

  return supabase.auth.getUser()
    .then(({ data: userData }) => supabase
      .from("app_settings")
      .upsert({
        id: GLOBAL_RAPORT_SIGNATURE_SETTINGS_ID,
        value: globalAssets,
        updated_by: userData.user?.id || null,
      }))
    .then(({ error }) => {
      if (error) throw error;
      return layout;
    });
};
