import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  GestureResponderEvent,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { kavitaAPI, Series, Genre, Tag } from '../../services/kavitaAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SeriesCard, useGridColumns } from '../../components/SeriesCard';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import GenreTagContextMenu, { ChipType } from '../../components/GenreTagContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

// ── Continue Reading card (horizontal scroll) ─────────────────────────────────

function ContinueCard({ series, onPress, onContextMenu }: {
  series: Series;
  onPress: () => void;
  onContextMenu?: (id: number, name: string, x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const progress = series.pages > 0 ? (series.pagesRead / series.pages) * 100 : 0;
  const coverUrl = kavitaAPI.getSeriesCoverUrl(series.seriesId ?? series.id);
  const ref = React.useRef<View>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = ref.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(series.id, series.name, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu, series.id, series.name]);

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      onLongPress={onContextMenu ? (e) => onContextMenu(series.id, series.name, e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
      style={{
        width: 130,
        marginRight: Spacing.md,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ aspectRatio: 0.67, width: '100%' }}>
        <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {/* gradient overlay at bottom */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 8, paddingTop: 28, paddingBottom: 8,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.82))' as any,
          backgroundColor: 'transparent',
        }}>
        </View>
        {/* progress bar */}
        {progress > 0 && progress < 100 && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        )}
      </View>
      <View style={{ padding: Spacing.sm }}>
        <Text numberOfLines={2} style={{ fontSize: Typography.xs, color: colors.textPrimary, lineHeight: 15, fontWeight: Typography.medium }}>
          {series.name}
        </Text>
        {series.libraryName && (
          <Text numberOfLines={1} style={{ fontSize: 10, color: colors.accent, marginTop: 2 }}>
            {series.libraryName}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Filter row ────────────────────────────────────────────────────────────────

function FilterRow<T extends { id: number; title?: string; label?: string; name?: string }>({
  label,
  items,
  selectedId,
  onSelect,
  onChipContextMenu,
  onCreateChip,
}: {
  label: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChipContextMenu?: (item: T, x: number, y: number) => void;
  onCreateChip?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs }}
      >
        <Text style={{ fontSize: Typography.xs, fontWeight: Typography.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: Spacing.xs, minWidth: 48 }}>
          {label}
        </Text>
        <TouchableOpacity
          style={[
            { backgroundColor: colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
            selectedId === null && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          onPress={() => onSelect(null)}
          activeOpacity={0.75}
        >
          <Text style={[
            { fontSize: Typography.sm, color: colors.textSecondary, fontWeight: Typography.medium },
            selectedId === null && { color: colors.accent, fontWeight: Typography.semibold },
          ]}>All</Text>
        </TouchableOpacity>
        {items.map(item => {
          const name = (item as any).title ?? (item as any).label ?? (item as any).name ?? '';
          const active = selectedId === item.id;
          return (
            <ChipWithContextMenu
              key={item.id}
              active={active}
              name={name}
              colors={colors}
              onPress={() => onSelect(active ? null : item.id)}
              onContextMenu={onChipContextMenu ? (x, y) => onChipContextMenu(item, x, y) : undefined}
            />
          );
        })}
        {onCreateChip && (
          <TouchableOpacity
            style={{ width: 28, height: 28, borderRadius: Radius.full, borderWidth: 1.5, borderColor: colors.borderLight, borderStyle: 'dashed' as any, justifyContent: 'center', alignItems: 'center' }}
            onPress={onCreateChip}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function ChipWithContextMenu({ active, name, colors, onPress, onContextMenu }: {
  active: boolean; name: string; colors: any;
  onPress: () => void; onContextMenu?: (x: number, y: number) => void;
}) {
  const ref = React.useRef<any>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    const handler = (e: MouseEvent) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu]);

  return (
    <TouchableOpacity
      ref={ref}
      style={[
        { backgroundColor: colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
        active && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
      onPress={onPress}
      onLongPress={onContextMenu ? (e: GestureResponderEvent) => onContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
      delayLongPress={400}
      activeOpacity={0.75}
    >
      <Text style={[
        { fontSize: Typography.sm, color: colors.textSecondary, fontWeight: Typography.medium },
        active && { color: colors.accent, fontWeight: Typography.semibold },
      ]}>{name}</Text>
    </TouchableOpacity>
  );
}

// ── Create Genre/Tag modal ────────────────────────────────────────────────────

function CreateChipModal({ visible, type, allSeries, onClose, onCreated }: {
  visible: boolean;
  type: ChipType;
  allSeries: Series[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [seriesSearch, setSeriesSearch] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setSeriesSearch('');
    setSelectedSeriesId(null);
    setSaving(false);
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (!selectedSeriesId) { setError('Please pick a series to assign it to.'); return; }
    setSaving(true);
    setError('');
    try {
      const meta = await kavitaAPI.getSeriesMetadata(selectedSeriesId);
      if (!meta) throw new Error('Could not load series metadata.');
      if (type === 'genre') {
        meta.genres = [...meta.genres, { id: 0, title: trimmed }];
      } else {
        meta.tags = [...meta.tags, { id: 0, title: trimmed }];
      }
      await kavitaAPI.updateSeriesMetadata(meta);
      onCreated();
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  const filteredSeries = allSeries
    .filter(s => s.name.toLowerCase().includes(seriesSearch.toLowerCase()))
    .slice(0, 30);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md }}>
          <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textPrimary }}>
            New {type === 'genre' ? 'Genre' : 'Tag'}
          </Text>

          <TextInput
            style={{
              backgroundColor: colors.background,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: Radius.md,
              paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
              fontSize: Typography.base, color: colors.textPrimary,
            }}
            value={name}
            onChangeText={setName}
            placeholder={`${type === 'genre' ? 'Genre' : 'Tag'} name…`}
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={{ fontSize: Typography.sm, color: colors.textSecondary }}>
            Assign to a series (required):
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: Radius.md,
              paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
              fontSize: Typography.sm, color: colors.textPrimary,
            }}
            value={seriesSearch}
            onChangeText={setSeriesSearch}
            placeholder="Search series…"
            placeholderTextColor={colors.textMuted}
          />
          <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
            {filteredSeries.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelectedSeriesId(s.id)}
                style={{
                  paddingVertical: Spacing.sm,
                  paddingHorizontal: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: selectedSeriesId === s.id ? colors.accentSoft : 'transparent',
                  marginBottom: 2,
                }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: Typography.sm, color: selectedSeriesId === s.id ? colors.accent : colors.textSecondary, fontWeight: selectedSeriesId === s.id ? Typography.semibold : Typography.regular }}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
            {filteredSeries.length === 0 && (
              <Text style={{ fontSize: Typography.sm, color: colors.textMuted, fontStyle: 'italic', padding: Spacing.md }}>No series found.</Text>
            )}
          </ScrollView>

          {error ? <Text style={{ fontSize: Typography.sm, color: colors.error }}>{error}</Text> : null}

          <TouchableOpacity
            style={{ backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={colors.textOnAccent} />
              : <Text style={{ fontSize: Typography.base, fontWeight: Typography.bold, color: colors.textOnAccent }}>Create {type === 'genre' ? 'Genre' : 'Tag'}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Setup prompt ──────────────────────────────────────────────────────────────

function SetupPrompt() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingBottom: 60 }}>
      <Ionicons name="book-outline" size={64} color={colors.accent} style={{ marginBottom: 24 }} />
      <Text style={{ fontSize: Typography.xxl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: 'Georgia', textAlign: 'center', marginBottom: Spacing.md }}>
        Welcome to Folio
      </Text>
      <Text style={{ fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl }}>
        To get started, connect your Kavita server. You'll need your server URL and API key.
      </Text>
      <View style={{ alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm }}>
        {[
          ['1. Open ', 'Settings', ' (bottom right)'],
          ['2. Tap ', 'Kavita Server'],
          ['3. Enter your server URL and API key'],
          ['4. Tap ', 'Save & Test'],
        ].map((parts, i) => (
          <Text key={i} style={{ fontSize: Typography.base, color: colors.textSecondary, lineHeight: 22 }}>
            {parts[0]}{parts[1] ? <Text style={{ color: colors.textPrimary, fontWeight: Typography.semibold }}>{parts[1]}</Text> : null}{parts[2] ?? ''}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.base, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md }}
        onPress={() => router.push('/(tabs)/settings')}
        activeOpacity={0.8}
      >
        <Ionicons name="settings-outline" size={18} color={colors.textOnAccent} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.textOnAccent, fontSize: Typography.md, fontWeight: Typography.bold }}>Go to Settings</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: Typography.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 18 }}>
        Find your API key in Kavita → User Settings → Security
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();

  const [chipMenu, setChipMenu] = useState<{
    visible: boolean;
    itemId: number | null;
    itemTitle: string;
    itemType: ChipType | null;
    position: { x: number; y: number };
  }>({ visible: false, itemId: null, itemTitle: '', itemType: null, position: { x: 0, y: 0 } });

  function openChipMenu(item: { id: number; title?: string }, type: ChipType, x: number, y: number) {
    setChipMenu({ visible: true, itemId: item.id, itemTitle: item.title ?? '', itemType: type, position: { x, y } });
  }

  function closeChipMenu() {
    setChipMenu(prev => ({ ...prev, visible: false }));
  }

  const [createChipModal, setCreateChipModal] = useState<{ visible: boolean; type: ChipType }>({
    visible: false, type: 'genre',
  });

  const [genres, setGenres] = useState<Genre[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  const [recentSeries, setRecentSeries] = useState<Series[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filterKey = `${selectedGenreId}|${selectedTagId}`;
  const prevFilterKey = useRef(filterKey);

  const fetchMetadata = useCallback(async () => {
    try {
      const [g, t, recent] = await Promise.all([
        kavitaAPI.getGenres(),
        kavitaAPI.getTags(),
        kavitaAPI.getOnDeckSeries(),
      ]);
      setGenres(g);
      setTags(t);
      setRecentSeries(recent.slice(0, 5));
    } catch (e) {
      console.error('Failed to fetch metadata', e);
    }
  }, []);

  const fetchSeries = useCallback(async (pageNum: number, reset: boolean) => {
    setSeriesLoading(true);
    try {
      const pageSize = 30;
      let raw: Series[] = [];
      if (selectedGenreId !== null) {
        raw = await kavitaAPI.getSeriesByGenre(selectedGenreId, pageNum, pageSize);
      } else if (selectedTagId !== null) {
        raw = await kavitaAPI.getSeriesByTag(selectedTagId, pageNum, pageSize);
      } else {
        raw = await kavitaAPI.getAllSeries(pageNum, pageSize);
      }
      if (reset) {
        setSeries(raw);
      } else {
        setSeries(prev => [...prev, ...raw]);
      }
      setHasMore(raw.length === pageSize);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to fetch series', e);
    } finally {
      setSeriesLoading(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedGenreId, selectedTagId]);

  useEffect(() => {
    fetchMetadata();
    fetchSeries(0, true);
  }, []);

  useEffect(() => {
    if (filterKey === prevFilterKey.current) return;
    prevFilterKey.current = filterKey;
    setSeries([]);
    setPage(0);
    setHasMore(true);
    fetchSeries(0, true);
  }, [filterKey]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetadata();
    fetchSeries(0, true);
  };

  function loadMore() {
    if (!hasMore || seriesLoading) return;
    fetchSeries(page + 1, false);
  }

  const hasActiveFilter = selectedGenreId !== null || selectedTagId !== null;

  if (authLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <SetupPrompt />;
  }

  return (
    <>
      <FlatList
        key={numColumns}
        data={series}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        contentContainerStyle={{ paddingBottom: 40, backgroundColor: colors.background }}
        columnWrapperStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View style={{
              paddingTop: 56, paddingBottom: Spacing.lg,
              paddingHorizontal: Spacing.base,
              borderBottomWidth: 1, borderBottomColor: colors.border,
              marginBottom: Spacing.lg,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: Typography.semibold, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Folio
                  </Text>
                  <Text style={{ fontSize: Typography.xxxl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: 'Georgia', lineHeight: 42 }}>
                    Your Library
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: 4 }}>
                  {series.length > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: Typography.xxl, fontWeight: Typography.bold, color: colors.accent, lineHeight: 32 }}>
                        {series.length}{hasMore ? '+' : ''}
                      </Text>
                      <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 1 }}>series</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/settings')}
                    style={{ width: 36, height: 36, borderRadius: Radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Continue Reading ── */}
            {recentSeries.length > 0 && !hasActiveFilter && (
              <View style={{ marginBottom: Spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, marginBottom: Spacing.md }}>
                  <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textPrimary }}>
                    Continue Reading
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                    <Text style={{ fontSize: Typography.xs, color: colors.textMuted }}>{recentSeries.length} in progress</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 4 }}
                >
                  {recentSeries.map((s: any) => (
                    <ContinueCard
                      key={s.seriesId || s.id}
                      series={{ ...s, id: s.seriesId || s.id }}
                      onPress={() => router.push(`/series/${s.seriesId || s.id}`)}
                      onContextMenu={openMenu}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Divider + "All Series" label ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.md, gap: Spacing.md }}>
              <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                All Series
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* ── Filter rows ── */}
            <View style={{ marginBottom: Spacing.md, gap: 6 }}>
              <FilterRow label="Genre" items={genres} selectedId={selectedGenreId} onSelect={setSelectedGenreId}
                onChipContextMenu={(item, x, y) => openChipMenu(item, 'genre', x, y)}
                onCreateChip={() => setCreateChipModal({ visible: true, type: 'genre' })} />
              <FilterRow label="Tag" items={tags} selectedId={selectedTagId} onSelect={setSelectedTagId}
                onChipContextMenu={(item, x, y) => openChipMenu(item, 'tag', x, y)}
                onCreateChip={() => setCreateChipModal({ visible: true, type: 'tag' })} />
            </View>

            {hasActiveFilter && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, paddingTop: Spacing.xs }}>
                <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>
                  {series.length}{hasMore ? '+' : ''} result{series.length !== 1 ? 's' : ''}{seriesLoading ? '…' : ''}
                </Text>
                <TouchableOpacity onPress={() => { setSelectedGenreId(null); setSelectedTagId(null); }}>
                  <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.medium }}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          seriesLoading ? (
            <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !seriesLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: Spacing.xl, gap: Spacing.sm }}>
              <Ionicons name="library-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>No series found</Text>
              <Text style={{ fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                {hasActiveFilter
                  ? 'Try different filters or clear them to see all series.'
                  : 'Your Kavita library appears to be empty.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SeriesCard
            series={item}
            onPress={() => router.push(`/series/${item.id}`)}
            onContextMenu={openMenu}
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

      <GenreTagContextMenu
        visible={chipMenu.visible}
        itemId={chipMenu.itemId}
        itemTitle={chipMenu.itemTitle}
        itemType={chipMenu.itemType}
        position={chipMenu.position}
        onClose={closeChipMenu}
        onRemoved={() => { closeChipMenu(); fetchMetadata(); fetchSeries(0, true); }}
      />

      <CreateChipModal
        visible={createChipModal.visible}
        type={createChipModal.type}
        allSeries={series}
        onClose={() => setCreateChipModal(prev => ({ ...prev, visible: false }))}
        onCreated={() => { fetchMetadata(); fetchSeries(0, true); }}
      />
    </>
  );
}

