export {};

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js" | "set",
      target: string | Date | Record<string, unknown>,
      params?: Record<string, unknown>,
    ) => void;
  }
}
