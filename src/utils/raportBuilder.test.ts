import { describe, expect, it } from "vitest";
import { buildRaportData, loadRaportSettings } from "@/utils/raportBuilder";

describe("raportBuilder", () => {
  it("ignores old Tahfizh auto-fail metadata for legacy raport data", () => {
    const data = buildRaportData(
      {
        id: "ujian-1",
        mode: "Tahfizh",
        nilai_akhir: 94,
        status: "Tidak Lulus",
        grade: "D",
        assessed_by: "846588ce-5957-4f00-811f-f03121226abe",
        tanggal: "2026-04-10",
        nilai_aspek: {
          tahfizhMode: "Sertifikat",
          manualStopReason: "Batas maksimal kesalahan tercapai",
          autoFailConfig: { lahnJaliMax: 3, salahSambungMax: 15 },
          surahEntries: [
            {
              surah: "An-Naba",
              juz: 30,
              kelancaran: 100,
              lahn_jali: 3,
              lahn_khofi: 0,
              waqaf_ibtida: 0,
              salah_sambung_ayat: 0,
            },
          ],
        },
      },
      "Siswa",
      "Kelas 5D"
    );

    expect(data.nilaiAkhir).toBe(94);
    expect(data.status).toBe("Lulus");
    expect(data.predikat).not.toBe("Rosib");
    expect(data.className).toBe("V D");
  });

  it("forces the current headmaster name over saved old settings", () => {
    localStorage.setItem(
      "raport_settings_v3",
      JSON.stringify({ header: { headmaster: "Nama Lama" } })
    );

    expect(loadRaportSettings().header.headmaster).toBe("Amrullah Rozy Dalimunthe, S.Si");
  });
});
