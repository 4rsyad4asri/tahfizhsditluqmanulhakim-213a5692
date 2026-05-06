import { useState } from "react";
import { Info, Settings2, Trash2, Calendar, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TahsinDasarEntry, TahsinPenaltyConfig, DEFAULT_TAHSIN_DASAR_CONFIG,
  EBTA_ITEMS, createEmptyTahsinDasarEntry,
  calculateNilaiTahsinDasar, calculateTahsinDasarResult,
} from "@/data/tahsinScoring";

const KELANCARAN_OPTIONS = [
  { value: 100, label: "Sangat Lancar (100)" },
  { value: 90, label: "Lancar (90)" },
  { value: 80, label: "Cukup Lancar (80)" },
  { value: 70, label: "Kurang Lancar (70)" },
  { value: 60, label: "Tidak Lancar (60)" },
];

interface Props {
  onSubmit: (data: { entries: TahsinDasarEntry[]; config: TahsinPenaltyConfig; catatan_guru: string; nilaiAkhir: number; status: 'Lulus' | 'Tidak Lulus'; grade: string; predikat: string; tanggal: string; waktu: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}

export default function UjianTahsinDasarForm({ onSubmit, onCancel, isPending }: Props) {
  const [entries, setEntries] = useState<TahsinDasarEntry[]>(
    EBTA_ITEMS.map(name => createEmptyTahsinDasarEntry(name))
  );
  const [config, setConfig] = useState<TahsinPenaltyConfig>({ ...DEFAULT_TAHSIN_DASAR_CONFIG });
  const [showConfig, setShowConfig] = useState(false);
  const [catatanGuru, setCatatanGuru] = useState("");
  const now = new Date();
  const [tanggal, setTanggal] = useState(now.toISOString().split("T")[0]);
  const [waktu, setWaktu] = useState(now.toTimeString().slice(0, 5));

  const updateEntry = (index: number, field: keyof TahsinDasarEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const result = calculateTahsinDasarResult(entries, config);

  const handleSubmit = () => {
    onSubmit({ entries, config, catatan_guru: catatanGuru, ...result, tanggal, waktu });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-card animate-scale-in space-y-4">
      <h4 className="font-semibold text-foreground">📘 Ujian Tahsin Dasar — EBTA Iqra 1-6</h4>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" /> Tanggal Ujian
          </label>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" /> Waktu Ujian
          </label>
          <input type="time" value={waktu} onChange={e => setWaktu(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {/* Penalty Config */}
      <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5">📐 Rumus & Bobot Penilaian</h5>
          <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Settings2 className="w-3.5 h-3.5" />
            {showConfig ? 'Tutup Pengaturan' : 'Edit Penalti & Bobot'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
            <p className="text-xs font-semibold text-foreground mb-1">Lahn Jali</p>
            <p className="text-[10px] text-muted-foreground">Salah huruf, harakat, makhraj</p>
            <p className="text-xs font-bold text-destructive mt-1">Penalti: −{config.penalti_lahn_jali} poin / kesalahan</p>
          </div>
          <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
            <p className="text-xs font-semibold text-foreground mb-1">Lahn Khofi</p>
            <p className="text-[10px] text-muted-foreground">Mad, ghunnah, tajwid, waqaf</p>
            <p className="text-xs font-bold text-orange-600 mt-1">Penalti: −{config.penalti_lahn_khofi} poin / kesalahan</p>
          </div>
          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-foreground mb-1">Kelancaran</p>
            <p className="text-[10px] text-muted-foreground">Skor 60–100</p>
            <p className="text-xs font-bold text-primary mt-1">Bobot: {config.bobot_kelancaran}% dari nilai akhir</p>
          </div>
        </div>

        {showConfig && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-background border border-border">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Penalti Lahn Jali</label>
              <input type="number" min={0} max={10} value={config.penalti_lahn_jali}
                onChange={e => setConfig({ ...config, penalti_lahn_jali: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Penalti Lahn Khofi</label>
              <input type="number" min={0} max={10} value={config.penalti_lahn_khofi}
                onChange={e => setConfig({ ...config, penalti_lahn_khofi: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Bobot Kelancaran (%)</label>
              <input type="number" min={0} max={100} value={config.bobot_kelancaran}
                onChange={e => setConfig({ ...config, bobot_kelancaran: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}

        <div className="p-3 rounded-md bg-accent/50 border border-border space-y-1">
          <p className="text-xs font-semibold text-foreground">📝 Rumus Nilai Per EBTA (Tahsin Dasar):</p>
          <p className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded">
            Koreksi = Kelancaran (60–100) − (Lahn Jali × {config.penalti_lahn_jali}) − (Lahn Khofi × {config.penalti_lahn_khofi})
          </p>
          <p className="text-xs font-semibold text-primary font-mono bg-background/80 px-2 py-1 rounded">
            Nilai akhir = Kelancaran − ({config.penalti_lahn_jali} × Lahn Jali) − ({config.penalti_lahn_khofi} × Lahn Khofi)
          </p>
        </div>
      </div>

      {/* EBTA Entries */}
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div key={index} className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-foreground">{entry.nama_ebta}</h5>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(index)} className="text-destructive hover:text-destructive/80" title="Hapus">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Kelancaran (priority #1) */}
            <div className="p-3 rounded-md bg-primary/10 border-2 border-primary/30">
              <h6 className="text-xs font-semibold text-foreground mb-2">⭐ 1️⃣ Kelancaran (Prioritas Utama)</h6>
              <select value={entry.kelancaran}
                onChange={e => updateEntry(index, 'kelancaran', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {KELANCARAN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Default 90 — dapat diubah oleh penguji</p>
            </div>

            {/* Lahn Jali */}
            <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
              <h6 className="text-xs font-semibold text-foreground mb-2">2️⃣ Lahn Jali (−{config.penalti_lahn_jali}/kesalahan)</h6>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'salah_huruf', label: 'Salah Huruf' },
                  { key: 'salah_harakat', label: 'Salah Harakat' },
                  { key: 'salah_makhraj', label: 'Salah Tasydid' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] text-muted-foreground mb-1">{f.label}</label>
                    <input type="number" min={0} max={50} value={(entry as any)[f.key]}
                      onChange={e => updateEntry(index, f.key as keyof TahsinDasarEntry, parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
              </div>
            </div>

            {/* Lahn Khofi */}
            <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
              <h6 className="text-xs font-semibold text-foreground mb-2">3️⃣ Lahn Khofi (−{config.penalti_lahn_khofi}/kesalahan)</h6>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { key: 'kesalahan_mad', label: 'Mad' },
                  { key: 'kesalahan_ghunnah', label: 'Qalqalah' },
                  { key: 'kesalahan_tajwid', label: 'Tajwid' },
                  { key: 'kesalahan_waqaf', label: 'Waqaf' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] text-muted-foreground mb-1">{f.label}</label>
                    <input type="number" min={0} max={50} value={(entry as any)[f.key]}
                      onChange={e => updateEntry(index, f.key as keyof TahsinDasarEntry, parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
              </div>
            </div>

            {/* Nilai per EBTA */}
            <div className="p-2 rounded-md bg-muted text-center">
              <p className="text-xs text-muted-foreground">Nilai {entry.nama_ebta}:</p>
              <p className="text-xl font-bold text-primary">{calculateNilaiTahsinDasar(entry, config)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Catatan */}
      <div className="pt-2 border-t border-border">
        <h5 className="text-sm font-semibold text-foreground mb-1">💬 Catatan Guru</h5>
        <textarea value={catatanGuru} onChange={e => setCatatanGuru(e.target.value)}
          placeholder="Catatan tambahan untuk siswa..."
          className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
      </div>

      {/* Preview */}
      <div className={`p-4 rounded-md ${result.status === 'Lulus' ? 'bg-success/10' : 'bg-destructive/10'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Nilai Akhir</p>
            <p className="text-3xl font-bold text-foreground">{result.nilaiAkhir}</p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${result.status === 'Lulus' ? 'text-success' : 'text-destructive'}`}>
              {result.predikat}
            </p>
            <p className="text-sm font-medium">
              {result.status === 'Lulus' ? '✅ LULUS' : '❌ BELUM LULUS'}
            </p>
            <p className="text-xs text-muted-foreground">Grade {result.grade}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
          Batal
        </button>
        <button onClick={handleSubmit} disabled={isPending}
          className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
          {isPending ? "Menyimpan..." : "Simpan Hasil Ujian Tahsin Dasar"}
        </button>
      </div>
    </div>
  );
}
