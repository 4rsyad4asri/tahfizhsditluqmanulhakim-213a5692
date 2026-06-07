import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TahfizhSurahEntry } from "@/data/mockData";
import {
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  normalizeTahfizhPayload,
  toSafeNumber,
} from "@/data/tahfizhSystem";
import { getSurahsForJuz, getSurahLabel } from "@/data/quranData";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EditTahfizhDialogProps {
  open: boolean;
  onClose: () => void;
  tahfizhData: any; // ujian data
  studentName?: string;
  isSaving: boolean;
  onSave: (updated: {
    nilai_aspek: any;
    nilai_akhir: number;
    status: "Lulus" | "Tidak Lulus";
    grade: string;
    tanggal: string;
  }) => void;
}

const DEFAULT_PENALTY = { lj: 2, lk: 1, waqaf: 1, sambung: 2 };
const KELANCARAN_OPTIONS = [
  { value: 90, label: "Lancar (90)" },
  { value: 100, label: "Sangat Lancar (100)" },
  { value: 80, label: "Cukup Lancar (80)" },
  { value: 70, label: "Kurang Lancar (70)" },
  { value: 60, label: "Tidak Lancar (60)" },
];

export default function EditTahfizhDialog({
  open,
  onClose,
  tahfizhData,
  studentName,
  isSaving,
  onSave,
}: EditTahfizhDialogProps) {
  const [entries, setEntries] = useState<TahfizhSurahEntry[]>([]);
  const [catatan, setCatatan] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [penaltiConfig, setPenaltiConfig] = useState(DEFAULT_PENALTY);

  useEffect(() => {
    if (tahfizhData?.nilai_aspek?.surahEntries) {
      setEntries(tahfizhData.nilai_aspek.surahEntries);
      setCatatan(tahfizhData.nilai_aspek.catatanGuru || "");
      setTanggal(tahfizhData.tanggal || "");
      const config = tahfizhData.nilai_aspek.config || {};
      setPenaltiConfig({
        lj: toSafeNumber(config.lahnJali ?? config.lj, DEFAULT_PENALTY.lj),
        lk: toSafeNumber(config.lahnKhofi ?? config.lk, DEFAULT_PENALTY.lk),
        waqaf: toSafeNumber(config.waqaf, DEFAULT_PENALTY.waqaf),
        sambung: toSafeNumber(config.salahSambung ?? config.sambung, DEFAULT_PENALTY.sambung),
      });
    }
  }, [tahfizhData]);

  const calculateCurrentTahfizhScore = (entry: TahfizhSurahEntry): number => {
    return calculateTahfizhSurahScore(normalizeTahfizhAssessment(entry), {
      lahnJali: penaltiConfig.lj,
      lahnKhofi: penaltiConfig.lk,
      waqaf: penaltiConfig.waqaf,
      salahSambung: penaltiConfig.sambung,
    });
  };

  const handleUpdateEntry = (
    index: number,
    field: keyof TahfizhSurahEntry,
    value: any
  ) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'juz') {
      const surahs = getSurahsForJuz(value as number);
      if (surahs.length > 0) {
        updated[index].surah = surahs[0].name;
      }
    }
    setEntries(updated);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length <= 1) {
      toast.error("Minimal ada 1 surat");
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleAddEntry = () => {
    setEntries([...entries, {
      surah: getSurahsForJuz(30)[0]?.name || "An-Naba",
      juz: 30,
      lahn_jali: 0,
      lahn_khofi: 0,
      kelancaran: 90,
      waqaf_ibtida: 0,
      salah_sambung_ayat: 0
    }]);
  };

  const handleSave = () => {
    const normalized = normalizeTahfizhPayload({
      entries,
      nilaiAspek: tahfizhData?.nilai_aspek,
      tahfizhMode: tahfizhData?.nilai_aspek?.tahfizhMode || "Reguler",
      config: {
        lahnJali: penaltiConfig.lj,
        lahnKhofi: penaltiConfig.lk,
        waqaf: penaltiConfig.waqaf,
        salahSambung: penaltiConfig.sambung,
      },
    });
    onSave({
      nilai_aspek: {
        ...normalized.nilaiAspek,
        catatanGuru: catatan,
      },
      nilai_akhir: normalized.nilaiAkhir,
      status: normalized.status,
      grade: normalized.grade,
      tanggal,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ujian Tahfizh - {studentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tanggal Ujian</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* Penalty Config */}
          <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Pengaturan Penalti</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'lj' as const, label: 'Lahn Jali' },
                { key: 'lk' as const, label: 'Lahn Khofi' },
                { key: 'waqaf' as const, label: 'Waqaf' },
                { key: 'sambung' as const, label: 'Sambung' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input type="number" min={0} max={10}
                    value={penaltiConfig[key]}
                    onChange={e => setPenaltiConfig({
                      ...penaltiConfig,
                      [key]: Math.max(0, toSafeNumber(e.target.value, penaltiConfig[key])),
                    })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Entries Table */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Penilaian Surat</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left p-2">Surah</th>
                    <th className="text-center p-2">Juz</th>
                    <th className="text-center p-2">Kelancaran</th>
                    <th className="text-center p-2">LJ</th>
                    <th className="text-center p-2">LK</th>
                    <th className="text-center p-2">Waqaf</th>
                    <th className="text-center p-2">Sambung</th>
                    <th className="text-center p-2">Nilai</th>
                    <th className="text-center p-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted/50">
                      <td className="p-2">
                        <select value={entry.surah}
                          onChange={e => handleUpdateEntry(index, 'surah', e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                          {getSurahsForJuz(entry.juz).map(s => (
                            <option key={s.name} value={s.name}>{getSurahLabel(s)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <select value={entry.juz}
                          onChange={e => handleUpdateEntry(index, 'juz', parseInt(e.target.value))}
                          className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs text-center">
                          {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select value={entry.kelancaran}
                          onChange={e => handleUpdateEntry(index, 'kelancaran', parseInt(e.target.value))}
                          className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                          {KELANCARAN_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.value}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" min={0}
                          value={entry.lahn_jali}
                          onChange={e => handleUpdateEntry(index, 'lahn_jali', Math.max(0, toSafeNumber(e.target.value, entry.lahn_jali)))}
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs text-center" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={0}
                          value={entry.lahn_khofi}
                          onChange={e => handleUpdateEntry(index, 'lahn_khofi', Math.max(0, toSafeNumber(e.target.value, entry.lahn_khofi)))}
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs text-center" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={0}
                          value={entry.waqaf_ibtida}
                          onChange={e => handleUpdateEntry(index, 'waqaf_ibtida', Math.max(0, toSafeNumber(e.target.value, entry.waqaf_ibtida)))}
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs text-center" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={0}
                          value={entry.salah_sambung_ayat}
                          onChange={e => handleUpdateEntry(index, 'salah_sambung_ayat', Math.max(0, toSafeNumber(e.target.value, entry.salah_sambung_ayat)))}
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs text-center" />
                      </td>
                      <td className="p-2 text-center font-semibold">{calculateCurrentTahfizhScore(entry)}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => handleRemoveEntry(index)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-3 h-3 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={handleAddEntry}
              className="w-full py-2 rounded-md border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              + Tambah Surat
            </button>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Catatan Guru</label>
            <textarea value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan untuk siswa..."
              className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
          </div>

          {/* Preview */}
          {entries.length > 0 && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Rata-rata Nilai</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {Math.round(entries.reduce((a, b) => a + calculateCurrentTahfizhScore(b), 0) / entries.length)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Surat</p>
                  <p className="text-2xl font-bold text-emerald-600">{entries.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {Math.round(entries.reduce((a, b) => a + calculateCurrentTahfizhScore(b), 0) / entries.length) >= 70 ? 'Lulus' : 'Tidak Lulus'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Batal</Button>
          <Button onClick={handleSave} disabled={isSaving || entries.length === 0}>
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
