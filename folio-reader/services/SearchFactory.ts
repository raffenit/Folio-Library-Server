import { SearchProvider } from './SearchProvider';
import { openLibrarySearchProvider } from './OpenLibrarySearchProvider';
import { googleBooksSearchProvider } from './GoogleBooksSearchProvider';
import { audibleSearchProvider } from './AudibleSearchProvider';
import { LibraryFactory } from './LibraryFactory';
import { LibraryItem, LibraryProvider } from './LibraryProvider';

export const SearchFactory = {
  getProvider(id: 'google' | 'openlibrary' | 'audible'): SearchProvider {
    switch (id) {
      case 'google':
        return googleBooksSearchProvider;
      case 'openlibrary':
        return openLibrarySearchProvider;
      case 'audible':
        return audibleSearchProvider;
      default:
        return openLibrarySearchProvider;
    }
  },

  getAllProviders(): SearchProvider[] {
    return [googleBooksSearchProvider, openLibrarySearchProvider, audibleSearchProvider];
  },

  getAudiobookProviders(): SearchProvider[] {
    return [audibleSearchProvider, googleBooksSearchProvider];
  },

  async globallySearch(query: string): Promise<LibraryItem[]> {
    const providers: LibraryProvider[] = [
      LibraryFactory.getProvider('kavita'),
      LibraryFactory.getProvider('abs')
    ];

    const searchLower = query.toLowerCase().trim();

    const results = await Promise.all(
      providers.map(async (p) => {
        try {
          if (await p.isAuthenticated()) {
            // Get all library items and filter locally for better UX
            // This allows searching across titles, authors, AND genres
            const libraries = await p.getLibraries();
            const allItems: LibraryItem[] = [];

            for (const library of libraries) {
              const items = await p.getLibraryItems({ libraryId: String(library.id) });
              allItems.push(...items);
            }

            // Filter items by matching title, author, or genres
            return allItems.filter(item => {
              const titleMatch = item.title?.toLowerCase().includes(searchLower);
              const authorMatch = item.author?.toLowerCase().includes(searchLower);
              const genreMatch = item.genres?.some(g =>
                g.title?.toLowerCase().includes(searchLower)
              );

              return titleMatch || authorMatch || genreMatch;
            });
          }
          return [];
        } catch (e) {
          console.error(`Search failed for provider`, e);
          return [];
        }
      })
    );

    return results.flat();
  }
};
