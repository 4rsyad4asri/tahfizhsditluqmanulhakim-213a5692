import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { useVerificationDocument } from "@/hooks/useStudentDetail";
import TahfizhVerification from "@/pages/TahfizhVerification";

const SUPPORTED_TYPES = [
  "rapor-tahsin",
  "rapor-tahsin-lanjutan",
  "tahfizh-reguler",
  "sertifikat-tahfizh",
] as const;

type VerificationType = (typeof SUPPORTED_TYPES)[number];

function isVerificationType(type?: string): type is VerificationType {
  return SUPPORTED_TYPES.includes(type as VerificationType);
}

function BasicVerificationPage({
  token,
  title,
}: {
  token?: string;
  title: string;
}) {
  const { data, isLoading, error } = useVerificationDocument(token);

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
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-700" />
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Verifikasi Gagal</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Dokumen Tidak Ditemukan</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Dokumen tidak ditemukan atau belum dipublish.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase text-white">
          <CheckCircle2 className="h-4 w-4" />
          Dokumen Valid
        </div>
        <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Dokumen berstatus Published dan token verifikasi ditemukan pada database resmi.
        </p>
      </section>
    </main>
  );
}

export default function VerificationCenter() {
  const { type, token } = useParams<{ type: string; token: string }>();
  const verification = useVerificationDocument(token);

  if (!isVerificationType(type)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-amber-300 bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-700" />
          <h1 className="text-2xl font-bold text-foreground">Jenis Verifikasi Tidak Didukung</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Periksa kembali alamat QR atau jenis dokumen yang digunakan.
          </p>
        </div>
      </main>
    );
  }

  if (type === "rapor-tahsin") {
    return <BasicVerificationPage token={token} title="Rapor Tahsin Dasar Terverifikasi" />;
  }

  if (type === "rapor-tahsin-lanjutan") {
    return <BasicVerificationPage token={token} title="Rapor Tahsin Lanjutan Terverifikasi" />;
  }

  const aspek =
    verification.data?.nilai_aspek && typeof verification.data.nilai_aspek === "object"
      ? (verification.data.nilai_aspek as Record<string, unknown>)
      : {};
  const isCertificateLegacy = aspek.tahfizhMode === "Sertifikat";

  if (type === "tahfizh-reguler" && token && isCertificateLegacy) {
    return <Navigate to={`/verifikasi/sertifikat-tahfizh/${encodeURIComponent(token)}`} replace />;
  }

  if (type === "sertifikat-tahfizh") {
    return (
      <TahfizhVerification
        token={token}
        title="Verifikasi Sertifikat Tahfizh"
        description="Portal verifikasi resmi SDIT Luqmanul Hakim untuk memastikan sertifikat Tahfizh yang sudah dipublish."
      />
    );
  }

  return <TahfizhVerification token={token} />;
}
