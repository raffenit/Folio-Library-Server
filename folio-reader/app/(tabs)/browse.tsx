import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryGenre, LibraryTag, LibraryItem } from '../../services/LibraryProvider';
import { SeriesCard } from '../../components/SeriesCard';
import { useGridColumns } from '../../hooks/useGridColumns';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

type FilterMode = 'genre' | 'tag';

export default function BrowseScreen() {
  const router = useRouter();
  const { serverType } = useAuth();
  const { colors } = useTheme();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();
  const [filterMode, setFilterMode] = useState<FilterMode>('genre');
  const [genres, setGenres] = useState<LibraryGenre[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<LibraryGenre | null>(null);
  const [selectedTag, setSelectedTag] = useState<LibraryTag | null>(null);
  const [series, setSeries] = useState<LibraryItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [coverVersion, setCoverVersion] = useState(0); // Force cover refresh after upload

  const fetchMetadata = useCallback(async () => {
    setMetaLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const [g, t] = await Promise.all([
        provider.getGenres(),
        provider.getTags(),
      ]);
      setGenres(g);
      setTags(t);
    } catch (e) {
      console.error('Failed to fetch metadata', e);
    } finally {
      setMetaLoading(false);
    }
  }, [serverType]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Force cover refresh when returning from detail page (cover may have been uploaded)
  useFocusEffect(
    useCallback(() => {
      setCoverVersion(v => v + 1);
    }, [])
  );

  async function loadSeriesByGenre(genre: LibraryGenre, pageNum: number) {
    setSeriesLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const data = await provider.getLibraryItems({ genreId: Number(genre.id), page: pageNum, pageSize: 30 });
      if (pageNum === 0) {
        setSeries(data);
      } else {
        setSeries(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 30);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load series by genre', e);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function loadSeriesByTag(tag: LibraryTag, pageNum: number) {
    setSeriesLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const data = await provider.getLibraryItems({ tagId: Number(tag.id), page: pageNum, pageSize: 30 });
      if (pageNum === 0) {
        setSeries(data);
      } else {
        setSeries(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 30);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load series by tag', e);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function selectGenre(genre: LibraryGenre) {
    setSelectedGenre(genre);
    setSelectedTag(null);
    setSeries([]);
    setPage(0);
    setHasMore(true);
    await loadSeriesByGenre(genre, 0);
  }

  async function selectTag(tag: LibraryTag) {
    setSelectedTag(tag);
    setSelectedGenre(null);
    setSeries([]);
    setPage(0);
    setHasMore(true);
    await loadSeriesByTag(tag, 0);
  }

  function switchMode(mode: FilterMode) {
    setFilterMode(mode);
    setSeries([]);
    setSelectedGenre(null);
    setSelectedTag(null);
    setPage(0);
    setHasMore(true);
  }

  function loadMore() {
    if (!hasMore || seriesLoading) return;
    if (selectedGenre) loadSeriesByGenre(selectedGenre, page + 1);
    if (selectedTag) loadSeriesByTag(selectedTag, page + 1);
  }

  const activeItems = filterMode === 'genre' ? genres : tags;
  const selectedItem = filterMode === 'genre' ? selectedGenre : selectedTag;
  const onSelect = filterMode === 'genre'
    ? (item: LibraryGenre | LibraryTag) => selectGenre(item as LibraryGenre)
    : (item: LibraryGenre | LibraryTag) => selectTag(item as LibraryTag);

  // Memoized renderItem to prevent unnecessary re-renders while scrolling
  const renderSeriesCard = useCallback(({ item }: { item: LibraryItem }) => (
    <SeriesCard
      series={item}
      onPress={() => router.push(serverType === 'abs' ? `/audiobook/${item.id}` : `/series/${item.id}`)}
      onContextMenu={openMenu}
      cardWidth={cardWidth}
      coverVersion={coverVersion}
    />
  ), [router, serverType, openMenu, cardWidth, coverVersion]);

  if (metaLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Browse</Text>

        {/* Genre / Tag toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, filterMode === 'genre' && styles.toggleBtnActive]}
            onPress={() => switchMode('genre')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, filterMode === 'genre' && styles.toggleTextActive]}>
              Genre
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, filterMode === 'tag' && styles.toggleBtnActive]}
            onPress={() => switchMode('tag')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, filterMode === 'tag' && styles.toggleTextActive]}>
              Tags
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chips */}
      {activeItems.length === 0 ? (
        <View style={styles.emptyChips}>
          <Text style={styles.emptyText}>
            No {filterMode === 'genre' ? 'genres' : 'tags'} found in your library.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.chipsList}
        >
          {activeItems.map((item) => {
            const active = selectedItem?.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelect(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Series grid */}
      {!selectedItem ? (
        <View style={styles.prompt}>
          <Ionicons name="filter-outline" size={48} color={Colors.border} />
          <Text style={styles.promptText}>
            Select a {filterMode === 'genre' ? 'genre' : 'tag'} to browse series
          </Text>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={series}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={styles.filterLabel}>
              {selectedItem.title}
            </Text>
          }
          ListFooterComponent={
            seriesLoading ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !seriesLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No series found.</Text>
              </View>
            ) : null
          }
          renderItem={renderSeriesCard}
        />
      )}
      <SeriesContextMenu
        visible={ctxMenu.visible}
        seriesId={ctxMenu.seriesId}
        seriesName={ctxMenu.seriesName}
        position={ctxMenu.position}
        onClose={closeMenu}
        onOpenDetail={openDetail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeader: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  screenTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  toggleBtnActive: {
    backgroundColor: Colors.accent,
  },
  toggleText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.textOnAccent,
  },
  chipsList: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
  },
  emptyChips: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  filterLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  prompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  promptText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  grid: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 40,
  },
  row: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footerLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
