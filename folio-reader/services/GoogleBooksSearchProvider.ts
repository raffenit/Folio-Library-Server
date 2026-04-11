import { SearchProvider, SearchMetadataResult } from './SearchProvider';

export class GoogleBooksSearchProvider implements SearchProvider {
  getSourceName(): string {
    return 'Google Books';
  }

  getSourceId(): string {
    return 'google';
  }

  async search(query: string, limit = 8): Promise<{ results: SearchMetadataResult[]; warning?: string }> {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}&printType=books`;
    
    try {
      const res = await fetch(`/proxy?url=${encodeURIComponent(url)}`);
      
      if (!res.ok) {
        let warn = `Google Books search returned ${res.status}`;
        if (res.status === 429) {
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
