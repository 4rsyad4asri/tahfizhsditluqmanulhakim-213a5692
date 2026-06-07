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

export type { CertificateData } from "./certificateRenderer";

const PDF_HEIGHT_MM = 210;
const PDF_WIDTH_MM = PDF_HEIGHT_MM * (CERTIFICATE_WIDTH / CERTIFICATE_HEIGHT);

export const safeFileName = (name: string) =>
  String(name || "Siswa")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");

export const buildCertificatePDF = async (
  data: CertificateData,
  layoutOverride?: CertificateLayout,
): Promise<jsPDF> => {
  const layout = layoutOverride ?? await loadCertificateLayout();
  const image = await renderCertificateImage(data, layout);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PDF_WIDTH_MM, PDF_HEIGHT_MM],
  });
  doc.addImage(
    image,
    "PNG",
    0,
    0,
    doc.internal.pageSize.getWidth(),
    doc.internal.pageSize.getHeight(),
    undefined,
    "FAST",
  );
  return doc;
};

export const downloadCertificatePDF = async (data: CertificateData) => {
  const doc = await buildCertificatePDF(data);
  doc.save(`Sertifikat_${safeFileName(data.studentName)}.pdf`);
};

export const generateCertificateBlobUrl = async (
  data: CertificateData,
): Promise<string> => {
  const doc = await buildCertificatePDF(data);
  return URL.createObjectURL(doc.output("blob"));
};

export const generateCertificatePDF = downloadCertificatePDF;
