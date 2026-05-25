import { useParams } from "react-router-dom";
import { CheckCircle2, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useTahfizhVerification } from "@/hooks/useStudentDetail";
import {
  calculateTahfizhSummary,
  normalizeTahfizhAssessment,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { calculateNilaiSurahWithRumus } from "@/data/mockData";

function formatDate(date: string) {
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

export default function TahfizhVerification() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useTahfizhVerification(token);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <FileText className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-xl font-bold text-foreground">Dokumen Tidak Ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Token verifikasi tidak valid atau dokumen belum dipublish.
          </p>
        </div>
      </main>
    );
  }

  const aspek = (data.nilai_aspek || {}) as any;
  const entries: TahfizhSurahAssessment[] = Array.isArray(aspek.surahEntries)
    ? aspek.surahEntries.map(normalizeTahfizhAssessment)
    : [];
  const reportType = aspek.reportType || (aspek.tahfizhMode === "Sertifikat" ? "summary" : "detail");
  const summaries = calculateTahfizhSummary(entries, aspek.config);
  const student = (data as any).students;
  const classInfo = student?.classes;

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">SDIT Luqmanul Hakim</p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">Verifikasi Dokumen Tahfizh</h1>
              <p className="mt-1 text-sm text-muted-foreground">Program Tahfizh & Tahsin Al-Qur'an</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
              DOKUMEN ASLI & TERVERIFIKASI
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard label="Nama Siswa" value={student?.name || "-"} />
          <InfoCard label="Kelas" value={classInfo?.name || "-"} />
          <InfoCard label="Tanggal Ujian" value={formatDate(data.tanggal)} />
          <InfoCard label="Mode" value={aspek.tahfizhMode || "Tahfizh"} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard label="Nilai Akhir" value={String(data.nilai_akhir ?? 0)} strong />
          <InfoCard label="Grade" value={data.grade || "-"} strong />
          <InfoCard label="Status" value={aspek.statusLabel || data.status || "-"} strong />
          <InfoCard label="Dokumen" value={data.document_status || "Published"} strong />
        </div>

        {reportType === "summary" ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Ringkasan Akumulasi Per Juz
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Juz</th>
                    <th className="px-3 py-2">Total Lahn Jali</th>
                    <th className="px-3 py-2">Total Lahn Khofi</th>
                    <th className="px-3 py-2">Total Waqaf</th>
                    <th className="px-3 py-2">Total Sambung</th>
                    <th className="px-3 py-2">Rata Kelancaran</th>
                    <th className="px-3 py-2">Nilai Juz</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.juz} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">Juz {summary.juz}</td>
                      <td className="px-3 py-2">{summary.totalLahnJali}</td>
                      <td className="px-3 py-2">{summary.totalLahnKhofi}</td>
                      <td className="px-3 py-2">{summary.totalWaqaf}</td>
                      <td className="px-3 py-2">{summary.totalSalahSambung}</td>
                      <td className="px-3 py-2">{summary.rataKelancaran}</td>
                      <td className="px-3 py-2 font-bold text-primary">{summary.nilaiJuz}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Detail Soal Ujian
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Surat</th>
                    <th className="px-3 py-2">Juz</th>
                    <th className="px-3 py-2">Ayat</th>
                    <th className="px-3 py-2">LJ</th>
                    <th className="px-3 py-2">LK</th>
                    <th className="px-3 py-2">Waqaf</th>
                    <th className="px-3 py-2">Sambung</th>
                    <th className="px-3 py-2">Catatan</th>
                    <th className="px-3 py-2">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={`${entry.surah}-${index}`} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{entry.surah}</td>
                      <td className="px-3 py-2">{entry.juz}</td>
                      <td className="px-3 py-2">{entry.ayatRange || [entry.ayatAwal, entry.ayatAkhir].filter(Boolean).join("-") || "-"}</td>
                      <td className="px-3 py-2">{entry.lahnJali}</td>
                      <td className="px-3 py-2">{entry.lahnKhofi}</td>
                      <td className="px-3 py-2">{entry.waqaf}</td>
                      <td className="px-3 py-2">{entry.salahSambung}</td>
                      <td className="px-3 py-2">{entry.catatan || "-"}</td>
                      <td className="px-3 py-2 font-bold text-primary">{calculateNilaiSurahWithRumus({
                        surah: entry.surah,
                        juz: entry.juz,
                        lahn_jali: entry.lahnJali,
                        lahn_khofi: entry.lahnKhofi,
                        kelancaran: entry.kelancaran,
                        waqaf_ibtida: entry.waqaf,
                        salah_sambung_ayat: entry.salahSambung,
                      }, "baru")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(aspek.autoFailLog || aspek.manualStopReason || aspek.catatanGuru) && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-base font-semibold text-foreground">Catatan</h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              {aspek.autoFailLog && <p>{aspek.autoFailLog}</p>}
              {aspek.manualStopReason && <p>Alasan dihentikan: {aspek.manualStopReason}</p>}
              {aspek.catatanGuru && <p>{aspek.catatanGuru}</p>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function InfoCard({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={strong ? "mt-1 text-xl font-bold text-foreground" : "mt-1 text-sm font-semibold text-foreground"}>{value}</p>
    </div>
  );
}
