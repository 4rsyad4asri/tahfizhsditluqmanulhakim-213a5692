import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY,
  getDefaultRaportVisualLayout,
  loadRaportVisualLayout,
  normalizeRaportVisualLayout,
  saveRaportVisualLayout,
} from "./pdfAssetsLayout";

describe("PDF assets layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("stores non-signature assets separately per mode and orientation", () => {
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.leftLogo.x = 25;
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    const tahfizh = getDefaultRaportVisualLayout("landscape");
    tahfizh.assets.qrCode.width = 24;
    saveRaportVisualLayout("Tahfizh", "landscape", tahfizh);

    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.leftLogo.x).toBe(25);
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.qrCode.width).toBe(24);
    expect(window.localStorage.getItem("tahsin-dasar-pdf-assets-layout")).toBeTruthy();
    expect(window.localStorage.getItem("tahfizh-pdf-assets-layout")).toBeTruthy();
  });

  it("shares signature settings across all raport modes without sharing x and y", () => {
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
      x: 70,
      y: 247,
      width: 55,
      height: 23,
      placement: "manual",
      offsetY: 12,
    });
    expect(tahfizh.assets.examinerSignature).toMatchObject({
      x: 124,
      y: 165,
      width: 55,
      height: 23,
      placement: "manual",
      offsetY: 12,
    });
    expect(lanjutan.assets.headmasterSignature).toMatchObject({
      x: 145,
      y: 247,
      width: 48,
      height: 20,
      visible: false,
      offsetY: -7,
    });
    expect(tahfizh.assets.headmasterSignature).toMatchObject({
      x: 222,
      y: 165,
      width: 48,
      height: 20,
      visible: false,
      offsetY: -7,
    });
  });

  it("stores only global signature fields and keeps other visual settings local", () => {
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

    const globalSignature = JSON.parse(
      window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY) || "{}",
    );
    const tahfizh = loadRaportVisualLayout("Tahfizh", "portrait");

    expect(globalSignature.examinerSignature).toEqual({
      visible: true,
      width: 51,
      height: 18,
      placement: "auto",
      offsetY: 0,
    });
    expect(globalSignature.updatedAt).toBe("2026-06-10T12:00:00.000Z");
    expect(globalSignature.updatedFromMode).toBe("Tahsin Dasar");
    expect(globalSignature.updatedFromOrientation).toBe("portrait");
    expect(globalSignature.examinerSignature).not.toHaveProperty("x");
    expect(globalSignature.examinerSignature).not.toHaveProperty("y");
    expect(globalSignature).not.toHaveProperty("leftLogo");
    expect(globalSignature).not.toHaveProperty("qrCode");
    expect(globalSignature).not.toHaveProperty("text");

    expect(tahfizh.assets.leftLogo.width).toBe(17);
    expect(tahfizh.assets.qrCode.visible).toBe(true);
    expect(tahfizh.text).toEqual({ color: "#374151", bold: false });
    expect(tahfizh.assets.examinerSignature.x).toBe(70);
    expect(tahfizh.assets.examinerSignature.y).toBe(247);
    expect(tahfizh.assets.examinerSignature.width).toBe(51);
    vi.useRealTimers();
  });

  it("uses the signature settings from whichever mode was saved last", () => {
    const dasar = getDefaultRaportVisualLayout("portrait");
    dasar.assets.examinerSignature.width = 50;
    dasar.assets.headmasterSignature.visible = false;
    saveRaportVisualLayout("Tahsin Dasar", "portrait", dasar);

    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.examinerSignature.width)
      .toBe(50);
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.headmasterSignature.visible)
      .toBe(false);

    const lanjutan = loadRaportVisualLayout("Tahsin Lanjutan", "portrait");
    lanjutan.assets.examinerSignature.width = 57;
    lanjutan.assets.examinerSignature.placement = "manual";
    lanjutan.assets.headmasterSignature.visible = true;
    saveRaportVisualLayout("Tahsin Lanjutan", "portrait", lanjutan);

    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature.width)
      .toBe(57);
    expect(loadRaportVisualLayout("Tahfizh", "landscape").assets.examinerSignature.placement)
      .toBe("manual");

    const tahfizh = loadRaportVisualLayout("Tahfizh", "landscape");
    tahfizh.assets.examinerSignature.width = 63;
    tahfizh.assets.examinerSignature.offsetY = 9;
    tahfizh.assets.headmasterSignature.height = 25;
    saveRaportVisualLayout("Tahfizh", "landscape", tahfizh);

    const globalSignature = JSON.parse(
      window.localStorage.getItem(GLOBAL_RAPORT_SIGNATURE_LAYOUT_KEY) || "{}",
    );
    expect(globalSignature.updatedFromMode).toBe("Tahfizh");
    expect(globalSignature.updatedFromOrientation).toBe("landscape");
    expect(loadRaportVisualLayout("Tahsin Dasar", "portrait").assets.examinerSignature)
      .toMatchObject({ width: 63, offsetY: 9 });
    expect(loadRaportVisualLayout("Tahsin Lanjutan", "portrait").assets.headmasterSignature.height)
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
});
