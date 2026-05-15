```ts
export type RaportMode =
  | "Tahfizh"
  | "Tahsin Dasar"
  | "Tahsin Lanjutan";

type GenerateParams = {
  mode: RaportMode;
  nilaiAkhir: number;
  namaSiswa?: string;

  lahnJali?: number;
  lahnKhofi?: number;

  waqaf?: number;
  sambungAyat?: number;

  kelancaran?: number;
};

export function generateCatatanSmart({
  mode,
  nilaiAkhir,
  namaSiswa,
  lahnJali = 0,
  lahnKhofi = 0,
  waqaf = 0,
  sambungAyat = 0,
  kelancaran = 100,
}: GenerateParams): string {

  const ananda = namaSiswa || "Ananda";

  // =========================
  // OPENING BERDASARKAN NILAI
  // =========================

  let opening = "";

  if (nilaiAkhir >= 90) {
    opening =
      `${ananda} menunjukkan capaian yang sangat ممتاز dalam pelaksanaan ujian dengan penguasaan materi yang sangat baik.`;
  } else if (nilaiAkhir >= 85) {
    opening =
      `${ananda} menunjukkan kemampuan yang baik dalam pelaksanaan ujian dengan penguasaan materi yang baik dan stabil.`;
  } else if (nilaiAkhir >= 76) {
    opening =
      `${ananda} telah menunjukkan kemampuan yang cukup baik dalam pelaksanaan ujian meskipun masih terdapat beberapa bagian yang perlu ditingkatkan.`;
  } else if (nilaiAkhir >= 70) {
    opening =
      `${ananda} telah berusaha dengan baik dalam mengikuti ujian, namun masih memerlukan peningkatan pada beberapa aspek penilaian.`;
  } else {
    opening =
      `${ananda} masih memerlukan pembinaan dan latihan yang lebih intensif agar kemampuan bacaan dan hafalan dapat berkembang dengan lebih baik.`;
  }

  // =========================
  // CARI KESALAHAN DOMINAN
  // =========================

  const errors = [
    { key: "lajhn_jali", value: lahnJali },
    { key: "lahn_khofi", value: lahnKhofi },
    { key: "waqaf", value: waqaf },
    { key: "sambung", value: sambungAyat },
  ];

  errors.sort((a, b) => b.value - a.value);

  const dominan = errors[0]?.key;

  // =========================
  // KOMENTAR FOKUS
  // =========================

  let fokus = "";

  if (mode === "Tahsin Dasar") {

    if (lahnJali >= 3) {
      fokus =
        "Masih diperlukan peningkatan dalam ketepatan pengucapan huruf hijaiyah dan makhraj agar bacaan semakin baik dan benar.";
    } else if (lahnKhofi >= 3) {
      fokus =
        "Masih diperlukan peningkatan dalam penerapan tajwid dasar dan panjang pendek bacaan agar bacaan lebih tartil.";
    } else if (kelancaran <= 70) {
      fokus =
        "Kelancaran membaca masih perlu terus dilatih agar bacaan lebih percaya diri dan tidak terbata-bata.";
    } else {
      fokus =
        "Kemampuan membaca dasar Al-Qur'an sudah berkembang dengan baik dan perlu terus dipertahankan.";
    }

  } else if (mode === "Tahsin Lanjutan") {

    if (dominan === "lajhn_jali") {
      fokus =
        "Perlu meningkatkan ketelitian dalam pengucapan makhraj huruf agar kualitas bacaan semakin sempurna.";
    } else if (dominan === "lahn_khofi") {
      fokus =
        "Masih diperlukan peningkatan dalam penerapan hukum tajwid, ghunnah, dan panjang pendek bacaan.";
    } else if (dominan === "waqaf") {
      fokus =
        "Pemahaman waqaf dan ibtida masih perlu ditingkatkan agar bacaan lebih baik dan sesuai kaidah.";
    } else if (kelancaran <= 70) {
      fokus =
        "Kelancaran membaca masih perlu terus dilatih agar bacaan lebih stabil dan tartil.";
    } else {
      fokus =
        "Kualitas bacaan Al-Qur'an sudah baik dan perlu terus dijaga konsistensinya.";
    }

  } else {

    // =========================
    // TAHFIZH
    // =========================

    if (dominan === "sambung") {
      fokus =
        "Muroja'ah dan ketelitian dalam menyambung ayat masih perlu ditingkatkan agar hafalan lebih kuat dan stabil.";
    } else if (dominan === "lahn_khofi") {
      fokus =
        "Masih diperlukan peningkatan dalam penerapan tajwid dan ketelitian bacaan saat menyetorkan hafalan.";
    } else if (dominan === "lajhn_jali") {
      fokus =
        "Ketepatan makhraj dan pelafalan huruf masih perlu diperhatikan agar kualitas hafalan semakin baik.";
    } else if (dominan === "waqaf") {
      fokus =
        "Pemahaman waqaf dan ibtida masih perlu diperkuat agar penyampaian hafalan lebih sempurna.";
    } else if (kelancaran <= 70) {
      fokus =
        "Kelancaran hafalan masih perlu ditingkatkan melalui muroja'ah yang lebih rutin dan terjadwal.";
    } else {
      fokus =
        "Hafalan yang dimiliki sudah baik dan diharapkan terus dijaga dengan muroja'ah yang konsisten.";
    }
  }

  // =========================
  // PENUTUP
  // =========================

  let penutup = "";

  if (nilaiAkhir >= 85) {
    penutup =
      "Semoga Ananda senantiasa istiqamah dalam belajar dan terus meningkatkan kualitas bacaan serta hafalan Al-Qur'an.";
  } else {
    penutup =
      "Diharapkan Ananda terus semangat berlatih dan meningkatkan kualitas bacaan maupun hafalan Al-Qur'an.";
  }

  return `${opening} ${fokus} ${penutup}`;
}
```
