import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const TAHSiN_URL = "https://tahsinsdit.lovable.app";

const quickAccess = [
  { icon: BookOpen, title: "Ujian Tahsin", description: "Kelola ujian Tahsin dasar dan lanjutan secara terstruktur." },
  { icon: Award, title: "Ujian Tahfizh", description: "Kelola hafalan, juz, surat, rentang ayat, dan hasil ujian." },
  { icon: FileDown, title: "Rapor & Sertifikat", description: "Siapkan rapor dan sertifikat PDF dengan identitas resmi sekolah." },
  { icon: BarChart3, title: "Rekap Nilai", description: "Pantau hasil ujian, kelulusan, dan capaian lintas kelas." },
];

const features = [
  { icon: ClipboardCheck, title: "Input ujian terarah", description: "Form penilaian mengikuti mode ujian dan kebutuhan penguji." },
  { icon: Award, title: "Sertifikat Tahfizh", description: "Kelola penerbitan, revisi, nomor dokumen, dan arsip sertifikat." },
  { icon: FileDown, title: "Rapor siap cetak", description: "Preview dan ekspor rapor PDF dengan format sekolah yang konsisten." },
  { icon: QrCode, title: "Verifikasi dokumen", description: "QR publik membantu memeriksa keaslian sertifikat dan dokumen." },
  { icon: Users, title: "Data kelas terhubung", description: "Siswa, kelas, penguji, ujian, dan riwayat tersusun dalam satu sistem." },
  { icon: ShieldCheck, title: "Akses sesuai peran", description: "Admin, guru, penguji, dan orang tua memperoleh akses yang sesuai." },
];

const workflow = [
  "Pilih kelas dan siswa",
  "Tentukan mode ujian",
  "Input bacaan dan penilaian",
  "Simpan catatan penguji",
  "Tinjau rekap hasil",
  "Terbitkan rapor atau sertifikat",
];

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#0B1F3A] antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071f1a]/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
          <a href="#beranda" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 ring-1 ring-[#E6CB87]/50">
              <BookOpen className="h-5 w-5 text-[#E6CB87]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold sm:text-base">SDIT Luqmanul Hakim</p>
              <p className="truncate text-[10px] text-[#E6CB87] sm:text-xs">Sistem Ujian Tahsin & Tahfizh</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {[
              ["#beranda", "Beranda"],
              ["#fitur", "Fitur"],
              ["#alur", "Alur Kerja"],
              ["#sistem-terkait", "Sistem Terkait"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden items-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24C] to-[#E6CB87] px-5 py-2.5 text-sm font-bold text-[#0B1F3A] shadow-lg sm:inline-flex"
            >
              Masuk Sistem <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
              aria-label="Buka menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#071f1a] px-4 py-3 lg:hidden">
            {[
              ["#beranda", "Beranda"],
              ["#fitur", "Fitur"],
              ["#alur", "Alur Kerja"],
              ["#sistem-terkait", "Sistem Terkait"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10">
                {label}
              </a>
            ))}
            <Link to="/login" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#E6CB87] px-4 py-2.5 text-sm font-bold text-[#0B1F3A] sm:hidden">
              Masuk Sistem <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      <main>
        <section id="beranda" className="relative overflow-hidden bg-gradient-to-br from-[#07172E] via-[#0E3D3A] to-[#08715f] pb-20 pt-28 text-white sm:pt-36 lg:pb-28">
          <div className="absolute -right-32 -top-24 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#C9A24C]/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#E6CB87]" />
                <span className="text-xs font-semibold text-[#E6CB87]">Sistem Digital Ujian dan Dokumen Al-Qur'an</span>
              </div>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                Ujian Tahsin & Tahfizh
                <span className="block bg-gradient-to-r from-[#E6CB87] to-[#C9A24C] bg-clip-text text-transparent">
                  SDIT Luqmanul Hakim
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                Satu sistem untuk ujian Tahsin, ujian Tahfizh, rapor, sertifikat, rekap nilai,
                serta verifikasi dokumen resmi sekolah.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24C] to-[#E6CB87] px-6 py-3 text-sm font-bold text-[#0B1F3A] shadow-xl">
                  Masuk ke Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#fitur" className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/15">
                  Lihat Fitur
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-white/30 bg-white/95 p-5 text-[#0B1F3A] shadow-2xl sm:p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Ringkasan Sistem</p>
                <h2 className="mt-1 text-xl font-extrabold">Dokumen dan hasil ujian terintegrasi</h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    [BookOpen, "Ujian Tahsin"],
                    [Award, "Ujian Tahfizh"],
                    [FileDown, "Rapor & Sertifikat"],
                    [QrCode, "QR Verifikasi"],
                  ].map(([Icon, label]) => {
                    const FeatureIcon = Icon as typeof BookOpen;
                    return (
                      <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <FeatureIcon className="h-5 w-5 text-emerald-700" />
                        <p className="mt-3 text-sm font-bold">{label as string}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Akses Utama</p>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Seluruh proses ujian dalam satu tempat</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {quickAccess.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fitur" className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Fitur Sistem</p>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Dari penilaian hingga dokumen resmi</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-lg">
                  <Icon className="h-6 w-6 text-emerald-700" />
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="alur" className="bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Alur Kerja</p>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Enam langkah yang mudah ditelusuri</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workflow.map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0E3D3A] font-bold text-[#E6CB87]">
                    {index + 1}
                  </span>
                  <div>
                    <CheckCircle2 className="mb-1 h-4 w-4 text-emerald-600" />
                    <p className="font-bold">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sistem-terkait" className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-7 shadow-xl sm:p-10">
              <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Sistem Terkait</p>
                  <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Pencatatan Aktivitas Tahsin Harian</h2>
                  <p className="mt-3 max-w-2xl text-slate-600">
                    Buka sistem Tahsin untuk absensi, aktivitas pembelajaran harian, laporan bulanan,
                    monitoring progres, dan penilaian rapor progresif.
                  </p>
                </div>
                <a href={TAHSiN_URL} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3.5 text-sm font-bold text-white">
                  Buka Sistem Tahsin <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#07172E] px-4 py-10 text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-bold text-white">SDIT Luqmanul Hakim</p>
            <p className="text-sm text-[#E6CB87]">Sistem Ujian Tahsin & Tahfizh</p>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} SDIT Luqmanul Hakim</p>
        </div>
      </footer>
    </div>
  );
}
