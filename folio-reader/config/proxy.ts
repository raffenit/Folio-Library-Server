/**
 * Centralized proxy configuration for Folio
 * 
 * This module provides a single source of truth for the proxy path configuration.
 * Changing the proxy path only requires updating this file.
 */

/** The base proxy path (without the query string) */
export const PROXY_BASE_PATH = '/dynamic-proxy';

/** The full proxy path with query parameter template */
export const PROXY_PATH = `${PROXY_BASE_PATH}?url=`;

/**
 * Wraps a target URL with the local proxy path to bypass CORS on web platform
 * @param targetUrl The external URL to proxy
 * @returns The proxied URL path
 */
export function proxyUrl(targetUrl: string): string {
  return `${PROXY_PATH}${encodeURIComponent(targetUrl)}`;
}

/**
 * Checks if a URL is already proxied
 * @param url The URL to check
 * @returns true if the URL contains the proxy path
 */
export function isProxied(url: string): boolean {
  return url.includes(PROXY_PATH);
}

/**
 * Extracts the original target URL from a proxied URL
 * @param proxiedUrl The proxied URL
 * @returns The original target URL or null if not a valid proxied URL
 */
export function extractTargetUrl(proxiedUrl: string): string | null {
  if (!isProxied(proxiedUrl)) return null;
  
  const parts = proxiedUrl.split(PROXY_PATH);
  if (parts.length < 2) return null;
  
  try {
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}
