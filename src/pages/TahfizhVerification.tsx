import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useVerificationDocument } from "@/hooks/useStudentDetail";
import {
  aggregateTahfizhAssessmentsForDisplay,
  calculateTahfizhSummary,
  calculateTahfizhSurahScore,
  normalizeTahfizhAssessment,
  normalizeTahfizhPayload,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { getEffectiveCatatanGuru } from "@/utils/catatanOtomatis";
import { buildReportDocumentNumber } from "@/utils/documentNumber";
import { usesLegacyTahfizhScoring } from "@/utils/verificationUrl";
import { resolveExamClassName } from "@/utils/examSnapshot";

function formatDate(date?: string | null) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date;
  }
}

function maskToken(token?: string) {
  if (!token) return "-";
  if (token.length <= 10) return token;
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

function getFallback(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function isUuidLike(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

interface TahfizhVerificationProps {
  token?: string;
  title?: string;
  description?: string;
}

export default function TahfizhVerification({
  token: tokenProp,
  title = "Verifikasi Dokumen Tahfizh",
  description = "Portal verifikasi resmi SDIT Luqmanul Hakim untuk memastikan raport dan sertifikat Tahfizh yang sudah dipublish.",
}: TahfizhVerificationProps = {}) {
  const { token: routeToken } = useParams<{ token: string }>();
  const token = tokenProp || routeToken;
  const { data, isLoading, error } = useVerificationDocument(token);
  const verifiedAt = useMemo(() => formatDateTime(new Date().toISOString()), []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Memeriksa dokumen...</span>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-amber-300 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Verifikasi Gagal</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Dokumen Tidak Ditemukan</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Dokumen tidak ditemukan atau belum dipublish. Token unik hanya berlaku untuk dokumen yang sudah berstatus Published.
          </p>
        </div>
      </main>
    );
  }

  const aspek = (data.nilai_aspek || {}) as any;
  const rawEntries: TahfizhSurahAssessment[] = Array.isArray(aspek.surahEntries)
    ? aspek.surahEntries.map((entry: unknown) => normalizeTahfizhAssessment(entry))
    : [];
  const surahEntriesSource = Array.isArray(aspek.surahEntries) ? aspek.surahEntries : [];
  const scoringEntries = aggregateTahfizhAssessmentsForDisplay(surahEntriesSource).map((entry) =>
    normalizeTahfizhAssessment(entry)
  );
  const detailEntries = rawEntries.length ? rawEntries : scoringEntries;
  const reportType = aspek.reportType || (aspek.tahfizhMode === "Sertifikat" ? "summary" : "detail");
  const isCertificateVerification = aspek.tahfizhMode === "Sertifikat";
  const showSummaryTable = reportType === "summary";
  const showDetailTable = detailEntries.length > 0 && (reportType === "detail" || isCertificateVerification);
  const summaries = calculateTahfizhSummary(scoringEntries, aspek.config);
  const student = (data as any).students;
  const classInfo = student?.classes;
  const legacyScoring = usesLegacyTahfizhScoring({
    mode: data.mode,
    assessedBy: data.assessed_by,
    tanggal: data.tanggal,
  });
  const normalized = normalizeTahfizhPayload({
    entries: scoringEntries,
    nilaiAspek: aspek,
    tahfizhMode: aspek.tahfizhMode || "Reguler",
    config: aspek.config,
    manualStopReason: legacyScoring ? "" : aspek.manualStopReason || "",
    ignoreAutoFail: legacyScoring,
    autoFailConfig: aspek.autoFailConfig,
  });
  const syncedResult = normalized.result;
  const displayState = legacyScoring
    ? syncedResult
    : {
        predikat: aspek.predikat || syncedResult.predikat,
        grade: data.grade || syncedResult.grade,
        status: aspek.statusLabel || data.status || syncedResult.status,
      };
  const effectiveCatatanGuru = getEffectiveCatatanGuru(data, student?.name || "Siswa");
  const nilaiAkhir = scoringEntries.length > 0 ? normalized.nilaiAkhir : data.nilai_akhir;
  const documentNumber = buildReportDocumentNumber(
    data.mode,
    data.id,
    data.published_at,
    data.tanggal,
  );
  const assessor = (data as any).assessor_name || aspek.assessorName || (isUuidLike(data.assessed_by) ? "-" : data.assessed_by) || "-";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-foreground">
      <section className="border-b border-emerald-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                DOKUMEN ASLI & TERVERIFIKASI
              </div>
              <h1 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>

            <div className="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm sm:min-w-80">
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-800">Status Verifikasi</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valid
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-800">Status Dokumen</span>
                <span className="font-bold text-emerald-950">{getFallback(data.document_status || "Published")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-800">ID Verifikasi</span>
                <span className="font-mono text-xs font-bold text-emerald-950">{maskToken(token)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={FileText} label="Nomor Dokumen" value={documentNumber} />
          <InfoCard icon={CheckCircle2} label="Document Status" value={getFallback(data.document_status || "Published")} strong />
          <InfoCard icon={CalendarDays} label="Tanggal Publish" value={formatDateTime(data.published_at)} />
          <InfoCard icon={ClipboardCheck} label="Diverifikasi pada" value={verifiedAt} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Data Siswa</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DataRow label="Nama Siswa" value={student?.name || "-"} />
              <DataRow label="Kelas" value={resolveExamClassName(data, classInfo) || "-"} />
              <DataRow label="NIS/NISN" value={`${getFallback(student?.nis)} / ${getFallback(student?.nisn)}`} />
              <DataRow label="Tanggal Ujian" value={formatDate(data.tanggal)} />
              <DataRow label="Penguji" value={assessor} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Ringkasan Nilai</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreTile label="Nilai Akhir" value={String(nilaiAkhir)} highlight />
              <ScoreTile label="Grade" value={displayState.grade || "-"} />
              <ScoreTile label="Status" value={displayState.status || "-"} />
              <ScoreTile label="Predikat" value={displayState.predikat || aspek.predikat || "-"} />
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Detail Ujian</h2>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Mode Ujian: {getFallback(aspek.tahfizhMode || data.mode)}</span>
          </div>

          {showSummaryTable && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Juz</th>
                    <th className="px-3 py-3">Total Lahn Jali</th>
                    <th className="px-3 py-3">Total Lahn Khofi</th>
                    <th className="px-3 py-3">Total Waqaf</th>
                    <th className="px-3 py-3">Total Sambung</th>
                    <th className="px-3 py-3">Rata Kelancaran</th>
                    <th className="px-3 py-3">Nilai Juz</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.length ? (
                    summaries.map((summary) => (
                      <tr key={summary.juz} className="border-t border-border">
                        <td className="px-3 py-3 font-semibold">Juz {summary.juz}</td>
                        <td className="px-3 py-3">{summary.totalLahnJali}</td>
                        <td className="px-3 py-3">{summary.totalLahnKhofi}</td>
                        <td className="px-3 py-3">{summary.totalWaqaf}</td>
                        <td className="px-3 py-3">{summary.totalSalahSambung}</td>
                        <td className="px-3 py-3">{summary.rataKelancaran}</td>
                        <td className="px-3 py-3 font-bold text-primary">{summary.nilaiJuz}</td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={7} />
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showDetailTable ? (
            <div className={showSummaryTable ? "mt-5" : ""}>
              {showSummaryTable && (
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Detail Seluruh Surat yang Diinput</h3>
                  <p className="text-xs text-muted-foreground">
                    Seluruh surat dan kesalahan yang diinput pada ujian ini ditampilkan di bawah.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">Surat</th>
                      <th className="px-3 py-3">Juz</th>
                      <th className="px-3 py-3">Ayat</th>
                      <th className="px-3 py-3">LJ</th>
                      <th className="px-3 py-3">LK</th>
                      <th className="px-3 py-3">Waqaf</th>
                      <th className="px-3 py-3">Sambung</th>
                      <th className="px-3 py-3">Catatan</th>
                      <th className="px-3 py-3">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailEntries.map((entry, index) => (
                      <tr key={`${entry.surah || "surah"}-${index}`} className="border-t border-border">
                        <td className="px-3 py-3 font-semibold">{entry.surah || "-"}</td>
                        <td className="px-3 py-3">{entry.juz || "-"}</td>
                        <td className="px-3 py-3">{entry.ayatRange || [entry.ayatAwal, entry.ayatAkhir].filter(Boolean).join("-") || "-"}</td>
                        <td className="px-3 py-3">{entry.lahnJali ?? 0}</td>
                        <td className="px-3 py-3">{entry.lahnKhofi ?? 0}</td>
                        <td className="px-3 py-3">{entry.waqaf ?? 0}</td>
                        <td className="px-3 py-3">{entry.salahSambung ?? 0}</td>
                        <td className="px-3 py-3">{entry.catatan || "-"}</td>
                        <td className="px-3 py-3 font-bold text-primary">
                          {calculateTahfizhSurahScore(entry, aspek.config)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !showSummaryTable ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <tbody>
                  <EmptyTableRow colSpan={9} />
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Catatan Guru dan Evaluasi</h2>
            </div>
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              {aspek.autoFailLog && <p>{aspek.autoFailLog}</p>}
              {aspek.manualStopReason && <p>Alasan dihentikan: {aspek.manualStopReason}</p>}
              {effectiveCatatanGuru ? <p>{effectiveCatatanGuru}</p> : <p>-</p>}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-bold">Keamanan Verifikasi</h2>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-emerald-900">
              <li>Dokumen ini diverifikasi langsung dari database resmi aplikasi.</li>
              <li>Token unik hanya berlaku untuk dokumen yang sudah dipublish.</li>
              <li>Jika data tidak ditemukan, dokumen tidak valid atau belum dipublish.</li>
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  strong = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={strong ? "mt-1 text-lg font-bold text-foreground" : "mt-1 text-sm font-semibold text-foreground"}>{value}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ScoreTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-md bg-primary p-3 text-primary-foreground" : "rounded-md border border-border bg-muted/30 p-3"}>
      <p className={highlight ? "text-xs font-medium uppercase text-primary-foreground/80" : "text-xs font-medium uppercase text-muted-foreground"}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function EmptyTableRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="border-t border-border">
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-muted-foreground">
        Data detail ujian belum tersedia.
      </td>
    </tr>
  );
}
