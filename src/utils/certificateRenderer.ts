import QRCode from "qrcode";
import { buildVerificationUrl } from "./verificationUrl";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  type CertificateElementLayout,
  type CertificateLayout,
} from "./certificateLayout";

export interface CertificateData {
  studentName: string;
  className: string;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
  documentNumber?: string;
  verificationToken?: string | null;
  verificationUrl?: string;
  leftLogoDataUrl?: string;
  rightLogoDataUrl?: string;
  coordinatorSignatureDataUrl?: string;
  principalSignatureDataUrl?: string;
}

const TEMPLATE_PATH = "/certificate-template-tahfizh.png";
const NAVY = "#072346";
const GREEN = "#0f5132";
const GOLD = "#d87909";
const PURPLE = "#5b2a86";

const romanMap: Record<string, string> = {
  "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
  "7": "VII", "8": "VIII", "9": "IX", "10": "X",
};

let templatePromise: Promise<HTMLImageElement> | null = null;

const safeText = (value: unknown, fallback = "-") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const safeDate = (value: string) => {
  const raw = safeText(value, "");
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatClassName = (raw: string) => {
  const cleaned = safeText(raw, "").replace(/^kelas\s*/i, "").trim();
  const match = cleaned.match(/^(\d+)\s*([A-Za-z]*)$/);
  if (!match) return cleaned || "-";
  const grade = romanMap[match[1]] ?? match[1];
  return match[2] ? `${grade} ${match[2].toUpperCase()}` : grade;
};

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Gambar sertifikat gagal dimuat: ${source.slice(0, 80)}`));
    image.src = source;
  });

const getTemplateImage = () => {
  if (!templatePromise) templatePromise = loadImage(TEMPLATE_PATH);
  return templatePromise;
};

const getAnchorX = (layout: CertificateElementLayout) => {
  if (layout.textAlign === "left") return layout.x - layout.width / 2;
  if (layout.textAlign === "right") return layout.x + layout.width / 2;
  return layout.x;
};

const fontString = (
  layout: CertificateElementLayout,
  fontSize: number,
  italic = false,
) => `${italic ? "italic " : ""}${layout.fontWeight} ${fontSize}px "${layout.fontFamily}"`;

const measureSpacedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
) => ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;

const fitFontSize = (
  ctx: CanvasRenderingContext2D,
  text: string,
  layout: CertificateElementLayout,
  minSize: number,
  italic = false,
) => {
  let size = layout.fontSize;
  while (size > minSize) {
    ctx.font = fontString(layout, size, italic);
    if (measureSpacedText(ctx, text, layout.letterSpacing) <= layout.width) break;
    size -= 0.5;
  }
  return size;
};

const drawSpacedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  layout: CertificateElementLayout,
  options?: { minSize?: number; italic?: boolean },
) => {
  const size = fitFontSize(
    ctx,
    text,
    layout,
    options?.minSize ?? Math.max(8, layout.fontSize * 0.55),
    options?.italic,
  );
  ctx.font = fontString(layout, size, options?.italic);
  ctx.fillStyle = layout.color;
  ctx.textBaseline = "middle";

  const totalWidth = measureSpacedText(ctx, text, layout.letterSpacing);
  const anchorX = getAnchorX(layout);
  let cursor = layout.textAlign === "left"
    ? anchorX
    : layout.textAlign === "right"
      ? anchorX - totalWidth
      : anchorX - totalWidth / 2;

  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + layout.letterSpacing;
  }
};

const drawContainedImage = async (
  ctx: CanvasRenderingContext2D,
  source: string | undefined,
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number,
) => {
  if (!source) return;
  const image = await loadImage(source);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
};

const clearJuzStatements = (ctx: CanvasRenderingContext2D) => {
  const x = 286;
  const y = 563;
  const width = 876;
  const height = 73;
  const top = ctx.getImageData(x, y - 3, width, 1).data;
  const bottom = ctx.getImageData(x, y + height + 3, width, 1).data;
  const patch = ctx.createImageData(width, height);

  for (let row = 0; row < height; row += 1) {
    const ratio = row / Math.max(1, height - 1);
    for (let column = 0; column < width; column += 1) {
      const source = column * 4;
      const target = (row * width + column) * 4;
      patch.data[target] = Math.round(top[source] * (1 - ratio) + bottom[source] * ratio);
      patch.data[target + 1] = Math.round(top[source + 1] * (1 - ratio) + bottom[source + 1] * ratio);
      patch.data[target + 2] = Math.round(top[source + 2] * (1 - ratio) + bottom[source + 2] * ratio);
      patch.data[target + 3] = 255;
    }
  }

  ctx.putImageData(patch, x, y);
};

export const buildCertificateJuzStatements = (value: string) => {
  const juz = safeText(value);
  return {
    english:
      "has successfully completed the Tahfizh Al-Qur'an certification examination",
    indonesian:
      `Lulus sertifikasi Tahfizh Al-Qur'an Juz ${juz} dengan hasil:`,
  };
};

export const renderCertificateImage = async (
  data: CertificateData,
  layout: CertificateLayout,
): Promise<string> => {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = CERTIFICATE_WIDTH;
  canvas.height = CERTIFICATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas sertifikat tidak tersedia");

  const template = await getTemplateImage();
  ctx.drawImage(template, 0, 0, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT);

  await drawContainedImage(ctx, data.leftLogoDataUrl, 134, 117, 184, 184);
  await drawContainedImage(ctx, data.rightLogoDataUrl, 1318, 119, 184, 184);

  drawSpacedText(
    ctx,
    safeText(data.nomorSertifikat),
    layout.certificateNumber.x,
    layout.certificateNumber.y,
    layout.certificateNumber,
    { minSize: 11 },
  );

  drawSpacedText(
    ctx,
    safeText(data.studentName).toUpperCase(),
    layout.studentName.x,
    layout.studentName.y,
    layout.studentName,
    { minSize: 28 },
  );

  drawSpacedText(
    ctx,
    formatClassName(data.className),
    layout.className.x,
    layout.className.y,
    layout.className,
    { minSize: 14 },
  );

  clearJuzStatements(ctx);
  const { english, indonesian } = buildCertificateJuzStatements(data.juz);
  const lineGap = layout.juzInfo.fontSize * 1.65;
  drawSpacedText(
    ctx,
    english,
    layout.juzInfo.x,
    layout.juzInfo.y - lineGap / 2,
    layout.juzInfo,
    { minSize: 12, italic: true },
  );
  drawSpacedText(
    ctx,
    indonesian,
    layout.juzInfo.x,
    layout.juzInfo.y + lineGap / 2,
    { ...layout.juzInfo, fontWeight: Math.min(600, layout.juzInfo.fontWeight) },
    { minSize: 12 },
  );

  const scoreLayout: CertificateElementLayout = {
    ...layout.date,
    x: 445,
    y: 729,
    width: 105,
    fontSize: 38,
    fontFamily: "Arial",
    fontWeight: 700,
    letterSpacing: 0,
    color: GREEN,
    textAlign: "center",
  };
  drawSpacedText(
    ctx,
    Number.isFinite(data.nilaiAkhir) ? String(data.nilaiAkhir) : "0",
    scoreLayout.x,
    scoreLayout.y,
    scoreLayout,
  );

  const gradeLayout: CertificateElementLayout = {
    ...scoreLayout,
    x: 738,
    y: 729,
    width: 170,
    fontSize: 27,
    color: GOLD,
  };
  drawSpacedText(ctx, safeText(data.predikat), gradeLayout.x, gradeLayout.y, gradeLayout, { minSize: 18 });

  const dateLayout: CertificateElementLayout = {
    ...layout.date,
    width: 190,
    fontSize: Math.min(layout.date.fontSize, 19),
  };
  drawSpacedText(
    ctx,
    safeDate(data.tanggal),
    dateLayout.x,
    dateLayout.y,
    dateLayout,
    { minSize: 13 },
  );

  const qrPayload = data.verificationUrl
    || buildVerificationUrl("sertifikat-tahfizh", data.verificationToken)
    || `SERTIFIKAT:${safeText(data.nomorSertifikat)}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 420, margin: 1 });
  await drawContainedImage(
    ctx,
    qrDataUrl,
    layout.qrCode.x,
    layout.qrCode.y,
    layout.qrCode.size,
    layout.qrCode.size,
  );

  const documentNumberLayout: CertificateElementLayout = {
    ...layout.certificateNumber,
    x: layout.qrCode.x,
    y: layout.qrCode.y + layout.qrCode.size / 2 + 14,
    width: 220,
    fontSize: 8,
    fontFamily: "Arial",
    fontWeight: 600,
    letterSpacing: 0,
    color: NAVY,
    textAlign: "center",
  };
  if (data.documentNumber) {
    drawSpacedText(
      ctx,
      data.documentNumber,
      documentNumberLayout.x,
      documentNumberLayout.y,
      documentNumberLayout,
      { minSize: 6 },
    );
  }

  await drawContainedImage(ctx, data.coordinatorSignatureDataUrl, 400, 874, 240, 78);
  await drawContainedImage(ctx, data.principalSignatureDataUrl, 1048, 874, 240, 78);

  return canvas.toDataURL("image/png", 1);
};

export const CERTIFICATE_EDITOR_BOUNDS: Record<
  CertificateElementId,
  { width: number; height: number }
> = {
  studentName: { width: 930, height: 76 },
  certificateNumber: { width: 330, height: 42 },
  className: { width: 190, height: 46 },
  juzInfo: { width: 960, height: 86 },
  qrCode: { width: 150, height: 150 },
  date: { width: 230, height: 52 },
};

export const CERTIFICATE_SAMPLE_DATA: CertificateData = {
  studentName: "SALWA AZMI SALSABILA",
  className: "6 D",
  juz: "28-30",
  nilaiAkhir: 85,
  predikat: "Jayyid",
  tanggal: "2026-05-15",
  nomorSertifikat: "148/SDITLH/STQ/2526/V/2026",
  verificationUrl: "https://example.com/verifikasi/sertifikat",
};
