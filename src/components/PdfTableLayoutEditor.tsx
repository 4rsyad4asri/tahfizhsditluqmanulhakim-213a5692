import { RotateCcw, Save, TableProperties } from "lucide-react";
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
  onReset: () => void;
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
  { key: "detailBodyFontSize", label: "Font isi tabel detail", min: 4, max: 12, step: 0.1 },
  { key: "detailHeadFontSize", label: "Font header tabel detail", min: 4, max: 12, step: 0.1 },
  { key: "summaryBodyFontSize", label: "Font isi ringkasan Tahfizh", min: 4, max: 12, step: 0.1 },
  { key: "summaryHeadFontSize", label: "Font header ringkasan Tahfizh", min: 4, max: 12, step: 0.1 },
  { key: "studentInfoFontSize", label: "Font info siswa", min: 4, max: 12, step: 0.1 },
  { key: "sectionTitleFontSize", label: "Font judul section", min: 4, max: 12, step: 0.1 },
];

const SPACING_FIELDS: Field[] = [
  { key: "cellPaddingX", label: "Padding horizontal sel", min: 0, max: 4, step: 0.1 },
  { key: "cellPaddingY", label: "Padding vertikal sel", min: 0, max: 4, step: 0.1 },
  { key: "rowMinCellHeight", label: "Tinggi minimum baris", min: 0, max: 16, step: 0.5 },
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
  onReset,
  onApplyAll,
}: Props) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <div>
        <h3 className="font-semibold">Editor Tabel PDF</h3>
        <p className="text-xs text-muted-foreground">
          Pengaturan A4 {orientation === "landscape" ? "Landscape" : "Portrait"}.
          Nilai portrait dan landscape disimpan terpisah.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SettingsCard title="Ukuran Font" fields={FONT_FIELDS} value={value} onChange={onChange} />
        <SettingsCard title="Jarak & Padding" fields={SPACING_FIELDS} value={value} onChange={onChange} />
        <SettingsCard title="Margin & Garis" fields={MARGIN_FIELDS} value={value} onChange={onChange} />
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="button" size="sm" onClick={onApply}>
          <TableProperties className="mr-1 h-4 w-4" />
          Terapkan ke Preview
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          Simpan Pengaturan Global
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          <RotateCcw className="mr-1 h-4 w-4" />
          Reset Default {orientation === "landscape" ? "Landscape" : "Portrait"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onApplyAll}>
          Terapkan ke Semua Jenis Ujian
        </Button>
      </div>
    </div>
  );
}
