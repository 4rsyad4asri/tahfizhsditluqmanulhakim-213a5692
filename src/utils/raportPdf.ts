import type { jsPDF } from "jspdf";
import type { RowInput } from "jspdf-autotable";

let autoTableFn: any;
let jsPDFFn: any;

async function initPdfLibs() {
  if (!jsPDFFn) {
    const [jsPDFModule, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable")
    ]);
    jsPDFFn = jsPDFModule.default || (jsPDFModule as any).jsPDF;
    autoTableFn = autoTableModule.default;
  }
  return jsPDFFn;
}

const autoTable = (...args: any[]) => autoTableFn(...args);
import QRCode from "qrcode";
import { loadArabicFont } from "@/utils/loadArabicFont";
import generateCatatanOtomatis from "@/utils/catatanOtomatis";
import { buildVerificationUrlForExam } from "@/utils/verificationUrl";
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
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhSummary,
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  normalizeTahfizhPenaltyConfig,
  type TahfizhExamMode,
  type TahfizhPenaltyConfig,
} from "@/data/tahfizhSystem";
import {
  normalizeRaportVisualLayout,
  type RaportVisualLayout,
} from "@/utils/pdfAssetsLayout";
import {
  normalizeRaportTableLayout,
  type RaportTableLayoutSettings,
} from "@/utils/raportTableLayout";
import { formatClassName } from "@/utils/className";
import { formatStudentName } from "@/utils/formatName";

export type Orientation = "portrait" | "landscape";
export type RaportMode = "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan";

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
  visualLayout?: RaportVisualLayout;
  tableLayout?: RaportTableLayoutSettings;
}

export interface RaportData {
  mode: RaportMode;
  studentName: string;
  className: string;
  nis?: string;
  nisn?: string;
  assessorName?: string;
  tanggal: string;
  nilaiAkhir: number;
  status: string;
  grade: string;
  predikat: string;
  catatanGuru?: string;
  verificationToken?: string;
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
const BLUE: [number, number, number] = [37, 99, 235];
const BLUE_SOFT: [number, number, number] = [239, 246, 255];
const GOLD: [number, number, number] = [180, 140, 50];
const GRAY_LINE: [number, number, number] = [209, 213, 219];
const GRAY_TEXT: [number, number, number] = [55, 65, 81];

function hexToRgb(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return GRAY_TEXT;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

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
  return normalizeTahfizhPenaltyConfig(config);
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
  nomorDokumen?: string,
  verifyUrl?: string,
  visualLayout?: RaportVisualLayout,
) {
  const headerH = 24;

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.7);
  doc.line(margin, margin + headerH, pageW - margin, margin + headerH);

  const layout = visualLayout?.assets;

  if (assets.logoLeft && layout?.leftLogo.visible) {
    safeAddImage(
      doc,
      assets.logoLeft,
      layout.leftLogo.x,
      layout.leftLogo.y,
      layout.leftLogo.width,
      layout.leftLogo.height,
    );
  }

  if (assets.logoRight && layout?.rightLogo.visible) {
    safeAddImage(
      doc,
      assets.logoRight,
      layout.rightLogo.x,
      layout.rightLogo.y,
      layout.rightLogo.width,
      layout.rightLogo.height,
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
  doc.setTextColor(...hexToRgb(visualLayout?.text.color || "#374151"));
  doc.setFont("helvetica", visualLayout?.text.bold ? "bold" : "normal");
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
    doc.text(`No. Dokumen: ${nomorDokumen}`, pageW / 2, titleY + 4, {
      align: "center",
    });
  }

  if (qrDataUrl && layout?.qrCode.visible) {
    const qrX = layout.qrCode.x;
    const qrY = layout.qrCode.y;
    const qrWidth = layout.qrCode.width;
    const qrHeight = layout.qrCode.height;

    safeAddImage(doc, qrDataUrl, qrX, qrY, qrWidth, qrHeight);

    if (verifyUrl) {
      doc.link(qrX, qrY, qrWidth, qrHeight, { url: verifyUrl });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...hexToRgb(visualLayout?.text.color || "#374151"));
    doc.text("Verifikasi Online", qrX + qrWidth / 2, qrY + qrHeight + 2.5, {
      align: "center",
    });
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
  startY: number,
  visualLayout: RaportVisualLayout,
  tableLayout: RaportTableLayoutSettings,
) {
  const textColor = hexToRgb(visualLayout.text.color);
  const tableWidth =
    pageW - tableLayout.tableMarginLeft - tableLayout.tableMarginRight;
  autoTable(doc, {
    startY,
    margin: {
      left: tableLayout.tableMarginLeft,
      right: tableLayout.tableMarginRight,
    },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: tableLayout.studentInfoFontSize,
      cellPadding: {
        top: tableLayout.cellPaddingY,
        bottom: tableLayout.cellPaddingY,
        left: tableLayout.cellPaddingX,
        right: tableLayout.cellPaddingX,
      },
      lineColor: GRAY_LINE,
      lineWidth: tableLayout.lineWidth,
      minCellHeight: tableLayout.rowMinCellHeight,
      textColor,
      fontStyle: visualLayout.text.bold ? "bold" : "normal",
    },
    columnStyles: {
      0: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: tableWidth * 0.16,
      },
      1: {
        cellWidth: tableWidth * 0.34,
      },
      2: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth: tableWidth * 0.16,
      },
      3: {
        cellWidth: tableWidth * 0.34,
      },
    },
    body: [
      ["Nama Siswa", formatStudentName(data.studentName), "Kelas", formatClassName(data.className)],
      ["NIS/NISN", `${data.nis || "-"} / ${data.nisn || "-"}`, "Tanggal", fmtTanggal(data.tanggal)],
    ],
  });
}

function drawScoreSummary(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  startY: number,
  tableLayout: RaportTableLayoutSettings,
) {
  const gap = 4;
  const left = tableLayout.tableMarginLeft;
  const boxW =
    (pageW - left - tableLayout.tableMarginRight - gap * 2) / 3;
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

  drawCard(left, "Nilai", String(data.nilaiAkhir), EMERALD);
  drawCard(left + boxW + gap, "Grade", data.grade, GOLD);

  const statusX = left + (boxW + gap) * 2;

  const statusColor: [number, number, number] =
    data.status === "Lulus" ? BLUE : [220, 38, 38];
  doc.setDrawColor(...statusColor);
  if (data.status === "Lulus") {
    doc.setFillColor(...BLUE_SOFT);
    doc.roundedRect(statusX, startY, boxW, h, 2, 2, "F");
  }
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
  doc.setTextColor(...statusColor);
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

function sectionTitle(
  doc: jsPDF,
  text: string,
  margin: number,
  y: number,
  tableLayout: RaportTableLayoutSettings,
) {
  const titleHeight = Math.max(5, tableLayout.sectionTitleFontSize * 0.55);
  doc.setFillColor(...GOLD);
  doc.rect(margin, y, 1.2, titleHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(tableLayout.sectionTitleFontSize);
  doc.setTextColor(...EMERALD);
  doc.text(text, margin + 3, y + titleHeight * 0.75);

  return y + titleHeight + 1;
}

function drawDetail(
  doc: jsPDF,
  data: RaportData,
  pageW: number,
  startY: number,
  tableLayout: RaportTableLayoutSettings,
): number {
  let y = startY;
  const tableMargin = {
    left: tableLayout.tableMarginLeft,
    right: tableLayout.tableMarginRight,
  };
  const cellPadding = {
    top: tableLayout.cellPaddingY,
    bottom: tableLayout.cellPaddingY,
    left: tableLayout.cellPaddingX,
    right: tableLayout.cellPaddingX,
  };

  if (data.mode === "Tahfizh" && data.tahfizhEntries) {
    if (data.tahfizhReportType === "summary") {
      y = sectionTitle(
        doc,
        "RINGKASAN UJIAN TAHFIZH PER JUZ",
        tableLayout.tableMarginLeft,
        y,
        tableLayout,
      ) || y;

      const { head, body } = getTahfizhSummaryRows(data);

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: tableLayout.summaryBodyFontSize,
          cellPadding,
          lineColor: GRAY_LINE,
          lineWidth: tableLayout.lineWidth,
          minCellHeight: tableLayout.rowMinCellHeight,
          halign: "center",
        },
        headStyles: {
          fillColor: EMERALD,
          textColor: 255,
          fontStyle: "bold",
          fontSize: tableLayout.summaryHeadFontSize,
        },
        alternateRowStyles: {
          fillColor: [247, 254, 250],
        },
        columnStyles: {
          1: { fontStyle: "bold" },
          [data.tahfizhMode === "Sertifikat" ? 7 : 8]: { fontStyle: "bold", textColor: EMERALD as any },
        },
      });

      y = (doc as any).lastAutoTable.finalY + tableLayout.gapAfterDetail;
      return y;
    }

    y = sectionTitle(
      doc,
      "DETAIL UJIAN TAHFIZH",
      tableLayout.tableMarginLeft,
      y,
      tableLayout,
    ) || y;

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
        ...tableMargin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: tableLayout.detailBodyFontSize,
        cellPadding,
        lineColor: GRAY_LINE,
        lineWidth: tableLayout.lineWidth,
        minCellHeight: tableLayout.rowMinCellHeight,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
        fontSize: tableLayout.detailHeadFontSize,
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

    y = (doc as any).lastAutoTable.finalY + tableLayout.gapAfterDetail;
  }

  if (data.mode === "Tahsin Dasar" && data.dasarEntries) {
    const cfg =
      data.dasarConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    y = sectionTitle(
      doc,
      "DETAIL UJIAN TAHSIN DASAR",
      tableLayout.tableMarginLeft,
      y,
      tableLayout,
    ) || y;

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
        ...tableMargin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: tableLayout.detailBodyFontSize,
        cellPadding,
        lineColor: GRAY_LINE,
        lineWidth: tableLayout.lineWidth,
        minCellHeight: tableLayout.rowMinCellHeight,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
        fontSize: tableLayout.detailHeadFontSize,
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

    y = (doc as any).lastAutoTable.finalY + tableLayout.gapAfterDetail;
  }

  if (data.mode === "Tahsin Lanjutan" && data.lanjutanEntries) {
    const cfg =
      data.lanjutanConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    const pw = data.penaltiWaqaf ?? 2;

    y = sectionTitle(
      doc,
      "DETAIL UJIAN TAHSIN LANJUTAN",
      tableLayout.tableMarginLeft,
      y,
      tableLayout,
    ) || y;

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
        ...tableMargin,
      },
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: tableLayout.detailBodyFontSize,
        cellPadding,
        lineColor: GRAY_LINE,
        lineWidth: tableLayout.lineWidth,
        minCellHeight: tableLayout.rowMinCellHeight,
        halign: "center",
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
        fontSize: tableLayout.detailHeadFontSize,
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

    y = (doc as any).lastAutoTable.finalY + tableLayout.gapAfterDetail;
  }

  if (data.waqafTest) {
    y += tableLayout.gapBeforeWaqaf;
    y = sectionTitle(
      doc,
      "TES SIMBOL WAQAF",
      tableLayout.tableMarginLeft,
      y,
      tableLayout,
    ) || y;

    const entries = Object.entries(data.waqafTest);
    const cols = entries.length;
    const gap = 2;
    const cardW =
      (pageW -
        tableLayout.tableMarginLeft -
        tableLayout.tableMarginRight -
        (cols - 1) * gap) /
      (cols || 1);
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
      const x = tableLayout.tableMarginLeft + index * (cardW + gap);
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

    y += cardH + tableLayout.gapAfterWaqaf;
  }

  return y;
}

function drawCatatan(
  doc: jsPDF,
  catatan: string,
  pageW: number,
  startY: number,
  visualLayout: RaportVisualLayout,
  tableLayout: RaportTableLayoutSettings,
): number {
  const left = tableLayout.tableMarginLeft;
  const contentWidth =
    pageW - tableLayout.tableMarginLeft - tableLayout.tableMarginRight;
  const titleHeight = Math.max(
    4,
    tableLayout.catatanTitleFontSize * 0.45 + tableLayout.catatanPadding,
  );
  doc.setFillColor(...EMERALD);
  doc.rect(left, startY, contentWidth, titleHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(tableLayout.catatanTitleFontSize);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "CATATAN",
    left + tableLayout.catatanPadding,
    startY + titleHeight - tableLayout.catatanPadding * 0.45,
  );

  const text = catatan || "-";
  const isArabicText = /[\u0600-\u06FF]/.test(text);

  doc.setFont(
    isArabicText ? "Amiri" : "helvetica",
    visualLayout.text.bold ? "bold" : "normal",
  );
  doc.setFontSize(tableLayout.catatanBodyFontSize);
  doc.setCharSpace(0);
  doc.setLineHeightFactor(tableLayout.catatanLineHeight);
  doc.setTextColor(...hexToRgb(visualLayout.text.color));

  const textWidth = contentWidth - tableLayout.catatanPadding * 2;
  const lines = doc.splitTextToSize(text, textWidth);
  const lineHeight =
    tableLayout.catatanBodyFontSize *
    (isArabicText ? 0.55 : 0.4) *
    tableLayout.catatanLineHeight;
  const extraPadding =
    tableLayout.catatanPadding * (isArabicText ? 2 : 1.5);
  const blockH = Math.max(
    10,
    lines.length * lineHeight + extraPadding
  );

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(left, startY + titleHeight, contentWidth, blockH);

  const centerX = left + contentWidth / 2;

  if (isArabicText) {
    doc.text(text, centerX, startY + titleHeight + tableLayout.catatanPadding + lineHeight, {
      align: "center",
      maxWidth: textWidth,
    });
  } else {
    doc.text(
      lines,
      left + tableLayout.catatanPadding,
      startY + titleHeight + tableLayout.catatanPadding + lineHeight * 0.8,
    );
  }

  return startY + titleHeight + blockH + 5;
}

function drawSignatures(
  doc: jsPDF,
  data: RaportData,
  header: RaportHeader,
  opts: RaportPdfOptions,
  pageW: number,
  pageH: number,
  margin: number,
  startY: number,
  assets: RaportAssets,
  visualLayout: RaportVisualLayout,
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

    doc.setFont("helvetica", visualLayout.text.bold ? "bold" : "normal");
    doc.setFontSize(opts.fontSize - 1);
    doc.setTextColor(...hexToRgb(visualLayout.text.color));
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

  const imageLayout = visualLayout.assets;
  const autoSignatureY = (height: number, offsetY = 0) =>
    Math.min(pageH - height - 10, Math.max(margin, startY + 8 + offsetY));
  const examinerSignatureY = imageLayout.examinerSignature.placement === "auto"
    ? autoSignatureY(imageLayout.examinerSignature.height, imageLayout.examinerSignature.offsetY)
    : imageLayout.examinerSignature.y;
  const headmasterSignatureY = imageLayout.headmasterSignature.placement === "auto"
    ? autoSignatureY(imageLayout.headmasterSignature.height, imageLayout.headmasterSignature.offsetY)
    : imageLayout.headmasterSignature.y;

  if (assets.sigExaminer && imageLayout.examinerSignature.visible) {
    safeAddImage(
      doc,
      assets.sigExaminer,
      imageLayout.examinerSignature.x,
      examinerSignatureY,
      imageLayout.examinerSignature.width,
      imageLayout.examinerSignature.height,
    );
  }
  if (assets.sigHeadmaster && imageLayout.headmasterSignature.visible) {
    safeAddImage(
      doc,
      assets.sigHeadmaster,
      imageLayout.headmasterSignature.x,
      headmasterSignatureY,
      imageLayout.headmasterSignature.width,
      imageLayout.headmasterSignature.height,
    );
  }
}

export async function generateRaportPDF(
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions
): Promise<jsPDF> {
  data = {
    ...data,
    studentName: formatStudentName(data.studentName),
  };
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const visualLayout = normalizeRaportVisualLayout(
    opts.visualLayout,
    opts.orientation,
  );
  const normalizedTableLayout = normalizeRaportTableLayout(
    opts.tableLayout,
    opts.orientation,
  );
  const legacyTableFontSize = Number(opts.tableFontSize);
  const tableLayout = opts.tableLayout || !Number.isFinite(legacyTableFontSize)
    ? normalizedTableLayout
    : {
        ...normalizedTableLayout,
        detailBodyFontSize: legacyTableFontSize,
        detailHeadFontSize: legacyTableFontSize,
        summaryBodyFontSize: legacyTableFontSize,
        summaryHeadFontSize: legacyTableFontSize,
      };
  const effectiveOpts: RaportPdfOptions = {
    ...opts,
    verifyUrl: opts.verifyUrl,
    visualLayout,
    tableLayout,
  };

  const nomor = generateNomorDokumen(data.mode, data.ujianId);

  const effectiveVerifyUrl =
    opts.verifyUrl ||
    buildVerificationUrlForExam(
      {
        mode: data.mode,
        tahfizhMode: data.tahfizhMode,
      },
      data.verificationToken
    );
  const verifyText =
    effectiveVerifyUrl ||
    `${data.mode}|${data.studentName}|${data.tanggal}|${data.nilaiAkhir}|${data.status}|${nomor}`;

  effectiveOpts.verifyUrl = effectiveVerifyUrl;

  const qrUrl = effectiveOpts.showQR && visualLayout.assets.qrCode.visible
    ? await makeQR(verifyText)
    : undefined;

  drawWatermark(doc, header, assets, effectiveOpts, pageW, pageH);
  drawHeader(
    doc,
    data,
    header,
    assets,
    pageW,
    margin,
    qrUrl,
    nomor,
    effectiveVerifyUrl,
    visualLayout,
  );

  let y = margin + 26 + 16;

  drawStudentInfo(doc, data, pageW, y, visualLayout, tableLayout);

  y = (doc as any).lastAutoTable.finalY + tableLayout.gapAfterStudentInfo;

  drawScoreSummary(doc, data, pageW, y, tableLayout);

  y += 18 + tableLayout.gapAfterScoreSummary;
  y += tableLayout.gapBeforeDetail;

  y = drawDetail(doc, data, pageW, y, tableLayout);

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

  y += tableLayout.gapBeforeCatatan;
  y = drawCatatan(
    doc,
    catatanFinal,
    pageW,
    y,
    visualLayout,
    tableLayout,
  );

  drawSignatures(
    doc,
    data,
    header,
    effectiveOpts,
    pageW,
    pageH,
    margin,
    y,
    assets,
    visualLayout,
  );

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
    `Raport_${data.mode.replace(/\s+/g, "_")}_${formatStudentName(data.studentName).replace(
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
