import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { LibraryItem } from '../services/LibraryProvider';
import { LibraryFactory } from '../services/LibraryFactory';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const GAP = Spacing.sm;
const SIDE_MARGIN = Spacing.base;

export function useGridColumns() {
  const { width } = useWindowDimensions();
  const numColumns =
    width >= 1600 ? 8 :
    width >= 1280 ? 7 :
    width >= 960  ? 6 :
    width >= 700  ? 5 :
    width >= 500  ? 4 : 3;
  const cardWidth = (width - SIDE_MARGIN * 2 - GAP * (numColumns - 1)) / numColumns;
  return { numColumns, cardWidth };
}

interface Props {
  series: LibraryItem;
  onPress: () => void;
  onContextMenu?: (seriesId: number | string, seriesName: string, x: number, y: number) => void;
  style?: any;
  cardWidth?: number;
}

function getFormatIcon(format: number): string {
  switch (format) {
    case 3: return 'EPUB';
    case 4: return 'PDF';
    case 1: return 'CBZ';
    default: return 'IMG';
  }
}

export function SeriesCard({ series, onPress, onContextMenu, style, cardWidth }: Props) {
  const { colors } = useTheme();
  const progress = (series.progress || 0) * 100;
  
  const provider = LibraryFactory.getProvider(series.provider || 'kavita');
  const coverUrl = provider.getCoverUrl(series.id);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = containerRef.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(series.id, series.title, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu, series.id, series.title]);

  function handleLongPress(e: GestureResponderEvent) {
    if (onContextMenu) {
      onContextMenu(series.id, series.title, e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
  }

  return (
    <TouchableOpacity
      ref={containerRef}
      style={[cardWidth ? { width: cardWidth } : styles.cardFallback, style, Platform.OS === 'web' && (styles as any).webHover]}
      onPress={onPress}
      onLongPress={onContextMenu ? handleLongPress : undefined}
      delayLongPress={400}
      activeOpacity={0.8}
      {...(Platform.OS === 'web' ? { className: 'series-card-hover' } : {})}
    >
      <View style={[styles.coverContainer, { backgroundColor: Platform.OS === 'web' ? 'rgba(12, 14, 28, 0.4)' : colors.surface, backdropFilter: Platform.OS === 'web' ? 'blur(8px)' : undefined } as any]}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
        <View style={styles.formatBadge}>
          <Text style={[styles.formatText, { color: colors.accent }]}>{(series as any).format ? getFormatIcon((series as any).format) : (series.mediaType === 'audiobook' ? 'AUDIO' : 'BOOK')}</Text>
        </View>
        {progress > 0 && progress < 100 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
          </View>
        )}
        {progress >= 100 && (
          <View style={[styles.completedBadge, { backgroundColor: colors.success }]}>
            <Text style={[styles.completedText, { color: '#fff' }]}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{series.title}</Text>
    </TouchableOpacity>
  );
}

export function SeriesCardLarge({ series, onPress, onContextMenu }: Props) {
  const { colors } = useTheme();
  const progress = (series.progress || 0) * 100;
  const isAbs = series.provider === 'abs' || series.mediaType === 'audiobook';
  const realId = series.id;
  
  const provider = LibraryFactory.getProvider(series.provider || 'kavita');
  const coverUrl = provider.getCoverUrl(realId);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = containerRef.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(realId, series.title, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu, realId, series.title]);

  function handleLongPress(e: GestureResponderEvent) {
    if (onContextMenu) {
      onContextMenu(realId, series.title, e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
  }

  return (
    <TouchableOpacity
      ref={containerRef}
      style={[styles.cardLarge, { backgroundColor: colors.surface, borderColor: isAbs ? colors.accent + '40' : colors.border, borderWidth: 1 }]}
      onPress={onPress}
      onLongPress={onContextMenu ? handleLongPress : undefined}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      <View style={{ position: 'relative' }}>
        <Image source={{ uri: coverUrl }} style={styles.coverLarge} resizeMode="cover" />
        {isAbs && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.accent, paddingVertical: 2, alignItems: 'center' }}>
            <Ionicons name="headset" size={10} color={colors.textOnAccent} />
          </View>
        )}
      </View>
      <View style={styles.infoLarge}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {isAbs ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.accent + '20', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Ionicons name="headset" size={10} color={colors.accent} />
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 }}>AUDIOBOOK</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="book-outline" size={10} color={colors.textMuted} />
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 }}>EBOOK</Text>
            </View>
          )}
          {(series as any).libraryName && (
            <Text style={[styles.library, { color: colors.textMuted, fontSize: Typography.xs }]} numberOfLines={1}>{(series as any).libraryName}</Text>
          )}
        </View>
        <Text style={[styles.titleLarge, { color: colors.textPrimary }]} numberOfLines={2}>{series.title}</Text>
        {progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
              <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: colors.accent }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{Math.round(progress)}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardFallback: { flex: 1 },
  coverContainer: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    aspectRatio: 0.67,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xs,
  },
  cover: { width: '100%', height: '100%' },
  formatBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  formatText: {
    fontSize: 9, fontWeight: Typography.bold,
    color: Colors.accent, letterSpacing: 0.5,
  },
  progressBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  completedBadge: {
    position: 'absolute', top: 5, right: 5,
    width: 20, height: 20,
    borderRadius: Radius.full,
    backgroundColor: Colors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  completedText: { fontSize: 10, color: '#fff', fontWeight: Typography.bold },
  title: { fontSize: Typography.xs, color: Colors.textPrimary, lineHeight: 16 },
  // Large card
  cardLarge: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  coverLarge: { width: 70, height: 100 },
  infoLarge: {
    flex: 1, padding: Spacing.md,
    justifyContent: 'center', gap: 4,
  },
  titleLarge: {
    fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  library: { fontSize: Typography.sm, color: Colors.accent },
  progressContainer: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginTop: 4,
  },
  progressTrack: {
    flex: 1, height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressText: { fontSize: Typography.xs, color: Colors.textSecondary },
  // Web hover effect - applied via className
  webHover: {} as any,
});
