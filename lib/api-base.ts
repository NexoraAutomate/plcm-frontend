/**
 * Resolve the backend API base URL for the current browser context.
 *
 * When NEXT_PUBLIC_API_URL points at localhost/127.0.0.1 (the usual Docker
 * and local-dev default), rewrite the hostname to match the page origin so
 * LAN clients (other PCs, phones) hit the host machine's API instead of
 * their own loopback.
 */
export function getApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:8000/api"

  if (typeof window === "undefined") {
    return configured
  }

  try {
    const url = new URL(configured)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.hostname = window.location.hostname
      // Preserve path; strip trailing slash for consistent axios baseURL joins
      return url.href.replace(/\/$/, "")
    }
  } catch {
    // Fall through to configured value
  }

  return configured
}
