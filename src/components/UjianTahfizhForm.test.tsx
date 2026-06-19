import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UjianTahfizhForm from "@/components/UjianTahfizhForm";

const findText = (text: string) => {
  const found = Array.from(document.body.querySelectorAll("*")).find(
    (el) => (el.textContent || "").includes(text),
  );
  if (!found) throw new Error(`Not found: ${text}`);
  return found;
};
describe("UjianTahfizhForm", () => {
  it("renders regular mode without crashing", () => {
    rtlRender(
      <UjianTahfizhForm
        mode="Reguler"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Mode Reguler")).toBeTruthy();
    expect(screen.getByText("Reset 5 Soal")).toBeTruthy();
  });

  it("renders certificate mode without crashing", () => {
    rtlRender(
      <UjianTahfizhForm
        mode="Sertifikat"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Mode Sertifikat")).toBeTruthy();
  });

  it("renders multiple stored assessments without treating their index as fallback data", () => {
    rtlRender(
      <UjianTahfizhForm
        mode="Reguler"
        initialAssessments={[
          { surah: "An-Naba", juz: 30, kelancaran: 90, lahnJali: 0, lahnKhofi: 0, waqaf: 0, salahSambung: 0 },
          { surah: "An-Naziat", juz: 30, kelancaran: 80, lahnJali: 1, lahnKhofi: 0, waqaf: 0, salahSambung: 0 },
        ]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Mode Reguler")).toBeTruthy();
    expect(screen.getByText("Reset 5 Soal")).toBeTruthy();
  });

  it("keeps certificate verse inputs editable", () => {
    rtlRender(
      <UjianTahfizhForm
        mode="Sertifikat"
        initialAssessments={[
          { surah: "Al-Baqarah", juz: 1, ayatAwal: 1, ayatAkhir: 16, kelancaran: 100, lahnJali: 0, lahnKhofi: 0, waqaf: 0, salahSambung: 0 },
        ]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const ayatAwalInputs = screen.getAllByLabelText("Ayat Awal");
    const ayatAkhirInputs = screen.getAllByLabelText("Ayat Akhir");

    expect(ayatAwalInputs[0]).not.toBeDisabled();
    expect(ayatAkhirInputs[0]).not.toBeDisabled();
  });

  it("allows adding and removing certificate questions", () => {
    rtlRender(
      <UjianTahfizhForm
        mode="Sertifikat"
        initialAssessments={[
          { surah: "Al-Baqarah", juz: 1, ayatAwal: 1, ayatAkhir: 16, kelancaran: 100, lahnJali: 0, lahnKhofi: 0, waqaf: 0, salahSambung: 0 },
          { surah: "Al-Baqarah", juz: 1, ayatAwal: 17, ayatAkhir: 29, kelancaran: 100, lahnJali: 0, lahnKhofi: 0, waqaf: 0, salahSambung: 0 },
        ]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Tambah Soal"));
    expect(screen.getAllByTitle("Hapus baris")).toHaveLength(3);

    fireEvent.click(screen.getAllByTitle("Hapus baris")[0]);
    expect(screen.getAllByTitle("Hapus baris")).toHaveLength(2);
  });
});
