export type BannerPlacement =
  | "home_main"
  | "ai_tools_main"
  | "resume_coaching"
  | "interview_coaching"
  | "job_detail";

export type ActiveBannerDto = {
  id: string;
  placement: BannerPlacement;
  name: string;
  targetUrl: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

export type ActiveBannerListResponseDto = {
  items: ActiveBannerDto[];
};
