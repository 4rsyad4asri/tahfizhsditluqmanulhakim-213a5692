import jsPDF from "jspdf";
import QRCode from "qrcode";
import { loadArabicFont } from "./loadArabicFont";
import { buildVerificationUrl } from "@/utils/verificationUrl";

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
const GOLD: [number, number, number] = [178, 132, 28];
const BODY: [number, number, number] = [55, 58, 64];
const MUTED: [number, number, number] = [110, 115, 125];

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
  if (isNaN(d.getTime())) return rawValue;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const safeDateEN = (value: string) => {
  const rawValue = safeText(value, "");
  if (!rawValue) return "-";
  const d = new Date(rawValue);
  if (isNaN(d.getTime())) return rawValue;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const safeFileName = (name: string) =>
  safeText(name, "Siswa")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");

const safeScore = (score: number) =>
  Number.isFinite(score) ? String(score) : "0";

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
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Template sertifikat gagal dibaca sebagai data URL"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Template sertifikat gagal dibaca"));
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
    console.error("Gagal memuat template sertifikat Tahfizh:", error);
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

const drawArabic = (
  doc: jsPDF,
  text: string,
  y: number,
  size: number,
  color: [number, number, number],
) => {
  doc.setFont("Amiri", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, CENTER_X, y, { align: "center" });
};

const drawMetricCard = (
  doc: jsPDF,
  centerX: number,
  labelEN: string,
  labelID: string,
  value: string,
  topY: number,
) => {
  const w = 58;
  const h = 26;
  const x = centerX - w / 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, topY, w, h, 2, 2);

  setTextStyle(doc, 7.5, MUTED, "normal");
  doc.text(labelEN.toUpperCase(), centerX, topY + 5.5, { align: "center" });
  setTextStyle(doc, 7, MUTED, "italic", "times");
  doc.text(labelID, centerX, topY + 9.5, { align: "center" });

  setTextStyle(doc, 18, NAVY, "bold");
  fitFontSize(doc, value, w - 8, 18, 11);
  doc.text(value, centerX, topY + 20, { align: "center", maxWidth: w - 8 });
};

const drawSignature = (
  doc: jsPDF,
  centerX: number,
  titleID: string,
  titleEN: string,
) => {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(centerX - 28, 178, centerX + 28, 178);

  setTextStyle(doc, 9, NAVY, "bold");
  doc.text(titleID, centerX, 183, { align: "center" });
  setTextStyle(doc, 7.5, MUTED, "italic", "times");
  doc.text(titleEN, centerX, 187.5, { align: "center" });
};

const drawQrCode = async (doc: jsPDF, data: CertificateData) => {
  try {
    const qrPayload =
      data.verificationUrl ||
      buildVerificationUrl("sertifikat-tahfizh", data.verificationToken) ||
      `SERTIFIKAT:${safeText(data.nomorSertifikat)}`;
    const qr = await QRCode.toDataURL(qrPayload, { width: 320, margin: 1 });

    const qrSize = 22;
    const pad = 2.5;
    const frame = qrSize + pad * 2;
    const frameX = CENTER_X - frame / 2;
    const frameY = 150;

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.45);
    doc.roundedRect(frameX, frameY, frame, frame, 1.5, 1.5);

    doc.addImage(qr, "PNG", frameX + pad, frameY + pad, qrSize, qrSize);

    setTextStyle(doc, 6.2, MUTED, "normal");
    doc.text(
      "Scan to verify  ·  Verifikasi",
      CENTER_X,
      frameY + frame + 3.5,
      { align: "center" },
    );
  } catch (err) {
    console.error("QR error:", err);
  }
};

export const buildCertificatePDF = async (
  data: CertificateData,
): Promise<jsPDF> => {
  const templateImage = await getCertificateTemplate();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  try {
    await loadArabicFont(doc);
  } catch (e) {
    console.warn("Arabic font failed to load:", e);
  }

  doc.addImage(templateImage, "PNG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  // ===== HEADER (trilingual) =====
  drawArabic(doc, "شهادة تحفيظ القرآن الكريم", 26, 20, NAVY);

  setTextStyle(doc, 13.5, GOLD, "bold");
  doc.setCharSpace(1.2);
  drawCenteredText(doc, "CERTIFICATE OF QUR'AN MEMORIZATION", 34);
  doc.setCharSpace(0);

  setTextStyle(doc, 11, NAVY, "italic", "times");
  drawCenteredText(doc, "Sertifikat Tahfizh Al-Qur'an", 41);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(CENTER_X - 35, 45, CENTER_X + 35, 45);

  setTextStyle(doc, 8.5, GOLD, "normal");
  drawCenteredText(doc, `No. ${safeText(data.nomorSertifikat)}`, 50);

  // ===== RECIPIENT =====
  setTextStyle(doc, 9.5, MUTED, "italic", "times");
  drawCenteredText(doc, "This is to certify that  ·  Diberikan kepada", 62);

  const studentName = safeText(data.studentName);
  setTextStyle(doc, 28, NAVY, "bold");
  fitFontSize(doc, studentName, 180, 28, 16);
  drawCenteredText(doc, studentName, 78, { maxWidth: 180 });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.line(CENTER_X - 55, 82, CENTER_X + 55, 82);

  setTextStyle(doc, 10, BODY, "normal");
  drawCenteredText(doc, `Kelas / Class: ${safeText(data.className)}`, 89);

  // ===== STATEMENT (trilingual) =====
  const juz = safeText(data.juz);
  setTextStyle(doc, 9.5, BODY, "normal");
  drawCenteredText(
    doc,
    `has successfully completed the Tahfizh examination for Juz ${juz}`,
    99,
  );
  setTextStyle(doc, 9.5, BODY, "italic", "times");
  drawCenteredText(
    doc,
    `telah menyelesaikan ujian Tahfizh Al-Qur'an Juz ${juz} dengan hasil sebagai berikut`,
    105,
  );
  drawArabic(
    doc,
    `قد أتم اختبار تحفيظ الجزء ${juz} بالنتيجة الآتية`,
    113,
    12,
    NAVY,
  );

  // ===== METRICS =====
  drawMetricCard(doc, 78, "Final Score", "Nilai Akhir", safeScore(data.nilaiAkhir), 122);
  drawMetricCard(doc, 219, "Grade", "Predikat", safeText(data.predikat), 122);

  // ===== QR =====
  await drawQrCode(doc, data);

  // ===== FOOTER =====
  setTextStyle(doc, 8, MUTED, "italic", "times");
  drawCenteredText(
    doc,
    `Issued on ${safeDateEN(data.tanggal)}  ·  Ditetapkan pada ${safeDate(data.tanggal)}`,
    168,
  );

  drawSignature(doc, 65, "Koordinator Tahfizh", "Tahfizh Coordinator");
  drawSignature(doc, 232, "Kepala Sekolah", "Principal");

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
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
};

export const generateCertificatePDF = downloadCertificatePDF;
