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

function generateNomorDokumen(
  mode: string,
  ujianId?: string
) {
  const now = new Date();

  const ym =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const id =
    (ujianId ||
      Math.random()
        .toString(36)
        .slice(2, 8))
      .slice(0, 6)
      .toUpperCase();

  const code =
    mode
      .replace(/\s+/g, "")
      .toUpperCase();

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
  const headerH = 22;

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.5);

  doc.line(
    margin,
    margin + headerH,
    pageW - margin,
    margin + headerH
  );

  const logoSize = 16;

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
  doc.setFontSize(14);
  doc.setTextColor(...EMERALD);

  doc.text(
    header.schoolName.toUpperCase(),
    pageW / 2,
    margin + 5,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(
    header.programName,
    pageW / 2,
    margin + 10,
    { align: "center" }
  );

  doc.setFontSize(7);

  doc.setTextColor(...GRAY_TEXT);

  doc.text(
    header.address,
    pageW / 2,
    margin + 15,
    { align: "center" }
  );

  const titleY = margin + headerH + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  doc.setTextColor(...EMERALD);

  const title =
    data.mode === "Tahfizh"
      ? "RAPOR HASIL UJIAN TAHFIZH AL-QUR'AN"
      : `RAPOR HASIL UJIAN ${data.mode.toUpperCase()}`;

  doc.text(
    title,
    pageW / 2,
    titleY,
    { align: "center" }
  );

  if (nomorDokumen) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    doc.setTextColor(120, 120, 120);

    doc.text(
      `No. Dok: ${nomorDokumen}`,
      pageW / 2,
      titleY + 4,
      { align: "center" }
    );
  }

  if (qrDataUrl) {
    safeAddImage(
      doc,
      qrDataUrl,
      pageW - margin - 15,
      margin + headerH + 1,
      15,
      15
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

    const gs =
      (doc as any).GState
        ? new (doc as any).GState({
            opacity: 0.06,
          })
        : null;

    if (gs) (doc as any).setGState(gs);

    safeAddImage(
      doc,
      assets.watermark,
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h
    );

    if (gs) {
      const reset =
        new (doc as any).GState({
          opacity: 1,
        });

      (doc as any).setGState(reset);
    }
  } else {
    const gs =
      (doc as any).GState
        ? new (doc as any).GState({
            opacity: 0.05,
          })
        : null;

    if (gs) (doc as any).setGState(gs);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(55);

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
        cellWidth:
          (pageW - margin * 2) * 0.16,
      },

      1: {
        cellWidth:
          (pageW - margin * 2) * 0.34,
      },

      2: {
        fillColor: EMERALD_SOFT,
        fontStyle: "bold",
        cellWidth:
          (pageW - margin * 2) * 0.16,
      },

      3: {
        cellWidth:
          (pageW - margin * 2) * 0.34,
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
        "Tanggal",
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
  const gap = 4;

  const boxW =
    (pageW - margin * 2 - gap * 2) / 3;

  const h = 18;

  const draw = (
    x: number,
    label: string,
    value: string,
    color: [number, number, number]
  ) => {
    doc.setDrawColor(...color);

    doc.setLineWidth(0.4);

    doc.roundedRect(
      x,
      startY,
      boxW,
      h,
      2,
      2,
      "D"
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);

    doc.setTextColor(100, 100, 100);

    doc.text(
      label.toUpperCase(),
      x + boxW / 2,
      startY + 4,
      { align: "center" }
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.setTextColor(...color);

    doc.text(
      value,
      x + boxW / 2,
      startY + 11,
      { align: "center" }
    );
  };

  draw(
    margin,
    "Nilai",
    String(data.nilaiAkhir),
    EMERALD
  );

  draw(
    margin + boxW + gap,
    "Grade",
    data.grade,
    GOLD
  );

  const statusColor =
    data.status === "Lulus"
      ? EMERALD
      : [185, 28, 28];

  draw(
    margin + (boxW + gap) * 2,
    "Status",
    data.status.toUpperCase(),
    statusColor as [number, number, number]
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
    1.2,
    4,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.setTextColor(...EMERALD);

  doc.text(
    text,
    margin + 3,
    y + 3
  );

  return y + 5;
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

  if (
    data.mode === "Tahfizh" &&
    data.tahfizhEntries
  ) {
    y =
      sectionTitle(
        doc,
        "DETAIL UJIAN TAHFIZH",
        margin,
        y
      ) || y;

    const head = [[
      "Surat",
      "Juz",
      "LJ",
      "LK",
      "W",
      "S",
      "Lancar",
      "Nilai"
    ]];

    const body: RowInput[] =
      data.tahfizhEntries.map((e) => [
        e.surah,
        String(e.juz),
        String(e.lahn_jali),
        String(e.lahn_khofi),
        String(e.waqaf_ibtida ?? 0),
        String(e.salah_sambung_ayat ?? 0),
        String(e.kelancaran),
        String(
          calculateNilaiSurahWithRumus(
            e,
            "baru"
          )
        ),
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

        7: {
          fontStyle: "bold",
          textColor: EMERALD as any,
        },
      },
    });

    y =
      (doc as any)
        .lastAutoTable.finalY + 2;
  }

  if (
    data.mode === "Tahsin Dasar" &&
    data.dasarEntries
  ) {
    const cfg =
      data.dasarConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    y =
      sectionTitle(
        doc,
        "DETAIL UJIAN TAHSIN DASAR",
        margin,
        y
      ) || y;

    const head = [[
      "EBTA",
      "Huruf",
      "Harakat",
      "Tasydid",
      "Mad",
      "Qalqalah",
      "Tajwid",
      "Waqaf",
      "Lancar",
      "Nilai"
    ]];

    const body: RowInput[] =
      data.dasarEntries.map((e) => [
        e.nama_ebta,
        String(e.salah_huruf),
        String(e.salah_harakat),
        String(e.salah_makhraj),
        String(e.kesalahan_mad),
        String(e.kesalahan_qalqalah),
        String(e.kesalahan_tajwid),
        String(e.kesalahan_waqaf),
        String(e.kelancaran),
        String(
          calculateNilaiTahsinDasar(
            e,
            cfg
          )
        ),
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

    y =
      (doc as any)
        .lastAutoTable.finalY + 2;
  }

  if (
    data.mode === "Tahsin Lanjutan" &&
    data.lanjutanEntries
  ) {
    const cfg =
      data.lanjutanConfig || {
        penalti_lahn_jali: 2,
        penalti_lahn_khofi: 1,
        bobot_kelancaran: 40,
      };

    const pw =
      data.penaltiWaqaf ?? 2;

    y =
      sectionTitle(
        doc,
        "DETAIL UJIAN TAHSIN LANJUTAN",
        margin,
        y
      ) || y;

    const head = [[
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
      "Nilai"
    ]];

    const body: RowInput[] =
      data.lanjutanEntries.map((e) => [
        e.surah,
        e.ayat,
        String(e.salah_huruf),
        String(e.salah_harakat),
        String(e.salah_makhraj),
        String(e.kesalahan_mad),
        String(e.kesalahan_qalqalah),
        String(e.kesalahan_tajwid),
        String(e.waqaf_ibtida),
        String(e.kelancaran),
        String(
          calculateNilaiTahsinLanjutan(
            e,
            cfg,
            pw
          )
        ),
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

    y =
      (doc as any)
        .lastAutoTable.finalY + 2;
  }

  if (data.waqafTest) {
    y =
      sectionTitle(
        doc,
        "TES SIMBOL WAQAF",
        margin,
        y
      ) || y;

    const entries =
      Object.entries(data.waqafTest);

    const cols = entries.length;

    const gap = 2;

    const cardW =
      (
        pageW -
        margin * 2 -
        (cols - 1) * gap
      ) / (cols || 1);

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
      wasol_lazim: "ۛ"
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
      wasol_lazim: "Muanaqah"
    };

    entries.forEach(([key, val], index) => {
      const x =
        margin +
        index * (cardW + gap);

      const color:
        [number, number, number] =
        val
          ? [22, 163, 74]
          : [220, 38, 38];

      doc.setDrawColor(
        color[0],
        color[1],
        color[2]
      );

      doc.roundedRect(
        x,
        y,
        cardW,
        cardH,
        1,
        1,
        "D"
      );

      const k =
        key.toLowerCase();

      let labelText =
        labels[key] ||
        labels[k] ||
        key
          .replace(/_/g, " ")
          .toUpperCase();

      let symbolText =
        waqafArabic[key] ||
        waqafArabic[k] ||
        " ";

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

      doc.setTextColor(
        color[0],
        color[1],
        color[2]
      );

      doc.text(
        String(symbolText),
        x + 2.5,
        y + 6.5
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);

      doc.setTextColor(
        40,
        40,
        40
      );

      doc.text(
        String(labelText),
        x + 8,
        y + 4
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);

      doc.text(
        val
          ? "Benar"
          : "Salah",
        x + 8,
        y + 8
      );
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
  startY: number,
  opts: RaportPdfOptions
): number {
  doc.setFillColor(...EMERALD);

  doc.rect(
    margin,
    startY,
    pageW - margin * 2,
    4,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);

  doc.setTextColor(
    255,
    255,
    255
  );

  doc.text(
    "CATATAN",
    margin + 2,
    startY + 2.8
  );

  const text =
    catatan || "—";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);

  doc.setTextColor(...GRAY_TEXT);

  const lines =
    doc.splitTextToSize(
      text,
      pageW - margin * 2 - 4
    );

  const blockH =
    Math.max(
      10,
      lines.length * 2.8 + 4
    );

  doc.setDrawColor(...GRAY_LINE);

  doc.rect(
    margin,
    startY + 4,
    pageW - margin * 2,
    blockH
  );

  doc.text(
    lines,
    margin + 2,
    startY + 8
  );

  return (
    startY +
    blockH +
    5
  );
}

function drawSignatures(
  doc: jsPDF,
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions,
  pageW: number,
  margin: number,
  startY: number
) {
  const colW =
    (pageW - margin * 2) / 3;

  const positions = [
    {
      title1: "Mengetahui,",
      title2: "Orang Tua/Wali",
      name: "(........................)"
    },

    {
      title1: "Penguji,",
      name:
        data.assessorName ||
        "(........................)",
      sub: header.examinerTitle,
      sig: assets.sigExaminer,
    },

    {
      title1:
        `${header.city}, ${fmtTanggal(data.tanggal)}`,

      title2:
        `${header.headmasterTitle},`,

      name:
        header.headmaster,

      sub:
        `NIP: ${header.nip}`,

      sig:
        assets.sigHeadmaster,
    },
  ];

  positions.forEach((cell, i) => {
    const x =
      margin +
      colW * i +
      colW / 2;

    let y = startY + 3;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(6.8);

    doc.setTextColor(
      ...GRAY_TEXT
    );

    doc.text(
      cell.title1,
      x,
      y,
      {
        align: "center",
      }
    );

    if (cell.title2) {
      y += 3.5;

      doc.text(
        cell.title2,
        x,
        y,
        {
          align: "center",
        }
      );
    }

    const signY =
      y + 12;

    if (cell.sig) {
      safeAddImage(
        doc,
        cell.sig,
        x - 10,
        signY - 9,
        20,
        10
      );
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      cell.name,
      x,
      signY,
      {
        align: "center",
      }
    );

    doc.setLineWidth(0.2);

    doc.line(
      x - 18,
      signY + 0.7,
      x + 18,
      signY + 0.7
    );

    if (cell.sub) {
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(6);

      doc.text(
        cell.sub,
        x,
        signY + 4,
        {
          align: "center",
        }
      );
    }
  });
}

export async function generateRaportPDF(
  data: RaportData,
  header: RaportHeader,
  assets: RaportAssets,
  opts: RaportPdfOptions,
): Promise<jsPDF> {

  const doc =
    new jsPDF({
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

  let y =
    margin + 26;

  drawStudentInfo(
    doc,
    data,
    pageW,
    margin,
    y,
    opts
  );

  y =
    (doc as any)
      .lastAutoTable.finalY + 3;

  drawScoreSummary(
    doc,
    data,
    pageW,
    margin,
    y
  );

  y += 22;

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

  drawSignatures(
    doc,
    data,
    header,
    assets,
    opts,
    pageW,
    margin,
    y
  );

  const totalPages =
    doc.getNumberOfPages();

  for (
    let i = 1;
    i <= totalPages;
    i++
  ) {
    doc.setPage(i);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(6);

    doc.setTextColor(
      140,
      140,
      140
    );

    doc.text(
      `${header.schoolName} — ${header.programName}`,
      pageW / 2,
      pageH - 4,
      {
        align: "center",
      }
    );

    doc.text(
      `Hal ${i}/${totalPages}`,
      pageW - margin,
      pageH - 4,
      {
        align: "right",
      }
    );

    doc.text(
      nomor,
      margin,
      pageH - 4
    );
  }

  return doc;
}

export async function downloadRaportPDF(
  ...args: Parameters<typeof generateRaportPDF>
) {
  const data = args[0];

  const doc =
    await generateRaportPDF(...args);

  doc.save(
    `Raport_${data.mode.replace(/\s+/g, "_")}_${data.studentName.replace(/\s+/g, "_")}.pdf`
  );
}

export async function printRaportPDF(
  ...args: Parameters<typeof generateRaportPDF>
) {
  const doc =
    await generateRaportPDF(...args);

  const url =
    doc.output("bloburl");

  const w =
    window.open(
      url as any,
      "_blank"
    );

  if (w) {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {}
    }, 600);
  }
}
