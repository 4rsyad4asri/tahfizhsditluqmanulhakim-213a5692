import { describe, expect, it } from "vitest";
import { formatStudentName } from "./formatName";

describe("formatStudentName", () => {
  it.each([
    ["AHMAD ZAIDAN", "Ahmad Zaidan"],
    ["ahmad zaidan", "Ahmad Zaidan"],
    ["aHmAd zAiDaN", "Ahmad Zaidan"],
    ["MUHAMMAD FAWWAZ AR-RASYID", "Muhammad Fawwaz Ar-Rasyid"],
    ["  AHMAD   ZAIDAN  ", "Ahmad Zaidan"],
  ])("formats %j", (input, expected) => {
    expect(formatStudentName(input)).toBe(expected);
  });
});
