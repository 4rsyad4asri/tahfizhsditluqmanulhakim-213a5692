
# Sistem Manajemen Akun Guru, Penguji, Orang Tua & Admin

Pengembangan besar pada modul akun. Tidak menghapus/mengubah fitur lama (ujian, rapor, sertifikat, rekap tetap berjalan). Pendekatan backward compatible: kolom baru bersifat opsional, role baru ditambahkan ke enum, data lama tidak disentuh.

## 1. Audit Singkat Kondisi Sekarang

- `profiles` saat ini hanya berisi `id, full_name, created_at, updated_at`.
- `user_roles` memakai enum `app_role` = `admin | penguji`.
- Tabel `penguji` punya kolom `user_id` (nullable) yang menghubungkan record penguji ke akun auth.
- Belum ada: registrasi publik, approval flow, biodata, foto profil, tanda tangan digital, role guru/parent.
- `ManageUsers.tsx` saat ini membuat user via edge function `admin-create-user` (tanpa approval). Akan diperluas, bukan dihapus.

## 2. Perubahan Database (migration tunggal, aman)

### 2.1 Enum role diperluas
- Tambah nilai ke `app_role`: `guru`, `parent`. (`admin`, `penguji` tetap.)

### 2.2 Enum baru `account_status`
- Nilai: `pending`, `approved`, `rejected`, `inactive`.

### 2.3 Perluasan tabel `profiles`
Tambah kolom (semua NULLABLE kecuali yang punya default):
- `username` (unique, nullable)
- `email`
- `whatsapp`
- `bio`
- `avatar_url`
- `signature_url`
- `display_name_rapor`
- `display_name_certificate`
- `title` (gelar)
- `jabatan`
- `nip`
- `assigned_classes uuid[]` (untuk guru — penguji tetap pakai `class_penguji`)
- `status account_status default 'approved'` (data lama otomatis approved, tidak terkunci)
- `approved_at`, `approved_by uuid`
- `registered_at timestamptz default now()`

Index unik case-insensitive untuk `username`.

### 2.4 Tabel baru `parent_students` (persiapan tahap berikutnya)
- `id`, `parent_user_id → auth.users`, `student_id → students`, `relation text` (ayah/ibu/wali), `created_at`.
- RLS: parent hanya bisa lihat barisnya sendiri; admin full akses.

### 2.5 Bucket storage
- Buat bucket publik `avatars` dan `signatures` (signatures disimpan PNG transparan).
- RLS storage.objects: user hanya bisa upload/replace/delete file di folder `{auth.uid()}/...`; SELECT publik agar bisa dipakai di PDF.

### 2.6 RLS & GRANT
- `profiles`: user baca/edit baris sendiri (kecuali kolom `status`, `role`, `approved_*` — diatur oleh trigger yang menolak perubahan jika bukan admin). Admin full akses.
- Trigger `handle_new_user` diperbarui: insert ke profiles dengan `status='pending'`, ambil `username, whatsapp, role` dari `raw_user_meta_data`. Insert juga ke `user_roles` dengan role dari metadata (default `penguji`).
- Helper baru: `is_account_approved(_uid uuid)` security definer untuk dipakai gate fitur.

### 2.7 Backfill
- Semua profil existing di-set `status='approved'`, `registered_at = created_at`, `approved_at = now()` agar admin & penguji lama tidak terkunci.

## 3. Edge Functions

- `admin-approve-user`: set status approved + isi `approved_at/by`. Hanya admin.
- `admin-reject-user`, `admin-deactivate-user`, `admin-reactivate-user`.
- `admin-reset-password`: dua mode — generate password sementara (return sekali, tidak disimpan) atau kirim magic reset link via `auth.admin.generateLink('recovery')`.
- `admin-update-user`: ubah nama/username/role/whatsapp/email/biodata/jabatan/kelas.
- `admin-create-user` (existing) diperluas: terima field tambahan, set status approved otomatis (karena dibuat admin).

Semua: validasi Zod, cek `has_role(auth.uid(),'admin')`, CORS, tidak pernah mengembalikan password lama (tidak ada — Supabase hash).

## 4. Frontend — Halaman Baru/Diubah

### 4.1 `/register` (publik)
Form: Nama Lengkap, Username, Email, WhatsApp, Jenis Akun (Guru/Penguji/Parent), Kelas (jika Guru, multi-select), Biodata, Password + Konfirmasi.
- `supabase.auth.signUp` dengan `options.data` berisi metadata → trigger isi profiles.
- Setelah submit: tampilkan pesan "Akun menunggu persetujuan admin".

### 4.2 `/login` (existing)
- Tambah cek: jika `profiles.status !== 'approved'` → sign out + tampilkan pesan sesuai status (pending/rejected/inactive). Tombol "Belum punya akun? Daftar".

### 4.3 `/manage-users` (revamp)
Tab/filter:
- Daftar akun (Nama, Username, Role, WhatsApp, Status, Tanggal Registrasi).
- Search, filter role, filter status, pagination (client-side awal).
- Aksi per baris (admin): Approve, Reject, Deactivate, Reactivate, Edit (dialog lengkap), Reset Password (pilih: generate sementara / kirim link), Kirim Konfirmasi WhatsApp, Hapus (tetap, existing).
- Tombol "Tambah Akun" (existing flow tetap ada).

### 4.4 Tombol "Kirim Konfirmasi WhatsApp"
- Hanya muncul untuk akun `approved` dengan WhatsApp terisi.
- Buka `https://wa.me/{nomor}?text=...` dengan template yang diminta (URL-encoded, mengambil username dari profil).

### 4.5 `/profile` (Profil Saya)
Untuk semua role:
- Edit: nama, username, WhatsApp, email (via `supabase.auth.updateUser`), biodata, foto profil (upload ke `avatars/{uid}/avatar.png`).
- Tab Tanda Tangan Digital: upload PNG/JPG (preview, ganti, hapus). Simpan ke `signatures/{uid}/signature.png`. Validasi tipe & ukuran (≤2MB), arahkan user memakai PNG transparan untuk hasil terbaik.
- Khusus guru/penguji: field tambahan — NIP, Jabatan, Gelar, Nama Tampilan Rapor, Nama Tampilan Sertifikat.

### 4.6 Header/Nav
- Tambah link "Profil Saya". "Manajemen Akun" tetap admin-only.

## 5. Integrasi Tanda Tangan ke Rapor & Sertifikat

- Saat generate PDF Tahsin Dasar/Lanjutan, Tahfizh, Diniyyah, dan sertifikat:
  - Lookup `profiles.signature_url` dari penguji terkait (via `penguji.user_id`).
  - Jika ada → embed gambar di area tanda tangan penguji (Preview, Download, Print).
  - Jika tidak ada → tetap placeholder kosong (perilaku saat ini).
- Nama yang dicetak: pakai `display_name_rapor`/`display_name_certificate` jika ada, fallback ke `full_name`. Tambah gelar/jabatan bila terisi.
- Tidak ada perubahan logika nilai/struktur PDF lain.

## 6. UI/UX

- Mengikuti tema existing (emerald/gold, Plus Jakarta Sans, Amiri).
- Card + table modern shadcn, responsive desktop & mobile.
- Toast (sonner), loading state (skeleton/spinner), empty state.
- Komponen kecil & fokus.

## 7. Keamanan

- Password tidak pernah disimpan/ditampilkan plaintext (pakai Supabase Auth).
- Admin reset password = generate temporary atau kirim recovery link (tidak melihat password lama).
- Username unik (case-insensitive).
- Validasi Zod di semua form + edge functions.
- RLS ketat: user tidak bisa mengubah `role`/`status`/`approved_*` sendiri.
- File upload: validasi MIME & size di klien, RLS storage memaksa path `{uid}/...`.

## 8. Catatan Teknis (untuk dev)

- File baru:
  - `src/pages/Register.tsx`, `src/pages/Profile.tsx`.
  - `src/components/profile/SignatureUploader.tsx`, `AvatarUploader.tsx`.
  - `src/components/users/UserEditDialog.tsx`, `ResetPasswordDialog.tsx`, `UserFilters.tsx`.
  - `supabase/functions/admin-approve-user/index.ts` (+ reject/deactivate/reactivate/reset/update).
- File diubah:
  - `src/App.tsx` (route `/register`, `/profile`).
  - `src/pages/Login.tsx` (cek status + link daftar).
  - `src/pages/ManageUsers.tsx` (revamp tabel + aksi).
  - `src/components/Header.tsx` (menu Profil).
  - Modul generator PDF rapor & sertifikat (inject signature URL & display name).
  - `src/integrations/supabase/types.ts` auto-regenerate setelah migration.
- Migration: satu file dengan enum, alter table, tabel parent_students, trigger update, RLS, GRANT, backfill.
- Bucket dibuat via `supabase--storage_create_bucket` (bukan SQL).

## 9. Yang TIDAK Diubah

- Skema & logika `ujian`, `setoran`, `students`, `classes`, `penguji`, `class_penguji`.
- Formula nilai, alur penilaian, locking Published.
- Layout sertifikat (hanya menambahkan signature + display name jika tersedia).
