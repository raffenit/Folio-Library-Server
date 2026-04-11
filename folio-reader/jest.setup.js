import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock for expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSearchParams: () => ({}),
  Stack: {
    Screen: jest.fn(() => null),
  },
}));

// Mock for Storage (SecureStore)
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock for Kavita API
jest.mock('./services/kavitaAPI', () => ({
  kavitaAPI: {
    getSeriesMetadata: jest.fn(),
    getSeriesDetail: jest.fn(),
    updateSeriesMetadata: jest.fn(),
    getSeriesCoverUrl: jest.fn(),
    uploadSeriesCover: jest.fn(),
    uploadSeriesCoverFromUrl: jest.fn(),
    getGenres: jest.fn(),
    getTags: jest.fn(),
    getCollections: jest.fn(),
    addSeriesToCollection: jest.fn(),
    removeSeriesFromCollection: jest.fn(),
    getSeriesForCollection: jest.fn(),
    isAuthenticated: jest.fn(),
    initialize: jest.fn(),
  },
}));

// Mock for Audiobookshelf API
jest.mock('./services/audiobookshelfAPI', () => ({
  absAPI: {
    getLibraryItem: jest.fn(),
    updateMetadata: jest.fn(),
    getCoverUrl: jest.fn(),
    updateCoverUrl: jest.fn(),
    getLibraries: jest.fn(),
    getLibraryItems: jest.fn(),
    search: jest.fn(),
    ping: jest.fn(),
    hasCredentials: jest.fn(),
    initialize: jest.fn(),
  },
}));
