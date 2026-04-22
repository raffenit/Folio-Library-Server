import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, DeviceEventEmitter, Platform, ScrollView, useWindowDimensions
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryItem } from '../../services/LibraryProvider';
import { absAPI } from '../../services/audiobookshelfAPI';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import TabHeader from '../../components/TabHeader';
import { useTheme } from '../../contexts/ThemeContext';
import GenreTagContextMenu, { ChipType } from '../../components/GenreTagContextMenu';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';

interface FilterItem {
  id: string;
  title: string;
}

// ── Filter Row Component (similar to index.tsx) ──
function FilterRow({ label, items, selectedId, onSelect }: {
  label: string;
  items: FilterItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  const filterRowRef = React.useRef<View>(null);

  return (
    <View ref={filterRowRef} style={{ position: 'relative' }}>
      {/* Gradient divider line */}
      {Platform.OS === 'web' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `radial-gradient(ellipse at center, ${colors.accent}50 0%, ${colors.secondary}55 25%, #8B6DB8 50%, #A85A95 75%, ${colors.secondary}65 100%)`,
        }} />
      )}
      {Platform.OS !== 'web' && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: colors.border }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Fixed label */}
        {Platform.OS === 'web' ? (
          <span style={{
            fontSize: Typography.xs,
            fontWeight: Typography.bold,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginLeft: Spacing.base,
            marginRight: Spacing.xs,
            minWidth: 48,
            background: `radial-gradient(circle at 30% 30%, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>{label}</span>
        ) : (
          <Text style={{ fontSize: Typography.xs, fontWeight: Typography.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: Spacing.base, marginRight: Spacing.xs, minWidth: 48 }}>
            {label}
          </Text>
        )}
        {/* Scrollable chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.xs }}
        >
          <GradientChip
            label="All"
            active={selectedId === null}
            colors={colors}
            onPress={() => onSelect(null)}
          />
          {items.map(item => (
            <GradientChip
              key={item.id}
              label={item.title}
              active={selectedId === item.id}
              colors={colors}
              onPress={() => onSelect(item.id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Filter Row without label (for tabbed interface) ──
function FilterRowNoLabel({ items, selectedId, onSelect, onChipContextMenu }: {
  items: FilterItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChipContextMenu?: (item: FilterItem, x: number, y: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs }}
    >
      <GradientChip
        label="All"
        active={selectedId === null}
        colors={colors}
        onPress={() => onSelect(null)}
      />
      {items.map(item => (
        <GradientChip
          key={item.id}
          label={item.title}
          active={selectedId === item.id}
          colors={colors}
          onPress={() => onSelect(item.id)}
          onContextMenu={onChipContextMenu ? (x, y) => onChipContextMenu(item, x, y) : undefined}
        />
      ))}
    </ScrollView>
  );
}

// ── Compact Filter Row Component (condensed for 2-column layout) ──
function CompactFilterRow({ label, items, selectedId, onSelect }: {
  label: string;
  items: FilterItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 9, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 40 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
        <TouchableOpacity
          onPress={() => onSelect(null)}
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: Radius.sm,
            backgroundColor: selectedId === null ? colors.accent : colors.surface,
            borderWidth: 1,
            borderColor: selectedId === null ? colors.accent : colors.border,
          }}
        >
          <Text style={{ fontSize: 9, color: selectedId === null ? colors.textOnAccent : colors.textPrimary }}>All</Text>
        </TouchableOpacity>
        {items.slice(0, 5).map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: Radius.sm,
              backgroundColor: selectedId === item.id ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: selectedId === item.id ? colors.accent : colors.border,
            }}
          >
            <Text style={{ fontSize: 9, color: selectedId === item.id ? colors.textOnAccent : colors.textPrimary }} numberOfLines={1}>{item.title}</Text>
          </TouchableOpacity>
        ))}
        {items.length > 5 && (
          <Text style={{ fontSize: 9, color: colors.textMuted, paddingHorizontal: 2 }}>+{items.length - 5}</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Gradient Chip Component ──
function GradientChip({ label, active, colors, onPress, onContextMenu }: {
  label: string;
  active: boolean;
  colors: any;
  onPress: () => void;
  onContextMenu?: (x: number, y: number) => void;
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu]);

  // Fixed gradient angle for consistent chip styling
  const gradientAngle = 135; // Fixed diagonal angle

  const gradientBorder = `linear-gradient(${gradientAngle}deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)`;
  const textGradient = `linear-gradient(${gradientAngle}deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)`;

  if (Platform.OS === 'web') {
    return (
      <div
        ref={wrapperRef}
        style={{
          display: 'inline-block',
          borderRadius: Radius.full,
          padding: 1,
          background: gradientBorder,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onContextMenu ? (e) => onContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
          delayLongPress={400}
          activeOpacity={1}
        >
          <View style={{
            borderRadius: Radius.full,
            paddingHorizontal: Spacing.md,
            paddingVertical: 5,
            backgroundColor: active ? 'transparent' : 'rgba(10, 12, 25, 0.85)',
            background: active ? textGradient : undefined,
          }}>
            <span style={{
              fontSize: Typography.sm,
              fontWeight: active ? Typography.semibold : Typography.medium,
              color: active ? '#1a1a2e' : 'transparent',
              background: active ? 'none' : textGradient,
              WebkitBackgroundClip: active ? 'border-box' : 'text',
              WebkitTextFillColor: active ? '#1a1a2e' : 'transparent',
              backgroundClip: active ? 'border-box' : 'text',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}>{label}</span>
          </View>
        </TouchableOpacity>
      </div>
    );
  }

  // Native fallback
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        { backgroundColor: 'rgba(10, 12, 25, 0.85)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: active ? '#F5E6D3' : colors.border },
        active && { backgroundColor: 'rgba(245, 230, 211, 0.95)', borderColor: '#F5E6D3' },
      ]}
      activeOpacity={0.85}
    >
      <Text style={{ fontSize: Typography.sm, fontWeight: active ? Typography.semibold : Typography.medium, color: active ? '#1a1a2e' : colors.textPrimary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Continue Listening Card (horizontal scroll) ──
function ContinueListeningCard({ item, onPress, onPlay, isPlaying }: {
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{ width: 130, marginRight: Spacing.sm }}
    >
      <View style={{ borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#1e2132' }}>
        <View style={{ width: 130, aspectRatio: 1 }}>
          <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {/* Gradient overlay at bottom */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: Platform.OS === 'web' 
              ? `linear-gradient(to top, rgba(10,12,25,0.9) 0%, rgba(10,12,25,0.4) 60%, transparent 100%)`
              : undefined,
            backgroundColor: Platform.OS !== 'web' ? 'rgba(10,12,25,0.6)' : undefined,
          } as any} />
          {/* progress bar */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
          {/* play button overlay */}
          <TouchableOpacity
            onPress={onPlay}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.accent}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ marginTop: Spacing.xs }}>
        <Text numberOfLines={2} style={{ fontSize: Typography.xs, color: colors.textPrimary, lineHeight: 15, fontWeight: Typography.medium }}>
          {item.title}
        </Text>
        {item.author ? (
          <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
            {item.author}
          </Text>
        ) : null}
        <Text style={{ fontSize: 10, color: colors.accent, marginTop: 2 }}>
          {progressPct}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Audiobook Card for Grid ──
function AudiobookCard({ item, onPress, onPlay, isPlaying, cardWidth, onContextMenu }: {
  item: LibraryItem;
  onPress: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  cardWidth: number;
  onContextMenu?: (itemId: string, itemTitle: string, x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const progressPct = item.progress ? Math.round(item.progress * 100) : 0;
  const provider = LibraryFactory.getProvider('abs');
  const coverUri = (provider as any).getCoverUrl?.(item.id) || '';
  const cardRef = React.useRef<View>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = cardRef.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(item.id, item.title, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu, item.id, item.title]);

  function handleLongPress(e: GestureResponderEvent) {
    if (onContextMenu) {
      onContextMenu(item.id, item.title, e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
  }

  return (
    <TouchableOpacity 
      ref={cardRef}
      style={[styles.card, { width: cardWidth, backgroundColor: '#1e2132', borderColor: 'rgba(255, 255, 255, 0.08)' }, Platform.OS === 'web' && (styles.cardHover as any)]} 
      onPress={onPress} 
      onLongPress={onContextMenu ? handleLongPress : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
      {...(Platform.OS === 'web' ? { className: 'audiobook-card-hover' } : {})}
    >
      <View style={{ aspectRatio: 1, width: '100%' }}>
        <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {/* progress bar */}
        {progressPct > 0 && progressPct < 100 && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        )}
        {/* play button overlay */}
        <TouchableOpacity 
          onPress={onPlay} 
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={colors.accent}
          />
        </TouchableOpacity>
      </View>
      <View style={{ padding: Spacing.sm }}>
        <Text numberOfLines={2} style={{ fontSize: Typography.xs, color: colors.textPrimary, lineHeight: 15, fontWeight: Typography.medium }}>
          {item.title}
        </Text>
        {item.author ? (
          <Text numberOfLines={1} style={{ fontSize: Typography.xs, color: colors.textSecondary, marginTop: 2 }}>
            {item.author}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// Grid calculation
const GAP = Spacing.sm;
const SIDE_MARGIN = Spacing.base;

function useGridColumns() {
  const { width } = useWindowDimensions();
  // Account for scrollbar width on web to prevent grid from being cut off
  const SCROLLBAR_WIDTH = Platform.OS === 'web' ? 16 : 0;
  const availableWidth = width - SCROLLBAR_WIDTH;
  const numColumns =
    availableWidth >= 1600 ? 8 :
    availableWidth >= 1280 ? 7 :
    availableWidth >= 960  ? 6 :
    availableWidth >= 700  ? 5 :
    availableWidth >= 500  ? 4 : 3;
  const cardWidth = (availableWidth - SIDE_MARGIN * 2 - GAP * (numColumns - 1)) / numColumns;
  return { numColumns, cardWidth };
}

export default function AudiobooksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { nowPlaying, isPlaying, play, togglePlayPause } = useAudioPlayer();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();

  const [connected, setConnected] = useState(true);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [allItems, setAllItems] = useState<LibraryItem[]>([]); // For filtering
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Filter states
  const [genres, setGenres] = useState<FilterItem[]>([]);
  const [authors, setAuthors] = useState<FilterItem[]>([]);
  const [tags, setTags] = useState<FilterItem[]>([]);
  const [collections, setCollections] = useState<FilterItem[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionItems, setCollectionItems] = useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'library' | 'genre' | 'author' | 'tag' | 'collection'>('library');

  // Chip context menu state
  const [chipMenu, setChipMenu] = useState<{
    visible: boolean;
    itemId: string | null;
    itemTitle: string;
    itemType: ChipType | null;
    position: { x: number; y: number };
  }>({ visible: false, itemId: null, itemTitle: '', itemType: null, position: { x: 0, y: 0 } });

  function openChipMenu(item: FilterItem, type: ChipType, x: number, y: number) {
    setChipMenu({ visible: true, itemId: item.id, itemTitle: item.title, itemType: type, position: { x, y } });
  }

  function closeChipMenu() {
    setChipMenu(prev => ({ ...prev, visible: false }));
  }

  // Extract unique genres, authors, and tags from items
  const extractFilters = useCallback((items: LibraryItem[]) => {
    const genreMap = new Map<string, string>();
    const authorMap = new Map<string, string>();
    const tagMap = new Map<string, string>();
    
    items.forEach(item => {
      // Extract genres from metadata
      const itemGenres = (item as any).media?.metadata?.genres || [];
      itemGenres.forEach((g: string) => {
        if (g && !genreMap.has(g)) {
          genreMap.set(g, g);
        }
      });
      
      // Extract tags from metadata
      const itemTags = (item as any).media?.metadata?.tags || [];
      itemTags.forEach((t: string) => {
        if (t && !tagMap.has(t)) {
          tagMap.set(t, t);
        }
      });
      
      // Extract author
      const author = item.author || (item as any).media?.metadata?.author;
      if (author && !authorMap.has(author)) {
        authorMap.set(author, author);
      }
    });
    
    const genreItems: FilterItem[] = Array.from(genreMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    const authorItems: FilterItem[] = Array.from(authorMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    const tagItems: FilterItem[] = Array.from(tagMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    setGenres(genreItems);
    setAuthors(authorItems);
    setTags(tagItems);
  }, [])

  // Fetch collections from ABS
  const fetchCollections = useCallback(async () => {
    try {
      const absCollections = await absAPI.getCollections();
      const collectionItems: FilterItem[] = absCollections
        .map((c: any) => ({ id: c.id, title: c.name || c.title }))
        .sort((a: FilterItem, b: FilterItem) => a.title.localeCompare(b.title));
      setCollections(collectionItems);
    } catch (e) {
      console.error('[Audiobooks] Failed to fetch collections:', e);
    }
  }, []);

  // Fetch items in selected collection
  const fetchCollectionItems = useCallback(async (collectionId: string) => {
    try {
      const collection = await absAPI.getCollection(collectionId);
      const itemIds = new Set<string>();
      // ABS returns items in .books or .items property
      const items = collection.books || collection.items || [];
      items.forEach((item: any) => {
        const id = item.id || item.libraryItemId;
        if (id) itemIds.add(String(id));
      });
      setCollectionItems(itemIds);
    } catch (e) {
      console.error('[Audiobooks] Failed to fetch collection items:', e);
      setCollectionItems(new Set());
    }
  }, []);

  // Filter items based on selected filters
  const filterItems = useCallback((allItems: LibraryItem[]) => {
    let filtered = allItems;
    
    if (selectedCollectionId) {
      // When collection is selected, only show items in that collection
      filtered = filtered.filter(item => collectionItems.has(String(item.id)));
    }
    
    if (selectedGenreId) {
      filtered = filtered.filter(item => {
        const itemGenres = (item as any).media?.metadata?.genres || [];
        return itemGenres.includes(selectedGenreId);
      });
    }
    
    if (selectedTagId) {
      filtered = filtered.filter(item => {
        const itemTags = (item as any).media?.metadata?.tags || [];
        return itemTags.includes(selectedTagId);
      });
    }
    
    if (selectedAuthorId) {
      filtered = filtered.filter(item => {
        const author = item.author || (item as any).media?.metadata?.author;
        return author === selectedAuthorId;
      });
    }
    
    return filtered;
  }, [selectedGenreId, selectedAuthorId, selectedTagId, selectedCollectionId, collectionItems]);

  const fetchItems = useCallback(async (libraryId: string, pageNum: number, reset: boolean) => {
    console.log('[Audiobooks] fetchItems called with libraryId:', libraryId, 'page:', pageNum);
    try {
      const provider = LibraryFactory.getProvider('abs');
      const data = await provider.getLibraryItems({ libraryId, page: pageNum, limit: 40 });
      console.log('[Audiobooks] Fetched', data.length, 'items from library', libraryId);
      
      if (reset) {
        setAllItems(data);
        setItems(filterItems(data));
        extractFilters(data);
      } else {
        // Use functional update to avoid dependency on allItems
        setAllItems(prev => {
          const newAllItems = [...prev, ...data];
          // Apply filters after state update
          setItems(filterItems(newAllItems));
          extractFilters(newAllItems);
          return newAllItems;
        });
      }
      setPage(pageNum);
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
  }, [extractFilters, filterItems]);

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
      
      if (currentLib && currentLib !== selectedLibraryId) {
        setSelectedLibraryId(currentLib);
      }
      if (currentLib) {
        await fetchItems(currentLib, 0, true);
        // Fetch collections for the filter row
        fetchCollections();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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

  async function selectLibrary(idRaw: string | number | null) {
    const id = idRaw === null ? 'null' : String(idRaw);
    if (id === selectedLibraryId) return;
    setSelectedLibraryId(id);
    setLoading(true);
    setItems([]);
    setAllItems([]);
    setSelectedGenreId(null);
    setSelectedAuthorId(null);
    await fetchItems(id, 0, true);
  }

  // Apply filters when selection changes
  useEffect(() => {
    if (allItems.length > 0) {
      setItems(filterItems(allItems));
    }
  }, [selectedGenreId, selectedAuthorId, selectedTagId, selectedCollectionId, collectionItems, allItems, filterItems]);

  // Fetch collection items when collection selection changes
  useEffect(() => {
    if (selectedCollectionId) {
      fetchCollectionItems(selectedCollectionId);
    } else {
      setCollectionItems(new Set());
    }
  }, [selectedCollectionId, fetchCollectionItems]);

  // Continue listening: items with progress > 0 and < 100%
  const continueListening = useMemo(() => {
    return allItems.filter(item => item.progress && item.progress > 0 && item.progress < 1)
      .sort((a, b) => (b.progress || 0) - (a.progress || 0))
      .slice(0, 10);
  }, [allItems]);

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
    <View style={[styles.container, {
      zIndex: 1,
      backgroundColor: Platform.OS === 'web' ? 'rgba(5, 6, 15, 0.15)' : colors.background,
    } as any]}>
      <TabHeader 
        title="Audiobooks" 
        count={items.length} 
        countLabel="items" 
        hasMore={hasMore} 
        serverName="Audiobookshelf" 
      />
      <View style={{ height: Spacing.md }} />

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
        <View style={{ flex: 1, marginHorizontal: Spacing.base }}>
          <FlatList
            key={numColumns}
            data={items}
            keyExtractor={i => String(i.id)}
            numColumns={numColumns}
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: Spacing.base, gap: Spacing.sm }}
            columnWrapperStyle={{ gap: Spacing.sm, marginBottom: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={{ padding: Spacing.xl }} /> : null}
          ListHeaderComponent={
            <View>
              {/* ── Continue Listening section ── */}
              {continueListening.length > 0 && (
                <View style={{ marginBottom: Spacing.xl }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm }}>
                    <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textPrimary }}>
                      Continue Listening
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                      <Text style={{ fontSize: Typography.xs, color: colors.textMuted }}>{continueListening.length} in progress</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 4 }}
                  >
                    {continueListening.map((item) => (
                      <ContinueListeningCard
                        key={item.id}
                        item={item}
                        onPress={() => router.push(`/audiobook/${item.id}`)}
                        onPlay={() => handlePlay(item)}
                        isPlaying={isPlaying && nowPlaying?.item.id === item.id}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Filter Section with Gradient Background */}
              <View style={{
                marginHorizontal: Spacing.base,
                marginBottom: Spacing.md,
                borderRadius: Radius.lg,
                backgroundColor: Platform.OS === 'web' ? 'rgba(20, 22, 40, 0.6)' : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}>
                {/* Gradient overlay for web - subtle rainbow like chips */}
              {Platform.OS === 'web' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `radial-gradient(ellipse at 30% 20%, ${colors.accent}10 0%, transparent 50%),
                               radial-gradient(ellipse at 70% 80%, ${colors.secondary}12 0%, transparent 50%),
                               radial-gradient(ellipse at 50% 50%, rgba(139, 109, 184, 0.08) 0%, transparent 60%),
                               radial-gradient(ellipse at 80% 30%, rgba(168, 90, 149, 0.08) 0%, transparent 50%)`,
                  borderRadius: Radius.lg,
                  pointerEvents: 'none',
                }} />
              )}  

                {/* Tab Navigation - Styled as actual tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, gap: 4 }}>
                    {libraries.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setActiveFilterTab('library')}
                        style={{
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderTopLeftRadius: Radius.md,
                          borderTopRightRadius: Radius.md,
                          borderBottomLeftRadius: 0,
                          borderBottomRightRadius: 0,
                          backgroundColor: activeFilterTab === 'library' && Platform.OS !== 'web' ? colors.accent : 'transparent',
                          ...(Platform.OS === 'web' && activeFilterTab === 'library' ? { background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)` } : {}),
                          borderLeftWidth: activeFilterTab === 'library' ? 1 : 0,
                          borderRightWidth: activeFilterTab === 'library' ? 1 : 0,
                          borderLeftColor: colors.border,
                          borderRightColor: colors.border,
                          marginBottom: -1,
                          zIndex: activeFilterTab === 'library' ? 1 : 0,
                        }}
                      >
                        <Text style={{
                          fontSize: Typography.sm,
                          color: activeFilterTab === 'library' ? colors.textOnAccent : colors.textSecondary,
                          fontWeight: activeFilterTab === 'library' ? '600' : '400',
                        }}>Library</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setActiveFilterTab('genre')}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderTopLeftRadius: Radius.md,
                        borderTopRightRadius: Radius.md,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        backgroundColor: activeFilterTab === 'genre' && Platform.OS !== 'web' ? colors.accent : 'transparent',
                        ...(Platform.OS === 'web' && activeFilterTab === 'genre' ? { background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)` } : {}),
                        borderLeftWidth: activeFilterTab === 'genre' ? 1 : 0,
                        borderRightWidth: activeFilterTab === 'genre' ? 1 : 0,
                        borderLeftColor: colors.border,
                        borderRightColor: colors.border,
                        marginBottom: -1,
                        zIndex: activeFilterTab === 'genre' ? 1 : 0,
                      }}
                    >
                      <Text style={{
                        fontSize: Typography.sm,
                        color: activeFilterTab === 'genre' ? colors.textOnAccent : colors.textSecondary,
                        fontWeight: activeFilterTab === 'genre' ? '600' : '400',
                      }}>Genre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilterTab('author')}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderTopLeftRadius: Radius.md,
                        borderTopRightRadius: Radius.md,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        backgroundColor: activeFilterTab === 'author' && Platform.OS !== 'web' ? colors.accent : 'transparent',
                        ...(Platform.OS === 'web' && activeFilterTab === 'author' ? { background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)` } : {}),
                        borderLeftWidth: activeFilterTab === 'author' ? 1 : 0,
                        borderRightWidth: activeFilterTab === 'author' ? 1 : 0,
                        borderLeftColor: colors.border,
                        borderRightColor: colors.border,
                        marginBottom: -1,
                        zIndex: activeFilterTab === 'author' ? 1 : 0,
                      }}
                    >
                      <Text style={{
                        fontSize: Typography.sm,
                        color: activeFilterTab === 'author' ? colors.textOnAccent : colors.textSecondary,
                        fontWeight: activeFilterTab === 'author' ? '600' : '400',
                      }}>Author</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilterTab('tag')}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderTopLeftRadius: Radius.md,
                        borderTopRightRadius: Radius.md,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        backgroundColor: activeFilterTab === 'tag' && Platform.OS !== 'web' ? colors.accent : 'transparent',
                        ...(Platform.OS === 'web' && activeFilterTab === 'tag' ? { background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)` } : {}),
                        borderLeftWidth: activeFilterTab === 'tag' ? 1 : 0,
                        borderRightWidth: activeFilterTab === 'tag' ? 1 : 0,
                        borderLeftColor: colors.border,
                        borderRightColor: colors.border,
                        marginBottom: -1,
                        zIndex: activeFilterTab === 'tag' ? 1 : 0,
                      }}
                    >
                      <Text style={{
                        fontSize: Typography.sm,
                        color: activeFilterTab === 'tag' ? colors.textOnAccent : colors.textSecondary,
                        fontWeight: activeFilterTab === 'tag' ? '600' : '400',
                      }}>Tag</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilterTab('collection')}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderTopLeftRadius: Radius.md,
                        borderTopRightRadius: Radius.md,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        backgroundColor: activeFilterTab === 'collection' && Platform.OS !== 'web' ? colors.accent : 'transparent',
                        ...(Platform.OS === 'web' && activeFilterTab === 'collection' ? { background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)` } : {}),
                        borderLeftWidth: activeFilterTab === 'collection' ? 1 : 0,
                        borderRightWidth: activeFilterTab === 'collection' ? 1 : 0,
                        borderLeftColor: colors.border,
                        borderRightColor: colors.border,
                        marginBottom: -1,
                        zIndex: activeFilterTab === 'collection' ? 1 : 0,
                      }}
                    >
                      <Text style={{
                        fontSize: Typography.sm,
                        color: activeFilterTab === 'collection' ? colors.textOnAccent : colors.textSecondary,
                        fontWeight: activeFilterTab === 'collection' ? '600' : '400',
                      }}>Collection</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {/* Tab Content Area */}
                  <View style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.accent,
                    backgroundColor: Platform.OS === 'web' ? 'rgba(20, 22, 40, 0.4)' : colors.surface,
                    paddingVertical: Spacing.sm,
                  }}>
                    {activeFilterTab === 'library' && libraries.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, paddingHorizontal: Spacing.base }}>
                        <TouchableOpacity
                          onPress={() => selectLibrary(null)}
                          style={{
                            paddingHorizontal: Spacing.md,
                            paddingVertical: Spacing.sm,
                            borderRadius: Radius.md,
                            backgroundColor: selectedLibraryId === null ? colors.accent : colors.surface,
                            borderWidth: 1,
                            borderColor: selectedLibraryId === null ? colors.accent : colors.border,
                          }}
                        >
                          <Text style={{ fontSize: Typography.sm, color: selectedLibraryId === null ? colors.textOnAccent : colors.textPrimary }}>All Libraries</Text>
                        </TouchableOpacity>
                        {libraries.map(lib => (
                          <TouchableOpacity
                            key={lib.id}
                            onPress={() => selectLibrary(String(lib.id))}
                            style={{
                              paddingHorizontal: Spacing.md,
                              paddingVertical: Spacing.sm,
                              borderRadius: Radius.md,
                              backgroundColor: selectedLibraryId === String(lib.id) ? colors.accent : colors.surface,
                              borderWidth: 1,
                              borderColor: selectedLibraryId === String(lib.id) ? colors.accent : colors.border,
                            }}
                          >
                            <Text style={{ fontSize: Typography.sm, color: selectedLibraryId === String(lib.id) ? colors.textOnAccent : colors.textPrimary }}>{lib.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                    {activeFilterTab === 'genre' && (
                      <FilterRowNoLabel items={genres} selectedId={selectedGenreId} onSelect={setSelectedGenreId} />
                    )}
                    {activeFilterTab === 'author' && (
                      <FilterRowNoLabel items={authors} selectedId={selectedAuthorId} onSelect={setSelectedAuthorId} />
                    )}
                    {activeFilterTab === 'tag' && (
                      <FilterRowNoLabel items={tags} selectedId={selectedTagId} onSelect={setSelectedTagId} />
                    )}
                    {activeFilterTab === 'collection' && (
                      <FilterRowNoLabel items={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} />
                    )}
                  </View>
                </View>

              {/* Active Filters */}
              {(selectedGenreId || selectedAuthorId || selectedTagId || selectedCollectionId) && (
                <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, paddingTop: Spacing.xs }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, alignItems: 'center' }}>
                    <Text style={{ fontSize: Typography.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active:</Text>
                    {selectedLibraryId !== null && selectedLibraryId !== undefined && (
                      <TouchableOpacity
                        onPress={() => selectLibrary(null)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 4,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ fontSize: Typography.xs, color: colors.textOnAccent }}>
                          {libraries.find(l => String(l.id) === String(selectedLibraryId))?.name || 'Library'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    )}
                    {selectedGenreId && (
                      <TouchableOpacity
                        onPress={() => setSelectedGenreId(null)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 4,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ fontSize: Typography.xs, color: colors.textOnAccent }}>
                          {genres.find(g => g.id === selectedGenreId)?.title || 'Genre'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    )}
                    {selectedAuthorId && (
                      <TouchableOpacity
                        onPress={() => setSelectedAuthorId(null)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 4,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ fontSize: Typography.xs, color: colors.textOnAccent }}>
                          {authors.find(a => a.id === selectedAuthorId)?.title || 'Author'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    )}
                    {selectedTagId && (
                      <TouchableOpacity
                        onPress={() => setSelectedTagId(null)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 4,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ fontSize: Typography.xs, color: colors.textOnAccent }}>
                          {tags.find(t => t.id === selectedTagId)?.title || 'Tag'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    )}
                    {selectedCollectionId && (
                      <TouchableOpacity
                        onPress={() => setSelectedCollectionId(null)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 4,
                          borderRadius: Radius.md,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ fontSize: Typography.xs, color: colors.textOnAccent }}>
                          {collections.find(c => c.id === selectedCollectionId)?.title || 'Collection'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => { setSelectedGenreId(null); setSelectedAuthorId(null); setSelectedTagId(null); setSelectedCollectionId(null); setSelectedLibraryId(null); }}>
                      <Text style={{ fontSize: Typography.xs, color: colors.accent, fontWeight: Typography.medium }}>Clear all</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <Text style={{ fontSize: Typography.sm, color: colors.textMuted, marginTop: Spacing.xs }}>
                    {items.length} result{items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.centered, { gap: Spacing.md }]}>
              <Ionicons name="headset-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No audiobooks found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]}>
                {selectedGenreId || selectedAuthorId 
                  ? 'Try clearing filters to see more results.'
                  : 'Your Audiobookshelf library appears to be empty. Try scanning for new files.'}
              </Text>
              {!selectedGenreId && !selectedAuthorId && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm }}
                  onPress={async () => {
                    try {
                      await absAPI.scanAllLibraries();
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
              )}
            </View>
          }
          renderItem={({ item }: { item: LibraryItem }) => (
            <AudiobookCard
              item={item}
              cardWidth={cardWidth}
              onPress={() => router.push(`/audiobook/${item.id}`)}
              onPlay={() => handlePlay(item)}
              isPlaying={isPlaying && nowPlaying?.item.id === item.id}
              onContextMenu={(id, title, x, y) => openMenu(id, title, x, y, 'abs')}
            />
          )}
        />
        </View>
      )}

      <GenreTagContextMenu
        visible={chipMenu.visible}
        itemId={chipMenu.itemId ? parseInt(chipMenu.itemId) : null}
        itemTitle={chipMenu.itemTitle}
        itemType={chipMenu.itemType}
        position={chipMenu.position}
        onClose={closeChipMenu}
        onRemoved={() => {
          const id = chipMenu.itemId;
          if (id == null) return;
          if (chipMenu.itemType === 'genre') {
            setGenres(prev => prev.filter(g => g.id !== id));
            if (selectedGenreId === id) setSelectedGenreId(null);
          } else {
            setTags(prev => prev.filter(t => t.id !== id));
            if (selectedTagId === id) setSelectedTagId(null);
          }
          closeChipMenu();
        }}
        onAdded={() => {
          closeChipMenu();
        }}
      />

      <SeriesContextMenu
        visible={ctxMenu.visible}
        seriesId={ctxMenu.seriesId}
        seriesName={ctxMenu.seriesName}
        position={ctxMenu.position}
        onClose={closeMenu}
        onOpenDetail={openDetail}
        provider={ctxMenu.provider}
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
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#1e2132',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  // Web hover effect placeholder - real styling via CSS class
  cardHover: {} as any,
});
