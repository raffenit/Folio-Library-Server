import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryItem } from '../../services/LibraryProvider';
import { SearchFactory } from '../../services/SearchFactory';
import { SeriesCard, useGridColumns } from '../../components/SeriesCard';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import TabHeader from '../../components/TabHeader';

export default function SearchScreen() {
  const router = useRouter();
  const { serverType } = useAuth();
  const { colors } = useTheme();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const searchResults = await SearchFactory.globallySearch(q.trim());
      setResults(searchResults);
      setSearched(true);
    } catch (e) {
      console.error('Search failed', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  function onChangeText(text: string) {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(text), 400);
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  const handleOpenMenu = (seriesId: string | number, seriesName: string, x: number, y: number, provider: 'kavita' | 'abs' = 'kavita') => {
    // Convert string IDs to numbers for Kavita, keep as-is for ABS
    const normalizedId = provider === 'kavita' && typeof seriesId === 'string' 
      ? parseInt(seriesId, 10) 
      : seriesId;
    if (normalizedId === null || normalizedId === undefined || normalizedId === '') return;
    openMenu(normalizedId, seriesName, x, y, provider);
  };

  return (
    <View style={[styles.container, {
      backgroundColor: Platform.OS === 'web' ? 'rgba(5, 6, 15, 0.15)' : colors.background,
    } as any]}>
      <TabHeader 
        title="Search" 
        count={searched ? results.length : undefined} 
        countLabel="results" 
      />
      <View style={{ height: Spacing.md }} />
      
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, {
          backgroundColor: Platform.OS === 'web' ? `${colors.surface}80` : colors.surface,
          borderColor: colors.border,
          backdropFilter: Platform.OS === 'web' ? 'blur(12px)' : undefined,
        } as any]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={query}
            onChangeText={onChangeText}
            placeholder="Search titles, authors, genres…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && searched && results.length === 0 && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No results</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Try a different title or series name.</Text>
        </View>
      )}

      {!loading && !searched && (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={56} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Search your entire library</Text>
        </View>
      )}

      <FlatList
        key={numColumns}
        data={results}
        keyExtractor={(item, index) => (item?.id || index).toString()}
        contentContainerStyle={styles.list}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <SeriesCard
            series={item}
            onPress={() => router.push(item.provider === 'abs' ? `/audiobook/${item.id}` : `/series/${item.id}`)}
            onContextMenu={handleOpenMenu}
            cardWidth={cardWidth}
          />
        )}
      />
      <SeriesContextMenu {...ctxMenu} onClose={closeMenu} onOpenDetail={openDetail} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.base,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  emptyText: {
    fontSize: Typography.base,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 40,
  },
});
