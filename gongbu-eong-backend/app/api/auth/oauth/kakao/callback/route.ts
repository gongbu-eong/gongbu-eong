import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/domains/auth/oauth";

export async function GET(request: NextRequest) {
  return handleOAuthCallback("kakao", request);
}
