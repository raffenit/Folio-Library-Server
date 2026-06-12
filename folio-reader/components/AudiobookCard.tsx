import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryFactory } from '../services/LibraryFactory';
import { LibraryItem } from '../services/LibraryProvider';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';
import { StyleSheet } from 'react-native';

interface AudiobookCardProps {
  item: LibraryItem;
  onPress: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  cardWidth: number;
  onContextMenu?: (itemId: string, itemTitle: string, x: number, y: number) => void;
}

export function AudiobookCard({ item, onPress, onPlay, isPlaying, cardWidth, onContextMenu }: AudiobookCardProps) {
  const { colors } = useTheme();
  const progressPct = item.progress ? Math.round(item.progress * 100) : 0;
  const provider = LibraryFactory.getProvider('abs');
  const coverUri = (provider as any).getCoverUrl?.(item.id) || '';
  const cardRef = React.useRef<View>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = cardRef.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(item.id, item.title, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu, item.id, item.title]);

  function handleLongPress(e: GestureResponderEvent) {
    if (onContextMenu) {
      onContextMenu(item.id, item.title, e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
  }

  return (
    <TouchableOpacity 
      ref={cardRef}
      style={{
        width: cardWidth,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }} 
      onPress={onPress} 
      onLongPress={onContextMenu ? handleLongPress : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
      {...(Platform.OS === 'web' ? { className: 'audiobook-card-hover' } : {})}
    >
      <View style={{ aspectRatio: 1, width: '100%', overflow: 'hidden' }}>
        <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {/* Hover title overlay - web only */}
        {Platform.OS === 'web' && (
          <View style={styles.hoverOverlay} pointerEvents="none">
            <View style={styles.titlePopup}>
              <Text style={[styles.titlePopupText, { color: colors.textOnAccent }]} numberOfLines={2}>{item.title}</Text>
            </View>
          </View>
        )}
        {/* progress bar */}
        {progressPct > 0 && progressPct < 100 && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.overlay }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        )}
        {/* play button overlay */}
        <TouchableOpacity 
          onPress={onPlay} 
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={colors.accent}
          />
        </TouchableOpacity>
      </View>
      <View style={{ padding: Spacing.sm }}>
        <Text numberOfLines={2} style={{ fontSize: Typography.xs, color: colors.textPrimary, lineHeight: 15, fontWeight: Typography.medium }}>
          {item.title}
        </Text>
        {item.author ? (
          <Text numberOfLines={1} style={{ fontSize: Typography.xs, color: colors.textSecondary, marginTop: 2 }}>
            {item.author}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    transition: 'opacity 0.2s ease',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  } as any,
  titlePopup: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: '100%',
  },
  titlePopupText: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    lineHeight: 15,
  },
});
