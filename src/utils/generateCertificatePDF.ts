import jsPDF from "jspdf";
import QRCode from "qrcode";
import { loadArabicFont } from "./loadArabicFont";

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

const EMERALD: [number, number, number] = [22, 101, 52];
const GOLD: [number, number, number] = [180, 140, 50];
const CREAM: [number, number, number] = [250, 248, 240];
const INK: [number, number, number] = [40, 40, 40];
const MUTED: [number, number, number] = [110, 110, 110];

const safeText = (value: unknown, fallback = "-") =>
  value === undefined || value === null || value === "" ? fallback : String(value);

const safeDate = (value: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const safeFileName = (name: string) =>
  name.replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "_");

const PREDIKAT_ARABIC: Record<string, string> = {
  "Mumtaz Murtafi": "ممتاز مرتفع",
  Mumtaz: "ممتاز",
  "Jayyid Jiddan": "جيد جدا",
  Jayyid: "جيد",
  Maqbul: "مقبول",
  Rosib: "راسب",
};

const drawFrame = (doc: jsPDF, w: number, h: number) => {
  // outer emerald border
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(2.5);
  doc.rect(10, 10, w - 20, h - 20);

  // inner gold border
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.rect(14, 14, w - 28, h - 28);

  // corner ornaments
  doc.setFillColor(...GOLD);
  const corners: [number, number][] = [
    [22, 22],
    [w - 22, 22],
    [22, h - 22],
    [w - 22, h - 22],
  ];
  corners.forEach(([cx, cy]) => {
    doc.circle(cx, cy, 2.5, "F");
    doc.setDrawColor(...EMERALD);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, 4, "S");
  });
};

const drawLogo = (doc: jsPDF, cx: number, cy: number) => {
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(1.2);
  doc.circle(cx, cy, 10);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.circle(cx, cy, 7.5);

  // crescent
  doc.setFillColor(...EMERALD);
  doc.circle(cx - 1.5, cy, 3.2, "F");
  doc.setFillColor(...CREAM);
  doc.circle(cx - 0.4, cy, 2.6, "F");

  // star
  doc.setFillColor(...GOLD);
  doc.circle(cx + 3.5, cy - 2.5, 1, "F");
};

export const buildCertificatePDF = async (data: CertificateData): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Arabic font
  try {
    await loadArabicFont(doc);
  } catch (err) {
    console.error("Arabic font load failed:", err);
  }

  // ======= BACKGROUND =======
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, w, h, "F");

  // soft top/bottom bands
  doc.setFillColor(240, 247, 240);
  doc.rect(0, 0, w, 16, "F");
  doc.rect(0, h - 16, w, 16, "F");

  drawFrame(doc, w, h);

  // ======= LOGOS (left + right) =======
  drawLogo(doc, 32, 30);
  drawLogo(doc, w - 32, 30);

  // ======= BISMILLAH (Arabic) =======
  doc.setFont("Amiri", "normal");
  doc.setFontSize(22);
  doc.setTextColor(...EMERALD);
  doc.text("بسم الله الرحمن الرحيم", w / 2, 28, { align: "center" });

  // ======= TITLES =======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...EMERALD);
  doc.text("CERTIFICATE OF QUR'AN MEMORIZATION", w / 2, 44, { align: "center" });

  doc.setFont("Amiri", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...GOLD);
  doc.text("شهادة تحفيظ القرآن الكريم", w / 2, 53, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Sertifikat Tahfizh Al-Qur'an", w / 2, 60, { align: "center" });

  // divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(w / 2 - 60, 64, w / 2 + 60, 64);

  // ======= NOMOR =======
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`No: ${safeText(data.nomorSertifikat)}`, w / 2, 70, { align: "center" });

  // ======= PRESENTED TO =======
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("This certificate is proudly presented to", w / 2, 80, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Dengan bangga diberikan kepada", w / 2, 86, { align: "center" });

  // ======= STUDENT NAME =======
  let nameSize = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(safeText(data.studentName)) > 200 && nameSize > 18) {
    nameSize -= 1;
    doc.setFontSize(nameSize);
  }
  doc.setTextColor(...EMERALD);
  doc.text(safeText(data.studentName), w / 2, 102, { align: "center" });

  const nameW = doc.getTextWidth(safeText(data.studentName));
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(w / 2 - nameW / 2 - 6, 106, w / 2 + nameW / 2 + 6, 106);

  // class
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`Class / Kelas: ${safeText(data.className)}`, w / 2, 113, { align: "center" });

  // ======= DESCRIPTION =======
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(
    `has successfully completed the Tahfizh Al-Qur'an certification examination for Juz ${safeText(data.juz)}`,
    w / 2,
    122,
    { align: "center" },
  );
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Telah menyelesaikan ujian sertifikasi Tahfizh Al-Qur'an untuk Juz ${safeText(data.juz)} dengan hasil:`,
    w / 2,
    128,
    { align: "center" },
  );

  // ======= SCORE BOX (3 columns) =======
  const boxW = 180;
  const boxH = 24;
  const boxX = (w - boxW) / 2;
  const boxY = 133;

  doc.setFillColor(240, 248, 240);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.6);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "S");

  const colW = boxW / 3;
  // dividers
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(boxX + colW, boxY + 4, boxX + colW, boxY + boxH - 4);
  doc.line(boxX + colW * 2, boxY + 4, boxX + colW * 2, boxY + boxH - 4);

  const colCenter = (i: number) => boxX + colW * i + colW / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("SCORE / NILAI", colCenter(0), boxY + 7, { align: "center" });
  doc.text("GRADE / PREDIKAT", colCenter(1), boxY + 7, { align: "center" });
  doc.text("DATE / TANGGAL", colCenter(2), boxY + 7, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...EMERALD);
  doc.text(String(data.nilaiAkhir ?? 0), colCenter(0), boxY + 17, { align: "center" });

  const predikatLen = safeText(data.predikat).length;
  doc.setFontSize(predikatLen > 13 ? 11 : 14);
  doc.text(safeText(data.predikat), colCenter(1), boxY + 16, { align: "center" });
  const arabicPredikat = PREDIKAT_ARABIC[data.predikat];
  if (arabicPredikat) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(arabicPredikat, colCenter(1), boxY + 21, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD);
  doc.text(safeDate(data.tanggal), colCenter(2), boxY + 17, { align: "center" });

  // ======= SIGNATURES =======
  const signY = 168;
  const signBoxW = 70;
  const signBoxH = 28;
  const leftX = 28;
  const rightX = w - signBoxW - 28;

  const drawSignBlock = (
    x: number,
    titleEn: string,
    titleId: string,
    name: string,
  ) => {
    doc.setFillColor(252, 252, 248);
    doc.setDrawColor(200, 180, 130);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, signY, signBoxW, signBoxH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...EMERALD);
    doc.text(titleEn, x + signBoxW / 2, signY + 5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(titleId, x + signBoxW / 2, signY + 9, { align: "center" });

    // signature line
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(x + 10, signY + 20, x + signBoxW - 10, signY + 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(name, x + signBoxW / 2, signY + 24, { align: "center" });
  };

  drawSignBlock(leftX, "Tahfizh Coordinator", "Koordinator Tahfizh", "(...........................)");
  drawSignBlock(rightX, "Principal", "Kepala Sekolah", "(...........................)");

  // ======= QR CODE between signatures =======
  try {
    const qrPayload = data.verificationUrl || `SERTIFIKAT:${safeText(data.nomorSertifikat)}`;
    const qr = await QRCode.toDataURL(qrPayload, { width: 240, margin: 1 });
    const qrSize = 24;
    const qrX = (w - qrSize) / 2;
    const qrY = signY + 1;
    doc.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("Scan to verify · Pindai untuk verifikasi", w / 2, qrY + qrSize + 3, {
      align: "center",
    });
  } catch (err) {
    console.error("QR error:", err);
  }

  // ======= FOOTER =======
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "SDIT Luqmanul Hakim · Tahfizh Al-Qur'an Program · Internationally Standardised Certification",
    w / 2,
    h - 8,
    { align: "center" },
  );

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