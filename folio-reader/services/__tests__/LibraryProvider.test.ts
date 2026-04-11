import { KavitaProvider } from '../KavitaProvider';
import { AudiobookshelfProvider } from '../AudiobookshelfProvider';
import { kavitaAPI } from '../kavitaAPI';
import { absAPI } from '../audiobookshelfAPI';

// Mocks are handled in jest.setup.js

describe('LibraryProviders', () => {
  describe('KavitaProvider', () => {
    let provider: KavitaProvider;

    beforeEach(() => {
      provider = new KavitaProvider();
      jest.clearAllMocks();
    });

    it('should fetch series detail correctly', async () => {
      (kavitaAPI.getSeriesDetail as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Test Series',
        volumes: []
      });
      (kavitaAPI.getSeriesMetadata as jest.Mock).mockResolvedValue({
        summary: 'Test Summary',
        genres: [{ id: 1, title: 'Sci-Fi' }],
        tags: [],
        writers: [{ name: 'Test Author' }]
      });

      const detail = await provider.getSeriesDetail(1);
      
      expect(detail.id).toBe(1);
      expect(detail.name).toBe('Test Series');
      expect(detail.authorName).toBe('Test Author');
      expect(detail.genres[0].title).toBe('Sci-Fi');
    });

    it('should upload cover from URL', async () => {
      await provider.updateSeriesCover(1, 'http://example.com/cover.jpg');
      expect(kavitaAPI.uploadSeriesCoverFromUrl).toHaveBeenCalledWith(1, 'http://example.com/cover.jpg');
    });
  });

  describe('AudiobookshelfProvider', () => {
    let provider: AudiobookshelfProvider;

    beforeEach(() => {
      provider = new AudiobookshelfProvider();
      jest.clearAllMocks();
    });

    it('should fetch series detail correctly', async () => {
      (absAPI.getLibraryItem as jest.Mock).mockResolvedValue({
        id: 'abs-1',
        media: {
          metadata: {
            title: 'Test Audiobook',
            authorName: 'Test Author',
            description: 'Test Summary'
          },
          duration: 1200
        }
      });

      const detail = await provider.getSeriesDetail('abs-1');
      
      expect(detail.id).toBe('abs-1');
      expect(detail.name).toBe('Test Audiobook');
      expect(detail.authorName).toBe('Test Author');
      expect(detail.totalDuration).toBe(1200);
    });

    it('should format duration correctly', async () => {
      (absAPI.getLibraryItem as jest.Mock).mockResolvedValue({
        id: 'abs-1',
        media: {
          metadata: { title: 'Test' },
          duration: 3661 // 1h 1m 1s
        }
      });

      const detail = await provider.getSeriesDetail('abs-1');
      expect(detail.durationFormatted).toBe('1:01:01');
    });
  });
});
