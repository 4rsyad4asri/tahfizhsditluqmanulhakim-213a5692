export type RaportMode =
  | "Tahfizh"
  | "Tahsin Dasar"
  | "Tahsin Lanjutan";

type Entry = {
  lahn_jali?: number;
  lahn_khofi?: number;
  kesalahan_tajwid?: number;
  kesalahan_mad?: number;
  kesalahan_makhraj?: number;
  waqaf_ibtida?: number;
  salah_sambung_ayat?: number;
  kelancaran?: number;
};

export function generateCatatanOtomatis(
  mode: RaportMode,
  nilaiAkhir: number,
  namaSiswa?: string,
  entries: Entry[] = []
): string {

  const ananda = namaSiswa || "Ananda";

  // =========================
  // HITUNG TOTAL KESALAHAN
  // =========================

  const totalLahnJali = entries.reduce(
    (a, b) => a + (b.lahn_jali || b.kesalahan_makhraj || 0),
    0
  );

  const totalLahnKhofi = entries.reduce(
    (a, b) =>
      a +
      (b.lahn_khofi ||
        b.kesalahan_tajwid ||
        b.kesalahan_mad ||
        0),
    0
  );

  const totalWaqaf = entries.reduce(
    (a, b) => a + (b.waqaf_ibtida || 0),
    0
  );

  const totalSambung = entries.reduce(
    (a, b) => a + (b.salah_sambung_ayat || 0),
    0
  );

  const avgKelancaran =
    entries.length > 0
      ? Math.round(
          entries.reduce(
            (a, b) => a + (b.kelancaran || 0),
            0
          ) / entries.length
        )
      : 0;

  // =========================
  // ANALISIS KELEMAHAN
  // =========================

  const catatanKhusus: string[] = [];

  if (totalLahnJali >= 5) {
    catatanKhusus.push(
      "Perlu peningkatan pada ketepatan makhraj dan pengucapan huruf hijaiyah."
    );
  }

  if (totalLahnKhofi >= 5) {
    catatanKhusus.push(
      "Perlu meningkatkan ketelitian dalam penerapan hukum tajwid dan panjang pendek bacaan."
    );
  }

  if (totalWaqaf >= 3) {
    catatanKhusus.push(
      "Perlu memperhatikan kaidah waqaf dan ibtida’ dalam membaca Al-Qur'an."
    );
  }

  if (totalSambung >= 3) {
    catatanKhusus.push(
      "Perlu meningkatkan muroja’ah agar sambungan ayat lebih kuat dan lancar."
    );
  }

  if (avgKelancaran <= 70 && avgKelancaran !== 0) {
    catatanKhusus.push(
      "Kelancaran bacaan masih perlu ditingkatkan melalui latihan rutin dan pembiasaan membaca."
    );
  }

  // =========================
  // PENUTUP BERDASARKAN NILAI
  // =========================

  let komentarUtama = "";

  if (nilaiAkhir >= 90) {
    komentarUtama =
      `${ananda} menunjukkan kemampuan yang sangat Mumtaz dengan kualitas bacaan dan penguasaan materi yang sangat baik. `;
  } else if (nilaiAkhir >= 85) {
    komentarUtama =
      `${ananda} menunjukkan kemampuan yang baik dalam pelaksanaan ujian serta memiliki pemahaman yang cukup kuat terhadap materi yang diujikan. `;
  } else if (nilaiAkhir >= 76) {
    komentarUtama =
      `${ananda} memiliki kemampuan yang cukup baik, namun masih terdapat beberapa aspek yang perlu ditingkatkan agar hasil yang dicapai lebih optimal. `;
  } else if (nilaiAkhir >= 70) {
    komentarUtama =
      `${ananda} telah berusaha dengan baik dalam mengikuti ujian, namun masih memerlukan pembinaan dan latihan yang lebih intensif pada beberapa aspek penilaian. `;
  } else {
    komentarUtama =
      `${ananda} masih memerlukan bimbingan dan latihan yang lebih konsisten agar kemampuan membaca dan hafalan Al-Qur'an dapat berkembang dengan lebih baik. `;
  }

  // =========================
  // PENYESUAIAN MODE
  // =========================

  let fokusMode = "";

  if (mode === "Tahsin Dasar") {
    fokusMode =
      "Kemampuan membaca dasar Al-Qur'an, pengenalan huruf, harakat, dan penerapan tajwid dasar perlu terus dikembangkan. ";
  }

  if (mode === "Tahsin Lanjutan") {
    fokusMode =
      "Penerapan tajwid lanjutan, waqaf ibtida’, makhraj, dan kelancaran membaca perlu terus dijaga dan ditingkatkan. ";
  }

  if (mode === "Tahfizh") {
    fokusMode =
      "Kualitas hafalan, kelancaran muroja’ah, dan kekuatan sambungan ayat perlu terus dipertahankan dan ditingkatkan. ";
  }

  // =========================
  // FINAL
  // =========================

  return `
${komentarUtama}
${fokusMode}
${catatanKhusus.join(" ")}
Semoga Allah memberikan kemudahan dan keberkahan dalam mempelajari serta menjaga Al-Qur'an. Barakallahu fiikum.
`.replace(/\s+/g, " ").trim();
}
