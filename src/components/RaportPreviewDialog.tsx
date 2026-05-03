import { useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Printer, Settings2, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import {
  calculateNilaiTahsinDasar,
  calculateNilaiTahsinLanjutan,
  type TahsinDasarEntry,
  type TahsinLanjutanEntry,
  type TahsinPenaltyConfig,
  type WaqafSymbolTest,
} from "@/data/tahsinScoring";
import { calculateNilaiSurahWithRumus, type TahfizhSurahEntry } from "@/data/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName: string;
  className: string;
  assessorName?: string;
}

const DEFAULT_HEADER = {
  schoolName: "SDIT Luqmanul Hakim",
  programName: "Program Tahfizh & Tahsin Al-Qur'an",
  address: "Jl. Pendidikan No. 1, Indonesia",
  headmaster: "Miftahul Arsyad Asri, S.H",
  headmasterTitle: "Kepala Sekolah",
  nip: "-",
  city: "Jakarta",
};

export default function RaportPreviewDialog({
  open, onClose, ujian, studentName, className, assessorName,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [catatanRapor, setCatatanRapor] = useState<string>(ujian?.nilai_aspek?.catatanGuru || "");
  const [tanggalRapor, setTanggalRapor] = useState<string>(
    ujian?.tanggal || new Date().toISOString().split("T")[0]
  );

  const mode = ujian?.mode as "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan";
  const aspek = ujian?.nilai_aspek || {};
  const predikat = aspek.predikat || (ujian?.nilai_akhir >= 90 ? "Mumtaz" : ujian?.nilai_akhir >= 80 ? "Jiddan Jayyid" : ujian?.nilai_akhir >= 70 ? "Jayyid" : "Perlu Perbaikan");

  const tanggalFmt = useMemo(
    () => new Date(tanggalRapor).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    [tanggalRapor]
  );

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = pdfW;
      const imgH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pdfH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pdfH;
      }
      pdf.save(`Raport_${mode.replace(/\s+/g, "_")}_${studentName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Raport berhasil diunduh");
    } catch (e: any) {
      toast.error("Gagal export PDF: " + (e.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Raport ${studentName}</title>
      <style>body{margin:0;font-family:'Inter',sans-serif;} @page { size: A4; margin: 0; }</style>
      </head><body>${printRef.current.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Raport Ujian {mode}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            <Settings2 className="w-4 h-4 mr-1" /> {editing ? "Tutup Edit" : "Edit Header & Catatan"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Cetak
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </div>
        </div>

        {/* Edit panel */}
        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-md bg-muted/50 border">
            <div className="space-y-1">
              <Label className="text-xs">Nama Sekolah</Label>
              <Input value={header.schoolName} onChange={(e) => setHeader({ ...header, schoolName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Input value={header.programName} onChange={(e) => setHeader({ ...header, programName: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Alamat Sekolah</Label>
              <Input value={header.address} onChange={(e) => setHeader({ ...header, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kepala Sekolah</Label>
              <Input value={header.headmaster} onChange={(e) => setHeader({ ...header, headmaster: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIP / Jabatan</Label>
              <Input value={header.nip} onChange={(e) => setHeader({ ...header, nip: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kota</Label>
              <Input value={header.city} onChange={(e) => setHeader({ ...header, city: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal Raport</Label>
              <Input type="date" value={tanggalRapor} onChange={(e) => setTanggalRapor(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Catatan / Komentar Guru di Raport</Label>
              <Textarea rows={3} value={catatanRapor} onChange={(e) => setCatatanRapor(e.target.value)} />
            </div>
          </div>
        )}

        {/* Raport content (A4 portrait) */}
        <div className="overflow-x-auto">
          <div
            ref={printRef}
            className="mx-auto bg-white text-gray-900"
            style={{ width: "210mm", minHeight: "297mm", padding: "16mm", fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-4 border-emerald-700 pb-3">
              <div className="w-16 h-16 rounded-full border-2 border-emerald-700 flex items-center justify-center">
                <span className="text-emerald-700 font-bold text-xs text-center leading-tight">SDIT<br/>LH</span>
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-xl font-bold text-emerald-800 uppercase tracking-wide">{header.schoolName}</h1>
                <p className="text-sm text-emerald-700 font-medium">{header.programName}</p>
                <p className="text-[10px] text-gray-600">{header.address}</p>
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-amber-600 flex items-center justify-center">
                <span className="text-amber-700 font-bold text-[10px]">قرآن</span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-5">
              <h2 className="text-lg font-bold text-gray-800 tracking-widest">RAPOR HASIL UJIAN</h2>
              <p className="text-base font-semibold text-emerald-700">
                {mode === "Tahfizh" ? "SERTIFIKASI TAHFIZH AL-QUR'AN" : `UJIAN ${mode.toUpperCase()}`}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">No. Dok: RPT/{mode.replace(/\s+/g, "")}/{ujian?.id?.slice(0, 6).toUpperCase()}</p>
            </div>

            {/* Student Info */}
            <table className="w-full text-sm mb-4 border border-gray-300">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-1.5 bg-emerald-50 font-medium w-1/4">Nama Siswa</td>
                  <td className="px-3 py-1.5">{studentName}</td>
                  <td className="px-3 py-1.5 bg-emerald-50 font-medium w-1/4">Kelas</td>
                  <td className="px-3 py-1.5">{className}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 bg-emerald-50 font-medium">Penguji</td>
                  <td className="px-3 py-1.5">{assessorName || "-"}</td>
                  <td className="px-3 py-1.5 bg-emerald-50 font-medium">Tanggal Ujian</td>
                  <td className="px-3 py-1.5">{tanggalFmt}</td>
                </tr>
              </tbody>
            </table>

            {/* Score summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border-2 border-emerald-700 rounded-md p-3 text-center bg-emerald-50">
                <p className="text-[10px] text-gray-600 uppercase">Nilai Akhir</p>
                <p className="text-3xl font-bold text-emerald-800">{ujian?.nilai_akhir}</p>
              </div>
              <div className="border-2 border-amber-600 rounded-md p-3 text-center bg-amber-50">
                <p className="text-[10px] text-gray-600 uppercase">Grade</p>
                <p className="text-3xl font-bold text-amber-700">{ujian?.grade}</p>
              </div>
              <div className={`border-2 rounded-md p-3 text-center ${ujian?.status === "Lulus" ? "border-emerald-700 bg-emerald-50" : "border-red-600 bg-red-50"}`}>
                <p className="text-[10px] text-gray-600 uppercase">Status</p>
                <p className={`text-2xl font-bold mt-1 ${ujian?.status === "Lulus" ? "text-emerald-800" : "text-red-700"}`}>
                  {ujian?.status === "Lulus" ? "✓ LULUS" : "✗ T. LULUS"}
                </p>
                <p className="text-[10px] text-gray-700">Predikat: <strong>{predikat}</strong></p>
              </div>
            </div>

            {/* Detail per mode */}
            {mode === "Tahfizh" && Array.isArray(aspek.surahEntries) && (
              <DetailTahfizh entries={aspek.surahEntries as TahfizhSurahEntry[]} />
            )}
            {mode === "Tahsin Dasar" && Array.isArray(aspek.entries) && (
              <DetailTahsinDasar entries={aspek.entries as TahsinDasarEntry[]} config={aspek.config} />
            )}
            {mode === "Tahsin Lanjutan" && Array.isArray(aspek.entries) && (
              <DetailTahsinLanjutan
                entries={aspek.entries as TahsinLanjutanEntry[]}
                config={aspek.config}
                penaltiWaqaf={aspek.penaltiWaqaf || 2}
                waqafTest={aspek.waqafTest}
              />
            )}

            {/* Catatan */}
            <div className="mt-4 border border-gray-300 rounded-md">
              <div className="bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5">CATATAN GURU / PENGUJI</div>
              <div className="p-3 text-sm min-h-[60px] whitespace-pre-wrap">
                {catatanRapor || "—"}
              </div>
            </div>

            {/* Signature */}
            <div className="grid grid-cols-2 gap-6 mt-8 text-sm">
              <div className="text-center">
                <p>Penguji,</p>
                <div className="h-16" />
                <p className="font-semibold underline">{assessorName || "(........................)"}</p>
                <p className="text-xs text-gray-600">Guru Tahfizh / Tahsin</p>
              </div>
              <div className="text-center">
                <p>{header.city}, {tanggalFmt}</p>
                <p>{header.headmasterTitle},</p>
                <div className="h-12" />
                <p className="font-semibold underline">{header.headmaster}</p>
                <p className="text-xs text-gray-600">NIP: {header.nip}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-500">
              Dokumen ini dikeluarkan secara resmi oleh {header.schoolName} — {header.programName}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Detail Tables ---------- */

function DetailTahfizh({ entries }: { entries: TahfizhSurahEntry[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-emerald-800 mb-2 border-l-4 border-amber-600 pl-2">DETAIL UJIAN SERTIFIKASI TAHFIZH</h3>
      <table className="w-full text-xs border border-gray-300 border-collapse">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="border border-gray-300 px-2 py-1.5 text-left">Surat</th>
            <th className="border border-gray-300 px-2 py-1">Juz</th>
            <th className="border border-gray-300 px-2 py-1">Lahn Jali</th>
            <th className="border border-gray-300 px-2 py-1">Lahn Khofi</th>
            <th className="border border-gray-300 px-2 py-1">Waqaf</th>
            <th className="border border-gray-300 px-2 py-1">Sambung</th>
            <th className="border border-gray-300 px-2 py-1">Lancar</th>
            <th className="border border-gray-300 px-2 py-1">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}>
              <td className="border border-gray-300 px-2 py-1 font-medium">{e.surah}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.juz}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.lahn_jali}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.lahn_khofi}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.waqaf_ibtida ?? 0}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.salah_sambung_ayat ?? 0}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{e.kelancaran}</td>
              <td className="border border-gray-300 px-2 py-1 text-center font-bold text-emerald-700">{calculateNilaiSurahWithRumus(e, "baru")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-1 italic">Rumus: Nilai = Kelancaran − (LJ×2) − (LK×1) − (Waqaf×2) − (Sambung×2)</p>
    </div>
  );
}

function DetailTahsinDasar({ entries, config }: { entries: TahsinDasarEntry[]; config?: TahsinPenaltyConfig }) {
  const cfg = config || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 };
  return (
    <div>
      <h3 className="text-sm font-bold text-emerald-800 mb-2 border-l-4 border-amber-600 pl-2">DETAIL UJIAN TAHSIN DASAR</h3>
      <table className="w-full text-[10px] border border-gray-300 border-collapse">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="border border-gray-300 px-1 py-1 text-left">EBTA</th>
            <th className="border border-gray-300 px-1 py-1">S.Huruf</th>
            <th className="border border-gray-300 px-1 py-1">S.Harakat</th>
            <th className="border border-gray-300 px-1 py-1">S.Tasydid</th>
            <th className="border border-gray-300 px-1 py-1">Mad</th>
            <th className="border border-gray-300 px-1 py-1">Ghunnah</th>
            <th className="border border-gray-300 px-1 py-1">Tajwid</th>
            <th className="border border-gray-300 px-1 py-1">Waqaf</th>
            <th className="border border-gray-300 px-1 py-1">Lancar</th>
            <th className="border border-gray-300 px-1 py-1">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}>
              <td className="border border-gray-300 px-1 py-1 font-medium">{e.nama_ebta}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_huruf}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_harakat}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_makhraj}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_mad}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_ghunnah}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_tajwid}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_waqaf}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kelancaran}</td>
              <td className="border border-gray-300 px-1 py-1 text-center font-bold text-emerald-700">{calculateNilaiTahsinDasar(e, cfg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-1 italic">Rumus: Nilai = Kelancaran − (LJ × {cfg.penalti_lahn_jali}) − (LK × {cfg.penalti_lahn_khofi})</p>
    </div>
  );
}

function DetailTahsinLanjutan({
  entries, config, penaltiWaqaf, waqafTest,
}: { entries: TahsinLanjutanEntry[]; config?: TahsinPenaltyConfig; penaltiWaqaf: number; waqafTest?: WaqafSymbolTest }) {
  const cfg = config || { penalti_lahn_jali: 2, penalti_lahn_khofi: 1, bobot_kelancaran: 40 };
  const waqafLabels: Record<string, string> = {
    waqaf_lazim: "Waqaf Lazim (مـ)",
    waqaf_mustahab: "Waqaf Mustahab (قلى)",
    waqaf_jaiz: "Waqaf Jaiz (ج)",
    waqaf_mujawwaz: "Waqaf Mujawwaz (صلى)",
    waqaf_mamnu: "Waqaf Mamnu' (لا)",
    washol_lazim: "Washol Lazim (∴)",
  };
  return (
    <div>
      <h3 className="text-sm font-bold text-emerald-800 mb-2 border-l-4 border-amber-600 pl-2">DETAIL UJIAN TAHSIN LANJUTAN</h3>
      <table className="w-full text-[10px] border border-gray-300 border-collapse">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="border border-gray-300 px-1 py-1 text-left">Surat</th>
            <th className="border border-gray-300 px-1 py-1">Ayat</th>
            <th className="border border-gray-300 px-1 py-1">S.Huruf</th>
            <th className="border border-gray-300 px-1 py-1">S.Harakat</th>
            <th className="border border-gray-300 px-1 py-1">S.Tasydid</th>
            <th className="border border-gray-300 px-1 py-1">Mad</th>
            <th className="border border-gray-300 px-1 py-1">Ghunnah</th>
            <th className="border border-gray-300 px-1 py-1">Tajwid</th>
            <th className="border border-gray-300 px-1 py-1">Waqaf</th>
            <th className="border border-gray-300 px-1 py-1">Lancar</th>
            <th className="border border-gray-300 px-1 py-1">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}>
              <td className="border border-gray-300 px-1 py-1 font-medium">{e.surah}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.ayat}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_huruf}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_harakat}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.salah_makhraj}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_mad}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_ghunnah}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kesalahan_tajwid}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.waqaf_ibtida}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{e.kelancaran}</td>
              <td className="border border-gray-300 px-1 py-1 text-center font-bold text-emerald-700">{calculateNilaiTahsinLanjutan(e, cfg, penaltiWaqaf)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-1 italic">Rumus: Nilai = Kelancaran − (LJ × {cfg.penalti_lahn_jali}) − (LK × {cfg.penalti_lahn_khofi}) − (Waqaf × {penaltiWaqaf})</p>

      {waqafTest && (
        <div className="mt-3 border border-gray-300 rounded-md overflow-hidden">
          <div className="bg-amber-600 text-white text-xs font-semibold px-3 py-1.5">TES SIMBOL WAQAF</div>
          <div className="grid grid-cols-2 gap-1 p-2 text-[11px]">
            {Object.entries(waqafTest).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-dashed border-gray-200 py-0.5">
                <span>{waqafLabels[k] || k}</span>
                <span className={v ? "text-emerald-700 font-bold" : "text-red-600 font-bold"}>{v ? "✓ Benar" : "✗ Salah"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}