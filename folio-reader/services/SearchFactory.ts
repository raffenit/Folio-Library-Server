import { SearchProvider } from './SearchProvider';
import { openLibrarySearchProvider } from './OpenLibrarySearchProvider';
import { googleBooksSearchProvider } from './GoogleBooksSearchProvider';
import { LibraryFactory } from './LibraryFactory';
import { LibraryItem, LibraryProvider } from './LibraryProvider';

export const SearchFactory = {
  getProvider(id: 'google' | 'openlibrary'): SearchProvider {
    switch (id) {
      case 'google':
        return googleBooksSearchProvider;
      case 'openlibrary':
        return openLibrarySearchProvider;
      default:
        return openLibrarySearchProvider;
    }
  },

  getAllProviders(): SearchProvider[] {
    return [googleBooksSearchProvider, openLibrarySearchProvider];
  },

  async globallySearch(query: string): Promise<LibraryItem[]> {
    const providers: LibraryProvider[] = [
      LibraryFactory.getProvider('kavita'),
      LibraryFactory.getProvider('abs')
    ];

    const results = await Promise.all(
      providers.map(async (p) => {
        try {
          if (await p.isAuthenticated()) {
            return await p.search(query);
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
