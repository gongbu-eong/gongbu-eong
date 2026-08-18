import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { extractResumeWithOpenAI } from "@/domains/resumes/resumes.ai";
import type { ResumePayloadDto } from "@/domains/resumes/resumes.dto";
import { createPendingResumeFile, validateResumeFile } from "@/domains/resumes/resume-file-storage";
import {
  completeResumeParseJob,
  createResumeParseJob,
  failResumeParseJob,
  markResumeParseJobProcessing,
} from "@/domains/resumes/resumes.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonWithCors(request, { ok: false, message: "첨부 파일이 필요합니다." }, { status: 400 });
    }

    const validationError = validateResumeFile(file);
    if (validationError) {
      return jsonWithCors(
        request,
        { ok: false, message: validationError },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const savedFile = await createPendingResumeFile(user.id, file);
    const parseJob = await createResumeParseJob(user.id, savedFile.id);
    await markResumeParseJobProcessing(user.id, parseJob.id);

    let extracted: Partial<ResumePayloadDto> = {};
    let completedJob = parseJob;
    try {
      extracted = await extractResumeWithOpenAI({ file, buffer });
      completedJob =
        (await completeResumeParseJob(user.id, parseJob.id, {
          ...extracted,
          sourceType: "upload",
          fileId: savedFile.id,
        })) || parseJob;
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "이력서 분석 중 오류가 발생했습니다.";
      completedJob = (await failResumeParseJob(user.id, parseJob.id, message)) || parseJob;
      throw parseError;
    }

    return jsonWithCors(request, {
      ok: true,
      storageWarning: null,
      file: savedFile,
      job: completedJob,
      extracted: {
        title: "",
        sourceType: "upload",
        fileId: savedFile.id,
        name: extracted.name || "",
        birthYear: extracted.birthYear || "",
        birthDate: extracted.birthDate || "",
        email: extracted.email || "",
        desiredJob: extracted.desiredJob || "",
        highestEducation: extracted.highestEducation || "",
        gpa: extracted.gpa || "",
        gpaScore: extracted.gpaScore || "",
        gpaMax: extracted.gpaMax || "",
        schoolMajor: extracted.schoolMajor || "",
        graduationStatus: extracted.graduationStatus || "",
        educationStartDate: extracted.educationStartDate || "",
        educationEndDate: extracted.educationEndDate || "",
        educationSummary: extracted.educationSummary || "",
        careerSummary: extracted.careerSummary || "",
        certificationSummary: extracted.certificationSummary || "",
        additionalNotes: extracted.additionalNotes || "",
        educations: extracted.educations || [],
        experiences: extracted.experiences || [],
        certifications: extracted.certifications || [],
        awards: extracted.awards || [],
        activities: extracted.activities || [],
        languages: extracted.languages || [],
        extractedPayload: extracted.extractedPayload || extracted,
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    const message = error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다.";
    return jsonWithCors(request, { ok: false, message }, { status });
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
