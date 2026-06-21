import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

type AcademicYearRow = {
  id: string;
  name: string;
  is_active: boolean;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type AcademicSemesterRow = {
  id: string;
  academic_year_id: string;
  semester_number: number;
  name: string;
  is_active: boolean;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_ACADEMIC_YEARS: AcademicYearRow[] = [];
const EMPTY_ACADEMIC_SEMESTERS: AcademicSemesterRow[] = [];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, "");

export default function AcademicYears() {
  const { isAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    activate_now: false,
  });
  const [semesterDates, setSemesterDates] = useState<
    Record<string, { start_date: string; end_date: string }>
  >({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["academic-years"],
    queryFn: async (): Promise<{ years: AcademicYearRow[]; semesters: AcademicSemesterRow[] }> => {
      const [yearsResult, semestersResult] = await Promise.all([
        supabase
          .from("academic_years")
          .select("*")
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("academic_semesters")
          .select("*")
          .order("semester_number", { ascending: true }),
      ]);

      if (yearsResult.error) throw yearsResult.error;
      if (semestersResult.error) throw semestersResult.error;
      return {
        years: yearsResult.data || [],
        semesters: semestersResult.data || [],
      };
    },
    enabled: isAdmin,
  });

  const years = data?.years || EMPTY_ACADEMIC_YEARS;
  const semesters = data?.semesters || EMPTY_ACADEMIC_SEMESTERS;
  const activeYear = useMemo(() => years.find((item) => item.is_active) || null, [years]);
  const activeSemester = useMemo(() => semesters.find((item) => item.is_active) || null, [semesters]);
  const semestersByYear = useMemo(
    () =>
      semesters.reduce<Record<string, AcademicSemesterRow[]>>((result, semester) => {
        (result[semester.academic_year_id] ||= []).push(semester);
        return result;
      }, {}),
    [semesters],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["academic-years"] });

  const createYear = useMutation({
    mutationFn: async () => {
      const cleanedName = normalizeName(form.name);
      if (!cleanedName) throw new Error("Nama tahun ajaran wajib diisi.");
      if (!/^\d{4}\/\d{4}$/.test(cleanedName)) {
        throw new Error("Gunakan format nama seperti 2025/2026.");
      }
      const [startYear, endYear] = cleanedName.split("/").map(Number);
      if (endYear !== startYear + 1) {
        throw new Error("Tahun ajaran harus berurutan, misalnya 2025/2026.");
      }
      if (form.start_date && form.end_date && form.start_date > form.end_date) {
        throw new Error("Tanggal mulai tidak boleh melewati tanggal selesai.");
      }

      const payload = {
        name: cleanedName,
        is_active: form.activate_now,
        status: form.activate_now ? "aktif" : "arsip",
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      const { error } = await supabase.from("academic_years").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Tahun ajaran berhasil ditambahkan.");
      setForm({ name: "", start_date: "", end_date: "", activate_now: false });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan tahun ajaran.");
    },
  });

  const activateYear = useMutation({
    mutationFn: async (row: AcademicYearRow) => {
      const { error } = await supabase
        .from("academic_years")
        .update({ is_active: true, status: "aktif" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Tahun ajaran aktif berhasil diperbarui.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Gagal mengaktifkan tahun ajaran.");
    },
  });

  const activateSemester = useMutation({
    mutationFn: async (row: AcademicSemesterRow) => {
      const confirmed = window.confirm(
        `Aktifkan Semester ${row.name}? Tahun ajaran terkait juga akan menjadi aktif.`,
      );
      if (!confirmed) return false;

      const { error } = await supabase
        .from("academic_semesters")
        .update({ is_active: true, status: "aktif" })
        .eq("id", row.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async (changed) => {
      if (!changed) return;
      await refresh();
      toast.success("Semester aktif berhasil diperbarui.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Gagal mengaktifkan semester.");
    },
  });

  const saveSemesterDates = useMutation({
    mutationFn: async (row: AcademicSemesterRow) => {
      const dates = semesterDates[row.id] || {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
      };
      if (dates.start_date && dates.end_date && dates.start_date > dates.end_date) {
        throw new Error("Tanggal mulai semester tidak boleh melewati tanggal selesai.");
      }

      const { error } = await supabase
        .from("academic_semesters")
        .update({
          start_date: dates.start_date || null,
          end_date: dates.end_date || null,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Tanggal semester berhasil disimpan.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan tanggal semester.");
    },
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Akses ditolak. Hanya Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <CalendarDays className="h-6 w-6 text-primary" />
              Tahun Ajaran
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola tahun ajaran aktif dan arsip tanpa mengubah data siswa, ujian, rapor, atau sertifikat lama.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <p>
              <span className="font-semibold">Tahun ajaran aktif:</span>{" "}
              {activeYear ? activeYear.name : "Belum ada yang aktif"}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Semester aktif:</span>{" "}
              {activeSemester ? `${activeSemester.semester_number} - ${activeSemester.name}` : "Belum dipilih"}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Tambah Tahun Ajaran</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Tahun Ajaran</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Contoh: 2025/2026"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal Selesai</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.activate_now}
                  onChange={(event) => setForm((prev) => ({ ...prev, activate_now: event.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Jadikan aktif setelah dibuat
              </label>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => createYear.mutate()}
              disabled={createYear.isPending}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold gradient-islamic text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createYear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createYear.isPending ? "Menyimpan..." : "Simpan Tahun Ajaran"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-semibold text-foreground">Daftar Tahun Ajaran</h3>
            <p className="mt-1 text-sm text-muted-foreground">Hanya satu tahun ajaran yang bisa aktif dalam satu waktu.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-muted-foreground">
              Gagal memuat tahun ajaran. Pastikan migration `academic_years` sudah dijalankan di Supabase.
            </div>
          ) : years.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted-foreground">Belum ada data tahun ajaran.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Nama</th>
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Mulai</th>
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Selesai</th>
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Dibuat</th>
                      <th className="px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((row) => (
                      <Fragment key={row.id}>
                      <tr className="border-t border-border/70 align-top">
                        <td className="px-5 py-4 font-semibold text-foreground">{row.name}</td>
                        <td className="px-5 py-4">
                          <span
                            className={
                              row.is_active
                                ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                                : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {row.is_active ? "aktif" : row.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{formatDate(row.start_date)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{formatDate(row.end_date)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{formatDate(row.created_at)}</td>
                        <td className="px-5 py-4">
                          {row.is_active ? (
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              Sedang aktif
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => activateYear.mutate(row)}
                              disabled={activateYear.isPending}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Jadikan Aktif
                            </button>
                          )}
                        </td>
                      </tr>
                      <tr className="border-t border-border/40 bg-muted/10">
                        <td className="px-5 pb-5 pt-3" colSpan={6}>
                          <div className="grid gap-3 lg:grid-cols-2">
                            {(semestersByYear[row.id] || []).map((semester) => {
                              const dates = semesterDates[semester.id] || {
                                start_date: semester.start_date || "",
                                end_date: semester.end_date || "",
                              };
                              return (
                                <div key={semester.id} className="rounded-xl border border-border bg-muted/20 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-foreground">
                                      Semester {semester.semester_number} - {semester.name}
                                    </p>
                                    <span
                                      className={
                                        semester.is_active
                                          ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                                          : "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                                      }
                                    >
                                      {semester.is_active ? "aktif" : "arsip"}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      aria-label={`Tanggal mulai Semester ${semester.semester_number}`}
                                      value={dates.start_date}
                                      onChange={(event) =>
                                        setSemesterDates((prev) => ({
                                          ...prev,
                                          [semester.id]: { ...dates, start_date: event.target.value },
                                        }))
                                      }
                                      className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      type="date"
                                      aria-label={`Tanggal selesai Semester ${semester.semester_number}`}
                                      value={dates.end_date}
                                      onChange={(event) =>
                                        setSemesterDates((prev) => ({
                                          ...prev,
                                          [semester.id]: { ...dates, end_date: event.target.value },
                                        }))
                                      }
                                      className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveSemesterDates.mutate(semester)}
                                      disabled={saveSemesterDates.isPending}
                                      className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                                    >
                                      Simpan Tanggal
                                    </button>
                                    {!semester.is_active && (
                                      <button
                                        type="button"
                                        onClick={() => activateSemester.mutate(semester)}
                                        disabled={activateSemester.isPending}
                                        className="rounded-lg border border-emerald-200 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                      >
                                        Aktifkan Semester
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 px-4 py-4 md:hidden">
                {years.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{row.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(row.start_date)} - {formatDate(row.end_date)}
                        </p>
                      </div>
                      <span
                        className={
                          row.is_active
                            ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800"
                            : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
                        }
                      >
                        {row.is_active ? "aktif" : row.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Dibuat {formatDate(row.created_at)}</p>
                      {row.is_active ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Sedang aktif
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activateYear.mutate(row)}
                          disabled={activateYear.isPending}
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Jadikan Aktif
                        </button>
                      )}
                    </div>

                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      {(semestersByYear[row.id] || []).map((semester) => {
                        const dates = semesterDates[semester.id] || {
                          start_date: semester.start_date || "",
                          end_date: semester.end_date || "",
                        };
                        return (
                          <div key={semester.id} className="rounded-xl bg-muted/30 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold">
                                Semester {semester.semester_number} - {semester.name}
                              </p>
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {semester.is_active ? "aktif" : "arsip"}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={dates.start_date}
                                onChange={(event) =>
                                  setSemesterDates((prev) => ({
                                    ...prev,
                                    [semester.id]: { ...dates, start_date: event.target.value },
                                  }))
                                }
                                className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                              />
                              <input
                                type="date"
                                value={dates.end_date}
                                onChange={(event) =>
                                  setSemesterDates((prev) => ({
                                    ...prev,
                                    [semester.id]: { ...dates, end_date: event.target.value },
                                  }))
                                }
                                className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveSemesterDates.mutate(semester)}
                                disabled={saveSemesterDates.isPending}
                                className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold"
                              >
                                Simpan Tanggal
                              </button>
                              {!semester.is_active && (
                                <button
                                  type="button"
                                  onClick={() => activateSemester.mutate(semester)}
                                  disabled={activateSemester.isPending}
                                  className="rounded-lg border border-emerald-200 px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
                                >
                                  Aktifkan
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
