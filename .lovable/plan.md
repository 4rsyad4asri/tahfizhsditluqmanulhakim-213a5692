# Rencana: Penyesuaian Sertifikat Tahfizh

## 1. Format Nama Kelas → Angka Romawi
Di `src/utils/generateCertificatePDF.ts`, tambahkan helper `formatClassName(raw: string)` yang:
- Menghapus kata "Kelas" (case-insensitive) dari awal string.
- Mendeteksi angka pertama (1–6) dan mengubahnya jadi Romawi (`I, II, III, IV, V, VI`).
- Mempertahankan huruf rombel di belakang (A/B/C/D...), dipisah satu spasi.
- Contoh: `"Kelas 6D"` → `"VI D"`, `"6A"` → `"VI A"`, `"Kelas 3"` → `"III"`.

Dipakai saat render baris kelas:
`Class / Kelas: ${formatClassName(data.className)}`.

## 2. Tiga Kartu Metrik Berwarna (Final Score · Grade · Date)
Saat ini hanya 2 kartu (Final Score di x=78, Grade di x=219). Ubah jadi 3 kartu sejajar di tengah halaman A4 landscape (lebar 297 mm):

```text
[ Final Score ]      [ Grade / Predikat ]      [ Date / Tanggal ]
   x ≈ 70mm                x ≈ 148.5mm                x ≈ 227mm
```

- Lebar kartu tetap 58 mm, tinggi 26 mm, posisi Y tetap (122 mm).
- `drawMetricCard` diperluas menerima parameter `variant: "green" | "gold" | "purple"` yang menentukan:
  - Warna stroke bingkai
  - Warna pita header tipis (opsional fill 0.4 mm di atas kartu)
  - Warna teks nilai utama

Palette (selaras tema Islami emerald-emas yang sudah ada):
- **Green (Final Score)**: stroke `#1F7A4D` (hijau emerald), value `#0F5132`.
- **Gold (Grade)**: stroke `#B2841C` (gold, tetap), value `#7A5A0F`.
- **Purple (Date)**: stroke `#5B2A86` (royal purple), value `#3D1F66`.

Label tetap dua baris: EN uppercase kecil di atas, ID italic di bawah. Untuk kartu Date, nilai memakai `safeDate(data.tanggal)` (Indonesia) — caption EN `safeDateEN` ditiadakan dari footer agar tidak duplikasi (footer hanya menyisakan baris tanda tangan / dihapus baris "Issued on …").

## 3. Ornamen Template: Bingkai Tegas (Bukan Awan Blur)
Render ulang `public/certificate-template-tahfizh.png` (1792×1280, A4 landscape) memakai `imagegen--generate_image` quality **premium** dengan arahan:

- **Hapus** semua wash cat air / awan blur di empat sudut.
- **Ganti dengan bingkai berlapis yang tegas**:
  - Outer border: garis emas tebal (≈8 px) mengelilingi seluruh tepi, jarak 40 px dari sisi.
  - Inner border: garis emas tipis (≈2 px) 18 px di dalamnya — klasik double frame.
  - Empat sudut: ornamen arabesque/geometris Islami simetris di dalam bingkai (bukan watercolor), garis emas tajam dengan isian tipis warna emerald `#0d6e6a`.
  - Tepi tengah atas: rosette emas kecil (tetap, seperti versi sekarang).
  - Tepi tengah bawah: pita navy `#072346` ramping dengan 5 bintang segi-8 emas (tetap, dirapikan).
  - Latar pusat ivory `#fbf8f1` polos — tidak ada watermark blur besar; boleh watermark geometric pattern sangat halus (opacity ≤ 6%) di tengah.
- Palet sama persis dengan versi sebelumnya: teal/emerald `#0d6e6a`/`#2a9d8f`, royal purple `#5b2a86`, gold `#c9a84c`, navy `#072346`, ivory `#fbf8f1`.
- Komposisi simetris penuh, garis presisi (seperti engraving sertifikat resmi), bukan brushstroke.

QA: zoom_image ke 4 sudut + tengah atas/bawah untuk memastikan garis tajam, ornamen sudut simetris, tidak ada residu awan/blur.

## 4. Yang Tidak Diubah
- Layout header trilingual, body trilingual, QR frame, dan tanda tangan tetap seperti sekarang (hanya baris "Issued on …" dipindah ke kartu Date — lihat poin 2).
- Tidak ada perubahan pada `RekapSertifikat.tsx`, dialog preview, atau query data.

## File Terdampak
- `src/utils/generateCertificatePDF.ts` — helper Romawi, 3 kartu metrik berwarna, hapus baris tanggal footer.
- `public/certificate-template-tahfizh.png` — render ulang dengan bingkai tegas.
