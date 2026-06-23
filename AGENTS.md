# AGENTS.md

Panduan ini berlaku untuk semua AI agent yang bekerja di repo web Tahfizh SDIT Luqmanul Hakim, terutama Antigravity. Codex boleh mengikuti panduan ini juga, tetapi catatan paling penting di sini adalah menjaga agar Antigravity disiplin dalam verifikasi, commit, dan push.

## Cara Kerja Utama

- Kerjakan perubahan secara sempit sesuai permintaan pengguna. Jangan membuat fitur baru, mengubah alur lama, atau merapikan kode di luar area tugas tanpa izin.
- Baca file terkait sebelum mengedit. Ikuti pola komponen, hook, helper, Supabase query, dan styling yang sudah ada.
- Jangan mengubah rumus nilai, logika kelulusan, status sertifikasi, struktur database, data lama, atau migrasi Supabase tanpa instruksi eksplisit.
- Jangan menghapus siswa, kelas, ujian, rapor, sertifikat, rekap, token verifikasi, atau data historis apa pun kecuali pengguna meminta dengan jelas.
- Untuk perubahan UI laporan, PDF, preview, export, dan public verification, cari helper bersama lebih dulu agar hasilnya konsisten di semua permukaan.
- Untuk perubahan dashboard/rekap, pertahankan filter dan data existing. Jika membuat kartu statistik atau chart interaktif, pastikan kliknya memfilter tabel detail yang sama.
- Untuk perubahan data siswa dari spreadsheet, cek nama dan level lebih dulu, buat artefak review sebelum write, dan jangan auto-merge konflik nama yang sama.

## Batas Aman Database

- Pakai tabel, kolom, migration, dan generated types yang sudah ada.
- Jangan membuat tabel/kolom baru jika solusi bisa memakai struktur existing.
- Jangan menjalankan SQL write ke Supabase live tanpa persetujuan pengguna.
- Jika perlu SQL, buat file SQL yang bisa direview dulu. Pecah batch besar menjadi bagian kecil yang aman ditempel ke SQL Editor.
- Setelah perubahan data, verifikasi dengan metrik nol selisih: missing, duplicate, mismatch, dan jumlah total yang relevan.

## Verifikasi Lokal

- Untuk perubahan kode aplikasi, jalankan minimal:
  - `npm run build`
- Jika perubahan menyentuh testable logic, jalankan juga:
  - `npm test`
- Untuk perubahan dokumen saja seperti `AGENTS.md`, cukup cek:
  - `git diff --check`
  - `git status --short`
- Jika build/test gagal karena masalah yang tidak terkait perubahan, catat error persisnya dan jangan mengklaim selesai.

## Aturan Commit dan Push untuk Antigravity

Antigravity sering kurang sempurna di tahap commit-push, jadi ikuti checklist ini sampai selesai:

1. Pastikan hanya file yang relevan berubah:
   - `git status --short`
   - `git diff --stat`
2. Jalankan verifikasi yang sesuai.
3. Stage hanya file yang dikerjakan:
   - `git add <file-yang-diubah>`
4. Commit dengan pesan singkat dan jelas:
   - `git commit -m "Describe the change"`
5. Push ke branch aktif:
   - `git push origin <nama-branch>`
6. Buktikan local dan remote sudah sinkron:
   - `git rev-list --left-right --count HEAD...origin/<nama-branch>`
   - Hasil yang diharapkan: `0 0`
7. Buktikan hash remote sama dengan commit lokal:
   - `git rev-parse HEAD`
   - `git ls-remote origin <nama-branch>`

Jika salah satu langkah gagal, berhenti dan laporkan penyebabnya. Jangan menyebut pekerjaan sudah live/ter-push jika belum ada bukti sinkron.

## Kebiasaan Git

- Jangan menjalankan `git reset --hard`, `git checkout -- <file>`, atau perintah destruktif lain tanpa izin eksplisit.
- Jangan menimpa perubahan pengguna yang sudah ada di working tree.
- Jika ada file berubah yang tidak terkait tugas, biarkan saja dan stage hanya file yang relevan.
- Default branch repo ini adalah `main` kecuali pengguna sedang meminta branch lain.

## Ringkasan untuk Agent

Kerjakan yang diminta, jaga data lama, verifikasi sesuai risiko, commit perubahan yang relevan, push ke remote, lalu buktikan `HEAD` dan `origin/<branch>` sudah sama.
