# Blueprint Pengembangan Modul Form Ujian Tahfizh

## Database

Perubahan utama tetap memakai tabel `ujian` agar kompatibel dengan data lama.

- `ujian.nilai_aspek.tahfizhMode`: `Sertifikat` atau `Reguler`.
- `ujian.nilai_aspek.reportType`: `summary` untuk Sertifikat, `detail` untuk Reguler.
- `ujian.nilai_aspek.surahEntries`: daftar soal/penilaian. Format lama tetap didukung melalui normalisasi.
- `ujian.nilai_aspek.statusLabel`: label bisnis seperti `Ujian Tahfizh Diulangi / Gagal`.
- `ujian.nilai_aspek.autoFailLog`: catatan otomatis saat kesalahan ke-10 terjadi.
- `ujian.nilai_aspek.manualStopReason`: alasan penghentian manual.
- `ujian.document_status`: `Draft` atau `Published`.
- `ujian.verification_token`: UUID unik untuk URL publik.
- `ujian.published_at`: waktu dokumen dikunci.

Migration `20260524090000_tahfizh_modes_verification_lock.sql` menambahkan kolom, index token, policy publik untuk dokumen published, dan trigger lock agar dokumen published tidak diedit/dihapus sembarangan.

## Logika Domain

File utama: `src/data/tahfizhSystem.ts`.

- Mode Sertifikat memakai `JUZ_30_CERTIFICATE_SEQUENCE` berisi 13 baris gabungan Juz 30.
- Mode Reguler memuat semua surat dari `quranData.ts` untuk juz yang dipilih, namun penguji tetap bisa mengetik surat/ayat custom.
- Nilai per juz dihitung dari rata-rata kelancaran dikurangi akumulasi penalti.
- Summary Sertifikat menampilkan total `Lahn Jali`, `Lahn Khofi`, `Waqaf`, `Salah Sambung`, dan rata-rata kelancaran.
- Auto-gagal terjadi jika `Lahn Jali + Salah Sambung Ayat >= 10`, dengan log posisi soal.
- Manual stop menghasilkan status bisnis `Ujian Tahfizh Diulangi / Gagal`.

## Frontend

Komponen utama: `src/components/UjianTahfizhForm.tsx`.

- Tombol di halaman siswa dipisah menjadi `Tahfizh Sertifikat` dan `Tahfizh Reguler`.
- Sertifikat: baris muncul satu per satu lewat tombol tambah, dengan progress bar.
- Reguler: semua soal satu juz langsung tampil, bisa diedit manual, dan punya catatan per baris.
- Form menyediakan `Simpan Draft` dan `Publish & Kunci`.
- Daftar ujian menampilkan status dokumen dan menonaktifkan edit/hapus saat published.

## Rapor dan E-Verifikasi

- `src/utils/raportPdf.ts` menampilkan summary untuk Sertifikat dan detail untuk Reguler.
- QR Code memakai `verification_token` dan mengarah ke `/verifikasi/tahfizh/:token`.
- `src/pages/TahfizhVerification.tsx` adalah halaman publik tanpa login, read-only, dan hanya membaca dokumen `Published`.

## Catatan Integrasi

Catatan otomatis lama tetap dipakai. Jika `catatanGuru` kosong, generator lama di `catatanOtomatis.ts` tetap menjadi fallback pada rapor/PDF.
