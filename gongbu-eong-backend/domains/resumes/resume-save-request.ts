import { NextRequest } from "next/server";
import type { ResumePayloadDto } from "./resumes.dto";
import { uploadResumeFileOnSave, validateResumeFile } from "./resume-file-storage";

export class ResumeRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResumeRequestError";
    this.status = status;
  }
}

export async function readResumeSaveRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");

    if (typeof rawPayload !== "string") {
      throw new ResumeRequestError(400, "이력서 저장 payload가 없습니다.");
    }

    let payload: ResumePayloadDto;
    try {
      payload = JSON.parse(rawPayload) as ResumePayloadDto;
    } catch {
      throw new ResumeRequestError(400, "이력서 저장 payload 형식이 올바르지 않습니다.");
    }

    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    return { payload, file };
  }

  return {
    payload: (await request.json()) as ResumePayloadDto,
    file: null,
  };
}

export async function attachResumeFileOnSave(
  userId: string,
  payload: ResumePayloadDto,
  file: File | null,
) {
  if (!file) {
    return payload;
  }

  const validationError = validateResumeFile(file);
  if (validationError) {
    throw new ResumeRequestError(400, validationError);
  }

  const savedFile = await uploadResumeFileOnSave({
    userId,
    file,
    existingFileId: payload.fileId,
  });

  return {
    ...payload,
    sourceType: "upload" as const,
    fileId: savedFile.id,
  };
}

export function getResumeRequestErrorStatus(error: unknown) {
  return error instanceof ResumeRequestError ? error.status : null;
}
