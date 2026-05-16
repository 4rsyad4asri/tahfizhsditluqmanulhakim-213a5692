export type RaportMode =
  | "Tahfizh"
  | "Tahsin Dasar"
  | "Tahsin Lanjutan";

type GenerateCatatanParams = {
  mode: RaportMode;

  nilaiAkhir: number;
  namaSiswa?: string;

  // Tahsin Lanjutan
  lahnJali?: number;
  lahnKhofi?: number;
  waqaf?: number;

  // Tahsin Dasar
  harakat?: number;
  tajwid?: number;
  mad?: number;
  qalqalah?: number;

  // Umum
  kelancaran?: number;
};

export default function generateCatatanOtomatis({
  mode,
  nilaiAkhir,
  namaSiswa,

  lahnJali = 0,
  lahnKhofi = 0,
  waqaf = 0,

  harakat = 0,
  tajwid = 0,
  mad = 0,
  qalqalah = 0,

  kelancaran = 90,
}: GenerateCatatanParams): string {

  const nilai = Number(nilaiAkhir) || 0;
  const ananda = namaSiswa || "Ananda";

  let pembuka = "";
  const catatan: string[] = [];

  // ========================================
  // PEMBUKA BERDASARKAN NILAI
  // ========================================

  if (nilai >= 90) {
    pembuka =
      `${ananda} menunjukkan hasil yang sangat baik dalam pembelajaran Al-Qur'an.` ;
  } else if (nilai >= 80) {
    pembuka =
      `${ananda} memiliki kemampuan membaca Al-Qur'an yang baik dan terus berkembang.` ;
  } else if (nilai >= 70) {
    pembuka =
      `${ananda} telah berusaha dengan baik dalam pembelajaran Al-Qur'an.` ;
  } else {
    pembuka =
      `${ananda} masih memerlukan latihan dan pendampingan yang lebih rutin dalam membaca Al-Qur'an.` ;
  }

  // ========================================
  // TAHSIN DASAR
  // ========================================

  if (mode === "Tahsin Dasar") {

    const evaluasi: {
      aspek: string;
      skor: number;
      pesan: string;
    }[] = [];

    // HARAKAT
    if (harakat >= 2) {
      evaluasi.push({
        aspek: "harakat",
        skor: harakat,
        pesan:
          harakat >= 5
            ? "ketelitian dalam penerapan harakat masih perlu ditingkatkan"
            : "masih terdapat beberapa kekeliruan kecil dalam penerapan harakat",
      });
    }

    // TAJWID
    if (tajwid >= 2) {
      evaluasi.push({
        aspek: "tajwid",
        skor: tajwid,
        pesan:
          tajwid >= 6
            ? "pemahaman tajwid dasar dan penerapan hukum bacaan masih perlu diperbaiki"
            : "ketelitian dalam penerapan tajwid dasar masih perlu ditingkatkan",
      });
    }

    // MAD
    if (mad >= 2) {
      evaluasi.push({
        aspek: "mad",
        skor: mad,
        pesan:
          "ketepatan panjang pendek bacaan (mad) masih perlu diperhatikan",
      });
    }

    // QALQALAH
    if (qalqalah >= 2) {
      evaluasi.push({
        aspek: "qalqalah",
        skor: qalqalah,
        pesan:
          "ketepatan bacaan qalqalah pada beberapa huruf masih perlu diperbaiki",
      });
    }

    // KELANCARAN
    if (kelancaran <= 85) {
      evaluasi.push({
        aspek: "kelancaran",
        skor: 100 - kelancaran,
        pesan:
          kelancaran <= 75
            ? "kelancaran membaca masih perlu banyak latihan dan pembiasaan membaca tartil"
            : "kelancaran membaca sudah cukup baik namun masih perlu ditingkatkan",
      });
    }

    // SORT DOMINAN
    evaluasi.sort((a, b) => b.skor - a.skor);

    // AMBIL 3 TERATAS
    const utama = evaluasi.slice(0, 3);

    // GABUNGKAN
    if (utama.length > 0) {
      catatan.push(
        utama.map((e) => e.pesan).join(", ")
      );
    }

    // JIKA SANGAT BAGUS
    if (nilai >= 90 && utama.length === 0) {
      catatan.push(
        "Kemampuan membaca dasar Al-Qur'an sudah sangat baik dan sesuai kaidah pembelajaran"
      );
    }

    // PENUTUP
    catatan.push(
      "Semoga terus semangat dalam belajar dan memperbaiki kualitas bacaan Al-Qur'an"
    );
  }

  // ========================================
  // TAHSIN LANJUTAN
  // ========================================

  if (mode === "Tahsin Lanjutan") {

    const evaluasi: {
      aspek: string;
      skor: number;
      pesan: string;
    }[] = [];
    // LAHN JALI
    if (lahnJali >= 2) {
      evaluasi.push({
        aspek: "makhraj",
        skor: lahnJali,
        pesan:
          lahnJali >= 5
            ? "ketepatan makhraj dan pengucapan huruf masih perlu diperbaiki"
            : "masih terdapat beberapa kesalahan kecil pada pengucapan huruf tertentu",
      });
    }

    // LAHN KHOFI
    if (lahnKhofi >= 4) {
      evaluasi.push({
        aspek: "tajwid",
        skor: lahnKhofi,
        pesan:
          lahnKhofi >= 8
            ? "penerapan hukum tajwid terutama mad dan sifat huruf masih perlu ditingkatkan"
            : "ketelitian dalam penerapan hukum tajwid masih perlu ditingkatkan",
      });
    }

    // WAQAF
    if (waqaf >= 3) {
      evaluasi.push({
        aspek: "waqaf",
        skor: waqaf,
        pesan:
          "pemahaman waqaf dan ibtida' masih perlu diperhatikan",
      });
    }

    // KELANCARAN
    if (kelancaran <= 85) {
      evaluasi.push({
        aspek: "kelancaran",
        skor: 100 - kelancaran,
        pesan:
          kelancaran <= 75
            ? "kelancaran membaca masih perlu banyak latihan dan pembiasaan membaca tartil"
            : "kelancaran membaca sudah cukup baik namun masih perlu ditingkatkan",
      });
    }

    // SORT DOMINAN
    evaluasi.sort((a, b) => b.skor - a.skor);

    // AMBIL 3 TERATAS
    const utama = evaluasi.slice(0, 3);

    // GABUNGKAN
    if (utama.length > 0) {
      catatan.push(
        utama.map((e) => e.pesan).join(", ")
      );
    }

    // JIKA SANGAT BAGUS
    if (nilai >= 90 && utama.length === 0) {
      catatan.push(
        "Kemampuan membaca Al-Qur'an dengan penerapan tajwid dan waqaf sudah sangat baik"
      );
    }

    // PENUTUP
    catatan.push(
      "Diharapkan terus meningkatkan kualitas bacaan agar semakin tartil dan sesuai kaidah tajwid"
    );
  }

  // ========================================
  // TAHFIZH
  // ========================================

  if (mode === "Tahfizh") {

    if (nilai >= 90) {
      catatan.push(
        "Hafalan Al-Qur'an sudah sangat baik dengan kelancaran dan ketepatan yang sangat memuaskan"
      );
    } else if (nilai >= 80) {
      catatan.push(
        "Hafalan sudah baik namun masih perlu meningkatkan kelancaran dan muroja'ah secara rutin"
      );
    } else if (nilai >= 70) {
      catatan.push(
        "Perlu meningkatkan kelancaran hafalan dan memperbanyak muroja'ah agar hafalan lebih kuat"
      );
    } else {
      catatan.push(
        "Perlu pendampingan dan latihan muroja'ah yang lebih rutin agar hafalan semakin baik"
      );
    }

    catatan.push(
      "Semoga Allah memudahkan dalam menjaga hafalan Al-Qur'an"
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