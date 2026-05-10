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

  // --- STYLING GLOBAL UNTUK TABEL ---
  const tableStyles = { 
    font: "helvetica", 
    fontSize: opts.tableFontSize - 0.5, 
    halign: "center" as const, // agar typescript tidak komplain
    textColor: [50, 50, 50],   // Teks abu-abu gelap agar lebih nyaman di mata
    lineColor: [220, 220, 220], // Garis body tabel abu-abu lembut
    lineWidth: 0.1
  };
  const headStyles = { 
    fillColor: EMERALD_RGB, 
    textColor: [255, 255, 255], // Teks putih
    fontStyle: "bold" as const,
    lineColor: [255, 255, 255], // Garis pemisah antar kolom header berwarna putih (Tampilan Profesional)
    lineWidth: 0.3              // Ketebalan garis putih header
  };
  const alternateRowStyles = {
    fillColor: [249, 250, 251]  // Efek zebra (belang-belang) sangat tipis agar mudah dibaca
  };

  if (data.mode === "Tahfizh" && data.tahfizhEntries) {
    y = sectionTitle(doc, "DETAIL UJIAN TAHFIZH", margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Surat", "Juz", "Lahn Jali", "Lahn Khofi", "Waqaf & Ibtida", "Sambung Ayat", "Kelancaran", "Nilai"]],
      body: data.tahfizhEntries.map((e) => [
        e.surah || "", e.juz || "", e.lahn_jali, e.lahn_khofi, e.waqaf_ibtida ?? 0, e.salah_sambung_ayat ?? 0, e.kelancaran,
        calculateNilaiSurahWithRumus(e, "baru"),
      ]),
      styles: tableStyles,
      headStyles: headStyles,
      alternateRowStyles: alternateRowStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFontSize(formulaFontSize);
    doc.setTextColor(100, 100, 100);
    doc.text("*Rumus: Kelancaran - (2 x Lahn Jali) - (1 x Lahn Khofi) - (2 x Waqaf & Ibtida) - (2 x Salah Sambung)", margin, y);
    y += 5;
  }

  if (data.mode === "Tahsin Dasar" && data.dasarEntries) {
    y = sectionTitle(doc, "DETAIL TAHSIN DASAR", margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Materi EBTA", "Salah Huruf", "Salah Harakat", "Salah Makhraj", "Mad", "Qalqalah", "Tajwid", "Waqaf", "Kelancaran", "Nilai"]],
      body: data.dasarEntries.map((e) => [
        e.nama_ebta || "", e.salah_huruf, e.salah_harakat, e.salah_makhraj, e.kesalahan_mad, e.kesalahan_qalqalah, e.kesalahan_tajwid, e.kesalahan_waqaf, e.kelancaran,
        calculateNilaiTahsinDasar(e, data.dasarConfig || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 }),
      ]),
      styles: { ...tableStyles, fontSize: opts.tableFontSize - 1 }, // Font sedikit lebih kecil untuk tabel ini
      headStyles: headStyles,
      alternateRowStyles: alternateRowStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFontSize(formulaFontSize);
    doc.setTextColor(100, 100, 100);
    doc.text("*Rumus: Kelancaran - (2 x Lahn Jali) - (1 x Lahn Khofi)", margin, y);
    y += 5;
  }

  if (data.mode === "Tahsin Lanjutan" && data.lanjutanEntries) {
    y = sectionTitle(doc, "DETAIL TAHSIN LANJUTAN", margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Surat", "Ayat", "Salah Huruf", "Salah Harakat", "Salah Makhraj", "Mad", "Qalqalah", "Tajwid", "Waqaf & Ibtida", "Kelancaran", "Nilai"]],
      body: data.lanjutanEntries.map((e) => [
        e.surah || "", e.ayat || "", e.salah_huruf, e.salah_harakat, e.salah_makhraj, e.kesalahan_mad, e.kesalahan_qalqalah, e.kesalahan_tajwid, e.waqaf_ibtida, e.kelancaran,
        calculateNilaiTahsinLanjutan(e, data.lanjutanConfig || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 }, data.penaltiWaqaf ?? 2),
      ]),
      styles: { ...tableStyles, fontSize: opts.tableFontSize - 1 },
      headStyles: headStyles,
      alternateRowStyles: alternateRowStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setFontSize(formulaFontSize);
    doc.setTextColor(100, 100, 100);
    doc.text("*Rumus: Kelancaran - (2 x Lahn Jali) - (1 x Lahn Khofi) - (2 x Waqaf & Ibtida)", margin, y);
    y += 5;

    // --- BAGIAN TES SIMBOL WAQAF ---
    if (data.waqafTest) {
      y = sectionTitle(doc, "TES SIMBOL WAQAF", margin, y);
      const entries = Object.entries(data.waqafTest);
      
      const cols = entries.length > 0 ? entries.length : 6; 
      const gap = 2.5; 
      const cardW = (pageW - margin * 2 - (cols - 1) * gap) / cols;
      const cardH = 10; 

      entries.forEach(([key, val], index) => {
        const col = index % cols;
        const row = Math.floor(index / cols); 
        const x = margin + col * (cardW + gap);
        const cardY = y + row * (cardH + gap);

        const r = val ? 22 : 220;
        const g = val ? 163 : 38;
        const b = val ? 74 : 38;

        doc.setDrawColor(r, g, b);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, cardY, cardW, cardH, 1, 1, "D");

        const waqafArabic: any = { 
          waqaf_lazim: "م", waqaf_mustahab: "قلى", waqaf_jaiz: "ج", 
          waqaf_mujawwaz: "ص", waqaf_mamnu: "لا", waqaf_muanaqah: "ۛ", 
          washal_lazim: "ۛ" 
        };
        const labels: any = { 
          waqaf_lazim: "Lazim", waqaf_mustahab: "Mustahab", waqaf_jaiz: "Jaiz", 
          waqaf_mujawwaz: "Mujawwaz", waqaf_mamnu: "Mamnu'", waqaf_muanaqah: "Muanaqah", 
          washal_lazim: "Muanaqah" 
        };

        doc.setFont("Amiri", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(r, g, b);
        doc.text(waqafArabic[key] || "", x + 2.5, cardY + 6.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(40, 40, 40);
        doc.text(labels[key] || "", x + 8, cardY + 4);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text(val ? "Benar" : "Salah", x + 8, cardY + 8);
      });
      y += Math.ceil(entries.length / cols) * (cardH + gap) + 3;
    }
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
