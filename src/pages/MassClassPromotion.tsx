import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpWideNarrow, CheckCircle2, GraduationCap, Loader2, RefreshCcw, Search, ShieldAlert, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuthContext } from "@/contexts/AuthContext";
import { getSafeErrorMessage } from "@/utils/errorMessages";

type AcademicYearRow = Tables<"academic_years">;
type ClassRow = Tables<"classes">;
type StudentRow = Pick<Tables<"students">, "id" | "name" | "class_id" | "student_status" | "status_siswa">;
type HistoryRow = Pick<Tables<"student_class_history">, "student_id" | "academic_year_from" | "academic_year_to">;

type PreviewOutcome = "ready_promote" | "ready_alumni" | "failed" | "already_processed";

type PreviewRow = {
  studentId: string;
  studentName: string;
  oldClassName: string;
  newClassName: string;
  newStatus: "aktif" | "alumni";
  outcome: PreviewOutcome;
  errorNote: string;
  fromClassId: string | null;
  toClassId: string | null;
  sortGrade: number;
  sortSection: string;
};

type ExecutionRow = {
  student_id: string | null;
  result_status: string | null;
  status_after: string | null;
  from_class_id: string | null;
  to_class_id: string | null;
  message: string | null;
};

type Summary = {
  promoted: number;
  alumni: number;
  failed: number;
  alreadyProcessed: number;
};

type PreviewFilter = "all" | PreviewOutcome;

const formatAcademicYearLabel = (year?: AcademicYearRow | null) => year?.name || "Belum dipilih";

const formatClassLabel = (grade: number, section: string) => `Kelas ${grade} ${section}`.trim();

const buildClassName = (item?: ClassRow | null) => {
  if (!item) return "-";
  return item.name?.trim() || formatClassLabel(item.grade, item.section);
};

const buildTargetKey = (grade: number, section: string) => `${grade}-${section.trim().toUpperCase()}`;

const ensureArray = <T,>(value: T[] | unknown): T[] => (Array.isArray(value) ? value : []);

const emptySummary = (): Summary => ({
  promoted: 0,
  alumni: 0,
  failed: 0,
  alreadyProcessed: 0,
});

const summarizePreview = (rows: PreviewRow[]): Summary =>
  rows.reduce(
    (acc, row) => {
      if (row.outcome === "ready_promote") acc.promoted += 1;
      if (row.outcome === "ready_alumni") acc.alumni += 1;
      if (row.outcome === "failed") acc.failed += 1;
      if (row.outcome === "already_processed") acc.alreadyProcessed += 1;
      return acc;
    },
    emptySummary(),
  );

const summarizeExecution = (previewRows: PreviewRow[], resultRows: ExecutionRow[]): Summary => {
  const summary = emptySummary();

  for (const row of previewRows) {
    if (row.outcome === "failed") summary.failed += 1;
    if (row.outcome === "already_processed") summary.alreadyProcessed += 1;
  }

  for (const row of resultRows) {
    if (row.result_status === "promoted") summary.promoted += 1;
    else if (row.result_status === "alumni") summary.alumni += 1;
    else if (row.result_status === "already_processed") summary.alreadyProcessed += 1;
    else summary.failed += 1;
  }

  return summary;
};

const PreviewBadge = ({ outcome }: { outcome: PreviewOutcome }) => {
  const config =
    outcome === "ready_promote"
      ? { label: "Siap Naik Kelas", className: "bg-emerald-100 text-emerald-800" }
      : outcome === "ready_alumni"
        ? { label: "Siap Jadi Alumni", className: "bg-blue-100 text-blue-800" }
        : outcome === "already_processed"
          ? { label: "Sudah Diproses", className: "bg-amber-100 text-amber-800" }
          : { label: "Gagal", className: "bg-rose-100 text-rose-800" };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>{config.label}</span>;
};

export default function MassClassPromotion() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();
  const [fromYearId, setFromYearId] = useState("");
  const [toYearId, setToYearId] = useState("");
  const [previewRequested, setPreviewRequested] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<Summary | null>(null);
  const [activeFilter, setActiveFilter] = useState<PreviewFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: academicYears, isLoading: yearsLoading, error: yearsError } = useQuery({
    queryKey: ["mass-class-promotion-academic-years"],
    queryFn: async (): Promise<AcademicYearRow[]> => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ensureArray<AcademicYearRow>(data);
    },
    enabled: isAdmin,
  });

  const { data: classes, isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ["mass-class-promotion-classes"],
    queryFn: async (): Promise<ClassRow[]> => {
      const { data, error } = await supabase.from("classes").select("*").order("grade").order("section");
      if (error) throw error;
      return ensureArray<ClassRow>(data);
    },
    enabled: isAdmin,
  });

  const { data: students, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ["mass-class-promotion-students"],
    queryFn: async (): Promise<StudentRow[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, class_id, student_status, status_siswa")
        .eq("student_status", "aktif")
        .order("name");

      if (error) throw error;
      return ensureArray<StudentRow>(data);
    },
    enabled: isAdmin,
  });

  const { data: processedHistory, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ["mass-class-promotion-history", fromYearId, toYearId],
    queryFn: async (): Promise<HistoryRow[]> => {
      if (!fromYearId || !toYearId) return [];

      const { data, error } = await supabase
        .from("student_class_history")
        .select("student_id, academic_year_from, academic_year_to")
        .eq("academic_year_from", fromYearId)
        .eq("academic_year_to", toYearId);

      if (error) throw error;
      return ensureArray<HistoryRow>(data);
    },
    enabled: isAdmin && Boolean(fromYearId) && Boolean(toYearId),
  });

  useEffect(() => {
    setPreviewRequested(false);
    setExecutionSummary(null);
    setActiveFilter("all");
    setClassFilter("all");
    setSearchTerm("");
  }, [fromYearId, toYearId]);

  useEffect(() => {
    const yearRows = ensureArray<AcademicYearRow>(academicYears);
    if (!yearRows.length) return;
    const activeYear = yearRows.find((item) => item.is_active);
    if (!activeYear) return;

    setFromYearId((current) => current || activeYear.id);
  }, [academicYears]);

  const yearRows = useMemo(() => ensureArray<AcademicYearRow>(academicYears), [academicYears]);
  const classRows = useMemo(() => ensureArray<ClassRow>(classes), [classes]);
  const studentRows = useMemo(() => ensureArray<StudentRow>(students), [students]);
  const historyRows = useMemo(() => ensureArray<HistoryRow>(processedHistory), [processedHistory]);

  const yearsById = useMemo(() => new Map(yearRows.map((item) => [item.id, item])), [yearRows]);
  const classesById = useMemo(() => new Map(classRows.map((item) => [item.id, item])), [classRows]);

  const targetClassByKey = useMemo(() => {
    const map = new Map<string, ClassRow>();
    for (const item of classRows) {
      map.set(buildTargetKey(item.grade, item.section), item);
    }
    return map;
  }, [classRows]);

  const processedKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const item of historyRows) {
      set.add(`${item.student_id}-${item.academic_year_from}-${item.academic_year_to}`);
    }
    return set;
  }, [historyRows]);

  const selectedFromYear = fromYearId ? yearsById.get(fromYearId) || null : null;
  const selectedToYear = toYearId ? yearsById.get(toYearId) || null : null;

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!studentRows.length || !fromYearId || !toYearId || fromYearId === toYearId) return [];

    return studentRows
      .map((student) => {
      const duplicateKey = `${student.id}-${fromYearId}-${toYearId}`;
      const classRow = student.class_id ? classesById.get(student.class_id) || null : null;
      const defaultRow: PreviewRow = {
        studentId: student.id,
        studentName: student.name,
        oldClassName: classRow ? buildClassName(classRow) : "-",
        newClassName: "-",
        newStatus: "aktif",
        outcome: "failed",
        errorNote: "",
        fromClassId: student.class_id || null,
        toClassId: null,
        sortGrade: classRow?.grade ?? -1,
        sortSection: classRow?.section?.trim().toUpperCase() ?? "",
      };

      if (processedKeySet.has(duplicateKey)) {
        return {
          ...defaultRow,
          outcome: "already_processed",
          errorNote: "Sudah diproses pada kombinasi tahun ajaran ini.",
        };
      }

      if (!student.class_id) {
        return {
          ...defaultRow,
          errorNote: "Siswa tidak memiliki class_id.",
        };
      }

      if (!classRow) {
        return {
          ...defaultRow,
          oldClassName: "Kelas lama tidak ditemukan",
          errorNote: "Kelas lama tidak ditemukan.",
        };
      }

      if (classRow.grade === 6) {
        return {
          ...defaultRow,
          newClassName: "Alumni",
          newStatus: "alumni",
          outcome: "ready_alumni",
          errorNote: "",
          fromClassId: classRow.id,
        };
      }

      const targetClass = targetClassByKey.get(buildTargetKey(classRow.grade + 1, classRow.section));
      if (!targetClass) {
        return {
          ...defaultRow,
          errorNote: `Kelas tujuan grade ${classRow.grade + 1} section ${classRow.section} tidak ditemukan.`,
          fromClassId: classRow.id,
        };
      }

      return {
        ...defaultRow,
        oldClassName: buildClassName(classRow),
        newClassName: buildClassName(targetClass),
        newStatus: "aktif",
        outcome: "ready_promote",
        errorNote: "",
        fromClassId: classRow.id,
        toClassId: targetClass.id,
      };
      })
      .sort((a, b) => {
        if (a.sortGrade !== b.sortGrade) return b.sortGrade - a.sortGrade;

        const sectionComparison = a.sortSection.localeCompare(b.sortSection, "id", { sensitivity: "base" });
        if (sectionComparison !== 0) return sectionComparison;

        return a.studentName.localeCompare(b.studentName, "id", { sensitivity: "base" });
      });
  }, [classesById, fromYearId, processedKeySet, studentRows, targetClassByKey, toYearId]);

  const previewSummary = useMemo(() => summarizePreview(previewRows), [previewRows]);
  const classFilterOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; sortGrade: number; sortSection: string }>();

    for (const row of previewRows) {
      if (!row.fromClassId || map.has(row.fromClassId)) continue;
      map.set(row.fromClassId, {
        value: row.fromClassId,
        label: row.oldClassName,
        sortGrade: row.sortGrade,
        sortSection: row.sortSection,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.sortGrade !== b.sortGrade) return b.sortGrade - a.sortGrade;
      return a.sortSection.localeCompare(b.sortSection, "id", { sensitivity: "base" });
    });
  }, [previewRows]);
  const filteredPreviewRows = useMemo(
    () =>
      previewRows.filter((row) => {
        if (activeFilter !== "all" && row.outcome !== activeFilter) return false;
        if (classFilter !== "all" && row.fromClassId !== classFilter) return false;
        if (searchTerm.trim() && !row.studentName.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
        return true;
      }),
    [activeFilter, classFilter, previewRows, searchTerm],
  );
  const readyRows = useMemo(
    () => previewRows.filter((row) => row.outcome === "ready_promote" || row.outcome === "ready_alumni"),
    [previewRows],
  );

  const executeMutation = useMutation({
    mutationFn: async (): Promise<ExecutionRow[]> => {
      if (!previewRequested) {
        throw new Error("Preview wajib ditampilkan sebelum eksekusi.");
      }
      if (!fromYearId || !toYearId) {
        throw new Error("Pilih tahun ajaran asal dan tujuan terlebih dahulu.");
      }
      if (fromYearId === toYearId) {
        throw new Error("Tahun ajaran asal dan tujuan tidak boleh sama.");
      }
      if (readyRows.length === 0) {
        throw new Error("Tidak ada siswa yang siap diproses.");
      }

      const note = `Naik kelas massal ${formatAcademicYearLabel(selectedFromYear)} -> ${formatAcademicYearLabel(selectedToYear)}`;
      const { data, error } = await supabase.rpc("process_mass_class_promotion", {
        _academic_year_from: fromYearId,
        _academic_year_to: toYearId,
        _student_ids: readyRows.map((row) => row.studentId),
        _note: note,
      });

      if (error) throw error;
      return (data || []) as ExecutionRow[];
    },
    onSuccess: async (resultRows) => {
      const summary = summarizeExecution(previewRows, resultRows);
      setExecutionSummary(summary);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mass-class-promotion-students"] }),
        queryClient.invalidateQueries({ queryKey: ["all-students"] }),
        queryClient.invalidateQueries({ queryKey: ["classes"] }),
        refetchHistory(),
      ]);
      toast.success("Proses naik kelas massal selesai.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : getSafeErrorMessage(error));
    },
  });

  const isLoading = yearsLoading || classesLoading || studentsLoading || historyLoading;
  const pageError = yearsError || classesError || studentsError || historyError;
  const filterCards = [
    {
      key: "all" as const,
      label: "Semua Siswa",
      count: previewRows.length,
      icon: Users,
      activeClassName: "border-primary bg-primary/5 text-primary",
    },
    {
      key: "ready_promote" as const,
      label: "Siap Naik Kelas",
      count: previewSummary.promoted,
      icon: ArrowUpWideNarrow,
      activeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      key: "ready_alumni" as const,
      label: "Siap Jadi Alumni",
      count: previewSummary.alumni,
      icon: GraduationCap,
      activeClassName: "border-blue-200 bg-blue-50 text-blue-900",
    },
    {
      key: "failed" as const,
      label: "Gagal",
      count: previewSummary.failed,
      icon: XCircle,
      activeClassName: "border-rose-200 bg-rose-50 text-rose-900",
    },
    {
      key: "already_processed" as const,
      label: "Sudah Diproses",
      count: previewSummary.alreadyProcessed,
      icon: RefreshCcw,
      activeClassName: "border-amber-200 bg-amber-50 text-amber-900",
    },
  ];

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
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <ArrowUpWideNarrow className="h-6 w-6 text-primary" />
              Naik Kelas Massal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin dapat menyiapkan preview kenaikan kelas berdasarkan grade dan section tanpa mengubah data ujian, rapor,
              sertifikat, atau rekap lama.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <span className="font-semibold">Diproses:</span> hanya siswa dengan <code>student_status = aktif</code>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Pilih Tahun Ajaran</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tahun Ajaran Asal</label>
              <select
                value={fromYearId}
                onChange={(event) => setFromYearId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Pilih tahun ajaran asal</option>
                {yearRows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.is_active ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tahun Ajaran Tujuan</label>
              <select
                value={toYearId}
                onChange={(event) => setToYearId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Pilih tahun ajaran tujuan</option>
                {yearRows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.is_active ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Ringkasan Pilihan</p>
              <p className="mt-2 text-foreground">
                {formatAcademicYearLabel(selectedFromYear)} <span className="text-muted-foreground">ke</span>{" "}
                {formatAcademicYearLabel(selectedToYear)}
              </p>
            </div>

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setExecutionSummary(null);
                  setPreviewRequested(true);
                }}
                disabled={!fromYearId || !toYearId || fromYearId === toYearId || isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Tampilkan Preview
              </button>
            </div>
          </div>

          {fromYearId && toYearId && fromYearId === toYearId ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tahun ajaran asal dan tujuan tidak boleh sama.
            </div>
          ) : null}
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-border bg-card py-16 shadow-card">
            <div className="flex justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          </section>
        ) : pageError ? (
          <section className="rounded-2xl border border-border bg-card px-5 py-10 shadow-card">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-foreground">Gagal memuat data naik kelas massal.</p>
                <p className="mt-1">
                  Pastikan migration untuk <code>student_status</code> dan <code>student_class_history</code> sudah dijalankan di
                  Supabase.
                </p>
              </div>
            </div>
          </section>
        ) : previewRequested ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {filterCards.map((card) => {
                const Icon = card.icon;
                const isActive = activeFilter === card.key;

                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setActiveFilter(card.key)}
                    className={`rounded-2xl border bg-card p-4 text-left shadow-card transition-colors hover:border-primary/40 hover:bg-primary/5 ${
                      isActive ? card.activeClassName : "border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-medium ${isActive ? "text-current/80" : "text-muted-foreground"}`}>{card.label}</p>
                        <p className="mt-2 text-2xl font-bold">{card.count}</p>
                      </div>
                      <Icon className="h-5 w-5 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="rounded-2xl border border-border bg-card shadow-card">
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Preview Naik Kelas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Preview ini tidak mengubah database. Hanya baris yang berstatus siap yang akan diproses setelah konfirmasi.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="min-w-64">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Cari Nama Siswa</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Ketik nama siswa..."
                          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="min-w-56">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Filter Kelas</label>
                      <select
                        value={classFilter}
                        onChange={(event) => setClassFilter(event.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="all">Semua kelas</option>
                        {classFilterOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => executeMutation.mutate()}
                      disabled={executeMutation.isPending || readyRows.length === 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold gradient-islamic text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {executeMutation.isPending ? "Memproses..." : "Konfirmasi dan Proses"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Menampilkan {filteredPreviewRows.length} dari {previewRows.length} siswa.
                  </p>
                </div>
              </div>

              {!filteredPreviewRows.length ? (
                <div className="px-5 py-12 text-center text-muted-foreground">Tidak ada data preview yang bisa ditampilkan.</div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-left">
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Nama Siswa</th>
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Kelas Lama</th>
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Kelas Baru</th>
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Status Baru</th>
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Hasil Preview</th>
                          <th className="px-5 py-3 font-semibold text-muted-foreground">Catatan Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewRows.map((row) => (
                          <tr key={row.studentId} className="border-t border-border/70 align-top">
                            <td className="px-5 py-4 font-medium text-foreground">{row.studentName}</td>
                            <td className="px-5 py-4 text-muted-foreground">{row.oldClassName}</td>
                            <td className="px-5 py-4 text-muted-foreground">{row.newClassName}</td>
                            <td className="px-5 py-4 text-muted-foreground">{row.newStatus}</td>
                            <td className="px-5 py-4">
                              <PreviewBadge outcome={row.outcome} />
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{row.errorNote || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 px-4 py-4 md:hidden">
                    {filteredPreviewRows.map((row) => (
                      <div key={row.studentId} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.studentName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.oldClassName} ke {row.newClassName}
                            </p>
                          </div>
                          <PreviewBadge outcome={row.outcome} />
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Status baru: <span className="text-foreground">{row.newStatus}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">Catatan: {row.errorNote || "-"}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            {executionSummary ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-foreground">Ringkasan Hasil</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Jumlah Naik Kelas</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{executionSummary.promoted}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Jumlah Alumni</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{executionSummary.alumni}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Jumlah Gagal</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{executionSummary.failed}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Sudah Pernah Diproses</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{executionSummary.alreadyProcessed}</p>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Pilih tahun ajaran asal dan tujuan, lalu klik <span className="font-semibold text-foreground">Tampilkan Preview</span>.
            </p>
          </section>
        )}

        {previewRequested && readyRows.length === 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5" />
              <p>Tidak ada siswa yang siap diproses. Periksa baris gagal atau yang sudah pernah diproses pada preview.</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
