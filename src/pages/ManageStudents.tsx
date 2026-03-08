import { useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Plus, Pencil, Trash2, Search, Loader2, UserPlus, Users, ChevronDown, FileSpreadsheet, AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import ImportStudentsDialog from "@/components/ImportStudentsDialog";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
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

interface StudentForm {
  name: string;
  class_id: string;
  target_juz: number;
  level: StudentLevel;
  progress_hafalan: number;
  status_sertifikasi: CertStatus;
}

const emptyForm: StudentForm = {
  name: "",
  class_id: "",
  target_juz: 30,
  level: "Tahsin Dasar",
  progress_hafalan: 0,
  status_sertifikasi: "Belum Ujian"
};

const ManageStudents = () => {
  const { user } = useAuthContext();
  const isLoggedIn = !!user;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ["all-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("classes").
      select("*").
      order("grade").
      order("section");
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

  // Add student
  const addMutation = useMutation({
    mutationFn: async (data: StudentForm) => {
      const { error } = await supabase.from("students").insert({
        name: data.name.trim(),
        class_id: data.class_id,
        target_juz: data.target_juz,
        level: data.level,
        progress_hafalan: data.progress_hafalan,
        status_sertifikasi: data.status_sertifikasi
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
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
        name: data.name.trim(),
        class_id: data.class_id,
        target_juz: data.target_juz,
        level: data.level,
        progress_hafalan: data.progress_hafalan,
        status_sertifikasi: data.status_sertifikasi
      }).
      eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
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
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Siswa berhasil dihapus!");
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(getSafeErrorMessage(err))
  });

  // Delete all students
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      let query = supabase.from("students").delete();
      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass);
      } else {
        query = query.neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
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

  const openEdit = (student: any) => {
    setForm({
      name: student.name,
      class_id: student.class_id,
      target_juz: student.target_juz,
      level: student.level,
      progress_hafalan: student.progress_hafalan,
      status_sertifikasi: student.status_sertifikasi
    });
    setEditingId(student.id);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nama siswa wajib diisi!");
      return;
    }
    if (!form.class_id) {
      toast.error("Pilih kelas terlebih dahulu!");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const filteredStudents = (students || []).filter((s: any) =>
  s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const dataToExport = filteredStudents.map((s: any) => ({
      "Nama": s.name,
      "Kelas": s.classes?.name || "",
      "Target Juz": s.target_juz,
      "Level": s.level,
      "Progress (%)": s.progress_hafalan,
      "Status Sertifikasi": s.status_sertifikasi,
    }));

    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    const className = selectedClass !== "all"
      ? `_${(classes || []).find(c => c.id === selectedClass)?.name || "kelas"}`
      : "";
    XLSX.writeFile(wb, `data_siswa${className}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${dataToExport.length} data siswa berhasil diexport!`);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <Header />
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

          {isLoggedIn && (
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
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent/10 hover:bg-accent/20 transition-colors border border-accent/20 text-amber-700">

              <FileSpreadsheet className="w-4 h-4" />
              Import Excel/CSV
            </button>

          <Dialog open={formOpen} onOpenChange={(open) => {if (!open) resetForm();setFormOpen(open);}}>
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
                        onChange={(e) => setForm({ ...form, target_juz: parseInt(e.target.value) })}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Progress (%)</label>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.progress_hafalan}
                        onChange={(e) => setForm({ ...form, progress_hafalan: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />

                  </div>
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
                      className="px-4 py-2 rounded-md text-sm font-medium gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">

                    {isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Siswa"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
          )}

          {isLoggedIn && <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama siswa..."
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
              {filteredStudents.map((student: any) =>
            <div key={student.id} className="bg-card rounded-lg border border-border p-4 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{student.name}</h3>
                      <p className="text-xs text-muted-foreground">{student.classes?.name}</p>
                    </div>
                    {isLoggedIn && (
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
                    <span>Level: <span className="text-foreground">{student.level}</span></span>
                    <span>Juz: <span className="text-foreground">{student.target_juz}</span></span>
                    <span>Progress: <span className="text-foreground">{student.progress_hafalan}%</span></span>
                    <span>Status: <span className="text-foreground">{student.status_sertifikasi}</span></span>
                  </div>
                </div>
            )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-lg border border-border shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nama</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Kelas</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Target</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Level</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Progress</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student: any, idx: number) =>
                  <tr key={student.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx % 2 ? 'bg-muted/10' : ''}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{student.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{student.classes?.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">Juz {student.target_juz}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      student.level === 'Tahfizh' ? 'bg-primary/10 text-primary' :
                      student.level === 'Tahsin Lanjutan' ? 'bg-accent/10 text-accent' :
                      'bg-muted text-muted-foreground'}`
                      }>{student.level}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full gradient-islamic" style={{ width: `${student.progress_hafalan}%` }} />
                            </div>
                            <span className="text-xs text-foreground">{student.progress_hafalan}%</span>
                          </div>
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
                          {isLoggedIn && (
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

            {filteredStudents.length === 0 && !isLoading &&
          <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada siswa {selectedClass !== "all" ? "di kelas ini" : ""}</p>
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