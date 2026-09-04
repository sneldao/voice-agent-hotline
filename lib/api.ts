/**
 * Returns the base URL for API calls.
 *
 * Preferred production topology (no browser CORS at all):
 *   - Browser calls its OWN origin at /api/* (this function returns the path
 *     unchanged), and the Next.js server proxies to the backend via the
 *     API_PROXY_TARGET rewrite in next.config.js (server-to-server).
 *
 * Legacy/direct mode:
 *   - When NEXT_PUBLIC_API_URL is set, calls are routed to that host
 *     cross-origin. This still works (proxy.ts answers preflights and stamps
 *     CORS headers), but prefer the proxy — it cannot be broken by backend
 *     CORS misconfiguration and survives ad-blockers.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (base) {
    // Ensure no double slashes
    return `${base.replace(/\/$/, '')}${path}`;
  }
  return path;
}
