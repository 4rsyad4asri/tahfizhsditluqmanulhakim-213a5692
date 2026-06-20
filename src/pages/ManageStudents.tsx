import { syncStudentStatus } from "@/utils/syncStudentStatus";
import { getStudentLevelFromExam, getStudentTargetLabelFromExam, type StudentExamSyncRow } from "@/utils/studentExamSync";
import {
  RefreshCcw,
  Loader2,
  Pencil,
  Trash2,
  Search,
  UserPlus,
  Users,
  ChevronDown,
  FileSpreadsheet,
  AlertTriangle,
  Download
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { DataTablePagination } from "@/components/DataTablePagination";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportJsonToExcel } from "@/utils/excel";
import ImportStudentsDialog from "@/components/ImportStudentsDialog";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import { formatStudentName } from "@/utils/formatName";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
"@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type StudentLevel = Database["public"]["Enums"]["student_level"];
type CertStatus = Database["public"]["Enums"]["certification_status"];
type StudentStatus = "aktif" | "alumni" | "pindah" | "nonaktif";

interface StudentForm {
  name: string;
  nis: string;
  nisn: string;
  class_id: string;
  target_juz: number;
  level: StudentLevel;
  progress_hafalan: number;
  status_siswa: StudentStatus;
  status_sertifikasi: CertStatus;
}

const emptyForm: StudentForm = {
  name: "",
  nis: "",
  nisn: "",
  class_id: "",
  target_juz: 30,
  level: "Tahsin Dasar",
  progress_hafalan: 0,
  status_siswa: "aktif",
  status_sertifikasi: "Belum Ujian"
};
interface Student {
  id: string;
  name: string;
  nis: string | null;
  nisn: string | null;
  class_id: string;
  target_juz: number;
  level: StudentLevel;
  progress_hafalan: number;
  status_siswa: StudentStatus;
  status_sertifikasi: CertStatus;

  classes?: {
    name: string;
    grade: number;
    section: string;
  } | null;
}

type StudentListRow = Student & {
  effectiveLevel: StudentLevel;
  latestTargetLabel: string;
};
const ManageStudents = () => {
  const [syncing, setSyncing] = useState(false);
  const { isAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStudentStatus, setSelectedStudentStatus] = useState<"all" | StudentStatus>("aktif");
  const [selectedLevel, setSelectedLevel] = useState<"all" | StudentLevel>("all");
  const [selectedCertificationStatus, setSelectedCertificationStatus] = useState<"all" | CertStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedClass, selectedStudentStatus, selectedLevel, selectedCertificationStatus]);

  const handleSyncStatus = async () => {

  try {

    setSyncing(true);

    const total = await syncStudentStatus();
    await queryClient.invalidateQueries({
      queryKey: ["all-students"]
    });
    await queryClient.invalidateQueries({
      queryKey: ["all-student-latest-exams"]
    });
    
    toast.success(`${total} data siswa berhasil disinkronkan dari ujian terakhir`);

  } catch (e) {

    toast.error("Gagal sinkronisasi status");

  } finally {

    setSyncing(false);

  }
};
  // Fetch classes
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
  }
});

  // Fetch students with class info
  const { data: students, isLoading } = useQuery({
    queryKey: ["all-students", selectedClass],
    queryFn: async () => {
      let query = supabase.
      from("students").
      select("*, classes(name, grade, section)").
      order("name");

      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: latestExams } = useQuery({
    queryKey: ["all-student-latest-exams"],
    queryFn: async (): Promise<StudentExamSyncRow[]> => {
      const { data, error } = await supabase
        .from("ujian")
        .select("student_id, mode, nilai_aspek, status, created_at, tanggal")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as StudentExamSyncRow[];
    }
  });

  // Add student
  const addMutation = useMutation({
    mutationFn: async (data: StudentForm) => {
      const { error } = await supabase.from("students").insert({
        name: formatStudentName(data.name),
        nis: data.nis.trim() || null,
        nisn: data.nisn.trim() || null,
        class_id: data.class_id,
        target_juz: data.target_juz,
        level: data.level,
        progress_hafalan: data.progress_hafalan,
        status_siswa: data.status_siswa,
        status_sertifikasi: data.status_sertifikasi
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-student-latest-exams"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Siswa berhasil ditambahkan!");
      resetForm();
    },
    onError: (err) => toast.error(getSafeErrorMessage(err))
  });

  // Update student
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: {id: string;data: StudentForm;}) => {
      const { error } = await supabase.
      from("students").
      update({
        name: formatStudentName(data.name),
        nis: data.nis.trim() || null,
        nisn: data.nisn.trim() || null,
        class_id: data.class_id,
        target_juz: data.target_juz,
        level: data.level,
        progress_hafalan: data.progress_hafalan,
        status_siswa: data.status_siswa,
        status_sertifikasi: data.status_sertifikasi
      }).
      eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-student-latest-exams"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Data siswa berhasil diperbarui!");
      resetForm();
    },
    onError: (err) => toast.error(getSafeErrorMessage(err))
  });

  // Delete student
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-student-latest-exams"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Siswa berhasil dihapus!");
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(getSafeErrorMessage(err))
  });

const deleteAllMutation = useMutation({
  mutationFn: async () => {
    let query = supabase.from("students").delete();

    if (selectedClass !== "all") {
      query = query.eq("class_id", selectedClass);
    } else {
      query = query.not("id", "is", null);
    }

    const { error } = await query;

    if (error) throw error;
  },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-student-latest-exams"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(selectedClass !== "all" ? "Semua siswa di kelas ini berhasil dihapus!" : "Semua data siswa berhasil dihapus!");
      setDeleteAllConfirm(false);
    },
    onError: (err) => toast.error(getSafeErrorMessage(err))
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const openEdit = (student: Student) => {
    setForm({
      name: student.name,
      nis: student.nis || "",
      nisn: student.nisn || "",
      class_id: student.class_id,
      target_juz: student.target_juz,
      level: student.level,
      progress_hafalan: student.progress_hafalan,
      status_siswa: student.status_siswa || "aktif",
      status_sertifikasi: student.status_sertifikasi
    });
    setEditingId(student.id);
    setFormOpen(true);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;
  const handleSubmit = () => {
    if (isPending) return;
    
    if (!form.name.trim()) {
      toast.error("Nama siswa wajib diisi!");
      return;
    }
    if (!form.class_id) {
      toast.error("Pilih kelas terlebih dahulu!");
      return;
    }
    if (form.nis && !/^\d{1,20}$/.test(form.nis)) {
      toast.error("NIS hanya boleh berisi 1-20 digit!");
      return;
    }
    if (form.nisn && !/^\d{10}$/.test(form.nisn)) {
      toast.error("NISN harus terdiri dari tepat 10 digit!");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const latestExamByStudent = useMemo(() => {
    const map = new Map<string, StudentExamSyncRow>();
    for (const exam of latestExams || []) {
      if (!map.has(exam.student_id)) {
        map.set(exam.student_id, exam);
      }
    }
    return map;
  }, [latestExams]);

const filteredStudents: StudentListRow[] = useMemo(() => {
  return ((students || []) as Student[])
    .map((s) => {
      const latestExam = latestExamByStudent.get(s.id);
      return {
        ...s,
        effectiveLevel: getStudentLevelFromExam(latestExam?.mode) || s.level,
        latestTargetLabel: getStudentTargetLabelFromExam(latestExam) || `Juz ${s.target_juz}`,
      };
    })
    .filter((s) => {
      const query = search.trim().toLowerCase();
      const studentStatus = (s.status_siswa || "aktif") as StudentStatus;
      const matchesSearch =
        !query ||
        (s.name || "").toLowerCase().includes(query) ||
        (s.nis || "").includes(query) ||
        (s.nisn || "").includes(query);
      const matchesStudentStatus =
        selectedStudentStatus === "all" || studentStatus === selectedStudentStatus;
      const matchesLevel =
        selectedLevel === "all" || s.effectiveLevel === selectedLevel;
      const matchesCertificationStatus =
        selectedCertificationStatus === "all" ||
        s.status_sertifikasi === selectedCertificationStatus;

      return matchesSearch && matchesStudentStatus && matchesLevel && matchesCertificationStatus;
    });
}, [latestExamByStudent, search, selectedCertificationStatus, selectedLevel, selectedStudentStatus, students]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  const handleExport = () => {
    const dataToExport = filteredStudents.map((s: StudentListRow) => ({
      "Nama": formatStudentName(s.name),
      "NIS": s.nis || "",
      "NISN": s.nisn || "",
      "Kelas": s.classes?.name || "",
      "Status Siswa": s.status_siswa || "aktif",
      "Target Terakhir": s.latestTargetLabel,
      "Level": s.effectiveLevel,
      "Status Sertifikasi": s.status_sertifikasi,
    }));

    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const className = selectedClass !== "all"
      ? `_${(classes || []).find((c: { id: string; name: string }) => c.id === selectedClass)?.name || "kelas"}`
      : "";
    exportJsonToExcel(dataToExport, "Data Siswa", `data_siswa${className}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${dataToExport.length} data siswa berhasil diexport!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Kelola Data Siswa
            </h2>
            <p className="text-sm text-muted-foreground">
              Tambah, edit, atau hapus data siswa dari seluruh kelas
            </p>
          </div>

          {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-destructive/10 hover:bg-destructive/20 transition-colors border border-destructive/20 text-destructive">
              <Trash2 className="w-4 h-4" />
              Hapus Semua
            </button>
            <button
              onClick={handleExport}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 text-primary disabled:opacity-50">
              <Download className="w-4 h-4" />
              Export Excel
            </button>

            <button
  onClick={handleSyncStatus}
  disabled={syncing}
  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-100 hover:bg-green-200 transition-colors border border-green-300 text-green-700 disabled:opacity-50"
>
  {syncing ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      Sinkronisasi...
    </>
  ) : (
    <>
      <RefreshCcw className="w-4 h-4" />
      Sinkronkan Data Ujian
    </>
  )}
</button>

<button
  onClick={() => setImportOpen(true)}
  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent/10 hover:bg-accent/20 transition-colors border border-accent/20 text-amber-700"
>
  <FileSpreadsheet className="w-4 h-4" />
  Import Excel/CSV
</button>

          <Dialog open={formOpen} onOpenChange={(open) => {
  if (!open) {
    resetForm();
  } else {
    setFormOpen(true);
  }
}}
>            
            <DialogTrigger asChild>
              <button
                  onClick={() => {setForm(emptyForm);setEditingId(null);}}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity">

                <UserPlus className="w-4 h-4" />
                Tambah Siswa Baru
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nama Siswa *</label>
                  <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Masukkan nama lengkap siswa"
                      maxLength={100}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />

                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">NIS</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.nis}
                      onChange={(e) => setForm({ ...form, nis: e.target.value.replace(/\D/g, "").slice(0, 20) })}
                      placeholder="Boleh dikosongkan"
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">NISN</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.nisn}
                      onChange={(e) => setForm({ ...form, nisn: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                      placeholder="10 digit NISN"
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Kelas *</label>
                  <select
                      value={form.class_id}
                      onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">

                    <option value="">-- Pilih Kelas --</option>
                    {(classes || []).map((c) =>
                      <option key={c.id} value={c.id}>{c.name}</option>
                      )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Target Juz</label>
                    <select
                        value={form.target_juz}
                        onChange={(e) => setForm({ ...form, target_juz: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">

                      {Array.from({ length: 30 }, (_, i) => i + 1).map((j) =>
                        <option key={j} value={j}>Juz {j}</option>
                        )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Level</label>
                    <select
                        value={form.level}
                        onChange={(e) => setForm({ ...form, level: e.target.value as StudentLevel })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">

                      <option value="Tahsin Dasar">Tahsin Dasar</option>
                      <option value="Tahsin Lanjutan">Tahsin Lanjutan</option>
                      <option value="Tahfizh">Tahfizh</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Status Siswa</label>
                    <select
                        value={form.status_siswa}
                        onChange={(e) => setForm({ ...form, status_siswa: e.target.value as StudentStatus })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">

                      <option value="aktif">Aktif</option>
                      <option value="alumni">Alumni</option>
                      <option value="pindah">Pindah</option>
                      <option value="nonaktif">Nonaktif</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                    <select
                        value={form.status_sertifikasi}
                        onChange={(e) => setForm({ ...form, status_sertifikasi: e.target.value as CertStatus })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">

                      <option value="Belum Ujian">Belum Ujian</option>
                      <option value="Lulus">Lulus</option>
                      <option value="Tidak Lulus">Tidak Lulus</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                      onClick={resetForm}
                      className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">

                    Batal
                  </button>
                  <button
                      onClick={handleSubmit}
                      disabled={isPending}
                      className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">

                    {isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Siswa"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
          )}

          {isAdmin && <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />}
        </div>

        {/* Filters */}
        <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,180px))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama, NIS, atau NISN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />

          </div>
          <div className="relative">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]">

              <option value="all">Semua Kelas</option>
              {(classes || []).map((c) =>
              <option key={c.id} value={c.id}>{c.name}</option>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedStudentStatus}
              onChange={(e) => setSelectedStudentStatus(e.target.value as "all" | StudentStatus)}
              className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">Semua Status Siswa</option>
              <option value="aktif">Aktif</option>
              <option value="alumni">Alumni</option>
              <option value="pindah">Pindah</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as "all" | StudentLevel)}
              className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">Semua Level</option>
              <option value="Tahsin Dasar">Tahsin Dasar</option>
              <option value="Tahsin Lanjutan">Tahsin Lanjutan</option>
              <option value="Tahfizh">Tahfizh</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedCertificationStatus}
              onChange={(e) => setSelectedCertificationStatus(e.target.value as "all" | CertStatus)}
              className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">Semua Sertifikasi</option>
              <option value="Belum Ujian">Belum Ujian</option>
              <option value="Lulus">Lulus</option>
              <option value="Tidak Lulus">Tidak Lulus</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Count */}
        <p className="text-sm text-muted-foreground mb-4">
          Menampilkan {filteredStudents.length} siswa
        </p>

        {isLoading ?
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div> :

        <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginatedStudents.map((student: StudentListRow) =>
            <div key={student.id} className="bg-card rounded-lg border border-border p-4 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{formatStudentName(student.name)}</h3>
                      <p className="text-xs text-muted-foreground">{student.classes?.name}</p>
                    </div>
                    {isAdmin && (
                    <div className="flex gap-1">
                      <button
                    onClick={() => openEdit(student)}
                    className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                    onClick={() => setDeleteConfirm(student.id)}
                    className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>NIS: <span className="text-foreground">{student.nis || "-"}</span></span>
                    <span>NISN: <span className="text-foreground">{student.nisn || "-"}</span></span>
                    <span>Status Siswa: <span className="text-foreground">{student.status_siswa || "aktif"}</span></span>
                    <span>Level: <span className="text-foreground">{student.effectiveLevel}</span></span>
                    <span>Target: <span className="text-foreground">{student.latestTargetLabel}</span></span>
                    <span>Sertifikasi: <span className="text-foreground">{student.status_sertifikasi}</span></span>
                  </div>
                </div>
            )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-lg border border-border shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-20">
                    <tr className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nama</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">NIS</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">NISN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Kelas</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status Siswa</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Target Terakhir</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Level</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student: StudentListRow, idx: number) =>
                  <tr key={student.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx % 2 ? 'bg-muted/10' : ''}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{formatStudentName(student.name)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.nis || "-"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.nisn || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{student.classes?.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            (student.status_siswa || "aktif") === "aktif"
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : (student.status_siswa || "aktif") === "alumni"
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : (student.status_siswa || "aktif") === "pindah"
                                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                                  : "bg-slate-200 text-slate-700 border border-slate-300"
                          }`}>
                            {student.status_siswa || "aktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{student.latestTargetLabel}</td>
                      <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      student.effectiveLevel === 'Tahfizh' ? 'bg-primary/10 text-primary' :
                      student.effectiveLevel === 'Tahsin Lanjutan' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                      'bg-muted text-muted-foreground'
                    }`}>{student.effectiveLevel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      student.status_sertifikasi === 'Lulus' ? 'bg-success/10 text-success' :
                      student.status_sertifikasi === 'Tidak Lulus' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'}`
                      }>
                            {student.status_sertifikasi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                          onClick={() => openEdit(student)}
                          className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                          onClick={() => setDeleteConfirm(student.id)}
                          className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          title="Hapus">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredStudents.length > 0 && (
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}

            {filteredStudents.length === 0 && !isLoading &&
          <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Tidak ada siswa yang cocok dengan filter saat ini</p>
                <p className="text-xs mt-1">Klik "Tambah Siswa Baru" untuk memulai</p>
              </div>
          }
          </>
        }

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Hapus Siswa?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Data siswa beserta semua setoran dan ujian akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">

                Batal
              </button>
              <button
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">

                {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Delete All Confirmation Dialog */}
        <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Hapus Semua Siswa?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {selectedClass !== "all"
                ? "Semua data siswa di kelas yang dipilih beserta setoran dan ujian akan dihapus permanen."
                : "SEMUA data siswa beserta seluruh setoran dan ujian akan dihapus permanen dari sistem."}
            </p>
            <p className="text-xs font-semibold text-destructive">Tindakan ini tidak bisa dibatalkan!</p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteAllConfirm(false)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                Batal
              </button>
              <button
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {deleteAllMutation.isPending ? "Menghapus..." : "Ya, Hapus Semua"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>);

};

export default ManageStudents;
