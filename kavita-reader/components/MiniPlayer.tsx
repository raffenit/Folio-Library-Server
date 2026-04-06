import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from '../contexts/AudioPlayerContext'; 
import { useRouter } from 'expo-router';
import { absAPI } from '../services/audiobookshelfAPI';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function MiniPlayer() {
  const router = useRouter();
  
  // 2. This will now have nowPlaying, sessionTime, etc.
  const { 
    nowPlaying, 
    isPlaying, 
    sessionTime, 
    togglePlayPause, 
    skipBack, 
    skipForward, 
    stop 
  } = useAudioPlayer();

  if (!nowPlaying) return null;
  const { item } = nowPlaying;
  const title = item.media.metadata.title;
  const author = item.media.metadata.authorName ?? '';
  const duration = nowPlaying.session.duration;
  const progress = duration > 0 ? Math.min(sessionTime / duration, 1) : 0;
  const coverUri = absAPI.getCoverUrl(item.id);

  function openFullPlayer() {
    router.push(`/audiobook/${item.id}`);
  }

  return (
    <View style={styles.wrapper}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <TouchableOpacity style={styles.container} onPress={openFullPlayer} activeOpacity={0.85}>
        {/* Cover */}
        <Image source={{ uri: coverUri }} style={styles.cover} />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {author ? <Text style={styles.author} numberOfLines={1}>{author}</Text> : null}
          <Text style={styles.time}>{formatTime(sessionTime)}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => skipBack(15)} hitSlop={8} style={styles.controlBtn}>
            <Ionicons name="play-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} hitSlop={8} style={styles.playBtn}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={26}
              color={Colors.textOnAccent}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => skipForward(30)} hitSlop={8} style={styles.controlBtn}>
            <Ionicons name="play-forward" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={stop} hitSlop={8} style={styles.controlBtn}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const MINI_PLAYER_HEIGHT = 72;
export const MINI_PLAYER_TOTAL_HEIGHT = MINI_PLAYER_HEIGHT + 3; // 3px progress bar

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Sits just above the tab bar (58px) on tabs screens; on reader modals it shows at bottom
    bottom: Platform.OS === 'ios' ? 78 : 68,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.progressTrack,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.accent,
  },
  container: {
    height: MINI_PLAYER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  author: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  time: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
