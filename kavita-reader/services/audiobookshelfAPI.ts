import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { storage } from './storage';

function isProxyMode(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window as any).__KAVITA_PROXY__ === true
  );
}

const STORAGE_KEYS = {
  SERVER_URL: 'abs_server_url',
  API_KEY:    'abs_api_key',
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

  constructor() {
    // 1. Pull the URL from the environment variable as a persistent default
    const envUrl = process.env.EXPO_PUBLIC_ABS_URL || '';
    
    this.client = axios.create({ 
      baseURL: envUrl, 
      timeout: 30000 
    });

    this.client.interceptors.request.use((config) => {
      // 2. Clearer logging to distinguish between Kavita and ABS calls
      if (__DEV__) {
        console.log(`[ABS Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      }

      if (this.apiKey) {
        // ABS uses Bearer token authentication
        config.headers.Authorization = `Bearer ${this.apiKey}`;
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

      if (finalUrl && storedKey) {
        this.setServer(finalUrl, storedKey);
      }
    } catch (e) {
      console.error('Failed to initialize AudiobookshelfAPI', e);
    }
  }

  private setServer(url: string, key: string) {
    let clean = url.trim().replace(/\/$/, '');
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

    if (isProxyMode()) {
      this.serverUrl = '';
      this.client.defaults.baseURL = '';
      return;
    }
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
    const res = await this.client.get('/api/libraries');
    return res.data.libraries ?? [];
  }

  async getLibraryItems(libraryId: string, page = 0, limit = 50): Promise<{ items: ABSLibraryItem[]; total: number }> {
    const res = await this.client.get(`/api/libraries/${libraryId}/items`, {
      params: { page, limit, sort: 'media.metadata.title', asc: 1, include: 'progress' },
    });
    return { items: res.data.results ?? [], total: res.data.total ?? 0 };
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
    const res = await this.client.get(`/api/items/${itemId}`, {
      params: { expanded: 1, include: 'progress' },
    });
    return res.data;
  }

  /** Open a playback session — ABS tracks position server-side */
  async startPlaybackSession(itemId: string, startTime = 0): Promise<ABSPlaybackSession> {
    const res = await this.client.post(`/api/items/${itemId}/play`, {
      deviceInfo: { clientName: 'Folio', deviceId: 'folio-reader-app' },
      forceDirectPlay: true,
      forceTranscode: false,
      startTime,
      mediaPlayer: 'folio-reader',
    });
    return res.data;
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

  getCoverUrl(itemId: string): string {
    return `${this.serverUrl}/api/items/${itemId}/cover?token=${this.apiKey}`;
  }

  /** Absolute URL for a track's contentUrl */
  resolveTrackUrl(contentUrl: string): string {
    if (/^https?:\/\//i.test(contentUrl)) return contentUrl;
    const path = contentUrl.startsWith('/') ? contentUrl : `/${contentUrl}`;
    return `${this.serverUrl}${path}?token=${this.apiKey}`;
  }
}

export const absAPI = new AudiobookshelfAPI();
