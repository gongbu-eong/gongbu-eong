import { NextRequest } from "next/server";
import { startOAuth } from "@/domains/auth/oauth";

export function GET(request: NextRequest) {
  return startOAuth("kakao", request);
}
