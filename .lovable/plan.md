## Perubahan Halaman Login (`src/pages/Login.tsx`)

Saat ini halaman Login memakai gradient generik (`from-background via-muted to-background`) dan tombol gradient `from-primary to-primary/80` yang tidak selaras dengan tema Islamic hijau-emas website (lihat `gradient-islamic` di `index.css` yang dipakai di Register dan seluruh app).

Yang akan diubah (murni styling, tidak menyentuh logika auth):
- Background halaman: ganti gradient generik menjadi nuansa tema Islamic (memakai token semantik `primary`/`secondary`/`accent` yang sudah didefinisikan hijau-emas) agar konsisten dengan Landing/Register.
- Blob dekoratif: warnai dengan `primary` (hijau) dan `secondary` (emas) alih-alih `primary` + `secondary` generik.
- Ikon logo dan tombol submit: gunakan class utility `gradient-islamic` (yang sudah dipakai Register) agar identitas visual seragam.
- Judul "Ujian Tahfizh": pakai `bg-clip-text` dengan `gradient-islamic` supaya nuansa hijau-emas muncul.
- Tetap memakai token semantik (`text-foreground`, `bg-card`, dst.) — tidak ada warna hardcoded seperti `text-white` / `bg-[#...]`.

Tidak mengubah: struktur form, field, validasi, alur `signIn`, redirect, atau toast.

## Perubahan Halaman Register (`src/pages/Register.tsx`)

1. Ubah label pada dropdown Jenis Akun: opsi `"Guru"` → `"Guru Wali Kelas"`. Nilai internal `role` tetap `"guru"` supaya tidak memengaruhi backend, migrasi, RLS, atau data yang sudah ada.
2. Ubah bagian pemilihan kelas untuk role `guru`:
   - Sekarang: checkbox multi-select "Kelas/Rombel yang Diampu" (`assignedClasses: string[]`).
   - Menjadi: **radio / dropdown single-select** "Kelas Wali (Rombel)" — wali kelas hanya bisa memegang 1 rombel.
   - Daftar opsi memakai query `classes-public` yang sudah ada (menampilkan semua kelas 1A–6D yang terdaftar di database, diurutkan `grade` lalu `section`). Nama ditampilkan lewat helper `formatClassName` agar tampil rapi (mis. "I A" … "VI D").
   - Validasi: jika role `guru`, wajib memilih 1 kelas sebelum submit; tampilkan toast bila belum dipilih.
3. Payload signUp:
   - `assigned_classes` tetap dikirim sebagai `string[]` berisi 1 id kelas terpilih (`[selectedClassId]`) supaya kompatibel dengan backend/edge function existing yang membaca `assigned_classes` (tidak mengubah kontrak data).
4. State lokal:
   - Ganti `assignedClasses: string[]` menjadi `assignedClassId: string` (atau tetap array dengan panjang ≤1). Hapus fungsi `toggleClass`, ganti dengan setter langsung.

Tidak mengubah: alur role Penguji, Orang Tua, komponen `ParentChildFields`, `Field`, styling umum form.

## Detail Teknis

- File yang disentuh hanya `src/pages/Login.tsx` dan `src/pages/Register.tsx`.
- Tidak ada perubahan database, migration, edge function, atau types.
- Tidak ada perubahan pada rumus nilai, kelulusan, sertifikasi, atau data historis.
- Verifikasi: `npm run build`.
