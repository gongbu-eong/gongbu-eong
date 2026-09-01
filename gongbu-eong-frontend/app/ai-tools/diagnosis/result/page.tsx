import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisShareImageUrl,
} from "@/features/diagnosis/diagnosis-share";
import { buildSignedEventEntryUrl } from "@/shared/events/event-entry";

type DiagnosisResultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: DIAGNOSIS_SHARE_TITLE,
  description: DIAGNOSIS_SHARE_DESCRIPTION,
  openGraph: {
    title: DIAGNOSIS_SHARE_TITLE,
    description: DIAGNOSIS_SHARE_DESCRIPTION,
    images: [
      {
        url: getDiagnosisShareImageUrl(),
        width: 1200,
        height: 630,
        alt: "공부엉이 강점·성향 진단 결과",
      },
    ],
  },
};

export default async function DiagnosisResultPage({
  searchParams,
}: DiagnosisResultPageProps) {
  const params = await searchParams;
  const query = createQueryString(params);
  const nextPath = query
    ? `/events/diagnosis/result?${query}`
    : "/events/diagnosis/result";

  redirect(await buildSignedEventEntryUrl("1", nextPath));
}

function createQueryString(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  }

  return query.toString();
}
