import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDiagnosisShareImageUrl } from "@/features/diagnosis/diagnosis-share";
import { buildSignedEventEntryUrl } from "@/shared/events/event-entry";

type DiagnosisPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "강점·성향 진단 | 공부엉이",
  description: "20문항으로 나의 강점과 취업 성향을 확인해 보세요.",
  openGraph: {
    title: "강점·성향 진단 | 공부엉이",
    description: "20문항으로 나의 강점과 취업 성향을 확인해 보세요.",
    images: [
      {
        url: getDiagnosisShareImageUrl(),
        width: 1200,
        height: 630,
        alt: "공부엉이 강점·성향 진단",
      },
    ],
  },
};

export default async function DiagnosisPage({ searchParams }: DiagnosisPageProps) {
  const params = await searchParams;
  const query = createQueryString(params);
  const nextPath = query ? `/events/diagnosis?${query}` : "/events/diagnosis";

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
