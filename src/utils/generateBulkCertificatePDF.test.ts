import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CERTIFICATE_LAYOUT } from "./certificateLayout";

const mocks = vi.hoisted(() => ({
  addPage: vi.fn(),
  addImage: vi.fn(),
  rect: vi.fn(),
  save: vi.fn(),
  setFillColor: vi.fn(),
  renderCertificateImage: vi.fn(),
  resolveCertificateSignatures: vi.fn(),
  loadCertificateLayout: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: vi.fn(() => ({
    addPage: mocks.addPage,
    addImage: mocks.addImage,
    rect: mocks.rect,
    save: mocks.save,
    setFillColor: mocks.setFillColor,
  })),
}));

vi.mock("./certificateLayout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./certificateLayout")>();
  return {
    ...actual,
    loadCertificateLayout: mocks.loadCertificateLayout,
  };
});

vi.mock("./certificateRenderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./certificateRenderer")>();
  return {
    ...actual,
    renderCertificateImage: mocks.renderCertificateImage,
  };
});

vi.mock("./officialSignatures", () => ({
  resolveCertificateSignatures: mocks.resolveCertificateSignatures,
}));

import { downloadBulkCertificatePDF } from "./generateBulkCertificatePDF";

describe("bulk certificate PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCertificateLayout.mockResolvedValue(DEFAULT_CERTIFICATE_LAYOUT);
    mocks.renderCertificateImage
      .mockResolvedValueOnce("image-1")
      .mockResolvedValueOnce("image-2")
      .mockResolvedValueOnce("image-3");
    mocks.resolveCertificateSignatures.mockResolvedValue({
      coordinatorName: "Koordinator",
      coordinatorSignatureDataUrl: "coordinator-signature",
      principalSignatureDataUrl: "principal-signature",
      leftLogoDataUrl: "left-logo",
      rightLogoDataUrl: "right-logo",
    });
  });

  it("uses one page per student, layout priority, and cached signatures", async () => {
    const snapshot = {
      ...DEFAULT_CERTIFICATE_LAYOUT,
      studentName: { ...DEFAULT_CERTIFICATE_LAYOUT.studentName, fontSize: 40 },
    };
    const override = {
      ...DEFAULT_CERTIFICATE_LAYOUT,
      studentName: { ...DEFAULT_CERTIFICATE_LAYOUT.studentName, fontSize: 55 },
    };
    const baseItem = {
      className: "VI A",
      juz: "30",
      nilaiAkhir: 95,
      predikat: "Mumtaz",
      tanggal: "2026-06-14",
      nomorSertifikat: "001",
      assessedBy: "coordinator-id",
    };

    await downloadBulkCertificatePDF(
      [
        { ...baseItem, studentName: "Siswa A", layoutSnapshot: snapshot },
        { ...baseItem, studentName: "Siswa B", layoutOverride: override },
        { ...baseItem, studentName: "Siswa C", assessedBy: null },
      ],
      { format: "a4-landscape", fileName: "massal.pdf" },
    );

    expect(mocks.renderCertificateImage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ studentName: "Siswa A" }),
      snapshot,
    );
    expect(mocks.renderCertificateImage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ studentName: "Siswa B" }),
      override,
    );
    expect(mocks.renderCertificateImage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ studentName: "Siswa C" }),
      DEFAULT_CERTIFICATE_LAYOUT,
    );
    expect(mocks.resolveCertificateSignatures).toHaveBeenCalledTimes(2);
    expect(mocks.addPage).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenCalledTimes(3);
    expect(mocks.save).toHaveBeenCalledWith("massal.pdf");
  });
});
