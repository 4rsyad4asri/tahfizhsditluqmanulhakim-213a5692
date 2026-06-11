import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAPORT_TABLE_LAYOUT_LANDSCAPE,
  DEFAULT_RAPORT_TABLE_LAYOUT_PORTRAIT,
  normalizeGlobalRaportTableLayout,
  normalizeRaportTableLayout,
} from "@/utils/raportTableLayout";

describe("raport table layout", () => {
  it("uses orientation-specific defaults for old settings", () => {
    expect(normalizeRaportTableLayout(undefined, "landscape")).toEqual(
      DEFAULT_RAPORT_TABLE_LAYOUT_LANDSCAPE,
    );
    expect(normalizeRaportTableLayout(undefined, "portrait")).toEqual(
      DEFAULT_RAPORT_TABLE_LAYOUT_PORTRAIT,
    );
  });

  it("merges partial values and rejects invalid negative spacing", () => {
    const layout = normalizeRaportTableLayout(
      {
        detailBodyFontSize: 8.4,
        cellPaddingX: -2,
        tableMarginLeft: 14,
      },
      "landscape",
    );

    expect(layout.detailBodyFontSize).toBe(8.4);
    expect(layout.cellPaddingX).toBe(0);
    expect(layout.tableMarginLeft).toBe(14);
    expect(layout.tableMarginRight).toBe(
      DEFAULT_RAPORT_TABLE_LAYOUT_LANDSCAPE.tableMarginRight,
    );
  });

  it("keeps portrait and landscape settings separate", () => {
    const settings = normalizeGlobalRaportTableLayout({
      landscape: { detailBodyFontSize: 9 },
      portrait: { detailBodyFontSize: 6 },
      applyToAllExamTypes: true,
    });

    expect(settings.landscape.detailBodyFontSize).toBe(9);
    expect(settings.portrait.detailBodyFontSize).toBe(6);
    expect(settings.applyToAllExamTypes).toBe(true);
  });
});
