import { SearchProvider, SearchMetadataResult } from './SearchProvider';
import { proxyUrl } from '@/config/proxy';

export class OpenLibrarySearchProvider implements SearchProvider {
  getSourceName(): string {
    return 'Open Library';
  }

  getSourceId(): string {
    return 'openlibrary';
  }

  async search(query: string, limit = 12): Promise<{ results: SearchMetadataResult[]; warning?: string }> {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=${limit}`;
    try {
      // Note: We use the local proxy to bypass CORS
      const res = await fetch(proxyUrl(url));
      
      if (!res.ok) {
        return { 
          results: [], 
          warning: `Open Library search returned ${res.status}` 
        };
      }

      const json = await res.json();
      const results = (json.docs ?? []).map((doc: any): SearchMetadataResult => {
        const coverId = doc.cover_i;
        const thumb = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
        
        return {
          source: this.getSourceId(),
          id: `ol-${doc.key.replace('/works/', '')}`,
          externalId: doc.key,
          title: doc.title ?? '',
          authors: doc.author_name ?? [],
          year: doc.first_publish_year,
          genres: (doc.subject ?? []).slice(0, 5),
          publisher: doc.publisher?.[0],
          coverUrl: thumb ? proxyUrl(thumb) : undefined,
          coverUploadUrl: thumb,
        };
      });

      return { results };
    } catch (e: any) {
      console.error('Open Library search failed', e);
      return { 
        results: [], 
        warning: `Open Library search failed: ${e?.message ?? 'unknown error'}` 
      };
    }
  }
}

export const openLibrarySearchProvider = new OpenLibrarySearchProvider();
