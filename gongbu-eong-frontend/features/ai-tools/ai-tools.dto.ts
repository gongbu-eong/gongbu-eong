export type AiToolEventDto = {
  eventNo: string;
  slug: string;
  title: string;
  description: string | null;
  badge: string | null;
  thumbnailUrl: string | null;
  href: string;
  participantCount: number;
};

export type AiToolEventsResponseDto = {
  ok: boolean;
  items: AiToolEventDto[];
};
