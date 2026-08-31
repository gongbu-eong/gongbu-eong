import { NextRequest, NextResponse } from "next/server";
import {
  createEventEntryRedirect,
  EventError,
} from "@/domains/events/events.service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    eventNo: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { eventNo } = await context.params;

  try {
    const redirectUrl = await createEventEntryRedirect({
      request,
      eventNo,
      nextPath: request.nextUrl.searchParams.get("next"),
      launchToken: request.nextUrl.searchParams.get("launchToken"),
      sourcePath:
        request.nextUrl.searchParams.get("source") ||
        request.headers.get("referer"),
    });

    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    const mainUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.GONGBUEONG_MAIN_URL ||
      "http://localhost:3000";
    const fallbackUrl = new URL("/", mainUrl);
    fallbackUrl.searchParams.set(
      "eventError",
      error instanceof EventError ? error.code : "unavailable",
    );

    console.error("Failed to create event entry ticket", error);

    return NextResponse.redirect(fallbackUrl, 302);
  }
}
