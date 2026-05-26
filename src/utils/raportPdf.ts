import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import QRCode from "qrcode";
import { loadArabicFont } from "@/utils/loadArabicFont";
import generateCatatanOtomatis from "@/utils/catatanOtomatis";
import {
  calculateNilaiTahsinDasar,
  calculateNilaiTahsinLanjutan,
  type TahsinDasarEntry,
  type TahsinLanjutanEntry,
  type TahsinPenaltyConfig,
  type WaqafSymbolTest,
} from "@/data/tahsinScoring";
import type { TahfizhSurahEntry } from "@/data/mockData";
import {
  DEFAULT_TAHFIZH_PENALTY,
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhSummary,
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
} from "@/data/tahfizhSystem";

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
  tahfizhMode?: TahfizhExamMode;
  tahfizhReportType?: "summary" | "detail";
  tahfizhConfig?: TahfizhPenaltyConfig;

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

function getSalahTasydid(entry: any) {
  return Number(entry.salah_tasydid ?? entry.salah_makhraj ?? 0);
}

function getKesalahanQalqalah(entry: any) {
  return Number(entry.kesalahan_qalqalah ?? entry.kesalahan_ghunnah ?? 0);
}

function getRataKelancaran(entries: { kelancaran?: number }[]) {
  if (!entries.length) return 90;

  const total = entries.reduce(
    (a, b) => a + Number(b.kelancaran || 0),
    0
  );

  return Math.round(total / entries.length);
}

function getTahfizhPenaltyConfig(config: any): TahfizhPenaltyConfig {
  return {
    lahnJali: Number(config?.lahnJali ?? config?.penalti_lahn_jali ?? DEFAULT_TAHFIZH_PENALTY.lahnJali),
    lahnKhofi: Number(config?.lahnKhofi ?? config?.penalti_lahn_khofi ?? DEFAULT_TAHFIZH_PENALTY.lahnKhofi),
    waqaf: Number(config?.waqaf ?? config?.penalti_waqaf ?? DEFAULT_TAHFIZH_PENALTY.waqaf),
    salahSambung: Number(config?.salahSambung ?? config?.penalti_salah_sambung ?? DEFAULT_TAHFIZH_PENALTY.salahSambung),
  };
}

function getTahfizhAyatLabel(entry: any) {
  const normalized = normalizeTahfizhAssessment(entry);
  if (normalized.ayatRange) return normalized.ayatRange;
  if (normalized.ayatAwal && normalized.ayatAkhir) return `${normalized.ayatAwal} - ${normalized.ayatAkhir}`;
  if (normalized.ayatAwal) return String(normalized.ayatAwal);
  if (normalized.ayatAkhir) return String(normalized.ayatAkhir);
  return "-";
}

function getTahfizhSummaryRows(data: RaportData) {
  const entries = aggregateTahfizhAssessmentsForDisplay(data.tahfizhEntries || []);
  const summaries = calculateTahfizhSummary(entries, getTahfizhPenaltyConfig(data.tahfizhConfig));
  const ayatByJuz = new Map<number, string>();

  entries.forEach((entry) => {
    const ayat = getTahfizhAyatLabel(entry);
    if (ayat === "-") return;
    const current = ayatByJuz.get(entry.juz);
    ayatByJuz.set(entry.juz, current ? `${current}; ${ayat}` : ayat);
  });

  const isCertificate = data.tahfizhMode === "Sertifikat";
  const head = isCertificate
    ? [["No", "Juz Diujikan", "Kelancaran Rata-rata", "Total Lahn Jali", "Total Lahn Khofi", "Total Waqaf", "Total Salah Sambung", "Nilai Juz"]]
    : [["No", "Juz Diujikan", "Ayat", "Kelancaran Rata-rata", "Total Lahn Jali", "Total Lahn Khofi", "Total Waqaf", "Total Salah Sambung", "Nilai Juz"]];

  const body: RowInput[] = summaries.map((summary, index) => {
    const base = [
      String(index + 1),
      `Juz ${summary.juz}`,
      String(summary.rataKelancaran),
      String(summary.totalLahnJali),
      String(summary.totalLahnKhofi),
      String(summary.totalWaqaf),
      String(summary.totalSalahSambung),
      String(summary.nilaiJuz),
    ];

    if (isCertificate) return base;

    return [
      String(index + 1),
      `Juz ${summary.juz}`,
      ayatByJuz.get(summary.juz) || "-",
      String(summary.rataKelancaran),
      String(summary.totalLahnJali),
      String(summary.totalLahnKhofi),
      String(summary.totalWaqaf),
      String(summary.totalSalahSambung),
      String(summary.nilaiJuz),
    ];
  });

  return { head, body };
}

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
    width: 220,
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
    let fmt: "PNG" | "JPEG" = "JPEG";

    if (dataUrl.startsWith("data:image/png")) {
      fmt = "PNG";
    }

    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, "FAST");
  } catch (err) {
    console.error("Gagal add image:", err);
  }
}

function generateNomorDokumen(mode: string, ujianId?: string) {
  const now = new Date();

  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  const id = (ujianId || Math.random().toString(36).slice(2, 8))
    .slice(0, 6)
    .toUpperCase();

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
  nomorDokumen?: string
) {
  const headerH = 24;

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.7);
  doc.line(margin, margin + headerH, pageW - margin, margin + headerH);

  const logoSize = 17;

  if (assets.logoLeft) {
    safeAddImage(doc, assets.logoLeft, margin, margin, logoSize, logoSize);
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
  doc.setFontSize(14);
  doc.setTextColor(...EMERALD);
  doc.text(header.schoolName.toUpperCase(), pageW / 2, margin + 5, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(header.programName, pageW / 2, margin + 10, {
    align: "center",
  });

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(header.address, pageW / 2, margin + 15, {
    align: "center",
  });

  const titleY = margin + headerH + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
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
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`No. Dok: ${nomorDokumen}`, pageW / 2, titleY + 4, {
      align: "center",
    });
  }

  if (qrDataUrl) {
    safeAddImage(
      doc,
      qrDataUrl,
      pageW - margin - 16,
      margin + headerH + 1,
      16,
      16
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
    const w = pageW * 0.4;
    const h = w;

    const gs = (doc as any).GState
      ? new (doc as any).GState({ opacity: 0.06 })
      : null;

    if (gs) (doc as any).setGState(gs);

    safeAddImage(doc, assets.watermark, (pageW - w) / 2, (pageH - h) / 2, w, h);

    if (gs) {
      const reset = new (doc as any).GState({ opacity: 1 });
      (doc as any).setGState(reset);
    }
  } else {
    const gs = (doc as any).GState
      ? new (doc as any).GState({ opacity: 0.05 })
      : null;

    if (gs) (doc as any).setGState(gs);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(55);
    doc.setTextColor(...EMERALD);
    doc.text(header.schoolName, pageW / 2, pageH / 2, {
      align: "center",
      angle: 30,
    });

    if (gs) {
      (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    }
  }
}

function drawStudentInfo(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  margin: number,
  startY: number
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
      fontSize: 7,
      cellPadding: 1,
      lineColor: GRAY_LINE,
      lineWidth: 0.15,
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: (pageW - margin * 2) * 0.16,
      },
      1: {
        cellWidth: (pageW - margin * 2) * 0.34,
      },
      2: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: (pageW - margin * 2) * 0.16,
      },
      3: {
        cellWidth: (pageW - margin * 2) * 0.34,
      },
    },
    body: [
      ["Nama Siswa", data.studentName, "Kelas", data.className],
      ["Penguji", data.assessorName || "-", "Tanggal", fmtTanggal(data.tanggal)],
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
  const h = 18;
  const centerY = startY + h / 2;

  const drawCard = (
    x: number,
    title: string,
    value: string,
    color: [number, number, number]
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, startY, boxW, h, 2, 2, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(title.toUpperCase(), x + boxW / 2, centerY - 4, {
      align: "center",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...color);
    doc.text(value, x + boxW / 2, centerY + 3, {
      align: "center",
    });
  };

  drawCard(margin, "Nilai", String(data.nilaiAkhir), EMERALD);
  drawCard(margin + boxW + gap, "Grade", data.grade, GOLD);

  const statusX = margin + (boxW + gap) * 2;

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.7);
  doc.roundedRect(statusX, startY, boxW, h, 2, 2, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text("STATUS", statusX + boxW / 2, centerY - 5, {
    align: "center",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...(data.status === "Lulus" ? EMERALD : [220, 38, 38]));
  doc.text(data.status.toUpperCase(), statusX + boxW / 2, centerY + 2, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(120, 120, 120);

  const label = "Predikat : ";
  const labelWidth = doc.getTextWidth(label);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);

  const valueWidth = doc.getTextWidth(data.predikat);
  const totalWidth = labelWidth + valueWidth;
  const startX = statusX + boxW / 2 - totalWidth / 2;
  const predY = startY + 15;

  doc.setFont("helvetica", "normal");
  doc.text(label, startX, predY);
  doc.text(data.predikat, startX + labelWidth, predY);
}

function sectionTitle(doc: jsPDF, text: string, margin: number, y: number) {
  doc.setFillColor(...GOLD);
  doc.rect(margin, y, 1.2, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD);
  doc.text(text, margin + 3, y + 3);

  return y + 5;
}

function drawDetail(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  margin: number,
  startY: number
): number {
  let y = startY;

  if (data.mode === "Tahfizh" && data.tahfizhEntries) {
    if (data.tahfizhReportType === "summary") {
      y = sectionTitle(doc, "RINGKASAN UJIAN TAHFIZH PER JUZ", margin, y) || y;

      const { head, body } = getTahfizhSummaryRows(data);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 6.2,
          cellPadding: 0.9,
          lineColor: GRAY_LINE,
          lineWidth: 0.12,
          halign: "center",
        },
        headStyles: {
          fillColor: EMERALD,
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [247, 254, 250],
        },
        columnStyles: {
          1: { fontStyle: "bold" },
          [data.tahfizhMode === "Sertifikat" ? 7 : 8]: { fontStyle: "bold", textColor: EMERALD as any },
        },
      });

      return (doc as any).lastAutoTable.finalY + 2;
    }

    y = sectionTitle(doc, "DETAIL UJIAN TAHFIZH", margin, y) || y;

    const head = [
      [
        "Surat",
        "Juz",
        "Ayat",
        "Lahn Jali",
        "Lahn Khofi",
        "Waqaf",
        "Sambung ayat",
        "Lancar",
        "Nilai",
      ],
    ];

    const body: RowInput[] = data.tahfizhEntries.map((entry) => {
      const e = normalizeTahfizhAssessment(entry);
      return [
        e.surah,
        String(e.juz),
        getTahfizhAyatLabel(e),
        String(e.lahnJali),
        String(e.lahnKhofi),
        String(e.waqaf ?? 0),
        String(e.salahSambung ?? 0),
        String(e.kelancaran),
        String(calculateTahfizhSurahScore(e, getTahfizhPenaltyConfig(data.tahfizhConfig))),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: {
        left: margin,
        right: margin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6.3,
        cellPadding: 0.8,
        lineColor: GRAY_LINE,
        lineWidth: 0.12,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [247, 254, 250],
      },
      columnStyles: {
        0: {
          halign: "left",
          fontStyle: "bold",
        },
        8: {
          fontStyle: "bold",
          textColor: EMERALD as any,
        },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 2;
  }

  if (data.mode === "Tahsin Dasar" && data.dasarEntries) {
    const cfg =
      data.dasarConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    y = sectionTitle(doc, "DETAIL UJIAN TAHSIN DASAR", margin, y) || y;

    const head = [
      [
        "EBTA",
        "Huruf",
        "Harakat",
        "Tasydid",
        "Mad",
        "Qalqalah",
        "Tajwid",
        "Waqaf",
        "Lancar",
        "Nilai",
      ],
    ];

    const body: RowInput[] = data.dasarEntries.map((e) => [
      e.nama_ebta,
      String(e.salah_huruf ?? 0),
      String(e.salah_harakat ?? 0),
      String(getSalahTasydid(e)),
      String(e.kesalahan_mad ?? 0),
      String(getKesalahanQalqalah(e)),
      String(e.kesalahan_tajwid ?? 0),
      String(e.kesalahan_waqaf ?? 0),
      String(e.kelancaran ?? 0),
      String(calculateNilaiTahsinDasar(e, cfg)),
    ]);

    autoTable(doc, {
      startY: y,
      margin: {
        left: margin,
        right: margin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6,
        cellPadding: 0.8,
        lineColor: GRAY_LINE,
        lineWidth: 0.12,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [247, 254, 250],
      },
      columnStyles: {
        0: {
          halign: "left",
          fontStyle: "bold",
        },
        9: {
          fontStyle: "bold",
          textColor: EMERALD as any,
        },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 2;
  }

  if (data.mode === "Tahsin Lanjutan" && data.lanjutanEntries) {
    const cfg =
      data.lanjutanConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    const pw = data.penaltiWaqaf ?? 2;

    y = sectionTitle(doc, "DETAIL UJIAN TAHSIN LANJUTAN", margin, y) || y;

    const head = [
      [
        "Surat",
        "Ayat",
        "Huruf",
        "Harakat",
        "Tasydid",
        "Mad",
        "Qalqalah",
        "Tajwid",
        "Waqaf",
        "Lancar",
        "Nilai",
      ],
    ];

    const body: RowInput[] = data.lanjutanEntries.map((e) => [
      e.surah,
      e.ayat,
      String(e.salah_huruf ?? 0),
      String(e.salah_harakat ?? 0),
      String(getSalahTasydid(e)),
      String(e.kesalahan_mad ?? 0),
      String(getKesalahanQalqalah(e)),
      String(e.kesalahan_tajwid ?? 0),
      String(e.waqaf_ibtida ?? 0),
      String(e.kelancaran ?? 0),
      String(calculateNilaiTahsinLanjutan(e, cfg, pw)),
    ]);

    autoTable(doc, {
      startY: y,
      margin: {
        left: margin,
        right: margin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 5.8,
        cellPadding: 0.7,
        lineColor: GRAY_LINE,
        lineWidth: 0.12,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [247, 254, 250],
      },
      columnStyles: {
        0: {
          halign: "left",
          fontStyle: "bold",
        },
        10: {
          fontStyle: "bold",
          textColor: EMERALD as any,
        },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 2;
  }

  if (data.waqafTest) {
    y = sectionTitle(doc, "TES SIMBOL WAQAF", margin, y) || y;

    const entries = Object.entries(data.waqafTest);
    const cols = entries.length;
    const gap = 2;
    const cardW = (pageW - margin * 2 - (cols - 1) * gap) / (cols || 1);
    const cardH = 10;

    const waqafArabic: any = {
      waqaf_lazim: "م",
      waqaf_mustahab: "قلى",
      waqaf_jaiz: "ج",
      waqaf_mujawwaz: "ص",
      waqaf_mamnu: "لا",
      waqaf_muanaqah: "ۛ",
      washol_lazim: "ۛ",
      washal_lazim: "ۛ",
      wasol_lazim: "ۛ",
    };

    const labels: any = {
      waqaf_lazim: "Lazim",
      waqaf_mustahab: "Mustahab",
      waqaf_jaiz: "Jaiz",
      waqaf_mujawwaz: "Mujawwaz",
      waqaf_mamnu: "Mamnu'",
      waqaf_muanaqah: "Muanaqah",
      washol_lazim: "Muanaqah",
      washal_lazim: "Muanaqah",
      wasol_lazim: "Muanaqah",
    };

    entries.forEach(([key, val], index) => {
      const x = margin + index * (cardW + gap);
      const color: [number, number, number] = val
        ? [22, 163, 74]
        : [220, 38, 38];

      doc.setDrawColor(color[0], color[1], color[2]);
      doc.roundedRect(x, y, cardW, cardH, 1, 1, "D");

      const k = key.toLowerCase();

      let labelText =
        labels[key] ||
        labels[k] ||
        key.replace(/_/g, " ").toUpperCase();

      let symbolText = waqafArabic[key] || waqafArabic[k] || " ";

      if (
        k.includes("wasol") ||
        k.includes("washol") ||
        k.includes("washal")
      ) {
        labelText = "Muanaqah";
        symbolText = "ۛ";
      }

      doc.setFont("Amiri", "normal");
      doc.setFontSize(9);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(String(symbolText), x + 2.5, y + 6.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(40, 40, 40);
      doc.text(String(labelText), x + 8, y + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.text(val ? "Benar" : "Salah", x + 8, y + 8);
    });

    y += cardH + 4;
  }

  return y;
}

function drawCatatan(
  doc: jsPDF,
  catatan: string,
  pageW: number,
  margin: number,
  startY: number
): number {
  doc.setFillColor(...EMERALD);
  doc.rect(margin, startY, pageW - margin * 2, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("CATATAN", margin + 2, startY + 2.8);

  const text = catatan || "-";
  const isArabicText = /[\u0600-\u06FF]/.test(text);

  doc.setFont(isArabicText ? "Amiri" : "helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setCharSpace(0);
  doc.setLineHeightFactor(1.3);
  doc.setTextColor(...GRAY_TEXT);

  const textWidth = pageW - margin * 2 - 6;
  const lines = doc.splitTextToSize(text, textWidth);
  const lineHeight = isArabicText ? 4.8 : 3;
  const extraPadding = isArabicText ? 6 : 3;
  const blockH = Math.max(
    10,
    lines.length * lineHeight + extraPadding
  );

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(margin, startY + 4, pageW - margin * 2, blockH);

  const centerX = margin + (pageW - margin * 2) / 2;

  if (isArabicText) {
    doc.text(text, centerX, startY + 10, {
      align: "center",
      maxWidth: textWidth,
    });
  } else {
    doc.text(lines, margin + 3, startY + 8.5);
  }

  return startY + 4 + blockH + 5;
}

function drawSignatures(
  doc: jsPDF,
  data: RaportData,
  header: RaportHeader,
  opts: RaportPdfOptions,
  pageW: number,
  margin: number,
  startY: number
) {
  const colW = (pageW - margin * 2) / 3;

  const positions = [
    {
      title1: "Mengetahui,",
      title2: "Orang Tua/Wali",
      name: "(.................................)",
      line: false,
    },
    {
      title1: "Penguji,",
      name: data.assessorName || "(.................................)",
      sub: header.examinerTitle,
      line: true,
    },
    {
      title1: `${header.city}, ${fmtTanggal(data.tanggal)}`,
      title2: `${header.headmasterTitle},`,
      name: header.headmaster,
      sub: `NIP: ${header.nip}`,
      line: true,
    },
  ];

  positions.forEach((p, i) => {
    const x = margin + colW * i + colW / 2;

    let y = startY + 5;

    if (p.title1 === "Penguji,") {
      y += 4;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(opts.fontSize - 1);
    doc.text(p.title1, x, y, {
      align: "center",
    });

    if (p.title2) {
      y += 4;
      doc.text(p.title2, x, y, {
        align: "center",
      });
    }

    const signY = y + 20;

    doc.setFont("helvetica", "bold");
    doc.text(p.name, x, signY - 2, {
      align: "center",
    });

    if (p.line) {
      doc.setLineWidth(0.7);
      doc.line(x - 23, signY, x + 23, signY);
    }

    if (p.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(opts.fontSize - 2);
      doc.text(p.sub, x, signY + 3, {
        align: "center",
      });
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
    orientation: opts.orientation,
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  const nomor = generateNomorDokumen(data.mode, data.ujianId);

  const verifyText =
    opts.verifyUrl ||
    `${data.mode}|${data.studentName}|${data.tanggal}|${data.nilaiAkhir}|${data.status}|${nomor}`;

  const qrUrl = opts.showQR ? await makeQR(verifyText) : undefined;

  drawWatermark(doc, header, assets, opts, pageW, pageH);
  drawHeader(doc, data, header, assets, pageW, margin, qrUrl, nomor);

  let y = margin + 26 + 16;

  drawStudentInfo(doc, data, pageW, margin, y);

  y = (doc as any).lastAutoTable.finalY + 3;

  drawScoreSummary(doc, data, pageW, margin, y);

  y += 22;

  y = drawDetail(doc, data, pageW, margin, y);

  let catatanFinal = data.catatanGuru?.trim() || "";

  if (!catatanFinal) {
    if (data.mode === "Tahfizh") {
      const entries = data.tahfizhEntries || [];

      const totalLahnJali = entries.reduce(
        (a, b) => a + Number(b.lahn_jali || 0),
        0
      );

      const totalLahnKhofi = entries.reduce(
        (a, b) => a + Number(b.lahn_khofi || 0),
        0
      );

      const totalWaqaf = entries.reduce(
        (a, b) => a + Number(b.waqaf_ibtida || 0),
        0
      );

      const totalSambung = entries.reduce(
        (a, b) => a + Number(b.salah_sambung_ayat || 0),
        0
      );

      catatanFinal = generateCatatanOtomatis({
        mode: "Tahfizh",
        nilaiAkhir: data.nilaiAkhir,
        namaSiswa: data.studentName,
        lahnJali: totalLahnJali,
        lahnKhofi: totalLahnKhofi,
        waqaf: totalWaqaf,
        salahSambungAyat: totalSambung,
        kelancaran: getRataKelancaran(entries),
      });
    }

    if (data.mode === "Tahsin Dasar") {
      const entries = data.dasarEntries || [];

      const totalHarakat = entries.reduce(
        (a, b) => a + Number(b.salah_harakat || 0),
        0
      );

      const totalTajwid = entries.reduce(
        (a, b) => a + Number(b.kesalahan_tajwid || 0),
        0
      );

      const totalMad = entries.reduce(
        (a, b) => a + Number(b.kesalahan_mad || 0),
        0
      );

      const totalQalqalah = entries.reduce(
        (a, b) => a + getKesalahanQalqalah(b),
        0
      );

      catatanFinal = generateCatatanOtomatis({
        mode: "Tahsin Dasar",
        nilaiAkhir: data.nilaiAkhir,
        namaSiswa: data.studentName,
        harakat: totalHarakat,
        tajwid: totalTajwid,
        mad: totalMad,
        qalqalah: totalQalqalah,
        kelancaran: getRataKelancaran(entries),
      });
    }

    if (data.mode === "Tahsin Lanjutan") {
      const entries = data.lanjutanEntries || [];

      const totalLahnJali = entries.reduce(
        (a, b) =>
          a +
          Number(b.salah_huruf || 0) +
          Number(b.salah_harakat || 0) +
          getSalahTasydid(b),
        0
      );

      const totalLahnKhofi = entries.reduce(
        (a, b) =>
          a +
          Number(b.kesalahan_tajwid || 0) +
          Number(b.kesalahan_mad || 0) +
          getKesalahanQalqalah(b),
        0
      );

      const totalWaqaf = entries.reduce(
        (a, b) => a + Number(b.waqaf_ibtida || 0),
        0
      );

      catatanFinal = generateCatatanOtomatis({
        mode: "Tahsin Lanjutan",
        nilaiAkhir: data.nilaiAkhir,
        namaSiswa: data.studentName,
        lahnJali: totalLahnJali,
        lahnKhofi: totalLahnKhofi,
        waqaf: totalWaqaf,
        kelancaran: getRataKelancaran(entries),
      });
    }
  }

  y = drawCatatan(doc, catatanFinal, pageW, margin, y);

  drawSignatures(doc, data, header, opts, pageW, margin, y);

  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);

    doc.text(`${header.schoolName} - ${header.programName}`, pageW / 2, pageH - 4, {
      align: "center",
    });

    doc.text(`Hal ${i}/${totalPages}`, pageW - margin, pageH - 4, {
      align: "right",
    });

    doc.text(nomor, margin, pageH - 4);
  }

  return doc;
}

export async function downloadRaportPDF(
  ...args: Parameters<typeof generateRaportPDF>
) {
  const data = args[0];
  const doc = await generateRaportPDF(...args);

  doc.save(
    `Raport_${data.mode.replace(/\s+/g, "_")}_${data.studentName.replace(
      /\s+/g,
      "_"
    )}.pdf`
  );
}

export async function printRaportPDF(
  ...args: Parameters<typeof generateRaportPDF>
) {
  const doc = await generateRaportPDF(...args);
  const url = doc.output("bloburl");

  const w = window.open(url as any, "_blank");

  if (w) {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {}
    }, 600);
  }
}
