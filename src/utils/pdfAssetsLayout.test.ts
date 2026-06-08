import { beforeEach, describe, expect, it } from "vitest";
import {
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

  it("stores separate layouts per mode and orientation", () => {
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
});
