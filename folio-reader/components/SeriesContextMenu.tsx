/**
 * SeriesContextMenu
 * A floating modal triggered by right-click (web) or long-press (native).
 * Lets the user toggle genres, tags, and collection membership for a series.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { kavitaAPI, SeriesMetadata, Genre, Tag, Collection } from '../services/kavitaAPI';
import { Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../services/storage';

const RECENT_STORAGE_KEY = 'folio_recent_context_items';
const MAX_RECENT_ITEMS = 5;

interface RecentItems {
  genres: number[];
  tags: number[];
  collections: number[];
}

async function getRecentItems(): Promise<RecentItems> {
  const stored = await storage.getItem(RECENT_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch { }
  }
  return { genres: [], tags: [], collections: [] };
}

async function addRecentItem(type: 'genres' | 'tags' | 'collections', id: number) {
  const recent = await getRecentItems();
  const list = recent[type];
  // Remove if already exists (to move to front)
  const filtered = list.filter(item => item !== id);
  // Add to front
  filtered.unshift(id);
  // Keep only max items
  recent[type] = filtered.slice(0, MAX_RECENT_ITEMS);
  await storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface Props {
  visible: boolean;
  seriesId: string | number | null;
  seriesName: string;
  position: ContextMenuPosition;
  onClose: () => void;
  onOpenDetail?: () => void;
  provider?: 'kavita' | 'abs' | null;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ backgroundColor: selected ? colors.accentSoft : colors.background, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: selected ? colors.accent : colors.border }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={{ fontSize: 12, color: selected ? colors.accent : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SeriesContextMenu({
  visible, seriesId, seriesName, position, onClose, onOpenDetail, provider,
}: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  
  // Normalize seriesId to number for Kavita API
  const numericSeriesId = seriesId != null ? (typeof seriesId === 'string' ? parseInt(seriesId, 10) : seriesId) : null;
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<SeriesMetadata | null>(null);
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [collectionsWithSeries, setCollectionsWithSeries] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'genres' | 'tags' | 'collections'>('genres');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItems>({ genres: [], tags: [], collections: [] });

  useEffect(() => {
    if (visible && seriesId != null) {
      setTab('genres');
      setSearch('');
      setSaved(false);
      setSaveError('');
      loadData();
      // Load recent items
      getRecentItems().then(setRecentItems);
    }
  }, [visible, seriesId]);

  async function loadData() {
    if (numericSeriesId == null) return;
    setLoading(true);
    try {
      // Skip Kavita-specific data loading for ABS items
      if (provider === 'abs') {
        setMetadata(null);
        setAllGenres([]);
        setAllTags([]);
        setAllCollections([]);
        setCollectionsWithSeries(new Set());
        return;
      }
      const [meta, genres, tags, colls] = await Promise.all([
        kavitaAPI.getSeriesMetadata(numericSeriesId),
        kavitaAPI.getGenres(),
        kavitaAPI.getTags(),
        kavitaAPI.getCollections(),
      ]);
      setMetadata(meta);
      setAllGenres(genres);
      setAllTags(tags);
      setAllCollections(colls);
      // Determine collection membership
      const inColls = new Set<number>();
      await Promise.all(
        colls.map(async (c) => {
          const series = await kavitaAPI.getSeriesForCollection(c.id);
          if (series?.some(s => s.id === numericSeriesId)) inColls.add(c.id);
        })
      );
      setCollectionsWithSeries(inColls);
    } catch (e) {
      console.error('[SeriesContextMenu] Failed to load data', e);
    } finally {
      setLoading(false);
    }
  }

  function toggleGenre(g: Genre) {
    if (!metadata) return;
    const has = metadata.genres.some(mg => mg.id === g.id);
    const newMetadata = { ...metadata, genres: has ? metadata.genres.filter(mg => mg.id !== g.id) : [...metadata.genres, g] };
    setMetadata(newMetadata);
    // Track as recent when selecting (not deselecting)
    if (!has) {
      addRecentItem('genres', g.id);
      setRecentItems(prev => ({ ...prev, genres: [g.id, ...prev.genres.filter(id => id !== g.id)].slice(0, MAX_RECENT_ITEMS) }));
    }
  }

  function toggleTag(t: Tag) {
    if (!metadata) return;
    const has = metadata.tags.some(mt => mt.id === t.id);
    const newMetadata = { ...metadata, tags: has ? metadata.tags.filter(mt => mt.id !== t.id) : [...metadata.tags, t] };
    setMetadata(newMetadata);
    // Track as recent when selecting (not deselecting)
    if (!has) {
      addRecentItem('tags', t.id);
      setRecentItems(prev => ({ ...prev, tags: [t.id, ...prev.tags.filter(id => id !== t.id)].slice(0, MAX_RECENT_ITEMS) }));
    }
  }

  function toggleCollection(collId: number) {
    const next = new Set(collectionsWithSeries);
    const wasSelected = next.has(collId);
    if (wasSelected) next.delete(collId); else next.add(collId);
    setCollectionsWithSeries(next);
    // Track as recent when selecting (not deselecting)
    if (!wasSelected) {
      addRecentItem('collections', collId);
      setRecentItems(prev => ({ ...prev, collections: [collId, ...prev.collections.filter(id => id !== collId)].slice(0, MAX_RECENT_ITEMS) }));
    }
  }

  async function save() {
    if (!metadata) return;
    setSaving(true);
    setSaveError('');
    try {
      await kavitaAPI.updateSeriesMetadata(metadata);
      if (numericSeriesId == null) return;
      await Promise.all(
        allCollections.map(async (c) => {
          const wasIn = collectionsWithSeries.has(c.id);
          const current = await kavitaAPI.getSeriesForCollection(c.id);
          const isIn = current.some(s => s.id === numericSeriesId);
          if (!isIn && wasIn) await kavitaAPI.addSeriesToCollection(c.id, numericSeriesId);
          if (isIn && !wasIn) await kavitaAPI.removeSeriesFromCollection(c, numericSeriesId);
        })
      );
      setSaved(true);
      setTimeout(onClose, 800);
    } catch (e: any) {
      setSaveError(e?.response?.data?.title ?? e?.message ?? 'Save failed — check console');
      console.error('Context menu save failed', e);
    } finally {
      setSaving(false);
    }
  }

  // Position the popup near the tap/click, clamped to screen
  const MENU_W = Math.min(320, width - 32);
  const MENU_H = 400;
  const left = Math.min(position.x, width - MENU_W - 16);
  const top = Math.min(position.y, height - MENU_H - 60);

  const activeList = tab === 'genres' ? allGenres : tab === 'tags' ? allTags : allCollections;
  const filteredList = activeList.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  // Get recent items for current tab
  const recentIds = tab === 'genres' ? recentItems.genres : tab === 'tags' ? recentItems.tags : recentItems.collections;
  const recentList = recentIds
    .map(id => activeList.find(item => item.id === id))
    .filter((item): item is Genre | Tag | Collection => item !== undefined)
    .filter(item => !filteredList.includes(item) || search === ''); // Don't duplicate if already in filtered list

  function isSelected(item: Genre | Tag | Collection) {
    if (tab === 'genres') return metadata?.genres.some(g => g.id === item.id) ?? false;
    if (tab === 'tags') return metadata?.tags.some(t => t.id === item.id) ?? false;
    return collectionsWithSeries.has(item.id);
  }

  function handleToggle(item: Genre | Tag | Collection) {
    if (tab === 'genres') toggleGenre(item as Genre);
    else if (tab === 'tags') toggleTag(item as Tag);
    else toggleCollection(item.id);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </TouchableWithoutFeedback>

      <View style={{ position: 'absolute', width: MENU_W, top, left, backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', shadowColor: colors.cardShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
          <Text style={{ flex: 1, fontSize: Typography.base, fontWeight: Typography.bold, color: colors.textPrimary }} numberOfLines={2}>{seriesName}</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: Spacing.sm }}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {onOpenDetail && (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={onOpenDetail}>
            <Ionicons name="book-outline" size={16} color={colors.accent} />
            <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: Typography.medium }}>Open Detail</Text>
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {(['genres', 'tags', 'collections'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={{ flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.accent : 'transparent' }}
              onPress={() => { setTab(t); setSearch(''); }}
            >
              <Text style={{ fontSize: 12, color: tab === t ? colors.accent : colors.textSecondary, fontWeight: tab === t ? Typography.bold : Typography.medium }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <TextInput
              style={{ margin: Spacing.sm, backgroundColor: colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, fontSize: Typography.sm, color: colors.textPrimary }}
              value={search}
              onChangeText={setSearch}
              placeholder={`Filter ${tab}…`}
              placeholderTextColor={colors.textMuted}
            />
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
              {/* Recent Items Section */}
              {recentList.length > 0 && search === '' && (
                <>
                  <View style={{ width: '100%', marginTop: Spacing.xs, marginBottom: 2 }}>
                    <Text style={{ fontSize: 11, color: colors.accent, fontWeight: Typography.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent</Text>
                  </View>
                  {recentList.map(item => (
                    <Chip key={`recent-${item.id}`} label={item.title} selected={isSelected(item)} onPress={() => handleToggle(item)} />
                  ))}
                  <View style={{ width: '100%', height: 1, backgroundColor: colors.border, marginVertical: Spacing.sm }} />
                  <View style={{ width: '100%', marginBottom: 2 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: Typography.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>All</Text>
                  </View>
                </>
              )}
              {filteredList.length === 0 && (
                <Text style={{ fontSize: Typography.sm, color: colors.textMuted, fontStyle: 'italic', padding: Spacing.sm }}>No {tab} found.</Text>
              )}
              {filteredList.map(item => (
                <Chip key={item.id} label={item.title} selected={isSelected(item)} onPress={() => handleToggle(item)} />
              ))}
            </ScrollView>
          </>
        )}

        {saveError ? <Text style={{ fontSize: 11, color: colors.error, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, textAlign: 'center' }}>{saveError}</Text> : null}

        <TouchableOpacity
          style={{ flexDirection: 'row', backgroundColor: colors.accent, margin: Spacing.sm, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, opacity: saving ? 0.6 : 1 }}
          onPress={save}
          disabled={saving || loading}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : saved ? (
            <>
              <Ionicons name="checkmark" size={16} color={colors.textOnAccent} />
              <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: colors.textOnAccent }}>Saved!</Text>
            </>
          ) : (
            <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: colors.textOnAccent }}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
