export type CurrentUserDto = {
  id: string;
  email: string | null;
  nickname: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: "kakao" | "naver" | null;
  diagnosisTypeName: string | null;
};

export type CurrentUserResponseDto = {
  ok: boolean;
  authenticated: boolean;
  user: CurrentUserDto | null;
};
