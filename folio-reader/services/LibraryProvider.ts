export type LibraryMediaType = 'book' | 'audiobook';

export interface LibraryItem {
  id: string | number;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  mediaType: LibraryMediaType;
  author?: string;
  narrator?: string;
  duration?: number; // in seconds
  durationFormatted?: string;
  pages?: number;
  pagesRead?: number;
  progress?: number; // 0 to 1
  genres?: LibraryGenre[];
  tags?: LibraryTag[];
  releaseDate?: string;
  isRead?: boolean;
  provider?: 'kavita' | 'abs';
}

export interface LibraryVolume {
  id: number | string;
  number: number;
  name: string;
  chapters: LibraryChapter[];
  pagesRead: number;
  pages: number;
  coverImage?: string;
  releaseDate?: string;
}

export interface LibraryChapter {
  id: number | string;
  number: string | number;
  title: string;
  pages: number;
  pagesRead: number;
  coverImage?: string;
  volumeId: number | string;
}

export interface LibrarySeriesDetail {
  id: number | string;
  name: string;
  localizedName?: string;
  description?: string;
  summary?: string;
  coverImage?: string;
  authorName?: string;
  narratorName?: string;
  mediaType: LibraryMediaType;
  volumes: LibraryVolume[];
  genres: LibraryGenre[];
  tags: LibraryTag[];
  totalDuration?: number;
  durationFormatted?: string;
}

export interface LibraryGenre {
  id: number | string;
  title: string;
}

export interface LibraryTag {
  id: number | string;
  title: string;
}

export interface Library {
  id: number | string;
  name: string;
  type?: number;
}

export interface LibraryCollection {
  id: number | string;
  title: string;
  summary?: string;
  coverImage?: string;
}


export interface LibraryItemParams {
  libraryId?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  sort?: string;
  desc?: boolean;
  genreId?: number | string;
  tagId?: number | string;
}

export interface LibraryCover {
  id: string | number;
  url: string;
}

export interface LibraryProvider {
  /**
   * Fetch all library items (optional filtering)
   */
  getLibraries(): Promise<Library[]>;
  getLibraryItems(params: LibraryItemParams): Promise<LibraryItem[]>;
  search(query: string): Promise<LibraryItem[]>;
  /**
   * Fetch full details for a series (metadata, volumes, chapters)
   */
  getSeriesDetail(id: string | number): Promise<LibrarySeriesDetail>;

  /**
   * Update the metadata for a series
   */
  updateSeriesMetadata(metadata: Partial<LibrarySeriesDetail>): Promise<void>;

  /**
   * Get available covers for a series (server-side covers)
   */
  getSeriesCovers(id: string | number): Promise<LibraryCover[]>;

  /**
   * Update the cover for a series using a URL
   */
  updateSeriesCover(id: string | number, coverUrl: string): Promise<void>;

  /**
   * Taxonomy methods
   */
  getGenres(): Promise<LibraryGenre[]>;
  getTags(): Promise<LibraryTag[]>;
  getCollections(): Promise<LibraryCollection[]>;

  /**
   * Collection management
   */
  addSeriesToCollection(collectionId: number | string, seriesId: number | string): Promise<void>;
  removeSeriesFromCollection(collectionId: number | string, seriesId: number | string): Promise<void>;
  getSeriesInCollection(collectionId: number | string): Promise<{ id: number | string }[]>;

  /**
   * Helper to resolve cover URLs
   */
  getCoverUrl(id: string | number): string;

  /**
   * Check authentication status
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Initialize provider (load settings, etc.)
   */
  initialize(): Promise<void>;
}
