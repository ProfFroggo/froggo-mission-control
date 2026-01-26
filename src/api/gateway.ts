export const GATEWAY_URL = 'http://127.0.0.1:18789';

export async function checkGateway(): Promise<boolean> {
  try {
    await fetch(GATEWAY_URL, { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}
