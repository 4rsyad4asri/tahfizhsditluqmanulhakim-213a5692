```ts
export type RaportMode =
  | "Tahfizh"
  | "Tahsin Dasar"
  | "Tahsin Lanjutan";

export function generateCatatanOtomatis(
  mode: RaportMode,
  nilai: number,
  namaSiswa?: string
): string {

  const nilaiAkhir = Number(nilai) || 0;
  const ananda = namaSiswa || "Ananda";

  let pembuka = "";

  if (nilaiAkhir >= 90) {
    pembuka =
      `${ananda} menunjukkan hasil yang sangat Mumtaz dengan penguasaan materi yang sangat baik. `;
  } else if (nilaiAkhir >= 85) {
    pembuka =
      `${ananda} menunjukkan hasil yang baik dan memiliki kemampuan yang sudah berkembang dengan sangat baik. `;
  } else if (nilaiAkhir >= 76) {
    pembuka =
      `${ananda} memiliki kemampuan yang cukup baik, namun masih terdapat beberapa aspek yang perlu ditingkatkan. `;
  } else if (nilaiAkhir >= 70) {
    pembuka =
      `${ananda} telah berusaha dengan baik, namun masih memerlukan latihan dan pembinaan yang lebih intensif. `;
  } else {
    pembuka =
      `${ananda} masih memerlukan bimbingan dan latihan yang lebih rutin agar kemampuan membaca dan hafalan Al-Qur'an dapat meningkat dengan baik. `;
  }

  // =========================
  // TAHSIN DASAR
  // =========================

  if (mode === "Tahsin Dasar") {

    if (nilaiAkhir >= 90) {
      return (
        pembuka +
        "Kemampuan membaca dasar Al-Qur'an, pengenalan huruf hijaiyah, harakat, serta tajwid dasar sudah sangat baik. Semoga terus istiqamah dalam belajar Al-Qur'an. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 85) {
      return (
        pembuka +
        "Kemampuan membaca dasar Al-Qur'an sudah baik, namun tetap perlu meningkatkan ketelitian dalam penerapan harakat dan tajwid dasar. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 76) {
      return (
        pembuka +
        "Masih perlu meningkatkan kelancaran membaca dan ketepatan dalam mengenali harakat serta hukum bacaan dasar. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 70) {
      return (
        pembuka +
        "Perlu latihan yang lebih rutin dalam membaca Al-Qur'an agar kemampuan membaca dasar semakin berkembang dan lebih tartil. Barakallahu fiikum."
      );
    }

    return (
      pembuka +
      "Diperlukan pendampingan dan pembiasaan membaca Al-Qur'an secara rutin agar kemampuan dasar membaca semakin baik. Barakallahu fiikum."
    );
  }

  // =========================
  // TAHSIN LANJUTAN
  // =========================

  if (mode === "Tahsin Lanjutan") {

    if (nilaiAkhir >= 90) {
      return (
        pembuka +
        "Penerapan tajwid, makhraj, waqaf ibtida’, dan kelancaran membaca sudah sangat baik. Semoga terus menjaga kualitas bacaan Al-Qur'an. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 85) {
      return (
        pembuka +
        "Kemampuan membaca Al-Qur'an sudah baik, namun masih perlu meningkatkan ketelitian pada beberapa hukum tajwid dan waqaf. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 76) {
      return (
        pembuka +
        "Masih perlu meningkatkan kualitas bacaan terutama pada aspek tajwid, makhraj, dan kelancaran membaca. Barakallahu fiikum."
      );
    }

    if (nilaiAkhir >= 70) {
      return (
        pembuka +
        "Perlu latihan yang lebih rutin agar kemampuan membaca Al-Qur'an semakin baik, lancar, dan sesuai kaidah tajwid. Barakallahu fiikum."
      );
    }

    return (
      pembuka +
      "Diperlukan pembinaan yang lebih intensif dalam aspek tajwid, makhraj, dan kelancaran membaca Al-Qur'an. Barakallahu fiikum."
    );
  }

  // =========================
  // TAHFIZH
  // =========================

  if (nilaiAkhir >= 90) {
    return (
      pembuka +
      "Hafalan Al-Qur'an sangat baik dengan kelancaran, ketepatan tajwid, dan sambungan ayat yang sangat bagus. Semoga senantiasa menjaga hafalan Al-Qur'an dengan istiqamah. Barakallahu fiikum."
    );
  }

  if (nilaiAkhir >= 85) {
    return (
      pembuka +
      "Hafalan Al-Qur'an sudah baik, namun masih perlu meningkatkan muroja’ah dan ketelitian pada beberapa bagian ayat. Barakallahu fiikum."
    );
  }

  if (nilaiAkhir >= 76) {
    return (
      pembuka +
      "Masih perlu meningkatkan kekuatan hafalan, kelancaran muroja’ah, dan ketepatan sambungan ayat. Barakallahu fiikum."
    );
  }

  if (nilaiAkhir >= 70) {
    return (
      pembuka +
      "Perlu meningkatkan intensitas muroja’ah agar hafalan lebih kuat, lancar, dan tidak mudah lupa. Barakallahu fiikum."
    );
  }

  return (
    pembuka +
    "Diperlukan pembiasaan muroja’ah dan pendampingan yang lebih intensif agar kualitas hafalan semakin meningkat. Barakallahu fiikum."
  );
}
```
