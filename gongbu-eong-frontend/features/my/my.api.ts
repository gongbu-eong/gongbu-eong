import { apiClient } from "@/shared/api/client";
import type {
  ResumeListResponseDto,
  ResumePayloadDto,
  ResumeParseJobResponseDto,
  ResumeResponseDto,
  ResumeUploadResponseDto,
  NotificationSettingsPayloadDto,
  NotificationSettingsResponseDto,
  UserWithdrawalPayloadDto,
  UserWithdrawalResponseDto,
  UserProfilePayloadDto,
  UserProfileResponseDto,
} from "./my.dto";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export function listResumes() {
  return apiClient<ResumeListResponseDto>("/api/resumes");
}

export function getResume(resumeId: string) {
  return apiClient<ResumeResponseDto>(`/api/resumes/${resumeId}`);
}

export function createResume(payload: ResumePayloadDto, file?: File | null) {
  return saveResume("/api/resumes", "POST", payload, file);
}

export function updateResume(resumeId: string, payload: ResumePayloadDto, file?: File | null) {
  return saveResume(`/api/resumes/${resumeId}`, "PUT", payload, file);
}

export function deleteResume(resumeId: string) {
  return apiClient<{ ok: boolean }>(`/api/resumes/${resumeId}`, {
    method: "DELETE",
  });
}

export function selectResume(resumeId: string) {
  return apiClient<{ ok: boolean }>(`/api/resumes/${resumeId}/select`, {
    method: "POST",
  });
}

export function getMyProfile() {
  return apiClient<UserProfileResponseDto>("/api/users/me/profile");
}

export function updateMyProfile(payload: UserProfilePayloadDto) {
  return apiClient<UserProfileResponseDto>("/api/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getMyNotificationSettings() {
  return apiClient<NotificationSettingsResponseDto>(
    "/api/users/me/notification-settings",
  );
}

export function updateMyNotificationSettings(
  payload: NotificationSettingsPayloadDto,
) {
  return apiClient<NotificationSettingsResponseDto>(
    "/api/users/me/notification-settings",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function withdrawCurrentUser(payload: UserWithdrawalPayloadDto) {
  return apiClient<UserWithdrawalResponseDto>("/api/users/me/withdrawal", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getResumeParseJob(jobId: string) {
  return apiClient<ResumeParseJobResponseDto>(`/api/resumes/parse-jobs/${jobId}`);
}

export async function uploadResumeFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${backendUrl}/api/resumes/upload`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    let message = `Backend request failed: ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      // keep HTTP status fallback
    }

    throw new Error(message);
  }

  return response.json() as Promise<ResumeUploadResponseDto>;
}

async function saveResume(
  path: string,
  method: "POST" | "PUT",
  payload: ResumePayloadDto,
  file?: File | null,
) {
  if (!file) {
    return apiClient<ResumeResponseDto>(path, {
      method,
      body: JSON.stringify(payload),
    });
  }

  const formData = new FormData();
  formData.append("payload", JSON.stringify(payload));
  formData.append("file", file);

  const response = await fetch(`${backendUrl}${path}`, {
    method,
    cache: "no-store",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    let message = `Backend request failed: ${response.status}`;

    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return response.json() as Promise<ResumeResponseDto>;
}
