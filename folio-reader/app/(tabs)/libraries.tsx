import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LibraryFactory } from '../../services/LibraryFactory';
import { Library, LibraryItem } from '../../services/LibraryProvider';
import { SeriesCard, useGridColumns } from '../../components/SeriesCard';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

function LibraryTypeLabel(type: number): string {
  switch (type) {
    case 0: return 'Manga';
    case 1: return 'Comic';
    case 2: return 'Book';
    default: return 'Library';
  }
}

export default function LibrariesScreen() {
  const router = useRouter();
  const { serverType } = useAuth();
  const { colors } = useTheme();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
  const [series, setSeries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLibraries = useCallback(async () => {
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const libs = await provider.getLibraries();
      setLibraries(libs);
      if (libs.length > 0 && !selectedLibrary) {
        await loadLibrarySeries(libs[0], 0);
        setSelectedLibrary(libs[0]);
      }
    } catch (e) {
      console.error('Failed to fetch libraries', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverType, selectedLibrary]);

  useEffect(() => {
    fetchLibraries();
  }, []);

  async function loadLibrarySeries(lib: Library, pageNum: number) {
    setSeriesLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const data = await provider.getLibraryItems({ libraryId: String(lib.id), page: pageNum, pageSize: 30 });
      if (pageNum === 0) {
        setSeries(data);
      } else {
        setSeries(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 30);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load series', e);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function selectLibrary(lib: Library) {
    setSelectedLibrary(lib);
    setSeries([]);
    setPage(0);
    setHasMore(true);
    await loadLibrarySeries(lib, 0);
  }

  function loadMore() {
    if (hasMore && !seriesLoading && selectedLibrary) {
      loadLibrarySeries(selectedLibrary, page + 1);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Screen header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Libraries</Text>
      </View>

      {/* Library pills */}
      <FlatList
        horizontal
        data={libraries}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        renderItem={({ item }) => {
          const active = selectedLibrary?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => selectLibrary(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {item.name}
              </Text>
              <Text style={[styles.pillType, active && styles.pillTypeActive]}>
                {LibraryTypeLabel(item.type ?? 2)}
              </Text>
            </TouchableOpacity>
          );
        }}
        style={styles.pillList}
      />

      {/* Series grid */}
      <FlatList
        key={numColumns}
        data={series}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              if (selectedLibrary) loadLibrarySeries(selectedLibrary, 0);
              else fetchLibraries();
            }}
            tintColor={Colors.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
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
              <Text style={styles.emptyText}>No series found in this library.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SeriesCard
            series={item}
            onPress={() => router.push(item.provider === 'abs' ? `/audiobook/${item.id}` : `/series/${item.id}`)}
            onContextMenu={(id, name, x, y) => openMenu(String(id), name, x, y)}
            cardWidth={cardWidth}
          />
        )}
      />
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
    backgroundColor: Colors.background,
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
  },
  screenTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
  },
  pillList: {
    flexGrow: 0,
  },
  pillsContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pill: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  pillText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.accent,
  },
  pillType: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pillTypeActive: {
    color: Colors.accentDim,
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
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
  },
});
