import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, DeviceEventEmitter
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryItem } from '../../services/LibraryProvider';
import { absAPI } from '../../services/audiobookshelfAPI';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import TabHeader from '../../components/TabHeader';

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

import { useTheme } from '../../contexts/ThemeContext';

function AudiobookCard({ item, onPress, onPlay, isPlaying }: {
  item: LibraryItem;
  onPress: () => void;
  onPlay: () => void;
  isPlaying: boolean;
}) {
  const { colors } = useTheme();
  const progressPct = item.progress ? Math.round(item.progress * 100) : 0;
  const provider = LibraryFactory.getProvider('abs');
  const coverUri = (provider as any).getCoverUrl?.(item.id) || '';

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.coverWrapper}>
        <Image source={{ uri: coverUri }} style={[styles.cover, { backgroundColor: colors.surfaceElevated }]} resizeMode="cover" />
        {progressPct > 0 && (
          <View style={[styles.progressBar, { backgroundColor: colors.progressTrack }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: colors.accent }]} />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
        {item.author ? (
          <Text style={[styles.cardAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{item.author}</Text>
        ) : null}
        {item.duration ? (
          <Text style={[styles.cardDuration, { color: colors.textMuted }]}>{item.durationFormatted || formatDuration(item.duration)}</Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onPlay} style={styles.playBtn} hitSlop={8}>
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={36}
          color={colors.accent}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function AudiobooksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { nowPlaying, isPlaying, play, togglePlayPause } = useAudioPlayer();

  const [connected, setConnected] = useState(true);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const fetchItems = useCallback(async (libraryId: string, pageNum: number, reset: boolean) => {
    console.log('[Audiobooks] fetchItems called with libraryId:', libraryId, 'page:', pageNum);
    try {
      const provider = LibraryFactory.getProvider('abs');
      const data = await provider.getLibraryItems({ libraryId, page: pageNum, limit: 40 });
      console.log('[Audiobooks] Fetched', data.length, 'items from library', libraryId);
      if (data.length > 0) {
        console.log('[Audiobooks] First item:', JSON.stringify(data[0]).slice(0, 200));
      }
      
      if (reset) {
        setItems(data);
      } else {
        setItems(prev => [...prev, ...data]);
      }
      setPage(pageNum);
      // ABS total count is hard to get via generic interface for now, so we just check if we got a full page
      setHasMore(data.length === 40);
    } catch (e: any) {
      console.error('[Audiobooks] Failed to fetch audiobook items:', e);
      const isNetworkError = !e.response && (e.code === 'ECONNABORTED' || e.message?.includes('Network Error') || e.message?.includes('timeout'));
      if (isNetworkError) {
        setNetworkError('Server unreachable. Check your connection or ABS server URL in Settings.');
      }
    } finally {
      setLoadingMore(false);
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    console.log('[Audiobooks] Starting initialization...');
    setLoading(true);
    const provider = LibraryFactory.getProvider('abs');
    await provider.initialize();
    
    const isAuth = await provider.isAuthenticated();
    console.log('[Audiobooks] isAuthenticated:', isAuth);
    if (!isAuth) {
      console.log('[Audiobooks] Not authenticated, showing not connected');
      setConnected(false);
      setLoading(false);
      return;
    }
    
    setConnected(true);
    try {
      // Libraries are still ABS specific for this tab's picker
      const { absAPI } = await import('../../services/audiobookshelfAPI');
      console.log('[Audiobooks] Fetching libraries from absAPI...');
      const libs = await absAPI.getLibraries();
      console.log('[Audiobooks] Got', libs.length, 'libraries:', libs.map(l => ({ id: l.id, name: l.name, mediaType: l.mediaType })));
      setLibraries(libs);
      
      const currentLib = selectedLibraryId && libs.some(l => l.id === selectedLibraryId) 
        ? selectedLibraryId 
        : libs[0]?.id ?? null;
      console.log('[Audiobooks] Selected library:', currentLib);
      
      setSelectedLibraryId(currentLib);
      if (currentLib) {
        await fetchItems(currentLib, 0, true);
      } else {
        console.log('[Audiobooks] No library selected, stopping load');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[Audiobooks] Initialization error:', err);
      const isNetworkError = !err.response && (err.code === 'ECONNABORTED' || err.message?.includes('Network Error') || err.message?.includes('timeout'));
      if (isNetworkError) {
        setNetworkError('Server unreachable. Check your connection or ABS server URL in Settings.');
      }
      setConnected(false);
      setLoading(false);
    }
  }, [selectedLibraryId, fetchItems]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [initialize])
  );

  // Refresh when playback is stopped (to sync progress bars)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('FOLIO_PLAYBACK_STOPPED', () => {
      console.log('[AudiobooksScreen] Playback stop detected, refreshing library...');
      if (selectedLibraryId) {
        fetchItems(selectedLibraryId, 0, true);
      }
    });
    return () => sub.remove();
  }, [selectedLibraryId, fetchItems]);

  function onRefresh() {
    setNetworkError(null);
    if (selectedLibraryId) {
      setRefreshing(true);
      fetchItems(selectedLibraryId, 0, true);
    }
  }

  function loadMore() {
    if (!hasMore || loadingMore || !selectedLibraryId) return;
    setLoadingMore(true);
    fetchItems(selectedLibraryId, page + 1, false);
  }

  async function selectLibrary(idRaw: string | number) {
    const id = String(idRaw);
    if (id === selectedLibraryId) return;
    setSelectedLibraryId(id);
    setLoading(true);
    setItems([]);
    await fetchItems(id, 0, true);
  }

  async function handlePlay(item: LibraryItem) {
    if (nowPlaying?.item.id === item.id) {
      await togglePlayPause();
    } else {
      // We need the full ABS item for the play context if possible, 
      // or the player should handle LibraryItem.
      // Currently play(item) expects ABSLibraryItem.
      // Let's check AudioPlayerContext.
      const { absAPI } = await import('../../services/audiobookshelfAPI');
      const fullItem = await absAPI.getLibraryItem(String(item.id));
      await play(fullItem);
    }
  }

  if (!connected && !loading) {
    return (
      <View style={[styles.notConfigured, { backgroundColor: colors.background }]}>
        <Ionicons name="headset-outline" size={64} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Audiobookshelf not configured</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Add your server URL and API key in Settings → Audiobookshelf.</Text>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/(tabs)/settings')}
        >
          <Text style={[styles.settingsBtnText, { color: colors.textOnAccent }]}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TabHeader 
        title="Audiobooks" 
        count={items.length} 
        countLabel="items" 
        hasMore={hasMore} 
        serverName="Audiobookshelf" 
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        onSelectLibrary={selectLibrary}
      />

      {networkError && items.length === 0 ? (
        <View style={[styles.centered, { padding: Spacing.xl }]}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' }}>
            {networkError}
          </Text>
          <TouchableOpacity
            style={{
              marginTop: Spacing.lg,
              backgroundColor: colors.accent,
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.base,
              borderRadius: Radius.md,
            }}
            onPress={onRefresh}
          >
            <Text style={{ color: colors.background, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={{ padding: Spacing.xl }} /> : null}
          ListEmptyComponent={
            <View style={[styles.centered, { gap: Spacing.md }]}>
              <Ionicons name="headset-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No audiobooks found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]}>
                Your Audiobookshelf library appears to be empty. Try scanning for new files.
              </Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm }}
                onPress={async () => {
                  try {
                    await absAPI.scanAllLibraries();
                    // Refresh after a short delay to let scan start
                    setTimeout(() => onRefresh(), 2000);
                  } catch (e) {
                    console.error('ABS Scan failed', e);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.textOnAccent} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.textOnAccent, fontSize: Typography.base, fontWeight: Typography.bold }}>Scan Library</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <AudiobookCard
              item={item}
              onPress={() => router.push(`/audiobook/${item.id}`)}
              onPlay={() => handlePlay(item)}
              isPlaying={isPlaying && nowPlaying?.item.id === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
  },
  libraryPicker: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  libChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  libChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  libChipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  libChipTextActive: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 120,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  coverWrapper: {
    position: 'relative',
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.progressTrack,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.accent,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  cardAuthor: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  cardDuration: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  playBtn: {
    padding: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.sm,
  },
  notConfigured: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
  settingsBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  settingsBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textOnAccent,
  },
});
