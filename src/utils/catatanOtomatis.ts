export type RaportMode =
  | "Tahfizh"
  | "Tahsin Dasar"
  | "Tahsin Lanjutan";

type GenerateCatatanParams = {
  mode: RaportMode;
  nilaiAkhir: number;
  namaSiswa?: string;
  lahnJali?: number;
  lahnKhofi?: number;
  waqaf?: number;
  sambung?: number;
  kelancaran?: number;
  makhraj?: number;
  tajwid?: number;
  mad?: number;
  qalqalah?: number;
};

export default function generateCatatanOtomatis({
  mode,
  nilaiAkhir,
  namaSiswa,

  lahnJali = 0,
  lahnKhofi = 0,

  waqaf = 0,
  sambung = 0,

  kelancaran = 90,

  makhraj = 0,
  tajwid = 0,
  mad = 0,
  qalqalah = 0,
}: GenerateCatatanParams): string {

  const nilai = Number(nilaiAkhir) || 0;

  const ananda = namaSiswa || "Ananda";

  // ========================================
  // PEMBUKA BERDASARKAN NILAI
  // ========================================

  let pembuka = "";

  if (nilai >= 90) {
    pembuka =
      `${ananda} menunjukkan hasil yang sangat Mumtaz dengan penguasaan materi yang sangat baik. `;
  } else if (nilai >= 85) {
    pembuka =
      `${ananda} menunjukkan hasil yang baik dan kemampuan yang berkembang dengan sangat baik. `;
  } else if (nilai >= 76) {
    pembuka =
      `${ananda} memiliki kemampuan yang cukup baik, namun masih terdapat beberapa aspek yang perlu ditingkatkan. `;
  } else if (nilai >= 70) {
    pembuka =
      `${ananda} telah berusaha dengan baik, namun masih memerlukan latihan dan pembinaan yang lebih intensif. `;
  } else {
    pembuka =
      `${ananda} masih memerlukan bimbingan dan latihan yang lebih rutin agar kemampuan membaca dan hafalan Al-Qur'an dapat meningkat dengan baik. `;
  }

  // ========================================
  // LIST CATATAN
  // ========================================

  const catatan: string[] = [];

  // ========================================
  // TAHFIZH
  // ========================================

  if (mode === "Tahfizh") {

    // LAHN JALI
    if (lahnJali >= 8) {
      catatan.push(
        "Perlu meningkatkan ketepatan makhraj huruf dan mengurangi kesalahan bacaan yang dapat mengubah lafazh Al-Qur'an"
      );
    } else if (lahnJali >= 5) {
      catatan.push(
        "Masih terdapat beberapa kesalahan pada pengucapan huruf tertentu yang perlu diperbaiki"
      );
    }

    // LAHN KHOFI
    if (lahnKhofi >= 12) {
      catatan.push(
        "Perlu meningkatkan ketelitian dalam penerapan tajwid terutama pada mad, ghunnah, dan panjang pendek bacaan"
      );
    } else if (lahnKhofi >= 6) {
      catatan.push(
        "Masih perlu meningkatkan ketelitian dalam penerapan hukum tajwid pada beberapa bagian bacaan"
      );
    }

    // WAQAF
    if (waqaf >= 3) {
      catatan.push(
        "Perlu meningkatkan pemahaman waqaf dan ibtida’ agar pemberhentian bacaan lebih tepat"
      );
    }

    // SAMBUNG
    if (sambung >= 3) {
      catatan.push(
        "Masih perlu meningkatkan kekuatan hafalan pada sambungan ayat dan kelancaran muroja’ah"
      );
    }

    // KELANCARAN
    if (kelancaran <= 75) {
      catatan.push(
        "Perlu meningkatkan kelancaran hafalan dengan memperbanyak muroja’ah secara rutin"
      );
    } else if (kelancaran <= 85) {
      catatan.push(
        "Kelancaran hafalan sudah cukup baik namun masih perlu lebih ditingkatkan"
      );
    }

    // JIKA SANGAT BAGUS
    if (
      nilai >= 90 &&
      catatan.length === 0
    ) {
      catatan.push(
        "Hafalan Al-Qur'an sangat baik dengan kelancaran, ketepatan tajwid, dan sambungan ayat yang sangat bagus"
      );
    }

    catatan.push(
      "Diharapkan terus menjaga hafalan dengan memperbanyak muroja’ah secara istiqamah"
    );
  }

  // ========================================
  // TAHSIN DASAR
  // ========================================

  if (mode === "Tahsin Dasar") {

    // MAKHRAJ
    if (makhraj >= 8) {
      catatan.push(
        "Perlu meningkatkan ketepatan pengucapan makhraj huruf hijaiyah"
      );
    } else if (makhraj >= 4) {
      catatan.push(
        "Masih terdapat beberapa kesalahan kecil pada pengucapan huruf hijaiyah"
      );
    }

    // TAJWID
    if (tajwid >= 8) {
      catatan.push(
        "Perlu meningkatkan pemahaman tajwid dasar dan penerapan hukum bacaan"
      );
    } else if (tajwid >= 4) {
      catatan.push(
        "Masih perlu meningkatkan ketelitian dalam penerapan tajwid dasar"
      );
    }

    // MAD
    if (mad >= 4) {
      catatan.push(
        "Masih perlu meningkatkan ketepatan panjang pendek bacaan (mad)"
      );
    }

    // QALQALAH
    if (qalqalah >= 3) {
      catatan.push(
        "Perlu meningkatkan ketepatan bacaan qalqalah pada beberapa huruf tertentu"
      );
    }

    // KELANCARAN
    if (kelancaran <= 75) {
      catatan.push(
        "Perlu meningkatkan kelancaran membaca dengan latihan rutin dan pembiasaan membaca tartil"
      );
    } else if (kelancaran <= 85) {
      catatan.push(
        "Kelancaran membaca sudah cukup baik namun masih perlu lebih ditingkatkan"
      );
    }

    // JIKA BAGUS
    if (
      nilai >= 90 &&
      catatan.length === 0
    ) {
      catatan.push(
        "Kemampuan membaca dasar Al-Qur'an sudah sangat baik dan sesuai kaidah dasar pembelajaran"
      );
    }

    catatan.push(
      "Semoga terus semangat dalam belajar dan memperbaiki kualitas bacaan Al-Qur'an"
    );
  }

  // ========================================
  // TAHSIN LANJUTAN
  // ========================================

  if (mode === "Tahsin Lanjutan") {

    // LAHN JALI
    if (lahnJali >= 5) {
      catatan.push(
        "Perlu meningkatkan ketepatan makhraj dan mengurangi kesalahan bacaan yang bersifat jelas"
      );
    } else if (lahnJali >= 2) {
      catatan.push(
        "Masih terdapat beberapa kesalahan kecil pada pengucapan huruf tertentu"
      );
    }

    // LAHN KHOFI
    if (lahnKhofi >= 8) {
      catatan.push(
        "Perlu meningkatkan penerapan hukum tajwid terutama pada mad, ghunnah, dan sifat huruf"
      );
    } else if (lahnKhofi >= 4) {
      catatan.push(
        "Masih perlu meningkatkan ketelitian dalam penerapan hukum tajwid"
      );
    }

    // WAQAF
    if (waqaf >= 3) {
      catatan.push(
        "Perlu meningkatkan pemahaman waqaf dan ibtida’ agar bacaan lebih sempurna"
      );
    }

    // KELANCARAN
    if (kelancaran <= 75) {
      catatan.push(
        "Perlu meningkatkan kelancaran membaca Al-Qur'an dengan latihan rutin"
      );
    } else if (kelancaran <= 85) {
      catatan.push(
        "Kelancaran membaca sudah cukup baik namun masih perlu lebih ditingkatkan"
      );
    }

    // JIKA BAGUS
    if (
      nilai >= 90 &&
      catatan.length === 0
    ) {
      catatan.push(
        "Kemampuan membaca Al-Qur'an dengan penerapan tajwid dan waqaf sudah sangat baik"
      );
    }

    catatan.push(
      "Diharapkan terus meningkatkan kualitas bacaan agar semakin tartil dan sesuai kaidah tajwid"
    );
  }

  // ========================================
  // FINAL
  // ========================================

  return (
    pembuka +
    catatan.join(". ") +
    ". Barakallahu fiik."
  );
}
