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
import {
  calculateNilaiSurahWithRumus,
  type TahfizhSurahEntry,
} from "@/data/mockData";

export type Orientation = "landscape";

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
  fontSize: number;
  tableFontSize: number;
  showWatermark: boolean;
  showQR: boolean;
  verifyUrl?: string;
}

export interface RaportData {
  mode: "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan";
  studentName: string;
  className: string;
  assessorName?: string;
  tanggal: string;
  nilaiAkhir: number;
  status: string;
  grade: string;
  predikat: string;
  catatanGuru?: string;
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
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

async function makeQR(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    margin: 0,
    width: 240,
    color: {
      dark: "#065f46",
      light: "#ffffff",
    },
  });
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
    const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";

    doc.addImage(
      dataUrl,
      format,
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

function generateNomorDokumen(
  mode: string,
  ujianId?: string
) {
  const now = new Date();

  const ym =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const id =
    (ujianId || Math.random().toString(36).slice(2, 8))
      .slice(0, 6)
      .toUpperCase();

  const code =
    mode.replace(/\s+/g, "").toUpperCase();

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
  nomorDokumen?: string
) {
  const headerH = 26;

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.8);

  doc.line(
    margin,
    margin + headerH,
    pageW - margin,
    margin + headerH
  );

  const logoSize = 18;

  if (assets.logoLeft) {
    safeAddImage(
      doc,
      assets.logoLeft,
      margin,
      margin,
      logoSize,
      logoSize
    );
  }

  if (assets.logoRight) {
    safeAddImage(
      doc,
      assets.logoRight,
      pageW - margin - logoSize,
      margin,
      logoSize,
      logoSize
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...EMERALD);

  doc.text(
    header.schoolName.toUpperCase(),
    pageW / 2,
    margin + 6,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    header.programName,
    pageW / 2,
    margin + 12,
    { align: "center" }
  );

  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);

  doc.text(
    header.address,
    pageW / 2,
    margin + 17,
    { align: "center" }
  );

  const titleY = margin + headerH + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...EMERALD);

  const title =
    data.mode === "Tahfizh"
      ? "RAPOR HASIL UJIAN TAHFIZH AL-QUR'AN"
      : `RAPOR HASIL UJIAN ${data.mode.toUpperCase()}`;

  doc.text(title, pageW / 2, titleY, {
    align: "center",
  });

  if (nomorDokumen) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);

    doc.text(
      `No. Dok: ${nomorDokumen}`,
      pageW / 2,
      titleY + 5,
      { align: "center" }
    );
  }

  if (qrDataUrl) {
    safeAddImage(
      doc,
      qrDataUrl,
      pageW - margin - 18,
      margin + headerH + 2,
      18,
      18
    );

    doc.setFontSize(6);

    doc.text(
      "Verifikasi",
      pageW - margin - 9,
      margin + headerH + 22,
      {
        align: "center",
      }
    );
  }
}

function drawWatermark(
  doc: jsPDF,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions,
  pageW: number,
  pageH: number
) {
  if (!opts.showWatermark) return;

  if (assets.watermark) {
    const w = pageW * 0.45;
    const h = w;

    const gs =
      (doc as any).GState
        ? new (doc as any).GState({
            opacity: 0.05,
          })
        : null;

    if (gs) {
      (doc as any).setGState(gs);
    }

    safeAddImage(
      doc,
      assets.watermark,
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h
    );

    if (gs) {
      (doc as any).setGState(
        new (doc as any).GState({
          opacity: 1,
        })
      );
    }
  } else {
    const gs =
      (doc as any).GState
        ? new (doc as any).GState({
            opacity: 0.04,
          })
        : null;

    if (gs) {
      (doc as any).setGState(gs);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(70);
    doc.setTextColor(...EMERALD);

    doc.text(
      header.schoolName,
      pageW / 2,
      pageH / 2,
      {
        align: "center",
        angle: 30,
      }
    );

    if (gs) {
      (doc as any).setGState(
        new (doc as any).GState({
          opacity: 1,
        })
      );
    }
  }
}

function drawStudentInfo(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  margin: number,
  startY: number,
  opts: RaportPdfOptions
) {
  autoTable(doc, {
    startY,
    margin: {
      left: margin,
      right: margin,
    },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: opts.fontSize - 1,
      cellPadding: 2,
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: 45,
      },
      1: {
        cellWidth: 85,
      },
      2: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: 45,
      },
      3: {
        cellWidth: 85,
      },
    },
    body: [
      [
        "Nama Siswa",
        data.studentName,
        "Kelas",
        data.className,
      ],
      [
        "Penguji",
        data.assessorName || "-",
        "Tanggal Ujian",
        fmtTanggal(data.tanggal),
      ],
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
  const gap = 6;

  const boxW =
    (pageW - margin * 2 - gap * 2) / 3;

  const h = 24;

  const drawCard = (
    x: number,
    title: string,
    value: string,
    color: [number, number, number]
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);

    doc.roundedRect(
      x,
      startY,
      boxW,
      h,
      3,
      3,
      "FD"
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);

    doc.text(
      title.toUpperCase(),
      x + boxW / 2,
      startY + 6,
      {
        align: "center",
      }
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...color);

    doc.text(
      value,
      x + boxW / 2,
      startY + 16,
      {
        align: "center",
      }
    );
  };

  drawCard(
    margin,
    "Nilai Akhir",
    String(data.nilaiAkhir),
    EMERALD
  );

  drawCard(
    margin + boxW + gap,
    "Grade",
    data.grade,
    GOLD
  );

  const statusX =
    margin + (boxW + gap) * 2;

  doc.setDrawColor(...EMERALD);
  doc.setFillColor(255, 255, 255);

  doc.roundedRect(
    statusX,
    startY,
    boxW,
    h,
    3,
    3,
    "FD"
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);

  doc.text(
    "STATUS",
    statusX + boxW / 2,
    startY + 6,
    {
      align: "center",
    }
  );

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
      : "T I D A K  L U L U S";

  doc.text(
    statusText,
    statusX + boxW / 2,
    startY + 14,
    {
      align: "center",
    }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);

  const label = "Predikat : ";

  const labelW =
    doc.getTextWidth(label);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...EMERALD);

  const valueW =
    doc.getTextWidth(data.predikat);

  const totalW =
    labelW + valueW;

  const startX =
    statusX +
    (boxW / 2) -
    totalW / 2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);

  doc.text(
    label,
    startX,
    startY + 20
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...EMERALD);

  doc.text(
    data.predikat,
    startX + labelW,
    startY + 20
  );
}

function sectionTitle(
  doc: jsPDF,
  text: string,
  margin: number,
  y: number
) {
  doc.setFillColor(...GOLD);

  doc.rect(
    margin,
    y,
    2,
    5,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...EMERALD);

  doc.text(
    text,
    margin + 4,
    y + 4
  );

  return y + 7;
}

function drawDetail(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  margin: number,
  startY: number,
  opts: RaportPdfOptions
): number {
  let y = startY;
  const formulaFontSize = 7;
  const EMERALD_RGB = [16, 185, 129]; 

  const tableStyles: any = { 
    font: "helvetica", 
    fontSize: opts.tableFontSize - 1, 
    halign: "center",
    textColor: [50, 50, 50],
    lineColor: [220, 220, 220],
    lineWidth: 0.1,
    cellPadding: 1.5 // Sedikit lebih rapat agar muat 1 halaman
  };
  const headStyles: any = { 
    fillColor: EMERALD_RGB, 
    textColor: [255, 255, 255], 
    fontStyle: "bold",
    lineColor: [255, 255, 255], 
    lineWidth: 0.3
  };

  // 1. DETAIL TABEL (Selalu muncul jika ada data lanjutanEntries)
  if (data.lanjutanEntries && data.lanjutanEntries.length > 0) {
    y = sectionTitle(doc, "DETAIL TAHSIN LANJUTAN", margin, y) || y;
    
    // Filter agar tidak menggambar baris kosong yang berlebihan
    const displayEntries = data.lanjutanEntries.filter(e => e.surah || e.ayat);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Surat", "Ayat", "S.Huruf", "S.Harokat", "S.Makhraj", "Mad", "Qalqalah", "Tajwid", "Waqaf", "Lancar", "Nilai"]],
      body: displayEntries.map((e) => [
        e.surah || "-", e.ayat || "-", 
        e.salah_huruf ?? 0, e.salah_harakat ?? 0, e.salah_makhraj ?? 0, 
        e.kesalahan_mad ?? 0, e.kesalahan_qalqalah ?? 0, e.kesalahan_tajwid ?? 0, 
        e.waqaf_ibtida ?? 0, e.kelancaran ?? 0,
        calculateNilaiTahsinLanjutan(e, data.lanjutanConfig || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 }, data.penaltiWaqaf ?? 2),
      ]),
      styles: tableStyles,
      headStyles: headStyles,
      alternateRowStyles: { fillColor: [250, 250, 250] }
    });

    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFontSize(formulaFontSize);
    doc.setTextColor(100, 100, 100);
    doc.text("*Rumus: Kelancaran - (2 x Lahn Jali) - (1 x Lahn Khofi) - (2 x Waqaf)", margin, y);
    y += 6;
  }

  // 2. TES SIMBOL WAQAF (Kamus Lengkap & Fix Muanaqah)
  if (data.waqafTest) {
    y = sectionTitle(doc, "TES SIMBOL WAQAF", margin, y) || y;
    const entries = Object.entries(data.waqafTest);
    const cols = entries.length; 
    const gap = 2;
    const cardW = (pageW - margin * 2 - (cols - 1) * gap) / (cols || 1);
    const cardH = 10; // Ukuran diperkecil dikit biar naik tanda tangannya

    const waqafArabic: any = { 
      waqaf_lazim: "م", waqaf_mustahab: "قلى", waqaf_jaiz: "ج", 
      waqaf_mujawwaz: "ص", waqaf_mamnu: "لا", waqaf_muanaqah: "ۛ",
      washol_lazim: "ۛ", washal_lazim: "ۛ", wasol_lazim: "ۛ"
    };
    
    const labels: any = { 
      waqaf_lazim: "Lazim", waqaf_mustahab: "Mustahab", waqaf_jaiz: "Jaiz", 
      waqaf_mujawwaz: "Mujawwaz", waqaf_mamnu: "Mamnu'", waqaf_muanaqah: "Muanaqah",
      washol_lazim: "Muanaqah", washal_lazim: "Muanaqah", wasol_lazim: "Muanaqah"
    };

    entries.forEach(([key, val], index) => {
      const x = margin + index * (cardW + gap);
      const color: [number, number, number] = val ? [22, 163, 74] : [220, 38, 38];
      
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.roundedRect(x, y, cardW, cardH, 1, 1, "D");

      // Gunakan lowercase untuk pengecekan sapu jagat
      const k = key.toLowerCase();
      let labelText = labels[key] || labels[k] || key.replace(/_/g, ' ').toUpperCase();
      let symbolText = waqafArabic[key] || waqafArabic[k] || " ";

      if (k.includes("wasol") || k.includes("washol") || k.includes("washal")) {
        labelText = "Muanaqah";
        symbolText = "ۛ";
      }

      doc.setFont("Amiri", "normal");
      doc.setFontSize(9);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(String(symbolText), x + 2.5, y + 6.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(40, 40, 40);
      doc.text(String(labelText), x + 8, y + 4);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(val ? "Benar" : "Salah", x + 8, y + 8);
    });
    y += cardH + 5;
  }

  return y;
}
function drawCatatan(
  doc: jsPDF,
  catatan: string,
  pageW: number,
  margin: number,
  startY: number,
  opts: RaportPdfOptions
): number {
  doc.setFillColor(...EMERALD);

  doc.rect(
    margin,
    startY,
    pageW - margin * 2,
    5,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  doc.text(
    "CATATAN GURU / PENGUJI",
    margin + 2,
    startY + 3.5
  );

  const text = catatan || "—";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(opts.fontSize);
  doc.setTextColor(...GRAY_TEXT);

  const lines =
    doc.splitTextToSize(
      text,
      pageW - margin * 2 - 4
    );

  const blockH =
    Math.max(
      14,
      lines.length *
        (opts.fontSize * 0.45) +
        6
    );

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);

  doc.rect(
    margin,
    startY + 5,
    pageW - margin * 2,
    blockH,
    "S"
  );

  doc.text(
    lines,
    margin + 2,
    startY + 10
  );

  return (
    startY +
    5 +
    blockH +
    5
  );
}

function drawSignatures(
  doc: jsPDF,
  data: RaportData,
  header: RaportHeader,
  pageW: number,
  margin: number,
  startY: number,
  opts: RaportPdfOptions
) {
  const colW = (pageW - margin * 2) / 3;
  const fontSize = opts.fontSize - 1;
  
  const positions = [
    {
      line1: "Mengetahui,",
      line2: "Orang Tua / Wali",
      name: "( ................................. )",
      isParent: true
    },
    {
      line1: "", // Kosongkan baris pertama agar "Penguji" sejajar dengan "Orang Tua"
      line2: "Penguji,",
      name: data.assessorName || "( ................................. )",
      sub: header.examinerTitle,
    },
    {
      line1: `${header.city}, ${fmtTanggal(data.tanggal)}`,
      line2: header.headmasterTitle || "Kepala Sekolah,",
      name: header.headmaster,
      sub: `NIP: ${header.nip}`,
    },
  ];

  positions.forEach((item, i) => {
    const x = margin + colW * i + colW / 2;
    let y = startY + 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0); // Pastikan warna hitam, atau gunakan GRAY_TEXT jika perlu

    // Baris 1: Mengetahui / (Kosong) / Kota, Tanggal
    if (item.line1) {
      doc.text(item.line1, x, y, { align: "center" });
    }

    // Baris 2: Jabatan (Orang Tua / Penguji / Kepala Sekolah)
    y += 5;
    if (item.line2) {
      doc.text(item.line2, x, y, { align: "center" });
    }

    // Nama Terang
    const signY = y + 25; // Jarak untuk tanda tangan
    
    if (item.isParent) {
      // Orang tua biasanya menggunakan tanda kurung tanpa garis bawah
      doc.text(item.name, x, signY, { align: "center" });
    } else {
      // Penguji & Kepsek biasanya Bold + Garis Bawah
      doc.setFont("helvetica", "bold");
      doc.text(item.name, x, signY, { align: "center" });
      
      const nameWidth = doc.getTextWidth(item.name);
      doc.line(x - nameWidth / 2, signY + 1, x + nameWidth / 2, signY + 1);
      
      // NIP atau Sub-keterangan
      if (item.sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize - 1);
        doc.text(item.sub, x, signY + 5, { align: "center" });
      }
    }
  });
}

export async function generateRaportPDF(
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  const pageW =
    doc.internal.pageSize.getWidth();

  const pageH =
    doc.internal.pageSize.getHeight();

  const margin = 10;

  const nomor =
    generateNomorDokumen(
      data.mode,
      data.ujianId
    );

  const verifyText =
    opts.verifyUrl ||
    `${data.mode}|${data.studentName}|${data.tanggal}|${data.nilaiAkhir}|${data.status}|${nomor}`;

  const qrUrl =
    opts.showQR
      ? await makeQR(verifyText)
      : undefined;

  drawWatermark(
    doc,
    header,
    assets,
    opts,
    pageW,
    pageH
  );

  drawHeader(
    doc,
    data,
    header,
    assets,
    pageW,
    margin,
    qrUrl,
    nomor
  );

  let y = 54;

  drawStudentInfo(
    doc,
    data,
    pageW,
    margin,
    y,
    opts
  );

  y =
    (doc as any).lastAutoTable.finalY + 5;

  drawScoreSummary(
    doc,
    data,
    pageW,
    margin,
    y
  );

  y += 30;

  y = drawDetail(
    doc,
    data,
    pageW,
    margin,
    y,
    opts
  );

  y = drawCatatan(
    doc,
    data.catatanGuru || "",
    pageW,
    margin,
    y,
    opts
  );

  if (y > pageH - 42) {
    doc.addPage();

    drawWatermark(
      doc,
      header,
      assets,
      opts,
      pageW,
      pageH
    );

    y = 18;
  }

  drawSignatures(
    doc,
    data,
    header,
    pageW,
    margin,
    y,
    opts
  );

  const totalPages =
    doc.getNumberOfPages();

  for (
    let i = 1;
    i <= totalPages;
    i++
  ) {
    doc.setPage(i);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);

    doc.text(
      `${header.schoolName} — ${header.programName}`,
      pageW / 2,
      pageH - 5,
      {
        align: "center",
      }
    );

    doc.text(
      `Hal ${i} / ${totalPages}`,
      pageW - margin,
      pageH - 5,
      {
        align: "right",
      }
    );

    doc.text(
      nomor,
      margin,
      pageH - 5
    );
  }

  return doc;
}

export async function downloadRaportPDF(
  ...args: Parameters<
    typeof generateRaportPDF
  >
) {
  const data = args[0];

  const doc =
    await generateRaportPDF(...args);

  doc.save(
    `Raport_${data.mode.replace(/\s+/g, "_")}_${data.studentName.replace(/\s+/g, "_")}.pdf`
  );
}

export async function printRaportPDF(
  ...args: Parameters<
    typeof generateRaportPDF
  >
) {
  const doc =
    await generateRaportPDF(...args);

  const url =
    doc.output("bloburl");

  const w = window.open(
    url as any,
    "_blank"
  );

  if (w) {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {}
    }, 700);
  }
}
