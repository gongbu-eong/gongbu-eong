import { NextRequest } from "next/server";
import type { ResumeEntryDto, ResumePayloadDto } from "./resumes.dto";
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
    return { payload: normalizeResumeSavePayload(payload), file };
  }

  return {
    payload: normalizeResumeSavePayload((await request.json()) as ResumePayloadDto),
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

function normalizeResumeSavePayload(payload: ResumePayloadDto): ResumePayloadDto {
  return {
    ...payload,
    title: normalizeString(payload.title),
    sourceType: payload.sourceType === "upload" ? "upload" : "manual",
    fileId: normalizeNullableString(payload.fileId),
    name: normalizeNullableString(payload.name),
    birthYear: normalizeNullableString(payload.birthYear),
    birthDate: normalizeNullableString(payload.birthDate),
    email: normalizeNullableString(payload.email),
    desiredJob: normalizeNullableString(payload.desiredJob),
    highestEducation: normalizeNullableString(payload.highestEducation),
    gpa: normalizeNullableString(payload.gpa),
    gpaScore: normalizeNullableString(payload.gpaScore),
    gpaMax: normalizeNullableString(payload.gpaMax),
    schoolMajor: normalizeNullableString(payload.schoolMajor),
    graduationStatus: normalizeNullableString(payload.graduationStatus),
    educationStartDate: normalizeNullableString(payload.educationStartDate),
    educationEndDate: normalizeNullableString(payload.educationEndDate),
    educationSummary: normalizeNullableString(payload.educationSummary),
    careerSummary: normalizeNullableString(payload.careerSummary),
    certificationSummary: normalizeNullableString(payload.certificationSummary),
    additionalNotes: normalizeNullableString(payload.additionalNotes),
    educations: normalizeEntries(payload.educations),
    experiences: normalizeEntries(payload.experiences),
    certifications: normalizeEntries(payload.certifications),
    awards: normalizeEntries(payload.awards),
    activities: normalizeEntries(payload.activities),
    languages: normalizeEntries(payload.languages),
  };
}

function normalizeEntries(value: unknown): ResumeEntryDto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => Object.values(entry).some(Boolean));
}

function normalizeEntry(value: unknown): ResumeEntryDto {
  const entry = value && typeof value === "object" && !Array.isArray(value) ? value as ResumeEntryDto : {};
  return {
    id: normalizeString(entry.id),
    title: normalizeString(entry.title),
    certificationName: normalizeString(entry.certificationName),
    issuer: normalizeString(entry.issuer),
    subtitle: normalizeString(entry.subtitle),
    startDate: normalizeString(entry.startDate),
    endDate: normalizeString(entry.endDate),
    schoolName: normalizeString(entry.schoolName),
    degree: normalizeString(entry.degree),
    major: normalizeString(entry.major),
    gpaScore: normalizeString(entry.gpaScore),
    gpaMax: normalizeString(entry.gpaMax),
    graduationStatus: normalizeString(entry.graduationStatus),
    companyName: normalizeString(entry.companyName),
    position: normalizeString(entry.position),
    duties: normalizeString(entry.duties),
    contestName: normalizeString(entry.contestName),
    awardName: normalizeString(entry.awardName),
    awardedDate: normalizeString(entry.awardedDate),
    activityName: normalizeString(entry.activityName),
    description: normalizeString(entry.description),
    activityDate: normalizeString(entry.activityDate),
    language: normalizeString(entry.language),
    testName: normalizeString(entry.testName),
    levelOrScore: normalizeString(entry.levelOrScore),
    acquiredDate: normalizeString(entry.acquiredDate),
  };
}

function normalizeNullableString(value: unknown) {
  return normalizeString(value) || null;
}

function normalizeString(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return /^(null|undefined)$/i.test(text) ? "" : text;
  }
  return "";
}
