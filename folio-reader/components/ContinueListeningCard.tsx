import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryFactory } from '../services/LibraryFactory';
import { LibraryItem } from '../services/LibraryProvider';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';

interface ContinueListeningCardProps {
  item: LibraryItem;
  onPress: () => void;
  onPlay: () => void;
  isPlaying: boolean;
}

export function ContinueListeningCard({ item, onPress, onPlay, isPlaying }: ContinueListeningCardProps) {
  const { colors } = useTheme();
  const progressPct = item.progress ? Math.round(item.progress * 100) : 0;
  const provider = LibraryFactory.getProvider('abs');
  const coverUri = (provider as any).getCoverUrl?.(item.id) || '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{ width: 130, marginRight: Spacing.sm }}
    >
      <View style={{ borderRadius: Radius.md, overflow: 'hidden', backgroundColor: colors.surface }}>
        <View style={{ width: 130, aspectRatio: 1 }}>
          <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {/* Gradient overlay at bottom */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: Platform.OS === 'web' 
              ? `linear-gradient(to top, ${colors.overlay}90 0%, ${colors.overlay}40 60%, transparent 100%)`
              : undefined,
            backgroundColor: Platform.OS !== 'web' ? colors.overlay : undefined,
          } as any} />
          {/* progress bar */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.overlay }}>
            <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
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
      </View>
      <View style={{ marginTop: Spacing.xs }}>
        <Text numberOfLines={2} style={{ fontSize: Typography.xs, color: colors.textPrimary, lineHeight: 15, fontWeight: Typography.medium }}>
          {item.title}
        </Text>
        {item.author ? (
          <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
            {item.author}
          </Text>
        ) : null}
        <Text style={{ fontSize: 10, color: colors.accent, marginTop: 2 }}>
          {progressPct}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}
