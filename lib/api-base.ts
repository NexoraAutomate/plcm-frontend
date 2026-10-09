/**
 * Resolve the backend API base URL for the current browser context.
 *
 * When NEXT_PUBLIC_API_URL points at localhost/127.0.0.1 (the usual Docker
 * and local-dev default), rewrite the hostname to match the page origin so
 * LAN clients (other PCs, phones) hit the host machine's API instead of
 * their own loopback.
 *
 * Local browsers stay on 127.0.0.1 so requests do not flip to `localhost` →
 * IPv6 (::1) while uvicorn is commonly bound to IPv4 only.
 */
export function getApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:8000/api';

  const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

  if (typeof window === 'undefined') {
    return stripTrailingSlash(configured);
  }

  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    const configuredIsLoopback =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const pageIsLoopback = pageHost === 'localhost' || pageHost === '127.0.0.1';

    if (configuredIsLoopback && pageIsLoopback) {
      url.hostname = '127.0.0.1';
      return stripTrailingSlash(url.href);
    }

    if (configuredIsLoopback && !pageIsLoopback) {
      url.hostname = pageHost;
      return stripTrailingSlash(url.href);
    }
  } catch {
    // Fall through to configured value
  }

  return stripTrailingSlash(configured);
}
