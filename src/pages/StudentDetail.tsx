import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMyAssignedClasses } from "@/hooks/useMyAssignedClasses";
import Header from "@/components/Header";
import { calculateNilaiSetoran, calculateNilaiTahfizh, calculateNilaiSurah, calculateNilaiSurahNew } from "@/data/mockData";
import type { Koreksi, TahfizhSurahEntry } from "@/data/mockData";
import { useStudentDetail, useAddSetoran, useAddTahfizhUjian, useAddTahsinUjian, useUpdateCatatan, useUpdateUjian, useDeleteUjian } from "@/hooks/useStudentDetail";
import { JUZ_SURAH_MAP, getSurahsForJuz, getSurahLabel } from "@/data/quranData";
import { ArrowLeft, Plus, FileText, Award, BookOpen, PenLine, Loader2, Trash2, Info, Calendar, Clock, Download, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import UjianTahsinDasarForm from "@/components/UjianTahsinDasarForm";
import UjianTahsinLanjutanForm from "@/components/UjianTahsinLanjutanForm";
import { calculateNilaiTahsinDasar, calculateNilaiTahsinLanjutan } from "@/data/tahsinScoring";
import type { TahsinDasarEntry, TahsinLanjutanEntry, TahsinPenaltyConfig, WaqafSymbolTest } from "@/data/tahsinScoring";
import { generateTahsinPDF } from "@/utils/generateTahsinPDF";
import EditUjianDialog from "@/components/EditUjianDialog";
import EditTahfizhDialog from "@/components/EditTahfizhDialog";
import RaportPreviewDialog from "@/components/RaportPreviewDialog";
import { handleSmartFormKey } from "@/utils/smartFormNav";

const KELANCARAN_OPTIONS = [
  { value: 100, label: "Sangat Lancar (100)" },
  { value: 90, label: "Lancar (90)" },
  { value: 80, label: "Cukup Lancar (80)" },
  { value: 70, label: "Kurang Lancar (70)" },
  { value: 60, label: "Tidak Lancar (60)" },
];

const StudentDetail = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStudentDetail(studentId);
  const { data: assignedClassIds } = useMyAssignedClasses();
  const { isPenguji, user } = useAuthContext();
  const addSetoran = useAddSetoran();
  
  const addTahfizhUjian = useAddTahfizhUjian();
  const addTahsinUjian = useAddTahsinUjian();
  const updateCatatan = useUpdateCatatan();
  const updateUjian = useUpdateUjian();
  const deleteUjian = useDeleteUjian();
  const [editingUjian, setEditingUjian] = useState<any | null>(null);
  const [raportUjian, setRaportUjian] = useState<any | null>(null);

  const [showSetoranForm, setShowSetoranForm] = useState(false);
  const [showUjianForm, setShowUjianForm] = useState(false);
  const [ujianMode, setUjianMode] = useState<"Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan" | null>(null);

  const [tahfizhEntries, setTahfizhEntries] = useState<TahfizhSurahEntry[]>([
    { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }
  ]);
  const [tahfizhTanggal, setTahfizhTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatanGuru, setCatatanGuru] = useState("");

  const [tahsinDasarEntries, setTahsinDasarEntries] = useState<TahsinDasarEntry[]>([
    { nama_ebta: "", surah: "", ayat_mulai: "", ayat_akhir: "", kelancaran: 90, salah_huruf: 0, salah_harakat: 0, kesalahan_tajwid: 0, kesalahan_mad: 0, kesalahan_ghunnah: 0, kesalahan_waqaf: 0 }
  ]);
  const [tahsinDasarTanggal, setTahsinDasarTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [tahsinDasarCatatan, setTahsinDasarCatatan] = useState("");
  const [tahsinDasarConfig, setTahsinDasarConfig] = useState<TahsinPenaltyConfig>({
    penalti_lahn_jali: 2,
    penalti_lahn_khofi: 1,
    bobot_kelancaran: 40,
  });

  const [tahsinLanjutanEntries, setTahsinLanjutanEntries] = useState<TahsinLanjutanEntry[]>([
    { nama_ebta: "", surah: "", ayat: "", kelancaran: 90, salah_huruf: 0, salah_harakat: 0, kesalahan_tajwid: 0, kesalahan_mad: 0, kesalahan_ghunnah: 0, kesalahan_waqaf: 0, waqaf_ibtida: 0 }
  ]);
  const [tahsinLanjutanTanggal, setTahsinLanjutanTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [tahsinLanjutanCatatan, setTahsinLanjutanCatatan] = useState("");
  const [tahsinLanjutanConfig, setTahsinLanjutanConfig] = useState<TahsinPenaltyConfig>({
    penalti_lahn_jali: 2,
    penalti_lahn_khofi: 1,
    bobot_kelancaran: 40,
  });
  const [waqafTest, setWaqafTest] = useState<WaqafSymbolTest>({
    waqaf_lazim: false,
    waqaf_mustahab: false,
    waqaf_jaiz: false,
    waqaf_mujawwaz: false,
    waqaf_mamnu: false,
    waqaf_muanaqah: false,
  });

  const [catatan, setCatatan] = useState("");

  const student = data?.student;
  const classInfo = data?.classInfo;
  const setoran = data?.setoran || [];
  const ujian = data?.ujian || [];
  const assessorMap = data?.assessorMap || {};

  const isLoggedIn = !!user;
  const hasAccess = !isPenguji || assignedClassIds === null || assignedClassIds === undefined || (classInfo?.id && assignedClassIds.includes(classInfo.id));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20 text-destructive">
          Siswa tidak ditemukan
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">Anda tidak memiliki akses ke siswa ini</p>
          <button onClick={() => navigate("/")} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const handleSaveCatatan = () => {
    if (!studentId) return;
    updateCatatan.mutate({ student_id: studentId, catatan }, {
      onSuccess: () => toast.success("Catatan berhasil disimpan!"),
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const handleTahfizhSubmit = () => {
    if (!studentId) return;
    const result = calculateNilaiTahfizh(tahfizhEntries);
    addTahfizhUjian.mutate({
      student_id: studentId,
      entries: tahfizhEntries,
      catatan_guru: catatanGuru,
      assessed_by: user?.id,
      tanggal: tahfizhTanggal,
      ...result,
    }, {
      onSuccess: () => {
        toast.success("Hasil ujian Tahfizh berhasil disimpan!");
        setShowUjianForm(false);
        setUjianMode(null);
        setTahfizhEntries([{ surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }]);
        setCatatanGuru("");
      },
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const tahfizhPreview = tahfizhEntries.length > 0 ? calculateNilaiTahfizh(tahfizhEntries) : null;

  const addTahfizhEntry = () => {
    setTahfizhEntries([...tahfizhEntries, { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 90, waqaf_ibtida: 0, salah_sambung_ayat: 0 }]);
  };

  const removeTahfizhEntry = (index: number) => {
    if (tahfizhEntries.length <= 1) return;
    setTahfizhEntries(tahfizhEntries.filter((_, i) => i !== index));
  };

  const updateTahfizhEntry = (index: number, field: keyof TahfizhSurahEntry, value: any) => {
    const updated = [...tahfizhEntries];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'juz') {
      const surahs = getSurahsForJuz(value as number);
      if (surahs.length > 0) {
        updated[index].surah = surahs[0].name;
      }
    }
    setTahfizhEntries(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{student?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {student?.nisn && <p>NISN: {student.nisn}</p>}
            {classInfo?.name && <p>Kelas: {classInfo.name}</p>}
          </div>
        </div>

        <Tabs defaultValue="ujian" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ujian">Ujian</TabsTrigger>
            <TabsTrigger value="setoran">Setoran</TabsTrigger>
            <TabsTrigger value="catatan">Catatan</TabsTrigger>
            <TabsTrigger value="raport">Raport</TabsTrigger>
          </TabsList>

          {/* UJIAN TAB */}
          <TabsContent value="ujian" className="space-y-6">
            {isLoggedIn && (
              <div className="p-6 rounded-lg border border-border bg-card space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Ujian Baru
                </h3>

                <div className="flex flex-wrap gap-2">
                  {["Tahfizh", "Tahsin Dasar", "Tahsin Lanjutan"].map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setUjianMode(mode as any); setShowUjianForm(true); }}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      disabled={showUjianForm}
                    >
                      {mode === "Tahfizh" ? "📖" : "🎓"} {mode}
                    </button>
                  ))}
                </div>

                {showUjianForm && ujianMode === "Tahfizh" && (
                  <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                    <h4 className="font-semibold text-foreground">Form Ujian Tahfizh</h4>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tanggal</label>
                      <input type="date" value={tahfizhTanggal} onChange={e => setTahfizhTanggal(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium text-sm text-foreground">Surat yang Diujikan</h5>
                        <button onClick={addTahfizhEntry} className="text-xs text-primary hover:underline">+ Tambah</button>
                      </div>
                      {tahfizhEntries.map((entry, idx) => (
                        <div key={idx} className="p-3 rounded-md border border-border bg-background space-y-2">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-foreground">Surat #{idx + 1}</p>
                            {tahfizhEntries.length > 1 && (
                              <button onClick={() => removeTahfizhEntry(idx)} className="text-destructive text-xs hover:underline">Hapus</button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Surah</label>
                              <select value={entry.surah} onChange={e => updateTahfizhEntry(idx, 'surah', e.target.value)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {getSurahsForJuz(entry.juz).map(s => (
                                  <option key={s.name} value={s.name}>{getSurahLabel(s)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Juz</label>
                              <select value={entry.juz} onChange={e => updateTahfizhEntry(idx, 'juz', parseInt(e.target.value))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                                  <option key={j} value={j}>{j}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Kelancaran</label>
                              <select value={entry.kelancaran} onChange={e => updateTahfizhEntry(idx, 'kelancaran', parseInt(e.target.value))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs">
                                {KELANCARAN_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.value}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Lahn Jali</label>
                              <input type="number" min={0} value={entry.lahn_jali} onChange={e => updateTahfizhEntry(idx, 'lahn_jali', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Lahn Khofi</label>
                              <input type="number" min={0} value={entry.lahn_khofi} onChange={e => updateTahfizhEntry(idx, 'lahn_khofi', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Waqaf</label>
                              <input type="number" min={0} value={entry.waqaf_ibtida} onChange={e => updateTahfizhEntry(idx, 'waqaf_ibtida', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Sambung Ayat</label>
                              <input type="number" min={0} value={entry.salah_sambung_ayat} onChange={e => updateTahfizhEntry(idx, 'salah_sambung_ayat', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-2 py-1 rounded-md border border-input bg-background text-foreground text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Nilai Surat</label>
                              <div className="text-center py-1 px-2 rounded-md border border-input bg-muted text-foreground text-xs font-semibold">
                                {calculateNilaiSurah(entry)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Catatan Guru</label>
                      <textarea value={catatanGuru} onChange={e => setCatatanGuru(e.target.value)}
                        placeholder="Catatan untuk siswa..."
                        className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm resize-y" />
                    </div>

                    {tahfizhPreview && (
                      <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 space-y-1">
                        <p className="text-xs text-muted-foreground">Preview Hasil</p>
                        <p className="text-2xl font-bold text-emerald-600">{tahfizhPreview.nilaiAkhir}</p>
                        <p className="text-sm font-medium text-emerald-700">{tahfizhPreview.predikat} - Grade {tahfizhPreview.grade}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => { setShowUjianForm(false); setUjianMode(null); }}
                        className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        Batal
                      </button>
                      <button onClick={handleTahfizhSubmit} disabled={addTahfizhUjian.isPending}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {addTahfizhUjian.isPending ? "Menyimpan..." : "Simpan Ujian"}
                      </button>
                    </div>
                  </div>
                )}

                {showUjianForm && ujianMode === "Tahsin Dasar" && (
                  <UjianTahsinDasarForm
                    entries={tahsinDasarEntries}
                    setEntries={setTahsinDasarEntries}
                    tanggal={tahsinDasarTanggal}
                    setTanggal={setTahsinDasarTanggal}
                    catatan={tahsinDasarCatatan}
                    setCatatan={setTahsinDasarCatatan}
                    config={tahsinDasarConfig}
                    setConfig={setTahsinDasarConfig}
                    onCancel={() => { setShowUjianForm(false); setUjianMode(null); }}
                    onSubmit={() => {
                      if (!studentId) return;
                      const result = calculateNilaiTahsinDasar(tahsinDasarEntries[0], tahsinDasarConfig);
                      addTahsinUjian.mutate({
                        student_id: studentId,
                        mode: "Tahsin Dasar",
                        entries: tahsinDasarEntries,
                        catatan_guru: tahsinDasarCatatan,
                        assessed_by: user?.id,
                        tanggal: tahsinDasarTanggal,
                        nilai_akhir: result,
                        status: result >= 70 ? "Lulus" : "Tidak Lulus",
                        grade: result >= 90 ? "A" : result >= 80 ? "B" : result >= 70 ? "C" : "D",
                      }, {
                        onSuccess: () => { toast.success("Hasil Ujian Tahsin Dasar berhasil disimpan!"); setShowUjianForm(false); setUjianMode(null); },
                        onError: (err) => toast.error(getSafeErrorMessage(err)),
                      });
                    }}
                    isLoading={addTahsinUjian.isPending}
                  />
                )}

                {showUjianForm && ujianMode === "Tahsin Lanjutan" && (
                  <UjianTahsinLanjutanForm
                    entries={tahsinLanjutanEntries}
                    setEntries={setTahsinLanjutanEntries}
                    tanggal={tahsinLanjutanTanggal}
                    setTanggal={setTahsinLanjutanTanggal}
                    catatan={tahsinLanjutanCatatan}
                    setCatatan={setTahsinLanjutanCatatan}
                    config={tahsinLanjutanConfig}
                    setConfig={setTahsinLanjutanConfig}
                    waqafTest={waqafTest}
                    setWaqafTest={setWaqafTest}
                    onCancel={() => { setShowUjianForm(false); setUjianMode(null); }}
                    onSubmit={() => {
                      if (!studentId) return;
                      const result = calculateNilaiTahsinLanjutan(tahsinLanjutanEntries[0], tahsinLanjutanConfig);
                      addTahsinUjian.mutate({
                        student_id: studentId,
                        mode: "Tahsin Lanjutan",
                        entries: tahsinLanjutanEntries,
                        catatan_guru: tahsinLanjutanCatatan,
                        assessed_by: user?.id,
                        tanggal: tahsinLanjutanTanggal,
                        nilai_akhir: result,
                        status: result >= 70 ? "Lulus" : "Tidak Lulus",
                        grade: result >= 90 ? "A" : result >= 80 ? "B" : result >= 70 ? "C" : "D",
                      }, {
                        onSuccess: () => { toast.success("Hasil Ujian Tahsin Lanjutan berhasil disimpan!"); setShowUjianForm(false); setUjianMode(null); },
                        onError: (err) => toast.error(getSafeErrorMessage(err)),
                      });
                    }}
                    isLoading={addTahsinUjian.isPending}
                  />
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4" /> Daftar Ujian ({ujian.length})
              </h3>
              {ujian.map((u: any, idx: number) => {
                const statusBadge = (status: string) => {
                  switch (status) {
                    case 'Lulus':
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">✅ Lulus</span>;
                    case 'Tidak Lulus':
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">❌ Tidak Lulus</span>;
                    default:
                      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-700">⏳ Proses</span>;
                  }
                };

                return (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{u.mode}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.tanggal && new Date(u.tanggal).toLocaleDateString("id-ID")}
                          {u.assessed_by && ` • Penguji: ${assessorMap[u.assessed_by] || u.assessed_by}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {statusBadge(u.status_sertifikasi)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Nilai Akhir</p>
                        <p className="text-xl font-bold text-foreground">{u.nilai_akhir}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Grade</p>
                        <p className="text-xl font-bold text-foreground">{u.grade}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-bold text-foreground">{u.status_sertifikasi}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted">
                        <p className="text-xs text-muted-foreground">Predikat</p>
                        <p className="text-sm font-bold text-primary">{u.nilai_aspek?.predikat || "-"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {isLoggedIn && (
                        <>
                          <button
                            onClick={() => setEditingUjian(u)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              deleteUjian.mutate({
                                ujian_id: u.id,
                                student_id: studentId!,
                              }, {
                                onSuccess: () => toast.success("Hasil ujian dihapus"),
                                onError: (err) => toast.error(getSafeErrorMessage(err)),
                              });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setRaportUjian(u)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-600 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                      >
                        <FileText className="w-3 h-3" /> Lihat Raport
                      </button>
                      {u.mode === "Tahsin Dasar" && (
                        <button
                          onClick={() => {
                            const entries = u.nilai_aspek?.entries || [];
                            generateTahsinPDF(student?.name || "Siswa", u.mode, entries, u.nilai_akhir);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Unduh PDF
                        </button>
                      )}
                    </div>

                    {u.mode === "Tahfizh" && u.nilai_aspek?.surahEntries ? (
                      <div className="mt-3 p-3 rounded-md bg-muted/40 space-y-2">
                        <p className="text-xs font-semibold text-foreground">Surat yang Diujikan:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          {u.nilai_aspek.surahEntries.map((entry: any, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              {i + 1}. {entry.surah} (Juz {entry.juz}) - Nilai: {calculateNilaiSurah(entry)}
                            </p>
                          ))}
                        </div>
                        {u.nilai_aspek.catatanGuru && (
                          <p className="text-xs italic text-muted-foreground mt-2">💬 {u.nilai_aspek.catatanGuru}</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(u.nilai_aspek as Record<string, number>).map(([key, val]) => (
                          <div key={key} className="text-center p-2 rounded-md bg-muted">
                            <p className="text-xs text-muted-foreground">{key}</p>
                            <p className="font-bold text-foreground">{val as number}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {ujian.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Belum ada ujian</p>
              )}
            </div>
          </TabsContent>

          {/* SETORAN TAB */}
          <TabsContent value="setoran" className="space-y-6">
            {isLoggedIn && (
              <div className="p-6 rounded-lg border border-border bg-card space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Setoran
                </h3>
                {/* Form setoran bisa ditambahkan di sini */}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Daftar Setoran ({setoran.length})
              </h3>
              {setoran.map((s: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-card">
                  <p className="text-sm font-semibold text-foreground">
                    {s.surah} (Ayat {s.ayat_mulai}-{s.ayat_akhir})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.tanggal && new Date(s.tanggal).toLocaleDateString("id-ID")}
                  </p>
                  <p className="text-sm font-bold text-primary mt-2">Nilai: {s.nilai}</p>
                </div>
              ))}
              {setoran.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Belum ada setoran</p>
              )}
            </div>
          </TabsContent>

          {/* CATATAN TAB */}
          <TabsContent value="catatan" className="space-y-4">
            <h3 className="font-semibold text-foreground">Catatan Penguji</h3>
            {isLoggedIn ? (
              <>
                <textarea
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  placeholder="Tulis catatan, evaluasi, dan saran perbaikan untuk siswa..."
                  className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
                <button
                  onClick={handleSaveCatatan}
                  disabled={updateCatatan.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updateCatatan.isPending ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </>
            ) : (
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{catatan || "Belum ada catatan"}</p>
              </div>
            )}
          </TabsContent>

          {/* RAPORT TAB */}
          <TabsContent value="raport" className="space-y-4">
            <h3 className="font-semibold text-foreground">Raport</h3>
            <p className="text-sm text-muted-foreground">Pilih ujian untuk melihat raport</p>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog - Tahfizh */}
      {editingUjian && editingUjian.mode === "Tahfizh" && (
        <EditTahfizhDialog
          open={!!editingUjian}
          onClose={() => setEditingUjian(null)}
          tahfizhData={editingUjian}
          studentName={student.name}
          isSaving={updateUjian.isPending}
          onSave={(updated) => {
            updateUjian.mutate({
              ujian_id: editingUjian.id,
              student_id: studentId!,
              nilai_aspek: updated.nilai_aspek,
              nilai_akhir: updated.nilai_akhir,
              status: updated.status,
              grade: updated.grade,
              tanggal: updated.tanggal,
            }, {
              onSuccess: () => { toast.success("Hasil ujian diperbarui"); setEditingUjian(null); },
              onError: (err) => toast.error(getSafeErrorMessage(err)),
            });
          }}
        />
      )}

      {/* Edit Dialog - Tahsin Dasar/Lanjutan */}
      {editingUjian && (editingUjian.mode === "Tahsin Dasar" || editingUjian.mode === "Tahsin Lanjutan") && (
        <EditUjianDialog
          open={!!editingUjian}
          onClose={() => setEditingUjian(null)}
          ujian={editingUjian}
          studentName={student.name}
          isSaving={updateUjian.isPending}
          onSave={(updated) => {
            updateUjian.mutate({
              ujian_id: editingUjian.id,
              student_id: studentId!,
              nilai_aspek: updated.nilai_aspek,
              nilai_akhir: updated.nilai_akhir,
              status: updated.status,
              grade: updated.grade,
              tanggal: updated.tanggal,
            }, {
              onSuccess: () => { toast.success("Hasil ujian diperbarui"); setEditingUjian(null); },
              onError: (err) => toast.error(getSafeErrorMessage(err)),
            });
          }}
        />
      )}

      {raportUjian && (
        <RaportPreviewDialog
          open={!!raportUjian}
          onClose={() => setRaportUjian(null)}
          ujian={raportUjian}
          studentName={student.name}
          className={classInfo?.name || ''}
          assessorName={raportUjian.assessed_by ? assessorMap[raportUjian.assessed_by] : undefined}
        />
      )}
    </div>
  );
};

export default StudentDetail;
