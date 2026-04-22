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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { kavitaAPI, Series, Genre, Tag, Collection } from '../../services/kavitaAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SeriesCard, useGridColumns } from '../../components/SeriesCard';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import GenreTagContextMenu, { ChipType } from '../../components/GenreTagContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PWAInstallBanner } from '../../components/PWAInstallBanner';
import TabHeader from '../../components/TabHeader';

// ── Continue Reading card (horizontal scroll) ─────────────────────────────────

function ContinueCard({ series, onPress, onContextMenu }: {
  series: Series;
  onPress: () => void;
  onContextMenu?: (id: number, name: string, x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const progress = series.pages > 0 ? (series.pagesRead / series.pages) * 100 : 0;
  const coverUrl = kavitaAPI.getSeriesCoverUrl(series.id);
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
        backgroundColor: '#1e2132',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <View style={{ aspectRatio: 0.67, width: '100%' }}>
        <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {/* gradient overlay at bottom */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 8, paddingTop: 28, paddingBottom: 8,
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
          {series.localizedName || series.name}
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

// ── Filter row without label (for tabbed interface) ───────────────────────────

function FilterRowNoLabel<T extends { id: number; title?: string; label?: string; name?: string }>({
  items,
  selectedId,
  onSelect,
  onChipContextMenu,
  onCreateChip,
}: {
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChipContextMenu?: (item: T, x: number, y: number) => void;
  onCreateChip?: () => void;
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
      {items.map(item => {
        const name = (item as any).title ?? (item as any).label ?? (item as any).name ?? '';
        const active = selectedId === item.id;
        return (
          <GradientChip
            key={item.id}
            label={name}
            active={active}
            colors={colors}
            onPress={() => onSelect(item.id)}
            onLongPress={onChipContextMenu ? (x, y) => onChipContextMenu(item, x, y) : undefined}
          />
        );
      })}
      {onCreateChip && (
        <GradientChip
          label="+"
          active={false}
          colors={colors}
          onPress={onCreateChip}
        />
      )}
    </ScrollView>
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
  const filterRowRef = React.useRef<View>(null);
  const [dividerWidth, setDividerWidth] = React.useState(0);

  React.useEffect(() => {
    if (Platform.OS === 'web' && filterRowRef.current) {
      const el = filterRowRef.current as any as HTMLElement;
      setDividerWidth(el.getBoundingClientRect().width);
    }
  }, []);

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
        {/* Fixed label - doesn't scroll */}
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
          {items.map(item => {
            const name = (item as any).title ?? (item as any).label ?? (item as any).name ?? '';
            const active = selectedId === item.id;
            return (
              <GradientChip
                key={item.id}
                label={name}
                active={active}
                colors={colors}
                onPress={() => onSelect(active ? null : item.id)}
                onContextMenu={onChipContextMenu ? (x, y) => onChipContextMenu(item, x, y) : undefined}
              />
            );
          })}
          {onCreateChip && (
            <TouchableOpacity
              style={{ width: 28, height: 28, borderRadius: Radius.full, borderWidth: 1.5, borderColor: colors.accent, borderStyle: 'dashed' as any, justifyContent: 'center', alignItems: 'center', backgroundColor: `${colors.accent}15` }}
              onPress={onCreateChip}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function GradientChip({ label, active, colors, onPress, onContextMenu }: {
  label: string; active: boolean; colors: any;
  onPress: () => void; onContextMenu?: (x: number, y: number) => void;
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

  // Use same gradient colors as dividers/labels for border and text - green to blue to purple to red-purple (linear)
  const gradientBorder = `linear-gradient(${gradientAngle}deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)`;
  const textGradient = `linear-gradient(${gradientAngle}deg, ${colors.accent} 0%, ${colors.secondary} 40%, #8B6DB8 70%, #A85A95 100%)`;

  if (Platform.OS === 'web') {
    return (
      <div
        ref={wrapperRef}
        style={{
          display: 'inline-block',
          borderRadius: Radius.full,
          padding: 1, // Space for gradient border
          background: gradientBorder,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onContextMenu ? (e: GestureResponderEvent) => onContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
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

  // Fallback for native
  return (
    <TouchableOpacity
      style={[
        { backgroundColor: 'rgba(10, 12, 25, 0.85)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: active ? '#F5E6D3' : colors.border },
        active && { backgroundColor: 'rgba(245, 230, 211, 0.95)', borderColor: '#F5E6D3' },
      ]}
      onPress={onPress}
      onLongPress={onContextMenu ? (e: GestureResponderEvent) => onContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
      delayLongPress={400}
      activeOpacity={1}
    >
      <Text style={[
        { fontSize: Typography.sm, color: active ? '#1a1a2e' : colors.textSecondary, fontWeight: active ? Typography.semibold : Typography.medium },
      ]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Create Genre/Tag modal ────────────────────────────────────────────────────

function CreateChipModal({ visible, type, allSeries, onClose, onCreated }: {
  visible: boolean;
  type: ChipType;
  allSeries: Series[];
  onClose: () => void;
  onCreated: (name: string) => void;
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
      onCreated(trimmed);
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
                  {s.localizedName || s.name}
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

// ── Setup prompt ──────────────────────────────────────────────────────────────

function SetupPrompt() {
  const router = useRouter();
  const { colors, uiAnimationsEnabled } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingBottom: 60 }}>
      <Animated.View 
        entering={uiAnimationsEnabled ? FadeInDown.delay(100).springify() : undefined}
        style={{ alignItems: 'center' }}
      >
        <Ionicons name="book-outline" size={64} color={colors.accent} style={{ marginBottom: 24 }} />
        <Text style={{ fontSize: Typography.xxl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: Typography.serif, textAlign: 'center', marginBottom: Spacing.md }}>
          Welcome to Folio
        </Text>
        <Text style={{ fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl }}>
          To get started, connect your Kavita server. You'll need your server URL and API key.
        </Text>
      </Animated.View>

      <Animated.View 
        entering={uiAnimationsEnabled ? FadeInDown.delay(200).springify() : undefined}
        style={{ alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm }}
      >
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
      </Animated.View>

      <Animated.View entering={uiAnimationsEnabled ? FadeInUp.delay(300).springify() : undefined}>
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
      </Animated.View>
    </View>
  );
}

export default function EbooksScreen() {
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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [authors, setAuthors] = useState<{ id: number; title: string }[]>([]);

  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(null);

  const [recentSeries, setRecentSeries] = useState<Series[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [libraries, setLibraries] = useState<any[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'library' | 'genre' | 'author' | 'tag' | 'collection'>('library');

  const filterKey = `${selectedGenreId}|${selectedTagId}|${selectedCollectionId}|${selectedAuthorId}|${selectedLibraryId}`;
  const prevFilterKey = useRef(filterKey);
  const flatListRef = useRef<FlatList<Series> | null>(null);
  const scrollPositionRef = useRef(0);

  // Helper to filter items in parallel batches (much faster than sequential)
  const filterWithSeries = async <T extends { id: number }>(
    items: T[],
    fetcher: (id: number) => Promise<{ length: number }>
  ): Promise<T[]> => {
    const batchSize = 8; // Check 8 items in parallel
    const results: (T | null)[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const series = await fetcher(item.id);
            return series.length > 0 ? item : null;
          } catch {
            return null;
          }
        })
      );
      results.push(...batchResults);
    }
    
    return results.filter((item): item is T => item !== null);
  };

  const fetchMetadata = useCallback(async () => {
    // Fire each request independently so each section renders as soon as its own data arrives
    // Filter genres and tags in parallel batches to remove empty ones (fast but accurate)
    try {
      const allGenres = await kavitaAPI.getGenres();
      const genresWithSeries = await filterWithSeries(allGenres, (id) => kavitaAPI.getSeriesByGenre(id, 0, 1));
      setGenres(genresWithSeries);
    } catch {}

    try {
      const allTags = await kavitaAPI.getTags();
      const tagsWithSeries = await filterWithSeries(allTags, (id) => kavitaAPI.getSeriesByTag(id, 0, 1));
      setTags(tagsWithSeries);
    } catch {}

    kavitaAPI.getCollections().then(setCollections).catch(() => {});
    kavitaAPI.getOnDeckSeries()
      .then(value => {
        const arr: any[] = Array.isArray(value) ? value : (value as any)?.items ?? [];
        setRecentSeries(arr.slice(0, 5));
      })
      .catch(() => {});
    kavitaAPI.getLibraries()
      .then(libs => {
        setLibraries(libs);
        if (libs.length > 0 && selectedLibraryId === null) {
          setSelectedLibraryId(libs[0].id);
        }
      })
      .catch(() => {});
  }, [selectedLibraryId]);

  // Refresh metadata (genres, tags, on-deck) silently whenever this tab regains focus.
  // Using fetchMetadata covers all three; it's fast since responses are small.
  useFocusEffect(
    useCallback(() => {
      if (!kavitaAPI.hasCredentials()) return;
      fetchMetadata();
    }, [fetchMetadata])
  );

  const fetchSeries = useCallback(async (pageNum: number, reset: boolean) => {
    setSeriesLoading(true);
    try {
      const pageSize = 30;
      let raw: Series[] = [];
      if (selectedCollectionId !== null) {
        // Collections don't support pagination in the same way, so we fetch all and slice
        raw = await kavitaAPI.getSeriesForCollection(selectedCollectionId);
        // For collections, we don't support pagination - return all results at once
        if (reset) {
          setSeries(raw);
          setHasMore(false);
          setPage(0);
        }
        setSeriesLoading(false);
        return;
      } else if (selectedGenreId !== null) {
        raw = await kavitaAPI.getSeriesByGenre(selectedGenreId, pageNum, pageSize);
      } else if (selectedTagId !== null) {
        raw = await kavitaAPI.getSeriesByTag(selectedTagId, pageNum, pageSize);
      } else if (selectedLibraryId !== null) {
        raw = await kavitaAPI.getSeriesForLibrary(selectedLibraryId, pageNum, pageSize);
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
  }, [selectedGenreId, selectedTagId, selectedLibraryId]);

  useEffect(() => {
    // Wait for async auth initialization before checking credentials
    if (authLoading) return;
    if (!isAuthenticated || !kavitaAPI.hasCredentials()) {
      setLoading(false);
      return;
    }
    fetchMetadata();
    fetchSeries(0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (filterKey === prevFilterKey.current) return;
    prevFilterKey.current = filterKey;
    // Save scroll position before clearing data
    const currentScroll = scrollPositionRef.current;
    setSeries([]);
    setPage(0);
    setHasMore(true);
    fetchSeries(0, true).then(() => {
      // Restore scroll position after data loads
      setTimeout(() => {
        if (flatListRef.current && currentScroll > 0) {
          flatListRef.current.scrollToOffset({ offset: currentScroll, animated: false });
        }
      }, 100);
    });
  }, [filterKey]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetadata();
    fetchSeries(0, true);
  };

  // Extract authors from loaded series metadata
  useEffect(() => {
    const extractAuthorsFromSeries = async () => {
      if (series.length === 0) return;
      
      const authorMap = new Map<number, string>();
      
      // Fetch metadata for series to extract writers
      // Process in batches to avoid too many concurrent requests
      const batchSize = 5;
      for (let i = 0; i < series.length; i += batchSize) {
        const batch = series.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (s) => {
            try {
              const metadata = await kavitaAPI.getSeriesMetadata(s.id);
              if (metadata?.writers) {
                metadata.writers.forEach(writer => {
                  if (writer.id && writer.name && !authorMap.has(writer.id)) {
                    authorMap.set(writer.id, writer.name);
                  }
                });
              }
            } catch {
              // Skip series with no metadata
            }
          })
        );
      }
      
      const authorItems = Array.from(authorMap.entries())
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));
      
      setAuthors(authorItems);
    };
    
    extractAuthorsFromSeries();
  }, [series]);

  function loadMore() {
    if (!hasMore || seriesLoading) return;
    fetchSeries(page + 1, false);
  }

  const hasActiveFilter = selectedGenreId !== null || selectedTagId !== null || selectedCollectionId !== null || selectedAuthorId !== null;

  if (authLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!kavitaAPI.hasCredentials()) {
    return <SetupPrompt />;
  }

  return (
    <View style={{
      flex: 1,
      zIndex: 1,
      backgroundColor: Platform.OS === 'web' ? 'rgba(5, 6, 15, 0.15)' : colors.background,
    } as any}>
      <PWAInstallBanner />
      <TabHeader 
        title="Ebooks" 
        count={series.length} 
        countLabel="series"
        hasMore={hasMore} 
        serverName="Kavita" 
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        onSelectLibrary={(id) => setSelectedLibraryId(Number(id))}
      />
      <View style={{ height: Spacing.md }} />
      
      <View style={{ flex: 1, marginHorizontal: Spacing.base }}>
        <FlatList
          ref={flatListRef}
          key={numColumns}
          data={series}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: Spacing.base, backgroundColor: 'transparent' }}
          columnWrapperStyle={{ gap: Spacing.sm, marginBottom: Spacing.sm }}
        onScroll={(e) => { scrollPositionRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            {recentSeries.length > 0 && (
              <View style={{ marginBottom: Spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm }}>
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
                      borderTopWidth: 2,
                      borderLeftWidth: activeFilterTab === 'library' ? 1 : 0,
                      borderRightWidth: activeFilterTab === 'library' ? 1 : 0,
                      borderTopColor: activeFilterTab === 'library' ? colors.accent : 'transparent',
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
                    borderTopWidth: 2,
                    borderLeftWidth: activeFilterTab === 'genre' ? 1 : 0,
                    borderRightWidth: activeFilterTab === 'genre' ? 1 : 0,
                    borderTopColor: activeFilterTab === 'genre' ? colors.accent : 'transparent',
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
                    borderTopWidth: 2,
                    borderLeftWidth: activeFilterTab === 'author' ? 1 : 0,
                    borderRightWidth: activeFilterTab === 'author' ? 1 : 0,
                    borderTopColor: activeFilterTab === 'author' ? colors.accent : 'transparent',
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
                    borderTopWidth: 2,
                    borderLeftWidth: activeFilterTab === 'tag' ? 1 : 0,
                    borderRightWidth: activeFilterTab === 'tag' ? 1 : 0,
                    borderTopColor: activeFilterTab === 'tag' ? colors.accent : 'transparent',
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
                    borderTopWidth: 2,
                    borderLeftWidth: activeFilterTab === 'collection' ? 1 : 0,
                    borderRightWidth: activeFilterTab === 'collection' ? 1 : 0,
                    borderTopColor: activeFilterTab === 'collection' ? colors.accent : 'transparent',
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
                      onPress={() => setSelectedLibraryId(null)}
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
                        onPress={() => setSelectedLibraryId(lib.id)}
                        style={{
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: Radius.md,
                          backgroundColor: selectedLibraryId === lib.id ? colors.accent : colors.surface,
                          borderWidth: 1,
                          borderColor: selectedLibraryId === lib.id ? colors.accent : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: Typography.sm, color: selectedLibraryId === lib.id ? colors.textOnAccent : colors.textPrimary }}>{lib.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {activeFilterTab === 'genre' && (
                  <FilterRowNoLabel items={genres} selectedId={selectedGenreId} onSelect={setSelectedGenreId} onChipContextMenu={(item, x, y) => openChipMenu(item, 'genre', x, y)} onCreateChip={() => setCreateChipModal({ visible: true, type: 'genre' })} />
                )}
                {activeFilterTab === 'author' && (
                  <FilterRowNoLabel items={authors} selectedId={selectedAuthorId} onSelect={setSelectedAuthorId} />
                )}
                {activeFilterTab === 'tag' && (
                  <FilterRowNoLabel items={tags} selectedId={selectedTagId} onSelect={setSelectedTagId} onChipContextMenu={(item, x, y) => openChipMenu(item, 'tag', x, y)} onCreateChip={() => setCreateChipModal({ visible: true, type: 'tag' })} />
                )}
                {activeFilterTab === 'collection' && (
                  <FilterRowNoLabel items={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} />
                )}
              </View>
            </View>

            {/* Active Filters */}
            {hasActiveFilter && (
              <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, paddingTop: Spacing.xs }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, alignItems: 'center' }}>
                  <Text style={{ fontSize: Typography.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active:</Text>
                  {selectedLibraryId !== null && selectedLibraryId !== undefined && (
                    <TouchableOpacity
                      onPress={() => setSelectedLibraryId(null)}
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
                        {libraries.find(l => l.id === selectedLibraryId)?.name || 'Library'}
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
                  {series.length}{hasMore ? '+' : ''} result{series.length !== 1 ? 's' : ''}{seriesLoading ? '…' : ''}
                </Text>
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
            <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: Spacing.xl, gap: Spacing.md }}>
              <Ionicons name="library-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>No series found</Text>
              <Text style={{ fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                {hasActiveFilter
                  ? 'Try different filters or clear them to see all series.'
                  : 'Your Kavita library appears to be empty. Try scanning for new files.'}
              </Text>
              {!hasActiveFilter && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm }}
                  onPress={async () => {
                    try {
                      if (selectedLibraryId) {
                        await kavitaAPI.scanLibrary(selectedLibraryId);
                      } else {
                        await kavitaAPI.scanAllLibraries();
                      }
                      // Refresh after a short delay to let scan start
                      setTimeout(() => onRefresh(), 2000);
                    } catch (e) {
                      console.error('Scan failed', e);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.textOnAccent} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.textOnAccent, fontSize: Typography.base, fontWeight: Typography.bold }}>Scan Library</Text>
                </TouchableOpacity>
              )}
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
      </View>

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
        onRemoved={() => { 
          // Optimistically remove from local state using chipMenu.itemId
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
          fetchMetadata(); 
          fetchSeries(0, true); 
        }}
        onAdded={() => {
          // Refresh to show updated counts
          fetchMetadata();
          fetchSeries(0, true);
        }}
        allSeries={series.map(s => ({ id: s.id, name: s.name }))}
      />

      <CreateChipModal
        visible={createChipModal.visible}
        type={createChipModal.type}
        allSeries={series}
        onClose={() => setCreateChipModal(prev => ({ ...prev, visible: false }))}
        onCreated={(name) => { 
          // Optimistically add to local state with a temporary ID
          const tempId = Date.now();
          if (createChipModal.type === 'genre') {
            setGenres(prev => [...prev, { id: tempId, title: name } as Genre]);
          } else {
            setTags(prev => [...prev, { id: tempId, title: name } as Tag]);
          }
          fetchMetadata(); 
          fetchSeries(0, true); 
        }}
      />
    </View>
  );
}

