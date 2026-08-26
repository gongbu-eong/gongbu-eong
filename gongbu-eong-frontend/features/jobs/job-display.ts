export function splitJobDisplayValue(value: string | null | undefined) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[,.\/·|]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function formatJobEmploymentLabel(value: string | null | undefined) {
  const values = splitJobDisplayValue(value);
  if (values.length <= 1) return values[0] || "";
  return `${values[0]} 외 ${values.length - 1}건`;
}

export function formatJobRegionLabel(value: string | null | undefined) {
  const values = splitJobDisplayValue(value);
  if (values.length <= 3) return values.join(" · ") || "";
  return `${values.slice(0, 3).join(" · ")} 외 ${values.length - 3}개`;
}
