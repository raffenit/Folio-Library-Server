import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { absAPI, ABSLibraryItem } from '../../services/audiobookshelfAPI';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Tap-to-seek bar (no extra deps) ───────────────────────────────────────────
function SeekBar({ current, duration, onSeek }: {
  current: number; duration: number; onSeek: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function handlePress(e: any) {
    if (!width || !duration) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(x / width, 1));
    onSeek(ratio * duration);
  }

  return (
    <View style={styles.seekerBlock}>
      <TouchableOpacity
        onLayout={handleLayout}
        onPress={handlePress}
        activeOpacity={1}
        style={styles.seekTrack}
      >
        <View style={[styles.seekFill, { width: `${progress * 100}%` as any }]} />
        <View style={[styles.seekThumb, { left: `${progress * 100}%` as any }]} />
      </TouchableOpacity>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(current)}</Text>
        <Text style={styles.timeText}>-{formatTime(Math.max(0, duration - current))}</Text>
      </View>
    </View>
  );
}

export default function AudiobookPlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    nowPlaying, isPlaying, sessionTime, togglePlayPause,
    skipBack, skipForward, seekSession, play,
  } = useAudioPlayer();

  const [item, setItem] = useState<ABSLibraryItem | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentItem = nowPlaying?.item.id === id;
  const duration = isCurrentItem ? nowPlaying!.session.duration : (item?.media.duration ?? 0);
  const displayTime = sessionTime;

  useEffect(() => {
    loadItem();
  }, [id]);

  async function loadItem() {
    try {
      const data = await absAPI.getLibraryItem(id);
      setItem(data);
      // Auto-start if not already playing this item
      if (!isCurrentItem) {
        await play(data);
      }
    } catch (e) {
      console.error('Failed to load audiobook item', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const displayItem = isCurrentItem ? nowPlaying!.item : item;
  if (!displayItem) return null;

  const meta = displayItem.media.metadata;
  const coverUri = absAPI.getCoverUrl(displayItem.id);

  return (
    <>
      <View style={styles.container}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Cover */}
          <Image source={{ uri: coverUri }} style={styles.cover} />

          {/* Title + Author */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{meta.title}</Text>
            {meta.authorName ? <Text style={styles.author}>{meta.authorName}</Text> : null}
            {meta.narrator ? <Text style={styles.narrator}>Narrated by {meta.narrator}</Text> : null}
          </View>

          {/* Seeker */}
          <SeekBar
            current={displayTime}
            duration={duration}
            onSeek={async (v) => { await seekSession(v); }}
          />

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={() => skipBack(15)} style={styles.controlBtn}>
              <Ionicons name="play-back" size={28} color={Colors.textPrimary} />
              <Text style={styles.skipLabel}>15</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
              <Ionicons
                name={isPlaying && isCurrentItem ? 'pause' : 'play'}
                size={36}
                color={Colors.textOnAccent}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => skipForward(30)} style={styles.controlBtn}>
              <Ionicons name="play-forward" size={28} color={Colors.textPrimary} />
              <Text style={styles.skipLabel}>30</Text>
            </TouchableOpacity>
          </View>

          {/* Chapter list */}
          {isCurrentItem && nowPlaying!.tracks.length > 1 && (
            <View style={styles.chaptersBlock}>
              <Text style={styles.chaptersHeading}>Chapters</Text>
              {nowPlaying!.tracks.map((track, i) => (
                <TouchableOpacity
                  key={track.index}
                  style={[
                    styles.chapterRow,
                    i === nowPlaying!.trackIndex && styles.chapterRowActive,
                  ]}
                  onPress={() => seekSession(track.startOffset)}
                >
                  <Text style={[
                    styles.chapterTitle,
                    i === nowPlaying!.trackIndex && styles.chapterTitleActive,
                  ]} numberOfLines={1}>
                    {track.title || `Chapter ${i + 1}`}
                  </Text>
                  <Text style={styles.chapterDuration}>{formatTime(track.duration)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Description */}
          {meta.description ? (
            <View style={styles.descBlock}>
              <Text style={styles.descHeading}>About</Text>
              <Text style={styles.desc}>{meta.description}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: Spacing.base,
    zIndex: 10,
    padding: 4,
  },
  scroll: {
    paddingTop: 100,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 60,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  cover: {
    width: 260,
    height: 260,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  titleBlock: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
  author: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  narrator: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  seekerBlock: {
    width: '100%',
    gap: Spacing.md,
  },
  seekTrack: {
    width: '100%',
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: Colors.progressTrack,
    borderRadius: 3,
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    top: '50%',
    marginTop: -7,
    marginLeft: -7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 2,
  },
  skipLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  chaptersBlock: {
    width: '100%',
    gap: Spacing.sm,
  },
  chaptersHeading: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chapterRowActive: {
    // highlight active chapter
  },
  chapterTitle: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginRight: Spacing.md,
  },
  chapterTitleActive: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  chapterDuration: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  descBlock: {
    width: '100%',
    gap: Spacing.sm,
  },
  descHeading: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  desc: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
