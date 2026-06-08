import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Eye, EyeOff, Move, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getDefaultRaportVisualLayout,
  PDF_PAGE_SIZE,
  type PdfAssetsLayout,
  type PdfAssetPosition,
  type RaportVisualLayout,
} from "@/utils/pdfAssetsLayout";
import type { Orientation, RaportAssets } from "@/utils/raportPdf";

GlobalWorkerOptions.workerSrc = pdfWorker;

type AssetId = keyof PdfAssetsLayout;

interface Props {
  orientation: Orientation;
  assets: RaportAssets;
  layout: RaportVisualLayout;
  pdfBlob: Blob | null;
  onChange: (layout: RaportVisualLayout) => void;
  onSave: () => void;
  onApply: () => void;
  onPreviewAgain: () => void;
}

const ASSET_LABELS: Record<AssetId, string> = {
  leftLogo: "Logo kiri",
  rightLogo: "Logo kanan",
  examinerSignature: "TTD guru/penguji",
  headmasterSignature: "TTD kepala sekolah",
  qrCode: "QR Code",
};

const assetSource = (id: AssetId, assets: RaportAssets) => {
  if (id === "leftLogo") return assets.logoLeft;
  if (id === "rightLogo") return assets.logoRight;
  if (id === "examinerSignature") return assets.sigExaminer;
  if (id === "headmasterSignature") return assets.sigHeadmaster;
  return undefined;
};

export default function PdfAssetsLayoutEditor({
  orientation,
  assets,
  layout,
  pdfBlob,
  onChange,
  onSave,
  onApply,
  onPreviewAgain,
}: Props) {
  const [selected, setSelected] = useState<AssetId>("leftLogo");
  const [rendering, setRendering] = useState(false);
  const [previewFallbackUrl, setPreviewFallbackUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    type: "drag" | "resize";
    id: AssetId;
    startX: number;
    startY: number;
    start: PdfAssetPosition;
    ratio: number;
  } | null>(null);
  const page = PDF_PAGE_SIZE[orientation];
  const selectedAsset = layout.assets[selected];

  useEffect(() => {
    if (!pdfBlob || !canvasRef.current) return;
    let active = true;
    const fallbackUrl = URL.createObjectURL(pdfBlob);
    setPreviewFallbackUrl(null);
    setRendering(true);

    const timeout = window.setTimeout(() => {
      if (!active) return;
      setPreviewFallbackUrl(`${fallbackUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`);
      setRendering(false);
    }, 5000);

    pdfBlob.arrayBuffer()
      .then((buffer) => getDocument({ data: buffer }).promise)
      .then((pdf) => pdf.getPage(1))
      .then(async (pdfPage) => {
        if (!active || !canvasRef.current) return;
        const viewport = pdfPage.getViewport({ scale: 1.65 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: context, viewport, canvas } as any).promise;
      })
      .catch(() => {
        if (active) {
          setPreviewFallbackUrl(`${fallbackUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`);
        }
      })
      .finally(() => {
        if (active) {
          window.clearTimeout(timeout);
          setRendering(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(fallbackUrl);
    };
  }, [pdfBlob]);

  const updateAsset = (id: AssetId, patch: Partial<PdfAssetPosition>) => {
    const current = layout.assets[id];
    const width = Math.min(page.width, Math.max(4, Number(patch.width ?? current.width)));
    const height = Math.min(page.height, Math.max(4, Number(patch.height ?? current.height)));
    const x = Math.min(page.width - width, Math.max(0, Number(patch.x ?? current.x)));
    const y = Math.min(page.height - height, Math.max(0, Number(patch.y ?? current.y)));
    onChange({
      ...layout,
      assets: {
        ...layout.assets,
        [id]: {
          ...current,
          ...patch,
          x,
          y,
          width,
          height,
        },
      },
    });
  };

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    id: AssetId,
    type: "drag" | "resize",
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(id);
    const start = layout.assets[id];
    interactionRef.current = {
      type,
      id,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...start },
      ratio: start.width / Math.max(1, start.height),
    };
  };

  const moveInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!interaction || !rect) return;
    const dx = (event.clientX - interaction.startX) * page.width / rect.width;
    const dy = (event.clientY - interaction.startY) * page.height / rect.height;

    if (interaction.type === "drag") {
      updateAsset(interaction.id, {
        x: interaction.start.x + dx,
        y: interaction.start.y + dy,
      });
      return;
    }

    const width = Math.max(4, interaction.start.width + dx);
    const heightFromWidth = width / interaction.ratio;
    const heightFromPointer = Math.max(4, interaction.start.height + dy);
    const height = event.shiftKey ? heightFromPointer : heightFromWidth;
    updateAsset(interaction.id, { width, height });
  };

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-h-0 overflow-auto rounded-md border bg-slate-100 p-3">
        <div
          ref={pageRef}
          className="relative mx-auto overflow-hidden bg-white shadow-lg"
          style={{ aspectRatio: `${page.width}/${page.height}`, maxWidth: 960 }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {previewFallbackUrl && (
            <iframe
              title="Preview PDF"
              src={previewFallbackUrl}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
            />
          )}
          {rendering && (
            <div className="absolute inset-0 grid place-items-center bg-white/60 text-sm">
              Memperbarui preview...
            </div>
          )}
          {(Object.keys(layout.assets) as AssetId[]).map((id) => {
            const item = layout.assets[id];
            if (!item.visible) return null;
            const source = assetSource(id, assets);
            return (
              <div
                key={id}
                title={`Geser ${ASSET_LABELS[id]}`}
                onPointerDown={(event) => beginInteraction(event, id, "drag")}
                onPointerMove={moveInteraction}
                onPointerUp={() => { interactionRef.current = null; }}
                className={`absolute touch-none bg-transparent ${
                  selected === id ? "border-2 border-blue-500" : "border border-transparent"
                }`}
                style={{
                  left: `${item.x / page.width * 100}%`,
                  top: `${item.y / page.height * 100}%`,
                  width: `${item.width / page.width * 100}%`,
                  height: `${item.height / page.height * 100}%`,
                }}
              >
                {!source && id !== "qrCode" && selected === id && (
                  <span className="absolute inset-0 grid place-items-center bg-blue-50/80 px-1 text-[9px] text-blue-700">
                    {ASSET_LABELS[id]} belum diunggah
                  </span>
                )}
                {selected === id && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Ubah ukuran ${ASSET_LABELS[id]}`}
                    onPointerDown={(event) => beginInteraction(event, id, "resize")}
                    onPointerMove={moveInteraction}
                    onPointerUp={() => { interactionRef.current = null; }}
                    className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border border-white bg-blue-600"
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Move className="h-3.5 w-3.5" /> Drag untuk memindahkan. Tarik handle kanan bawah untuk resize.
        </p>
      </div>

      <aside className="space-y-4 overflow-y-auto rounded-md border bg-background p-4">
        <label className="space-y-1 text-xs font-medium">
          <span>Aset dipilih</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as AssetId)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {(Object.keys(ASSET_LABELS) as AssetId[]).map((id) => (
              <option key={id} value={id}>{ASSET_LABELS[id]}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {selectedAsset.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Tampilkan aset
          </div>
          <Switch
            checked={selectedAsset.visible}
            onCheckedChange={(visible) => updateAsset(selected, { visible })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key} className="space-y-1 text-xs font-medium">
              <span>{key === "x" ? "X Position" : key === "y" ? "Y Position" : key === "width" ? "Width" : "Height"} (mm)</span>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={Number(selectedAsset[key].toFixed(1))}
                onChange={(event) => updateAsset(selected, { [key]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <Label className="text-sm font-semibold">Gaya Teks PDF</Label>
          <label className="flex items-center justify-between text-sm">
            Tebalkan teks utama
            <Switch
              checked={layout.text.bold}
              onCheckedChange={(bold) => onChange({ ...layout, text: { ...layout.text, bold } })}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>Warna teks utama</span>
            <div className="flex gap-2">
              <Input
                type="color"
                className="w-14 p-1"
                value={layout.text.color}
                onChange={(event) => onChange({
                  ...layout,
                  text: { ...layout.text, color: event.target.value },
                })}
              />
              <Input
                value={layout.text.color}
                onChange={(event) => onChange({
                  ...layout,
                  text: { ...layout.text, color: event.target.value },
                })}
              />
            </div>
          </label>
        </div>

        <div className="grid gap-2">
          <Button type="button" onClick={onSave}>
            <Save className="mr-2 h-4 w-4" /> Simpan Layout
          </Button>
          <Button type="button" variant="secondary" onClick={onApply}>
            Terapkan ke PDF
          </Button>
          <Button type="button" variant="outline" onClick={onPreviewAgain}>
            <RefreshCw className="mr-2 h-4 w-4" /> Preview Ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(getDefaultRaportVisualLayout(orientation))}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Layout
          </Button>
        </div>
      </aside>
    </div>
  );
}
