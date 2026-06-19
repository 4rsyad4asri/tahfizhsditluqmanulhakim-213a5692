import { describe, expect, it } from "vitest";
import {
  calculateTahfizhExamResult,
  calculateTahfizhSurahScore,
  getCertificateSequenceForJuz,
  normalizeTahfizhAssessment,
  normalizeTahfizhPayload,
  toLegacyTahfizhEntry,
} from "@/data/tahfizhSystem";

describe("Tahfizh scoring", () => {
  it("does not treat array indexes as fallback assessments", () => {
    const assessments = [
      { surah: "", juz: 30, kelancaran: 90 },
      { surah: "", juz: 30, kelancaran: 90 },
    ].map((entry) => normalizeTahfizhAssessment(entry));

    expect(assessments).toHaveLength(2);
    expect(assessments[1].surah).toBe("");
    expect(assessments[1].kelancaran).toBe(90);
  });

  it("uses kelancaran 90 for an empty stored value", () => {
    const assessment = normalizeTahfizhAssessment({
      surah: "An-Naba",
      juz: 30,
      kelancaran: "",
      lahn_jali: 0,
      lahn_khofi: 0,
      waqaf_ibtida: 0,
      salah_sambung_ayat: 0,
    });

    expect(assessment.kelancaran).toBe(90);
    expect(calculateTahfizhSurahScore(assessment)).toBe(90);
  });

  it("preserves an intentional numeric zero", () => {
    const assessment = normalizeTahfizhAssessment({
      surah: "An-Naba",
      juz: 30,
      kelancaran: 0,
    });

    expect(assessment.kelancaran).toBe(0);
    expect(calculateTahfizhSurahScore(assessment)).toBe(0);
  });

  it.each([
    { surah: "Al-Baqarah", juz: 1, manualStart: "25", manualEnd: "40", systemRange: "1-141" },
    { surah: "Al-Baqarah", juz: 2, manualStart: "180", manualEnd: "190", systemRange: "142-252" },
    { surah: "Adh-Dhariyat", juz: 27, manualStart: "35", manualEnd: "45", systemRange: "31-60" },
  ])(
    "prioritizes manually entered verses over the default range in Juz $juz",
    ({ surah, juz, manualStart, manualEnd, systemRange }) => {
      const assessment = normalizeTahfizhAssessment({
        surah,
        juz,
        ayat_awal: manualStart,
        ayat_akhir: manualEnd,
        ayat_range: systemRange,
        kelancaran: 90,
      });

      expect(assessment.ayatAwal).toBe(manualStart);
      expect(assessment.ayatAkhir).toBe(manualEnd);
      expect(assessment.ayatRange).toBeUndefined();
      expect(toLegacyTahfizhEntry(assessment)).toMatchObject({
        ayat_awal: manualStart,
        ayat_akhir: manualEnd,
        ayat_range: undefined,
      });
    }
  );

  it("keeps the system range when no manual verse is entered", () => {
    const assessment = normalizeTahfizhAssessment({
      surah: "Al-Baqarah",
      juz: 2,
      ayat_range: "142-252",
      kelancaran: 90,
    });

    expect(assessment.ayatRange).toBe("142-252");
  });

  it("uses 10 Al-Baqarah question ranges for Juz 1 certificate exams", () => {
    const sequence = getCertificateSequenceForJuz(1);

    expect(sequence).toHaveLength(10);
    expect(sequence.map((item) => item.surah)).toEqual(Array(10).fill("Al-Baqarah"));
    expect(sequence.map((item) => item.ayatAwal)).toEqual([
      1,
      17,
      30,
      49,
      62,
      77,
      89,
      102,
      113,
      127,
    ]);
    expect(sequence.map((item) => item.ayatAkhir)).toEqual([
      16,
      29,
      48,
      61,
      76,
      88,
      101,
      112,
      126,
      141,
    ]);
    expect(sequence.every((item) => item.ayatRange === undefined)).toBe(true);
  });

  it("leaves verse fields empty for other certificate juz rows so they stay editable", () => {
    const sequence = getCertificateSequenceForJuz(3);

    expect(sequence.map((item) => item.surah)).toEqual(["Al-Baqarah", "Ali 'Imran"]);
    expect(sequence.every((item) => item.ayatAwal === undefined)).toBe(true);
    expect(sequence.every((item) => item.ayatAkhir === undefined)).toBe(true);
    expect(sequence.every((item) => item.ayatRange === undefined)).toBe(true);
  });

  it("uses the current penalty formula with waqaf weight one", () => {
    const score = calculateTahfizhSurahScore(
      normalizeTahfizhAssessment({
        surah: "An-Naba",
        juz: 30,
        kelancaran: 90,
        lahn_jali: 1,
        lahn_khofi: 1,
        waqaf_ibtida: 1,
        salah_sambung_ayat: 1,
      })
    );

    expect(score).toBe(84);
  });

  it("averages per juz instead of weighting every surah equally", () => {
    const result = calculateTahfizhExamResult([
      normalizeTahfizhAssessment({ surah: "Al-Baqarah", juz: 1, kelancaran: 100 }),
      normalizeTahfizhAssessment({ surah: "Ali Imran", juz: 1, kelancaran: 100 }),
      normalizeTahfizhAssessment({ surah: "An-Naba", juz: 30, kelancaran: 60 }),
    ]);

    expect(result.summaries.map((summary) => summary.nilaiJuz)).toEqual([100, 60]);
    expect(result.nilaiAkhir).toBe(80);
  });

  it("keeps the calculated score when certificate status is failed", () => {
    const normalized = normalizeTahfizhPayload({
      entries: [
        {
          surah: "An-Naba",
          juz: 30,
          kelancaran: 90,
          lahn_jali: 1,
          lahn_khofi: 0,
          waqaf_ibtida: 0,
          salah_sambung_ayat: 0,
        },
      ],
      tahfizhMode: "Sertifikat",
      manualStopReason: "Dihentikan penguji",
    });

    expect(normalized.status).toBe("Tidak Lulus");
    expect(normalized.nilaiAkhir).toBe(88);
  });

  it("grades a legacy score of 94 normally when old auto-fail metadata is ignored", () => {
    const result = calculateTahfizhExamResult(
      [
        normalizeTahfizhAssessment({
          surah: "An-Naba",
          juz: 30,
          kelancaran: 100,
          lahn_jali: 3,
        }),
      ],
      "Sertifikat",
      undefined,
      "",
      true,
      { lahnJaliMax: 3, salahSambungMax: 15 }
    );

    expect(result.nilaiAkhir).toBe(94);
    expect(result.predikat).not.toBe("Rosib");
    expect(result.status).toBe("Lulus");
  });

  it("keeps old entry values when an edit sends empty numeric fields", () => {
    const normalized = normalizeTahfizhPayload({
      existingNilaiAspek: {
        tahfizhMode: "Reguler",
        surahEntries: [
          {
            surah: "An-Naba",
            juz: 30,
            kelancaran: 80,
            lahn_jali: 2,
            lahn_khofi: 1,
            waqaf_ibtida: 1,
            salah_sambung_ayat: 0,
          },
        ],
      },
      nilaiAspek: {
        surahEntries: [
          {
            surah: "An-Naba",
            juz: 30,
            kelancaran: "",
            lahn_jali: "",
            lahn_khofi: "",
            waqaf_ibtida: "",
            salah_sambung_ayat: "",
          },
        ],
      },
    });

    expect(normalized.assessments[0]).toMatchObject({
      kelancaran: 80,
      lahnJali: 2,
      lahnKhofi: 1,
      waqaf: 1,
      salahSambung: 0,
    });
    expect(normalized.nilaiAkhir).toBe(74);
  });
});
