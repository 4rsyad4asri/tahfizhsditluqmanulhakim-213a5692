import { describe, expect, it } from "vitest";
import { formatClassName } from "@/utils/className";

describe("formatClassName", () => {
  it("formats numeric class names as roman grade plus section", () => {
    expect(formatClassName("Kelas 5D")).toBe("V D");
    expect(formatClassName("5d")).toBe("V D");
    expect(formatClassName({ grade: 6, section: "a", name: "Kelas 6A" })).toBe("VI A");
  });

  it("leaves unknown formats readable", () => {
    expect(formatClassName("Unknown")).toBe("Unknown");
  });
});
