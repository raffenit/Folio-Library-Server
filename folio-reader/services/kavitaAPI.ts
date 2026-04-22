import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * Dynamic Universal Tunnel Logic
 * Instead of hardcoding proxy URLs, we now stick to the user's original server URL
 * for everything, and only tunnel through the local origin when Bypass CORS is enabled.
 */

// Global storage keys (shared across all profiles)
const GLOBAL_STORAGE_KEYS = {
  SERVER_URL: 'folio_kavita_server_url',
  API_KEY: 'folio_kavita_api_key',
};

// Profile-scoped storage keys
const BASE_STORAGE_KEYS = {
  JWT_TOKEN: 'kavita_jwt_token',
};

// Helper to get profile-scoped storage key (only for JWT tokens)
function getStorageKey(key: string): string {
  // Check if we have an active profile in memory
  const activeProfileId = typeof window !== 'undefined'
    ? (window as any).__ACTIVE_PROFILE_ID
    : null;

  if (activeProfileId) {
    return `folio_${activeProfileId}_${key}`;
  }
  return key;
}

// Storage keys - Server URL and API key are global, JWT is profile-specific
const STORAGE_KEYS = {
  SERVER_URL: GLOBAL_STORAGE_KEYS.SERVER_URL,
  API_KEY: GLOBAL_STORAGE_KEYS.API_KEY,
  get JWT_TOKEN() { return getStorageKey(BASE_STORAGE_KEYS.JWT_TOKEN); },
  PROGRESS_TRACKING_ENABLED: 'folio_kavita_progress_tracking',
};

export interface KavitaBookInfo {
  pages: number;
  bookTitle?: string;
  lastReadPage?: number; 
  chapterId?: number;
  
  // This allows other properties without errors
  [key: string]: any; 
}

export interface Library {
  id: number;
  name: string;
  type: number; // 0=Manga, 1=Comic, 2=Book
  coverImage?: string;
  series: number;
}

export interface Series {
  id: number;
  name: string;           // scanner-controlled, read-only
  originalName: string;
  localizedName?: string; // user-editable display override
  sortName: string;
  summary?: string;
  coverImage?: string;
  libraryId: number;
  libraryName?: string;
  pagesRead: number;
  pages: number;
  userRating: number;
  format: number; // 0=Unknown, 1=Archive(CBZ), 2=Unknown, 3=Epub, 4=PDF
  created: string;
  lastModified: string;
  server?: string;
}

export interface Volume {
  id: number;
  number: number;
  name: string;
  chapters: Chapter[];
  pagesRead: number;
  pages: number;
  coverImage?: string;
}

export interface Chapter {
  id: number;
  number: string;
  range: string;
  title: string;
  pages: number;
  pagesRead: number;
  coverImage?: string;
  volumeId: number;
  isSpecial: boolean;
  summary?: string;
  files: ChapterFile[];
}

export interface ChapterFile {
  id: number;
  filePath: string;
  pages: number;
  format: number; // 0=Unknown, 1=Archive(CBZ), 2=Unknown, 3=Epub, 4=PDF, 9=AZW3/MOBI
}

export interface SeriesDetail {
  id: number;
  name: string;           // scanner-controlled, read-only
  localizedName?: string; // user-editable display override
  sortName?: string;
  summary?: string;
  coverImage?: string;
  volumes: Volume[];
}

export interface Collection {
  id: number;
  title: string;
  promoted: boolean;
  coverImage?: string;
  summary?: string;
}

export interface Genre {
  id: number;
  title: string;
}

export interface Tag {
  id: number;
  title: string;
}

// The metadata object returned by GET /api/Series/metadata?seriesId=X
export interface SeriesMetadata {
  id: number;
  seriesId: number;
  summary?: string;
  genres: Genre[];
  tags: Tag[];
  writers?: { id: number; name: string }[];
  coverArtists?: { id: number; name: string }[];
  publishers?: { id: number; name: string }[];
  characters?: { id: number; name: string }[];
  pencillers?: { id: number; name: string }[];
  inkers?: { id: number; name: string }[];
  colorists?: { id: number; name: string }[];
  letterers?: { id: number; name: string }[];
  editors?: { id: number; name: string }[];
  translators?: { id: number; name: string }[];
  ageRating?: number;
  releaseYear?: number;
  language?: string;
  maxCount?: number;
  totalCount?: number;
  publicationStatus?: number;
}

export interface BookTocEntry {
  title: string;
  page: number;
  children?: BookTocEntry[];
}

export interface ChapterInfo {
  chapterId: number;
  seriesId: number;
  volumeId: number;
  libraryId: number;
  pages: number;
  lastReadPage?: number; // Add this here
  title?: string;
  fileName?: string;
  isSpecial: boolean;
}

// Format preference order: PDF (4) > EPUB (3) > Archive/CBZ (1) > other
// Lower return value = higher preference
function formatPriority(fmt: number): number {
  if (fmt === 4) return 0; // PDF — highest preference
  if (fmt === 3) return 1; // EPUB
  if (fmt === 1) return 2; // Archive/CBZ
  return 3;                // Unknown / Azw3 / Mobi etc.
}

// Given a list of chapter files, return the one with the best (lowest priority) format
export function pickBestFile(files: ChapterFile[]): ChapterFile | undefined {
  if (!files?.length) return undefined;
  return [...files].sort((a, b) => formatPriority(a.format) - formatPriority(b.format))[0];
}

// Given a chapter, return its effective format using pickBestFile
export function chapterEffectiveFormat(chapter: Chapter): number {
  const best = pickBestFile(chapter.files);
  return best?.format ?? chapter.files?.[0]?.format ?? 0;
}

class KavitaAPI {
  private client: AxiosInstance;
  private serverUrl: string = '';
  private apiKey: string = '';
  private jwtToken: string = '';
  private progressTrackingEnabled: boolean = true;
  private proxyOrigin: string | null = null;

  constructor() {
    // 1. Pull the URL from the environment variable as the "Source of Truth"
    const envUrl = process.env.EXPO_PUBLIC_KAVITA_URL || '';
    
    this.client = axios.create({ 
      baseURL: envUrl, // Set it immediately in the constructor
      timeout: 30000 
    });

    this.client.interceptors.request.use((config) => {
      // ── Proxy Mode ──────────────────────────────────────────────────────────
      // Build the full target URL (including auth) and wrap it in /proxy?url=
      const isProxied = this.proxyOrigin && config.url?.startsWith('/api/');
      if (isProxied) {
        // Ensure we use the RAW server URL as the base for the proxy target.
        let rawTargetBase = this.serverUrl;
        if (rawTargetBase.includes('/proxy?url=')) {
          const parts = rawTargetBase.split('/proxy?url=');
          rawTargetBase = decodeURIComponent(parts[parts.length - 1]);
        }
        rawTargetBase = rawTargetBase.replace(/\/$/, '');

        // Split any existing params out of config.url (avoids double-? bug)
        const [cleanPath, existingSearch] = config.url!.split('?');
        const merged = new URLSearchParams(existingSearch || '');

        // Merge config.params first
        if (config.params) {
          Object.entries(config.params).forEach(([k, v]) => merged.set(k, String(v)));
        }
        // Kavita authenticates via Authorization header (forwarded by proxy).
        // For the /authenticate endpoint specifically, we need apiKey as a param.
        if (!this.jwtToken && this.apiKey) {
          merged.set('apiKey', this.apiKey);
          merged.set('pluginName', 'Folio');
        }

        const qs = merged.toString();
        const fullTarget = qs ? `${rawTargetBase}${cleanPath}?${qs}` : `${rawTargetBase}${cleanPath}`;

        if (__DEV__) {
          console.log(`[Kavita Proxy] ${config.method?.toUpperCase()} ${fullTarget}`);
        }

        config.url = `${this.proxyOrigin}${encodeURIComponent(fullTarget)}`;
        config.baseURL = '';
        config.params = undefined;
        if (this.jwtToken) {
          config.headers.Authorization = `Bearer ${this.jwtToken}`;
        }
        return config;
      }

      // ── Direct Mode ─────────────────────────────────────────────────────────
      if (__DEV__) {
        console.log(`Kavita Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      }

      if (this.jwtToken) {
        config.headers.Authorization = `Bearer ${this.jwtToken}`;
      } else if (this.apiKey && config.url) {
        // Add API key as query parameter when JWT is not available
        const separator = config.url.includes('?') ? '&' : '?';
        config.url = `${config.url}${separator}apiKey=${encodeURIComponent(this.apiKey)}`;
      }
      return config;
    });
  } // end constructor

  setProxy(origin: string | null) {
    this.proxyOrigin = origin;
  }

  async initialize() {
    console.log('[KavitaAPI] Initializing...');
    try {
      const storedUrl = await storage.getItem(STORAGE_KEYS.SERVER_URL);
      const storedKey = await storage.getItem(STORAGE_KEYS.API_KEY);
      const storedProgressEnabled = await storage.getItem(STORAGE_KEYS.PROGRESS_TRACKING_ENABLED);
      console.log('[KavitaAPI] Stored credentials found:', !!storedUrl, !!storedKey);

      if (storedUrl && storedKey) {
        this.setServer(storedUrl, storedKey);
        console.log('[KavitaAPI] Set server to:', this.serverUrl);
        const success = await this.login();
        if (success) {
          console.log(`✅ Kavita Authenticated (JWT): ${this.serverUrl}`);
        } else if (this.apiKey) {
          console.log(`✅ Kavita Connected (apiKey auth, no JWT): ${this.serverUrl}`);
        } else {
          console.warn('⚠️ Kavita credentials found but authentication failed.');
        }
      } else {
        console.log('[KavitaAPI] No stored credentials');
      }
      
      // Load progress tracking preference (default true)
      this.progressTrackingEnabled = storedProgressEnabled !== 'false';
    } catch (e) {
      console.error('Failed to initialize KavitaAPI', e);
    }
  }

  isProgressTrackingEnabled(): boolean {
    return this.progressTrackingEnabled;
  }

  async setProgressTrackingEnabled(enabled: boolean): Promise<void> {
    this.progressTrackingEnabled = enabled;
    await storage.setItem(STORAGE_KEYS.PROGRESS_TRACKING_ENABLED, String(enabled));
  }

  private setServer(url: string, key: string) {
    let clean = url.trim().replace(/\/$/, '');
    
    // If the URL is already a proxy URL, extract the inner target
    if (clean.includes('/proxy?url=')) {
      const parts = clean.split('/proxy?url=');
      clean = decodeURIComponent(parts[parts.length - 1]).replace(/\/$/, '');
      console.log('[Kavita] Extracted raw server from proxy URL:', clean);
    }

    if (!/^https?:\/\//i.test(clean)) clean = 'http://' + clean;
    
    this.serverUrl = clean;
    this.apiKey = key;
    this.client.defaults.baseURL = clean;
  }

  async saveCredentials(serverUrl: string, apiKey: string) {
    this.setServer(serverUrl, apiKey);
    await storage.setItem(STORAGE_KEYS.SERVER_URL, this.serverUrl);
    await storage.setItem(STORAGE_KEYS.API_KEY, apiKey);
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

  async clearCredentials() {
    this.serverUrl = '';
    this.apiKey = '';
    this.client.defaults.baseURL = '';
    await storage.deleteItem(STORAGE_KEYS.SERVER_URL);
    await storage.deleteItem(STORAGE_KEYS.API_KEY);
  }

  async login(): Promise<boolean> {
    try {
      console.log('[KavitaAPI] Login attempt to:', this.serverUrl);
      // Use the apiKey to get a JWT (GET request, not POST)
      const response = await this.client.get('/api/Plugin/authenticate', {
        params: { 
          apiKey: this.apiKey, 
          pluginName: 'Folio'
        },
      });

      console.log('[KavitaAPI] Auth response status:', response.status, 'has token:', !!response.data?.token);
      if (response.data?.token) {
        this.jwtToken = response.data.token;
        
        // CRITICAL: Set the default header so future requests aren't 401
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.jwtToken}`;
        
        await storage.setItem(STORAGE_KEYS.JWT_TOKEN, this.jwtToken);
        return true;
      }
      console.log('[KavitaAPI] No token in response:', response.data);
      return false;
    } catch (error: any) {
      const status = error?.response?.status;
      console.error('[KavitaAPI] Login error:', status, error?.response?.data || error?.message);
      
      // 404 means this Kavita version doesn't have the Plugin API
      // Validate the API key works by making a test request
      if (status === 404) {
        console.log('[KavitaAPI] Plugin API not available (404), validating API key via test request...');
        try {
          // Test the API key by calling /api/Library with apiKey param
          const testResponse = await this.client.get('/api/Library', {
            params: { apiKey: this.apiKey }
          });
          if (testResponse.status === 200) {
            console.log('[KavitaAPI] API key validated successfully via /api/Library');
            // Mark as authenticated with API key (no JWT)
            return true;
          }
        } catch (testError: any) {
          console.error('[KavitaAPI] API key validation failed:', testError?.response?.status, testError?.message);
          return false;
        }
        return false;
      }
      
      // Re-throw other errors (500, network issues, etc.)
      throw error;
    }
  }

  async logout() {
    this.jwtToken = '';
    this.apiKey = '';
    this.serverUrl = '';
    await storage.deleteItem(STORAGE_KEYS.JWT_TOKEN);
    await storage.deleteItem(STORAGE_KEYS.API_KEY);
    await storage.deleteItem(STORAGE_KEYS.SERVER_URL);
  }

  isAuthenticated(): boolean { return !!this.jwtToken; }

  hasCredentials(): boolean {
    if (this.proxyOrigin) return !!this.apiKey;
    return !!this.serverUrl && !!this.apiKey;
  }

  getServerUrl(): string { return this.serverUrl; }
  getToken(): string { return this.jwtToken; }
  getApiKey(): string { return this.apiKey; }

  // ── Libraries ───────────────────────────────────────────────────────────────

  async getLibraries(): Promise<Library[]> {
    console.log('[KavitaAPI] getLibraries() - jwtToken:', !!this.jwtToken, 'apiKey:', !!this.apiKey, 'proxy:', !!this.proxyOrigin);
    const response = await this.client.get('/api/Library');
    console.log('[KavitaAPI] getLibraries() response status:', response.status, 'data type:', typeof response.data, 'isArray:', Array.isArray(response.data));
    if (__DEV__ && response.data) {
      console.log('[KavitaAPI] getLibraries() response data:', JSON.stringify(response.data).substring(0, 500));
    }
    return response.data;
  }

  // ── Series ──────────────────────────────────────────────────────────────────

  async getSeriesForLibrary(libraryId: number, page = 0, pageSize = 30): Promise<Series[]> {
    // Kavita v0.7+ uses `libraries` (array); older versions use `libraryId` (scalar).
    // Send both so we work with either version.
    const response = await this.client.post('/api/Series/all', {
      libraries: [libraryId],
      libraryId,
      pageNumber: page,
      pageSize,
    });
    return response.data;
  }

  async getAllSeries(page = 0, pageSize = 30): Promise<Series[]> {
    const response = await this.client.post('/api/Series/all', {
      pageNumber: page,
      pageSize,
    });
    return response.data;
  }

  async updateSeries(series: Partial<Series> & { id: number; [key: string]: any }): Promise<void> {
    await this.client.post('/api/Series/update', series);
  }

  async getSeriesDetail(seriesId: number): Promise<SeriesDetail> {
    const [seriesRes, volumesRes] = await Promise.all([
      this.client.get(`/api/Series/${seriesId}`),
      this.client.get(`/api/Series/volumes?seriesId=${seriesId}`),
    ]);
    return { ...seriesRes.data, volumes: volumesRes.data };
  }

  async getChapter(chapterId: number): Promise<Chapter> {
    const response = await this.client.get(`/api/Chapter?chapterId=${chapterId}`);
    return response.data;
  }

  // ── Book (EPUB/PDF) reader ───────────────────────────────────────────────────

  async getBookInfo(chapterId: number): Promise<KavitaBookInfo> {
    const key = this.apiKey;
    const url = `/api/Reader/image?bookId=${chapterId}&pageNum=0&apiKey=${key}`;
    const response = await this.client.get(url);
    return response.data;
  }

  async getBookPage(chapterId: number, page: number): Promise<string> {
    const url = `/api/Book/${chapterId}/book-page?page=${page}&apiKey=${this.apiKey}`;
    const response = await this.client.get(url, { responseType: 'text' });
    return response.data;
  }

  async getBookToc(chapterId: number): Promise<BookTocEntry[]> {
    try {
      const response = await this.client.get(`/api/Book/${chapterId}/chapters`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      // Some Kavita versions return 500 on this endpoint
      // Return empty TOC so the reader can still load
      console.warn(`[KavitaAPI] Failed to get TOC for chapter ${chapterId}:`, error?.response?.status);
      return [];
    }
  }

  async getChapterInfo(chapterId: number): Promise<ChapterInfo> {
    const response = await this.client.get(`/api/Reader/chapter-info?chapterId=${chapterId}`);
    // Kavita's chapter-info response does not include the chapterId itself — inject it.
    return {
      ...response.data,
      chapterId,
      pages: response.data.pages || response.data.pagesCount || 0,
      lastReadPage: response.data.lastReadPage ?? 0
    };
  }

  // ── Series Metadata ──────────────────────────────────────────────────────────

  async getSeriesMetadata(seriesId: number): Promise<SeriesMetadata | null> {
    try {
      const response = await this.client.get(`/api/Series/metadata?seriesId=${seriesId}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async updateSeriesMetadata(metadata: SeriesMetadata): Promise<void> {
    await this.client.post('/api/Series/metadata', { seriesMetadata: metadata });
  }

  // ── Collections ─────────────────────────────────────────────────────────────

  async getCollections(): Promise<Collection[]> {
    try {
      const response = await this.client.get('/api/Collection');
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  async getSeriesForCollection(collectionId: number): Promise<Series[]> {
    const response = await this.client.get('/api/Series/series-by-collection', {
      params: { collectionId },
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async addSeriesToCollection(collectionId: number, seriesId: number): Promise<void> {
    await this.client.post('/api/Collection/update-for-series', {
      collectionTagId: collectionId,
      collectionTagTitle: '',
      seriesIds: [seriesId],
    });
  }

  async removeSeriesFromCollection(collection: Collection, seriesId: number): Promise<void> {
    await this.client.post('/api/Collection/update-series', {
      tag: collection,
      seriesIdsToRemove: [seriesId],
    });
  }

  // ── Metadata — genres & tags ─────────────────────────────────────────────────

  async getGenres(libraryId?: number): Promise<Genre[]> {
    try {
      const params = libraryId ? { libraryIds: libraryId } : {};
      const response = await this.client.get('/api/Metadata/genres', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  async getTags(libraryId?: number): Promise<Tag[]> {
    try {
      const params = libraryId ? { libraryIds: libraryId } : {};
      const response = await this.client.get('/api/Metadata/tags', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  async removeGenreFromAllSeries(genreId: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    const allSeries = await this.getSeriesByGenre(genreId, 0, 500);
    for (let i = 0; i < allSeries.length; i++) {
      const meta = await this.getSeriesMetadata(allSeries[i].id);
      if (!meta) continue;
      const updated = { ...meta, genres: meta.genres.filter(g => g.id !== genreId) };
      await this.updateSeriesMetadata(updated);
      onProgress?.(i + 1, allSeries.length);
    }
  }

  async removeTagFromAllSeries(tagId: number, onProgress?: (done: number, total: number) => void): Promise<void> {
    const allSeries = await this.getSeriesByTag(tagId, 0, 500);
    for (let i = 0; i < allSeries.length; i++) {
      const meta = await this.getSeriesMetadata(allSeries[i].id);
      if (!meta) continue;
      const updated = { ...meta, tags: meta.tags.filter(t => t.id !== tagId) };
      await this.updateSeriesMetadata(updated);
      onProgress?.(i + 1, allSeries.length);
    }
  }

  async getSeriesByGenre(genreId: number, page = 0, pageSize = 30): Promise<Series[]> {
    const response = await this.client.post('/api/Series/all', {
      genres: [genreId],
      pageNumber: page,
      pageSize,
    });
    return response.data;
  }

  async getSeriesByTag(tagId: number, page = 0, pageSize = 30): Promise<Series[]> {
    const response = await this.client.post('/api/Series/all', {
      tags: [tagId],
      pageNumber: page,
      pageSize,
    });
    return response.data;
  }

  async addGenreToSeries(seriesId: number, genre: { id: number; title: string }): Promise<void> {
    const meta = await this.getSeriesMetadata(seriesId);
    if (!meta) return;
    // Check if genre already exists
    if (meta.genres.some(g => g.id === genre.id || g.title.toLowerCase() === genre.title.toLowerCase())) return;
    const updated = { ...meta, genres: [...meta.genres, genre] };
    await this.updateSeriesMetadata(updated);
  }

  async addTagToSeries(seriesId: number, tag: { id: number; title: string }): Promise<void> {
    const meta = await this.getSeriesMetadata(seriesId);
    if (!meta) return;
    // Check if tag already exists
    if (meta.tags.some(t => t.id === tag.id || t.title.toLowerCase() === tag.title.toLowerCase())) return;
    const updated = { ...meta, tags: [...meta.tags, tag] };
    await this.updateSeriesMetadata(updated);
  }

  // ── Reading progress ─────────────────────────────────────────────────────────

  async getReadingProgress(chapterId: number): Promise<number> {
    try {
      const res = await this.client.get(`/api/Reader/get-progress?chapterId=${chapterId}`);
      return res.data?.pageNum ?? 0;
    } catch {
      return 0;
    }
  }

  async saveReadingProgress(chapter: any, page: number) {
    if (!chapter?.chapterId) return;
    try {
      const payload = {
        libraryId: parseInt(chapter.libraryId, 10),
        seriesId: parseInt(chapter.seriesId, 10),
        volumeId: parseInt(chapter.volumeId, 10),
        chapterId: parseInt(chapter.chapterId, 10),
        pageNum: parseInt(page.toString(), 10),
        isRead: false,
      };
      await this.client.post(`/api/Reader/progress?apiKey=${this.apiKey}`, payload);
    } catch (err: any) {
      console.error('Kavita Progress Sync Failed:', err.response?.status, err.response?.data || err.message);
    }
  }

  // ── File health ──────────────────────────────────────────────────────────────

  async scanLibrary(libraryId: number): Promise<void> {
    await this.client.post(`/api/Library/scan?libraryId=${libraryId}&force=true`);
  }

  async scanAllLibraries(): Promise<void> {
    await this.client.post('/api/Library/scan-all');
  }

  async analyzeFiles(): Promise<void> {
    await this.client.post('/api/Admin/analyze-files');
  }

  // ── Cover upload ─────────────────────────────────────────────────────────────

  async uploadSeriesCover(seriesId: number, base64DataUrl: string): Promise<void> {
    // Strip data URL prefix — Kavita expects raw base64
    const url = base64DataUrl.startsWith('data:')
      ? base64DataUrl.replace(/^data:[^;]+;base64,/, '')
      : base64DataUrl;
    try {
      await this.client.post('/api/Upload/series', { id: seriesId, url });
    } catch (e: any) {
      const kavitaMsg = e?.response?.data?.title ?? e?.response?.data ?? e?.message ?? 'Unknown error';
      throw new Error(`Cover upload failed: ${kavitaMsg}`);
    }
  }

  async uploadSeriesCoverFromUrl(seriesId: number, imageUrl: string): Promise<void> {
    const response = await fetch('/cover-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesId, imageUrl, token: this.jwtToken }),
    });
    const json = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (!json.ok && json.status !== 200) {
      const detail = json.body ? `Kavita ${json.status}: ${json.body}` : (json.error ?? `Upload failed (${response.status})`);
      throw new Error(detail);
    }
  }

  // ── Cover image URLs ─────────────────────────────────────────────────────────

  getSeriesCoverUrl(seriesId: number): string {
    return `${this.serverUrl}/api/image/series-cover?seriesId=${seriesId}&apiKey=${this.apiKey}`;
  }

  getChapterCoverUrl(chapterId: number): string {
    return `${this.serverUrl}/api/image/chapter-cover?chapterId=${chapterId}&apiKey=${this.apiKey}`;
  }

  getVolumeCoverUrl(volumeId: number): string {
    return `${this.serverUrl}/api/image/volume-cover?volumeId=${volumeId}&apiKey=${this.apiKey}`;
  }

  getLibraryCoverUrl(libraryId: number): string {
    return `${this.serverUrl}/api/image/library-cover?libraryId=${libraryId}&apiKey=${this.apiKey}`;
  }

  getCollectionCoverUrl(collectionId: number): string {
    return `${this.serverUrl}/api/image/collection-cover?collectionTagId=${collectionId}&apiKey=${this.apiKey}`;
  }

  // ── Reader URLs ──────────────────────────────────────────────────────────────

  getPdfReaderUrl(chapterId: number): string {
    const targetUrl = `${this.serverUrl}/api/Reader/pdf?chapterId=${chapterId}&apiKey=${this.apiKey}`;
    if (this.proxyOrigin) {
      return `${this.proxyOrigin}${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  getEpubReaderUrl(chapterId: number): string {
    const targetUrl = `${this.serverUrl}/api/Reader/epub?chapterId=${chapterId}&apiKey=${this.apiKey}`;
    if (this.proxyOrigin) {
      return `${this.proxyOrigin}${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  getPdfPageImageUrl(chapterId: number, page: number): string {
    const targetUrl = `${this.serverUrl}/api/Reader/image?bookId=${chapterId}&pageNum=${page}&apiKey=${this.apiKey}`;
    if (this.proxyOrigin) {
      return `${this.proxyOrigin}${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  // ── Bookmarks ────────────────────────────────────────────────────────────────

  async bookmarkPage(chapterId: number, page: number, seriesId: number, volumeId: number) {
    try {
      await this.client.post('/api/Reader/bookmark', {
        chapterId, pageNum: page, seriesId, volumeId,
      });
    } catch (e) {
      console.error('Failed to bookmark page', e);
    }
  }

  // ── Recently read ────────────────────────────────────────────────────────────

  async getOnDeckSeries(pageNumber = 1, pageSize = 20) {
    try {
      // Notice this is a .post(), not a .get()
      const res = await this.client.post('/api/Series/on-deck', 
        {}, // Empty body (unless you are applying specific library filters)
        {
          params: {
            pageNumber,
            pageSize,
            libraryId: 0 // 0 means "all libraries"
          }
        }
      );
      return res.data; 
    } catch (error) {
      console.error('Failed to fetch On Deck series:', error);
      return [];
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  async search(query: string): Promise<any> {
    try {
      const cleaned = query.replace(/["""''`]/g, '').trim();
      const response = await this.client.get(
        `/api/Search/search?queryString=${encodeURIComponent(cleaned)}`
      );
      return response.data;
    } catch {
      return { series: [], collections: [], readingLists: [] };
    }
  }
}

export const kavitaAPI = new KavitaAPI();
