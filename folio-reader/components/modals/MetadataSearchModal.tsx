import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { LibraryFactory } from '@/services/LibraryFactory';
import { SearchFactory } from '@/services/SearchFactory';
import { SearchMetadataResult } from '@/services/SearchProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from './modalStyles';

interface MetadataSearchProps {
  visible: boolean;
  seriesId: string | number;
  seriesName: string;
  providerType: 'kavita' | 'abs';
  onClose: () => void;
  onApplied: () => void;
}

function stripQuotes(s: string): string {
  return s.replace(/["“”'‘’`]/g, '').trim();
}

export function MetadataSearchModal({ 
  visible, 
  seriesId, 
  seriesName, 
  providerType,
  onClose, 
  onApplied 
}: MetadataSearchProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMetadataResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SearchMetadataResult | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyFields, setApplyFields] = useState({
    summary: true, genres: true, authors: true, cover: false,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const provider = LibraryFactory.getProvider(providerType);
  const searchProviders = SearchFactory.getAllProviders();

  useEffect(() => {
    if (!visible) return;
    const q = stripQuotes(seriesName);
    setQuery(q);
    setResults([]);
    setSelected(null);
    setWarning('');
    setError('');
    setApplyFields({ summary: true, genres: true, authors: true, cover: false });
    doSearch(q);
  }, [visible]);

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title);
      setEditAuthors(selected.authors.join(', '));
    }
  }, [selected]);

  // Debounce search
  useEffect(() => {
    if (query.length > 2) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        doSearch(query);
      }, 500);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  async function doSearch(customQuery?: string) {
    const q = (customQuery ?? query).trim();
    if (!q) return;
    setSearching(true);
    setError('');

    try {
      const searches = await Promise.allSettled(
        searchProviders.map(p => p.search(q))
      );
      
      const combined: SearchMetadataResult[] = [];
      const warnings: string[] = [];

      searches.forEach((res) => {
        if (res.status === 'fulfilled') {
          combined.push(...res.value.results);
          if (res.value.warning) warnings.push(res.value.warning);
        }
      });

      setResults(combined);
      setWarning(warnings.join(' '));
      if (combined.length === 0) {
        if (warnings.length === 0) setError('No results found. Try a different title.');
        else setError('Search failed at all sources.');
      }
    } catch (e) {
      setError('An unexpected error occurred during search.');
    } finally {
      setSearching(false);
    }
  }

  async function apply() {
    if (!selected) return;
    setApplying(true);
    try {
      if (applyFields.summary || applyFields.genres || applyFields.authors) {
        const currentDetail = await provider.getSeriesDetail(seriesId);
        
        // Merge or replace fields
        const nextDetail = { ...currentDetail };
        
        if (applyFields.summary && selected.description) {
          nextDetail.summary = selected.description;
          nextDetail.description = selected.description;
        }

        if (applyFields.genres && selected.genres.length > 0) {
          const serverGenres = await provider.getGenres();
          const newGenres = selected.genres.map(title => {
            const existing = serverGenres.find(g => g.title.toLowerCase() === title.toLowerCase());
            return existing ?? { id: `temp-${title}`, title };
          });
          
          // Deduplicate and merge
          const existingTitles = new Set((nextDetail.genres || []).map(g => g.title.toLowerCase()));
          const filteredNew = newGenres.filter(g => !existingTitles.has(g.title.toLowerCase()));
          nextDetail.genres = [...(nextDetail.genres || []), ...filteredNew];
        }

        if (applyFields.authors) {
          nextDetail.authorName = editAuthors;
        }

        await provider.updateSeriesMetadata(nextDetail);
      }

      if (applyFields.cover && selected.coverUploadUrl) {
        await provider.updateSeriesCover(seriesId, selected.coverUploadUrl);
        // Cover updates sometimes take a second to stick on some providers
        await new Promise(r => setTimeout(r, 1000));
      }

      onApplied();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to apply metadata');
    } finally {
      setApplying(false);
    }
  }

  function FieldToggle({ field, label }: { field: keyof typeof applyFields; label: string }) {
    return (
      <TouchableOpacity
        style={styles.applyRow}
        onPress={() => setApplyFields(f => ({ ...f, [field]: !f[field] }))}
      >
        <Ionicons
          name={applyFields[field] ? 'checkbox' : 'square-outline'}
          size={24}
          color={applyFields[field] ? Colors.accent : Colors.textMuted}
        />
        <Text style={styles.applyLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={selected ? () => setSelected(null) : onClose} style={styles.modalClose}>
            <Ionicons name={selected ? 'arrow-back' : 'close'} size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{selected ? 'Apply Metadata' : 'Search Metadata'}</Text>
          {selected ? (
            <TouchableOpacity onPress={apply} disabled={applying} style={[styles.modalSave, applying && { opacity: 0.5 }]}>
              {applying ? <ActivityIndicator size="small" color={Colors.accent} /> : <Text style={styles.modalSaveText}>Apply</Text>}
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        {selected ? (
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.metaPreviewHero}>
              {selected.coverUrl ? (
                <Image source={{ uri: selected.coverUrl }} style={styles.metaPreviewCover} resizeMode="cover" />
              ) : (
                <View style={[styles.metaPreviewCover, { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="book" size={32} color={Colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                {selected.year ? <Text style={styles.metaPreviewSub}>{selected.year}</Text> : null}
                {selected.publisher ? <Text style={styles.metaPreviewSub}>{selected.publisher}</Text> : null}
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>
                    {searchProviders.find(p => p.getSourceId() === selected.source)?.getSourceName() ?? selected.source}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput style={[styles.summaryInput, { minHeight: 44 }]} value={editTitle} onChangeText={setEditTitle} />
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Author(s)</Text>
            <TextInput style={[styles.summaryInput, { minHeight: 44 }]} value={editAuthors} onChangeText={setEditAuthors} />
            <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Fields to apply</Text>
            <FieldToggle field="summary" label="Description" />
            <FieldToggle field="genres" label={`Genres (${selected.genres.length} to add)`} />
            <FieldToggle field="authors" label="Author(s) above" />
            <FieldToggle field="cover" label="Cover image" />
            {error ? <Text style={[styles.coverError, { marginTop: Spacing.md }]}>{error}</Text> : null}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <TextInput style={styles.searchInputFlex} value={query} onChangeText={setQuery} placeholder="Title / author…" onSubmitEditing={() => doSearch()} />
              <TouchableOpacity style={styles.searchBtn} onPress={() => doSearch()} disabled={searching}>
                {searching ? <ActivityIndicator size="small" color={Colors.textOnAccent} /> : <Ionicons name="search" size={18} color={Colors.textOnAccent} />}
              </TouchableOpacity>
            </View>
            {warning ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
                <Ionicons name="warning-outline" size={14} color={Colors.textMuted} />
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{warning}</Text>
              </View>
            ) : null}
            {searching ? <View style={styles.centered}><ActivityIndicator color={Colors.accent} /></View> : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                {results.map(r => (
                  <TouchableOpacity key={r.id} style={styles.metaResultCard} onPress={() => setSelected(r)}>
                    {r.coverUrl ? (
                      <Image source={{ uri: r.coverUrl }} style={styles.metaResultThumb} />
                    ) : (
                      <View style={[styles.metaResultThumb, { backgroundColor: Colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="book-outline" size={24} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.metaResultInfo}>
                      <Text style={styles.metaResultTitle} numberOfLines={2}>{r.title}</Text>
                      {r.authors.length > 0 && <Text style={styles.metaResultAuthor}>{r.authors.join(', ')}</Text>}
                      {r.description ? <Text style={styles.metaResultDesc} numberOfLines={2}>{r.description.replace(/<[^>]+>/g, '')}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {error && !searching && results.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.coverError}>{error}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}
