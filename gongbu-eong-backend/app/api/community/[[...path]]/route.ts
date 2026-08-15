import { NextRequest } from "next/server";
import {
  getCommunityActivity,
  getCommunityPost,
  getCommunityPosts,
  getCommunityReports,
  getCommunitySearchMeta,
  removeCommunityComment,
  removeCommunityPost,
  reportCommunityTarget,
  reviewCommunityReport,
  saveCommunityComment,
  saveCommunityPost,
  toggleCommunityPostReaction,
} from "@/domains/community/community.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path || [];
    const [first, second] = path;

    if (!first) {
      return jsonWithCors(request, await getCommunityPosts(request), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (first === "activity") {
      return jsonWithCors(request, await getCommunityActivity(request), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (first === "search-meta") {
      return jsonWithCors(request, await getCommunitySearchMeta(), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (first === "reports") {
      return jsonWithCors(request, await getCommunityReports(request), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (isUuid(first) && !second) {
      return jsonWithCors(request, await getCommunityPost(request, first), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    return jsonWithCors(request, { ok: false, message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path || [];
    const [first, second] = path;

    if (!first) {
      return jsonWithCors(request, await saveCommunityPost(request), { status: 201 });
    }

    if (isUuid(first) && second === "recommend") {
      return jsonWithCors(request, await toggleCommunityPostReaction(request, first, "recommend"));
    }

    if (isUuid(first) && second === "scrap") {
      return jsonWithCors(request, await toggleCommunityPostReaction(request, first, "scrap"));
    }

    if (isUuid(first) && second === "comments") {
      return jsonWithCors(request, await saveCommunityComment(request, first), { status: 201 });
    }

    if (isUuid(first) && second === "report") {
      return jsonWithCors(request, await reportCommunityTarget(request, "post", first));
    }

    if (first === "comments" && isUuid(second || "") && path[2] === "report") {
      return jsonWithCors(request, await reportCommunityTarget(request, "comment", second));
    }

    return jsonWithCors(request, { ok: false, message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path || [];
    const [first, second] = path;

    if (isUuid(path[0] || "") && !path[1]) {
      return jsonWithCors(request, await saveCommunityPost(request, path[0]));
    }

    if (first === "reports" && isUuid(second || "")) {
      return jsonWithCors(request, await reviewCommunityReport(request, second));
    }

    return jsonWithCors(request, { ok: false, message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path || [];
    const [first, second] = path;

    if (isUuid(first || "") && !second) {
      return jsonWithCors(request, await removeCommunityPost(request, first));
    }

    if (first === "comments" && isUuid(second || "")) {
      return jsonWithCors(request, await removeCommunityComment(request, second));
    }

    return jsonWithCors(request, { ok: false, message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return handleError(request, error);
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function handleError(request: NextRequest, error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const status =
    name === "UnauthorizedError"
      ? 401
      : name === "BadRequestError"
        ? 400
        : name === "NotFoundError"
          ? 404
          : 500;
  const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
  return jsonWithCors(request, { ok: false, message }, { status });
}
