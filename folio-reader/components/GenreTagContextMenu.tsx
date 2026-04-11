/**
 * GenreTagContextMenu
 * Floating modal triggered by right-click (web) or long-press on a genre/tag chip.
 * Lets the user remove a genre or tag from all series that have it.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { kavitaAPI } from '../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

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
}

export default function GenreTagContextMenu({
  visible, itemId, itemTitle, itemType, position, onClose, onRemoved,
}: Props) {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function handleClose() {
    setConfirming(false);
    setWorking(false);
    setProgress(null);
    setError('');
    setDone(false);
    onClose();
  }

  async function runRemove() {
    if (itemId == null || !itemType) return;
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
      setDone(true);
      setTimeout(() => { onRemoved(); handleClose(); }, 1000);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
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

        {!confirming && !working && !done && (
          <TouchableOpacity style={styles.actionRow} onPress={() => setConfirming(true)} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Remove from all series</Text>
          </TouchableOpacity>
        )}

        {confirming && !working && (
          <View style={styles.confirmArea}>
            <Text style={[styles.confirmText, { color: colors.textPrimary }]}>
              Remove "{itemTitle}" from every series that has it?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setConfirming(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.error }]} onPress={runRemove}>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {working && (
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

        {done && (
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
