import { loadArabicFont } from "@/utils/loadArabicFont";
import jsPDF from "jspdf";
import type {
  TahsinDasarEntry,
  TahsinLanjutanEntry,
  TahsinPenaltyConfig,
  WaqafSymbolTest,
} from "@/data/tahsinScoring";
import {
  calculateNilaiTahsinDasar,
  calculateNilaiTahsinLanjutan,
} from "@/data/tahsinScoring";
import generateCatatanOtomatis from "@/utils/catatanOtomatis";

interface TahsinExamData {
  studentName: string;
  className: string;
  mode: "Tahsin Dasar" | "Tahsin Lanjutan";
  tanggal: string;
  nilaiAkhir: number;
  status: string;
  grade: string;
  predikat: string;
  assessorName?: string;
  catatanGuru?: string;

  dasarEntries?: TahsinDasarEntry[];
  dasarConfig?: TahsinPenaltyConfig;

  lanjutanEntries?: TahsinLanjutanEntry[];
  lanjutanConfig?: TahsinPenaltyConfig;
  penaltiWaqaf?: number;
  waqafTest?: WaqafSymbolTest;
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

export const generateTahsinPDF = async (data: TahsinExamData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  const w = doc.internal.pageSize.getWidth();
  const margin = 15;

  let y = 20;

  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, w, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`LAPORAN UJIAN ${data.mode.toUpperCase()}`, w / 2, 15, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SDIT Luqmanul Hakim - Program Tahfizh Al-Qur'an", w / 2, 23, {
    align: "center",
  });

  doc.setFontSize(9);

  const formattedDate = new Date(data.tanggal).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.text(formattedDate, w / 2, 30, {
    align: "center",
  });

  y = 45;

  doc.setFillColor(245, 248, 245);
  doc.roundedRect(margin, y, w - margin * 2, 28, 3, 3, "F");
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, w - margin * 2, 28, 3, 3, "S");

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text("Nama Siswa:", margin + 5, y + 8);
  doc.text("Kelas:", margin + 5, y + 16);
  doc.text("Penguji:", margin + 5, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 22, 22);
  doc.setFontSize(11);
  doc.text(data.studentName, margin + 35, y + 8);

  doc.setFontSize(9);
  doc.text(data.className, margin + 35, y + 16);
  doc.text(data.assessorName || "-", margin + 35, y + 24);

  y += 35;

  const boxW = 50;
  const boxH = 20;
  const gap = 8;
  const totalBoxW = boxW * 3 + gap * 2;
  const startX = (w - totalBoxW) / 2;

  const boxes = [
    {
      label: "Nilai Akhir",
      value: String(data.nilaiAkhir),
      color: [22, 101, 52] as [number, number, number],
    },
    {
      label: "Grade",
      value: data.grade,
      color: [30, 80, 160] as [number, number, number],
    },
    {
      label: "Status",
      value: data.status,
      color:
        data.status === "Lulus"
          ? ([22, 101, 52] as [number, number, number])
          : ([180, 50, 50] as [number, number, number]),
    },
  ];

  boxes.forEach((box, i) => {
    const bx = startX + i * (boxW + gap);

    doc.setFillColor(250, 252, 250);
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, "F");

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, "S");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(box.label, bx + boxW / 2, y + 6, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...box.color);
    doc.text(box.value, bx + boxW / 2, y + 17, {
      align: "center",
    });
  });

  y += boxH + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(`Predikat: ${data.predikat}`, w / 2, y, {
    align: "center",
  });

  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 22, 22);
  doc.text("Detail Penilaian", margin, y);

  y += 5;

  if (data.mode === "Tahsin Dasar" && data.dasarEntries && data.dasarConfig) {
    const cols = [
      "EBTA",
      "S.Huruf",
      "S.Harakat",
      "Tasydid",
      "Mad",
      "Qalqalah",
      "Tajwid",
      "Waqaf",
      "Lancar",
      "Nilai",
    ];

    const colWidths = [28, 15, 18, 18, 13, 16, 14, 14, 15, 14];

    let tx = margin;

    doc.setFillColor(22, 101, 52);
    doc.rect(margin, y, w - margin * 2, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");

    cols.forEach((col, i) => {
      doc.text(col, tx + colWidths[i] / 2, y + 5, {
        align: "center",
      });
      tx += colWidths[i];
    });

    y += 7;

    data.dasarEntries.forEach((entry, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const bgColor = idx % 2 === 0 ? [255, 255, 255] : [245, 248, 245];

      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(margin, y, w - margin * 2, 6, "F");

      const nilai = calculateNilaiTahsinDasar(entry, data.dasarConfig!);

      const vals = [
        entry.nama_ebta.replace("Iqra 6 - ", "I6-"),
        String(entry.salah_huruf ?? 0),
        String(entry.salah_harakat ?? 0),
        String(getSalahTasydid(entry)),
        String(entry.kesalahan_mad ?? 0),
        String(getKesalahanQalqalah(entry)),
        String(entry.kesalahan_tajwid ?? 0),
        String(entry.kesalahan_waqaf ?? 0),
        String(entry.kelancaran ?? 0),
        String(nilai),
      ];

      tx = margin;

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");

      vals.forEach((val, i) => {
        doc.text(val, tx + colWidths[i] / 2, y + 4, {
          align: "center",
        });
        tx += colWidths[i];
      });

      y += 6;
    });
  }

  if (
    data.mode === "Tahsin Lanjutan" &&
    data.lanjutanEntries &&
    data.lanjutanConfig
  ) {
    const cols = [
      "Surat",
      "Ayat",
      "S.Huruf",
      "S.Harakat",
      "Tasydid",
      "Mad",
      "Qalqalah",
      "Tajwid",
      "Waqaf",
      "Lancar",
      "Nilai",
    ];

    const colWidths = [25, 14, 15, 17, 17, 13, 16, 14, 13, 15, 14];

    let tx = margin;

    doc.setFillColor(22, 101, 52);
    doc.rect(margin, y, w - margin * 2, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");

    cols.forEach((col, i) => {
      doc.text(col, tx + colWidths[i] / 2, y + 5, {
        align: "center",
      });
      tx += colWidths[i];
    });

    y += 7;

    data.lanjutanEntries.forEach((entry, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const bgColor = idx % 2 === 0 ? [255, 255, 255] : [245, 248, 245];

      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(margin, y, w - margin * 2, 6, "F");

      const nilai = calculateNilaiTahsinLanjutan(
        entry,
        data.lanjutanConfig!,
        data.penaltiWaqaf || 2
      );

      const vals = [
        entry.surah.slice(0, 12),
        entry.ayat.slice(0, 6),
        String(entry.salah_huruf ?? 0),
        String(entry.salah_harakat ?? 0),
        String(getSalahTasydid(entry)),
        String(entry.kesalahan_mad ?? 0),
        String(getKesalahanQalqalah(entry)),
        String(entry.kesalahan_tajwid ?? 0),
        String(entry.waqaf_ibtida ?? 0),
        String(entry.kelancaran ?? 0),
        String(nilai),
      ];

      tx = margin;

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");

      vals.forEach((val, i) => {
        doc.text(val, tx + colWidths[i] / 2, y + 4, {
          align: "center",
        });
        tx += colWidths[i];
      });

      y += 6;
    });

    if (data.waqafTest) {
      y += 5;

      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 22, 22);
      doc.text("Tes Simbol Waqaf", margin, y);

      y += 5;

      const waqafLabels: Record<string, string> = {
        waqaf_lazim: "Waqaf Lazim (مـ)",
        waqaf_mustahab: "Waqaf Mustahab (قلى)",
        waqaf_jaiz: "Waqaf Jaiz (ج)",
        waqaf_mujawwaz: "Waqaf Mujawwaz (صلى)",
        waqaf_mamnu: "Waqaf Mamnu' (لا)",
        waqaf_muanaqah: "Waqaf Muanaqah (∴)",
      };

      const waqafEntries = Object.entries(data.waqafTest);

      doc.setFillColor(7, 94, 84);
      doc.roundedRect(margin, y, w - margin * 2, 10, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text("TES SIMBOL WAQAF", margin + 5, y + 6.5);

      y += 15;

      const columns = 2;
      const cardWidth = 87;
      const cardHeight = 18;
      const gapX = 8;
      const gapY = 6;

      const waqafArabic: Record<string, string> = {
        waqaf_lazim: "مـ",
        waqaf_mustahab: "قلى",
        waqaf_jaiz: "ج",
        waqaf_mujawwaz: "صلى",
        waqaf_mamnu: "لا",
        waqaf_muanaqah: "(∴)",
      };

      waqafEntries.forEach(([key, val], index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        const x = margin + col * (cardWidth + gapX);
        const cardY = y + row * (cardHeight + gapY);

        const label = waqafLabels[key] || key;
        const arabic = waqafArabic[key] || "ۘ";

        const bgColor = val ? [240, 252, 245] : [255, 243, 243];
        const borderColor = val ? [22, 163, 74] : [220, 38, 38];
        const badgeColor = val ? [22, 163, 74] : [220, 38, 38];

        doc.setFillColor(220, 220, 220);
        doc.roundedRect(x + 1, cardY + 1, cardWidth, cardHeight, 3, 3, "F");

        doc.setFillColor(...bgColor);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, "FD");

        doc.setFillColor(...borderColor);
        doc.roundedRect(x + 3, cardY + 3, 14, 12, 2, 2, "F");

        doc.setFont("Amiri", "normal");
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        doc.text(arabic, x + 10, cardY + 10.5, {
          align: "center",
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(35, 35, 35);
        doc.text(label, x + 21, cardY + 7);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        doc.text(val ? "Jawaban Benar" : "Jawaban Salah", x + 21, cardY + 12);

        doc.setFillColor(...badgeColor);
        doc.roundedRect(x + cardWidth - 22, cardY + 4, 18, 6, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(val ? "BENAR" : "SALAH", x + cardWidth - 13, cardY + 8, {
          align: "center",
        });
      });

      y += Math.ceil(waqafEntries.length / columns) * (cardHeight + gapY) + 8;
    }
  }

  let catatan = data.catatanGuru?.trim() || "";

  if (!catatan) {
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

      catatan = generateCatatanOtomatis({
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

      catatan = generateCatatanOtomatis({
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

  if (catatan) {
    y += 5;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 22, 22);
    doc.text("Catatan & Evaluasi:", margin, y);

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    const lines = doc.splitTextToSize(catatan, w - margin * 2 - 4);

    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(
      margin,
      y - 4,
      w - margin * 2,
      lines.length * 4 + 8,
      2,
      2,
      "S"
    );

    doc.text(lines, margin + 2, y);

    y += lines.length * 4 + 10;
  }

  const h = doc.internal.pageSize.getHeight();

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("SDIT Luqmanul Hakim - Program Tahfizh Al-Qur'an", w / 2, h - 10, {
    align: "center",
  });

  doc.save(
    `Ujian_${data.mode.replace(/\s+/g, "_")}_${data.studentName.replace(
      /\s+/g,
      "_"
    )}.pdf`
  );
};