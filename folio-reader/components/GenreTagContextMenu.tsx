/**
 * GenreTagContextMenu
 * Floating modal triggered by right-click (web) or long-press on a genre/tag chip.
 * Lets the user remove a genre or tag from all series that have it,
 * or add it to other series.
 */
import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  ScrollView,
} from 'react-native';
import { kavitaAPI } from '../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface SeriesItem {
  id: number;
  name: string;
}

export interface ChipContextMenuPosition {
  x: number;
  y: number;
}

export type ChipType = 'genre' | 'tag';

interface Props {
  visible: boolean;
  itemId: number | null;
  itemTitle: string;
  itemType: ChipType | null;
  position: ChipContextMenuPosition;
  onClose: () => void;
  onRemoved: () => void;
  onAdded?: () => void;
  allSeries?: SeriesItem[];
}

export default function GenreTagContextMenu({
  visible, itemId, itemTitle, itemType, position, onClose, onRemoved, onAdded, allSeries = [],
}: Props) {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'menu' | 'confirm-remove' | 'add-select' | 'working' | 'done'>('menu');
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<number>>(new Set());

  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) return allSeries;
    const q = searchQuery.toLowerCase();
    return allSeries.filter(s => s.name.toLowerCase().includes(q));
  }, [allSeries, searchQuery]);

  function handleClose() {
    setMode('menu');
    setWorking(false);
    setProgress(null);
    setError('');
    setSearchQuery('');
    setSelectedSeriesIds(new Set());
    onClose();
  }

  function toggleSeriesSelection(id: number) {
    setSelectedSeriesIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runRemove() {
    if (itemId == null || !itemType) return;
    setMode('working');
    setWorking(true);
    setError('');
    setProgress({ done: 0, total: 0 });
    try {
      const onProgress = (d: number, t: number) => setProgress({ done: d, total: t });
      if (itemType === 'genre') {
        await kavitaAPI.removeGenreFromAllSeries(itemId, onProgress);
      } else {
        await kavitaAPI.removeTagFromAllSeries(itemId, onProgress);
      }
      setMode('done');
      setTimeout(() => { onRemoved(); handleClose(); }, 1000);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setMode('confirm-remove');
    } finally {
      setWorking(false);
    }
  }

  async function runAddToSeries() {
    if (itemId == null || !itemType || selectedSeriesIds.size === 0) return;
    setMode('working');
    setWorking(true);
    setError('');
    setProgress({ done: 0, total: selectedSeriesIds.size });
    try {
      const item = { id: itemId, title: itemTitle };
      let done = 0;
      for (const seriesId of selectedSeriesIds) {
        if (itemType === 'genre') {
          await kavitaAPI.addGenreToSeries(seriesId, item);
        } else {
          await kavitaAPI.addTagToSeries(seriesId, item);
        }
        done++;
        setProgress({ done, total: selectedSeriesIds.size });
      }
      setMode('done');
      setTimeout(() => { onAdded?.(); handleClose(); }, 1000);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setMode('add-select');
    } finally {
      setWorking(false);
    }
  }

  const MENU_W = Math.min(260, width - 32);
  const left = Math.min(position.x, width - MENU_W - 16);
  const top = Math.min(position.y, height - 220 - 60);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.menu, { width: MENU_W, top, left, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.cardShadow }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {itemType === 'genre' ? 'Genre' : 'Tag'}: {itemTitle}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Main Menu */}
        {mode === 'menu' && (
          <View>
            <TouchableOpacity style={styles.actionRow} onPress={() => setMode('add-select')} activeOpacity={0.75}>
              <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>Add to other series</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => setMode('confirm-remove')} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Remove from all series</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add to Series Selection */}
        {mode === 'add-select' && (
          <View style={styles.addSelectArea}>
            <Text style={[styles.confirmText, { color: colors.textPrimary, marginBottom: Spacing.sm }]}>
              Select series to add "{itemTitle}" to:
            </Text>
            <TextInput
              style={[styles.searchInput, { 
                backgroundColor: colors.background, 
                color: colors.textPrimary,
                borderColor: colors.border 
              }]}
              placeholder="Search series..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <ScrollView style={styles.seriesList} showsVerticalScrollIndicator={false}>
              {filteredSeries.map(series => {
                const isSelected = selectedSeriesIds.has(series.id);
                return (
                  <TouchableOpacity
                    key={series.id}
                    style={[styles.seriesItem, { 
                      backgroundColor: isSelected ? colors.accentSoft : 'transparent',
                      borderColor: isSelected ? colors.accent : colors.border 
                    }]}
                    onPress={() => toggleSeriesSelection(series.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons 
                      name={isSelected ? 'checkbox' : 'square-outline'} 
                      size={16} 
                      color={isSelected ? colors.accent : colors.textMuted} 
                    />
                    <Text 
                      numberOfLines={1} 
                      style={[styles.seriesName, { color: isSelected ? colors.accent : colors.textPrimary }]}
                    >
                      {series.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {filteredSeries.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No series found</Text>
              )}
            </ScrollView>
            <View style={[styles.confirmButtons, { marginTop: Spacing.md }]}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setMode('menu')}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, { 
                  backgroundColor: selectedSeriesIds.size > 0 ? colors.accent : colors.border,
                  opacity: selectedSeriesIds.size > 0 ? 1 : 0.5
                }]} 
                onPress={runAddToSeries}
                disabled={selectedSeriesIds.size === 0}
              >
                <Text style={styles.deleteBtnText}>Add ({selectedSeriesIds.size})</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Confirm Remove */}
        {mode === 'confirm-remove' && (
          <View style={styles.confirmArea}>
            <Text style={[styles.confirmText, { color: colors.textPrimary }]}>
              Remove "{itemTitle}" from every series that has it?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setMode('menu')}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.error }]} onPress={runRemove}>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Working State */}
        {mode === 'working' && (
          <View style={styles.progressArea}>
            <ActivityIndicator color={colors.accent} />
            {progress && progress.total > 0 && (
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {progress.done} / {progress.total} series…
              </Text>
            )}
            {progress && progress.total === 0 && (
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>Loading…</Text>
            )}
          </View>
        )}

        {/* Done State */}
        {mode === 'done' && (
          <View style={styles.progressArea}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>Done!</Text>
          </View>
        )}

        {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    flex: 1,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  closeBtn: { padding: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  addSelectArea: {
    padding: Spacing.md,
    maxHeight: 350,
  },
  searchInput: {
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sm,
    marginBottom: Spacing.sm,
  },
  seriesList: {
    maxHeight: 200,
  },
  seriesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  seriesName: {
    flex: 1,
    fontSize: Typography.sm,
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  actionText: {
    fontSize: Typography.sm,
    color: Colors.error,
    fontWeight: Typography.medium,
  },
  confirmArea: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  confirmText: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: Typography.sm,
    color: '#fff',
    fontWeight: Typography.bold,
  },
  progressArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  progressText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: Typography.xs,
    color: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    textAlign: 'center',
  },
});
