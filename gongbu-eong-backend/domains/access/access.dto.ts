export type CreateAccessLogRequestDto = {
  anonymousId?: string;
  eventName?: string;
  path: string;
  title?: string;
  referrer?: string;
  entrySource?: string;
  metadata?: Record<string, unknown>;
};
