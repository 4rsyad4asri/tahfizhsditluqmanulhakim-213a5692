export const buildReportDocumentNumber = (
  mode: string,
  id: string,
  publishedAt?: string | null,
  tanggal?: string | null,
) => {
  const sourceDate = publishedAt || tanggal || new Date().toISOString();
  const date = new Date(sourceDate);
  const fallback = new Date();
  const year = Number.isNaN(date.getTime()) ? fallback.getFullYear() : date.getFullYear();
  const month = Number.isNaN(date.getTime()) ? fallback.getMonth() + 1 : date.getMonth() + 1;
  const ym = `${year}${String(month).padStart(2, "0")}`;
  const code = (mode || "Tahfizh").replace(/\s+/g, "").toUpperCase();
  const shortId = (id || "VERIFY").slice(0, 6).toUpperCase();
  return `RPT/${code}/${ym}/${shortId}`;
};
