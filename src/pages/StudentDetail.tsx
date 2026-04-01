import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { calculateNilaiSetoran, calculateNilaiTahfizh, calculateNilaiSurah } from "@/data/mockData";
import type { Koreksi, TahfizhSurahEntry } from "@/data/mockData";
import { useStudentDetail, useAddSetoran, useAddTahfizhUjian, useUpdateCatatan } from "@/hooks/useStudentDetail";
import { JUZ_SURAH_MAP, getSurahsForJuz, getSurahLabel } from "@/data/quranData";
import { ArrowLeft, Plus, FileText, Award, BookOpen, PenLine, Loader2, Trash2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";

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
  const addSetoran = useAddSetoran();
  
  const addTahfizhUjian = useAddTahfizhUjian();
  const updateCatatan = useUpdateCatatan();

  const [catatan, setCatatan] = useState("");
  const [catatanInitialized, setCatatanInitialized] = useState(false);

  // Setoran form state
  const [showSetoranForm, setShowSetoranForm] = useState(false);
  const [setoranForm, setSetoranForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    juz: 30,
    surah: getSurahsForJuz(30)[0]?.name || "An-Naba",
    ayatMulai: 1,
    ayatAkhir: 7,
    koreksi: { kesalahanMakhraj: 0, kesalahanTajwid: 0, kesalahanMad: 0, kelancaran: 8 } as Koreksi,
    lupaAyat: 0,
    terhentiTerbata: 0,
    catatanGuru: "",
  });

  // Ujian form state
  const [showUjianForm, setShowUjianForm] = useState(false);

  // Tahfizh form state
  const [tahfizhEntries, setTahfizhEntries] = useState<TahfizhSurahEntry[]>([
    { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 100, waqaf_ibtida: 0 }
  ]);
  const [catatanGuru, setCatatanGuru] = useState("");

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
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Siswa tidak ditemukan</div>;
  }

  const { student, classInfo, setoran, ujian } = data;
  const { user } = useAuthContext();
  const isLoggedIn = !!user;

  if (!catatanInitialized && student) {
    setCatatan(student.catatan_penguji || "");
    setCatatanInitialized(true);
  }

  const handleAddSetoran = () => {
    if (!studentId) return;
    addSetoran.mutate({
      student_id: studentId,
      tanggal: setoranForm.tanggal,
      juz: setoranForm.juz,
      surah: setoranForm.surah,
      ayat_mulai: setoranForm.ayatMulai,
      ayat_akhir: setoranForm.ayatAkhir,
      kesalahan_makhraj: setoranForm.koreksi.kesalahanMakhraj,
      kesalahan_tajwid: setoranForm.koreksi.kesalahanTajwid,
      kesalahan_mad: setoranForm.koreksi.kesalahanMad,
      kelancaran: setoranForm.koreksi.kelancaran,
      lupa_ayat: setoranForm.lupaAyat,
      terhenti_terbata: setoranForm.terhentiTerbata,
      catatan_guru: setoranForm.catatanGuru,
    }, {
      onSuccess: () => {
        toast.success("Setoran berhasil disimpan!");
        setShowSetoranForm(false);
      },
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
      ...result,
    }, {
      onSuccess: () => {
        toast.success("Hasil ujian Tahfizh berhasil disimpan!");
        setShowUjianForm(false);
        setTahfizhEntries([{ surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 100, waqaf_ibtida: 0 }]);
        setCatatanGuru("");
      },
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const handleSaveCatatan = () => {
    if (!studentId) return;
    updateCatatan.mutate({ student_id: studentId, catatan }, {
      onSuccess: () => toast.success("Catatan berhasil disimpan!"),
      onError: (err) => toast.error(getSafeErrorMessage(err)),
    });
  };

  const tahfizhPreview = tahfizhEntries.length > 0 ? calculateNilaiTahfizh(tahfizhEntries) : null;

  const addTahfizhEntry = () => {
    setTahfizhEntries([...tahfizhEntries, { surah: getSurahsForJuz(30)[0]?.name || "An-Naba", juz: 30, lahn_jali: 0, lahn_khofi: 0, kelancaran: 100, waqaf_ibtida: 0 }]);
  };

  const removeTahfizhEntry = (index: number) => {
    if (tahfizhEntries.length <= 1) return;
    setTahfizhEntries(tahfizhEntries.filter((_, i) => i !== index));
  };

  const updateTahfizhEntry = (index: number, field: keyof TahfizhSurahEntry, value: any) => {
    const updated = [...tahfizhEntries];
    updated[index] = { ...updated[index], [field]: value };
    // When juz changes, reset surah to first surah of that juz
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
          onClick={() => classInfo ? navigate(`/kelas/${classInfo.grade}${classInfo.section}`) : navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke {classInfo?.name || "Dashboard"}
        </button>

        {/* Student Info Card */}
        <div className="bg-card rounded-lg border border-border shadow-card p-6 mb-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{student.name}</h2>
              <p className="text-sm text-muted-foreground">{classInfo?.name} · Target Juz {student.target_juz}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  student.level === 'Tahfizh' ? 'bg-primary/10 text-primary' :
                  student.level === 'Tahsin Lanjutan' ? 'bg-accent/10 text-accent' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {student.level}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  student.status_sertifikasi === 'Lulus' ? 'bg-success/10 text-success' :
                  student.status_sertifikasi === 'Tidak Lulus' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {student.status_sertifikasi === 'Lulus' ? '✅' : student.status_sertifikasi === 'Tidak Lulus' ? '❌' : '⏳'} {student.status_sertifikasi}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
                    strokeDasharray={`${student.progress_hafalan * 2.136} 213.6`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                  {student.progress_hafalan}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Progress</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="setoran" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="setoran" className="flex items-center gap-1.5 text-xs md:text-sm">
              <BookOpen className="w-3.5 h-3.5" />Setoran
            </TabsTrigger>
            <TabsTrigger value="ujian" className="flex items-center gap-1.5 text-xs md:text-sm">
              <Award className="w-3.5 h-3.5" />Ujian
            </TabsTrigger>
            <TabsTrigger value="catatan" className="flex items-center gap-1.5 text-xs md:text-sm">
              <PenLine className="w-3.5 h-3.5" />Catatan
            </TabsTrigger>
          </TabsList>

          {/* SETORAN TAB */}
          <TabsContent value="setoran" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Riwayat Setoran</h3>
              {isLoggedIn && (
              <button
                onClick={() => setShowSetoranForm(!showSetoranForm)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Setoran
              </button>
              )}
            </div>

            {showSetoranForm && (
              <div className="bg-card rounded-lg border border-border p-5 shadow-card animate-scale-in space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Form Input Setoran Hafalan
                </h4>

                {/* Keterangan Rumus Penilaian Setoran */}
                <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5">📐 Rumus & Bobot Penilaian Setoran</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
                      <p className="text-xs font-semibold text-foreground mb-1">Kesalahan Makhraj</p>
                      <p className="text-[10px] text-muted-foreground">Salah pengucapan huruf hijaiyah</p>
                      <p className="text-xs font-bold text-destructive mt-1">Penalti: −3 poin / kesalahan</p>
                    </div>
                    <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                      <p className="text-xs font-semibold text-foreground mb-1">Kesalahan Tajwid</p>
                      <p className="text-[10px] text-muted-foreground">Hukum bacaan kurang tepat</p>
                      <p className="text-xs font-bold text-orange-600 mt-1">Penalti: −2 poin / kesalahan</p>
                    </div>
                    <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                      <p className="text-xs font-semibold text-foreground mb-1">Kesalahan Mad</p>
                      <p className="text-[10px] text-muted-foreground">Panjang-pendek bacaan tidak sesuai</p>
                      <p className="text-xs font-bold text-orange-600 mt-1">Penalti: −2 poin / kesalahan</p>
                    </div>
                    <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-foreground mb-1">Kelancaran</p>
                      <p className="text-[10px] text-muted-foreground">Skor 1–10, bobot 20% dari nilai akhir</p>
                      <p className="text-xs font-bold text-primary mt-1">Rumus: (skor / 10) × 20</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted border border-border">
                      <p className="text-xs font-semibold text-foreground mb-1">Lupa Ayat</p>
                      <p className="text-[10px] text-muted-foreground">Catatan tambahan jumlah ayat yang lupa</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted border border-border">
                      <p className="text-xs font-semibold text-foreground mb-1">Terhenti / Terbata</p>
                      <p className="text-[10px] text-muted-foreground">Catatan tambahan bacaan terhenti</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-accent/50 border border-border">
                    <p className="text-xs font-semibold text-foreground">📝 Rumus Nilai Setoran:</p>
                    <p className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded mt-1">Nilai = 100 − (Makhraj × 3) − (Tajwid × 2) − (Mad × 2) − (20 − Kelancaran × 2)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Tanggal</label>
                    <input type="date" value={setoranForm.tanggal}
                      onChange={e => setSetoranForm({ ...setoranForm, tanggal: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Juz yang Diujikan</label>
                    <select value={setoranForm.juz}
                      onChange={e => {
                        const newJuz = parseInt(e.target.value);
                        const surahs = getSurahsForJuz(newJuz);
                        setSetoranForm({
                          ...setoranForm,
                          juz: newJuz,
                          surah: surahs[0]?.name || "",
                          ayatMulai: 1,
                          ayatAkhir: surahs[0]?.ayatCount || 1,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                        <option key={j} value={j}>📖 Juz {j}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Surah</label>
                    <select value={setoranForm.surah}
                      onChange={e => {
                        const selectedSurah = getSurahsForJuz(setoranForm.juz).find(s => s.name === e.target.value);
                        setSetoranForm({
                          ...setoranForm,
                          surah: e.target.value,
                          ayatMulai: 1,
                          ayatAkhir: selectedSurah?.ayatCount || 1,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {getSurahsForJuz(setoranForm.juz).map(s => (
                        <option key={`${s.name}-${s.ayatRange || 'full'}`} value={s.name}>{getSurahLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Ayat Mulai</label>
                      <input type="number" min={1} value={setoranForm.ayatMulai}
                        onChange={e => setSetoranForm({ ...setoranForm, ayatMulai: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Ayat Akhir</label>
                      <input type="number" min={1} value={setoranForm.ayatAkhir}
                        onChange={e => setSetoranForm({ ...setoranForm, ayatAkhir: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>
                </div>

                {/* Keterangan Kesalahan */}
                <div className="pt-2 border-t border-border">
                  <h5 className="text-sm font-semibold text-foreground mb-1">📝 Keterangan Kesalahan</h5>
                  <p className="text-[11px] text-muted-foreground mb-3">Catat jumlah kesalahan yang ditemukan selama setoran hafalan</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'kesalahanMakhraj', label: 'Kesalahan Makhraj', desc: 'Salah pengucapan huruf / makhraj', tooltip: 'Contoh:\n• Huruf ث dibaca س\n• Huruf ذ dibaca ز\n• Huruf ض dibaca د\n• Huruf ظ dibaca ز\n• Huruf ق dibaca ك' },
                      { key: 'kesalahanTajwid', label: 'Kesalahan Tajwid', desc: 'Hukum tajwid tidak diterapkan', tooltip: 'Contoh:\n• Idgham dibaca izhhar\n• Ikhfa tidak diterapkan\n• Qalqalah tidak dibaca membal\n• Iqlab tidak dilakukan\n• Ghunnah kurang dengung' },
                      { key: 'kesalahanMad', label: 'Kesalahan Mad', desc: 'Panjang pendek bacaan tidak sesuai', tooltip: 'Contoh:\n• Mad thabi\'i kurang 2 harakat\n• Mad wajib muttashil kurang panjang\n• Mad lazim tidak 6 harakat\n• Mad \'aridh lissukun dipendekkan\n• Mad lin tidak dibaca panjang' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                          {field.label}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] whitespace-pre-line text-xs">
                                {field.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </label>
                        <input type="number" min={0} max={50}
                          value={(setoranForm.koreksi as any)[field.key]}
                          onChange={e => setSetoranForm({
                            ...setoranForm,
                            koreksi: { ...setoranForm.koreksi, [field.key]: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{field.desc}</p>
                      </div>
                    ))}
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                        Lupa Ayat
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] whitespace-pre-line text-xs">
                              {"Contoh:\n• Lupa sambungan antar ayat\n• Lupa awal ayat berikutnya\n• Melewati ayat tanpa sadar\n• Perlu diingatkan guru"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <input type="number" min={0} max={50}
                        value={setoranForm.lupaAyat}
                        onChange={e => setSetoranForm({ ...setoranForm, lupaAyat: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Lupa lanjutan ayat / ayat terlewat</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                        Terhenti / Terbata
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] whitespace-pre-line text-xs">
                              {"Contoh:\n• Berhenti lama di tengah ayat\n• Membaca terbata-bata\n• Mengulang-ulang kata\n• Ragu dalam melanjutkan"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <input type="number" min={0} max={50}
                        value={setoranForm.terhentiTerbata}
                        onChange={e => setSetoranForm({ ...setoranForm, terhentiTerbata: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Bacaan terputus-putus / tidak lancar</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                        Kelancaran (1-10)
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] whitespace-pre-line text-xs">
                              {"Panduan skor:\n• 9-10: Sangat lancar, tanpa jeda\n• 7-8: Lancar, sedikit jeda\n• 5-6: Cukup, beberapa kali jeda\n• 3-4: Kurang lancar, sering jeda\n• 1-2: Tidak lancar, sangat terbata"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <input type="number" min={0} max={10}
                        value={setoranForm.koreksi.kelancaran}
                        onChange={e => setSetoranForm({
                          ...setoranForm,
                          koreksi: { ...setoranForm.koreksi, kelancaran: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Skor kelancaran keseluruhan</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">
                      Nilai Otomatis: <span className="text-lg font-bold text-primary">{calculateNilaiSetoran(setoranForm.koreksi)}</span>
                    </p>
                  </div>
                </div>

                {/* Catatan Guru */}
                <div className="pt-2 border-t border-border">
                  <h5 className="text-sm font-semibold text-foreground mb-1">💬 Catatan Guru / Pembimbing</h5>
                  <p className="text-[11px] text-muted-foreground mb-2">Tuliskan komentar atau masukan untuk siswa</p>
                  <textarea
                    value={setoranForm.catatanGuru}
                    onChange={e => setSetoranForm({ ...setoranForm, catatanGuru: e.target.value })}
                    placeholder="Contoh: Hafalan sudah lancar namun masih perlu memperbaiki mad thabi'i"
                    className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      "Hafalan sudah lancar namun masih perlu memperbaiki mad thabi'i",
                      "Makhraj huruf ض dan ظ masih perlu latihan",
                      "Perlu memperbanyak murajaah",
                      "Bacaan sudah sangat baik",
                    ].map(saran => (
                      <button key={saran} type="button"
                        onClick={() => setSetoranForm({ ...setoranForm, catatanGuru: saran })}
                        className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
                        {saran.length > 40 ? saran.slice(0, 40) + '…' : saran}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSetoranForm(false)}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    Batal
                  </button>
                  <button onClick={handleAddSetoran}
                    disabled={addSetoran.isPending}
                    className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                    {addSetoran.isPending ? "Menyimpan..." : "Simpan Setoran"}
                  </button>
                </div>
              </div>
            )}

            {/* Setoran List */}
            <div className="space-y-3">
              {setoran.map((s: any) => (
                <div key={s.id} className="bg-card rounded-lg border border-border p-4 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{s.surah} (Ayat {s.ayat_mulai}-{s.ayat_akhir})</p>
                      <p className="text-xs text-muted-foreground">Juz {s.juz} · {s.tanggal}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${s.nilai >= 80 ? 'text-success' : s.nilai >= 60 ? 'text-warning' : 'text-destructive'}`}>
                          {s.nilai}
                        </p>
                        <p className="text-xs text-muted-foreground">Nilai</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2 text-xs text-muted-foreground">
                    <span>Makhraj: {s.kesalahan_makhraj}</span>
                    <span>Tajwid: {s.kesalahan_tajwid}</span>
                    <span>Mad: {s.kesalahan_mad}</span>
                    <span>Lupa: {s.lupa_ayat || 0}</span>
                    <span>Terhenti: {s.terhenti_terbata || 0}</span>
                    <span>Lancar: {s.kelancaran}/10</span>
                  </div>
                  {s.catatan_guru && (
                    <p className="mt-1.5 text-xs text-muted-foreground italic">💬 {s.catatan_guru}</p>
                  )}
                </div>
              ))}
              {setoran.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Belum ada setoran</p>
              )}
            </div>
          </TabsContent>

          {/* UJIAN TAB */}
          <TabsContent value="ujian" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Ujian Sertifikasi</h3>
              {isLoggedIn && (
              <button
                onClick={() => setShowUjianForm(!showUjianForm)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                Mulai Ujian
              </button>
              )}
            </div>

            {showUjianForm && (
              <div className="bg-card rounded-lg border border-border p-5 shadow-card animate-scale-in space-y-4">
                <h4 className="font-semibold text-foreground">Form Ujian Sertifikasi</h4>

                {/* Keterangan Rumus Penilaian */}
                <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5">📐 Rumus & Bobot Penilaian</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
                      <p className="text-xs font-semibold text-foreground mb-1">1️⃣ Lahn Jali</p>
                      <p className="text-[10px] text-muted-foreground">Kesalahan nyata: salah huruf, harakat, makhraj</p>
                      <p className="text-xs font-bold text-destructive mt-1">Penalti: −4 poin / kesalahan</p>
                    </div>
                    <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                      <p className="text-xs font-semibold text-foreground mb-1">2️⃣ Lahn Khofi</p>
                      <p className="text-[10px] text-muted-foreground">Kesalahan samar: mad, ghunnah, tajwid, irama</p>
                      <p className="text-xs font-bold text-orange-600 mt-1">Penalti: −2 poin / kesalahan</p>
                    </div>
                    <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-foreground mb-1">3️⃣ Kelancaran</p>
                      <p className="text-[10px] text-muted-foreground">Skor 60–100 berdasarkan kelancaran bacaan</p>
                      <p className="text-xs font-bold text-primary mt-1">Bobot: 40% dari nilai akhir</p>
                    </div>
                    <div className="p-3 rounded-md bg-accent border border-border">
                      <p className="text-xs font-semibold text-foreground mb-1">4️⃣ Waqaf & Ibtida</p>
                      <p className="text-[10px] text-muted-foreground">Kesalahan berhenti dan memulai bacaan</p>
                      <p className="text-xs font-bold text-foreground mt-1">Penalti: −2 poin / kesalahan</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-accent/50 border border-border space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">📝 Rumus Nilai Per Surat:</p>
                    <p className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded">Koreksi = 100 − (Lahn Jali × 4) − (Lahn Khofi × 2) − (Waqaf & Ibtida × 2)</p>
                    <p className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded">Nilai = (Koreksi × 60%) + (Kelancaran × 40%)</p>
                    <p className="text-xs font-semibold text-foreground mt-2">📊 Nilai Akhir Ujian = Rata-rata nilai seluruh surat</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">Mumtaz: 90–100</span>
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">Jiddan Jayyid: 80–89</span>
                    <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">Jayyid: 70–79</span>
                    <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-medium">Perlu Perbaikan: &lt;70</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">✅ Lulus: ≥ 85</span>
                  </div>
                </div>

                {/* TAHFIZH FORM */}
                  <>
                    <div className="space-y-4">
                      {tahfizhEntries.map((entry, index) => (
                        <div key={index} className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-foreground">Surat #{index + 1}</h5>
                            {tahfizhEntries.length > 1 && (
                              <button onClick={() => removeTahfizhEntry(index)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Juz yang Diujikan</label>
                              <select value={entry.juz}
                                onChange={e => updateTahfizhEntry(index, 'juz', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                                  <option key={j} value={j}>📖 Juz {j}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Surah</label>
                              <select value={entry.surah}
                                onChange={e => updateTahfizhEntry(index, 'surah', e.target.value)}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                {getSurahsForJuz(entry.juz).map(s => (
                                  <option key={`${s.name}-${s.ayatRange || 'full'}`} value={s.name}>{getSurahLabel(s)}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Lahn Jali */}
                          <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
                            <h6 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                              1️⃣ Lahn Jali (Kesalahan Nyata)
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-destructive cursor-help transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] whitespace-pre-line text-xs">
                                    {"Contoh Lahn Jali:\n• Huruf ث dibaca س\n• Harakat fathah dibaca kasrah\n• Huruf ع dibaca hamzah\n• Huruf ص dibaca س\n• Menambah/mengurangi huruf"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </h6>
                            <p className="text-[10px] text-muted-foreground mb-2">Salah huruf · Salah harakat · Huruf tertukar · Makhraj jelas salah</p>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Jumlah Kesalahan</label>
                              <input type="number" min={0} max={50} value={entry.lahn_jali}
                                onChange={e => updateTahfizhEntry(index, 'lahn_jali', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                              <p className="text-[10px] text-muted-foreground mt-1">Skor: 100 - ({entry.lahn_jali} × 4) = <span className="font-bold text-foreground">{Math.max(0, 100 - entry.lahn_jali * 4)}</span></p>
                            </div>
                          </div>

                          {/* Lahn Khofi */}
                          <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                            <h6 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                              2️⃣ Lahn Khofi (Kesalahan Samar)
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-warning cursor-help transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] whitespace-pre-line text-xs">
                                    {"Contoh Lahn Khofi:\n• Mad thabi'i kurang 2 harakat\n• Ghunnah kurang berdengung\n• Ikhfa tidak tepat\n• Waqaf/ibtida kurang sesuai\n• Irama bacaan tidak konsisten"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </h6>
                            <p className="text-[10px] text-muted-foreground mb-2">Kurang panjang mad · Ghunnah kurang jelas · Tajwid kurang sempurna · Irama kurang tepat</p>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Jumlah Kesalahan</label>
                              <input type="number" min={0} max={50} value={entry.lahn_khofi}
                                onChange={e => updateTahfizhEntry(index, 'lahn_khofi', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                              <p className="text-[10px] text-muted-foreground mt-1">Skor: 100 - ({entry.lahn_khofi} × 2) = <span className="font-bold text-foreground">{Math.max(0, 100 - entry.lahn_khofi * 2)}</span></p>
                            </div>
                          </div>

                          {/* Kelancaran */}
                          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                            <h6 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                              3️⃣ Kelancaran
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] whitespace-pre-line text-xs">
                                    {"Panduan kelancaran:\n• 100: Sangat lancar tanpa jeda\n• 90: Lancar, jeda sangat sedikit\n• 80: Cukup lancar, beberapa jeda\n• 70: Kurang lancar, sering jeda\n• 60: Tidak lancar, sangat terbata"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </h6>
                            <select value={entry.kelancaran}
                              onChange={e => updateTahfizhEntry(index, 'kelancaran', parseInt(e.target.value))}
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                              {KELANCARAN_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Waqaf & Ibtida */}
                          <div className="p-3 rounded-md bg-accent/50 border border-border">
                            <h6 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                              4️⃣ Waqaf & Ibtida (−2 poin/kesalahan)
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground cursor-help transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] whitespace-pre-line text-xs">
                                    {"Contoh Kesalahan Waqaf & Ibtida:\n• Berhenti di tengah kalimat yang masih terhubung\n• Memulai bacaan bukan dari awal kalimat\n• Tidak memperhatikan tanda waqaf lazim\n• Waqaf di tempat yang mengubah makna"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </h6>
                            <p className="text-[10px] text-muted-foreground mb-2">Kesalahan berhenti (waqaf) dan memulai (ibtida) bacaan · Setiap kesalahan −2 poin</p>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Jumlah Kesalahan</label>
                              <input type="number" min={0} value={entry.waqaf_ibtida}
                                onChange={e => updateTahfizhEntry(index, 'waqaf_ibtida', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </div>
                          </div>

                          {/* Nilai Surat */}
                          <div className="p-3 rounded-md bg-muted text-center">
                            <p className="text-xs text-muted-foreground">Koreksi = {Math.max(0, 100 - entry.lahn_jali * 4 - entry.lahn_khofi * 2 - entry.waqaf_ibtida * 2)} → Nilai = ({Math.max(0, 100 - entry.lahn_jali * 4 - entry.lahn_khofi * 2 - entry.waqaf_ibtida * 2)} × 60%) + ({entry.kelancaran} × 40%)</p>
                            <p className="text-2xl font-bold text-primary">{calculateNilaiSurah(entry)}</p>
                          </div>
                        </div>
                      ))}

                      <button onClick={addTahfizhEntry}
                        className="w-full py-2.5 rounded-md border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <Plus className="w-4 h-4 inline mr-1" /> Tambah Surat
                      </button>
                    </div>

                    {/* Catatan Guru */}
                    <div className="pt-2 border-t border-border">
                      <h5 className="text-sm font-semibold text-foreground mb-1">💬 Catatan Guru / Pembimbing</h5>
                      <p className="text-[11px] text-muted-foreground mb-2">Tuliskan komentar atau masukan untuk siswa</p>
                      <textarea value={catatanGuru}
                        onChange={e => setCatatanGuru(e.target.value)}
                        placeholder="Contoh: Hafalan sudah lancar namun masih perlu memperbaiki mad thabi'i"
                        className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          "Hafalan sudah lancar namun masih perlu memperbaiki mad thabi'i",
                          "Makhraj huruf ض dan ظ masih perlu latihan",
                          "Perlu memperbanyak murajaah",
                          "Bacaan sudah sangat baik",
                        ].map(saran => (
                          <button key={saran} type="button"
                            onClick={() => setCatatanGuru(saran)}
                            className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
                            {saran.length > 40 ? saran.slice(0, 40) + '…' : saran}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tahfizh Preview */}
                    {tahfizhPreview && (
                      <div className={`p-4 rounded-md ${tahfizhPreview.status === 'Lulus' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Nilai Akhir Ujian</p>
                            <p className="text-3xl font-bold text-foreground">{tahfizhPreview.nilaiAkhir}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${tahfizhPreview.status === 'Lulus' ? 'text-success' : 'text-destructive'}`}>
                              {tahfizhPreview.predikat}
                            </p>
                            <p className="text-sm font-medium">
                              {tahfizhPreview.status === 'Lulus' ? '✅ LULUS SERTIFIKASI' : '❌ BELUM LULUS'}
                            </p>
                            <p className="text-xs text-muted-foreground">Grade {tahfizhPreview.grade}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowUjianForm(false)}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                        Batal
                      </button>
                      <button onClick={handleTahfizhSubmit}
                        disabled={tahfizhEntries.length === 0 || addTahfizhUjian.isPending}
                        className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                        {addTahfizhUjian.isPending ? "Menyimpan..." : "Simpan Hasil Ujian Tahfizh"}
                      </button>
                    </div>
                  </>
              </div>
            )}

            {/* Ujian History */}
            <div className="space-y-3">
              {ujian.map((u: any) => {
                const isTahfizh = u.mode === 'Tahfizh' && u.nilai_aspek?.surahEntries;
                const predikat = u.nilai_akhir >= 90 ? 'Mumtaz' : u.nilai_akhir >= 80 ? 'Jiddan Jayyid' : u.nilai_akhir >= 70 ? 'Jayyid' : 'Perlu Perbaikan';

                return (
                  <div key={u.id} className={`bg-card rounded-lg border p-4 shadow-card ${u.status === 'Lulus' ? 'border-success/30' : 'border-destructive/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">Ujian {u.mode}</p>
                        <p className="text-xs text-muted-foreground">{u.tanggal}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{u.nilai_akhir}</p>
                        <p className={`text-xs font-medium ${u.status === 'Lulus' ? 'text-success' : 'text-destructive'}`}>
                          {isTahfizh ? predikat : `Grade ${u.grade}`} · {u.status === 'Lulus' ? '✅ Lulus' : '❌ Tidak Lulus'}
                        </p>
                      </div>
                    </div>

                    {isTahfizh ? (
                      <div className="space-y-2">
                        {(u.nilai_aspek.surahEntries as TahfizhSurahEntry[]).map((entry: TahfizhSurahEntry, i: number) => (
                          <div key={i} className="grid grid-cols-6 gap-2 text-center p-2 rounded-md bg-muted text-xs">
                            <div><p className="text-muted-foreground">Surat</p><p className="font-bold text-foreground">{entry.surah}</p></div>
                            <div><p className="text-muted-foreground">Lahn Jali</p><p className="font-bold text-foreground">{entry.lahn_jali}</p></div>
                            <div><p className="text-muted-foreground">Lahn Khofi</p><p className="font-bold text-foreground">{entry.lahn_khofi}</p></div>
                            <div><p className="text-muted-foreground">Kelancaran</p><p className="font-bold text-foreground">{entry.kelancaran}</p></div>
                            <div><p className="text-muted-foreground">Waqaf</p><p className="font-bold text-foreground">{entry.waqaf_ibtida ?? '-'}</p></div>
                            <div><p className="text-muted-foreground">Nilai</p><p className="font-bold text-primary">{calculateNilaiSurah(entry)}</p></div>
                          </div>
                        ))}
                        {u.nilai_aspek.catatanGuru && (
                          <p className="text-xs text-muted-foreground italic mt-2">📝 {u.nilai_aspek.catatanGuru}</p>
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
        </Tabs>
      </main>
    </div>
  );
};

export default StudentDetail;
