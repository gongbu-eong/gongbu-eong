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
  additionalNotes?: string | null;
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

export type ResumeListResponseDto = {
  ok: boolean;
  resumes: ResumeDto[];
};

export type ResumeResponseDto = {
  ok: boolean;
  resume: ResumeDto;
};

export type ResumeUploadResponseDto = {
  ok: boolean;
  storageWarning?: string | null;
  file: NonNullable<ResumeDto["file"]>;
  extracted: ResumePayloadDto;
  job?: ResumeParseJobDto;
};

export type ResumeParseJobDto = {
  id: string;
  userId: string;
  fileId: string;
  status: "pending" | "processing" | "completed" | "failed";
  extractedPayload: Partial<ResumePayloadDto> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeParseJobResponseDto = {
  ok: boolean;
  job: ResumeParseJobDto;
};

export type ProfileAvatarKey =
  | "fox"
  | "lion"
  | "cat"
  | "penguin"
  | "chick"
  | "monkey"
  | "cow"
  | "bear"
  | "chicken"
  | "mouse";

export type ProfileGender = "female" | "male";

export type ProfileAgeGroup =
  | "teens"
  | "early_20s"
  | "late_20s"
  | "early_30s"
  | "late_30s"
  | "over_40";

export type UserProfileDto = {
  id: string;
  email: string | null;
  nickname: string | null;
  displayName: string | null;
  communityNickname: string | null;
  profileStatusMessage: string | null;
  profileAvatarKey: ProfileAvatarKey;
  profileBackgroundColor: string;
  gender: ProfileGender | null;
  ageGroup: ProfileAgeGroup | null;
};

export type UserProfilePayloadDto = {
  communityNickname: string;
  profileStatusMessage: string | null;
  profileAvatarKey: ProfileAvatarKey;
  profileBackgroundColor: string;
  gender: ProfileGender | null;
  ageGroup: ProfileAgeGroup | null;
};

export type UserProfileResponseDto = {
  ok: boolean;
  profile: UserProfileDto;
};

export type DeadlineNotificationOffset = 7 | 3 | 0;

export type NotificationSettingsDto = {
  phoneNumber: string | null;
  kakaoConnected: boolean;
  kakaoConnectedAt: string | null;
  deadlineEnabled: boolean;
  deadlineOffsets: DeadlineNotificationOffset[];
  marketingAgreed: boolean;
  marketingAgreedAt: string | null;
  marketingRevokedAt: string | null;
};

export type NotificationSettingsPayloadDto = {
  phoneNumber: string | null;
  kakaoConnected: boolean;
  deadlineEnabled: boolean;
  deadlineOffsets: DeadlineNotificationOffset[];
  marketingAgreed: boolean;
};

export type NotificationSettingsResponseDto = {
  ok: boolean;
  settings: NotificationSettingsDto;
};
