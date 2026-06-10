import jsPDF from "jspdf";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  loadCertificateLayout,
  type CertificateLayout,
} from "./certificateLayout";
import {
  renderCertificateImage,
  type CertificateData,
} from "./certificateRenderer";
import { formatStudentName } from "./formatName";

export type { CertificateData } from "./certificateRenderer";

const PDF_HEIGHT_MM = 210;
const PDF_WIDTH_MM = PDF_HEIGHT_MM * (CERTIFICATE_WIDTH / CERTIFICATE_HEIGHT);
const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const A4_PRINT_MARGIN_MM = 5;

export type CertificatePdfFormat = "original" | "a4-landscape";

export interface CertificatePdfPlacement {
  pageWidth: number;
  pageHeight: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
}

export const getCertificatePdfPlacement = (
  format: CertificatePdfFormat,
): CertificatePdfPlacement => {
  if (format === "a4-landscape") {
    const availableWidth = A4_LANDSCAPE_WIDTH_MM - A4_PRINT_MARGIN_MM * 2;
    const availableHeight = A4_LANDSCAPE_HEIGHT_MM - A4_PRINT_MARGIN_MM * 2;
    const certificateRatio = CERTIFICATE_WIDTH / CERTIFICATE_HEIGHT;
    const imageWidth = Math.min(availableWidth, availableHeight * certificateRatio);
    const imageHeight = imageWidth / certificateRatio;

    return {
      pageWidth: A4_LANDSCAPE_WIDTH_MM,
      pageHeight: A4_LANDSCAPE_HEIGHT_MM,
      imageX: (A4_LANDSCAPE_WIDTH_MM - imageWidth) / 2,
      imageY: (A4_LANDSCAPE_HEIGHT_MM - imageHeight) / 2,
      imageWidth,
      imageHeight,
    };
  }

  return {
    pageWidth: PDF_WIDTH_MM,
    pageHeight: PDF_HEIGHT_MM,
    imageX: 0,
    imageY: 0,
    imageWidth: PDF_WIDTH_MM,
    imageHeight: PDF_HEIGHT_MM,
  };
};

export const safeFileName = (name: string) =>
  String(name || "Siswa")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");

export const buildCertificatePDF = async (
  data: CertificateData,
  layoutOverride?: CertificateLayout,
  format: CertificatePdfFormat = "original",
): Promise<jsPDF> => {
  const formattedData = {
    ...data,
    studentName: formatStudentName(data.studentName),
  };
  const layout = layoutOverride ?? await loadCertificateLayout();
  const image = await renderCertificateImage(formattedData, layout);
  const placement = getCertificatePdfPlacement(format);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [placement.pageWidth, placement.pageHeight],
  });
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, placement.pageWidth, placement.pageHeight, "F");
  doc.addImage(
    image,
    "PNG",
    placement.imageX,
    placement.imageY,
    placement.imageWidth,
    placement.imageHeight,
    undefined,
    "FAST",
  );
  return doc;
};

export const downloadCertificatePDF = async (
  data: CertificateData,
  format: CertificatePdfFormat = "original",
) => {
  const doc = await buildCertificatePDF(data, undefined, format);
  doc.save(`Sertifikat_${safeFileName(formatStudentName(data.studentName))}.pdf`);
};

export const generateCertificateBlobUrl = async (
  data: CertificateData,
  format: CertificatePdfFormat = "original",
): Promise<string> => {
  const doc = await buildCertificatePDF(data, undefined, format);
  return URL.createObjectURL(doc.output("blob"));
};

export const generateCertificatePDF = downloadCertificatePDF;
