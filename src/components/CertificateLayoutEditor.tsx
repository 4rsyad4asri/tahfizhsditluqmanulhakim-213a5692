import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Download, Minus, Move, Plus, RotateCcw, Save, Upload } from "lucide-react";
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
  type CertificateImageLayout,
  type CertificateLayout,
  type CertificateQrLayout,
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
  { id: "finalScore", label: "Nilai Akhir / Final Score" },
  { id: "grade", label: "Predikat / Grade" },
  { id: "qrCode", label: "QR Code" },
  { id: "date", label: "Tanggal" },
  { id: "coordinatorSignature", label: "TTD Koordinator Tahfizh" },
  { id: "coordinatorName", label: "Nama Koordinator" },
  { id: "coordinatorTitle", label: "Jabatan Koordinator" },
  { id: "principalSignature", label: "TTD Kepala Sekolah" },
  { id: "principalName", label: "Nama Kepala Sekolah" },
  { id: "principalTitle", label: "Jabatan Kepala Sekolah" },
  { id: "leftLogo", label: "Logo Kiri" },
  { id: "rightLogo", label: "Logo Kanan" },
];

const IMAGE_ELEMENT_IDS: CertificateElementId[] = [
  "coordinatorSignature",
  "principalSignature",
  "leftLogo",
  "rightLogo",
];

const PREVIEW_SCENARIOS = [
  {
    id: "current",
    label: "Data sertifikat aktif",
    patch: {},
  },
  {
    id: "normal",
    label: "Contoh nama pendek - Jayyid",
    patch: { studentName: "Ahmad Fauzan", predikat: "Jayyid" },
  },
  {
    id: "long-grade",
    label: "Predikat panjang - Jayyid Jiddan",
    patch: { studentName: "Ahmad Fauzan", predikat: "Jayyid Jiddan" },
  },
  {
    id: "very-long-grade",
    label: "Predikat sangat panjang - Mumtaz Murtafi",
    patch: { studentName: "Ahmad Fauzan", predikat: "Mumtaz Murtafi" },
  },
  {
    id: "long-name",
    label: "Nama siswa panjang",
    patch: {
      studentName: "Muhammad Abdurrahman Al-Fatih",
      predikat: "Jayyid Jiddan",
    },
  },
] as const;

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
  const [previewScenario, setPreviewScenario] = useState("current");
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
  const previewData = useMemo(() => {
    const scenario = PREVIEW_SCENARIOS.find((item) => item.id === previewScenario);
    return { ...data, ...(scenario?.patch ?? {}) };
  }, [data, previewScenario]);

  useEffect(() => {
    if (open) {
      setLayout(cloneLayout(initialLayout));
      setPreviewScenario("current");
    }
  }, [open, initialLayout]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      renderCertificateImage(previewData, layout)
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
  }, [layout, open, previewData]);

  const selectedValue = layout[selected];
  const selectedIsQr = selected === "qrCode";
  const selectedIsImage = IMAGE_ELEMENT_IDS.includes(selected);
  const selectedLabel = EDITABLE_ELEMENTS.find((element) => element.id === selected)?.label
    ?? selected;

  const updateSelected = (patch: Record<string, string | number>) => {
    setLayout((current) => ({
      ...current,
      [selected]: { ...current[selected], ...patch },
    }));
  };

  const adjustSelectedImage = (widthDelta: number, heightDelta: number) => {
    if (!selectedIsImage) return;
    const image = selectedValue as CertificateImageLayout;
    updateSelected({
      width: Math.max(40, Math.min(600, image.width + widthDelta)),
      height: Math.max(20, Math.min(600, image.height + heightDelta)),
    });
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
    const rawX = Math.round(drag.startX + (event.clientX - drag.startClientX) / drag.scale);
    const rawY = Math.round(drag.startY + (event.clientY - drag.startClientY) / drag.scale);
    const x = Math.abs(rawX - CERTIFICATE_WIDTH / 2) <= 10
      ? CERTIFICATE_WIDTH / 2
      : rawX;
    const y = Math.abs(rawY - CERTIFICATE_HEIGHT / 2) <= 10
      ? CERTIFICATE_HEIGHT / 2
      : rawY;
    setLayout((current) => ({
      ...current,
      [drag.id]: {
        ...current[drag.id],
        x: Math.max(0, Math.min(CERTIFICATE_WIDTH, x)),
        y: Math.max(0, Math.min(CERTIFICATE_HEIGHT, y)),
      },
    }));
  };

  const handlePreviewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const xDelta = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
    const yDelta = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    setLayout((current) => {
      const value = current[selected];
      return {
        ...current,
        [selected]: {
          ...value,
          x: Math.max(0, Math.min(CERTIFICATE_WIDTH, value.x + xDelta)),
          y: Math.max(0, Math.min(CERTIFICATE_HEIGHT, value.y + yDelta)),
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveCertificateLayout(layout);
      onSaved(result.layout);
      if (result.synced) {
        toast.success(
          result.localSaved
            ? "Layout tersimpan di perangkat dan tersinkron ke Supabase"
            : "Layout tersinkron ke Supabase, tetapi localStorage tidak tersedia",
        );
      } else if (result.localSaved) {
        toast.warning(
          `Layout tersimpan di perangkat, tetapi Supabase gagal: ${result.errorMessage}`,
        );
      } else {
        toast.error(
          `Layout belum dapat disimpan. Supabase gagal: ${result.errorMessage}`,
        );
      }
      if (result.synced || result.localSaved) onOpenChange(false);
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
      toast.success("Layout berhasil diimpor. Klik Simpan Layout untuk menyimpan.");
    } catch (error) {
      console.error("File layout tidak dapat diimpor:", error);
      toast.error(error instanceof Error ? error.message : "File layout tidak valid");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const renderNumberField = (
    label: string,
    key: "x" | "y" | "fontSize" | "fontWeight" | "letterSpacing" | "width" | "height" | "size",
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
              tabIndex={0}
              onKeyDown={handlePreviewKeyDown}
              className="relative mx-auto aspect-[4/3] w-full max-w-[1120px] overflow-hidden bg-white shadow-xl"
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview layout sertifikat"
                  className="absolute inset-0 h-full w-full"
                />
              )}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 border-l border-dashed border-blue-400/50" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 border-t border-dashed border-blue-400/50" />
              <div className="pointer-events-none absolute inset-[6%] z-10 border border-dashed border-amber-500/60" />
              {EDITABLE_ELEMENTS.map(({ id, label }) => {
                const value = layout[id];
                const bounds = id === "qrCode"
                  ? {
                      width: (value as CertificateQrLayout).size,
                      height: (value as CertificateQrLayout).size,
                    }
                  : IMAGE_ELEMENT_IDS.includes(id)
                    ? {
                        width: (value as CertificateImageLayout).width,
                        height: (value as CertificateImageLayout).height,
                      }
                    : {
                        width: (value as CertificateElementLayout).width,
                        height: CERTIFICATE_EDITOR_BOUNDS[id].height,
                      };
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
                    {selected === id && (
                      <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white shadow">
                        {label}
                      </span>
                    )}
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Move className="h-4 w-4" /> Geser elemen atau gunakan panah (Shift = 10px). Garis kuning menandai safe area.
            </p>
          </div>

          <aside className="min-h-0 overflow-y-auto border-l bg-background p-4">
            <div className="space-y-5">
              <label className="space-y-1 text-xs font-medium">
                <span>Data contoh preview</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={previewScenario}
                  onChange={(event) => setPreviewScenario(event.target.value)}
                >
                  {PREVIEW_SCENARIOS.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                  ))}
                </select>
              </label>

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
              ) : selectedIsImage ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-3 text-xs font-semibold">Ukuran {selectedLabel}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => adjustSelectedImage(-20, -8)}
                      >
                        <Minus className="mr-1 h-4 w-4" /> Perkecil
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => adjustSelectedImage(20, 8)}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Perbesar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => adjustSelectedImage(-20, 0)}
                      >
                        <Minus className="mr-1 h-4 w-4" /> Persempit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => adjustSelectedImage(20, 0)}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Perlebar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {renderNumberField("Lebar", "width", 40, 600)}
                    {renderNumberField("Tinggi", "height", 20, 600)}
                  </div>

                  <label className="space-y-1 text-xs font-medium">
                    <span>Geser lebar: {(selectedValue as CertificateImageLayout).width}px</span>
                    <Input
                      type="range"
                      min={40}
                      max={600}
                      step={5}
                      value={(selectedValue as CertificateImageLayout).width}
                      onChange={(event) => updateSelected({ width: Number(event.target.value) })}
                      className="h-8 cursor-pointer px-0"
                    />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>Geser tinggi: {(selectedValue as CertificateImageLayout).height}px</span>
                    <Input
                      type="range"
                      min={20}
                      max={600}
                      step={2}
                      value={(selectedValue as CertificateImageLayout).height}
                      onChange={(event) => updateSelected({ height: Number(event.target.value) })}
                      className="h-8 cursor-pointer px-0"
                    />
                  </label>

                  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Posisi dan ukuran {selectedLabel} tersimpan sebagai bagian dari layout sertifikat.
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
            <Download className="mr-2 h-4 w-4" /> Export Layout JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Import Layout JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLayout(cloneLayout(DEFAULT_CERTIFICATE_LAYOUT))}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset ke Default
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan Layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificateLayoutEditor;
