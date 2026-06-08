const ROMAN_GRADES: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
};

export interface ClassNameParts {
  grade?: number | string | null;
  section?: string | null;
  name?: string | null;
}

function toRomanGrade(value?: number | string | null) {
  const grade = Number(value);
  return ROMAN_GRADES[grade] || (value ? String(value).trim() : "");
}

export function formatClassName(value?: string | ClassNameParts | null) {
  if (!value) return "";

  if (typeof value === "object") {
    const grade = toRomanGrade(value.grade);
    const section = (value.section || "").trim().toUpperCase();
    if (grade && section) return `${grade} ${section}`;
    if (grade) return grade;
    if (section) return section;
    return formatClassName(value.name || "");
  }

  const raw = value.trim();
  const match = raw.match(/^(?:kelas\s*)?([1-6])\s*([A-Za-z])$/i);
  if (!match) return raw.replace(/^kelas\s+/i, "").trim();

  return `${toRomanGrade(match[1])} ${match[2].toUpperCase()}`;
}
