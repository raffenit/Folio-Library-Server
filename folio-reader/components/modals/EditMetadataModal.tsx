import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { LibraryFactory } from '@/services/LibraryFactory';
import { 
  LibraryProvider, 
  LibrarySeriesDetail, 
  LibraryGenre, 
  LibraryTag, 
  LibraryCollection 
} from '@/services/LibraryProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from './modalStyles';

interface EditModalProps {
  visible: boolean;
  seriesId: string | number;
  seriesName: string;
  providerType: 'kavita' | 'abs';
  onClose: () => void;
  onSaved: () => void;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function EditMetadataModal({ 
  visible, 
  seriesId, 
  seriesName, 
  providerType,
  onClose, 
  onSaved 
}: EditModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<LibrarySeriesDetail | null>(null);
  const [allGenres, setAllGenres] = useState<LibraryGenre[]>([]);
  const [allTags, setAllTags] = useState<LibraryTag[]>([]);
  const [allCollections, setAllCollections] = useState<LibraryCollection[]>([]);
  const [collectionsWithSeries, setCollectionsWithSeries] = useState<Set<string | number>>(new Set());
  const [tab, setTab] = useState<'info' | 'genres' | 'tags' | 'collections'>('info');
  const [editSummary, setEditSummary] = useState('');
  const [genreSearch, setGenreSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const tempIdRef = useRef(-1);

  const provider = LibraryFactory.getProvider(providerType);

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function load() {
    setLoading(true);
    setTab('info');
    try {
      const [meta, genres, tags, colls] = await Promise.all([
        provider.getSeriesDetail(seriesId),
        provider.getGenres(),
        provider.getTags(),
        provider.getCollections(),
      ]);
      setMetadata(meta);
      setEditSummary(meta?.summary ?? meta?.description ?? '');
      setAllGenres(genres);
      setAllTags(tags);
      setAllCollections(colls);

      const inCollections = new Set<string | number>();
      await Promise.all(
        colls.map(async (c) => {
          const seriesInColl = await provider.getSeriesInCollection(c.id);
          if (seriesInColl.some(s => String(s.id) === String(seriesId))) {
            inCollections.add(c.id);
          }
        })
      );
      setCollectionsWithSeries(inCollections);
    } catch (e) {
      console.error('Failed to load edit metadata', e);
    } finally {
      setLoading(false);
    }
  }

  function toggleGenre(genre: LibraryGenre) {
    if (!metadata) return;
    const has = metadata.genres.some(g => g.id === genre.id);
    setMetadata({
      ...metadata,
      genres: has ? metadata.genres.filter(g => g.id !== genre.id) : [...metadata.genres, genre],
    });
  }

  function toggleTag(tag: LibraryTag) {
    if (!metadata) return;
    const has = metadata.tags.some(t => t.id === tag.id);
    setMetadata({
      ...metadata,
      tags: has ? metadata.tags.filter(t => t.id !== tag.id) : [...metadata.tags, tag],
    });
  }

  async function toggleCollection(collId: string | number) {
    const next = new Set(collectionsWithSeries);
    if (next.has(collId)) next.delete(collId);
    else next.add(collId);
    setCollectionsWithSeries(next);
  }

  async function save() {
    if (!metadata) return;
    setSaving(true);
    try {
      // 1. Update metadata (summary, genres, tags)
      const savePayload = {
        ...metadata,
        summary: editSummary,
        // In some systems, newly created genres/tags might need id: 0
        genres: metadata.genres.map(g => typeof g.id === 'string' && g.id.startsWith('temp-') ? { ...g, id: 0 } : g),
        tags: metadata.tags.map(t => typeof t.id === 'string' && t.id.startsWith('temp-') ? { ...t, id: 0 } : t),
      };
      await provider.updateSeriesMetadata(savePayload);

      // 2. Update collections
      // We need to compare old vs next
      const originalInColls = new Set<string | number>();
      const currentColls = await provider.getCollections();
      await Promise.all(
        currentColls.map(async (c) => {
          const seriesInColl = await provider.getSeriesInCollection(c.id);
          if (seriesInColl.some(s => String(s.id) === String(seriesId))) {
            originalInColls.add(c.id);
          }
        })
      );

      await Promise.all([
        ...allCollections.map(async (c) => {
          const wasIn = originalInColls.has(c.id);
          const shouldBeIn = collectionsWithSeries.has(c.id);
          if (!wasIn && shouldBeIn) await provider.addSeriesToCollection(c.id, seriesId);
          if (wasIn && !shouldBeIn) await provider.removeSeriesFromCollection(c.id, seriesId);
        })
      ]);

      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  function createGenre(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !metadata) return;
    const tempId = `temp-${tempIdRef.current--}`;
    const newGenre: LibraryGenre = { id: tempId, title: trimmed };
    setAllGenres(prev => [...prev, newGenre]);
    setMetadata({ ...metadata, genres: [...metadata.genres, newGenre] });
    setGenreSearch('');
  }

  function createTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !metadata) return;
    const tempId = `temp-${tempIdRef.current--}`;
    const newTag: LibraryTag = { id: tempId, title: trimmed };
    setAllTags(prev => [...prev, newTag]);
    setMetadata({ ...metadata, tags: [...metadata.tags, newTag] });
    setTagSearch('');
  }

  const filteredGenres = allGenres.filter(g => g.title.toLowerCase().includes(genreSearch.toLowerCase()));
  const filteredTags = allTags.filter(t => t.title.toLowerCase().includes(tagSearch.toLowerCase()));
  const canCreateGenre = genreSearch.trim().length > 0 && !allGenres.some(g => g.title.toLowerCase() === genreSearch.toLowerCase().trim());
  const canCreateTag = tagSearch.trim().length > 0 && !allTags.some(t => t.title.toLowerCase() === tagSearch.toLowerCase().trim());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{seriesName}</Text>
          <TouchableOpacity
            onPress={save}
            disabled={saving || loading}
            style={[styles.modalSave, (saving || loading) && { opacity: 0.5 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <Text style={styles.modalSaveText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {(['info', 'genres', 'tags', 'collections'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {tab === 'info' && (
              <View style={styles.infoTab}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={editSummary}
                  onChangeText={setEditSummary}
                  multiline
                  placeholder="No description…"
                  placeholderTextColor={Colors.textMuted}
                />
                {metadata && (
                  <>
                    <Text style={styles.fieldLabel}>Current Genres</Text>
                    <View style={styles.chipRow}>
                      {metadata.genres.length === 0
                        ? <Text style={styles.noneText}>None assigned</Text>
                        : metadata.genres.map(g => (
                            <Chip key={g.id} label={g.title} selected onPress={() => toggleGenre(g)} />
                          ))
                      }
                    </View>
                    <Text style={styles.fieldLabel}>Current Tags</Text>
                    <View style={styles.chipRow}>
                      {metadata.tags.length === 0
                        ? <Text style={styles.noneText}>None assigned</Text>
                        : metadata.tags.map(t => (
                            <Chip key={t.id} label={t.title} selected onPress={() => toggleTag(t)} />
                          ))
                      }
                    </View>
                  </>
                )}
              </View>
            )}
            {tab === 'genres' && (
              <View>
                <TextInput
                  style={styles.searchInput}
                  value={genreSearch}
                  onChangeText={setGenreSearch}
                  placeholder="Filter genres…"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.chipRow}>
                  {filteredGenres.map(g => (
                    <Chip
                      key={g.id}
                      label={g.title}
                      selected={metadata?.genres.some(mg => mg.id === g.id) ?? false}
                      onPress={() => toggleGenre(g)}
                    />
                  ))}
                  {canCreateGenre && (
                    <TouchableOpacity
                      style={styles.createChip}
                      onPress={() => createGenre(genreSearch)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={14} color={Colors.accent} />
                      <Text style={styles.createChipText}>Create "{genreSearch.trim()}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            {tab === 'tags' && (
              <View>
                <TextInput
                  style={styles.searchInput}
                  value={tagSearch}
                  onChangeText={setTagSearch}
                  placeholder="Filter tags…"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.chipRow}>
                  {filteredTags.map(t => (
                    <Chip
                      key={t.id}
                      label={t.title}
                      selected={metadata?.tags.some(mt => mt.id === t.id) ?? false}
                      onPress={() => toggleTag(t)}
                    />
                  ))}
                  {canCreateTag && (
                    <TouchableOpacity
                      style={styles.createChip}
                      onPress={() => createTag(tagSearch)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={14} color={Colors.accent} />
                      <Text style={styles.createChipText}>Create "{tagSearch.trim()}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            {tab === 'collections' && (
              <View style={styles.chipRow}>
                {allCollections.length === 0 && (
                  <Text style={styles.noneText}>No collections in your library.</Text>
                )}
                {allCollections.map(c => (
                  <Chip
                    key={c.id}
                    label={c.title}
                    selected={collectionsWithSeries.has(c.id)}
                    onPress={() => toggleCollection(c.id)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
