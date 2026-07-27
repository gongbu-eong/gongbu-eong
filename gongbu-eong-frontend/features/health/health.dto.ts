export type HealthResponseDto = {
  ok: boolean;
  service: string;
  role: "backend";
  timestamp: string;
  database?: {
    connected: boolean;
    timestamp: string;
  };
};
