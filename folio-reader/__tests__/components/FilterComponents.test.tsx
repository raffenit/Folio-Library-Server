import React from 'react';
import { render } from '@testing-library/react-native';
import { FilterSection, FilterTab, FilterRowNoLabel } from '../../components/FilterComponents';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock ThemeProvider for consistent testing
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('FilterComponents', () => {
  describe('FilterTab', () => {
    it('renders with label', () => {
      const { getByText } = render(
        <MockThemeProvider>
          <FilterTab label="Genre" active={false} onPress={() => {}} />
        </MockThemeProvider>
      );
      
      expect(getByText('Genre')).toBeTruthy();
    });
    
    it('renders in active state', () => {
      const { getByText } = render(
        <MockThemeProvider>
          <FilterTab label="Author" active={true} onPress={() => {}} />
        </MockThemeProvider>
      );
      
      expect(getByText('Author')).toBeTruthy();
    });
  });

  describe('FilterRowNoLabel', () => {
    const mockItems = [
      { id: '1', title: 'Fiction' },
      { id: '2', title: 'Non-Fiction' },
      { id: '3', title: 'Sci-Fi' },
    ];
    
    it('renders all items', () => {
      const { getByText } = render(
        <MockThemeProvider>
          <FilterRowNoLabel
            items={mockItems}
            selectedId={null}
            onSelect={() => {}}
          />
        </MockThemeProvider>
      );
      
      expect(getByText('Fiction')).toBeTruthy();
      expect(getByText('Non-Fiction')).toBeTruthy();
      expect(getByText('Sci-Fi')).toBeTruthy();
    });
    
    it('highlights selected item', () => {
      const { getByText } = render(
        <MockThemeProvider>
          <FilterRowNoLabel
            items={mockItems}
            selectedId="2"
            onSelect={() => {}}
          />
        </MockThemeProvider>
      );
      
      // Non-Fiction should be rendered (it's selected)
      expect(getByText('Non-Fiction')).toBeTruthy();
    });
  });

  describe('FilterSection', () => {
    const mockLibraries = [{ id: '1', title: 'Books' }];
    const mockGenres = [
      { id: '1', title: 'Fiction' },
      { id: '2', title: 'Non-Fiction' },
    ];
    const mockAuthors = [{ id: '1', title: 'Author 1' }];
    const mockTags = [{ id: '1', title: 'Tag 1' }];
    const mockCollections = [{ id: '1', title: 'Collection 1' }];
    
    it('renders with default tab (genre)', () => {
      const { getByText } = render(
        <MockThemeProvider>
          <FilterSection
            libraries={mockLibraries}
            genres={mockGenres}
            authors={mockAuthors}
            tags={mockTags}
            collections={mockCollections}
            selectedLibraryId={null}
            selectedGenreId={null}
            selectedAuthorId={null}
            selectedTagId={null}
            selectedCollectionId={null}
            onSelectLibrary={() => {}}
            onSelectGenre={() => {}}
            onSelectAuthor={() => {}}
            onSelectTag={() => {}}
            onSelectCollection={() => {}}
          />
        </MockThemeProvider>
      );
      
      // Should show tabs
      expect(getByText('Library')).toBeTruthy();
      expect(getByText('Genre')).toBeTruthy();
      expect(getByText('Author')).toBeTruthy();
      expect(getByText('Tag')).toBeTruthy();
      expect(getByText('Collection')).toBeTruthy();
      
      // Should show genre content by default
      expect(getByText('Fiction')).toBeTruthy();
      expect(getByText('Non-Fiction')).toBeTruthy();
    });
    
    it('hides library tab when hideLibraryTab is true', () => {
      const { queryByText, getByText } = render(
        <MockThemeProvider>
          <FilterSection
            libraries={mockLibraries}
            genres={mockGenres}
            authors={mockAuthors}
            tags={mockTags}
            collections={mockCollections}
            selectedLibraryId={null}
            selectedGenreId={null}
            selectedAuthorId={null}
            selectedTagId={null}
            selectedCollectionId={null}
            onSelectLibrary={() => {}}
            onSelectGenre={() => {}}
            onSelectAuthor={() => {}}
            onSelectTag={() => {}}
            onSelectCollection={() => {}}
            hideLibraryTab
          />
        </MockThemeProvider>
      );
      
      // Should NOT show Library tab
      expect(queryByText('Library')).toBeNull();
      
      // Should still show other tabs
      expect(getByText('Genre')).toBeTruthy();
    });
    
    it('shows Clear button when onClearAll is provided', () => {
      const mockClearAll = jest.fn();
      
      const { getByText } = render(
        <MockThemeProvider>
          <FilterSection
            libraries={mockLibraries}
            genres={mockGenres}
            authors={mockAuthors}
            tags={mockTags}
            collections={mockCollections}
            selectedLibraryId={null}
            selectedGenreId={null}
            selectedAuthorId={null}
            selectedTagId={null}
            selectedCollectionId={null}
            onSelectLibrary={() => {}}
            onSelectGenre={() => {}}
            onSelectAuthor={() => {}}
            onSelectTag={() => {}}
            onSelectCollection={() => {}}
            onClearAll={mockClearAll}
          />
        </MockThemeProvider>
      );
      
      expect(getByText('Clear')).toBeTruthy();
    });
  });
});
