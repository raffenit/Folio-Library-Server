import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * Audiobookshelf API Service
 * 
 * Handles library discovery, media metadata synchronization, and playback session management.
 * 
 * DESIGN NOTES:
 * - Uses a proxy-aware Axios client to handle PWA CORS requirements.
 * - Implements a 3-tier fallback for metadata updates to support ABS v2.33.1 specific structures.
 * - Emits global FOLIO_PLAYBACK_STOPPED events for cross-component UI synchronization.
 * 
 * DOCUMENTATION:
 * For detailed override logic and API schema alignment see:
 * /docs/AUDIOBOOKSHELF_API.md
 */

/**
 * Dynamic Universal Tunnel Logic
 * Tunneling via local origin when Bypass CORS is enabled.
 */

// Global storage keys (shared across all profiles)
const GLOBAL_STORAGE_KEYS = {
  SERVER_URL: 'folio_abs_server_url',
  API_KEY:    'folio_abs_api_key',
};

// Storage keys - Server URL and API key are global (not profile-specific)
const STORAGE_KEYS = {
  SERVER_URL: GLOBAL_STORAGE_KEYS.SERVER_URL,
  API_KEY: GLOBAL_STORAGE_KEYS.API_KEY,
};

export interface ABSLibrary {
  id: string;
  name: string;
  mediaType: 'book' | 'podcast';
  icon: string;
}

export interface ABSAuthor {
  id: string;
  name: string;
}

export interface ABSBookMedia {
  metadata: {
    title: string;
    authorName?: string;
    description?: string;
    duration?: number;
    narrator?: string;
    genres?: string[];
    tags?: string[];
    series?: { id: string; name: string; sequence?: string } | null;
  };
  coverPath?: string;
  duration: number;
  audioFiles?: ABSAudioFile[];
}

export interface ABSAudioFile {
  index: number;
  ino: string;
  metadata: { filename: string; duration: number };
  mimeType: string;
}

export interface ABSLibraryItem {
  id: string;
  ino: string;
  libraryId: string;
  media: ABSBookMedia;
  // progress fields injected when fetching with user progress
  userMediaProgress?: {
    currentTime: number;
    duration: number;
    progress: number;
    isFinished: boolean;
  } | null;
}

export interface ABSPlaybackSession {
  id: string;
  libraryItemId: string;
  audioTracks: ABSAudioTrack[];
  currentTime: number;
  duration: number;
  startTime: number;
}

export interface ABSAudioTrack {
  index: number;
  startOffset: number;
  duration: number;
  title: string;
  contentUrl: string;  // relative path — prepend serverUrl
  mimeType: string;
}

class AudiobookshelfAPI {
  private client: AxiosInstance;
  private serverUrl: string = '';
  private apiKey: string = '';
  private proxyOrigin: string | null = null;

  constructor() {
    // 1. Pull the URL from the environment variable as a persistent default
    const envUrl = process.env.EXPO_PUBLIC_ABS_URL || '';
    
    this.client = axios.create({ 
      baseURL: envUrl, 
      timeout: 30000 
    });

    this.client.interceptors.request.use((config) => {
      // ── Proxy Mode ──────────────────────────────────────────────────────────
      // Use proxy if origin is set and it's an ABS API call.
      // We detect ABS calls by looking for '/api/' in the path.
      // hardening: check if it's already absolute (e.g. hitting localhost origin)
      const url = config.url || '';
      const isApiCall = url.includes('/api/');
      const isProxied = this.proxyOrigin && isApiCall && !url.includes('/proxy?url=');

      if (isProxied) {
        // Ensure we use the RAW server URL as the base for the proxy target.
        let rawTargetBase = this.serverUrl;
        if (rawTargetBase.includes('/proxy?url=')) {
          const parts = rawTargetBase.split('/proxy?url=');
          rawTargetBase = decodeURIComponent(parts[parts.length - 1]);
        }
        rawTargetBase = rawTargetBase.replace(/\/$/, '');

        // Extract the path after /api/ to handle cases where baseURL was already prepended
        let apiUrlPath = url;
        if (url.startsWith('http')) {
          try {
            const parsed = new URL(url);
            apiUrlPath = parsed.pathname + parsed.search;
          } catch {
            // fallback
          }
        }

        const [cleanPath, existingSearch] = apiUrlPath.split('?');
        const merged = new URLSearchParams(existingSearch || '');

        // Merge config.params then add token
        if (config.params) {
          Object.entries(config.params).forEach(([k, v]) => { merged.set(k, String(v)); });
        }
        merged.set('token', this.apiKey);

        const fullTarget = `${rawTargetBase}${cleanPath}?${merged.toString()}`;

        if (__DEV__) {
          console.log(`[ABS Proxy] ${config.method?.toUpperCase()} ${fullTarget}`);
        }

        config.url = `${this.proxyOrigin}${encodeURIComponent(fullTarget)}`;
        config.baseURL = '';
        config.params = undefined;
        return config;
      }

      // ── Direct Mode ─────────────────────────────────────────────────────────
      if (__DEV__) {
        console.log(`[ABS Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      }

      if (this.apiKey) {
        config.params = { ...config.params, token: this.apiKey };
        // Strip headers that trigger CORS preflight on simple GET requests
        if (config.method?.toLowerCase() === 'get') {
          delete config.headers['Content-Type'];
          delete config.headers['X-Requested-With'];
        }
      }
      return config;
    });
  }

  async initialize() {
    try {
      // 3. Fallback to Env if storage is empty
      const storedUrl = await storage.getItem(STORAGE_KEYS.SERVER_URL);
      const storedKey = await storage.getItem(STORAGE_KEYS.API_KEY);
      const defaultUrl = process.env.EXPO_PUBLIC_ABS_URL || '';

      const finalUrl = storedUrl || defaultUrl;
      const finalKey = storedKey || process.env.EXPO_PUBLIC_ABS_TOKEN || '';

      if (finalUrl) {
        this.setServer(finalUrl, finalKey);
      }
    } catch (e) {
      console.error('Failed to initialize AudiobookshelfAPI', e);
    }
  }

  setProxy(origin: string | null) {
    this.proxyOrigin = origin;
  }

  private setServer(url: string, key: string) {
    let clean = url.trim().replace(/\/$/, '');
    
    // If the URL is already a proxy URL, extract the inner target
    if (clean.includes('/proxy?url=')) {
      const parts = clean.split('/proxy?url=');
      clean = decodeURIComponent(parts[parts.length - 1]).replace(/\/$/, '');
      console.log('[ABS] Extracted raw server from proxy URL:', clean);
    }

    if (!/^https?:\/\//i.test(clean)) clean = 'http://' + clean;
    
    this.serverUrl = clean;
    this.apiKey = key;
    this.client.defaults.baseURL = clean;
  }

  async loadCredentials() {
    const storedUrl = await storage.getItem(STORAGE_KEYS.SERVER_URL);
    const storedKey = await storage.getItem(STORAGE_KEYS.API_KEY);

    if (storedUrl && storedKey) {
      this.setServer(storedUrl, storedKey);
      return true;
    }
    return false;
  }

  async saveCredentials(serverUrl: string, apiKey: string) {
    this.setServer(serverUrl, apiKey);
    await storage.setItem(STORAGE_KEYS.SERVER_URL, this.serverUrl);
    await storage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    this.apiKey = apiKey;

    let cleanUrl = serverUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'http://' + cleanUrl;
    this.serverUrl = cleanUrl;
    this.client.defaults.baseURL = cleanUrl;
    await storage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
  }

  async clearCredentials() {
    this.serverUrl = '';
    this.apiKey = '';
    this.client.defaults.baseURL = '';
    await storage.deleteItem(STORAGE_KEYS.SERVER_URL);
    await storage.deleteItem(STORAGE_KEYS.API_KEY);
  }

  hasCredentials(): boolean {
    if (this.proxyOrigin) return !!this.apiKey;
    return !!this.serverUrl && !!this.apiKey;
  }

  getServerUrl(): string { return this.serverUrl; }

  getApiKey(): string { return this.apiKey; }

  /** Ping the server — returns true if reachable with the given key */
  async ping(): Promise<boolean> {
    try {
      await this.client.get('/ping');
      return true;
    } catch {
      return false;
    }
  }

  async getLibraries(): Promise<ABSLibrary[]> {
    console.log('[absAPI] Fetching /api/libraries...');
    try {
      const res = await this.client.get('/api/libraries');
      console.log('[absAPI] Response status:', res.status);
      console.log('[absAPI] Response data keys:', Object.keys(res.data || {}));
      const libs = res.data?.libraries || (Array.isArray(res.data) ? res.data : []);
      console.log('[absAPI] Parsed libraries:', libs.length, libs.map((l: any) => ({ id: l.id, name: l.name })));
      return libs;
    } catch (e: any) {
      console.error('[absAPI] getLibraries error:', e?.response?.status, e?.message);
      throw e;
    }
  }

  async getLibraryItems(libraryId: string, page = 0, limit = 50): Promise<{ items: ABSLibraryItem[]; total: number }> {
    const res = await this.client.get(`/api/libraries/${libraryId}/items`, {
      params: { page, limit, sort: 'media.metadata.title', asc: 1, include: 'progress' },
    });
    return { items: res.data.results ?? [], total: res.data.total ?? 0 };
  }

  async scanAllLibraries(): Promise<void> {
    if (!this.hasCredentials()) return;
    const libraries = await this.getLibraries();
    for (const lib of libraries) {
      await this.client.post(`/api/libraries/${lib.id}/scan`);
    }
  }

  async searchByTitle(title: string): Promise<ABSLibraryItem | null> {
    if (!this.hasCredentials()) return null;
    try {
      const libraries = await this.getLibraries();
      for (const lib of libraries) {
        const res = await this.client.get(`/api/libraries/${lib.id}/search`, {
          params: { q: title, limit: 5 },
        });
        const results: any[] = res.data?.book ?? res.data?.results ?? [];
        const match = results.find((r: any) => {
          const t: string = (r.libraryItem?.media?.metadata?.title ?? r.title ?? '').toLowerCase();
          return t.includes(title.toLowerCase()) || title.toLowerCase().includes(t.split(':')[0].toLowerCase());
        });
        if (match) return match.libraryItem ?? match;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLibraryItem(itemId: string): Promise<ABSLibraryItem> {
    // Note: `include=progress` requires a user-scoped JWT and returns 404 for API key tokens.
    // Fetch with expanded=1 only; progress is tracked via the playback session instead.
    const res = await this.client.get(`/api/items/${itemId}`, {
      params: { expanded: 1 },
    });
    return res.data;
  }

  /** Open a playback session — ABS tracks position server-side.
   *  If startTime is omitted, ABS returns its server-tracked currentTime
   *  in the response, which is the correct resume point. */
  async startPlaybackSession(itemId: string, startTime?: number): Promise<ABSPlaybackSession> {
    const body: any = {
      deviceInfo: { clientName: 'Folio', deviceId: 'folio-reader-app' },
      forceDirectPlay: true,
      forceTranscode: false,
      mediaPlayer: 'folio-reader',
    };
    // Only override ABS's tracked position when an explicit seek is requested
    if (startTime !== undefined && startTime !== null) {
      body.startTime = startTime;
    }
    const res = await this.client.post(`/api/items/${itemId}/play`, body);
    return res.data;
  }

  // ── Library & Collection Management ──────────────────────────────────────────

  async getLibraryFilterData(libraryId: string): Promise<any> {
    const res = await this.client.get(`/api/libraries/${libraryId}/filter-data`);
    return res.data;
  }

  async getCollections(): Promise<any[]> {
    const res = await this.client.get('/api/collections');
    return res.data?.collections || (Array.isArray(res.data) ? res.data : []);
  }

  async getCollection(collectionId: string): Promise<any> {
    const res = await this.client.get(`/api/collections/${collectionId}`);
    return res.data;
  }

  async addItemToCollection(collectionId: string, itemId: string): Promise<void> {
    await this.client.post(`/api/collections/${collectionId}/items/${itemId}`);
  }

  async removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
    await this.client.delete(`/api/collections/${collectionId}/items/${itemId}`);
  }

  // ── Modals & Editing ─────────────────────────────────────────────────────────

  /**
   * Update ABS item metadata via multiple fallback patterns.
   * NOTE: ABS v2.33.1 uses PATCH /api/items/:id/media for metadata updates.
   * The schema is specific: tags at root, authors as objects in metadata.
   */
  async updateMetadata(itemId: string, data: {
    title?: string;
    authorName?: string;
    description?: string;
    tags?: string[];
    genres?: string[];
  }): Promise<void> {
    const metadata: any = {};
    if (data.title !== undefined) metadata.title = data.title;
    if (data.authorName !== undefined) {
      // v2.33.1 expects authors as an array of objects
      metadata.authors = [{ name: data.authorName }];
    }
    if (data.description !== undefined) metadata.description = data.description;
    if (data.genres !== undefined) metadata.genres = data.genres;

    const mediaPayload: any = {};
    if (Object.keys(metadata).length > 0) {
      mediaPayload.metadata = metadata;
    }
    // tags are at the root of the media update payload in v2.33.1
    if (data.tags !== undefined) {
      mediaPayload.tags = data.tags;
    }

    // TIER 1: PATCH /api/items/:id/media (Confirmed for ABS 2.33.1)
    try {
      console.log(`[ABS] T1 PATCH /api/items/${itemId}/media`, JSON.stringify(mediaPayload));
      await this.client.patch(`/api/items/${itemId}/media`, mediaPayload);
      return;
    } catch (e: any) {
      const status = e?.response?.status;
      console.warn(`[ABS] T1 failed (${status}), trying T2 (Legacy/Experimental)...`);
    }

    // TIER 2: PATCH /api/items/:id (Fallback for older versions)
    try {
      // For older versions, the payload might need nesting under "media" key
      const body = { media: mediaPayload };
      console.log(`[ABS] T2 PATCH /api/items/${itemId}`, JSON.stringify(body));
      await this.client.patch(`/api/items/${itemId}`, body);
      return;
    } catch (e: any) {
      const status = e?.response?.status;
      console.warn(`[ABS] T2 failed (${status}), trying T3 (Batch Array)...`);
    }

    // TIER 3: Batch Update (using v2.33.1 array-of-objects format)
    try {
      // v2.33.1 LibraryItemController.batchUpdate expects a flat array of {id, mediaPayload}
      const batchPayload = [{ id: itemId, mediaPayload }];
      console.log('[ABS] T3 POST /api/items/batch/update (Array)', JSON.stringify(batchPayload));
      await this.client.post('/api/items/batch/update', batchPayload);
      return;
    } catch (e: any) {
      // Final fallback for very old versions or misaligned proxy
      try {
        const legacyBody = { updates: [{ id: itemId, ...mediaPayload }] };
        console.log('[ABS] T3 Legacy Batch fallback', JSON.stringify(legacyBody));
        await this.client.post('/api/items/batch/update', legacyBody);
      } catch (e2: any) {
        throw this.handleApiError(e2, 'Metadata Update (All Tiers failed)');
      }
    }
  }

  private handleApiError(e: any, context: string): Error {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const detail = data?.error ?? (typeof data === 'string' ? data : JSON.stringify(data)) ?? e?.message;
    console.error(`[ABS] ${context} failed:`, status, detail);
    return new Error(`${context} failed (${status}): ${detail}`);
  }

  async updateCoverUrl(itemId: string, coverUrl: string): Promise<void> {
    // Try modern /cover endpoint first
    try {
      const url = `/api/items/${itemId}/cover`;
      await this.client.post(url, { url: coverUrl });
      return;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status !== 404 && status !== 405) {
        throw new Error(`Failed to update cover: ${e?.response?.data || e?.message}`);
      }
      console.warn(`[ABS] POST /cover returned ${status}, trying legacy /thumbnail...`);
    }

    // Fallback for older ABS versions
    try {
      const legacyUrl = `/api/items/${itemId}/thumbnail`;
      await this.client.post(legacyUrl, { url: coverUrl });
    } catch (e: any) {
      const msg = e?.response?.data || e?.message;
      throw new Error(`Failed to update cover: ${msg}`);
    }
  }

  /** Report progress back to ABS */
  async saveAudioProgress(sessionId: string, currentTime: number, duration: number) {
    // Added a safety check to avoid 400 errors if sessionId is missing
    if (!sessionId) return;
    
    return await this.client.post(`/api/session/${sessionId}/sync`, {
      currentTime,
      duration,
      timeListened: 0 
    });
  }

  /** Close playback session */
  async closeSession(sessionId: string, currentTime: number, duration: number) {
    try {
      await this.client.post(`/api/session/${sessionId}/close`, { currentTime, duration });
    } catch {
      // non-fatal
    }
  }

  getCoverUrl(itemId: string, version?: number): string {
    let url = `${this.serverUrl}/api/items/${itemId}/cover?token=${this.apiKey}`;
    if (version) {
      url += `&v=${version}`;
    }
    
    if (this.proxyOrigin) {
      return `/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  /** Absolute URL for a track's contentUrl */
  resolveTrackUrl(contentUrl: string): string {
    const path = contentUrl.startsWith('/') ? contentUrl : `/${contentUrl}`;
    const url = /^https?:\/\//i.test(contentUrl) 
      ? contentUrl 
      : `${this.serverUrl}${path}?token=${this.apiKey}`;

    if (this.proxyOrigin) {
      return `/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  async search(query: string): Promise<any> {
    if (!this.hasCredentials()) return { series: [], collections: [], readingLists: [] };
    try {
      const results: any[] = [];
      const libraries = await this.getLibraries();
      for (const lib of libraries) {
        const res = await this.client.get(`/api/libraries/${lib.id}/search`, {
          params: { q: query.trim(), limit: 12 },
        });
        
        // ABS results might be in .book or .results
        const items: any[] = res.data?.book ?? res.data?.results ?? [];
        for (const r of items) {
          const item = r.libraryItem || r;
          const itemId = item.id;
          if (!itemId) continue; // skip results with no valid ID
          results.push({
            id: itemId,
            name: item.media?.metadata?.title ?? item.title ?? 'Unknown',
            coverImage: itemId,
            libraryName: lib.name,
            pagesRead: item.userMediaProgress?.progress ?? 0,
            pages: 100,
            media: item.media,
            server: 'abs',
          });
        }
      }
      return { series: results, collections: [], readingLists: [] };
    } catch (e) {
      console.error('ABS Search failed', e);
      return { series: [], collections: [], readingLists: [] };
    }
  }
}

export const absAPI = new AudiobookshelfAPI();
