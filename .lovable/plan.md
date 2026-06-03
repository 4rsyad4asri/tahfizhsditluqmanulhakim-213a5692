# Rencana: Preview & Redesain Sertifikat Tahfizh

## Masalah saat ini
1. `generateCertificatePDF.ts` memakai `window.open(blobUrl, "_blank")` — diblokir oleh Edge/Brave sebagai popup.
2. Desain sertifikat masih sederhana, hanya Bahasa Indonesia + Inggris singkat, tanpa nuansa Arab/internasional.
3. Tata letak TTD Koordinator & Kepala Sekolah keluar dari frame border (kotak signature `signY=195` + tinggi `28mm` menyentuh dekat tepi 210mm A4 landscape — terjepit footer & border).

## 1. Preview Sertifikat Anti-Block

Ganti pola `window.open` dengan **modal preview berisi `<iframe>`** yang menampilkan blob PDF langsung di dalam aplikasi (tidak memicu popup blocker).

- Buat komponen baru `src/components/CertificatePreviewDialog.tsx` memakai `Dialog` dari shadcn:
  - Props: `open`, `onOpenChange`, `data: CertificateData`.
  - Saat `open`, generate PDF -> `doc.output("blob")` -> `URL.createObjectURL` -> set ke `src` iframe (full width, tinggi ~80vh).
  - Tombol di footer: **Download PDF** (memicu `doc.save(...)` / anchor download) dan **Tutup**.
  - `URL.revokeObjectURL` saat dialog ditutup / unmount.
- Refactor `generateCertificatePDF.ts`:
  - Pisah menjadi `buildCertificatePDF(data) -> jsPDF` (pure, dipakai preview & download) dan `downloadCertificatePDF(data)` (panggil `doc.save`).
  - Hapus `window.open` dari alur utama.
- Di `RekapSertifikat.tsx`:
  - Tambah state `previewItem: RekapItem | null`.
  - Tombol baris: **Preview** (icon `Eye`) membuka dialog, **Download** (icon `Download`) langsung simpan PDF.
  - Dialog dapat juga men-trigger download dari dalam.

## 2. Redesain Sertifikat Tahfizh Internasional

Konsep: perpaduan **Arab (kaligrafi sederhana)** + **English (formal)** + **Indonesia (penjelasan)**, palet emerald hijau & emas konsisten dengan brand.

Struktur A4 landscape (297×210mm) dari atas ke bawah, dengan margin aman 18mm:

```
┌───────────────────────────────────────────────────────┐
│  [Border ganda emerald + emas, ornamen sudut]         │
│                                                       │
│  بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ   (Amiri, Arab)             │
│                                                       │
│  CERTIFICATE OF QUR'AN MEMORIZATION                   │
│  SERTIFIKAT TAHFIZH AL-QUR'AN  ·  شَهَادَةُ تَحْفِيظِ ٱلْقُرْآنِ     │
│  ────────────────────────────────────                 │
│  No: 134/SDITLH/STQ/2526/I/2026                       │
│                                                       │
│  This certificate is proudly presented to /           │
│  Dengan bangga diberikan kepada:                      │
│                                                       │
│           «  NAMA SISWA  »                            │
│           Kelas / Class: VI-A                         │
│                                                       │
│  Telah menyelesaikan ujian sertifikasi Tahfizh        │
│  Has successfully completed the Tahfizh examination   │
│  for / untuk Juz 30                                   │
│                                                       │
│  ┌───────────┬────────────┬─────────────┐             │
│  │ Nilai 95  │ Predikat   │ Tanggal     │             │
│  │ Score     │ Mumtaz (A) │ 03 Jun 2026 │             │
│  └───────────┴────────────┴─────────────┘             │
│                                                       │
│  [TTD kiri]            [QR]            [TTD kanan]    │
│   Koordinator Tahfizh                  Kepala Sekolah │
│                                                       │
│  SDIT Luqmanul Hakim · Tahfizh Program                │
└───────────────────────────────────────────────────────┘
```

Detail implementasi `buildCertificatePDF`:

- **Font Arab**: gunakan helper `loadArabicFont` yang sudah ada (`src/utils/loadArabicFont.ts`) untuk mendaftarkan Amiri ke jsPDF; render `بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ`, judul Arab `شَهَادَةُ تَحْفِيظِ ٱلْقُرْآنِ`, dan kata `مُمْتَاز` di samping predikat.
- **Border**: 2 garis (emerald 3pt + emas 1pt) di margin 12mm/16mm + 4 ornamen sudut bulat emas.
- **Header trilingual**: judul EN besar (24pt), baris kedua ID + Arab (12pt) dipisah `·`.
- **Score box**: 3 kolom (Nilai · Predikat · Tanggal), lebar 180mm, tinggi 26mm, terpusat.
- **Layout TTD diperbaiki**:
  - Tarik blok TTD naik ke `signY = 168` (sebelumnya 195) agar tidak menabrak footer/border bawah.
  - Lebar tiap kotak 70mm, tinggi 32mm, jarak dari tepi 28mm.
  - Susun: label di atas (10pt bold), ruang TTD ~14mm, garis tanda tangan, nama (8pt).
  - QR code dipindah ke **tengah bawah antara dua TTD** (24×24mm) dengan label "Scan untuk verifikasi / Scan to verify" agar simetris dan tidak menumpuk footer.
- **Footer**: 1 baris kecil (8pt) di y=200, jauh dari border (border bawah di y=198 → footer di dalam frame).
- **Verifikasi QR**: pakai `buildTahfizhVerificationUrl(verification_token)` jika token tersedia (perlu dilewatkan dari `RekapSertifikat`); fallback ke nomor sertifikat seperti sekarang.

## 3. Perubahan Data yang Dibutuhkan

- Tambah `verification_token` ke `RekapItem` (sudah ada di tabel `ujian`) supaya QR mengarah ke halaman verifikasi nyata.
- Tidak ada perubahan skema DB.

## Daftar File yang Berubah

- `src/utils/generateCertificatePDF.ts` — split jadi `buildCertificatePDF` + `downloadCertificatePDF`, redesain layout, integrasi font Arab, QR verifikasi.
- `src/components/CertificatePreviewDialog.tsx` — komponen baru (modal iframe preview + download).
- `src/pages/RekapSertifikat.tsx` — tambah kolom action Preview, state preview, sertakan `verification_token` di query & item.

## Verifikasi setelah implementasi

1. Buka `/rekap-sertifikat`, klik **Preview** → modal muncul dengan PDF tampil di iframe (tanpa popup blocker di Edge/Brave).
2. Klik **Download PDF** dari modal & dari tombol baris → file terunduh.
3. Periksa PDF: teks Arab tampil benar, TTD koordinator & kepala sekolah serta QR seluruhnya di dalam border, tidak ada elemen yang terpotong.
