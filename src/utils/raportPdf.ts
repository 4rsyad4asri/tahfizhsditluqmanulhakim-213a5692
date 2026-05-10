import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import QRCode from "qrcode";
import { loadArabicFont } from "@/utils/loadArabicFont";
import {
  calculateNilaiTahsinDasar,
  calculateNilaiTahsinLanjutan,
  type TahsinDasarEntry,
  type TahsinLanjutanEntry,
  type TahsinPenaltyConfig,
  type WaqafSymbolTest,
} from "@/data/tahsinScoring";
import { calculateNilaiSurahWithRumus, type TahfizhSurahEntry } from "@/data/mockData";

export type Orientation = "portrait" | "landscape";

export interface RaportHeader {
  schoolName: string;
  programName: string;
  address: string;
  headmaster: string;
  headmasterTitle: string;
  nip: string;
  city: string;
  examinerTitle: string;
}

export interface RaportAssets {
  logoLeft?: string;
  logoRight?: string;
  watermark?: string;
  sigExaminer?: string;
  sigHeadmaster?: string;
}

export interface RaportPdfOptions {
  orientation: Orientation;
  fontSize: number;     // body font size (pt)
  tableFontSize: number;
  showWatermark: boolean;
  showQR: boolean;
  verifyUrl?: string;   // QR code content
}

export interface RaportData {
  mode: "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan";
  studentName: string;
  className: string;
  assessorName?: string;
  tanggal: string;       // ISO yyyy-mm-dd
  nilaiAkhir: number;
  status: string;
  grade: string;
  predikat: string;
  catatanGuru?: string;
  // detail per mode
  tahfizhEntries?: TahfizhSurahEntry[];
  dasarEntries?: TahsinDasarEntry[];
  dasarConfig?: TahsinPenaltyConfig;
  lanjutanEntries?: TahsinLanjutanEntry[];
  lanjutanConfig?: TahsinPenaltyConfig;
  penaltiWaqaf?: number;
  waqafTest?: WaqafSymbolTest;
  ujianId?: string;
}

const EMERALD: [number, number, number] = [6, 95, 70];
const EMERALD_SOFT: [number, number, number] = [236, 253, 245];
const GOLD: [number, number, number] = [180, 140, 50];
const GRAY_LINE: [number, number, number] = [209, 213, 219];
const GRAY_TEXT: [number, number, number] = [55, 65, 81];

function fmtTanggal(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

async function makeQR(text: string): Promise<string> {
  return await QRCode.toDataURL(text, { margin: 0, width: 240, color: { dark: "#065f46", light: "#ffffff" } });
}

function safeAddImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!dataUrl) return;

  try {

    let fmt: "PNG" | "JPEG" = "JPEG";

    if (dataUrl.startsWith("data:image/png")) {
      fmt = "PNG";
    }

    doc.addImage(
      dataUrl,
      fmt,
      x,
      y,
      w,
      h,
      undefined,
      "FAST"
    );

  } catch (err) {
    console.error("Gagal add image:", err);
  }
}

function generateNomorDokumen(mode: string, ujianId?: string) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = (ujianId || Math.random().toString(36).slice(2, 8)).slice(0, 6).toUpperCase();
  const code = mode.replace(/\s+/g, "").toUpperCase();
  return `RPT/${code}/${ym}/${id}`;
}

function drawHeader(
  doc: jsPDF,
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  pageW: number,
  margin: number,
  qrDataUrl?: string,
  nomorDokumen?: string,
) {
  const headerH = 26;
  // School band
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.8);
  doc.line(margin, margin + headerH, pageW - margin, margin + headerH);

  // Logos
  const logoSize = 18;
  if (assets.logoLeft) {
    safeAddImage(doc, assets.logoLeft, margin, margin, logoSize, logoSize);
  } else {
    doc.setDrawColor(...EMERALD);
    doc.setLineWidth(0.5);
    doc.circle(margin + logoSize / 2, margin + logoSize / 2, logoSize / 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...EMERALD);
    doc.text("SDIT", margin + logoSize / 2, margin + logoSize / 2 - 1, { align: "center" });
    doc.text("LH", margin + logoSize / 2, margin + logoSize / 2 + 4, { align: "center" });
  }
  if (assets.logoRight) {
    safeAddImage(doc, assets.logoRight, pageW - margin - logoSize, margin, logoSize, logoSize);
  } else {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.circle(pageW - margin - logoSize / 2, margin + logoSize / 2, logoSize / 2);
  }

  // School text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...EMERALD);
  doc.text(header.schoolName.toUpperCase(), pageW / 2, margin + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(header.programName, pageW / 2, margin + 12, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(header.address, pageW / 2, margin + 17, { align: "center" });

  // Title
  const titleY = margin + headerH + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...EMERALD);
  const title =
    data.mode === "Tahfizh"
      ? "RAPOR HASIL UJIAN TAHFIZH AL-QUR'AN"
      : `RAPOR HASIL UJIAN ${data.mode.toUpperCase()}`;
  doc.text(title, pageW / 2, titleY, { align: "center" });

  if (nomorDokumen) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`No. Dok: ${nomorDokumen}`, pageW / 2, titleY + 5, { align: "center" });
  }

  // QR (top-right under logo)
  if (qrDataUrl) {
    safeAddImage(doc, qrDataUrl, pageW - margin - 18, margin + headerH + 2, 18, 18);
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("Verifikasi", pageW - margin - 9, margin + headerH + 22, { align: "center" });
  }
}

function drawWatermark(doc: jsPDF, header: RaportHeader, assets: RaportAssets, opts: RaportPdfOptions, pageW: number, pageH: number) {
  if (!opts.showWatermark) return;
  if (assets.watermark) {
    const w = pageW * 0.5;
    const h = w; // square assumption
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
    if (gs) (doc as any).setGState(gs);
    safeAddImage(doc, assets.watermark, (pageW - w) / 2, (pageH - h) / 2, w, h);
    if (gs) {
      const reset = new (doc as any).GState({ opacity: 1 });
      (doc as any).setGState(reset);
    }
  } else {
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.07 }) : null;
    if (gs) (doc as any).setGState(gs);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(70);
    doc.setTextColor(...EMERALD);
    doc.text(header.schoolName, pageW / 2, pageH / 2, { align: "center", angle: 30 });
    if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
  }
}

function drawStudentInfo(doc: jsPDF, data: RaportData, pageW: number, margin: number, startY: number, opts: RaportPdfOptions) {
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: opts.fontSize - 1,
      cellPadding: { top: 1.2, right: 2.5, bottom: 1.2, left: 2.5 },
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { fillColor: EMERALD_SOFT, fontStyle: "bold", cellWidth: (pageW - margin * 2) * 0.18 },
      1: { cellWidth: (pageW - margin * 2) * 0.32 },
      2: { fillColor: EMERALD_SOFT, fontStyle: "bold", cellWidth: (pageW - margin * 2) * 0.18 },
      3: { cellWidth: (pageW - margin * 2) * 0.32 },
    },
    body: [
      ["Nama Siswa", data.studentName, "Kelas", data.className],
      ["Penguji", data.assessorName || "-", "Tanggal Ujian", fmtTanggal(data.tanggal)],
    ],
  });
}

  function drawScoreSummary(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  margin: number,
  startY: number
) {
  const gap = 4;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const h = 22;

  const statusX = margin + (boxW + gap) * 2;

  const draw = (
    x: number,
    label: string,
    value: string,
    color: [number, number, number]
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.setFillColor(255, 255, 255);

    doc.roundedRect(x, startY, boxW, h, 2, 2, "FD");

    // LABEL
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);

    doc.text(
      label.toUpperCase(),
      x + boxW / 2,
      startY + 5,
      { align: "center" }
    );

    // VALUE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...color);

    doc.text(
      value,
      x + boxW / 2,
      startY + 13,
      { align: "center" }
    );
  };

  // BOX NILAI
  draw(
    margin,
    "Nilai Akhir",
    String(data.nilaiAkhir),
    EMERALD
  );

  // BOX GRADE
  draw(
    margin + boxW + gap,
    "Grade",
    data.grade,
    GOLD
  );

  // =========================
  // BOX STATUS
  // =========================

  doc.setDrawColor(...EMERALD);
doc.setFillColor(255, 255, 255);

doc.roundedRect(
  statusX,
  startY,
  boxW,
  h,
  2,
  2,
  "FD"
);

  // LABEL STATUS
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);

  doc.text(
    "STATUS",
    statusX + boxW / 2,
    startY + 5,
    { align: "center" }
  );

  // TEXT STATUS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);

  doc.setTextColor(
    ...(data.status === "Lulus"
      ? EMERALD
      : [185, 28, 28])
  );

  const statusText =
    data.status === "Lulus"
      ? "L U L U S"
      : "T I D A K   L U L U S";

  doc.text(
    statusText,
    statusX + boxW / 2,
    startY + 11,
    {
      align: "center",
    }
  );

  // =========================
  // PREDIKAT
  // =========================

  const predY = startY + 17;

  // Label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);

  const label = "Predikat :";
  const labelWidth = doc.getTextWidth(label);

  // Isi
  doc.setFont("helvetica", "bold");

  const predikatSize =
    data.predikat.length > 14
      ? 6.5
      : 6.5;

  doc.setFontSize(predikatSize);
  doc.setTextColor(...EMERALD);

  const valueWidth = doc.getTextWidth(data.predikat);

  // TOTAL WIDTH
  const totalWidth = labelWidth + 2 + valueWidth;

  const startX =
    statusX + (boxW / 2) - (totalWidth / 2);

  // DRAW LABEL
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);

  doc.text(
    label,
    startX,
    predY
  );

  // DRAW VALUE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(predikatSize);
  doc.setTextColor(...EMERALD);

  doc.text(
    data.predikat,
    startX + labelWidth + 2,
    predY
  );
}

function drawDetail(doc: jsPDF, data: RaportData, pageW: number, margin: number, startY: number, opts: RaportPdfOptions): number {
  const sectionTitle = (text: string, y: number) => {
    doc.setFillColor(...GOLD);
    doc.rect(margin, y, 1.5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...EMERALD);
    doc.text(text, margin + 3, y + 4);
    return y + 6;
  };

  let y = startY;

  if (data.mode === "Tahfizh" && data.tahfizhEntries) {
    y = sectionTitle("DETAIL UJIAN SERTIFIKASI TAHFIZH", y);
    const head = [["Surat", "Juz", "Lahn Jali", "Lahn Khofi", "Waqaf", "Sambung", "Lancar", "Nilai"]];
    const body: RowInput[] = data.tahfizhEntries.map((e) => [
      e.surah,
      String(e.juz),
      String(e.lahn_jali),
      String(e.lahn_khofi),
      String(e.waqaf_ibtida ?? 0),
      String(e.salah_sambung_ayat ?? 0),
      String(e.kelancaran),
      String(calculateNilaiSurahWithRumus(e, "baru")),
    ]);
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin }, head, body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: opts.tableFontSize, cellPadding: 1.4, lineColor: GRAY_LINE, lineWidth: 0.15, halign: "center", valign: "middle" },
      headStyles: { fillColor: EMERALD, textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [247, 254, 250] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 7: { fontStyle: "bold", textColor: EMERALD as any } },
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.4);
    doc.setTextColor(120, 120, 120);
    doc.text("Rumus: Nilai = Kelancaran − (LJ×2) − (LK×1) − (Waqaf×2) − (Sambung×2)", margin, y);
    y += 5;
  }

  if (data.mode === "Tahsin Dasar" && data.dasarEntries) {
    const cfg = data.dasarConfig || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 };
    y = sectionTitle("DETAIL UJIAN TAHSIN DASAR", y);
    const head = [["EBTA", "S.Huruf", "S.Harakat", "S.Tasydid", "Mad", "Qalqalah", "Tajwid", "Waqaf", "Lancar", "Nilai"]];
    const body: RowInput[] = data.dasarEntries.map((e) => [
      e.nama_ebta, String(e.salah_huruf), String(e.salah_harakat), String(e.salah_makhraj),
      String(e.kesalahan_mad), String(e.kesalahan_qalqalah), String(e.kesalahan_tajwid), String(e.kesalahan_waqaf),
      String(e.kelancaran), String(calculateNilaiTahsinDasar(e, cfg)),
    ]);
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin }, head, body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: opts.tableFontSize, cellPadding: 1.2, lineColor: GRAY_LINE, lineWidth: 0.15, halign: "center", valign: "middle" },
      headStyles: { fillColor: EMERALD, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 254, 250] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 9: { fontStyle: "bold", textColor: EMERALD as any } },
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFont("helvetica", "italic"); doc.setFontSize(5.4); doc.setTextColor(120, 120, 120);
    doc.text(`Rumus: Nilai = Kelancaran − (LJ × ${cfg.penalti_lahn_jali}) − (LK × ${cfg.penalti_lahn_khofi})`, margin, y);
    y += 5;
  }

  if (data.mode === "Tahsin Lanjutan" && data.lanjutanEntries) {
    const cfg = data.lanjutanConfig || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 };
    const pw = data.penaltiWaqaf ?? 2;
    y = sectionTitle("DETAIL UJIAN TAHSIN LANJUTAN", y);
    const head = [["Surat", "Ayat", "S.Huruf", "S.Harakat", "S.Tasydid", "Mad", "Qalqalah", "Tajwid", "Waqaf", "Lancar", "Nilai"]];
    const body: RowInput[] = data.lanjutanEntries.map((e) => [
      e.surah, e.ayat, String(e.salah_huruf), String(e.salah_harakat), String(e.salah_makhraj),
      String(e.kesalahan_mad), String(e.kesalahan_qalqalah), String(e.kesalahan_tajwid),
      String(e.waqaf_ibtida), String(e.kelancaran), String(calculateNilaiTahsinLanjutan(e, cfg, pw)),
    ]);
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin }, head, body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: opts.tableFontSize, cellPadding: 1.2, lineColor: GRAY_LINE, lineWidth: 0.15, halign: "center", valign: "middle" },
      headStyles: { fillColor: EMERALD, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 254, 250] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "left" }, 10: { fontStyle: "bold", textColor: EMERALD as any } },
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFont("helvetica", "italic"); doc.setFontSize(5.4); doc.setTextColor(120, 120, 120);
    doc.text(`Rumus: Nilai = Kelancaran − (LJ × ${cfg.penalti_lahn_jali}) − (LK × ${cfg.penalti_lahn_khofi}) − (Waqaf × ${pw})`, margin, y);
    y += 5;

    if (data.waqafTest) {
      const labels: Record<string, string> = {
        waqaf_lazim: "Waqaf Lazim", waqaf_mustahab: "Waqaf Mustahab", waqaf_jaiz: "Waqaf Jaiz",
        waqaf_mujawwaz: "Waqaf Mujawwaz", waqaf_mamnu: "Waqaf Mamnu'", waqaf_muanaqah: "Waqaf Muanaqah",
      };
      y = sectionTitle("TES SIMBOL WAQAF", y);
      // ======================================================
// TES SIMBOL WAQAF - MODERN SDIT STYLE
// ======================================================

const waqafEntries = Object.entries(data.waqafTest);

const columns = 2;

const cardWidth = 82;
const cardHeight = 16;

const gapX = 6;
const gapY = 5;

// Simbol Arab
const waqafArabic: Record<string, string> = {
  waqaf_lazim: "مـ",
  waqaf_mustahab: "قلى",
  waqaf_jaiz: "ج",
  waqaf_mujawwaz: "صلى",
  waqaf_mamnu: "لا",
  waqaf_muanaqah: "∴",
};

waqafEntries.forEach(([key, val], index) => {

  const col = index % columns;
  const row = Math.floor(index / columns);

  const x =
    margin +
    (col * (cardWidth + gapX));

  const cardY =
    y +
    (row * (cardHeight + gapY));

  const label = labels[key] || key;

  const arabic = waqafArabic[key] || "ۘ";

  // WARNA
  const bgColor = val
    ? [240, 252, 245]
    : [255, 243, 243];

  const borderColor = val
    ? [22, 163, 74]
    : [220, 38, 38];

  // SHADOW
  doc.setFillColor(220, 220, 220);

  doc.roundedRect(
    x + 1,
    cardY + 1,
    cardWidth,
    cardHeight,
    2,
    2,
    "F"
  );

  // CARD
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);

  doc.roundedRect(
    x,
    cardY,
    cardWidth,
    cardHeight,
    2,
    2,
    "FD"
  );

  // ICON BOX
  doc.setFillColor(...borderColor);

  doc.roundedRect(
    x + 3,
    cardY + 3,
    12,
    10,
    2,
    2,
    "F"
  );

  // ARABIC
  doc.setFont("Amiri", "normal");
  doc.setFontSize(10);

  doc.setTextColor(255, 255, 255);

  doc.text(
    arabic,
    x + 9,
    cardY + 9,
    { align: "center" }
  );

  // LABEL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.setTextColor(40, 40, 40);

  doc.text(
    label,
    x + 18,
    cardY + 7
  );

  // STATUS
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  doc.setTextColor(90, 90, 90);

  doc.text(
    val ? "Jawaban Benar" : "Jawaban Salah",
    x + 18,
    cardY + 11
  );

  // BADGE
  doc.setFillColor(...borderColor);

  doc.roundedRect(
    x + cardWidth - 22,
    cardY + 4,
    18,
    5,
    2,
    2,
    "F"
  );

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");

  doc.setTextColor(255, 255, 255);

  doc.text(
    val ? "BENAR" : "SALAH",
    x + cardWidth - 13,
    cardY + 7.5,
    { align: "center" }
  );
});

// UPDATE Y
y +=
  (
    Math.ceil(waqafEntries.length / columns)
    * (cardHeight + gapY)
  ) + 5;
    }
  }

  return y;
}

function drawCatatan(doc: jsPDF, catatan: string, pageW: number, margin: number, startY: number, opts: RaportPdfOptions): number {
  doc.setFillColor(...EMERALD);
  doc.rect(margin, startY, pageW - margin * 2, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("CATATAN GURU / PENGUJI", margin + 2, startY + 3.5);

  const text = catatan || "—";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(opts.fontSize);
  doc.setTextColor(...GRAY_TEXT);
  const lines = doc.splitTextToSize(text, pageW - margin * 2 - 4);
  const blockH = Math.max(14, lines.length * (opts.fontSize * 0.45) + 6);
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(margin, startY + 5, pageW - margin * 2, blockH, "S");
  doc.text(lines, margin + 2, startY + 10);
  return startY + 5 + blockH + 4;
}

function drawSignatures(doc: jsPDF, data: RaportData, header: RaportHeader, assets: RaportAssets, opts: RaportPdfOptions, pageW: number, margin: number, startY: number) {
  const cols = opts.orientation === "landscape" ? 3 : 2;
  const colW = (pageW - margin * 2) / cols;
  const baseY = startY;
  const cells: { title1: string; title2?: string; name: string; sub?: string; sig?: string }[] = [];
  if (cols === 3) cells.push({ title1: "Mengetahui,", title2: "Orang Tua/Wali", name: "(........................)" });
  cells.push({
    title1: "Penguji,",
    name: data.assessorName || "(........................)",
    sub: header.examinerTitle,
    sig: assets.sigExaminer,
  });
  cells.push({
    title1: `${header.city}, ${fmtTanggal(data.tanggal)}`,
    title2: `${header.headmasterTitle},`,
    name: header.headmaster,
    sub: `NIP: ${header.nip}`,
    sig: assets.sigHeadmaster,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(opts.fontSize - 1);
  doc.setTextColor(...GRAY_TEXT);

cells.forEach((cell, i) => {
  const x = margin + colW * i + colW / 2;

  // =========================
  // TITLE ATAS
  // =========================

let y = baseY + 5;

// KHUSUS PENGUJI TURUN 1 BARIS
if (cell.title1 === "Penguji,") {
  y += 4;
}

doc.setFont("helvetica", "normal");
doc.setFontSize(opts.fontSize - 1);

doc.text(cell.title1, x, y, {
  align: "center",
});

  if (cell.title2) {
    y += 4;

    doc.text(cell.title2, x, y, {
      align: "center",
    });
  }

  // =========================
  // POSISI TTD
  // =========================

  const signY = y + 20;

  // =========================
  // ORANG TUA / WALI
  // =========================

  if (i === 0 && cols === 3) {
    doc.setFont("helvetica", "normal");

    doc.text(
      "(.................................)",
      x,
      signY,
      {
        align: "center",
      }
    );
  }

  // =========================
  // PENGUJI & KEPSEK
  // =========================

  else {
    // Nama di atas garis
    doc.setFont("helvetica", "bold");

    doc.text(
      cell.name,
      x,
      signY - 2,
      {
        align: "center",
      }
    );

    // Garis tanda tangan
    const lineW = 42;

    doc.setLineWidth(0.3);

    doc.setDrawColor(...GRAY_TEXT);

    doc.line(
      x - lineW / 2,
      signY,
      x + lineW / 2,
      signY
    );

    // Jabatan / NIP
    if (cell.sub) {
      doc.setFont("helvetica", "normal");

      doc.setFontSize(opts.fontSize - 2);

      doc.text(
        cell.sub,
        x,
        signY + 5,
        {
          align: "center",
        }
      );
    }
  }
});
}

export async function generateRaportPDF(
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: opts.orientation, unit: "mm", format: "a4" });

  // LOAD FONT ARAB
await loadArabicFont(doc);
  
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const nomor = generateNomorDokumen(data.mode, data.ujianId);
  const verifyText = opts.verifyUrl || `${data.mode}|${data.studentName}|${data.tanggal}|${data.nilaiAkhir}|${data.status}|${nomor}`;
  const qrUrl = opts.showQR ? await makeQR(verifyText) : undefined;

  drawWatermark(doc, header, assets, opts, pageW, pageH);
  drawHeader(doc, data, header, assets, pageW, margin, qrUrl, nomor);

  let y = margin + 26 + 16;
  drawStudentInfo(doc, data, pageW, margin, y, opts);
  y = (doc as any).lastAutoTable.finalY + 4;
  drawScoreSummary(doc, data, pageW, margin, y);
  y += 18 + 10;
  y = drawDetail(doc, data, pageW, margin, y, opts);
  y = drawCatatan(doc, data.catatanGuru || "", pageW, margin, y, opts);

  // Signatures: place near bottom; if not enough space, new page
  const sigBlockH = 32;
  if (y + sigBlockH > pageH - margin) {
    doc.addPage();
    drawWatermark(doc, header, assets, opts, pageW, pageH);
    y = margin;
  }
  drawSignatures(doc, data, header, assets, opts, pageW, margin, y);

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`${header.schoolName} — ${header.programName}`, pageW / 2, pageH - 5, { align: "center" });
    doc.text(`Hal ${i} / ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
    doc.text(nomor, margin, pageH - 5);
  }

  return doc;
}

export async function downloadRaportPDF(...args: Parameters<typeof generateRaportPDF>) {
  const data = args[0];
  const doc = await generateRaportPDF(...args);
  doc.save(`Raport_${data.mode.replace(/\s+/g, "_")}_${data.studentName.replace(/\s+/g, "_")}.pdf`);
}

export async function printRaportPDF(...args: Parameters<typeof generateRaportPDF>) {
  const doc = await generateRaportPDF(...args);
  const url = doc.output("bloburl");
  const w = window.open(url as any, "_blank");
  if (w) setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
}
