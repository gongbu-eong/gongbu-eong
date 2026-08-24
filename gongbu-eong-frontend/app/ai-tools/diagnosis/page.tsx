import type { Metadata } from "next";
import { headers } from "next/headers";
import { DiagnosisFlow } from "@/features/diagnosis/components/DiagnosisFlow";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_IMAGE_HEIGHT,
  DIAGNOSIS_SHARE_IMAGE_WIDTH,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisIntroShareUrl,
  getDiagnosisShareImageUrl,
} from "@/features/diagnosis/diagnosis-share";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : undefined;
  const url = getDiagnosisIntroShareUrl(requestOrigin);
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

export default function DiagnosisPage() {
  return <DiagnosisFlow />;
}
