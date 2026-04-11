import { LibraryProvider } from './LibraryProvider';
import { kavitaProvider } from './KavitaProvider';
import { audiobookshelfProvider } from './AudiobookshelfProvider';

export const LibraryFactory = {
  getProvider(type: 'kavita' | 'abs'): LibraryProvider {
    switch (type) {
      case 'kavita':
        return kavitaProvider;
      case 'abs':
        return audiobookshelfProvider;
      default:
        // Default to Kavita for now or throw error
        return kavitaProvider;
    }
  }
};
