import { SearchProvider, SearchMetadataResult } from './SearchProvider';
import { storage } from './storage';
import { STORAGE_KEYS } from '../constants/config';

export class GoogleBooksSearchProvider implements SearchProvider {
  getSourceName(): string {
    return 'Google Books';
  }

  getSourceId(): string {
    return 'google';
  }

  private async buildSearchUrl(query: string, limit: number): Promise<string> {
    const apiKey = await storage.getItem(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY);
    // Get browser locale or default to US
    const country = typeof navigator !== 'undefined'
      ? (navigator.language?.split('-')[1] || 'US')
      : 'US';

    let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}&printType=books&country=${country}`;

    if (apiKey) {
      url += `&key=${encodeURIComponent(apiKey)}`;
    }

    return url;
  }

  async search(query: string, limit = 8): Promise<{ results: SearchMetadataResult[]; warning?: string }> {
    const url = await this.buildSearchUrl(query, limit);

    try {
      const res = await fetch(`/proxy?url=${encodeURIComponent(url)}`);

      if (!res.ok) {
        let warn = `Google Books search returned ${res.status}`;
        if (res.status === 403) {
          warn = 'Google Books access denied. Try adding an API key in Settings > Google Books Search.';
        } else if (res.status === 429) {
          warn = 'Google Books rate-limited (too many requests)';
        }
        return { results: [], warning: warn };
      }

      const json = await res.json();
      const results = (json.items ?? []).map((item: any): SearchMetadataResult => {
        const v = item.volumeInfo ?? {};
        const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
        const thumbHttps = thumb ? thumb.replace('http://', 'https://') : undefined;
        
        return {
          source: this.getSourceId(),
          id: `gb-${item.id}`,
          externalId: item.id,
          title: v.title ?? '',
          authors: v.authors ?? [],
          year: v.publishedDate ? parseInt(v.publishedDate) : undefined,
          description: v.description,
          genres: (v.categories ?? [])
            .flatMap((c: string) => c.split('/'))
            .map((s: string) => s.trim())
            .filter(Boolean),
          publisher: v.publisher,
          coverUrl: thumbHttps ? `/proxy?url=${encodeURIComponent(thumbHttps)}` : undefined,
          coverUploadUrl: thumbHttps,
        };
      });

      return { results };
    } catch (e: any) {
      console.error('Google Books search failed', e);
      return { 
        results: [], 
        warning: `Google Books search failed: ${e?.message ?? 'unknown error'}` 
      };
    }
  }
}

export const googleBooksSearchProvider = new GoogleBooksSearchProvider();
