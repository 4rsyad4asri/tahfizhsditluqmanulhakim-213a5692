import { describe, expect, it } from "vitest";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  exportCertificateLayout,
  importCertificateLayout,
  normalizeCertificateLayout,
} from "./certificateLayout";
import { buildCertificateJuzStatements } from "./certificateRenderer";
import { getCertificatePdfPlacement } from "./generateCertificatePDF";

describe("certificate layout", () => {
  it("keeps the requested default visual hierarchy", () => {
    expect(DEFAULT_CERTIFICATE_LAYOUT.certificateNumber.fontSize).toBe(18);
    expect(DEFAULT_CERTIFICATE_LAYOUT.studentName.fontSize).toBe(48);
    expect(DEFAULT_CERTIFICATE_LAYOUT.className.fontSize).toBe(27);
    expect(DEFAULT_CERTIFICATE_LAYOUT.date.fontSize).toBe(19);
    expect(DEFAULT_CERTIFICATE_LAYOUT.studentName.fontWeight).toBe(700);
  });

  it("normalizes unsafe layout values", () => {
    const layout = normalizeCertificateLayout({
      studentName: {
        ...DEFAULT_CERTIFICATE_LAYOUT.studentName,
        x: -200,
        fontSize: 500,
        color: "invalid",
      },
    });

    expect(layout.studentName.x).toBe(0);
    expect(layout.studentName.fontSize).toBe(96);
    expect(layout.studentName.color).toBe(DEFAULT_CERTIFICATE_LAYOUT.studentName.color);
  });

  it("keeps arbitrary Juz lists inside one Indonesian sentence", () => {
    const statements = buildCertificateJuzStatements("30, 29, 28, 27, 1, 2");

    expect(statements.english).not.toContain("Juz");
    expect(statements.indonesian).toBe(
      "Lulus sertifikasi Tahfizh Al-Qur'an Juz 30, 29, 28, 27, 1, 2 dengan hasil:",
    );
  });

  it("places the certificate on A4 landscape without stretching it", () => {
    const placement = getCertificatePdfPlacement("a4-landscape");

    expect(placement.pageWidth).toBe(297);
    expect(placement.pageHeight).toBe(210);
    expect(placement.imageX).toBeGreaterThanOrEqual(5);
    expect(placement.imageY).toBeGreaterThanOrEqual(5);
    expect(placement.imageWidth / placement.imageHeight).toBeCloseTo(4 / 3, 5);
  });

  it("exports and imports a portable admin layout file", () => {
    const exported = exportCertificateLayout(DEFAULT_CERTIFICATE_LAYOUT);
    const imported = importCertificateLayout(JSON.parse(exported));

    expect(imported).toEqual(DEFAULT_CERTIFICATE_LAYOUT);
  });
});
