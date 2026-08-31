export const DIAGNOSIS_SHARE_TITLE = "공기업 합격의 시작, 공부엉이";
export const DIAGNOSIS_SHARE_DESCRIPTION =
  "강점·성향 진단부터 AI 자소서 코칭까지 공부엉이에서 준비해 보세요.";
export const DIAGNOSIS_SHARE_IMAGE_WIDTH = 800;
export const DIAGNOSIS_SHARE_IMAGE_HEIGHT = 400;

const DEFAULT_SHARE_IMAGE_PATH = "/diagnosis-share-banner.png?v=20260820";

export function getPublicBaseUrl(runtimeOrigin?: string) {
  const configuredShareOrigin = process.env.NEXT_PUBLIC_SHARE_BASE_URL?.trim();
  const configuredOrigin = (
    process.env.NEXT_PUBLIC_MAIN_APP_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL
  )?.trim();
  const configured = configuredOrigin ? configuredOrigin.replace(/\/$/, "") : "";
  const configuredShare = configuredShareOrigin ? configuredShareOrigin.replace(/\/$/, "") : "";
  const runtime = runtimeOrigin ? runtimeOrigin.replace(/\/$/, "") : "";

  if (configuredShare) return configuredShare;
  if (configured && !isLocalOrigin(configured)) return configured;
  if (runtime && !isLocalOrigin(runtime)) return runtime;
  return configured || runtime || "http://localhost:3000";
}

export function getDiagnosisShareImageUrl(origin = getPublicBaseUrl()) {
  const configuredImageUrl = process.env.NEXT_PUBLIC_DIAGNOSIS_SHARE_IMAGE_URL?.trim();
  const publicOrigin = getPublicBaseUrl(origin);

  if (configuredImageUrl) {
    return toAbsoluteUrl(configuredImageUrl, publicOrigin);
  }

  return toAbsoluteUrl(DEFAULT_SHARE_IMAGE_PATH, publicOrigin);
}

export function getDiagnosisResultShareUrl(resultId?: string, origin = getPublicBaseUrl()) {
  const url = new URL("/ai-tools/diagnosis/result", getPublicBaseUrl(origin));
  if (resultId) url.searchParams.set("resultId", resultId);
  return url.toString();
}

export function getDiagnosisIntroShareUrl(origin = getPublicBaseUrl()) {
  return new URL("/ai-tools/diagnosis", getPublicBaseUrl(origin)).toString();
}

function toAbsoluteUrl(value: string, origin: string) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return new URL(DEFAULT_SHARE_IMAGE_PATH, getPublicBaseUrl()).toString();
  }
}

function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}
