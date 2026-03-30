import axios, { AxiosInstance } from 'axios';
import { storage } from './storage';

const STORAGE_KEYS = {
  SERVER_URL: 'kavita_server_url',
  API_KEY: 'kavita_api_key',
  JWT_TOKEN: 'kavita_jwt_token',
};

export interface Library {
  id: number;
  name: string;
  type: number; // 0=Manga, 1=Comic, 2=Book
  coverImage?: string;
  series: number;
}

export interface Series {
  id: number;
  name: string;
  originalName: string;
  localizedName: string;
  sortName: string;
  summary?: string;
  coverImage?: string;
  libraryId: number;
  libraryName?: string;
  pagesRead: number;
  pages: number;
  userRating: number;
  format: number; // 0=Unknown, 1=Archive, 2=Unknown, 3=Epub, 4=PDF
  created: string;
  lastModified: string;
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
  format: number;
}

export interface SeriesDetail {
  id: number;
  name: string;
  summary?: string;
  coverImage?: string;
  volumes: Volume[];
}

class KavitaAPI {
  private client: AxiosInstance;
  private serverUrl: string = '';
  private apiKey: string = '';
  private jwtToken: string = '';

  constructor() {
    this.client = axios.create({
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      if (this.jwtToken) {
        config.headers.Authorization = `Bearer ${this.jwtToken}`;
      }
      return config;
    });
  }

  async initialize() {
    try {
      this.serverUrl = (await storage.getItem(STORAGE_KEYS.SERVER_URL)) || '';
      this.apiKey = (await storage.getItem(STORAGE_KEYS.API_KEY)) || '';
      this.jwtToken = (await storage.getItem(STORAGE_KEYS.JWT_TOKEN)) || '';
      if (this.serverUrl) {
        this.client.defaults.baseURL = this.serverUrl.replace(/\/$/, '');
      }
    } catch (e) {
      console.error('Failed to initialize KavitaAPI from storage', e);
    }
  }

  async saveCredentials(serverUrl: string, apiKey: string) {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    this.serverUrl = cleanUrl;
    this.apiKey = apiKey;
    this.client.defaults.baseURL = cleanUrl;
    await storage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
    await storage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  }

  async login(): Promise<boolean> {
    const response = await this.client.post('/api/Plugin/authenticate', null, {
      params: {
        apiKey: this.apiKey,
        pluginName: 'KavitaReaderApp',
      },
    });
    console.log('[KavitaAPI] login response status:', response.status);
    console.log('[KavitaAPI] login response data:', JSON.stringify(response.data));
    if (response.data?.token) {
      this.jwtToken = response.data.token;
      await storage.setItem(STORAGE_KEYS.JWT_TOKEN, this.jwtToken);
      return true;
    }
    return false;
  }

  async logout() {
    this.jwtToken = '';
    this.apiKey = '';
    this.serverUrl = '';
    await storage.deleteItem(STORAGE_KEYS.JWT_TOKEN);
    await storage.deleteItem(STORAGE_KEYS.API_KEY);
    await storage.deleteItem(STORAGE_KEYS.SERVER_URL);
  }

  isAuthenticated(): boolean {
    return !!this.jwtToken;
  }

  hasCredentials(): boolean {
    return !!this.serverUrl && !!this.apiKey;
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  getToken(): string {
    return this.jwtToken;
  }

  // Libraries
  async getLibraries(): Promise<Library[]> {
    const response = await this.client.get('/api/Library');
    return response.data;
  }

  // Series
  async getSeriesForLibrary(libraryId: number, page = 0, pageSize = 30): Promise<Series[]> {
    const response = await this.client.post('/api/Series/all', {
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

  async getSeriesDetail(seriesId: number): Promise<SeriesDetail> {
    const [seriesRes, volumesRes] = await Promise.all([
      this.client.get(`/api/Series/${seriesId}`),
      this.client.get(`/api/Series/volumes?seriesId=${seriesId}`),
    ]);
    return {
      ...seriesRes.data,
      volumes: volumesRes.data,
    };
  }

  async getChapter(chapterId: number): Promise<Chapter> {
    const response = await this.client.get(`/api/Chapter?chapterId=${chapterId}`);
    return response.data;
  }

  // Reading progress
  async saveReadingProgress(chapterId: number, page: number, seriesId: number, volumeId: number) {
    try {
      await this.client.post('/api/Reader/progress', {
        chapterId,
        pageNum: page,
        seriesId,
        volumeId,
      });
    } catch (e) {
      console.error('Failed to save reading progress', e);
    }
  }

  // Cover images
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

  // Reader URLs
  getPdfReaderUrl(chapterId: number): string {
    return `${this.serverUrl}/api/Reader/pdf?chapterId=${chapterId}&apiKey=${this.apiKey}`;
  }

  getEpubReaderUrl(chapterId: number): string {
    return `${this.serverUrl}/api/Reader/epub?chapterId=${chapterId}&apiKey=${this.apiKey}`;
  }

  // Bookmark a page
  async bookmarkPage(chapterId: number, page: number, seriesId: number, volumeId: number) {
    try {
      await this.client.post('/api/Reader/bookmark', {
        chapterId,
        pageNum: page,
        seriesId,
        volumeId,
      });
    } catch (e) {
      console.error('Failed to bookmark page', e);
    }
  }

  // Recently read
  async getRecentlyRead(): Promise<any[]> {
    try {
      const response = await this.client.post('/api/Series/recently-read', {
        pageNumber: 0,
        pageSize: 20,
      });
      return response.data;
    } catch (e) {
      return [];
    }
  }

  // Search
  async search(query: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/Search/search?queryString=${encodeURIComponent(query)}`);
      return response.data;
    } catch (e) {
      return { series: [], collections: [], readingLists: [] };
    }
  }
}

export const kavitaAPI = new KavitaAPI();
