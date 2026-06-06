import { useMemo, useState, useRef } from "react";
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
import type { Database } from "@/integrations/supabase/types";

type StudentLevel = Database["public"]["Enums"]["student_level"];
type CertificationStatus = Database["public"]["Enums"]["certification_status"];

interface ParsedStudent {
  name: string;
  nis: string;
  nisn: string;
  className: string; // e.g. "1A", "2B", "Kelas 3C"
  target_juz: number;
  level: string;
  progress_hafalan: number;
  status_sertifikasi: string;
  valid: boolean;
  errors: string[];
}

interface ReconciledStudent extends ParsedStudent {
  action: "update" | "insert" | "conflict";
  classId: string;
  existingId?: string;
  note: string;
}

const VALID_LEVELS = ["Tahsin Dasar", "Tahsin Lanjutan", "Tahfizh"];
const VALID_STATUS = ["Belum Ujian", "Lulus", "Tidak Lulus"];

function parseClassName(raw: string): { grade: number; section: string } | null {
  if (!raw) return null;
  const romanGrades: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
  };
  const cleaned = raw.toString().replace(/^kelas\s*/i, "").trim().toUpperCase();
  const match = cleaned.match(/^(VI|IV|V|III|II|I|[1-6])\s*([A-D])$/);
  if (match) {
    return {
      grade: romanGrades[match[1]] || parseInt(match[1], 10),
      section: match[2],
    };
  }
  return null;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function nameSimilarity(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function getCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function validateRow(row: Record<string, unknown>): ParsedStudent {
  const errors: string[] = [];
  const name = getCell(row, ["Nama", "Nama Siswa", "name"]);
  const nis = getCell(row, ["NIS", "nis"]);
  const rawNisn = getCell(row, ["NISN", "nisn"]);
  const nisn = rawNisn ? rawNisn.padStart(10, "0") : "";
  const className = getCell(row, ["Rombel Saat Ini", "Rombel", "Kelas", "Class", "class"]);
  const targetJuz = parseInt(getCell(row, ["Target Juz", "target_juz"]) || "30", 10) || 30;
  const level = getCell(row, ["Level", "level"]) || "Tahsin Dasar";
  const progress = parseInt(getCell(row, ["Progress", "Progress Hafalan", "progress_hafalan"]) || "0", 10) || 0;
  const status = getCell(row, ["Status", "Status Sertifikasi", "status_sertifikasi"]) || "Belum Ujian";

  if (!name) errors.push("Nama kosong");
  if (name.length > 100) errors.push("Nama terlalu panjang (max 100)");
  if (nis && !/^\d{1,20}$/.test(nis)) errors.push("NIS harus berupa 1-20 digit");
  if (nisn && !/^\d{10}$/.test(nisn)) errors.push("NISN harus berupa 10 digit");
  if (!className) errors.push("Kelas kosong");
  if (!parseClassName(className)) errors.push(`Format kelas "${className}" tidak valid (contoh: 1A, 2B)`);
  if (targetJuz < 1 || targetJuz > 30) errors.push("Target Juz harus 1-30");
  if (!VALID_LEVELS.includes(level)) errors.push(`Level "${level}" tidak valid`);
  if (progress < 0 || progress > 100) errors.push("Progress harus 0-100");
  if (!VALID_STATUS.includes(status)) errors.push(`Status "${status}" tidak valid`);

  return {
    name,
    nis,
    nisn,
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

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
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

  const { data: existingStudents, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["all-students-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, nis, nisn, class_id, target_juz, level, progress_hafalan, status_sertifikasi");
      if (error) throw error;
      return data;
    },
  });

  const reconciledData = useMemo<ReconciledStudent[]>(() => {
    if (!classes || !existingStudents) return [];

    const classMap = new Map(
      classes.map((item) => [`${item.grade}${item.section}`, item.id]),
    );
    const databaseStudents = existingStudents;

    return parsedData.map((student) => {
      const parsedClass = parseClassName(student.className);
      const classId = parsedClass
        ? classMap.get(`${parsedClass.grade}${parsedClass.section}`) || ""
        : "";

      if (!student.valid || !classId) {
        return {
          ...student,
          action: "conflict",
          classId,
          note: student.errors.join(", ") || "Rombel tidak ditemukan di database",
        };
      }

      const normalizedName = normalizeName(student.name);
      const duplicateIdentifierInFile = parsedData.find(
        (other) => other !== student && (
          (student.nis && other.nis === student.nis)
          || (student.nisn && other.nisn === student.nisn)
        ),
      );
      if (duplicateIdentifierInFile) {
        return {
          ...student,
          action: "conflict",
          classId,
          note: `NIS/NISN juga dipakai oleh ${duplicateIdentifierInFile.name} di file`,
        };
      }

      const exactInClass = databaseStudents.filter(
        (item) => item.class_id === classId && normalizeName(item.name) === normalizedName,
      );

      if (exactInClass.length > 1) {
        return {
          ...student,
          action: "conflict",
          classId,
          note: "Ada lebih dari satu siswa dengan nama dan rombel yang sama di database",
        };
      }

      const exactMatch = exactInClass[0];
      const nisOwner = student.nis
        ? databaseStudents.find((item) => item.nis === student.nis && item.id !== exactMatch?.id)
        : undefined;
      const nisnOwner = student.nisn
        ? databaseStudents.find((item) => item.nisn === student.nisn && item.id !== exactMatch?.id)
        : undefined;

      if (nisOwner || nisnOwner) {
        const owner = nisOwner || nisnOwner;
        return {
          ...student,
          action: "conflict",
          classId,
          note: `NIS/NISN sudah digunakan oleh ${owner?.name}`,
        };
      }

      if (exactMatch) {
        const nisDiffers = Boolean(student.nis && exactMatch.nis && student.nis !== exactMatch.nis);
        const nisnDiffers = Boolean(student.nisn && exactMatch.nisn && student.nisn !== exactMatch.nisn);
        if (nisDiffers || nisnDiffers) {
          return {
            ...student,
            action: "conflict",
            classId,
            existingId: exactMatch.id,
            note: "Nama dan rombel cocok, tetapi NIS/NISN berbeda dengan data database",
          };
        }

        return {
          ...student,
          action: "update",
          classId,
          existingId: exactMatch.id,
          note: `Cocok dengan ${exactMatch.name}`,
        };
      }

      const closestInClass = databaseStudents
        .filter((item) => item.class_id === classId)
        .map((item) => ({ item, score: nameSimilarity(student.name, item.name) }))
        .sort((left, right) => right.score - left.score)[0];

      if (closestInClass && closestInClass.score >= 0.88) {
        return {
          ...student,
          action: "conflict",
          classId,
          existingId: closestInClass.item.id,
          note: `Nama mirip dengan ${closestInClass.item.name}`,
        };
      }

      return {
        ...student,
        action: "insert",
        classId,
        note: "Siswa baru",
      };
    });
  }, [classes, existingStudents, parsedData]);

  const importMutation = useMutation({
    mutationFn: async (students: ReconciledStudent[]) => {
      const updates = students.filter((student) => student.action === "update");
      const inserts = students.filter((student) => student.action === "insert");

      if (updates.length === 0 && inserts.length === 0) {
        throw new Error("Tidak ada data yang aman untuk diimport");
      }

      const existingMap = new Map((existingStudents || []).map((student) => [student.id, student]));
      const updateRows = updates.flatMap((student) => {
        const existing = student.existingId ? existingMap.get(student.existingId) : undefined;
        if (!existing) return [];
        return [{
          ...existing,
          nis: student.nis || existing.nis || null,
          nisn: student.nisn || existing.nisn || null,
        }];
      });

      for (let i = 0; i < updateRows.length; i += 50) {
        const batch = updateRows.slice(i, i + 50);
        const { error } = await supabase.from("students").upsert(batch, { onConflict: "id" });
        if (error) throw error;
      }

      const insertRows = inserts.map((student) => ({
        name: student.name.trim(),
        nis: student.nis || null,
        nisn: student.nisn || null,
        class_id: student.classId,
        target_juz: student.target_juz,
        level: student.level as StudentLevel,
        progress_hafalan: student.progress_hafalan,
        status_sertifikasi: student.status_sertifikasi as CertificationStatus,
      }));

      for (let i = 0; i < insertRows.length; i += 50) {
        const batch = insertRows.slice(i, i + 50);
        const { error } = await supabase.from("students").insert(batch);
        if (error) throw error;
      }

      return {
        updated: updateRows.length,
        inserted: insertRows.length,
        conflicts: students.filter((student) => student.action === "conflict").length,
      };
    },
    onSuccess: ({ updated, inserted, conflicts }) => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-students-for-import"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(`${updated} siswa diperbarui, ${inserted} siswa baru ditambahkan.`);
      if (conflicts > 0) {
        toast.warning(`${conflicts} data konflik dilewati dan perlu diperiksa.`);
      }
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
      if (jsonData.length > 1000) { toast.error("Maksimal 1.000 baris per import"); return; }
      const parsed = jsonData.map(validateRow);
      setParsedData(parsed);
      setStep("preview");
    }).catch(() => toast.error("Gagal membaca file. Pastikan format Excel/CSV yang benar."));
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        "Nama": "Ahmad Fauzan",
        "NIS": "1501",
        "NISN": "0123456789",
        "Kelas": "1A",
        "Target Juz": 30,
        "Level": "Tahsin Dasar",
        "Progress": 0,
        "Status": "Belum Ujian",
      },
      {
        "Nama": "Aisyah Putri",
        "NIS": "1502",
        "NISN": "0123456790",
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

  const updateCount = reconciledData.filter((student) => student.action === "update").length;
  const insertCount = reconciledData.filter((student) => student.action === "insert").length;
  const conflictCount = reconciledData.filter((student) => student.action === "conflict").length;
  const importableCount = updateCount + insertCount;
  const isReferenceLoading = isLoadingClasses || isLoadingStudents;

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
                <span><strong>NIS</strong> - nomor induk siswa</span>
                <span><strong>NISN</strong> - 10 digit, termasuk nol di depan</span>
                <span><strong>NIS kosong</strong> - boleh diisi nanti oleh admin</span>
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
                Format: .xlsx, .xls, .csv (Maks 5MB, 1.000 baris)
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
                  {isReferenceLoading ? "Mencocokkan dengan database..." : `${parsedData.length} baris ditemukan`}
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
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {updateCount} cocok, perbarui NIS/NISN
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {insertCount} siswa baru
              </div>
              {conflictCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {conflictCount} konflik
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
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">NIS</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">NISN</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Kelas</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Juz</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Level</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciledData.map((s, idx) => (
                    <tr key={idx} className={`border-t border-border/50 ${s.action === "conflict" ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2">
                        {s.action !== "conflict" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground font-medium">{s.name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.nis || "-"}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.nisn || "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.className || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.target_juz}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.level}</td>
                      <td className={s.action === "conflict" ? "px-3 py-2 text-destructive" : "px-3 py-2 text-muted-foreground"}>
                        {s.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {conflictCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Data konflik akan dilewati. Periksa keterangannya sebelum menentukan nama atau rombel yang benar.
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
                onClick={() => importMutation.mutate(reconciledData)}
                disabled={isReferenceLoading || importableCount === 0 || importMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengimport...
                  </span>
                ) : (
                  `Proses ${importableCount} Siswa`
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
