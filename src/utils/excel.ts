import ExcelJS from "exceljs";

export async function exportJsonToExcel(rows: Record<string, any>[], sheetName: string, fileName: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  if (rows.length === 0) {
    ws.addRow(["(kosong)"]);
  } else {
    const cols = Object.keys(rows[0]);
    ws.columns = cols.map((key) => ({ header: key, key, width: Math.max(12, key.length + 2) }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readExcelFile(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  // try xlsx then csv
  try {
    await wb.xlsx.load(buf);
  } catch {
    const text = new TextDecoder().decode(buf);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",");
      const row: Record<string, any> = {};
      headers.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
      return row;
    });
  }
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: Record<string, any>[] = [];
  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values as any[];
    // exceljs values are 1-indexed; index 0 is empty
    const cells = values.slice(1).map((v) => (v == null ? "" : typeof v === "object" && (v as any).text ? (v as any).text : v));
    if (rowNumber === 1) {
      headers = cells.map((c) => String(c).trim());
    } else {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
      rows.push(obj);
    }
  });
  return rows;
}