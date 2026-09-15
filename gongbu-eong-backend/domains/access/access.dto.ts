export type CreateAccessLogRequestDto = {
  anonymousId?: string;
  sessionId?: string;
  eventName?: string;
  path: string;
  title?: string;
  referrer?: string;
  previousPath?: string;
  canonicalPath?: string;
  screenKey?: string;
  trafficChannel?: string;
  entrySource?: string;
  metadata?: Record<string, unknown>;
};
