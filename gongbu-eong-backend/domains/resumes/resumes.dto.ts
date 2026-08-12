export type ResumeEntryDto = {
  id?: string;
  title?: string;
  certificationName?: string;
  issuer?: string;
  subtitle?: string;
  startDate?: string;
  endDate?: string;
  schoolName?: string;
  degree?: string;
  major?: string;
  gpaScore?: string;
  gpaMax?: string;
  graduationStatus?: string;
  companyName?: string;
  position?: string;
  duties?: string;
  contestName?: string;
  awardName?: string;
  awardedDate?: string;
  activityName?: string;
  description?: string;
  activityDate?: string;
  language?: string;
  testName?: string;
  levelOrScore?: string;
  acquiredDate?: string;
};

export type ResumePayloadDto = {
  title: string;
  sourceType: "upload" | "manual";
  fileId?: string | null;
  name?: string | null;
  birthYear?: string | null;
  birthDate?: string | null;
  email?: string | null;
  desiredJob?: string | null;
  highestEducation?: string | null;
  gpa?: string | null;
  gpaScore?: string | null;
  gpaMax?: string | null;
  schoolMajor?: string | null;
  graduationStatus?: string | null;
  educationStartDate?: string | null;
  educationEndDate?: string | null;
  educationSummary?: string | null;
  careerSummary?: string | null;
  certificationSummary?: string | null;
  completionPercent?: number;
  extractedPayload?: Record<string, unknown>;
  educations?: ResumeEntryDto[];
  experiences?: ResumeEntryDto[];
  certifications?: ResumeEntryDto[];
  awards?: ResumeEntryDto[];
  activities?: ResumeEntryDto[];
  languages?: ResumeEntryDto[];
};

export type ResumeDto = ResumePayloadDto & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isSelected: boolean;
  file?: {
    id: string;
    originalFilename: string;
    contentType: string | null;
    sizeBytes: number | null;
    publicUrl: string | null;
  } | null;
};

export type ResumeParseJobStatus = "pending" | "processing" | "completed" | "failed";

export type ResumeParseJobDto = {
  id: string;
  userId: string;
  fileId: string;
  status: ResumeParseJobStatus;
  extractedPayload: Partial<ResumePayloadDto> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
