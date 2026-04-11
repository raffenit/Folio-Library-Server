import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryCollection, LibraryItem } from '../../services/LibraryProvider';
import { SeriesCard, useGridColumns } from '../../components/SeriesCard';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CollectionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { serverType } = useAuth();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [selected, setSelected] = useState<LibraryCollection | null>(null);
  const [series, setSeries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchCollections = useCallback(async () => {
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const data = await provider.getCollections();
      setCollections(data);
      if (data.length > 0) {
        await loadSeriesForCollection(data[0], 0);
        setSelected(data[0]);
      }
    } catch (e) {
      console.error('Failed to fetch collections', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverType]);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function loadSeriesForCollection(col: LibraryCollection, pageNum: number) {
    setSeriesLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const items = await provider.getSeriesInCollection(col.id);
      
      const fullItems = await Promise.all(items.map(item => provider.getSeriesDetail(item.id)));
      
      const mappedItems: LibraryItem[] = fullItems.map(d => ({
        id: d.id,
        title: d.name,
        coverImage: d.coverImage,
        mediaType: d.mediaType,
        author: d.authorName,
        provider: serverType === 'abs' ? 'abs' : 'kavita'
      }));

      if (pageNum === 0) {
        setSeries(mappedItems);
      } else {
        setSeries(prev => [...prev, ...mappedItems]);
      }
      setHasMore(false);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load collection series', e);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function selectCollection(col: LibraryCollection) {
    setSelected(col);
    setSeries([]);
    setPage(0);
    setHasMore(true);
    await loadSeriesForCollection(col, 0);
  }

  function loadMore() {
    if (hasMore && !seriesLoading && selected) {
      loadSeriesForCollection(selected, page + 1);
    }
  }

  const handleOpenMenu = (id: string | number, name: string, x: number, y: number) => {
    openMenu(id, name, x, y);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (collections.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Collections</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="albums-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Collections</Text>
          <Text style={styles.emptyText}>
            Create collections in Kavita to group your series here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Collections</Text>
      </View>

      {/* Collection pills */}
      <FlatList
        horizontal
        data={collections}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillList}
        renderItem={({ item }) => {
          const active = selected?.id === item.id;
          const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
          const coverUrl = provider.getCoverUrl(item.id);
          return (
            <TouchableOpacity
              style={[styles.collectionPill, active && styles.collectionPillActive]}
              onPress={() => selectCollection(item)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: coverUrl }}
                style={styles.pillCover}
                resizeMode="cover"
              />
              <View style={[styles.pillOverlay, active && styles.pillOverlayActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Series grid for selected collection */}
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
              fetchCollections();
            }}
            tintColor={Colors.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          selected ? (
            <Text style={styles.collectionLabel}>{selected.title}</Text>
          ) : null
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
              <Text style={styles.emptyText}>No series in this collection.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SeriesCard
            series={{
              ...item,
              id: item.id,
              title: item.title,
            }}
            onPress={() => router.push(serverType === 'abs' ? `/audiobook/${item.id}` : `/series/${item.id}`)}
            onContextMenu={handleOpenMenu}
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
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
  collectionPill: {
    width: 100,
    height: 140,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  collectionPillActive: {
    borderColor: Colors.accent,
  },
  pillCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  pillOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,13,18,0.75)',
    padding: 6,
  },
  pillOverlayActive: {
    backgroundColor: 'rgba(232,168,56,0.25)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pillTextActive: {
    color: Colors.accent,
  },
  collectionLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
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
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
