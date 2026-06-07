import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Download, Move, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  DEFAULT_CERTIFICATE_LAYOUT,
  exportCertificateLayout,
  importCertificateLayout,
  saveCertificateLayout,
  type CertificateElementId,
  type CertificateElementLayout,
  type CertificateLayout,
  type CertificateTextAlign,
} from "@/utils/certificateLayout";
import {
  CERTIFICATE_EDITOR_BOUNDS,
  renderCertificateImage,
  type CertificateData,
} from "@/utils/certificateRenderer";

interface CertificateLayoutEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData;
  initialLayout: CertificateLayout;
  onSaved: (layout: CertificateLayout) => void;
}

const EDITABLE_ELEMENTS: Array<{ id: CertificateElementId; label: string }> = [
  { id: "studentName", label: "Nama siswa" },
  { id: "certificateNumber", label: "Nomor sertifikat" },
  { id: "className", label: "Class / Kelas" },
  { id: "juzInfo", label: "Informasi Juz" },
  { id: "qrCode", label: "QR Code" },
  { id: "date", label: "Tanggal" },
];

const FONT_OPTIONS = [
  "Arial",
  "Poppins",
  "Inter",
  "Roboto",
  "Georgia",
  "Times New Roman",
  "Trebuchet MS",
  "Plus Jakarta Sans",
  "Amiri",
];

const cloneLayout = (layout: CertificateLayout): CertificateLayout =>
  JSON.parse(JSON.stringify(layout)) as CertificateLayout;

const CertificateLayoutEditor = ({
  open,
  onOpenChange,
  data,
  initialLayout,
  onSaved,
}: CertificateLayoutEditorProps) => {
  const [layout, setLayout] = useState(() => cloneLayout(initialLayout));
  const [selected, setSelected] = useState<CertificateElementId>("studentName");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{
    id: CertificateElementId;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scale: number;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setLayout(cloneLayout(initialLayout));
  }, [open, initialLayout]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      renderCertificateImage(data, layout)
        .then((url) => {
          if (active) setPreviewUrl(url);
        })
        .catch((error) => {
          console.error("Preview layout sertifikat gagal:", error);
          toast.error("Preview layout gagal dibuat");
        });
    }, 60);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [data, layout, open]);

  const selectedValue = layout[selected];
  const selectedIsQr = selected === "qrCode";

  const updateSelected = (patch: Record<string, string | number>) => {
    setLayout((current) => ({
      ...current,
      [selected]: { ...current[selected], ...patch },
    }));
  };

  const getElementPosition = (id: CertificateElementId) => {
    const value = layout[id];
    return { x: value.x, y: value.y };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: CertificateElementId,
  ) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = getElementPosition(id);
    setSelected(id);
    dragRef.current = {
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
      scale: rect.width / CERTIFICATE_WIDTH,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = Math.round(drag.startX + (event.clientX - drag.startClientX) / drag.scale);
    const y = Math.round(drag.startY + (event.clientY - drag.startClientY) / drag.scale);
    setLayout((current) => ({
      ...current,
      [drag.id]: {
        ...current[drag.id],
        x: Math.max(0, Math.min(CERTIFICATE_WIDTH, x)),
        y: Math.max(0, Math.min(CERTIFICATE_HEIGHT, y)),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveCertificateLayout(layout);
      onSaved(result.layout);
      if (result.synced) {
        toast.success("Layout sertifikat berhasil disimpan");
      } else {
        toast.warning("Layout tersimpan di perangkat ini; sinkronisasi Supabase menunggu migrasi.");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Gagal menyimpan layout sertifikat:", error);
      toast.error("Layout belum tersimpan. Pastikan migrasi database sudah diterapkan.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportCertificateLayout(layout)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "layout-sertifikat-tahfizh.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("File layout berhasil diekspor");
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = importCertificateLayout(JSON.parse(await file.text()));
      setLayout(imported);
      toast.success("Layout berhasil diimpor. Klik Save Layout untuk menyimpan.");
    } catch (error) {
      console.error("File layout tidak dapat diimpor:", error);
      toast.error(error instanceof Error ? error.message : "File layout tidak valid");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const renderNumberField = (
    label: string,
    key: "x" | "y" | "fontSize" | "fontWeight" | "letterSpacing" | "width" | "size",
    min?: number,
    max?: number,
    step = 1,
  ) => (
    <label className="space-y-1 text-xs font-medium">
      <span>{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number((selectedValue as unknown as Record<string, number>)[key] ?? 0)}
        onChange={(event) => updateSelected({ [key]: Number(event.target.value) })}
      />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[94vh] w-[98vw] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Certificate Layout Editor</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-auto bg-slate-100 p-4">
            <div
              ref={previewRef}
              className="relative mx-auto aspect-[4/3] w-full max-w-[1120px] overflow-hidden bg-white shadow-xl"
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview layout sertifikat"
                  className="absolute inset-0 h-full w-full"
                />
              )}
              {EDITABLE_ELEMENTS.map(({ id, label }) => {
                const value = layout[id];
                const bounds = id === "qrCode"
                  ? { width: value.size, height: value.size }
                  : CERTIFICATE_EDITOR_BOUNDS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    title={`Geser ${label}`}
                    onPointerDown={(event) => handlePointerDown(event, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => { dragRef.current = null; }}
                    className={`absolute cursor-move border-2 bg-transparent ${
                      selected === id
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-transparent hover:border-blue-300"
                    }`}
                    style={{
                      left: `${((value.x - bounds.width / 2) / CERTIFICATE_WIDTH) * 100}%`,
                      top: `${((value.y - bounds.height / 2) / CERTIFICATE_HEIGHT) * 100}%`,
                      width: `${(bounds.width / CERTIFICATE_WIDTH) * 100}%`,
                      height: `${(bounds.height / CERTIFICATE_HEIGHT) * 100}%`,
                    }}
                  >
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Move className="h-4 w-4" /> Pilih dan geser kotak elemen. Preview memakai renderer yang sama dengan PDF.
            </p>
          </div>

          <aside className="min-h-0 overflow-y-auto border-l bg-background p-4">
            <div className="space-y-5">
              <label className="space-y-1 text-xs font-medium">
                <span>Elemen</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value as CertificateElementId)}
                >
                  {EDITABLE_ELEMENTS.map((element) => (
                    <option key={element.id} value={element.id}>{element.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {renderNumberField("X Position", "x", 0, CERTIFICATE_WIDTH)}
                {renderNumberField("Y Position", "y", 0, CERTIFICATE_HEIGHT)}
              </div>

              {selectedIsQr ? (
                <div className="space-y-3">
                  <div>{renderNumberField("Ukuran QR", "size", 48, 260)}</div>
                  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    QR Code dapat digeser langsung pada preview atau diatur presisi melalui X Position dan Y Position.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {renderNumberField("Font Size", "fontSize", 8, 96, 0.5)}
                    {renderNumberField("Lebar Maks.", "width", 40, CERTIFICATE_WIDTH)}
                  </div>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Font Family</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={(selectedValue as CertificateElementLayout).fontFamily}
                      onChange={(event) => updateSelected({ fontFamily: event.target.value })}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {renderNumberField("Font Weight", "fontWeight", 400, 800, 100)}
                    {renderNumberField("Letter Spacing", "letterSpacing", -2, 12, 0.1)}
                  </div>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Color</span>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-14 p-1"
                        value={(selectedValue as CertificateElementLayout).color}
                        onChange={(event) => updateSelected({ color: event.target.value })}
                      />
                      <Input
                        value={(selectedValue as CertificateElementLayout).color}
                        onChange={(event) => updateSelected({ color: event.target.value })}
                      />
                    </div>
                  </label>
                  <div className="space-y-1 text-xs font-medium">
                    <span>Text Alignment</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(["left", "center", "right"] as CertificateTextAlign[]).map((align) => (
                        <Button
                          key={align}
                          type="button"
                          size="sm"
                          variant={(selectedValue as CertificateElementLayout).textAlign === align ? "default" : "outline"}
                          onClick={() => updateSelected({ textAlign: align })}
                        >
                          {align}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="flex-wrap border-t px-5 py-3">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export Layout
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Import Layout
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLayout(cloneLayout(DEFAULT_CERTIFICATE_LAYOUT))}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Default
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Menyimpan..." : "Save Layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificateLayoutEditor;
