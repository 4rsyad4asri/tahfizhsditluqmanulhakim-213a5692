import { beforeEach, describe, expect, it } from "vitest";
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
  });
});
