/**
 * BulkEditModal
 * Modal for bulk editing genres, tags, and collections on multiple series.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { kavitaAPI, Genre, Tag, Collection, SeriesMetadata } from '../services/kavitaAPI';
import { Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  seriesIds: (string | number)[];
  allGenres: Genre[];
  allTags: Tag[];
  allCollections: Collection[];
  onClose: () => void;
  onComplete: () => void;
}

type EditTab = 'genres' | 'tags' | 'collections';

interface EditState {
  genres: Set<number>;
  tags: Set<number>;
  collections: Set<number>;
}

function Chip({
  label,
  selected,
  indeterminate,
  onPress,
}: {
  label: string;
  selected: boolean;
  indeterminate?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{
        backgroundColor: selected
          ? colors.accentSoft
          : indeterminate
          ? colors.warningSoft || 'rgba(255, 193, 7, 0.2)'
          : colors.background,
        borderRadius: Radius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderWidth: 1,
        borderColor: selected
          ? colors.accent
          : indeterminate
          ? colors.warning || '#ffc107'
          : colors.border,
      }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text
          style={{
            fontSize: 12,
            color: selected
              ? colors.accent
              : indeterminate
              ? colors.warning || '#ffc107'
              : colors.textSecondary,
          }}
        >
          {label}
        </Text>
        {indeterminate && (
          <Ionicons
            name="remove"
            size={12}
            color={colors.warning || '#ffc107'}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function BulkEditModal({
  visible,
  seriesIds,
  allGenres,
  allTags,
  allCollections,
  onClose,
  onComplete,
}: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<EditTab>('genres');
  const [editState, setEditState] = useState<EditState>({
    genres: new Set(),
    tags: new Set(),
    collections: new Set(),
  });
  const [originalStates, setOriginalStates] = useState<EditState[]>([]);

  // Load current metadata for all selected series
  useEffect(() => {
    if (!visible || seriesIds.length === 0) return;

    async function loadMetadata() {
      setLoading(true);
      setError('');
      try {
        const metadataList: (SeriesMetadata | null)[] = [];
        for (const id of seriesIds) {
          const numericId =
            typeof id === 'string' ? parseInt(id, 10) : (id as number);
          try {
            const meta = await kavitaAPI.getSeriesMetadata(numericId);
            metadataList.push(meta);
          } catch {
            metadataList.push(null);
          }
        }

        // Calculate intersection for genres/tags (what all selected have in common)
        const genreSets = metadataList
          .filter((m): m is SeriesMetadata => m !== null)
          .map((m) => new Set(m.genres.map((g) => g.id)));
        const tagSets = metadataList
          .filter((m): m is SeriesMetadata => m !== null)
          .map((m) => new Set(m.tags.map((t) => t.id)));

        // Get collection membership for each series
        const collectionMembership = new Set<number>();
        for (const coll of allCollections) {
          const seriesInColl = await kavitaAPI.getSeriesForCollection(coll.id);
          if (
            seriesIds.every((id) =>
              seriesInColl.some(
                (s) =>
                  s.id === (typeof id === 'string' ? parseInt(id, 10) : id)
              )
            )
          ) {
            collectionMembership.add(coll.id);
          }
        }

        // Store original states for comparison
        setOriginalStates(
          metadataList.map((m) => ({
            genres: m
              ? new Set(m.genres.map((g) => g.id))
              : new Set<number>(),
            tags: m ? new Set(m.tags.map((t) => t.id)) : new Set<number>(),
            collections: collectionMembership,
          }))
        );

        // Set initial edit state to intersection (items all have in common)
        setEditState({
          genres: calculateIntersection(genreSets),
          tags: calculateIntersection(tagSets),
          collections: collectionMembership,
        });
      } catch (e) {
        setError('Failed to load metadata');
      } finally {
        setLoading(false);
      }
    }

    loadMetadata();
  }, [visible, seriesIds, allCollections]);

  function calculateIntersection(sets: Set<number>[]): Set<number> {
    if (sets.length === 0) return new Set();
    const intersection = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      for (const id of intersection) {
        if (!sets[i].has(id)) {
          intersection.delete(id);
        }
      }
    }
    return intersection;
  }

  function isIndeterminate(itemId: number, type: EditTab): boolean {
    if (originalStates.length === 0) return false;

    const count = originalStates.filter((state) => {
      const set = type === 'genres' ? state.genres : type === 'tags' ? state.tags : state.collections;
      return set.has(itemId);
    }).length;

    // Indeterminate if some have it but not all
    return count > 0 && count < originalStates.length;
  }

  function toggleItem(itemId: number, type: EditTab) {
    setEditState((prev) => {
      const newState = { ...prev };
      const set =
        type === 'genres'
          ? new Set(prev.genres)
          : type === 'tags'
          ? new Set(prev.tags)
          : new Set(prev.collections);

      if (set.has(itemId)) {
        set.delete(itemId);
      } else {
        set.add(itemId);
      }

      if (type === 'genres') newState.genres = set;
      else if (type === 'tags') newState.tags = set;
      else newState.collections = set;

      return newState;
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    setProgress(0);

    try {
      const total = seriesIds.length;
      let completed = 0;

      // Process in batches of 3 for better performance
      const batchSize = 3;
      for (let i = 0; i < seriesIds.length; i += batchSize) {
        const batch = seriesIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (id) => {
            const numericId =
              typeof id === 'string' ? parseInt(id, 10) : (id as number);

            try {
              // Get current metadata
              const meta = await kavitaAPI.getSeriesMetadata(numericId);
              if (!meta) {
                throw new Error(`Failed to fetch metadata for series ${numericId}`);
              }

              // Update genres - use existing genre objects from metadata if possible
              // to ensure we have the correct format
              const newGenres = editState.genres.size === 0 
                ? [] 
                : allGenres.filter((g) => editState.genres.has(g.id));

              // Update tags
              const newTags = editState.tags.size === 0
                ? []
                : allTags.filter((t) => editState.tags.has(t.id));

              // Create updated metadata object
              const updatedMetadata = {
                ...meta,
                genres: newGenres,
                tags: newTags,
              };

              // Save metadata
              await kavitaAPI.updateSeriesMetadata(updatedMetadata);

              // Verify the update was saved by re-fetching
              const verifyMeta = await kavitaAPI.getSeriesMetadata(numericId);
              if (verifyMeta && verifyMeta.genres.length !== newGenres.length) {
                console.warn(`Series ${numericId}: Genre count mismatch after update. Expected ${newGenres.length}, got ${verifyMeta.genres.length}`);
              }

              // Handle collections separately
              for (const coll of allCollections) {
                const shouldBeIn = editState.collections.has(coll.id);
                const currentSeries = await kavitaAPI.getSeriesForCollection(
                  coll.id
                );
                const isCurrentlyIn = currentSeries.some(
                  (s) => s.id === numericId
                );

                if (shouldBeIn && !isCurrentlyIn) {
                  await kavitaAPI.addSeriesToCollection(coll.id, numericId);
                } else if (!shouldBeIn && isCurrentlyIn) {
                  await kavitaAPI.removeSeriesFromCollection(coll, numericId);
                }
              }
            } catch (e) {
              console.error(`Failed to update series ${numericId}:`, e);
            }

            completed++;
            setProgress(completed / total);
          })
        );
      }

      onComplete();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const activeList =
    tab === 'genres' ? allGenres : tab === 'tags' ? allTags : allCollections;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={!saving ? onClose : undefined}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View
          style={[
            styles.content,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Bulk Edit ({seriesIds.length} series)
            </Text>
            {!saving && (
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {(['genres', 'tags', 'collections'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tab,
                  { borderBottomColor: tab === t ? colors.accent : 'transparent' },
                ]}
                onPress={() => setTab(t)}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: tab === t ? colors.accent : colors.textSecondary,
                    fontWeight: tab === t ? Typography.bold : Typography.medium,
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textMuted, marginTop: Spacing.sm }}>
                Loading metadata...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.chipsContainer}
            >
              {activeList.length === 0 && (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>
                  No {tab} available.
                </Text>
              )}
              {activeList.map((item) => (
                <Chip
                  key={item.id}
                  label={item.title}
                  selected={
                    tab === 'genres'
                      ? editState.genres.has(item.id)
                      : tab === 'tags'
                      ? editState.tags.has(item.id)
                      : editState.collections.has(item.id)
                  }
                  indeterminate={isIndeterminate(item.id, tab)}
                  onPress={() => toggleItem(item.id, tab)}
                />
              ))}
            </ScrollView>
          )}

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Progress bar */}
          {saving && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.background },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.accent,
                      width: `${progress * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}

          {/* Footer */}
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: colors.border },
              ]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 },
              ]}
              onPress={save}
              disabled={saving || loading}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <Text style={{ color: colors.textOnAccent, fontWeight: Typography.bold }}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    width: Platform.OS === 'web' ? 480 : '100%',
    maxWidth: '100%',
    maxHeight: '80%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    maxHeight: 300,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    textAlign: 'center',
    padding: Spacing.sm,
  },
  progressContainer: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  saveButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 120,
    alignItems: 'center',
  },
});
