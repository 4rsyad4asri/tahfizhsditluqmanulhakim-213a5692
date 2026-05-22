/**
 * KOMPONEN FORM UJIAN TAHFIZH - SERTIFIKAT & REGULER MODE
 * dengan kemampuan Edit lengkap
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TahfizhSurahAssessment,
  TahfizhPenaltyConfig,
  calculateTahfizhSurahScore,
  calculateTahfizhExamResult,
  validateTahfizhAssessment,
} from '@/data/tahfizhSystem';
import { getSurahsForJuz, getSurahLabel } from '@/data/quranData';

interface UjianTahfizhFormProps {
  mode: 'Sertifikat' | 'Reguler';
  initialAssessments?: TahfizhSurahAssessment[];
  initialPenalty?: TahfizhPenaltyConfig;
  isPending?: boolean;
  onSubmit: (data: {
    assessments: TahfizhSurahAssessment[];
    config: TahfizhPenaltyConfig;
    nilaiAkhir: number;
    predikat: string;
    status: 'Lulus' | 'Tidak Lulus';
    grade: string;
    catatanGuru: string;
    tanggal: string;
    waktu: string;
  }) => void;
  onCancel: () => void;
}

const DEFAULT_PENALTY: TahfizhPenaltyConfig = {
  lahnJali: 2,
  lahnKhofi: 1,
  waqaf: 1,
  salahSambung: 2,
};

const KELANCARAN_OPTIONS = [
  { value: 100, label: 'Sangat Lancar (100)' },
  { value: 90, label: 'Lancar (90)' },
  { value: 80, label: 'Cukup Lancar (80)' },
  { value: 70, label: 'Kurang Lancar (70)' },
  { value: 60, label: 'Tidak Lancar (60)' },
];

export default function UjianTahfizhForm({
  mode,
  initialAssessments,
  initialPenalty = DEFAULT_PENALTY,
  isPending = false,
  onSubmit,
  onCancel,
}: UjianTahfizhFormProps) {
  const [assessments, setAssessments] = useState<TahfizhSurahAssessment[]>(
    initialAssessments || [
      {
        surah: 'An-Naba',
        juz: 30,
        kelancaran: 90,
        lahnJali: 0,
        lahnKhofi: 0,
        waqaf: 0,
        salahSambung: 0,
      },
    ]
  );

  const [penaltyConfig, setPenaltyConfig] = useState<TahfizhPenaltyConfig>(
    initialPenalty
  );
  const [showPenaltyConfig, setShowPenaltyConfig] = useState(false);
  const [catatanGuru, setCatatanGuru] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [waktu, setWaktu] = useState(new Date().toTimeString().slice(0, 5));

  // Calculate exam result realtime
  const examResult = useMemo(() => {
    return calculateTahfizhExamResult(assessments, mode, penaltyConfig);
  }, [assessments, mode, penaltyConfig]);

  // Update single assessment
  const updateAssessment = (index: number, field: keyof TahfizhSurahAssessment, value: any) => {
    const updated = [...assessments];
    if (field === 'juz') {
      // Auto-select first surah of new juz
      const surahs = getSurahsForJuz(value);
      updated[index] = {
        ...updated[index],
        juz: value,
        surah: surahs[0]?.name || '',
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAssessments(updated);
  };

  // Add new assessment
  const addAssessment = () => {
    setAssessments([
      ...assessments,
      {
        surah: getSurahsForJuz(30)[0]?.name || 'An-Naba',
        juz: 30,
        kelancaran: 90,
        lahnJali: 0,
        lahnKhofi: 0,
        waqaf: 0,
        salahSambung: 0,
      },
    ]);
  };

  // Remove assessment
  const removeAssessment = (index: number) => {
    if (assessments.length <= 1) return;
    setAssessments(assessments.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = () => {
    // Validate all assessments
    const validationErrors = assessments
      .map((a, i) => ({ i, ...validateTahfizhAssessment(a) }))
      .filter(r => !r.valid);

    if (validationErrors.length > 0) {
      alert(`Validasi gagal:\n${validationErrors.map(e => e.errors.join(', ')).join('\n')}`);
      return;
    }

    onSubmit({
      assessments,
      config: penaltyConfig,
      nilaiAkhir: examResult.nilaiAkhir,
      predikat: examResult.predikat,
      status: examResult.status,
      grade: examResult.grade,
      catatanGuru,
      tanggal,
      waktu,
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground">
          Form Ujian Tahfizh - Mode {mode}
        </h4>
        <span className="text-[10px] text-muted-foreground">
          ⌨️ Tab untuk navigasi · Enter untuk update
        </span>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Tanggal Ujian
          </label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Waktu Ujian
          </label>
          <input
            type="time"
            value={waktu}
            onChange={(e) => setWaktu(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Penalty Config Section */}
      <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-foreground">
            📐 Rumus & Penalti Penilaian
          </h5>
          <button
            onClick={() => setShowPenaltyConfig(!showPenaltyConfig)}
            className="text-xs text-primary hover:underline"
          >
            {showPenaltyConfig ? 'Tutup' : 'Edit Penalti'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-primary/10 border-2 border-primary/30">
            <p className="text-xs font-semibold text-foreground mb-1">
              ⭐ Kelancaran (Basis)
            </p>
            <p className="text-[10px] text-muted-foreground">60–100</p>
            <p className="text-xs font-bold text-primary mt-1">Tanpa penalti</p>
          </div>
          <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
            <p className="text-xs font-semibold text-foreground mb-1">
              Lahn Jali
            </p>
            <p className="text-[10px] text-muted-foreground">Kesalahan nyata</p>
            <p className="text-xs font-bold text-destructive mt-1">
              −{penaltyConfig.lahnJali}/kesalahan
            </p>
          </div>
          <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
            <p className="text-xs font-semibold text-foreground mb-1">
              Lahn Khofi
            </p>
            <p className="text-[10px] text-muted-foreground">Kesalahan samar</p>
            <p className="text-xs font-bold text-orange-600 mt-1">
              −{penaltyConfig.lahnKhofi}/kesalahan
            </p>
          </div>
          <div className="p-3 rounded-md bg-accent/50 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1">
              Waqaf & Ibtida
            </p>
            <p className="text-[10px] text-muted-foreground">Kesalahan henti</p>
            <p className="text-xs font-bold text-foreground mt-1">
              −{penaltyConfig.waqaf}/kesalahan
            </p>
          </div>
          <div className="p-3 rounded-md bg-violet-500/5 border border-violet-500/20">
            <p className="text-xs font-semibold text-foreground mb-1">
              Salah Sambung Ayat
            </p>
            <p className="text-[10px] text-muted-foreground">Kesalahan sambung</p>
            <p className="text-xs font-bold text-violet-600 mt-1">
              −{penaltyConfig.salahSambung}/kesalahan
            </p>
          </div>
        </div>

        {showPenaltyConfig && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-background border border-border">
            {Object.entries(penaltyConfig).map(([key, val]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Penalti {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={val}
                  onChange={(e) =>
                    setPenaltyConfig({
                      ...penaltyConfig,
                      [key]: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <div className="p-3 rounded-md bg-accent/50 border border-border">
          <p className="text-xs font-semibold text-foreground">
            📝 Rumus Nilai:
          </p>
          <p className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded mt-1">
            Nilai = Kelancaran − (LJ×{penaltyConfig.lahnJali}) − (LK×{penaltyConfig.lahnKhofi}) − (W×{penaltyConfig.waqaf}) − (S×{penaltyConfig.salahSambung})
          </p>
          <p className="text-xs font-semibold text-foreground mt-2">
            📊 Nilai Akhir = Rata-rata per Juz (bukan per surah)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
            Mumtaz: 90–100
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
            Jayyid Jiddan: 80–89
          </span>
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
            Jayyid: 70–79
          </span>
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-medium">
            Perlu Perbaikan: &lt;70
          </span>
          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
            ✅ Lulus: ≥ 85
          </span>
        </div>
      </div>

      {/* Assessments */}
      <div className="space-y-4">
        {assessments.map((assessment, index) => (
          <TahfizhAssessmentInput
            key={index}
            assessment={assessment}
            index={index}
            penaltyConfig={penaltyConfig}
            onUpdate={updateAssessment}
            onRemove={removeAssessment}
            showRemove={assessments.length > 1}
          />
        ))}

        <button
          onClick={addAssessment}
          className="w-full py-2.5 rounded-md border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-1" /> Tambah Surat
        </button>
      </div>

      {/* Catatan Guru */}
      <div className="pt-2 border-t border-border">
        <h5 className="text-sm font-semibold text-foreground mb-1">
          💬 Catatan Guru
        </h5>
        <textarea
          value={catatanGuru}
          onChange={(e) => setCatatanGuru(e.target.value)}
          placeholder="Catatan atau masukan untuk siswa..."
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>

      {/* Preview Result */}
      {assessments.length > 0 && (
        <div
          className={`p-4 rounded-md ${
            examResult.status === 'Lulus'
              ? 'bg-success/10'
              : 'bg-destructive/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Nilai Akhir Ujian
              </p>
              <p className="text-3xl font-bold text-foreground">
                {examResult.nilaiAkhir}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-xl font-bold ${
                  examResult.status === 'Lulus'
                    ? 'text-success'
                    : 'text-destructive'
                }`}
              >
                {examResult.predikat}
              </p>
              <p className="text-sm font-medium">
                {examResult.status === 'Lulus'
                  ? '✅ LULUS SERTIFIKASI'
                  : '❌ BELUM LULUS'}
              </p>
              <p className="text-xs text-muted-foreground">
                Grade {examResult.grade}
              </p>
            </div>
          </div>

          {/* Per-Juz Breakdown */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-semibold text-foreground mb-2">
              Nilai Per Juz:
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {examResult.nilaiPerJuz.map((juzResult) => (
                <div
                  key={juzResult.juz}
                  className="text-center p-2 rounded-md bg-muted/50"
                >
                  <p className="text-xs text-muted-foreground">
                    Juz {juzResult.juz}
                  </p>
                  <p className="font-bold text-foreground">
                    {juzResult.rataRataJuz}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={assessments.length === 0 || isPending}
          className="px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : `Simpan Hasil Ujian ${mode}`}
        </button>
      </div>
    </div>
  );
}

/**
 * Komponen input untuk satu surat assessment
 */
function TahfizhAssessmentInput({
  assessment,
  index,
  penaltyConfig,
  onUpdate,
  onRemove,
  showRemove,
}: {
  assessment: TahfizhSurahAssessment;
  index: number;
  penaltyConfig: TahfizhPenaltyConfig;
  onUpdate: (index: number, field: keyof TahfizhSurahAssessment, value: any) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  const nilaiSurah = calculateTahfizhSurahScore(assessment, penaltyConfig);

  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-foreground">
          Surat #{index + 1}
        </h5>
        {showRemove && (
          <button
            onClick={() => onRemove(index)}
            className="text-destructive hover:text-destructive/80 transition-colors"
            title="Hapus surat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Juz Selection */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Juz
          </label>
          <select
            value={assessment.juz}
            onChange={(e) =>
              onUpdate(index, 'juz', parseInt(e.target.value))
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                📖 Juz {j}
              </option>
            ))}
          </select>
        </div>

        {/* Surah Selection */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Surah
          </label>
          <select
            value={assessment.surah}
            onChange={(e) =>
              onUpdate(index, 'surah', e.target.value)
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {getSurahsForJuz(assessment.juz).map((s) => (
              <option key={`${s.name}-${s.ayatRange || 'full'}`} value={s.name}>
                {getSurahLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kelancaran */}
      <div className="p-3 rounded-md bg-primary/10 border-2 border-primary/30">
        <h6 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
          ⭐ Kelancaran (Prioritas Utama)
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                Panduan: 100=Sangat lancar, 90=Lancar, 80=Cukup, 70=Kurang,
                60=Tidak lancar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h6>
        <select
          value={assessment.kelancaran}
          onChange={(e) =>
            onUpdate(index, 'kelancaran', parseInt(e.target.value))
          }
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {KELANCARAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Lahn Jali */}
        <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
          <h6 className="text-xs font-semibold text-foreground mb-2">
            Lahn Jali (Kesalahan Nyata)
          </h6>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Jumlah Kesalahan
          </label>
          <input
            type="number"
            min={0}
            value={assessment.lahnJali}
            onChange={(e) =>
              onUpdate(index, 'lahnJali', parseInt(e.target.value) || 0)
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Penalti: −{assessment.lahnJali * penaltyConfig.lahnJali} poin
          </p>
        </div>

        {/* Lahn Khofi */}
        <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
          <h6 className="text-xs font-semibold text-foreground mb-2">
            Lahn Khofi (Kesalahan Samar)
          </h6>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Jumlah Kesalahan
          </label>
          <input
            type="number"
            min={0}
            value={assessment.lahnKhofi}
            onChange={(e) =>
              onUpdate(index, 'lahnKhofi', parseInt(e.target.value) || 0)
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Penalti: −{assessment.lahnKhofi * penaltyConfig.lahnKhofi} poin
          </p>
        </div>

        {/* Waqaf */}
        <div className="p-3 rounded-md bg-accent/50 border border-border">
          <h6 className="text-xs font-semibold text-foreground mb-2">
            Waqaf & Ibtida
          </h6>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Jumlah Kesalahan
          </label>
          <input
            type="number"
            min={0}
            value={assessment.waqaf}
            onChange={(e) =>
              onUpdate(index, 'waqaf', parseInt(e.target.value) || 0)
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Penalti: −{assessment.waqaf * penaltyConfig.waqaf} poin
          </p>
        </div>

        {/* Salah Sambung */}
        <div className="p-3 rounded-md bg-violet-500/5 border border-violet-500/20">
          <h6 className="text-xs font-semibold text-foreground mb-2">
            Salah/Lupa Sambung Ayat
          </h6>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Jumlah Kesalahan
          </label>
          <input
            type="number"
            min={0}
            value={assessment.salahSambung}
            onChange={(e) =>
              onUpdate(index, 'salahSambung', parseInt(e.target.value) || 0)
            }
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Penalti: −{assessment.salahSambung * penaltyConfig.salahSambung} poin
          </p>
        </div>
      </div>

      {/* Score Preview */}
      <div className="p-3 rounded-md bg-muted text-center">
        <p className="text-xs text-muted-foreground mb-1">
          Nilai = {assessment.kelancaran} − ({penaltyConfig.lahnJali}×
          {assessment.lahnJali}) − ({penaltyConfig.lahnKhofi}×
          {assessment.lahnKhofi}) − ({penaltyConfig.waqaf}×{assessment.waqaf})
          − ({penaltyConfig.salahSambung}×{assessment.salahSambung})
        </p>
        <p className="text-2xl font-bold text-primary">{nilaiSurah}</p>
      </div>
    </div>
  );
}
