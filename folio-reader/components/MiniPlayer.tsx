import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { absAPI } from '../services/audiobookshelfAPI';
import { Typography, Spacing, Radius } from '../constants/theme';

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const MINI_PLAYER_HEIGHT = 72;
const MINI_PLAYER_COMPACT_HEIGHT = 50;
export const MINI_PLAYER_TOTAL_HEIGHT = MINI_PLAYER_HEIGHT + 3;
export const MINI_PLAYER_COMPACT_TOTAL_HEIGHT = MINI_PLAYER_COMPACT_HEIGHT + 3;

export function MiniPlayer() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { nowPlaying, isPlaying, sessionTime, togglePlayPause, skipBack, skipForward, stop } = useAudioPlayer();

  if (!nowPlaying || pathname.includes('/audiobook/')) return null;

  const inReader = pathname.includes('/reader/');
  const { item } = nowPlaying;
  const title = item.media.metadata.title;
  const author = item.media.metadata.authorName ?? '';
  const duration = nowPlaying.session.duration;
  const progress = duration > 0 ? Math.min(sessionTime / duration, 1) : 0;
  const coverUri = absAPI.getCoverUrl(item.id);

  // In reader context: flush to screen bottom (no tab bar), compact height
  const bottomOffset = inReader ? 0 : (Platform.OS === 'ios' ? 78 : 68);
  const playerHeight = inReader ? MINI_PLAYER_COMPACT_HEIGHT : MINI_PLAYER_HEIGHT;

  return (
    <View style={{
      position: 'absolute', left: 0, right: 0,
      bottom: bottomOffset,
      backgroundColor: colors.surfaceElevated + 'E6',
      borderTopWidth: 1, borderTopColor: colors.border,
      shadowColor: colors.cardShadow, shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 12,
      backdropFilter: 'blur(10px)',
    }}>
      {/* Progress bar - thicker and more prominent */}
      <View style={{ height: 4, backgroundColor: colors.progressTrack }}>
        <View style={{ height: 4, width: `${progress * 100}%` as any, backgroundColor: colors.accent }} />
      </View>

      <TouchableOpacity
        style={{ height: playerHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.md }}
        onPress={() => router.push(`/audiobook/${item.id}`)}
        activeOpacity={0.85}
      >
        {/* Left side - Cover + Title (flex:1 to balance) */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          {/* Cover with circular progress ring */}
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: coverUri }}
              style={{ width: inReader ? 40 : 52, height: inReader ? 40 : 52, borderRadius: Radius.sm, backgroundColor: colors.surface }}
            />
            {/* Circular progress ring */}
            <View style={{
              position: 'absolute',
              top: -2, left: -2, right: -2, bottom: -2,
              borderRadius: Radius.sm + 2,
              borderWidth: 2,
              borderColor: colors.progressTrack,
            }} />
            <View style={{
              position: 'absolute',
              top: -2, left: -2, right: -2, bottom: -2,
              borderRadius: Radius.sm + 2,
              borderWidth: 2,
              borderColor: colors.accent,
              borderTopColor: colors.progressTrack,
              borderRightColor: colors.progressTrack,
              borderBottomColor: progress > 0.25 ? colors.accent : colors.progressTrack,
              borderLeftColor: progress > 0.5 ? colors.accent : colors.progressTrack,
              transform: [{ rotate: `${-90 + (progress * 360)}deg` }],
            }} />
          </View>
          <View style={{ flex: 1, gap: inReader ? 0 : 2 }}>
            <Text style={{ fontSize: inReader ? Typography.xs : Typography.sm, fontWeight: Typography.semibold, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
            {author ? <Text style={{ fontSize: inReader ? 10 : Typography.xs, color: colors.textSecondary }} numberOfLines={1}>{author}</Text> : null}
            {/* Emphasized timestamp with remaining time */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={{ fontSize: inReader ? 11 : Typography.sm, fontWeight: Typography.bold, color: colors.accent }}>
                {formatTime(sessionTime)}
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted }} />
              <Text style={{ fontSize: inReader ? 10 : Typography.xs, color: colors.textSecondary }}>
                -{formatTime(Math.max(0, duration - sessionTime))}
              </Text>
            </View>
          </View>
        </View>

        {/* Center - Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: inReader ? Spacing.xs : Spacing.sm }}>
          <TouchableOpacity onPress={() => skipBack(15)} hitSlop={8} style={{ padding: inReader ? 2 : 4 }}>
            <Ionicons name="play-back" size={inReader ? 18 : 22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} hitSlop={8} style={{ width: inReader ? 32 : 40, height: inReader ? 32 : 40, borderRadius: inReader ? 16 : 20, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={inReader ? 20 : 26} color={colors.textOnAccent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => skipForward(30)} hitSlop={8} style={{ padding: inReader ? 2 : 4 }}>
            <Ionicons name="play-forward" size={inReader ? 18 : 22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Right side - Spacer + X (flex:1 to balance left side) */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={stop} hitSlop={8} style={{ padding: inReader ? 2 : 4 }}>
            <Ionicons name="close" size={inReader ? 18 : 22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}
