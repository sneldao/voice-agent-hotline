/**
 * Returns the base URL for API calls.
 * When NEXT_PUBLIC_API_URL is set, all /api/... calls are routed to that host.
 * This allows Vercel to act as a pure frontend while the VPS handles all data.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (base) {
    // Ensure no double slashes
    return `${base.replace(/\/$/, '')}${path}`;
  }
  return path;
}
