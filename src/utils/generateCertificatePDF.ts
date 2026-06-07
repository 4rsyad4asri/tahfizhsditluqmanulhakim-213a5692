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
  leftLogoDataUrl?: string;
  rightLogoDataUrl?: string;
  coordinatorSignatureDataUrl?: string;
  principalSignatureDataUrl?: string;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const CENTER_X = PAGE_WIDTH / 2;
const TEMPLATE_PATH = "/certificate-template-tahfizh.png";

const NAVY: [number, number, number] = [7, 35, 70];
const GOLD: [number, number, number] = [178, 132, 28];
const TEAL: [number, number, number] = [7, 112, 111];
const ROYAL_PURPLE: [number, number, number] = [91, 28, 119];
const IVORY: [number, number, number] = [253, 252, 247];
const BODY: [number, number, number] = [55, 58, 64];
const MUTED: [number, number, number] = [110, 115, 125];

const GREEN_STROKE: [number, number, number] = [31, 122, 77];
const GREEN_VALUE: [number, number, number] = [15, 81, 50];
const GOLD_STROKE: [number, number, number] = [178, 132, 28];
const GOLD_VALUE: [number, number, number] = [122, 90, 15];
const PURPLE_STROKE: [number, number, number] = [91, 42, 134];
const PURPLE_VALUE: [number, number, number] = [61, 31, 102];

type MetricVariant = "green" | "gold" | "purple";

const romanMap: Record<string, string> = {
  "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
  "7": "VII", "8": "VIII", "9": "IX", "10": "X",
};

const formatClassName = (raw: string): string => {
  const cleaned = safeText(raw, "").replace(/^kelas\s*/i, "").trim();
  if (!cleaned) return "-";
  const m = cleaned.match(/^(\d+)\s*([A-Za-z]*)$/);
  if (m) {
    const roman = romanMap[m[1]] ?? m[1];
    return m[2] ? `${roman} ${m[2].toUpperCase()}` : roman;
  }
  return cleaned;
};

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
  variant: MetricVariant = "gold",
) => {
  const palette =
    variant === "green"
      ? { stroke: GREEN_STROKE, value: GREEN_VALUE }
      : variant === "purple"
        ? { stroke: PURPLE_STROKE, value: PURPLE_VALUE }
        : { stroke: GOLD_STROKE, value: GOLD_VALUE };
  const w = 58;
  const h = 26;
  const x = centerX - w / 2;
  doc.setDrawColor(...palette.stroke);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, topY, w, h, 2, 2);
  // top accent bar
  doc.setFillColor(...palette.stroke);
  doc.roundedRect(x, topY, w, 1.6, 0.8, 0.8, "F");

  setTextStyle(doc, 7.5, MUTED, "normal");
  doc.text(labelEN.toUpperCase(), centerX, topY + 5.5, { align: "center" });
  setTextStyle(doc, 7, MUTED, "italic", "times");
  doc.text(labelID, centerX, topY + 9.5, { align: "center" });

  setTextStyle(doc, 18, palette.value, "bold");
  fitFontSize(doc, value, w - 8, 18, 10);
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

    const qrSize = 24;
    doc.addImage(qr, "PNG", CENTER_X - qrSize / 2, 155, qrSize, qrSize);
  } catch (err) {
    console.error("QR error:", err);
  }
};

const drawContainedImage = (
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) => {
  if (!dataUrl) return;
  const { width, height } = doc.getImageProperties(dataUrl);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const format = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(
    dataUrl,
    format,
    x + (maxWidth - drawWidth) / 2,
    y + (maxHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
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

  drawContainedImage(doc, data.leftLogoDataUrl, 8, 5, 39, 39);
  drawContainedImage(doc, data.rightLogoDataUrl, 250, 5, 39, 39);

  doc.setFillColor(...IVORY);
  doc.rect(105, 12, 87, 12, "F");
  doc.rect(104, 37, 89, 11, "F");
  drawArabic(doc, "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ", 21, 16, TEAL);
  drawArabic(doc, "شهادة تحفيظ القرآن الكريم", 45, 16, ROYAL_PURPLE);

  // Fixed wording and labels are part of the background template.
  setTextStyle(doc, 8.5, NAVY, "normal");
  doc.text(safeText(data.nomorSertifikat), 153, 59.7, {
    align: "center",
    maxWidth: 66,
  });

  const dynamicStudentName = safeText(data.studentName);
  setTextStyle(doc, 27, NAVY, "normal", "Amiri");
  fitFontSize(doc, dynamicStudentName, 170, 27, 15);
  drawCenteredText(doc, dynamicStudentName.toUpperCase(), 92, { maxWidth: 170 });

  setTextStyle(doc, 13, [255, 255, 255], "bold");
  doc.text(formatClassName(data.className), 170, 104.8, {
    align: "center",
    maxWidth: 42,
  });

  setTextStyle(doc, 18, GREEN_VALUE, "bold");
  doc.text(safeScore(data.nilaiAkhir), 91, 144.2, { align: "center" });

  const dynamicGrade = safeText(data.predikat);
  setTextStyle(doc, 14, GOLD_VALUE, "bold");
  fitFontSize(doc, dynamicGrade, 39, 14, 9);
  doc.text(dynamicGrade, 149.5, 143.5, { align: "center", maxWidth: 39 });

  const dynamicDate = safeDate(data.tanggal);
  setTextStyle(doc, 11, PURPLE_VALUE, "bold");
  fitFontSize(doc, dynamicDate, 40, 11, 7.5);
  doc.text(dynamicDate, 221.5, 143.8, { align: "center", maxWidth: 40 });

  const juz = safeText(data.juz);
  setTextStyle(doc, 9.5, NAVY, "bold");
  doc.text(juz, 225.5, 113.5, { align: "center", maxWidth: 13 });
  doc.text(juz, 194.5, 120.2, { align: "center", maxWidth: 13 });

  drawContainedImage(doc, data.coordinatorSignatureDataUrl, 57, 164, 50, 16);
  drawContainedImage(doc, data.principalSignatureDataUrl, 190, 164, 50, 16);

  await drawQrCode(doc, data);

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
