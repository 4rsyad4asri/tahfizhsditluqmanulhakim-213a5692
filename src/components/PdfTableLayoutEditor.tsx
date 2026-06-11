import { Minus, Plus, RefreshCw, Save } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Orientation } from "@/utils/raportPdf";
import type { RaportTableLayoutSettings } from "@/utils/raportTableLayout";

interface Props {
  orientation: Orientation;
  value: RaportTableLayoutSettings;
  saving?: boolean;
  onChange: (value: RaportTableLayoutSettings) => void;
  onApply: () => void;
  onSave: () => void;
  onPreset: (orientation: Orientation) => void;
  onApplyAll: () => void;
}

interface Field {
  key: keyof RaportTableLayoutSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}

const FONT_FIELDS: Field[] = [
  { key: "detailBodyFontSize", label: "Font isi tabel detail", min: 5, max: 12, step: 0.1 },
  { key: "detailHeadFontSize", label: "Font header tabel detail", min: 5, max: 12, step: 0.1 },
  { key: "summaryBodyFontSize", label: "Font isi ringkasan Tahfizh", min: 5, max: 12, step: 0.1 },
  { key: "summaryHeadFontSize", label: "Font header ringkasan Tahfizh", min: 5, max: 12, step: 0.1 },
  { key: "studentInfoFontSize", label: "Font info siswa", min: 5, max: 12, step: 0.1 },
  { key: "sectionTitleFontSize", label: "Font judul section", min: 7, max: 14, step: 0.1 },
  { key: "catatanTitleFontSize", label: "Font judul CATATAN", min: 6, max: 14, step: 0.1 },
  { key: "catatanBodyFontSize", label: "Font isi catatan", min: 6, max: 14, step: 0.1 },
];

const SPACING_FIELDS: Field[] = [
  { key: "cellPaddingX", label: "Padding horizontal sel", min: 0.3, max: 4, step: 0.1 },
  { key: "cellPaddingY", label: "Padding vertikal sel", min: 0.3, max: 4, step: 0.1 },
  { key: "rowMinCellHeight", label: "Tinggi minimum baris", min: 0, max: 16, step: 0.5 },
  { key: "catatanLineHeight", label: "Line height catatan", min: 1, max: 2.5, step: 0.1 },
  { key: "catatanPadding", label: "Padding catatan", min: 1, max: 10, step: 0.5 },
  { key: "gapAfterStudentInfo", label: "Jarak setelah info siswa", min: 0, max: 15, step: 0.5 },
  { key: "gapAfterScoreSummary", label: "Jarak setelah kartu nilai", min: 0, max: 15, step: 0.5 },
  { key: "gapBeforeDetail", label: "Jarak sebelum detail ujian", min: 0, max: 15, step: 0.5 },
  { key: "gapAfterDetail", label: "Jarak setelah detail ujian", min: 0, max: 15, step: 0.5 },
  { key: "gapBeforeWaqaf", label: "Jarak sebelum tes waqaf", min: 0, max: 15, step: 0.5 },
  { key: "gapAfterWaqaf", label: "Jarak setelah tes waqaf", min: 0, max: 15, step: 0.5 },
  { key: "gapBeforeCatatan", label: "Jarak sebelum catatan", min: 0, max: 15, step: 0.5 },
];

const MARGIN_FIELDS: Field[] = [
  { key: "tableMarginLeft", label: "Margin kiri tabel", min: 2, max: 30, step: 0.5 },
  { key: "tableMarginRight", label: "Margin kanan tabel", min: 2, max: 30, step: 0.5 },
  { key: "lineWidth", label: "Ketebalan garis tabel", min: 0.05, max: 1, step: 0.01 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(value.toFixed(2))));

const adjust = (
  value: RaportTableLayoutSettings,
  changes: Partial<Record<keyof RaportTableLayoutSettings, [number, number, number]>>,
) => {
  const next = { ...value };
  Object.entries(changes).forEach(([key, [amount, min, max]]) => {
    const field = key as keyof RaportTableLayoutSettings;
    (next as Record<string, number>)[field] = clamp(Number(value[field] || 0) + amount, min, max);
  });
  return next;
};

function EasyAction({
  title,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
}: {
  title: string;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" size="sm" variant="outline" onClick={onDecrease}>
          <Minus className="mr-1 h-4 w-4" />
          {decreaseLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onIncrease}>
          <Plus className="mr-1 h-4 w-4" />
          {increaseLabel}
        </Button>
      </div>
    </div>
  );
}

function SettingField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: RaportTableLayoutSettings;
  onChange: Props["onChange"];
}) {
  const current = Number(value[field.key] ?? 0);
  const update = (next: number) =>
    onChange({ ...value, [field.key]: Number.isFinite(next) ? next : current });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{field.label}</Label>
      <div className="grid grid-cols-[1fr_78px] items-center gap-2">
        <Input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={current}
          onChange={(event) => update(Number(event.target.value))}
          className="px-0"
        />
        <Input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={current}
          onChange={(event) => update(Number(event.target.value))}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  fields,
  value,
  onChange,
}: {
  title: string;
  fields: Field[];
  value: RaportTableLayoutSettings;
  onChange: Props["onChange"];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <SettingField key={field.key} field={field} value={value} onChange={onChange} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function PdfTableLayoutEditor({
  orientation,
  value,
  saving,
  onChange,
  onApply,
  onSave,
  onPreset,
  onApplyAll,
}: Props) {
  const changeAllFonts = (amount: number) => onChange(adjust(value, {
    detailBodyFontSize: [amount, 5, 12],
    detailHeadFontSize: [amount, 5, 12],
    summaryBodyFontSize: [amount, 5, 12],
    summaryHeadFontSize: [amount, 5, 12],
    sectionTitleFontSize: [amount, 7, 14],
    catatanBodyFontSize: [amount, 6, 14],
    catatanTitleFontSize: [amount, 6, 14],
  }));
  const changeTable = (amount: number) => onChange(adjust(value, {
    detailBodyFontSize: [amount, 5, 12],
    detailHeadFontSize: [amount, 5, 12],
    summaryBodyFontSize: [amount, 5, 12],
    summaryHeadFontSize: [amount, 5, 12],
    cellPaddingX: [amount > 0 ? 0.2 : -0.2, 0.3, 4],
    cellPaddingY: [amount > 0 ? 0.2 : -0.2, 0.3, 4],
  }));
  const changeCatatan = (direction: 1 | -1) => onChange(adjust(value, {
    catatanBodyFontSize: [direction * 0.7, 6, 14],
    catatanTitleFontSize: [direction * 0.5, 6, 14],
    catatanLineHeight: [direction * 0.1, 1, 2.5],
    catatanPadding: [direction * 0.5, 1, 10],
  }));
  const changeSpacing = (amount: number) => onChange(adjust(value, {
    gapAfterStudentInfo: [amount, 0, 15],
    gapAfterScoreSummary: [amount, 0, 15],
    gapBeforeDetail: [amount, 0, 15],
    gapAfterDetail: [amount, 0, 15],
    gapBeforeWaqaf: [amount, 0, 15],
    gapAfterWaqaf: [amount, 0, 15],
    gapBeforeCatatan: [amount, 0, 15],
  }));

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <div>
        <h3 className="font-semibold">Atur PDF Mudah</h3>
        <p className="text-xs text-muted-foreground">
          Setiap perubahan otomatis diterapkan ke preview A4{" "}
          {orientation === "landscape" ? "Landscape" : "Portrait"}.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <EasyAction
          title="A. Semua Font"
          decreaseLabel="Perkecil Semua Font"
          increaseLabel="Perbesar Semua Font"
          onDecrease={() => changeAllFonts(-0.5)}
          onIncrease={() => changeAllFonts(0.5)}
        />
        <EasyAction
          title="B. Tabel"
          decreaseLabel="Rapatkan Tabel"
          increaseLabel="Besarkan Tabel"
          onDecrease={() => changeTable(-0.5)}
          onIncrease={() => changeTable(0.5)}
        />
        <EasyAction
          title="C. Catatan"
          decreaseLabel="Perkecil Catatan"
          increaseLabel="Perbesar Catatan"
          onDecrease={() => changeCatatan(-1)}
          onIncrease={() => changeCatatan(1)}
        />
        <EasyAction
          title="D. Jarak"
          decreaseLabel="Rapatkan Jarak"
          increaseLabel="Longgarkan Jarak"
          onDecrease={() => changeSpacing(-1)}
          onIncrease={() => changeSpacing(1)}
        />
      </div>

      <div className="space-y-2 rounded-md border bg-background p-3">
        <p className="text-sm font-medium">E. Preset</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onPreset("landscape")}>
            Default Landscape
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onPreset("portrait")}>
            Default Portrait
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            Simpan Global
          </Button>
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="rounded-md border px-3">
          <AccordionTrigger>Pengaturan Lanjutan</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <SettingsCard title="Ukuran Font" fields={FONT_FIELDS} value={value} onChange={onChange} />
              <SettingsCard title="Jarak & Padding" fields={SPACING_FIELDS} value={value} onChange={onChange} />
              <SettingsCard title="Margin & Garis" fields={MARGIN_FIELDS} value={value} onChange={onChange} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onApply}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh Manual
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={onApplyAll}>
                Terapkan ke Semua Jenis Ujian
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
