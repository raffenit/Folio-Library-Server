import { SearchProvider, SearchMetadataResult } from './SearchProvider';
import { proxyUrl } from '@/config/proxy';

/**
 * Audible Search Provider
 * Uses iTunes Search API to find Audible audiobooks with high-quality covers
 * iTunes API is free, requires no API key, and returns excellent cover artwork
 */
export class AudibleSearchProvider implements SearchProvider {
  getSourceName(): string {
    return 'Audible';
  }

  getSourceId(): string {
    return 'audible';
  }

  async search(query: string, limit = 12): Promise<{ results: SearchMetadataResult[]; warning?: string }> {
    // iTunes Search API for audiobooks
    // media=audiobook returns Audible content with high-quality artwork
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=audiobook&entity=audiobook&limit=${limit}`;
    
    try {
      // Note: We use the local proxy to bypass CORS
      const res = await fetch(proxyUrl(url));
      
      if (!res.ok) {
        return { 
          results: [], 
          warning: `Audible search returned ${res.status}` 
        };
      }

      const json = await res.json();
      const results = (json.results ?? []).map((item: any): SearchMetadataResult => {
        // iTunes provides artwork in multiple sizes
        // artworkUrl100 -> 100x100, artworkUrl600 -> 600x600
        const coverUrl = item.artworkUrl600 || item.artworkUrl100 || undefined;
        
        return {
          source: this.getSourceId(),
          id: `aud-${item.collectionId || item.trackId}`,
          externalId: String(item.collectionId || item.trackId),
          title: item.collectionName || item.trackName || '',
          authors: item.artistName ? [item.artistName] : [],
          year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
          genres: item.primaryGenreName ? [item.primaryGenreName] : [],
          publisher: item.publisher || undefined,
          description: item.description || undefined,
          // Use the proxy for the cover URL to avoid CORS issues
          coverUrl: coverUrl ? proxyUrl(coverUrl) : undefined,
          coverUploadUrl: coverUrl,
        };
      });

      return { results };
    } catch (e: any) {
      console.error('Audible search failed', e);
      return { 
        results: [], 
        warning: `Audible search failed: ${e?.message ?? 'unknown error'}` 
      };
    }
  }
}

export const audibleSearchProvider = new AudibleSearchProvider();
