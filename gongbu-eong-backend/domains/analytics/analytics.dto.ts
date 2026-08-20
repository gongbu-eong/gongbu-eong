export type AttributionSnapshotDto = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  landingUrl?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
  capturedAt?: string | null;
};

export type SaveAttributionRequestDto = {
  anonymousId?: string | null;
  first?: AttributionSnapshotDto | null;
  last?: AttributionSnapshotDto | null;
  current?: AttributionSnapshotDto | null;
};

export type ProductEventAttributionContextDto = {
  first?: AttributionSnapshotDto | null;
  last?: AttributionSnapshotDto | null;
  current?: AttributionSnapshotDto | null;
};
