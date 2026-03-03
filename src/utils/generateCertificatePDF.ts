import jsPDF from "jspdf";

interface CertificateData {
  studentName: string;
  className: string;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
}

const drawIslamicBorder = (doc: jsPDF, w: number, h: number) => {
  // Outer border - emerald green
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(3);
  doc.rect(15, 15, w - 30, h - 30);

  // Inner border - gold
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(1.5);
  doc.rect(20, 20, w - 40, h - 40);

  // Corner ornaments (simple geometric Islamic pattern)
  const cornerSize = 12;
  const corners = [
    [22, 22],
    [w - 22 - cornerSize, 22],
    [22, h - 22 - cornerSize],
    [w - 22 - cornerSize, h - 22 - cornerSize],
  ];

  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(0.8);
  corners.forEach(([x, y]) => {
    // Diamond pattern
    const cx = x + cornerSize / 2;
    const cy = y + cornerSize / 2;
    const s = cornerSize / 2;
    doc.line(cx, cy - s, cx + s, cy);
    doc.line(cx + s, cy, cx, cy + s);
    doc.line(cx, cy + s, cx - s, cy);
    doc.line(cx - s, cy, cx, cy - s);
    // Inner diamond
    const s2 = s * 0.5;
    doc.line(cx, cy - s2, cx + s2, cy);
    doc.line(cx + s2, cy, cx, cy + s2);
    doc.line(cx, cy + s2, cx - s2, cy);
    doc.line(cx - s2, cy, cx, cy - s2);
  });

  // Top decorative line
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  const lineY = 42;
  doc.line(60, lineY, w - 60, lineY);
  doc.line(60, lineY + 1.5, w - 60, lineY + 1.5);
};

export const generateCertificatePDF = (data: CertificateData) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Background - off-white parchment feel
  doc.setFillColor(253, 251, 245);
  doc.rect(0, 0, w, h, "F");

  // Subtle background pattern band
  doc.setFillColor(240, 245, 240);
  doc.rect(0, 55, w, 30, "F");
  doc.rect(0, 130, w, 20, "F");

  // Draw border
  drawIslamicBorder(doc, w, h);

  let y = 32;

  // Bismillah
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(22, 101, 52);
  doc.text("بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ", w / 2, y, { align: "center" });

  y = 52;

  // Title
  doc.setFontSize(28);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text("SERTIFIKAT TAHFIZH AL-QUR'AN", w / 2, y, { align: "center" });

  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(180, 140, 50);
  doc.setFont("helvetica", "normal");
  doc.text("CERTIFICATE OF QUR'AN MEMORIZATION", w / 2, y, { align: "center" });

  y += 5;
  // Decorative line under title
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(0.8);
  doc.line(w / 2 - 50, y, w / 2 + 50, y);

  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`No: ${data.nomorSertifikat}`, w / 2, y, { align: "center" });

  y += 12;
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text("Diberikan kepada:", w / 2, y, { align: "center" });

  y += 14;
  // Student name
  doc.setFontSize(30);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text(data.studentName, w / 2, y, { align: "center" });

  // Underline for name
  const nameWidth = doc.getTextWidth(data.studentName);
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(0.6);
  doc.line(w / 2 - nameWidth / 2 - 5, y + 2, w / 2 + nameWidth / 2 + 5, y + 2);

  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Kelas: ${data.className}`, w / 2, y, { align: "center" });

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Telah menyelesaikan Ujian Sertifikasi Tahfizh Al-Qur'an", w / 2, y, { align: "center" });

  y += 8;
  doc.text(`untuk Juz ${data.juz} dengan hasil:`, w / 2, y, { align: "center" });

  // Score box
  y += 12;
  const boxW = 140;
  const boxH = 22;
  const boxX = (w - boxW) / 2;

  doc.setFillColor(240, 248, 240);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, "F");

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, "S");

  // Score details inside box
  const colW = boxW / 2;
  const midY = y + boxH / 2 + 1;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text("Nilai Akhir", boxX + colW / 2, midY - 4, { align: "center" });
  doc.text("Predikat", boxX + colW + colW / 2, midY - 4, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(22, 101, 52);
  doc.text(String(data.nilaiAkhir), boxX + colW / 2, midY + 5, { align: "center" });

  const predikatColor: Record<string, [number, number, number]> = {
    "Mumtaz": [22, 101, 52],
    "Jiddan Jayyid": [30, 80, 160],
    "Jayyid": [180, 140, 50],
    "Perlu Perbaikan": [180, 50, 50],
  };
  const pColor = predikatColor[data.predikat] || [22, 101, 52];
  doc.setTextColor(...pColor);
  doc.text(data.predikat, boxX + colW + colW / 2, midY + 5, { align: "center" });

  // Separator in box
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(boxX + colW, y + 4, boxX + colW, y + boxH - 4);

  // Date and location
  y += boxH + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const formattedDate = new Date(data.tanggal).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`Ditetapkan pada tanggal ${formattedDate}`, w / 2, y, { align: "center" });

  // Signatures
  y += 12;
  const sigY = y;
  const sigSpacing = 80;

  // Koordinator Tahfizh
  const sig1X = w / 2 - sigSpacing / 2 - 30;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Koordinator Tahfizh", sig1X, sigY, { align: "center" });

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(sig1X - 30, sigY + 20, sig1X + 30, sigY + 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("____________________", sig1X, sigY + 22, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("NIP. _______________", sig1X, sigY + 27, { align: "center" });

  // Kepala Sekolah
  const sig2X = w / 2 + sigSpacing / 2 + 30;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Kepala Sekolah", sig2X, sigY, { align: "center" });

  doc.line(sig2X - 30, sigY + 20, sig2X + 30, sigY + 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("____________________", sig2X, sigY + 22, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("NIP. _______________", sig2X, sigY + 27, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("SDIT Luqmanul Hakim — Program Tahfizh Al-Qur'an", w / 2, h - 22, { align: "center" });

  doc.save(`Sertifikat_${data.studentName.replace(/\s+/g, "_")}.pdf`);
};
