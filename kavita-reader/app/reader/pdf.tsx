import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI, ChapterInfo } from '../../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PDFReaderScreen() {
  const params = useLocalSearchParams<{ chapterId: string; title: string }>();
  const chapterId = Number(params.chapterId);

  // 1. Create a state to hold the "suitcase" (ChapterInfo)
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Loading state definition
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const info = await kavitaAPI.getChapterInfo(chapterId);
        setChapterInfo(info);
        setTotalPages(info?.pages ?? 0);
        const savedPage = await kavitaAPI.getReadingProgress(chapterId);
        if (savedPage > 0) setCurrentPage(savedPage);
      } catch (e) {
        console.error('Failed to load chapter info', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

  function goToPage(page: number) {
    setCurrentPage(page);
    if (chapterInfo) {
      kavitaAPI.saveReadingProgress(chapterInfo, page);
    }
  }

  // pageUrl uses the /image endpoint we validated earlier
  const pageUrl = kavitaAPI.getPdfPageImageUrl(chapterId, currentPage);
  const router = useRouter();

  const canPrev = currentPage > 0 && !pageLoading;
  const canNext = currentPage < totalPages - 1 && !pageLoading;
  const progressPct = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading PDF…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBack}>
          <Text style={styles.goBackText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{params.title || 'PDF Reader'}</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Page image */}
      <View style={styles.pageArea}>
        <Image
          key={currentPage}
          source={{ uri: pageUrl }}
          style={styles.pageImage}
          resizeMode="contain"
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => setPageLoading(false)}
          onError={() => {
            setPageLoading(false);
            setError(`Failed to load page ${currentPage + 1}`);
          }}
        />
        {pageLoading && (
          <View style={styles.pageLoadingOverlay}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        )}
      </View>

      {/* Footer nav */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
          onPress={() => goToPage(currentPage - 1)}
          disabled={!canPrev}
        >
          <Ionicons name="chevron-back" size={24} color={canPrev ? Colors.textPrimary : Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.progressInfo}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : '…'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
          onPress={() => goToPage(currentPage + 1)}
          disabled={!canNext}
        >
          <Ionicons name="chevron-forward" size={24} color={canNext ? Colors.textPrimary : Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(13,13,18,0.92)',
    zIndex: 10,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  pageArea: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  pageImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pageLoadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.6)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(13,13,18,0.92)',
    gap: Spacing.sm,
  },
  navBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  navBtnDisabled: { opacity: 0.4 },
  progressInfo: { flex: 1, alignItems: 'center', gap: 4 },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.progressTrack,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  progressText: { fontSize: Typography.xs, color: Colors.textSecondary },
  loadingText: { fontSize: Typography.base, color: Colors.textSecondary },
  errorText: {
    fontSize: Typography.base,
    color: Colors.error,
    textAlign: 'center',
    lineHeight: 22,
  },
  goBack: { marginTop: Spacing.sm },
  goBackText: { color: Colors.accent, fontSize: Typography.base },
});
