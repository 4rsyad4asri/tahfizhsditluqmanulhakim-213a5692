import { describe, expect, it } from "vitest";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  normalizeCertificateLayout,
} from "./certificateLayout";
import { buildCertificateJuzStatements } from "./certificateRenderer";

describe("certificate layout", () => {
  it("keeps the requested default visual hierarchy", () => {
    expect(DEFAULT_CERTIFICATE_LAYOUT.certificateNumber.fontSize).toBe(18);
    expect(DEFAULT_CERTIFICATE_LAYOUT.studentName.fontSize).toBe(48);
    expect(DEFAULT_CERTIFICATE_LAYOUT.className.fontSize).toBe(27);
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
});
