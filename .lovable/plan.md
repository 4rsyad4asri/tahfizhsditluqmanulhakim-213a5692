# Kembalikan Data Rekap Sertifikat Tahfizh

## Masalah
15 ujian Tahfizh ada di database tapi tidak muncul di halaman Rekap Sertifikat. Penyebab: kebijakan keamanan terakhir membatasi `SELECT` pada tabel `ujian` hanya untuk **admin** atau **penguji yang ditugaskan ke kelas siswa pemilik ujian tersebut**. Akibatnya:
- Admin tetap bisa melihat semua (via `has_role`).
- Penguji hanya melihat ujian milik kelas yang ditugaskan kepadanya — bukan rekap global.
- Anon tidak melihat apapun (kecuali 1 ujian yang sudah Published).

Sesuai jawaban: rekap harus bisa dilihat **admin dan semua penguji** (bukan publik).

## Solusi (1 migration)

Tambah policy `SELECT` permisif pada `ujian` khusus untuk mode Tahfizh, agar setiap user authenticated yang punya role `admin` atau `penguji` dapat membaca seluruh baris Tahfizh untuk keperluan rekap sertifikat.

```sql
-- Akses baca rekap sertifikat untuk admin & semua penguji
CREATE POLICY "Admin and all penguji can read tahfizh ujian"
ON public.ujian
FOR SELECT
TO authenticated
USING (
  mode = 'Tahfizh'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'penguji'::public.app_role)
  )
);
```

Policy existing tetap berlaku:
- `Admin or assigned penguji can read ujian` (untuk ujian Tahsin & detail kelas)
- `Public can verify published ujian` (untuk QR verifikasi publik)
- Tabel `setoran`, `students.catatan_penguji`, `penguji.user_id` **tidak diubah** — tetap terkunci.

## Verifikasi
1. Setelah migration jalan, query `ujian` mode Tahfizh sebagai penguji harus mengembalikan 15 baris.
2. Buka halaman Rekap Sertifikat → tabel + chart terisi 15 siswa.
3. Login penguji lain → tetap **tidak bisa** baca `setoran` / ujian Tahsin milik kelas lain (akses sensitif tetap terjaga).

## Update Security Memory
Catat bahwa baca-saja seluruh ujian Tahfizh oleh user authenticated (admin + penguji) adalah keputusan bisnis (rekap sertifikat internal sekolah), bukan kebocoran.
