import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySharedRaportSignatureLayout,
  GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY,
  getDefaultRaportVisualLayout,
  loadRaportVisualLayout,
  normalizeRaportVisualLayout,
  saveRaportVisualLayout,
  syncGlobalRaportSignatureLayout,
} from "./pdfAssetsLayout";

const maybeSingle = vi.fn();
const upsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-id" } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
    })),
  },
}));

describe("PDF assets layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    maybeSingle.mockReset();
    upsert.mockReset();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    upsert.mockResolvedValue({ error: null });
  });

  it("provides A4 defaults for portrait and landscape", () => {
    const portrait = getDefaultRaportVisualLayout("portrait");
    const landscape = getDefaultRaportVisualLayout("landscape");

    expect(portrait.assets.rightLogo.x + portrait.assets.rightLogo.width).toBeLessThanOrEqual(210);
    expect(landscape.assets.rightLogo.x + landscape.assets.rightLogo.width).toBeLessThanOrEqual(297);
    expect(portrait.assets.qrCode.visible).toBe(true);
    expect(landscape.text.color).toBe("#374151");
    expect(portrait.assets.examinerSignature.placement).toBe("auto");
    expect(landscape.assets.headmasterSignature.placement).toBe("auto");
  });

  it("keeps resized assets inside the A4 page", () => {
    const normalized = normalizeRaportVisualLayout({
      assets: {
        leftLogo: {
          x: 999,
          y: 999,
          width: 30,
          height: 30,
          visible: true,
        },
      },
    }, "portrait");

    expect(normalized.assets.leftLogo.x).toBe(180);
    expect(normalized.assets.leftLogo.y).toBe(267);
  });

  it("normalizes signature auto placement and offset", () => {
    const normalized = normalizeRaportVisualLayout({
      assets: {
        examinerSignature: {
          x: 80,
          y: 240,
          width: 42,
          height: 18,
          visible: true,
          placement: "auto",
          offsetY: 120,
        },
      },
    }, "portrait");

    expect(normalized.assets.examinerSignature.placement).toBe("auto");
    expect(normalized.assets.examinerSignature.offsetY).toBe(80);
  });

  it("shares global assets across modes for the same orientation", () => {
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.leftLogo.x = 25;
    dasar.assets.rightLogo.width = 23;
    dasar.assets.qrCode.visible = false;
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.leftLogo.x).toBe(25);
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.leftLogo.x).toBe(25);
    expect(loadRaportVisualLayout("Tahfizh", "portrait").assets.rightLogo.width).toBe(23);
    expect(loadRaportVisualLayout("Tahfizh", "portrait").assets.qrCode.visible).toBe(false);
    expect(window.localStorage.getItem("tahsin-dasar-pdf-assets-layout")).toBeTruthy();
  });

  it("shares signatures across modes while keeping orientations separate", () => {
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.examinerSignature = {
      ...dasar.assets.examinerSignature,
      x: 82,
      y: 230,
      width: 55,
      height: 23,
      placement: "manual",
      offsetY: 12,
    };
    dasar.assets.headmasterSignature = {
      ...dasar.assets.headmasterSignature,
      x: 151,
      y: 235,
      width: 48,
      height: 20,
      visible: false,
      offsetY: -7,
    };
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    const lanjutan = loadRaportVisualLayout("Tahsin Lanjutan", "portrait");
    const tahfizh = loadRaportVisualLayout("Tahfizh", "landscape");

    expect(lanjutan.assets.examinerSignature).toMatchObject({
      x: 82,
      y: 230,
      width: 55,
      height: 23,
      placement: "manual",
      offsetY: 12,
    });
    expect(tahfizh.assets.examinerSignature).toMatchObject({
      x: 124,
      y: 165,
      width: 42,
      height: 18,
      placement: "auto",
      offsetY: 0,
    });
    expect(lanjutan.assets.headmasterSignature).toMatchObject({
      x: 151,
      y: 235,
      width: 48,
      height: 20,
      visible: false,
      offsetY: -7,
    });
    expect(tahfizh.assets.headmasterSignature).toMatchObject({
      x: 222,
      y: 165,
      width: 42,
      height: 18,
      visible: true,
      offsetY: 0,
    });
  });

  it("stores all global assets per orientation and keeps text settings local", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.leftLogo.width = 28;
    dasar.assets.qrCode.visible = false;
    dasar.assets.examinerSignature.x = 91;
    dasar.assets.examinerSignature.y = 229;
    dasar.assets.examinerSignature.width = 51;
    dasar.text = { color: "#123456", bold: true };
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    const globalAssets = JSON.parse(
      window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY) || "{}",
    );
    const tahfizh = loadRaportVisualLayout("Tahfizh", "portrait");

    expect(globalAssets.portrait.examinerSignature).toMatchObject({
      x: 91,
      y: 229,
      width: 51,
    });
    expect(globalAssets.portrait.leftLogo.width).toBe(28);
    expect(globalAssets.portrait.qrCode.visible).toBe(false);
    expect(globalAssets.landscape.leftLogo.width).toBe(17);
    expect(globalAssets.updatedAt).toBe("2026-06-10T12:00:00.000Z");
    expect(globalAssets.updatedFromMode).toBe("Tahsin Dasar");
    expect(globalAssets.updatedFromOrientation).toBe("portrait");
    expect(globalAssets).not.toHaveProperty("text");

    expect(tahfizh.assets.leftLogo.width).toBe(28);
    expect(tahfizh.assets.qrCode.visible).toBe(false);
    expect(tahfizh.text).toEqual({ color: "#374151", bold: false });
    expect(tahfizh.assets.examinerSignature.x).toBe(91);
    expect(tahfizh.assets.examinerSignature.y).toBe(229);
    expect(tahfizh.assets.examinerSignature.width).toBe(51);
    vi.useRealTimers();
  });

  it("uses the latest global assets saved for each orientation", () => {
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.examinerSignature.width = 50;
    dasar.assets.headmasterSignature.visible = false;
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.examinerSignature.width)
      .toBe(50);
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.headmasterSignature.visible)
      .toBe(true);

    const lanjutan = loadRaportVisualLayout("Tahsin Lanjutan", "portrait");
    lanjutan.assets.examinerSignature.width = 57;
    lanjutan.assets.examinerSignature.placement = "manual";
    lanjutan.assets.headmasterSignature.visible = true;
    saveRaportVisualLayout("Tahsin Lanjutan", "portrait", lanjutan);

    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature.width)
      .toBe(57);
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.examinerSignature.placement)
      .toBe("auto");

    const tahfizh = loadRaportVisualLayout("Tahfizh", "landscape");
    tahfizh.assets.examinerSignature.width = 63;
    tahfizh.assets.examinerSignature.offsetY = 9;
    tahfizh.assets.headmasterSignature.height = 25;
    saveRaportVisualLayout("Tahfizh", "landscape", tahfizh);

    const globalAssets = JSON.parse(
      window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY) || "{}",
    );
    expect(globalAssets.updatedFromMode).toBe("Tahfizh");
    expect(globalAssets.updatedFromOrientation).toBe("landscape");
    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature)
      .toMatchObject({ width: 57, placement: "manual" });
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.headmasterSignature.height)
      .toBe(18);
    expect(loadRaportVisualLayout("Tahsin Dasar", "landscape").assets.examinerSignature)
      .toMatchObject({ width: 63, offsetY: 9 });
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "landscape").assets.headmasterSignature.height)
      .toBe(25);
  });

  it("falls back to legacy signature settings from the current mode", () => {
    const legacy = getDefaultRaportVisualLayout("portrait");
    legacy.assets.examinerSignature.width = 54;
    legacy.assets.headmasterSignature.height = 22;
    window.localStorage.setItem(
      "tahsin-lanjutan-pdf-assets-layout",
      JSON.stringify({ portrait: legacy }),
    );

    const loaded = loadRaportVisualLayout("Tahsin Lanjutan", "portrait");

    expect(loaded.assets.examinerSignature.width).toBe(54);
    expect(loaded.assets.headmasterSignature.height).toBe(22);
    expect(window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY)).toBeNull();
  });

  it("falls back to another legacy mode when the current mode has no saved layout", () => {
    const legacy = getDefaultRaportVisualLayout("landscape");
    legacy.assets.examinerSignature.width = 59;
    legacy.assets.headmasterSignature.visible = false;
    window.localStorage.setItem(
      "tahfizh-pdf-assets-layout",
      JSON.stringify({ landscape: legacy }),
    );

    const loaded = loadRaportVisualLayout("Tahsin Dasar", "portrait");

    expect(loaded.assets.examinerSignature).toMatchObject({
      x: 70,
      y: 247,
      width: 59,
    });
    expect(loaded.assets.headmasterSignature).toMatchObject({
      x: 145,
      y: 247,
      visible: false,
    });
  });

  it("ignores an invalid global value and keeps legacy signatures", () => {
    const legacy = getDefaultRaportVisualLayout("portrait");
    legacy.assets.examinerSignature.width = 56;
    window.localStorage.setItem(
      "tahsin-dasar-pdf-assets-layout",
      JSON.stringify({ portrait: legacy }),
    );
    window.localStorage.setItem(
      GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY,
      JSON.stringify({ updatedAt: "invalid-without-signatures" }),
    );

    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature.width)
      .toBe(56);
  });

  it("syncs the shared Supabase signature layout into the local cache", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        value: {
          updatedAt: "2026-06-10T13:00:00.000Z",
          updatedFromMode: "Tahfizh",
          updatedFromOrientation: "landscape",
          examinerSignature: {
            visible: true,
            width: 61,
            height: 21,
            placement: "auto",
            offsetY: 4,
          },
          headmasterSignature: {
            visible: false,
            width: 49,
            height: 19,
            placement: "manual",
            offsetY: -3,
          },
        },
      },
      error: null,
    });

    expect(await syncGlobalRaportSignatureLayout()).toBe(true);
    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature)
      .toMatchObject({ x: 70, y: 247, width: 61, offsetY: 4 });
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.headmasterSignature)
      .toMatchObject({ x: 145, y: 247, visible: false, placement: "manual" });
  });

  it("applies realtime shared values without replacing local x and y", () => {
    expect(applySharedRaportSignatureLayout({
      examinerSignature: {
        visible: true,
        width: 58,
        height: 20,
        placement: "auto",
        offsetY: 2,
      },
      headmasterSignature: {
        visible: true,
        width: 50,
        height: 20,
        placement: "auto",
        offsetY: 0,
      },
    })).toBe(true);

    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.examinerSignature)
      .toMatchObject({ x: 124, y: 165, width: 58 });
  });

  it("syncs orientation-specific global logos and QR settings", async () => {
    const portrait = getDefaultRaportVisualLayout("portrait").assets;
    const landscape = getDefaultRaportVisualLayout("landscape").assets;
    maybeSingle.mockResolvedValue({
      data: {
        value: {
          portrait: {
            ...portrait,
            leftLogo: { ...portrait.leftLogo, x: 22, width: 24 },
          },
          landscape: {
            ...landscape,
            rightLogo: { ...landscape.rightLogo, x: 260, width: 20 },
            qrCode: { ...landscape.qrCode, visible: false },
          },
          updatedAt: "2026-06-11T00:00:00.000Z",
          updatedFromMode: "Tahfizh",
          updatedFromOrientation: "landscape",
        },
      },
      error: null,
    });

    expect(await syncGlobalRaportSignatureLayout()).toBe(true);
    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.leftLogo)
      .toMatchObject({ x: 22, width: 24 });
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "landscape").assets.rightLogo)
      .toMatchObject({ x: 260, width: 20 });
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.qrCode.visible)
      .toBe(false);
  });
});
