import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface CertificateData {
  studentName: string;
  className: string;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
  verificationToken?: string | null;
  verificationUrl?: string;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const CENTER_X = PAGE_WIDTH / 2;
const TEMPLATE_PATH = "/certificate-template-tahfizh.png";

const NAVY: [number, number, number] = [7, 35, 70];
const GOLD: [number, number, number] = [178, 102, 8];
const DARK_GREEN: [number, number, number] = [6, 84, 75];
const BODY: [number, number, number] = [55, 58, 64];

let certificateTemplatePromise: Promise<string> | null = null;

const safeText = (value: unknown, fallback = "-") => {
  if (value === undefined || value === null) return fallback;

  const text = String(value).trim();
  return text || fallback;
};

const safeDate = (value: string) => {
  const rawValue = safeText(value, "");
  if (!rawValue) return "-";

  const d = new Date(rawValue);

  if (isNaN(d.getTime())) {
    return rawValue;
  }

  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const safeFileName = (name: string) =>
  safeText(name, "Siswa")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");

const safeScore = (score: number) => {
  return Number.isFinite(score) ? String(score) : "0";
};

const loadImageAsDataURL = async (path: string) => {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Template sertifikat tidak dapat dimuat dari ${path} (${response.status})`,
    );
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Template sertifikat gagal dibaca sebagai data URL"));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Template sertifikat gagal dibaca"));
    };

    reader.readAsDataURL(blob);
  });
};

const getCertificateTemplate = async () => {
  if (!certificateTemplatePromise) {
    certificateTemplatePromise = loadImageAsDataURL(TEMPLATE_PATH);
  }

  try {
    return await certificateTemplatePromise;
  } catch (error) {
    certificateTemplatePromise = null;
    console.error(
      `Gagal memuat template sertifikat Tahfizh dari ${TEMPLATE_PATH}:`,
      error,
    );
    throw error;
  }
};

const setTextStyle = (
  doc: jsPDF,
  size: number,
  color: [number, number, number],
  style: "normal" | "bold" | "italic" = "normal",
  font = "helvetica",
) => {
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

const fitFontSize = (
  doc: jsPDF,
  text: string,
  maxWidth: number,
  initialSize: number,
  minSize: number,
) => {
  let fontSize = initialSize;
  doc.setFontSize(fontSize);

  while (doc.getTextWidth(text) > maxWidth && fontSize > minSize) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }

  return fontSize;
};

const drawCenteredText = (
  doc: jsPDF,
  text: string,
  y: number,
  options?: { maxWidth?: number },
) => {
  doc.text(text, CENTER_X, y, {
    align: "center",
    maxWidth: options?.maxWidth,
  });
};

const drawMetric = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  maxValueWidth: number,
) => {
  setTextStyle(doc, 8.5, BODY, "normal");
  doc.text(label, x, 132.5, { align: "center" });

  setTextStyle(doc, 16, DARK_GREEN, "bold");
  fitFontSize(doc, value, maxValueWidth, 16, 10);
  doc.text(value, x, 143.5, {
    align: "center",
    maxWidth: maxValueWidth,
  });
};

const drawSignature = (doc: jsPDF, centerX: number, title: string, name: string) => {
  setTextStyle(doc, 9.5, NAVY, "bold");
  doc.text(title, centerX, 176.5, { align: "center" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(centerX - 24, 185, centerX + 24, 185);

  setTextStyle(doc, 8.5, BODY, "normal");
  doc.text(name, centerX, 190.5, { align: "center" });
};

const drawQrCode = async (doc: jsPDF, data: CertificateData) => {
  try {
    const qrPayload =
      data.verificationUrl || `SERTIFIKAT:${safeText(data.nomorSertifikat)}`;

    const qr = await QRCode.toDataURL(qrPayload, {
      width: 220,
      margin: 1,
    });

    doc.addImage(qr, "PNG", 138.5, 154.5, 20, 20);

    setTextStyle(doc, 6.5, BODY, "normal");
    doc.text("Verifikasi", CENTER_X, 178.8, { align: "center" });
  } catch (err) {
    console.error("QR error:", err);
  }
};

export const buildCertificatePDF = async (data: CertificateData): Promise<jsPDF> => {
  const templateImage = await getCertificateTemplate();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.addImage(templateImage, "PNG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  setTextStyle(doc, 23, NAVY, "bold");
  drawCenteredText(doc, "SERTIFIKAT TAHFIZH AL-QUR'AN", 38);

  setTextStyle(doc, 9.5, GOLD, "normal");
  drawCenteredText(doc, `No: ${safeText(data.nomorSertifikat)}`, 49);

  setTextStyle(doc, 12, BODY, "italic", "times");
  drawCenteredText(doc, "Diberikan kepada:", 68);

  const studentName = safeText(data.studentName);
  setTextStyle(doc, 27, NAVY, "bold");
  fitFontSize(doc, studentName, 158, 27, 16);
  drawCenteredText(doc, studentName, 87, { maxWidth: 160 });

  setTextStyle(doc, 11, BODY, "normal");
  drawCenteredText(doc, `Kelas: ${safeText(data.className)}`, 103);

  setTextStyle(doc, 10.5, BODY, "normal");
  drawCenteredText(
    doc,
    "Telah menyelesaikan Ujian Sertifikasi Tahfizh Al-Qur'an",
    114,
  );
  drawCenteredText(doc, `untuk Juz ${safeText(data.juz)} dengan hasil:`, 122);

  drawMetric(doc, "Nilai Akhir", safeScore(data.nilaiAkhir), 94, 30);
  drawMetric(doc, "Predikat", safeText(data.predikat), 160, 40);

  await drawQrCode(doc, data);

  setTextStyle(doc, 8.3, BODY, "normal");
  drawCenteredText(
    doc,
    `Ditetapkan pada tanggal ${safeDate(data.tanggal)}`,
    187.5,
    { maxWidth: 80 },
  );

  drawSignature(doc, 75, "Koordinator Tahfizh", "Nama Koordinator");
  drawSignature(doc, 222, "Kepala Sekolah", "Nama Kepala Sekolah");

  return doc;
};

export const downloadCertificatePDF = async (data: CertificateData) => {
  const doc = await buildCertificatePDF(data);
  doc.save(`Sertifikat_${safeFileName(data.studentName)}.pdf`);
};

export const generateCertificateBlobUrl = async (data: CertificateData): Promise<string> => {
  const doc = await buildCertificatePDF(data);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
};

// Backward-compatible alias (no popup); triggers download only.
export const generateCertificatePDF = downloadCertificatePDF;
