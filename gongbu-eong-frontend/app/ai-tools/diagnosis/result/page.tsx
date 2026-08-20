import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { DiagnosisResultDetail } from "@/features/diagnosis/components/DiagnosisResultDetail";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_IMAGE_HEIGHT,
  DIAGNOSIS_SHARE_IMAGE_WIDTH,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisResultShareUrl,
  getDiagnosisShareImageUrl,
} from "@/features/diagnosis/diagnosis-share";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ resultId?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : undefined;
  const url = getDiagnosisResultShareUrl(params.resultId, requestOrigin);
  const imageUrl = getDiagnosisShareImageUrl(requestOrigin);

  return {
    title: DIAGNOSIS_SHARE_TITLE,
    description: DIAGNOSIS_SHARE_DESCRIPTION,
    openGraph: {
      title: DIAGNOSIS_SHARE_TITLE,
      description: DIAGNOSIS_SHARE_DESCRIPTION,
      url,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: DIAGNOSIS_SHARE_IMAGE_WIDTH,
          height: DIAGNOSIS_SHARE_IMAGE_HEIGHT,
          alt: DIAGNOSIS_SHARE_TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DIAGNOSIS_SHARE_TITLE,
      description: DIAGNOSIS_SHARE_DESCRIPTION,
      images: [imageUrl],
    },
  };
}

export default function DiagnosisResultPage() {
  return (
    <Suspense fallback={null}>
      <DiagnosisResultDetail />
    </Suspense>
  );
}
