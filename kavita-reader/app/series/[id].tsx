import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI, SeriesDetail, Volume, Chapter } from '../../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = width * 0.55;

function formatProgress(pagesRead: number, pages: number) {
  if (pages === 0) return '';
  const pct = Math.round((pagesRead / pages) * 100);
  return `${pct}%`;
}

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    kavitaAPI.getSeriesDetail(Number(id)).then(setDetail).finally(() => setLoading(false));
  }, [id]);

  function openChapter(chapter: Chapter, volume: Volume) {
    // Determine format from chapter files
    const file = chapter.files?.[0];
    const format = file?.format ?? 0;

    // Format: 3 = EPUB, 4 = PDF, others = image-based
    if (format === 4) {
      router.push({
        pathname: '/reader/pdf',
        params: {
          chapterId: chapter.id,
          title: detail?.name || '',
          volumeId: volume.id,
          seriesId: id,
        },
      });
    } else if (format === 3) {
      router.push({
        pathname: '/reader/epub',
        params: {
          chapterId: chapter.id,
          title: detail?.name || '',
          volumeId: volume.id,
          seriesId: id,
        },
      });
    } else {
      // Default to PDF reader for other types (image series, CBZ, etc.)
      router.push({
        pathname: '/reader/pdf',
        params: {
          chapterId: chapter.id,
          title: detail?.name || '',
          volumeId: volume.id,
          seriesId: id,
        },
      });
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load series.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = kavitaAPI.getSeriesCoverUrl(detail.id);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero cover */}
        <View style={styles.hero}>
          <Image source={{ uri: coverUrl }} style={styles.heroCover} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Meta */}
        <View style={styles.meta}>
          <Text style={styles.seriesTitle}>{detail.name}</Text>
          {detail.summary ? (
            <Text style={styles.summary} numberOfLines={4}>
              {detail.summary}
            </Text>
          ) : null}
        </View>

        {/* Volumes & Chapters */}
        <View style={styles.volumes}>
          {detail.volumes?.map((volume) => (
            <View key={volume.id} style={styles.volumeGroup}>
              <View style={styles.volumeHeader}>
                <Text style={styles.volumeTitle}>
                  {volume.number === 0 ? 'Chapters' : `Volume ${volume.number}`}
                </Text>
                {volume.pages > 0 && (
                  <Text style={styles.volumeProgress}>
                    {formatProgress(volume.pagesRead, volume.pages)}
                  </Text>
                )}
              </View>

              {volume.chapters?.map((chapter) => {
                const chProgress = chapter.pages > 0
                  ? (chapter.pagesRead / chapter.pages) * 100 : 0;
                return (
                  <TouchableOpacity
                    key={chapter.id}
                    style={styles.chapterRow}
                    onPress={() => openChapter(chapter, volume)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.chapterLeft}>
                      <Text style={styles.chapterNum}>
                        {chapter.isSpecial
                          ? chapter.title || 'Special'
                          : chapter.number !== '0'
                          ? `Chapter ${chapter.number}`
                          : chapter.title || 'Read'}
                      </Text>
                      <Text style={styles.chapterPages}>{chapter.pages} pages</Text>
                    </View>
                    <View style={styles.chapterRight}>
                      {chProgress > 0 && chProgress < 100 ? (
                        <View style={styles.chapterProgressContainer}>
                          <View style={styles.chapterProgressTrack}>
                            <View style={[styles.chapterProgressFill, { width: `${chProgress}%` }]} />
                          </View>
                          <Text style={styles.chapterProgressText}>{Math.round(chProgress)}%</Text>
                        </View>
                      ) : chProgress >= 100 ? (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                      ) : (
                        <Ionicons name="play-circle-outline" size={20} color={Colors.textMuted} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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
    gap: Spacing.md,
  },
  scroll: {
    paddingBottom: 60,
  },
  hero: {
    height: COVER_HEIGHT,
    position: 'relative',
  },
  heroCover: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'transparent',
  },
  backButton: {
    position: 'absolute',
    top: 52,
    left: Spacing.base,
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    padding: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  seriesTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
    lineHeight: 34,
  },
  summary: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  volumes: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.xl,
  },
  volumeGroup: {
    gap: 2,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  volumeTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  volumeProgress: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chapterLeft: {
    flex: 1,
    gap: 3,
  },
  chapterNum: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  chapterPages: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  chapterRight: {
    alignItems: 'flex-end',
    paddingLeft: Spacing.md,
  },
  chapterProgressContainer: {
    alignItems: 'flex-end',
    gap: 3,
  },
  chapterProgressTrack: {
    width: 60,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  chapterProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },
  chapterProgressText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
  },
  backLink: {
    fontSize: Typography.base,
    color: Colors.accent,
  },
});
