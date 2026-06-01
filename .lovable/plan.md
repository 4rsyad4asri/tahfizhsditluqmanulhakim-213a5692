
# Preview & Download Raport di Rekap Global

## Tujuan
Pada halaman `/rekap-global`, setiap baris ujian dilengkapi tombol **Preview** dan **Download PDF** raport. Tambahkan juga **Download Massal (ZIP)** untuk seluruh data terfilter. Sumber data tetap mengikuti hasil ujian terakhir tiap siswa (sinkron dengan tabel `ujian`).

## Perubahan

### 1. Query data (`src/pages/RekapGlobal.tsx`)
- Ambil kolom tambahan dari tabel `ujian`: `nilai_aspek`, `verification_token`, `document_status`, `assessed_by` agar bisa langsung dipakai oleh `RaportPreviewDialog` & PDF generator (tanpa fetch ulang).
- Tambah opsi filter **"Hanya ujian terakhir per siswa"** (default ON). Implementasi: setelah data diurut `tanggal desc`, dedupe berdasarkan `student_id` + `mode` — sehingga "Sinkron dengan ujian terakhir" otomatis berlaku.
- Ambil nama penguji (`assessed_by → profiles.full_name`) untuk ditampilkan di raport.

### 2. Aksi per baris
- Kolom **"Aksi"** baru di tabel detail berisi:
  - Tombol **Preview** (ikon Eye) → membuka `RaportPreviewDialog` yang sudah ada, dengan props `ujian`, `studentName`, `className`, `assessorName`.
  - Tombol **Download PDF** (ikon Download) → panggil `downloadRaportPDF(data, header, assets, opts)` langsung tanpa membuka dialog. Memakai header/asset/opts default yang sama dengan dialog (dibaca dari `localStorage` `raport_settings_v3` jika ada, kalau tidak pakai default).

### 3. Bulk Download (ZIP)
- Tambah tombol **Download Massal (ZIP)** di toolbar atas, di samping tombol Export Excel.
- Saat diklik:
  1. Loop seluruh `filtered` rows.
  2. Untuk tiap row, panggil `generateRaportPDF(...)` → ambil blob (`doc.output("blob")`).
  3. Masukkan ke arsip ZIP dengan nama `Raport_<Mode>_<Kelas>_<Nama>.pdf`.
  4. Trigger download `Raport_Global_<tanggal>.zip`.
- Tampilkan progress (`Memproses 12 / 45...`) via toast atau modal kecil agar UI tidak terkesan hang. Disable tombol selama proses.
- Batas aman: jika filtered > 100 row, minta konfirmasi dulu.

### 4. Helper baru `src/utils/raportBuilder.ts`
- Fungsi `buildRaportDataFromUjian(ujian, studentName, className, assessorName)` yang mengonversi row ujian DB → `RaportData` (logika dipindahkan/diduplikasi dari yang sudah ada di `RaportPreviewDialog.tsx`, agar bisa dipakai bersama oleh dialog & bulk export tanpa membuka dialog).
- `RaportPreviewDialog.tsx` di-refactor ringan untuk pakai helper ini (tidak mengubah perilaku visual).

### 5. Dependency
- Tambah `jszip` (lib ringan, aktif maintained) untuk membungkus PDF menjadi ZIP.

## Detail Teknis
- `RaportPreviewDialog` sudah memuat `header/assets/opts` dari `localStorage` key `raport_settings_v3`; bulk export & download cepat akan membaca key yang sama agar konsisten dengan setting terakhir user.
- Verifikasi token / publish status tidak diubah; bulk export tidak melakukan mutasi ke tabel `ujian` (hanya `Preview` interaktif yang menyiapkan token QR seperti perilaku sekarang).
- Tidak ada perubahan skema database — cukup tambahan kolom select pada query.

## Hak Akses
- Tombol Preview & Download per-row: terlihat untuk semua user (sesuai pola read-only publik yang ada).
- Tombol Download Massal: terlihat untuk semua user yang dapat mengakses halaman (admin & guru/penguji).

## Files
- `src/pages/RekapGlobal.tsx` (utama)
- `src/components/RaportPreviewDialog.tsx` (refactor kecil)
- `src/utils/raportBuilder.ts` (baru)
- `package.json` (`jszip`)
