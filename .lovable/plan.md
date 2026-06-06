# Rencana: Remake Sertifikat Tahfizh (Template + Layout PDF)

## Tujuan
Mengganti total template sertifikat Tahfizh dengan versi baru yang bersih, tajam, presisi (bukan tambalan), pas untuk A4 Landscape (297×210 mm / rasio 1.414:1), serta menambah teks trilingual (Arab, Inggris, Indonesia) selayaknya sertifikat tahfizh internasional. Bingkai QR juga dirapikan agar ukurannya pas dengan QR.

## Hasil Akhir
- File `public/certificate-template-tahfizh.png` baru (1754×1240 px, rasio A4 landscape, render bersih).
- `src/utils/generateCertificatePDF.ts` diperbarui: layout, tipografi trilingual, dan frame QR yang presisi.
- Dukungan font Arab (`Amiri`) dipakai di PDF (memanfaatkan `src/utils/loadArabicFont.ts` yang sudah ada).
- Tidak ada perubahan logika data / query (rekap sertifikat tetap).

## Desain Template Baru (image)
Gaya: Islamic luxury, hijau emerald + emas, ornamen geometris Islami presisi (bukan tambal sulam).
Komposisi:
- Bingkai ganda emas tipis di seluruh tepi, sudut ornamen arabesque simetris kiri-kanan-atas-bawah.
- Header: rosette/medali emas di tengah atas + dua lentera tergantung simetris (kiri & kanan), lebih halus & tajam.
- Watermark tipis kaligrafi/geometric pattern di tengah, opacity rendah agar teks tetap terbaca.
- Footer band emerald gelap dengan ornamen bintang 8.
- Area konten putih bersih di tengah, tanpa elemen kotak metrik yang sebelumnya kaku (metrik akan digambar via PDF, bukan ditanam di image).
- Tidak ada logo/tulisan eksternal yang menempel di template (logo dibiarkan kosong supaya PDF yang menambah teks).

Render via `imagegen--generate_image` quality `premium` (penting untuk ornamen halus), 1792×1280, kemudian crop/resize ke 1754×1240 jika perlu. QA dengan zoom_image.

## Layout PDF (A4 Landscape 297×210 mm)
Header trilingual (atas, center):
- Arab: «شَهَادَةُ تَحْفِيظِ الْقُرْآنِ الْكَرِيمِ» (font Amiri, ±20pt, navy)
- English: "CERTIFICATE OF QUR'AN MEMORIZATION" (Helvetica bold small caps, ±13pt, gold)
- Indonesia: "Sertifikat Tahfizh Al-Qur'an" (Helvetica bold italic, ±12pt, navy)
- Nomor sertifikat di bawah header (gold, ±9pt)

Body:
- Label trilingual "This is to certify that / Diberikan kepada / يُشْهَدُ بِأَنَّ" (italic, kecil)
- Nama siswa: navy, bold, besar (auto-fit hingga 27pt)
- Kelas + sekolah (1 baris)
- Pernyataan trilingual ringkas:
  - EN: "has successfully completed the Tahfizh examination for Juz {X} with the following result:"
  - ID: "telah menyelesaikan ujian Tahfizh Al-Qur'an Juz {X} dengan hasil sebagai berikut:"
  - AR: «قَدْ أَتَمَّ اخْتِبَارَ تَحْفِيظِ الْجُزْءِ {X} بِالنَّتِيجَةِ الْآتِيَةِ»

Metrik (2 kolom di kiri-tengah & kanan-tengah, digambar via PDF, bukan template):
- Nilai Akhir / Final Score: angka besar gold
- Predikat / Grade: teks gold

QR Code (kanan-bawah area metrik, terpusat):
- Ukuran QR: 26×26 mm
- Frame: kotak rounded emas (stroke 0.5 mm) berukuran 30×30 mm dengan padding 2 mm; QR di-center dalam frame
- Caption trilingual kecil di bawah frame: "Scan to verify · Verifikasi · للتحقق"

Footer (bawah):
- Kiri: tanda tangan "Koordinator Tahfizh / Tahfizh Coordinator"
- Kanan: tanda tangan "Kepala Sekolah / Principal"
- Tengah-bawah: tanggal trilingual "Ditetapkan pada {tanggal} · Issued on {date}"
- Garis tanda tangan emas tipis

## Implementasi (Build Mode)
1. Generate image template baru (premium) → simpan ke `public/certificate-template-tahfizh.png` (overwrite). QA visual: pastikan tidak ada teks acak/garis tambal, ornamen simetris, tajam.
2. Update `src/utils/generateCertificatePDF.ts`:
   - Import & panggil `loadArabicFont` di `buildCertificatePDF`.
   - Tambah helper `drawTrilingualBlock(doc, ar, en, id, y, opts)`.
   - Ganti seluruh layout konten (header, body, metrik, QR frame, footer) sesuai spesifikasi di atas.
   - Sesuaikan posisi QR + frame (rounded rect via `doc.roundedRect`) presisi dengan ukuran QR.
3. Tidak menyentuh `RekapSertifikat.tsx`, dialog, atau query — preview & download tetap menggunakan `buildCertificatePDF`.
4. QA: render satu preview lewat dialog, screenshot, verifikasi semua teks tidak overflow, frame QR pas, font Arab tampil benar.

## Catatan Teknis
- `jsPDF` mendukung Arab via Amiri (sudah tersedia di `public/fonts/Amiri-Regular.ttf`). Teks Arab perlu dirender dengan `doc.setFont("Amiri","normal")` dan `align: "center"`. Shaping dasar didukung; gunakan kalimat pendek.
- Semua koordinat dalam mm; gunakan konstanta agar mudah disesuaikan.
- Tidak mengubah signature `CertificateData` agar pemanggil tidak perlu diubah.
