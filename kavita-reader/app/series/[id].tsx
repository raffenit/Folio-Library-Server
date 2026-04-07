import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  kavitaAPI,
  SeriesDetail,
  SeriesMetadata,
  Volume,
  Chapter,
  ChapterFile,
  Genre,
  Tag,
  Collection,
  chapterEffectiveFormat,
  pickBestFile,
} from '../../services/kavitaAPI';
import { absAPI, ABSLibraryItem } from '../../services/audiobookshelfAPI';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography, Spacing, Radius, type ColorScheme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

// ── Format helpers ─────────────────────────────────────────────────────────────

/** Strip ASCII and curly quote characters from a string. */
function stripQuotes(s: string): string {
  return s.replace(/["""''`]/g, '').trim();
}

function formatLabel(fmt: number): string {
  if (fmt === 4) return 'PDF';
  if (fmt === 3) return 'EPUB';
  if (fmt === 1) return 'CBZ';
  return 'File';
}

/** Flatten all volumes into a sorted chapter list. */
export function flatChapters(volumes: Volume[]) {
  const result: { chapter: any; volume: any }[] = [];
  
  volumes.forEach((vol) => {
    vol.chapters?.forEach((ch) => {
      // LOG THIS: If you see 'undefined' or a number like '14', that's the 404 culprit
      console.log(`Mapping Chapter: ${ch.title}, ID: ${ch.id}`); 
      
      result.push({
        chapter: ch,
        volume: vol,
      });
    });
  });
  
  // Sort by chapter number to ensure "Resume" picks the right one
  return result.sort((a, b) => a.chapter.chapterNumber - b.chapter.chapterNumber);
}

/** Pick first unfinished chapter, or last one if all done. */
function pickResumeChapter(volumes: Volume[]): { chapter: Chapter; volume: Volume } | null {
  const all = flatChapters(volumes);
  for (const item of all) {
    const pct = item.chapter.pages > 0 ? item.chapter.pagesRead / item.chapter.pages : 0;
    if (pct < 1) return item;
  }
  return all[all.length - 1] ?? null;
}

// ── Chip component ─────────────────────────────────────────────────────────────

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

// ── Cover Picker Modal ────────────────────────────────────────────────────────

interface CoverPickerProps {
  visible: boolean;
  seriesId: number;
  seriesName: string;
  authorName: string;
  onClose: () => void;
  onSaved: () => void;
}

function CoverPickerModal({ visible, seriesId, seriesName, authorName, onClose, onSaved }: CoverPickerProps) {
  const [mode, setMode] = useState<'choose' | 'search'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ coverId: number; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('choose');
      setSearchQuery(stripQuotes(seriesName));
      setSearchResults([]);
      setError('');
    }
  }, [visible]);

  // Auto-search when entering search mode
  useEffect(() => {
    if (mode === 'search' && searchResults.length === 0 && !searching) {
      searchCovers();
    }
  }, [mode]);

  async function pickFromDevice() {
    if (Platform.OS !== 'web') {
      setError('File upload requires the web version.');
      return;
    }
    const base64 = await pickFileWeb();
    if (!base64) return;
    await upload(base64);
  }

  async function upload(urlOrBase64: string) {
    setUploading(true);
    setError('');
    try {
      if (urlOrBase64.startsWith('http')) {
        await kavitaAPI.uploadSeriesCoverFromUrl(seriesId, urlOrBase64);
      } else {
        await kavitaAPI.uploadSeriesCover(seriesId, urlOrBase64);
      }
      // Give Kavita a moment to process before refreshing the cover
      await new Promise(r => setTimeout(r, 1500));
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function searchCovers(customQuery?: string) {
    const q = stripQuotes(customQuery ?? searchQuery);
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    setError('');
    try {
      // title= is faster than q= (targeted index); fields limits payload size
      const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=12&fields=title,cover_i`;
      const res = await fetch(`/openlibrary-proxy?url=${encodeURIComponent(olUrl)}`);
      if (!res.ok) throw new Error(`Search returned ${res.status}`);
      const json = await res.json();
      const results = (json.docs ?? [])
        .filter((d: any) => d.cover_i)
        .map((d: any) => ({ coverId: d.cover_i, title: d.title ?? '' }));
      setSearchResults(results);
      if (results.length === 0) setError('No covers found. Try a different search.');
    } catch (e: any) {
      setError(`Search failed: ${e?.message ?? 'unknown error'}`);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Change Cover</Text>
          <View style={{ width: 40 }} />
        </View>

        {mode === 'choose' ? (
          <View style={styles.coverChooseContainer}>
            <TouchableOpacity style={styles.coverOptionBtn} onPress={pickFromDevice} disabled={uploading} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={28} color={Colors.accent} />
              <Text style={styles.coverOptionText}>Upload from device</Text>
              <Text style={styles.coverOptionSub}>Pick a local image file</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.coverOptionBtn} onPress={() => { setMode('search'); }} activeOpacity={0.8}>
              <Ionicons name="search-outline" size={28} color={Colors.accent} />
              <Text style={styles.coverOptionText}>Search online</Text>
              <Text style={styles.coverOptionSub}>Find covers from Open Library</Text>
            </TouchableOpacity>
            {uploading && <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.lg }} />}
            {error ? <Text style={styles.coverError}>{error}</Text> : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInputFlex}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Book title / author…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={() => searchCovers()}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => searchCovers()} disabled={searching} activeOpacity={0.8}>
                {searching
                  ? <ActivityIndicator size="small" color={Colors.textOnAccent} />
                  : <Ionicons name="search" size={18} color={Colors.textOnAccent} />
                }
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.coverError}>{error}</Text> : null}
            <ScrollView contentContainerStyle={styles.coverGrid}>
              {searchResults.map((r) => {
                const rawThumb = `https://covers.openlibrary.org/b/id/${r.coverId}-M.jpg`;
                const rawFull = `https://covers.openlibrary.org/b/id/${r.coverId}-L.jpg`;
                const thumbUrl = `/openlibrary-proxy?url=${encodeURIComponent(rawThumb)}`;
                const fullUrl = rawFull; // upload goes via cover-proxy, not direct fetch
                return (
                  <TouchableOpacity
                    key={r.coverId}
                    style={styles.coverThumbWrap}
                    onPress={() => upload(fullUrl)}
                    disabled={uploading}
                    activeOpacity={0.75}
                  >
                    <Image source={{ uri: thumbUrl }} style={styles.coverThumb} resizeMode="cover" />
                    <Text style={styles.coverThumbTitle} numberOfLines={2}>{r.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.uploadingText}>Uploading cover…</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

/** Web-only: open a file picker and return a base64 data URL */
function pickFileWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// ── Edit Metadata Modal ────────────────────────────────────────────────────────

interface EditModalProps {
  visible: boolean;
  seriesId: number;
  seriesName: string;
  onClose: () => void;
  onSaved: () => void;
}

function EditMetadataModal({ visible, seriesId, seriesName, onClose, onSaved }: EditModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<SeriesMetadata | null>(null);
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [collectionsWithSeries, setCollectionsWithSeries] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'info' | 'genres' | 'tags' | 'collections'>('info');
  const [editSummary, setEditSummary] = useState('');
  const [genreSearch, setGenreSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const tempIdRef = useRef(-1);

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function load() {
    setLoading(true);
    setTab('info');
    try {
      const [meta, genres, tags, colls] = await Promise.all([
        kavitaAPI.getSeriesMetadata(seriesId),
        kavitaAPI.getGenres(),
        kavitaAPI.getTags(),
        kavitaAPI.getCollections(),
      ]);
      setMetadata(meta);
      setEditSummary(meta?.summary ?? '');
      setAllGenres(genres);
      setAllTags(tags);
      setAllCollections(colls);

      const inCollections = new Set<number>();
      await Promise.all(
        colls.map(async (c) => {
          const series = await kavitaAPI.getSeriesForCollection(c.id);
          if (series.some(s => s.id === seriesId)) inCollections.add(c.id);
        })
      );
      setCollectionsWithSeries(inCollections);
    } catch (e) {
      console.error('Failed to load edit metadata', e);
    } finally {
      setLoading(false);
    }
  }

  function toggleGenre(genre: Genre) {
    if (!metadata) return;
    const has = metadata.genres.some(g => g.id === genre.id);
    setMetadata({
      ...metadata,
      genres: has ? metadata.genres.filter(g => g.id !== genre.id) : [...metadata.genres, genre],
    });
  }

  function toggleTag(tag: Tag) {
    if (!metadata) return;
    const has = metadata.tags.some(t => t.id === tag.id);
    setMetadata({
      ...metadata,
      tags: has ? metadata.tags.filter(t => t.id !== tag.id) : [...metadata.tags, tag],
    });
  }

  async function toggleCollection(collId: number) {
    const next = new Set(collectionsWithSeries);
    if (next.has(collId)) next.delete(collId);
    else next.add(collId);
    setCollectionsWithSeries(next);
  }

  async function save() {
    if (!metadata) return;
    setSaving(true);
    try {
      // Map temp IDs (negative) to 0 so Kavita creates them server-side
      const cleanedMetadata = {
        ...metadata,
        summary: editSummary,
        genres: metadata.genres.map(g => g.id < 0 ? { ...g, id: 0 } : g),
        tags: metadata.tags.map(t => t.id < 0 ? { ...t, id: 0 } : t),
      };
      await kavitaAPI.updateSeriesMetadata(cleanedMetadata);
      await Promise.all(
        allCollections.map(async (c) => {
          const wasIn = (await kavitaAPI.getSeriesForCollection(c.id)).some(s => s.id === seriesId);
          const shouldBeIn = collectionsWithSeries.has(c.id);
          if (!wasIn && shouldBeIn) await kavitaAPI.addSeriesToCollection(c.id, seriesId);
          if (wasIn && !shouldBeIn) {
            await kavitaAPI.removeSeriesFromCollection(c, seriesId);
          }
        })
      );
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
    const tempId = tempIdRef.current--;
    const newGenre: Genre = { id: tempId, title: trimmed };
    setAllGenres(prev => [...prev, newGenre]);
    setMetadata({ ...metadata, genres: [...metadata.genres, newGenre] });
    setGenreSearch('');
  }

  function createTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !metadata) return;
    const tempId = tempIdRef.current--;
    const newTag: Tag = { id: tempId, title: trimmed };
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
                  {filteredGenres.length === 0 && !canCreateGenre && <Text style={styles.noneText}>No genres found.</Text>}
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
                  {filteredTags.length === 0 && !canCreateTag && <Text style={styles.noneText}>No tags found.</Text>}
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

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function SeriesDetailScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;

  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [metadata, setMetadata] = useState<SeriesMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [coverKey, setCoverKey] = useState(0); // bump to force cover re-fetch
  const [coverError, setCoverError] = useState('');
  const [absMatch, setAbsMatch] = useState<ABSLibraryItem | null | undefined>(undefined); // undefined = searching

  useEffect(() => { setCoverError(''); }, [coverKey]);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [det, meta] = await Promise.all([
        kavitaAPI.getSeriesDetail(Number(id)),
        kavitaAPI.getSeriesMetadata(Number(id)),
      ]);
      setDetail(det);
      setMetadata(meta);
    } catch (e) {
      console.error('Failed to load series', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [id]);

  // Search ABS for a matching audiobook when the series title is known
  useEffect(() => {
    if (!detail?.name || !absAPI.hasCredentials()) {
      setAbsMatch(null);
      return;
    }
    setAbsMatch(undefined);
    absAPI.searchByTitle(detail.name).then(setAbsMatch);
  }, [detail?.name]);

  function openChapter(chapter: Chapter, volume: Volume, fileOverride?: ChapterFile) {
    // If we see -1000, we know the metadata is stale
    if (volume.id < 0) {
      console.warn("⚠️ Metadata Alert: This book is in a 'Virtual Volume' (-1000). Navigation may fail.");
    }
    
    // 1. Identify the file and format
    const file = fileOverride ?? pickBestFile(chapter.files);
    const fmt = file?.format ?? chapterEffectiveFormat(chapter);

    // 2. Build the navigation params
    // Use the 'id' variable from your component's props/state for seriesId
    const navParams = {
      chapterId: chapter.id,
      volumeId: volume.id,
      seriesId: id, // Using your existing 'id' variable
      title: detail?.name ?? '',
    };

    // Log the exact URL that will be constructed in the Reader
    console.log(`🔗 Requesting: /api/Book/${chapter.id}/book-info`);

    // --- DEBUG LOG ---
    console.log("NAVIGATING WITH:", navParams);

    // 3. Logic-check the ID before navigating
    if (!chapter.id || chapter.id === volume.id) {
      console.error("Warning: Chapter ID is missing or matches Volume ID. This will 404.", {
        chapterId: chapter.id,
        seriesId: volume.id
      });
    }

    // 4. Route to the correct reader
    if (fmt === 4) {
      router.push({ pathname: '/reader/pdf', params: navParams });
    } else if (fmt === 3) {
      router.push({ pathname: '/reader/epub', params: navParams });
    } else if (fmt == 0) {
      console.log(`Format = 0! Checking Format: ${fmt} for Chapter: ${chapter.id}`);
      router.push({ pathname: '/reader/epub', params: navParams });
    } else {
      router.push({ pathname: '/reader/image', params: navParams });
    }
  }

  // Add the '?' after detail
  const resume = detail?.volumes ? pickResumeChapter(detail.volumes) : null;

  function handleRead() {
  // Guard clause: if detail or volumes is null, stop here
  if (!detail?.volumes) return; 

  const resume = pickResumeChapter(detail.volumes);
  if (resume) {
    openChapter(resume.chapter, resume.volume);
  }
}

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load series.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = kavitaAPI.getSeriesCoverUrl(detail.id) + `&v=${coverKey}`;
  const overallProgress = (() => {
    const totalPages = detail.volumes?.reduce((s, v) => s + v.pages, 0) ?? 0;
    const pagesRead = detail.volumes?.reduce((s, v) => s + v.pagesRead, 0) ?? 0;
    return totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
  })();

  const displaySummary = metadata?.summary || detail.summary || '';
  const authors = metadata?.writers?.map(w => w.name).join(', ') ?? '';
  const chapters = flatChapters(detail.volumes ?? []);

  const MetaBlock = (
    <View style={[styles.metaBlock, isLargeScreen && styles.metaBlockLarge]}>
      <Text style={styles.seriesTitle}>{detail.name}</Text>
      {authors ? (
        <Text style={styles.authorText}>{authors}</Text>
      ) : null}

      {/* Genres & Tags */}
      {((metadata?.genres?.length ?? 0) > 0 || (metadata?.tags?.length ?? 0) > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {metadata?.genres?.map(g => (
            <View key={`g-${g.id}`} style={styles.metaChip}>
              <Text style={styles.metaChipText}>{g.title}</Text>
            </View>
          ))}
          {metadata?.tags?.map(t => (
            <View key={`t-${t.id}`} style={[styles.metaChip, styles.metaChipTag]}>
              <Text style={[styles.metaChipText, styles.metaChipTagText]}>{t.title}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Description */}
      {displaySummary ? (
        <TouchableOpacity onPress={() => setSummaryExpanded(v => !v)} activeOpacity={0.8}>
          <Text style={styles.summary} numberOfLines={summaryExpanded ? undefined : 4}>
            {displaySummary}
          </Text>
          {!summaryExpanded && displaySummary.length > 200 && (
            <Text style={styles.summaryToggle}>Read more</Text>
          )}
          {summaryExpanded && <Text style={styles.summaryToggle}>Show less</Text>}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setEditVisible(true)} activeOpacity={0.8}>
          <Text style={styles.noSummary}>No description. Tap ✏ to add one.</Text>
        </TouchableOpacity>
      )}

      {/* Progress */}
      {overallProgress > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${overallProgress}%` }]} />
          </View>
          <Text style={styles.progressPct}>{overallProgress}%</Text>
        </View>
      )}

      {/* Read + Edit buttons */}
      <View style={styles.readButtonContainer}>
        <TouchableOpacity style={styles.readButton} onPress={handleRead} activeOpacity={0.85}>
          <Ionicons name="book" size={20} color={Colors.textOnAccent} style={{ marginRight: 8 }} />
          <Text style={styles.readButtonText}>
            {overallProgress > 0 && overallProgress < 100 ? 'Continue Reading' : 'Read'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button (floats top-left always) */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        {isLargeScreen ? (
          /* ── Large screen: cover sidebar + meta side by side ── */
          <View style={styles.heroRow}>
            <TouchableOpacity style={styles.coverSidebarWrap} onPress={() => setCoverPickerVisible(true)} activeOpacity={0.85}>
              <Image key={coverKey} source={{ uri: coverUrl }} style={styles.coverSidebar} resizeMode="cover"
                onError={(e) => { const msg = (e.nativeEvent as any)?.error ?? 'load error'; console.error('[cover] image error:', msg, coverUrl); setCoverError(msg); }} />
              {coverError ? <Text style={styles.coverErrorText} numberOfLines={3}>{coverError}</Text> : null}
              <View style={styles.coverEditOverlay}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            {MetaBlock}
          </View>
        ) : (
          /* ── Small screen: compact cover on top ── */
          <>
            <TouchableOpacity style={styles.coverSmallWrap} onPress={() => setCoverPickerVisible(true)} activeOpacity={0.85}>
              <Image key={coverKey} source={{ uri: coverUrl }} style={styles.coverSmall} resizeMode="cover"
                onError={(e) => { const msg = (e.nativeEvent as any)?.error ?? 'load error'; console.error('[cover] image error:', msg, coverUrl); setCoverError(msg); }} />
              {coverError ? <Text style={styles.coverErrorText} numberOfLines={3}>{coverError}</Text> : null}
              <View style={styles.coverEditOverlay}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            {MetaBlock}
          </>
        )}

        {/* ── Audiobook suggestion banner ── */}
        {absMatch && (
          <TouchableOpacity
            style={styles.absBanner}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/audiobook/[id]', params: { id: absMatch.id, title: absMatch.media?.metadata?.title ?? detail.name } })}
          >
            <View style={styles.absBannerIcon}>
              <Ionicons name="headset" size={22} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.absBannerTitle}>Audiobook available</Text>
              <Text style={styles.absBannerSub} numberOfLines={1}>
                {absMatch.media?.metadata?.title ?? detail.name}
                {absMatch.media?.metadata?.authorName ? ` · ${absMatch.media.metadata.authorName}` : ''}
              </Text>
            </View>
            <Ionicons name="play-circle" size={32} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {/* ── Chapter list ── */}
        <View style={styles.chaptersSection}>
          <Text style={styles.chaptersHeader}>Chapters</Text>
          {chapters.length === 0 ? (
            <Text style={styles.noChapters}>No chapters found.</Text>
          ) : (
            chapters.map(({ chapter, volume }) => {
              const chProgress = chapter.pages > 0 ? (chapter.pagesRead / chapter.pages) * 100 : 0;
              
              // Ensure we safely handle files
              const files = chapter.files ?? [];
              const bestFile = pickBestFile(files);
              
              // Explicitly type 'f' as the same type as bestFile
              const altFiles = files.filter((f: typeof bestFile) => f && f.id !== bestFile?.id);
                         
              const chLabel = chapter.isSpecial
                ? chapter.title || 'Special'
                : chapter.number !== '0'
                ? `Chapter ${chapter.number}`
                : chapter.title || 'Read';
              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.chapterRow}
                  onPress={() => {
                    console.log("NAVIGATING TO CHAPTER:", chapter.id);
                    router.push({ pathname: '/reader/epub', params: { chapterId: chapter.id } });
                    openChapter(chapter, volume)
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.chapterLeft}>
                    <Text style={styles.chapterNum}>{chLabel}</Text>
                    <View style={styles.chapterMeta}>
                      <Text style={styles.chapterPages}>{chapter.pages} pages</Text>
                      {bestFile && (
                        <View style={styles.formatBadge}>
                          <Text style={styles.formatBadgeText}>{formatLabel(bestFile.format)}</Text>
                        </View>
                      )}
                      {/* Alt format chips */}
                      {altFiles.map((f: any) => ( // Type 'f' as any or your File type
                        <TouchableOpacity
                          key={f.id}
                          style={styles.altFormatBadge}
                          onPress={(e: any) => { // Type 'e' as any to allow stopPropagation()
                            e.stopPropagation();
                            openChapter(chapter, volume, f);
                          }}
                        >
                          <Text style={styles.altFormatText}>{formatLabel(f.format)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.chapterRight}>
                    {chProgress > 0 && chProgress < 100 ? (
                      <View style={styles.chapterProgressContainer}>
                        <View style={styles.chapterProgressTrack}>
                          <View style={[styles.chapterProgressFill, { width: `${chProgress}%` }]} />
                        </View>
                        <Text style={styles.chapterProgressText}>{Math.round(chProgress)}%</Text>
                      </View>
                    ) : chProgress >= 100 ? (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    ) : (
                      <Ionicons name="play-circle-outline" size={20} color={Colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <EditMetadataModal
        visible={editVisible}
        seriesId={Number(id)}
        seriesName={detail.name}
        onClose={() => setEditVisible(false)}
        onSaved={loadData}
      />
      <CoverPickerModal
        visible={coverPickerVisible}
        seriesId={Number(id)}
        seriesName={detail.name}
        authorName={authors}
        onClose={() => setCoverPickerVisible(false)}
        onSaved={() => { setCoverKey(k => k + 1); loadData(); }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorScheme) {
  return {
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, backgroundColor: c.background, justifyContent: 'center' as const, alignItems: 'center' as const, gap: Spacing.md },
    scroll: { paddingBottom: 60 },
    backButton: { position: 'absolute' as const, top: 52, left: Spacing.base, zIndex: 10, width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' as const, alignItems: 'center' as const },
    coverErrorText: { position: 'absolute' as const, top: 4, left: 4, right: 4, fontSize: 9, color: c.error, backgroundColor: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 4, zIndex: 10 },
    coverEditOverlay: { position: 'absolute' as const, bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.full, width: 28, height: 28, justifyContent: 'center' as const, alignItems: 'center' as const },
    coverChooseContainer: { flex: 1, padding: Spacing.xl, gap: Spacing.lg, justifyContent: 'center' as const },
    coverOptionBtn: { backgroundColor: c.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.xl, alignItems: 'center' as const, gap: Spacing.sm },
    coverOptionText: { fontSize: Typography.md, fontWeight: Typography.bold as any, color: c.textPrimary },
    coverOptionSub: { fontSize: Typography.sm, color: c.textSecondary },
    coverError: { fontSize: Typography.sm, color: c.error, textAlign: 'center' as const, paddingHorizontal: Spacing.lg },
    searchRow: { flexDirection: 'row' as const, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm },
    searchInputFlex: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary },
    searchBtn: { backgroundColor: c.accent, borderRadius: Radius.md, width: 44, height: 44, justifyContent: 'center' as const, alignItems: 'center' as const },
    coverGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: Spacing.base, gap: Spacing.md, paddingBottom: 40 },
    coverThumbWrap: { width: 100, alignItems: 'center' as const, gap: 4 },
    coverThumb: { width: 100, height: 140, borderRadius: Radius.sm, backgroundColor: c.surface },
    coverThumbTitle: { fontSize: 10, color: c.textSecondary, textAlign: 'center' as const, lineHeight: 14 },
    uploadingOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,13,18,0.7)', justifyContent: 'center' as const, alignItems: 'center' as const, gap: Spacing.md },
    uploadingText: { fontSize: Typography.base, color: c.textPrimary },
    heroRow: { flexDirection: 'row' as const, paddingTop: 60, paddingHorizontal: Spacing.xl, gap: Spacing.xl, alignItems: 'flex-start' as const },
    coverSidebarWrap: { width: 200, borderRadius: Radius.md, overflow: 'hidden' as const, flexShrink: 0, position: 'relative' as const },
    coverSidebar: { width: 200, height: 280, borderRadius: Radius.md },
    coverSmallWrap: { alignItems: 'center' as const, paddingTop: 72, paddingBottom: Spacing.lg, backgroundColor: c.surface, position: 'relative' as const },
    coverSmall: { width: 140, height: 200, borderRadius: Radius.md },
    metaBlock: { padding: Spacing.base, paddingTop: Spacing.md, gap: Spacing.md },
    metaBlockLarge: { flex: 1, paddingTop: 0 },
    seriesTitle: { fontSize: Typography.xxl, fontWeight: Typography.bold as any, color: c.textPrimary, fontFamily: Typography.serif, lineHeight: 34 },
    authorText: { fontSize: Typography.md, color: c.accent, fontWeight: Typography.semibold as any, marginTop: -Spacing.xs },
    chipScroll: { flexGrow: 0 },
    metaChip: { backgroundColor: c.accentSoft, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginRight: Spacing.xs, borderWidth: 1, borderColor: c.accent + '44' },
    metaChipText: { fontSize: Typography.xs, color: c.accent, fontWeight: Typography.medium as any },
    metaChipTag: { backgroundColor: c.surfaceElevated, borderColor: c.border },
    metaChipTagText: { color: c.textSecondary },
    summary: { fontSize: Typography.base, color: c.textSecondary, lineHeight: 23 },
    summaryToggle: { fontSize: Typography.sm, color: c.accent, marginTop: 4 },
    noSummary: { fontSize: Typography.sm, color: c.textMuted, fontStyle: 'italic' as const },
    progressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.sm },
    progressTrack: { flex: 1, height: 4, backgroundColor: c.progressTrack, borderRadius: Radius.full, overflow: 'hidden' as const },
    progressFill: { height: '100%' as any, backgroundColor: c.accent },
    progressPct: { fontSize: Typography.sm, color: c.textSecondary },
    readButtonContainer: { flexDirection: 'row' as const, gap: Spacing.sm },
    readButton: { flex: 1, flexDirection: 'row' as const, backgroundColor: c.accent, borderRadius: Radius.md, paddingVertical: Spacing.base + 2, alignItems: 'center' as const, justifyContent: 'center' as const, shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
    readButtonText: { fontSize: Typography.md, fontWeight: Typography.bold as any, color: c.textOnAccent, letterSpacing: 0.3 },
    editBtn: { width: 52, backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center' as const, justifyContent: 'center' as const },
    absBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, marginHorizontal: Spacing.base, marginTop: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.base, backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: c.accent, gap: Spacing.md },
    absBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, justifyContent: 'center' as const, alignItems: 'center' as const },
    absBannerTitle: { fontSize: Typography.sm, fontWeight: Typography.bold as any, color: c.textPrimary },
    absBannerSub: { fontSize: Typography.xs, color: c.textSecondary, marginTop: 2 },
    chaptersSection: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, gap: 2 },
    chaptersHeader: { fontSize: Typography.lg, fontWeight: Typography.bold as any, color: c.textPrimary, marginBottom: Spacing.md },
    noChapters: { fontSize: Typography.base, color: c.textMuted },
    chapterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
    chapterLeft: { flex: 1, gap: 3 },
    chapterNum: { fontSize: Typography.base, color: c.textPrimary, fontWeight: Typography.medium as any },
    chapterMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.sm, flexWrap: 'wrap' as const },
    chapterPages: { fontSize: Typography.sm, color: c.textMuted },
    formatBadge: { backgroundColor: c.accent + '22', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.accent + '55' },
    formatBadgeText: { fontSize: 10, color: c.accent, fontWeight: Typography.bold as any, letterSpacing: 0.5 },
    altFormatBadge: { backgroundColor: c.surface, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.border },
    altFormatText: { fontSize: 10, color: c.textSecondary, fontWeight: Typography.medium as any, letterSpacing: 0.3 },
    chapterRight: { alignItems: 'flex-end' as const, paddingLeft: Spacing.md },
    chapterProgressContainer: { alignItems: 'flex-end' as const, gap: 3 },
    chapterProgressTrack: { width: 60, height: 4, backgroundColor: c.progressTrack, borderRadius: Radius.full, overflow: 'hidden' as const },
    chapterProgressFill: { height: '100%' as any, backgroundColor: c.accent },
    chapterProgressText: { fontSize: 10, color: c.textSecondary },
    errorText: { fontSize: Typography.lg, color: c.textSecondary },
    backLink: { fontSize: Typography.base, color: c.accent },
    modalContainer: { flex: 1, backgroundColor: c.background },
    modalHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    modalClose: { width: 40, height: 40, justifyContent: 'center' as const, alignItems: 'center' as const },
    modalTitle: { flex: 1, textAlign: 'center' as const, fontSize: Typography.base, fontWeight: Typography.semibold as any, color: c.textPrimary },
    modalSave: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    modalSaveText: { fontSize: Typography.base, fontWeight: Typography.bold as any, color: c.accent },
    tabBar: { flexDirection: 'row' as const, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' as const, borderBottomWidth: 2, borderBottomColor: 'transparent' as any },
    tabBtnActive: { borderBottomColor: c.accent },
    tabLabel: { fontSize: Typography.sm, color: c.textSecondary, fontWeight: Typography.medium as any },
    tabLabelActive: { color: c.accent, fontWeight: Typography.bold as any },
    modalScroll: { flex: 1 },
    modalScrollContent: { padding: Spacing.base, paddingBottom: 40 },
    infoTab: { gap: Spacing.lg },
    fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold as any, color: c.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: Spacing.xs },
    summaryInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary, minHeight: 120, textAlignVertical: 'top' as const },
    searchInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary, marginBottom: Spacing.md },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: Spacing.sm },
    chip: { backgroundColor: c.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderWidth: 1, borderColor: c.border },
    chipSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontSize: Typography.sm, color: c.textSecondary, fontWeight: Typography.medium as any },
    chipTextSelected: { color: c.accent },
    noneText: { fontSize: Typography.sm, color: c.textMuted, fontStyle: 'italic' as const },
    createChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5 },
    createChipText: { fontSize: Typography.sm, color: c.accent, fontWeight: Typography.medium as any },
  };
}
