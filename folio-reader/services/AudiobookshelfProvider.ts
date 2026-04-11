import { absAPI, ABSLibraryItem } from './audiobookshelfAPI';
import { 
  LibraryProvider, 
  LibrarySeriesDetail, 
  LibraryGenre, 
  LibraryTag, 
  LibraryCollection,
  LibraryVolume,
  LibraryItem,
  LibraryMediaType,
  LibraryItemParams,
  LibraryCover,
  Library
} from './LibraryProvider';

export class AudiobookshelfProvider implements LibraryProvider {
  async initialize(): Promise<void> {
    await absAPI.initialize();
  }

  async isAuthenticated(): Promise<boolean> {
    const hasCreds = absAPI.hasCredentials();
    if (!hasCreds) return false;
    try {
      return await absAPI.ping();
    } catch {
      return false;
    }
  }

  async getLibraries(): Promise<Library[]> {
    const libs = await absAPI.getLibraries();
    console.log('[AudiobookshelfProvider] getLibraries returning', libs.length, 'libraries');
    return libs.map(l => ({ id: l.id, name: l.name, type: l.mediaType === 'book' ? 0 : 1 }));
  }

  async getLibraryItems(params?: LibraryItemParams): Promise<LibraryItem[]> {
    const { libraryId, page = 0, limit = 40 } = params || {};
    console.log('[AudiobookshelfProvider] getLibraryItems called with libraryId:', libraryId, 'page:', page, 'limit:', limit);
    
    if (libraryId) {
      console.log('[AudiobookshelfProvider] Fetching specific library:', libraryId);
      const { items, total } = await absAPI.getLibraryItems(libraryId, page, limit);
      console.log('[AudiobookshelfProvider] Got', items.length, 'items, total:', total);
      const mapped = items.map(item => this.mapABSToLibraryItem(item));
      console.log('[AudiobookshelfProvider] Mapped to', mapped.length, 'LibraryItems');
      return mapped;
    }

    const libraries = await absAPI.getLibraries();
    console.log('[AudiobookshelfProvider] Got', libraries.length, 'libraries');
    libraries.forEach(lib => console.log('  -', lib.name, '(mediaType:', lib.mediaType, ', id:', lib.id, ')'));
    
    const allItems: LibraryItem[] = [];
    
    // Fetch from all libraries (ABS can have 'book' or 'podcast' mediaTypes)
    for (const lib of libraries) {
      console.log('[AudiobookshelfProvider] Fetching from library:', lib.name, '(mediaType:', lib.mediaType, ')');
      const { items } = await absAPI.getLibraryItems(lib.id, page, limit);
      console.log('[AudiobookshelfProvider] Got', items.length, 'items from', lib.name);
      allItems.push(...items.map(item => this.mapABSToLibraryItem(item)));
    }
    
    console.log('[AudiobookshelfProvider] Returning total of', allItems.length, 'items');
    return allItems;
  }

  async search(query: string): Promise<LibraryItem[]> {
    const results = await absAPI.search(query);
    return (results.series || []).map((s: any) => ({
      id: s.id,
      title: s.name,
      coverImage: s.id,
      mediaType: 'audiobook' as LibraryMediaType,
      author: s.media?.metadata?.authorName,
      progress: (s.pagesRead || 0) / 100, // ABS search helper returns progress out of 100
      provider: 'abs'
    }));
  }

  async getSeriesDetail(id: string | number): Promise<LibrarySeriesDetail> {
    const itemId = String(id);
    const item = await absAPI.getLibraryItem(itemId);
    const meta = item.media.metadata;
    
    return {
      id: item.id,
      name: meta.title || '',
      localizedName: meta.title,
      description: meta.description,
      summary: meta.description,
      coverImage: item.id,
      authorName: meta.authorName,
      narratorName: meta.narrator,
      mediaType: 'audiobook',
      genres: (meta.genres || []).map((g: string, i: number) => ({ id: `genre-${i}`, title: g })),
      tags: (meta.tags || []).map((t: string, i: number) => ({ id: `tag-${i}`, title: t })),
      totalDuration: item.media.duration,
      durationFormatted: this.formatDuration(item.media.duration),
      volumes: [{
        id: item.id,
        number: 1,
        name: meta.title || 'Book',
        pages: 0,
        pagesRead: 0,
        coverImage: item.id,
        chapters: []
      }]
    };
  }

  async updateSeriesMetadata(metadata: Partial<LibrarySeriesDetail>): Promise<void> {
    if (!metadata.id) return;
    await absAPI.updateMetadata(String(metadata.id), {
      title: metadata.name,
      description: metadata.summary,
      genres: metadata.genres?.map(g => g.title),
      tags: metadata.tags?.map(t => t.title),
      authorName: metadata.authorName
    });
  }

  async getSeriesCovers(id: string | number): Promise<LibraryCover[]> {
    const itemId = String(id);
    return [{ url: absAPI.getCoverUrl(itemId), id: 'current' }];
  }

  async updateSeriesCover(id: string | number, coverUrl: string): Promise<void> {
    const itemId = String(id);
    await absAPI.updateCoverUrl(itemId, coverUrl);
  }

  async getGenres(): Promise<LibraryGenre[]> {
    try {
      const libraries = await absAPI.getLibraries();
      const allGenres = new Set<string>();
      for (const lib of libraries) {
        const res = await absAPI.getLibraryFilterData(lib.id);
        const genres = res?.genres || [];
        genres.forEach((g: string) => allGenres.add(g));
      }
      return Array.from(allGenres).map((g, i) => ({ id: `genre-${i}`, title: g }));
    } catch (e) {
      console.error('Failed to fetch ABS genres', e);
      return [];
    }
  }

  async getTags(): Promise<LibraryTag[]> {
    try {
      const libraries = await absAPI.getLibraries();
      const allTags = new Set<string>();
      for (const lib of libraries) {
        const res = await absAPI.getLibraryFilterData(lib.id);
        const tags = res?.tags || [];
        tags.forEach((t: string) => allTags.add(t));
      }
      return Array.from(allTags).map((t, i) => ({ id: `tag-${i}`, title: t }));
    } catch (e) {
      console.error('Failed to fetch ABS tags', e);
      return [];
    }
  }

  async getCollections(): Promise<LibraryCollection[]> {
    try {
      const collections = await absAPI.getCollections();
      return collections.map((c: any) => ({
        id: c.id,
        title: c.name,
        summary: c.description,
        coverImage: c.id
      }));
    } catch (e) {
      console.error('Failed to fetch ABS collections', e);
      return [];
    }
  }

  async addSeriesToCollection(collectionId: number | string, seriesId: number | string): Promise<void> {
    await absAPI.addItemToCollection(String(collectionId), String(seriesId));
  }

  async removeSeriesFromCollection(collectionId: number | string, seriesId: number | string): Promise<void> {
    await absAPI.removeItemFromCollection(String(collectionId), String(seriesId));
  }

  async getSeriesInCollection(collectionId: number | string): Promise<{ id: number | string }[]> {
    try {
      const data = await absAPI.getCollection(String(collectionId));
      const items = data?.libraryItems || [];
      return items.map((s: any) => ({ id: s.id }));
    } catch (e) {
      console.error('Failed to fetch items in ABS collection', e);
      return [];
    }
  }

  getCoverUrl(id: string | number): string {
    return absAPI.getCoverUrl(String(id));
  }

  private mapABSToLibraryItem(item: ABSLibraryItem): LibraryItem {
    return {
      id: item.id,
      title: item.media.metadata.title || 'Unknown Title',
      subtitle: item.media.metadata.authorName,
      description: item.media.metadata.description,
      coverImage: item.id,
      mediaType: 'audiobook',
      author: item.media.metadata.authorName,
      narrator: item.media.metadata.narrator,
      duration: item.media.duration,
      durationFormatted: this.formatDuration(item.media.duration),
      progress: item.userMediaProgress?.progress || 0,
      isRead: item.userMediaProgress?.isFinished || false,
      provider: 'abs'
    };
  }

  private formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

export const audiobookshelfProvider = new AudiobookshelfProvider();
