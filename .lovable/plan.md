# Rencana Perbaikan Rekap Sertifikat

## Temuan Validasi
- Di database, ada tepat **15** baris ujian dengan `mode = 'Tahfizh'`.
- Halaman `/rekap-sertifikat` saat ini gagal mengambil data karena request ke `ujian` berakhir **403**.
- Penyebab utamanya: policy baca `ujian` mengecek relasi ke tabel `penguji` dan `class_penguji`, tetapi tabel-tabel itu belum punya grant Data API yang dibutuhkan, sehingga evaluasi policy terhenti dengan error `permission denied for table penguji`.
- Jadi masalahnya **bukan datanya hilang**, melainkan akses query di backend belum lengkap.

## Yang Akan Saya Kerjakan
1. Tambahkan grant Data API yang benar untuk tabel yang dipakai policy baca ujian Tahfizh, terutama `penguji` dan `class_penguji`.
2. Verifikasi ulang bahwa policy `ujian` untuk admin dan penguji bisa dievaluasi tanpa error.
3. Uji lagi query rekap agar halaman bisa membaca semua **15** ujian Tahfizh yang tersimpan.
4. Pastikan hasil di `/rekap-sertifikat` kembali menampilkan total dan tabel sesuai 15 data tersebut.

## Detail Teknis
- Fokus perubahan ada di migration backend, bukan di filter React terlebih dahulu.
- Query frontend `from('ujian').select('*').eq('mode', 'Tahfizh')` tampaknya sudah benar; bottleneck ada pada izin akses tabel yang disentuh policy RLS.
- Setelah migration dijalankan, saya akan validasi lagi lewat query baca dan request halaman untuk memastikan hasilnya benar-benar muncul.