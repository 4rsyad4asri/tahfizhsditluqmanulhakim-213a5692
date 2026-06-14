import jsPDF from "jspdf";
import {
  loadCertificateLayout,
  type CertificateLayout,
} from "@/utils/certificateLayout";
import {
  getCertificatePdfPlacement,
  type CertificatePdfFormat,
} from "@/utils/generateCertificatePDF";
import {
  renderCertificateImage,
  type CertificateData,
} from "@/utils/certificateRenderer";
import { resolveCertificateSignatures } from "@/utils/officialSignatures";
import { formatStudentName } from "@/utils/formatName";

export interface BulkCertificateItem {
  studentName: string;
  className: string;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
  documentNumber?: string | null;
  verificationToken?: string | null;
  verificationUrl?: string;
  assessedBy?: string | null;
  coordinatorName?: string | null;
  principalName?: string | null;
  layoutSnapshot?: CertificateLayout | null;
  layoutOverride?: CertificateLayout | null;
}

export interface BulkCertificatePdfOptions {
  format: CertificatePdfFormat;
  fileName?: string;
}

const addCertificatePage = (
  doc: jsPDF,
  image: string,
  format: CertificatePdfFormat,
  addPage: boolean,
) => {
  const placement = getCertificatePdfPlacement(format);
  if (addPage) {
    doc.addPage([placement.pageWidth, placement.pageHeight], "landscape");
  }
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
};

export const downloadBulkCertificatePDF = async (
  items: BulkCertificateItem[],
  options: BulkCertificatePdfOptions,
) => {
  if (items.length === 0) {
    throw new Error("Tidak ada sertifikat published yang bisa diunduh.");
  }

  const placement = getCertificatePdfPlacement(options.format);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [placement.pageWidth, placement.pageHeight],
  });
  const globalLayout = await loadCertificateLayout();
  const signatureCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveCertificateSignatures>>
  >();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const signatureKey = item.assessedBy || "__default__";
    let signatures = signatureCache.get(signatureKey);
    if (!signatures) {
      signatures = await resolveCertificateSignatures(item.assessedBy);
      signatureCache.set(signatureKey, signatures);
    }

    const layout = item.layoutSnapshot || item.layoutOverride || globalLayout;
    const data: CertificateData = {
      studentName: formatStudentName(item.studentName),
      className: item.className,
      juz: item.juz,
      nilaiAkhir: item.nilaiAkhir,
      predikat: item.predikat,
      tanggal: item.tanggal,
      nomorSertifikat: item.nomorSertifikat,
      documentNumber: item.documentNumber || undefined,
      verificationToken: item.verificationToken,
      verificationUrl: item.verificationUrl,
      coordinatorName: item.coordinatorName || signatures.coordinatorName,
      principalName: item.principalName || undefined,
      coordinatorSignatureDataUrl: signatures.coordinatorSignatureDataUrl,
      principalSignatureDataUrl: signatures.principalSignatureDataUrl,
    };
    const image = await renderCertificateImage(data, layout);
    addCertificatePage(doc, image, options.format, index > 0);
  }

  doc.save(options.fileName || "Sertifikat_Tahfizh_Terfilter.pdf");
};
