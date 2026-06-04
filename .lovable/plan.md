# Verifikasi: Rekap Sertifikat Menampilkan 15 Data

## Status
Setelah migration RLS sebelumnya (`Admin and all penguji can read tahfizh ujian`), query existing pada `src/pages/RekapSertifikat.tsx` sudah cukup. Saya cek isi semua 15 baris Tahfizh:

| Kondisi | Jumlah | Lolos filter `isTahfizhCertificateExam`? |
|---|---|---|
| `tahfizhMode` kosong (data lama) | 13 | Ya (cabang `!aspek.tahfizhMode`) |
| `tahfizhMode = Reguler` dengan 13 entri | 2 | Ya (cabang `Reguler && entryCount >= 13`) |

Total = **15** baris akan tampil.

## Yang Perlu Dilakukan
1. **Tidak ada perubahan kode** — query `.from("ujian").select("*").eq("mode","Tahfizh")` di `RekapSertifikat.tsx` sudah benar dan sekarang RLS mengizinkan admin & semua penguji membaca seluruh 15 baris.
2. **Refresh halaman** Rekap Sertifikat (pastikan login sebagai admin atau penguji). React Query cache lama bisa dibersihkan dengan reload.
3. Jika user mencentang "Tampilkan semua hasil ujian", semua 15 muncul. Default (tanpa centang) hanya menampilkan yang `status = Lulus` — kebetulan ke-15 baris semuanya Lulus, jadi tetap 15.

## Verifikasi Pasca-Reload
- Card "Total Lulus" = 15.
- Tabel berisi 15 baris dengan nomor sertifikat otomatis (mulai 134/SDITLH/...).
- Chart "Jumlah Siswa Lulus per Kelas" terisi.

Jika setelah reload data masih belum muncul, kemungkinan user sedang login dengan akun yang tidak punya role `admin` maupun `penguji` di tabel `user_roles` — tindakan: assign role lewat halaman Manage Users.
