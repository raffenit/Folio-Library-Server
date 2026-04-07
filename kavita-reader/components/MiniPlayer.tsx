import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useRouter } from 'expo-router';
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
export const MINI_PLAYER_TOTAL_HEIGHT = MINI_PLAYER_HEIGHT + 3;

export function MiniPlayer() {
  const router = useRouter();
  const { colors } = useTheme();
  const { nowPlaying, isPlaying, sessionTime, togglePlayPause, skipBack, skipForward, stop } = useAudioPlayer();

  if (!nowPlaying) return null;
  const { item } = nowPlaying;
  const title = item.media.metadata.title;
  const author = item.media.metadata.authorName ?? '';
  const duration = nowPlaying.session.duration;
  const progress = duration > 0 ? Math.min(sessionTime / duration, 1) : 0;
  const coverUri = absAPI.getCoverUrl(item.id);

  return (
    <View style={{
      position: 'absolute', left: 0, right: 0,
      bottom: Platform.OS === 'ios' ? 78 : 68,
      backgroundColor: colors.surfaceElevated,
      borderTopWidth: 1, borderTopColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 12,
    }}>
      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: colors.progressTrack }}>
        <View style={{ height: 3, width: `${progress * 100}%` as any, backgroundColor: colors.accent }} />
      </View>

      <TouchableOpacity
        style={{ height: MINI_PLAYER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.md }}
        onPress={() => router.push(`/audiobook/${item.id}`)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: coverUri }} style={{ width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: colors.surface }} />

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
          {author ? <Text style={{ fontSize: Typography.xs, color: colors.textSecondary }} numberOfLines={1}>{author}</Text> : null}
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted }}>{formatTime(sessionTime)}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <TouchableOpacity onPress={() => skipBack(15)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="play-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.textOnAccent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => skipForward(30)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="play-forward" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={stop} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}
