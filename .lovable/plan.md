# Rencana: Polesan Sertifikat (revert ke desain sebelumnya + tweak sudut)

## 1. Perbaikan Build Error (test file)
`src/data/tahfizhSystem.test.ts:14` memanggil `.map(normalizeTahfizhAssessment)`. Karena `Array#map` melempar `(value, index, array)`, parameter kedua `normalizeTahfizhAssessment(entry, fallbackAssessment?)` menerima `number` — bentrok tipe.

Perbaikan: bungkus dengan arrow function di test:
```ts
].map((entry) => normalizeTahfizhAssessment(entry));
```
Tidak mengubah signature fungsi produksi.

## 2. Render Ulang Template (revert + tweak)
Kembali ke desain watercolor-blur sebelumnya (lentera tergantung di kiri-kanan, bintang emas, pita navy, watermark halus) — **tanpa** bingkai ganda emas tegas + arabesque sudut yang baru saja dibuat. Tweak sudut atas:

- **Sudut kiri atas**: blur watercolor wash **hijau emerald** (`#0d6e6a` → `#2a9d8f`, soft, organic), dengan **satu lentera 2D flat** classic-modern menggantung di dalam wash — gaya ilustrasi datar (flat 2D), garis emas tipis, isi hijau-tosca, kaca lentera kuning hangat lembut. Tidak realistic 3D, tidak glow berlebihan.
- **Sudut kanan atas**: identik secara bentuk dengan kiri (lentera flat 2D yang sama persis, mirror simetris), namun wash **ungu royal** (`#5b2a86` → `#7c3aed`, soft).
- **Sudut bawah kiri & kanan**: tetap dengan wash organik (kiri hijau, kanan ungu) yang lebih kecil, tanpa lentera, sebagai keseimbangan.
- Tengah atas: rosette emas kecil (tetap).
- Tengah bawah: pita navy ramping dengan 5 bintang segi-8 emas (tetap).
- Latar ivory `#fbf8f1` polos, watermark geometric pattern sangat halus (opacity ~5%).
- Palet warna sama persis dengan versi awal: teal/emerald, royal purple, gold `#c9a84c`, navy `#072346`, ivory.
- Gaya "classic modern": ilustrasi flat 2D yang bersih, wash watercolor lembut (bukan tepi tajam), simetri kiri-kanan presisi.

Render: `imagegen--generate_image` quality **premium**, 1792×1280, overwrite `public/certificate-template-tahfizh.png`. QA dengan `image_tools--zoom_image` ke kedua sudut atas untuk memastikan lentera identik dan wash warna benar.

## 3. Tidak Diubah
- `src/utils/generateCertificatePDF.ts` (format kelas Romawi + 3 kartu metrik berwarna hijau/emas/ungu yang baru disetujui) tetap dipertahankan apa adanya.
- Tidak menyentuh `RekapSertifikat.tsx`, dialog, atau query.

## File Terdampak
- `src/data/tahfizhSystem.test.ts` — fix arrow function di `.map`.
- `public/certificate-template-tahfizh.png` — render ulang ke desain watercolor + lentera flat 2D kiri-hijau / kanan-ungu.
