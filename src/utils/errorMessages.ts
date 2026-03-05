/**
 * Maps raw database/API error messages to user-friendly Indonesian messages.
 * Prevents leaking internal database structure to end users.
 */
export function getSafeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (msg.includes('duplicate') || msg.includes('unique constraint')) {
    return 'Data sudah ada';
  }
  if (msg.includes('foreign key')) {
    return 'Data terkait tidak ditemukan';
  }
  if (msg.includes('not-null') || msg.includes('null value')) {
    return 'Mohon lengkapi semua data yang wajib diisi';
  }
  if (msg.includes('check_ayat_range')) {
    return 'Ayat akhir harus lebih besar atau sama dengan ayat mulai';
  }
  if (msg.includes('check constraint')) {
    return 'Nilai yang dimasukkan tidak valid';
  }
  if (msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'Anda tidak memiliki izin untuk melakukan aksi ini';
  }
  if (msg.includes('jwt') || msg.includes('token')) {
    return 'Sesi Anda telah berakhir, silakan login kembali';
  }

  return 'Terjadi kesalahan, silakan coba lagi';
}
