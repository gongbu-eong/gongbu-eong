export function normalizePhoneNumber(value: unknown): string | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  if (
    typeof value !== "string" || value.length > 30 ||
    !/^(?:\+82[\s-]?)?[0-9\s-]+$/.test(value.trim())
  ) {
    throw invalidPhone();
  }
  const raw = value.trim().replace(/[\s-]/g, "");
  const digits = raw.startsWith("+82") ? `0${raw.slice(3).replace(/^0/, "")}` : raw;
  if (!/^01[016789]\d{7,8}$/.test(digits)) throw invalidPhone();
  const middleEnd = digits.length - 4;
  return `${digits.slice(0, 3)}-${digits.slice(3, middleEnd)}-${digits.slice(middleEnd)}`;
}

export function readOAuthPhoneNumber(value: unknown): string | undefined {
  try {
    return normalizePhoneNumber(value) || undefined;
  } catch {
    return undefined;
  }
}

function invalidPhone() {
  const error = new Error("휴대폰번호 형식이 올바르지 않습니다.");
  error.name = "BadRequestError";
  return error;
}
