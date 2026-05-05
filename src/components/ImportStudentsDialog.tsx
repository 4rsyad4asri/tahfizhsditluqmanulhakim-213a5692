import { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportJsonToExcel, readExcelFile } from "@/utils/excel";

interface ParsedStudent {
  name: string;
  className: string; // e.g. "1A", "2B", "Kelas 3C"
  target_juz: number;
  level: string;
  progress_hafalan: number;
  status_sertifikasi: string;
  valid: boolean;
  errors: string[];
}

const VALID_LEVELS = ["Tahsin Dasar", "Tahsin Lanjutan", "Tahfizh"];
const VALID_STATUS = ["Belum Ujian", "Lulus", "Tidak Lulus"];

function parseClassName(raw: string): { grade: number; section: string } | null {
  if (!raw) return null;
  const cleaned = raw.toString().replace(/^kelas\s*/i, "").trim().toUpperCase();
  const match = cleaned.match(/^(\d)([A-D])$/);
  if (match) {
    return { grade: parseInt(match[1]), section: match[2] };
  }
  return null;
}

function validateRow(row: any, idx: number): ParsedStudent {
  const errors: string[] = [];
  const name = (row["Nama"] || row["Nama Siswa"] || row["name"] || "").toString().trim();
  const className = (row["Kelas"] || row["Class"] || row["class"] || "").toString().trim();
  const targetJuz = parseInt(row["Target Juz"] || row["target_juz"] || "30") || 30;
  const level = (row["Level"] || row["level"] || "Tahsin Dasar").toString().trim();
  const progress = parseInt(row["Progress"] || row["Progress Hafalan"] || row["progress_hafalan"] || "0") || 0;
  const status = (row["Status"] || row["Status Sertifikasi"] || row["status_sertifikasi"] || "Belum Ujian").toString().trim();

  if (!name) errors.push("Nama kosong");
  if (name.length > 100) errors.push("Nama terlalu panjang (max 100)");
  if (!className) errors.push("Kelas kosong");
  if (!parseClassName(className)) errors.push(`Format kelas "${className}" tidak valid (contoh: 1A, 2B)`);
  if (targetJuz < 1 || targetJuz > 30) errors.push("Target Juz harus 1-30");
  if (!VALID_LEVELS.includes(level)) errors.push(`Level "${level}" tidak valid`);
  if (progress < 0 || progress > 100) errors.push("Progress harus 0-100");
  if (!VALID_STATUS.includes(status)) errors.push(`Status "${status}" tidak valid`);

  return {
    name,
    className,
    target_juz: Math.max(1, Math.min(30, targetJuz)),
    level,
    progress_hafalan: Math.max(0, Math.min(100, progress)),
    status_sertifikasi: status,
    valid: errors.length === 0,
    errors,
  };
}

interface ImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportStudentsDialog = ({ open, onOpenChange }: ImportStudentsDialogProps) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const { data: classes } = useQuery({
    queryKey: ["all-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("grade")
        .order("section");
      if (error) throw error;
      return data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (students: ParsedStudent[]) => {
      const validStudents = students.filter((s) => s.valid);
      const classMap = new Map(
        (classes || []).map((c) => [`${c.grade}${c.section}`, c.id])
      );

      const rows = validStudents.map((s) => {
        const parsed = parseClassName(s.className);
        const classKey = parsed ? `${parsed.grade}${parsed.section}` : "";
        return {
          name: s.name.trim(),
          class_id: classMap.get(classKey) || "",
          target_juz: s.target_juz,
          level: s.level as any,
          progress_hafalan: s.progress_hafalan,
          status_sertifikasi: s.status_sertifikasi as any,
        };
      }).filter((r) => r.class_id);

      if (rows.length === 0) throw new Error("Tidak ada data valid untuk diimport");

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("students").insert(batch);
        if (error) throw error;
      }

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(`${count} siswa berhasil diimport!`);
      setStep("done");
    },
    onError: (err) => toast.error(getSafeErrorMessage(err)),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }

    setFileName(file.name);
    readExcelFile(file).then((jsonData) => {
      if (jsonData.length === 0) { toast.error("File kosong atau format tidak sesuai"); return; }
      if (jsonData.length > 500) { toast.error("Maksimal 500 baris per import"); return; }
      const parsed = jsonData.map((row: any, idx: number) => validateRow(row, idx));
      setParsedData(parsed);
      setStep("preview");
    }).catch(() => toast.error("Gagal membaca file. Pastikan format Excel/CSV yang benar."));
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        "Nama": "Ahmad Fauzan",
        "Kelas": "1A",
        "Target Juz": 30,
        "Level": "Tahsin Dasar",
        "Progress": 0,
        "Status": "Belum Ujian",
      },
      {
        "Nama": "Aisyah Putri",
        "Kelas": "2B",
        "Target Juz": 29,
        "Level": "Tahsin Lanjutan",
        "Progress": 50,
        "Status": "Lulus",
      },
    ];
    exportJsonToExcel(template, "Template", "template_import_siswa.xlsx");
  };

  const resetDialog = () => {
    setParsedData([]);
    setFileName("");
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
  };

  const validCount = parsedData.filter((s) => s.valid).length;
  const invalidCount = parsedData.filter((s) => !s.valid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Data Siswa dari Excel/CSV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {/* Download template */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm text-foreground font-medium mb-2">📋 Langkah-langkah:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download template Excel di bawah</li>
                <li>Isi data siswa sesuai format kolom</li>
                <li>Upload file yang sudah diisi</li>
              </ol>
              <button
                onClick={handleDownloadTemplate}
                className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template Excel
              </button>
            </div>

            {/* Format info */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs font-medium text-foreground mb-1.5">Format kolom yang diterima:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span><strong>Nama</strong> — nama lengkap siswa</span>
                <span><strong>Kelas</strong> — 1A, 2B, 3C, dll</span>
                <span><strong>Target Juz</strong> — angka 1-30</span>
                <span><strong>Level</strong> — Tahsin Dasar / Tahsin Lanjutan / Tahfizh</span>
                <span><strong>Progress</strong> — angka 0-100</span>
                <span><strong>Status</strong> — Belum Ujian / Lulus / Tidak Lulus</span>
              </div>
            </div>

            {/* Upload area */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Klik untuk pilih file atau drag & drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Format: .xlsx, .xls, .csv (Maks 5MB, 500 baris)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 overflow-hidden flex flex-col flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">📄 {fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedData.length} baris ditemukan
                </p>
              </div>
              <button
                onClick={resetDialog}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Ganti file
              </button>
            </div>

            {/* Summary */}
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {validCount} valid
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {invalidCount} error
                </div>
              )}
            </div>

            {/* Preview table */}
            <div className="overflow-auto flex-1 border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nama</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Kelas</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Juz</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Level</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((s, idx) => (
                    <tr key={idx} className={`border-t border-border/50 ${!s.valid ? 'bg-destructive/5' : ''}`}>
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2">
                        {s.valid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground font-medium">{s.name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.className || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.target_juz}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.level}</td>
                      <td className="px-3 py-2 text-destructive">{s.errors.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ⚠️ Baris dengan error akan dilewati. Hanya {validCount} baris valid yang akan diimport.
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={resetDialog}
                className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => importMutation.mutate(parsedData)}
                disabled={validCount === 0 || importMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengimport...
                  </span>
                ) : (
                  `Import ${validCount} Siswa`
                )}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Import Berhasil! 🎉</p>
              <p className="text-sm text-muted-foreground mt-1">
                Data siswa sudah tersimpan di database
              </p>
            </div>
            <button
              onClick={() => { resetDialog(); onOpenChange(false); }}
              className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Selesai
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportStudentsDialog;
