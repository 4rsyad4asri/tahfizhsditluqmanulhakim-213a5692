import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Download, Printer, Settings2, Loader2, Upload, X, ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  generateRaportPDF, downloadRaportPDF, printRaportPDF,
  type RaportData, type RaportHeader, type RaportAssets, type RaportPdfOptions, type Orientation,
} from "@/utils/raportPdf";
import type { TahsinDasarEntry, TahsinLanjutanEntry, TahsinPenaltyConfig, WaqafSymbolTest } from "@/data/tahsinScoring";
import type { TahfizhSurahEntry } from "@/data/mockData";

interface Props {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName: string;
  className: string;
  assessorName?: string;
}

const STORAGE_KEY = "raport_settings_v3";

const DEFAULT_HEADER: RaportHeader = {
  schoolName: "SDIT Luqmanul Hakim",
  programName: "Program Tahfizh & Tahsin Al-Qur'an",
  address: "Jl. Pendidikan No. 1, Indonesia",
  headmaster: "Miftahul Arsyad Asri, S.H",
  headmasterTitle: "Kepala Sekolah",
  nip: "-",
  city: "Jakarta",
  examinerTitle: "Koordinator Tahfizh",
};

const DEFAULT_OPTS: RaportPdfOptions = {
  orientation: "portrait",
  fontSize: 9,
  tableFontSize: 8,
  showWatermark: false,
  showQR: true,
};

export default function RaportPreviewDialog({ open, onClose, ujian, studentName, className, assessorName }: Props) {
  const [header, setHeader] = useState<RaportHeader>(DEFAULT_HEADER);
  const [assets, setAssets] = useState<RaportAssets>({});
  const [opts, setOpts] = useState<RaportPdfOptions>(DEFAULT_OPTS);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewSeqRef = useRef(0);

  const [catatan, setCatatan] = useState<string>(ujian?.nilai_aspek?.catatanGuru || "");
  const [tanggal, setTanggal] = useState<string>(ujian?.tanggal || new Date().toISOString().split("T")[0]);

  // Load persisted
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.header) setHeader((h) => ({ ...h, ...p.header }));
        if (p.assets) setAssets(p.assets);
        if (p.opts) setOpts((o) => ({ ...o, ...p.opts }));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ header, assets, opts })); } catch {}
  }, [header, assets, opts]);

  useEffect(() => {
    if (open) {
      setCatatan(ujian?.nilai_aspek?.catatanGuru || "");
      setTanggal(ujian?.tanggal || new Date().toISOString().split("T")[0]);
    }
  }, [open, ujian]);

  const data: RaportData = useMemo(() => {
    const aspek = ujian?.nilai_aspek || {};
    const predikat = aspek.predikat || (
      ujian?.nilai_akhir >= 90 ? "Mumtaz" :
      ujian?.nilai_akhir >= 80 ? "Jiddan Jayyid" :
      ujian?.nilai_akhir >= 70 ? "Jayyid" : "Perlu Perbaikan"
    );
    return {
      mode: ujian?.mode,
      studentName, className, assessorName,
      tanggal,
      nilaiAkhir: ujian?.nilai_akhir ?? 0,
      status: ujian?.status ?? "-",
      grade: ujian?.grade ?? "-",
      predikat,
      catatanGuru: catatan,
      tahfizhEntries: aspek.surahEntries as TahfizhSurahEntry[] | undefined,
      dasarEntries: aspek.entries as TahsinDasarEntry[] | undefined,
      dasarConfig: aspek.config as TahsinPenaltyConfig | undefined,
      lanjutanEntries: aspek.entries as TahsinLanjutanEntry[] | undefined,
      lanjutanConfig: aspek.config as TahsinPenaltyConfig | undefined,
      penaltiWaqaf: aspek.penaltiWaqaf,
      waqafTest: aspek.waqafTest as WaqafSymbolTest | undefined,
      ujianId: ujian?.id,
    };
  }, [ujian, studentName, className, assessorName, tanggal, catatan]);

  // Generate preview (single source = jsPDF). Debounced.
  useEffect(() => {
    if (!open || !ujian) return;
    const seq = ++previewSeqRef.current;
    setLoadingPreview(true);
    const t = setTimeout(async () => {
      try {
        const doc = await generateRaportPDF(data, header, assets, opts);
        if (seq !== previewSeqRef.current) return;
        const url = doc.output("bloburl") as unknown as string;
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch (e: any) {
        toast.error("Gagal preview: " + (e?.message || ""));
      } finally {
        if (seq === previewSeqRef.current) setLoadingPreview(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, data, header, assets, opts, ujian]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const onUpload = (key: keyof RaportAssets) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast.error("Ukuran file maksimal 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setAssets((a) => ({ ...a, [key]: reader.result as string }));
    reader.readAsDataURL(f);
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadRaportPDF(data, header, assets, opts);
      toast.success("Raport berhasil diunduh");
    } catch (e: any) {
      toast.error("Gagal export PDF: " + (e?.message || ""));
    } finally { setExporting(false); }
  };

  const handlePrint = async () => {
    try { await printRaportPDF(data, header, assets, opts); }
    catch (e: any) { toast.error("Gagal print: " + (e?.message || "")); }
  };

  if (!ujian) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Raport Ujian {ujian.mode}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              <Settings2 className="w-4 h-4 mr-1" /> {editing ? "Tutup Editor" : "Editor Raport"}
            </Button>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={opts.orientation}
              onChange={(e) => setOpts({ ...opts, orientation: e.target.value as Orientation })}>
              <option value="portrait">A4 Portrait</option>
              <option value="landscape">A4 Landscape</option>
            </select>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={opts.showQR} onCheckedChange={(v) => setOpts({ ...opts, showQR: v })} />
              QR Verifikasi
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={opts.showWatermark} onCheckedChange={(v) => setOpts({ ...opts, showWatermark: v })} />
              Watermark
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Cetak
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </div>
        </div>

        {editing && (
          <div className="space-y-4 p-3 rounded-md bg-muted/50 border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nama Sekolah</Label>
                <Input value={header.schoolName} onChange={(e) => setHeader({ ...header, schoolName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Program</Label>
                <Input value={header.programName} onChange={(e) => setHeader({ ...header, programName: e.target.value })} /></div>
              <div className="space-y-1 md:col-span-2"><Label className="text-xs">Alamat</Label>
                <Input value={header.address} onChange={(e) => setHeader({ ...header, address: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Kepala Sekolah</Label>
                <Input value={header.headmaster} onChange={(e) => setHeader({ ...header, headmaster: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">NIP</Label>
                <Input value={header.nip} onChange={(e) => setHeader({ ...header, nip: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Jabatan Penguji</Label>
                <Input value={header.examinerTitle} onChange={(e) => setHeader({ ...header, examinerTitle: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Kota</Label>
                <Input value={header.city} onChange={(e) => setHeader({ ...header, city: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Tanggal Raport</Label>
                <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></div>
              <div className="space-y-1 md:col-span-2"><Label className="text-xs">Catatan Guru</Label>
                <Textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Ukuran Font Body ({opts.fontSize}pt)</Label>
                <Input type="range" min={7} max={12} value={opts.fontSize}
                  onChange={(e) => setOpts({ ...opts, fontSize: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ukuran Font Tabel ({opts.tableFontSize}pt)</Label>
                <Input type="range" min={6} max={11} value={opts.tableFontSize}
                  onChange={(e) => setOpts({ ...opts, tableFontSize: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
              {([
                ["logoLeft", "Logo Kiri"],
                ["logoRight", "Logo Kanan"],
                ["sigExaminer", "TTD Penguji"],
                ["sigHeadmaster", "TTD Kepsek"],
                ["watermark", "Watermark"],
              ] as [keyof RaportAssets, string][]).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer inline-flex items-center justify-center h-9 px-2 rounded-md border border-input bg-background hover:bg-accent text-xs">
                      {assets[key] ? <ImageIcon className="w-3 h-3 mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                      {assets[key] ? "Ganti" : "Upload"}
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onUpload(key)} />
                    </label>
                    {assets[key] && (
                      <button type="button" onClick={() => setAssets((a) => ({ ...a, [key]: undefined }))}
                        className="h-9 w-9 rounded-md border border-input hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center" title="Hapus">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {assets[key] && <img src={assets[key]} alt={label} className="h-10 mt-1 object-contain bg-white border rounded" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview iframe — exactly the PDF that will be downloaded */}
        <div className="relative bg-muted/30 rounded-md border overflow-hidden" style={{ height: "70vh" }}>
          {loadingPreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm">Memperbarui preview…</span>
            </div>
          )}
          {previewUrl ? (
            <iframe title="Preview Raport PDF" src={previewUrl} className="w-full h-full" style={{ border: 0 }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Memuat preview…
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground italic text-center">
          Preview di atas adalah PDF persis yang akan diunduh & dicetak (single source of truth).
        </p>
      </DialogContent>
    </Dialog>
  );
}