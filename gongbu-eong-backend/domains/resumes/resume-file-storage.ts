import { randomUUID } from "crypto";
import { createUserFile, updateUserFileStorage } from "./resumes.repository";
import { uploadToObjectStorage } from "@/lib/object-storage";

export const ACCEPTED_RESUME_EXTENSIONS = new Set([
  "hwp",
  "hwpx",
  "hwt",
  "hml",
  "pdf",
  "doc",
  "docx",
  "docm",
  "dot",
  "dotx",
  "dotm",
  "rtf",
]);

export const RESUME_EXTENSION_ERROR =
  "한글(HWP/HWPX/HWT/HML), PDF, Word(DOC/DOCX/DOCM/DOT/DOTX/DOTM/RTF) 파일만 업로드할 수 있습니다.";

export function validateResumeFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return ACCEPTED_RESUME_EXTENSIONS.has(extension) ? null : RESUME_EXTENSION_ERROR;
}

export async function createPendingResumeFile(userId: string, file: File) {
  return createUserFile({
    userId,
    originalFilename: file.name,
    storageObjectKey: `resumes/${userId}/pending/${randomUUID()}-${sanitizeFilename(file.name)}`,
    publicUrl: null,
    contentType: file.type || null,
    sizeBytes: file.size,
    uploadStatus: "analysis_completed",
    metadata: {
      storageDeferred: true,
      reason: "Object Storage upload is deferred until resume save.",
    },
  });
}

export async function uploadResumeFileOnSave(args: {
  userId: string;
  file: File;
  existingFileId?: string | null;
}) {
  const buffer = Buffer.from(await args.file.arrayBuffer());
  const objectKey = `resumes/${args.userId}/${randomUUID()}-${sanitizeFilename(args.file.name)}`;
  const uploadResult = await uploadToObjectStorage({
    key: objectKey,
    buffer,
    contentType: args.file.type,
  });

  if (!uploadResult.uploaded) {
    throw new Error(uploadResult.reason || "Object Storage 업로드에 실패했습니다.");
  }

  if (args.existingFileId) {
    const updatedFile = await updateUserFileStorage({
      userId: args.userId,
      fileId: args.existingFileId,
      originalFilename: args.file.name,
      storageObjectKey: objectKey,
      publicUrl: uploadResult.publicUrl,
      contentType: args.file.type || null,
      sizeBytes: args.file.size,
      uploadStatus: "uploaded",
      metadata: {
        uploadedOnSave: true,
      },
    });

    if (updatedFile) {
      return updatedFile;
    }
  }

  return createUserFile({
    userId: args.userId,
    originalFilename: args.file.name,
    storageObjectKey: objectKey,
    publicUrl: uploadResult.publicUrl,
    contentType: args.file.type || null,
    sizeBytes: args.file.size,
    uploadStatus: "uploaded",
    metadata: {
      uploadedOnSave: true,
    },
  });
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^\w.\-가-힣]/g, "_");
}
