import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  calculateTahfizhExamResult,
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  normalizeTahfizhPenaltyConfig,
  toSafeNumber,
  type TahfizhSurahAssessment,
  type TahfizhPenaltyConfig,
  type TahfizhJuzResult,
} from '@/data/tahfizhSystem';
import { Trash2, Plus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface EditTahfizhExamDialogProps {
  open: boolean;
  onClose: () => void;
  ujian: any;
  studentName?: string;
  onSave: (updated: {
    entries: TahfizhSurahAssessment[];
    catatan_guru: string;
    nilai_akhir: number;
    nilaiPerJuz: TahfizhJuzResult[];
    predikat: string;
    status: 'Lulus' | 'Tidak Lulus';
    grade: string;
  }) => void;
  isSaving: boolean;
}

export default function EditTahfizhExamDialog({
  open,
  onClose,
  ujian,
  studentName,
  onSave,
  isSaving,
}: EditTahfizhExamDialogProps) {
  const [entries, setEntries] = useState<TahfizhSurahAssessment[]>([]);
  const [catatanGuru, setCatatanGuru] = useState('');
  const [penaltiConfig, setPenaltiConfig] = useState<TahfizhPenaltyConfig>({
    lahnJali: 2,
    lahnKhofi: 1,
    waqaf: 1,
    salahSambung: 2,
  });
  const [showPenaltiConfig, setShowPenaltiConfig] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Initialize dari ujian yang ada
  useEffect(() => {
    if (open && ujian) {
      // Convert dari format lama ke format baru
      const surahEntries = ujian.nilai_aspek?.surahEntries || [];
      const converted: TahfizhSurahAssessment[] = surahEntries.map(normalizeTahfizhAssessment);
      const savedConfig = normalizeTahfizhPenaltyConfig(ujian.nilai_aspek?.config);
      const savedMode = ujian.nilai_aspek?.tahfizhMode || "Reguler";

      setEntries(converted);
      setCatatanGuru(ujian.nilai_aspek?.catatanGuru || '');
      setPenaltiConfig(savedConfig);

      // Kalkulasi hasil baru
      const newResult = calculateTahfizhExamResult(converted, savedMode, savedConfig);
      setResult(newResult);
    }
  }, [open, ujian]);

  // Auto-calculate saat entries berubah
  useEffect(() => {
    if (entries.length > 0) {
      const newResult = calculateTahfizhExamResult(
        entries,
        ujian?.nilai_aspek?.tahfizhMode || 'Reguler',
        penaltiConfig
      );
      setResult(newResult);
    }
  }, [entries, penaltiConfig]);

  const handleUpdateEntry = (index: number, field: keyof TahfizhSurahAssessment, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length <= 1) {
      toast.error('Minimal harus ada 1 surat');
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleAddEntry = () => {
    const newEntry: TahfizhSurahAssessment = {
      surah: 'An-Naba',
      juz: 30,
      kelancaran: 90,
      lahnJali: 0,
      lahnKhofi: 0,
      waqaf: 0,
      salahSambung: 0,
    };
    setEntries([...entries, newEntry]);
  };

  const handleSave = () => {
    if (!result) return;

    onSave({
      entries,
      catatan_guru: catatanGuru,
      nilai_akhir: result.nilaiAkhir,
      nilaiPerJuz: result.nilaiPerJuz,
      predikat: result.predikat,
      status: result.status,
      grade: result.grade,
    });
  };

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ujian Tahfizh - {studentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Penalti Configuration */}
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                📐 Konfigurasi Penalti
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                      Pengaturan penalti untuk perhitungan nilai. Pastikan sudah sesuai dengan standar penilaian sekolah.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h3>
              <button
                onClick={() => setShowPenaltiConfig(!showPenaltiConfig)}
                className="text-xs text-primary hover:underline"
              >
                {showPenaltiConfig ? 'Tutup' : 'Edit'}
              </button>
            </div>

            {showPenaltiConfig ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'lahnJali', label: 'Lahn Jali' },
                  { key: 'lahnKhofi', label: 'Lahn Khofi' },
                  { key: 'waqaf', label: 'Waqaf' },
                  { key: 'salahSambung', label: 'Salah Sambung' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Penalti {field.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={penaltiConfig[field.key as keyof TahfizhPenaltyConfig]}
                      onChange={(e) =>
                        setPenaltiConfig({
                          ...penaltiConfig,
                          [field.key]: Math.max(
                            0,
                            toSafeNumber(
                              e.target.value,
                              penaltiConfig[field.key as keyof TahfizhPenaltyConfig]
                            )
                          ),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Lahn Jali</p>
                  <p className="font-bold text-foreground">−{penaltiConfig.lahnJali}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lahn Khofi</p>
                  <p className="font-bold text-foreground">−{penaltiConfig.lahnKhofi}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Waqaf</p>
                  <p className="font-bold text-foreground">−{penaltiConfig.waqaf}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Salah Sambung</p>
                  <p className="font-bold text-foreground">−{penaltiConfig.salahSambung}</p>
                </div>
              </div>
            )}
          </div>

          {/* Entries Table */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">📋 Data Penilaian Surat</h3>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Juz</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Surah</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Kelancaran</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">LJ</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">LK</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Waqaf</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Sambung</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Nilai</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={entry.juz}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'juz', parseInt(e.target.value) || 1)
                          }
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.surah}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'surah', e.target.value)
                          }
                          className="w-24 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={entry.kelancaran}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'kelancaran', parseInt(e.target.value) || 90)
                          }
                          className="w-16 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value={90}>90</option>
                          <option value={100}>100</option>
                          <option value={80}>80</option>
                          <option value={70}>70</option>
                          <option value={60}>60</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={entry.lahnJali}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'lahnJali', Math.max(0, toSafeNumber(e.target.value, entry.lahnJali)))
                          }
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={entry.lahnKhofi}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'lahnKhofi', Math.max(0, toSafeNumber(e.target.value, entry.lahnKhofi)))
                          }
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={entry.waqaf}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'waqaf', Math.max(0, toSafeNumber(e.target.value, entry.waqaf)))
                          }
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={entry.salahSambung}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'salahSambung', Math.max(0, toSafeNumber(e.target.value, entry.salahSambung)))
                          }
                          className="w-12 px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring text-center"
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-primary">
                        {calculateTahfizhSurahScore(entry, penaltiConfig)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveEntry(index)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleAddEntry}
              className="w-full py-2 rounded-md border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Tambah Surat
            </button>
          </div>

          {/* Per Juz Results */}
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm mb-3">📊 Nilai Per Juz</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {result.nilaiPerJuz.map((juzResult: TahfizhJuzResult, idx: number) => (
                <div key={idx} className="p-3 rounded-md bg-background border border-border">
                  <p className="text-xs text-muted-foreground">Juz {juzResult.juz}</p>
                  <p className="text-lg font-bold text-primary">{juzResult.rataRataJuz}</p>
                  <p className="text-[10px] text-muted-foreground">{juzResult.surahs.length} surat</p>
                </div>
              ))}
            </div>
          </div>

          {/* Final Results */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Rata-rata Akhir</p>
                <p className="text-3xl font-bold text-primary">{result.nilaiAkhir}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Predikat</p>
                <p className="text-xl font-bold text-foreground">{result.predikat}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Grade</p>
                <p className="text-xl font-bold text-foreground">{result.grade}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p
                  className={`text-lg font-bold ${
                    result.status === 'Lulus' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {result.status === 'Lulus' ? '✅ Lulus' : '❌ Tidak Lulus'}
                </p>
              </div>
            </div>
          </div>

          {/* Catatan Guru - Sistem Lama */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">💬 Catatan Guru / Pembimbing (Sistem Lama)</h3>
            <p className="text-xs text-muted-foreground">
              Catatan guru tetap menggunakan sistem yang lama (tidak berubah)
            </p>
            <textarea
              value={catatanGuru}
              onChange={(e) => setCatatanGuru(e.target.value)}
              placeholder="Tuliskan catatan, evaluasi, dan saran perbaikan untuk siswa..."
              className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                'Hafalan sudah lancar namun masih perlu memperbaiki mad thabi\'i',
                'Makhraj huruf ض dan ظ masih perlu latihan',
                'Perlu memperbanyak murajaah',
                'Bacaan sudah sangat baik',
              ].map((saran) => (
                <button
                  key={saran}
                  type="button"
                  onClick={() => setCatatanGuru(saran)}
                  className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  {saran.length > 40 ? saran.slice(0, 40) + '…' : saran}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || entries.length === 0}
            className="gradient-islamic text-primary-foreground"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
