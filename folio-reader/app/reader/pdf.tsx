import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import PdfRenderer from '../../components/PdfRenderer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI, ChapterInfo } from '../../services/kavitaAPI';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography, Spacing, Radius, ColorScheme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PDFReaderScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;
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

  // For native, kavitaAPI.getPdfReaderUrl returns the raw PDF endpoint
  const pdfReaderUrl = kavitaAPI.getPdfReaderUrl(chapterId);
  const router = useRouter();

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

      {/* Page area */}
      <View style={styles.pageArea}>
        <PdfRenderer
          uri={pdfReaderUrl}
          onLoadComplete={(numberOfPages: number) => {
            setTotalPages(numberOfPages);
            setPageLoading(false);
          }}
          onPageChanged={(page: number) => {
            setCurrentPage(page - 1);
          }}
          onError={(err: any) => {
            console.log(err);
            setPageLoading(false);
            setError('Failed to load PDF');
          }}
          style={styles.pageImage}
        />
        {pageLoading && Platform.OS !== 'web' && (
          <View style={styles.pageLoadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? Spacing.sm : 44,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: colors.textPrimary,
  },
  pageArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
    opacity: 0.8,
  },
  loadingText: { fontSize: Typography.base, color: colors.textSecondary },
  errorText: {
    fontSize: Typography.base,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 22,
  },
  goBack: { marginTop: Spacing.sm },
  goBackText: { color: colors.accent, fontSize: Typography.base },
});
