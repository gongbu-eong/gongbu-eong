export type ProfileGender = "female" | "male";
export type ProfileAgeGroup =
  | "0-9" | "10-19" | "20-29" | "30-39" | "40-49"
  | "50-59" | "60-69" | "70-79" | "80-89" | "90+"
  | "over_40";

export function normalizeProfileGender(value: unknown): ProfileGender | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "m":
    case "male": return "male";
    case "f":
    case "female": return "female";
    default: return null;
  }
}

export function normalizeProfileAgeGroup(value: unknown): ProfileAgeGroup | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  switch (normalized) {
    case "teens": return "10-19";
    case "early_20s":
    case "late_20s": return "20-29";
    case "early_30s":
    case "late_30s": return "30-39";
    // The legacy bucket does not distinguish 40s from older ages.
    case "over_40": return "over_40";
    case "90~":
    case "90-":
    case "90+": return "90+";
  }

  const range = /^(\d{1,2})\s*[-~]\s*(\d{1,2})$/.exec(normalized);
  if (!range) return null;
  const lower = Number(range[1]);
  const upper = Number(range[2]);
  const decade = Math.floor(lower / 10) * 10;
  if (upper < lower || Math.floor(upper / 10) * 10 !== decade) return null;
  if (decade === 90) return "90+";
  return `${decade}-${decade + 9}` as ProfileAgeGroup;
}
