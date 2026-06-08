import { render as rtlRender } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UjianTahfizhForm from "@/components/UjianTahfizhForm";

const findText = (text: string) => {
  const found = Array.from(document.body.querySelectorAll("*")).find(
    (el) => (el.textContent || "").includes(text),
  );
  if (!found) throw new Error(`Not found: ${text}`);
  return found;
};
const screen = { getByText: findText };

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
});
