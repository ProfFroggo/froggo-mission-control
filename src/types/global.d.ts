export {};

declare global {
  interface Window {
    clawdbot?: {
      gateway: {
        status: () => Promise<unknown>;
        sessions: () => Promise<unknown>;
      };
      platform: string;
    };
  }
}
