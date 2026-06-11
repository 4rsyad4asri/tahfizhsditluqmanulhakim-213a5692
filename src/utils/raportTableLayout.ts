import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Orientation } from "@/utils/raportPdf";

export interface RaportTableLayoutSettings {
  detailBodyFontSize: number;
  detailHeadFontSize: number;
  summaryBodyFontSize: number;
  summaryHeadFontSize: number;
  studentInfoFontSize: number;
  cellPaddingX: number;
  cellPaddingY: number;
  lineWidth: number;
  rowMinCellHeight?: number;
  sectionTitleFontSize: number;
  catatanTitleFontSize: number;
  catatanBodyFontSize: number;
  catatanLineHeight: number;
  catatanPadding: number;
  gapAfterStudentInfo: number;
  gapAfterScoreSummary: number;
  gapBeforeDetail: number;
  gapAfterDetail: number;
  gapBeforeWaqaf: number;
  gapAfterWaqaf: number;
  gapBeforeCatatan: number;
  tableMarginLeft: number;
  tableMarginRight: number;
}

export interface GlobalRaportTableLayoutSettings {
  landscape: RaportTableLayoutSettings;
  portrait: RaportTableLayoutSettings;
  applyToAllExamTypes: boolean;
}

export const GLOBAL_RAPORT_TABLE_LAYOUT_SETTINGS_ID =
  "global_raport_table_layout_settings";

export const DEFAULT_RAPORT_TABLE_LAYOUT_LANDSCAPE: RaportTableLayoutSettings = {
  detailBodyFontSize: 7.5,
  detailHeadFontSize: 7.5,
  summaryBodyFontSize: 7.5,
  summaryHeadFontSize: 7.5,
  studentInfoFontSize: 7.5,
  cellPaddingX: 1.2,
  cellPaddingY: 1,
  lineWidth: 0.12,
  rowMinCellHeight: 0,
  sectionTitleFontSize: 8,
  catatanTitleFontSize: 7,
  catatanBodyFontSize: 6.8,
  catatanLineHeight: 1.3,
  catatanPadding: 3,
  gapAfterStudentInfo: 4,
  gapAfterScoreSummary: 4,
  gapBeforeDetail: 0,
  gapAfterDetail: 4,
  gapBeforeWaqaf: 2,
  gapAfterWaqaf: 4,
  gapBeforeCatatan: 3,
  tableMarginLeft: 10,
  tableMarginRight: 10,
};

export const DEFAULT_RAPORT_TABLE_LAYOUT_PORTRAIT: RaportTableLayoutSettings = {
  detailBodyFontSize: 6.3,
  detailHeadFontSize: 6.3,
  summaryBodyFontSize: 6.3,
  summaryHeadFontSize: 6.3,
  studentInfoFontSize: 7,
  cellPaddingX: 0.8,
  cellPaddingY: 0.7,
  lineWidth: 0.12,
  rowMinCellHeight: 0,
  sectionTitleFontSize: 7.5,
  catatanTitleFontSize: 7,
  catatanBodyFontSize: 6.8,
  catatanLineHeight: 1.3,
  catatanPadding: 3,
  gapAfterStudentInfo: 3,
  gapAfterScoreSummary: 3,
  gapBeforeDetail: 0,
  gapAfterDetail: 3,
  gapBeforeWaqaf: 2,
  gapAfterWaqaf: 3,
  gapBeforeCatatan: 2,
  tableMarginLeft: 8,
  tableMarginRight: 8,
};

const numericValue = (value: unknown, fallback: number, min = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : fallback;
};

const clampedValue = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => Math.min(max, numericValue(value, fallback, min));

export function getDefaultRaportTableLayout(
  orientation: Orientation,
): RaportTableLayoutSettings {
  return {
    ...(orientation === "landscape"
      ? DEFAULT_RAPORT_TABLE_LAYOUT_LANDSCAPE
      : DEFAULT_RAPORT_TABLE_LAYOUT_PORTRAIT),
  };
}

export function normalizeRaportTableLayout(
  layout: Partial<RaportTableLayoutSettings> | null | undefined,
  orientation: Orientation,
): RaportTableLayoutSettings {
  const fallback = getDefaultRaportTableLayout(orientation);
  const source = layout && typeof layout === "object" ? layout : {};

  return {
    detailBodyFontSize: clampedValue(source.detailBodyFontSize, fallback.detailBodyFontSize, 5, 12),
    detailHeadFontSize: clampedValue(source.detailHeadFontSize, fallback.detailHeadFontSize, 5, 12),
    summaryBodyFontSize: clampedValue(source.summaryBodyFontSize, fallback.summaryBodyFontSize, 5, 12),
    summaryHeadFontSize: clampedValue(source.summaryHeadFontSize, fallback.summaryHeadFontSize, 5, 12),
    studentInfoFontSize: clampedValue(source.studentInfoFontSize, fallback.studentInfoFontSize, 5, 12),
    cellPaddingX: clampedValue(source.cellPaddingX, fallback.cellPaddingX, 0.3, 4),
    cellPaddingY: clampedValue(source.cellPaddingY, fallback.cellPaddingY, 0.3, 4),
    lineWidth: numericValue(source.lineWidth, fallback.lineWidth, 0.01),
    rowMinCellHeight: numericValue(source.rowMinCellHeight, fallback.rowMinCellHeight || 0),
    sectionTitleFontSize: clampedValue(source.sectionTitleFontSize, fallback.sectionTitleFontSize, 7, 14),
    catatanTitleFontSize: clampedValue(source.catatanTitleFontSize, fallback.catatanTitleFontSize, 6, 14),
    catatanBodyFontSize: clampedValue(source.catatanBodyFontSize, fallback.catatanBodyFontSize, 6, 14),
    catatanLineHeight: clampedValue(source.catatanLineHeight, fallback.catatanLineHeight, 1, 2.5),
    catatanPadding: clampedValue(source.catatanPadding, fallback.catatanPadding, 1, 10),
    gapAfterStudentInfo: clampedValue(source.gapAfterStudentInfo, fallback.gapAfterStudentInfo, 0, 15),
    gapAfterScoreSummary: clampedValue(source.gapAfterScoreSummary, fallback.gapAfterScoreSummary, 0, 15),
    gapBeforeDetail: clampedValue(source.gapBeforeDetail, fallback.gapBeforeDetail, 0, 15),
    gapAfterDetail: clampedValue(source.gapAfterDetail, fallback.gapAfterDetail, 0, 15),
    gapBeforeWaqaf: clampedValue(source.gapBeforeWaqaf, fallback.gapBeforeWaqaf, 0, 15),
    gapAfterWaqaf: clampedValue(source.gapAfterWaqaf, fallback.gapAfterWaqaf, 0, 15),
    gapBeforeCatatan: clampedValue(source.gapBeforeCatatan, fallback.gapBeforeCatatan, 0, 15),
    tableMarginLeft: numericValue(source.tableMarginLeft, fallback.tableMarginLeft, 2),
    tableMarginRight: numericValue(source.tableMarginRight, fallback.tableMarginRight, 2),
  };
}

export function normalizeGlobalRaportTableLayout(
  value:
    | {
        landscape?: Partial<RaportTableLayoutSettings>;
        portrait?: Partial<RaportTableLayoutSettings>;
        applyToAllExamTypes?: boolean;
      }
    | null
    | undefined,
): GlobalRaportTableLayoutSettings {
  const source = value && typeof value === "object" ? value : {};
  return {
    landscape: normalizeRaportTableLayout(source.landscape, "landscape"),
    portrait: normalizeRaportTableLayout(source.portrait, "portrait"),
    applyToAllExamTypes: source.applyToAllExamTypes !== false,
  };
}

export async function loadGlobalRaportTableLayoutSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("id", GLOBAL_RAPORT_TABLE_LAYOUT_SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;
  return normalizeGlobalRaportTableLayout(
    data?.value as Partial<GlobalRaportTableLayoutSettings> | null,
  );
}

export async function saveGlobalRaportTableLayoutSettings(
  value: GlobalRaportTableLayoutSettings,
) {
  const normalized = normalizeGlobalRaportTableLayout(value);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("app_settings").upsert({
    id: GLOBAL_RAPORT_TABLE_LAYOUT_SETTINGS_ID,
    value: normalized as unknown as Json,
    updated_by: userData.user?.id || null,
  });

  if (error) throw error;
  return normalized;
}
