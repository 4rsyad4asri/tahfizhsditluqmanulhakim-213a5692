import jsPDF from "jspdf";
import {
  loadCertificateLayout,
  type CertificateLayout,
} from "./certificateLayout";
import {
  renderCertificateImage,
  type CertificateData,
} from "./certificateRenderer";

export type { CertificateData } from "./certificateRenderer";

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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addImage(image, "PNG", 0, 0, 297, 210, undefined, "FAST");
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
