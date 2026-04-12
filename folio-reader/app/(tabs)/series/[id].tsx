import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing, Radius, type ColorScheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// Hooks & Services
import { useLibraryItem } from '@/hooks/useLibraryItem';
import { kavitaAPI, pickBestFile, BookTocEntry } from '@/services/kavitaAPI';
import { LibraryVolume, LibraryChapter } from '@/services/LibraryProvider';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { absAPI, ABSLibraryItem } from '@/services/audiobookshelfAPI';
import { LibraryFactory } from '@/services/LibraryFactory';

// Modular Components
import { CoverPickerModal } from '@/components/modals/CoverPickerModal';
import { MetadataSearchModal } from '@/components/modals/MetadataSearchModal';
import { EditMetadataModal } from '@/components/modals/EditMetadataModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten all volumes into a sorted chapter list. */
export function flatChapters(volumes: LibraryVolume[]) {
  const result: { chapter: LibraryChapter; volume: LibraryVolume }[] = [];
  volumes.forEach((vol) => {
    vol.chapters?.forEach((ch) => {
      result.push({ chapter: ch, volume: vol });
    });
  });
  return result.sort((a, b) => Number(a.chapter.number) - Number(b.chapter.number));
}

/** Pick first unfinished chapter, or last one if all done. */
function pickResumeChapter(volumes: LibraryVolume[]): { chapter: LibraryChapter; volume: LibraryVolume } | null {
  const all = flatChapters(volumes);
  if (all.length === 0) return null;
  for (const item of all) {
    const pct = item.chapter.pages > 0 ? item.chapter.pagesRead / item.chapter.pages : 0;
    if (pct < 1) return item;
  }
  return all[all.length - 1] ?? null;
}

// ── Description renderer — HTML on web, plain text on native ──────────────────

function DescriptionText({ html, expanded, style }: { html: string; expanded: boolean; style: any }) {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          fontSize: style.fontSize ?? 15,
          lineHeight: typeof style.lineHeight === 'number' ? `${style.lineHeight}px` : '1.55',
          color: style.color,
          overflow: 'hidden',
          ...(expanded ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }),
        } as any}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  const plain = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return <Text style={style} numberOfLines={expanded ? undefined : 4}>{plain}</Text>;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function SeriesDetailScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id, type = 'kavita' } = useLocalSearchParams<{ id: string; type: 'kavita' | 'abs' }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;

  const { data: detail, loading, error, provider, refresh } = useLibraryItem(id, type);

  const [editVisible, setEditVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(false);
  const [metaSearchVisible, setMetaSearchVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [coverKey, setCoverKey] = useState(0);
  const [matchingAudiobook, setMatchingAudiobook] = useState<ABSLibraryItem | null>(null);
  const [searchingAudiobook, setSearchingAudiobook] = useState(false);
  const [tocEntries, setTocEntries] = useState<BookTocEntry[] | null>(null);
  const [tocLoading, setTocLoading] = useState(false);
  const { play } = useAudioPlayer();

  const chapters = useMemo(() => (detail?.volumes ? flatChapters(detail.volumes) : []), [detail]);

  // For single-chapter EPUBs, fetch TOC to show actual chapters
  // PDFs have actual page counts (100+), EPUBs typically have 0-1 pages per chapter
  useEffect(() => {
    if (type !== 'kavita' || chapters.length !== 1) {
      setTocEntries(null);
      return;
    }
    
    const chapter = chapters[0]?.chapter;
    const chapterId = chapter?.id;
    // Only fetch TOC for EPUB-style books (low page count)
    // PDFs have many pages and don't need TOC fetching
    if (!chapterId || tocLoading || (chapter?.pages || 0) > 10) return;
    
    setTocLoading(true);
    kavitaAPI.getBookToc(Number(chapterId))
      .then(toc => {
        if (toc && toc.length > 0) {
          setTocEntries(toc);
        } else {
          setTocEntries(null);
        }
      })
      .catch(() => setTocEntries(null))
      .finally(() => setTocLoading(false));
  }, [chapters, type]);
  const resume = useMemo(() => (detail?.volumes ? pickResumeChapter(detail.volumes) : null), [detail]);

  const overallProgress = useMemo(() => {
    if (!detail?.volumes) return 0;
    const totalPages = detail.volumes.reduce((s, v) => s + (v.pages || 0), 0);
    const pagesRead = detail.volumes.reduce((s, v) => s + (v.pagesRead || 0), 0);
    return totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
  }, [detail]);

  const coverUrl = useMemo(() => {
    if (!detail) return '';
    return provider.getCoverUrl(detail.id) + `?v=${coverKey}`;
  }, [detail, provider, coverKey]);

  const authors = detail?.authorName || '';
  const displayName = detail?.localizedName || detail?.name || '';

  // Search for matching audiobook when viewing an ebook
  useEffect(() => {
    if (type === 'kavita' && detail?.name) {
      setSearchingAudiobook(true);
      const absProvider = LibraryFactory.getProvider('abs');
      absProvider.search(detail.name).then(results => {
        // Look for exact or close match
        const match = results.find(r => 
          r.title.toLowerCase() === detail.name!.toLowerCase() ||
          r.title.toLowerCase().includes(detail.name!.toLowerCase())
        );
        if (match) {
          // Fetch full item details
          absAPI.getLibraryItem(match.id).then(item => {
            setMatchingAudiobook(item);
          }).catch(() => setMatchingAudiobook(null));
        } else {
          setMatchingAudiobook(null);
        }
        setSearchingAudiobook(false);
      }).catch(() => {
        setMatchingAudiobook(null);
        setSearchingAudiobook(false);
      });
    }
  }, [type, detail?.name, detail?.id]);

  const handlePlayAudiobook = async () => {
    if (!matchingAudiobook) return;
    try {
      await play(matchingAudiobook);
    } catch (e) {
      console.error('Failed to play audiobook:', e);
    }
  };

  function openChapter(chapter: LibraryChapter, volume: LibraryVolume) {
    const navParams = {
      chapterId: chapter.id,
      volumeId: volume.id,
      seriesId: id,
      title: displayName,
    };

    // Route to correct reader based on format: 4 = PDF
    const pathname = chapter.format === 4 ? '/reader/pdf' : '/reader/epub';
    router.push({ pathname, params: navParams });
  }

  function handleRead() {
    if (resume) {
      openChapter(resume.chapter, resume.volume);
    }
  }

  if (loading && !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Could not load series.'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>&larr; Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={isLargeScreen ? styles.heroRow : styles.heroSmall}>
          {/* Cover Section */}
          <View style={isLargeScreen ? styles.coverSidebarWrap : styles.coverSmallWrap}>
            <TouchableOpacity onPress={() => setCoverPickerVisible(true)} activeOpacity={0.85}>
              <Image 
                key={coverKey} 
                source={{ uri: coverUrl }} 
                style={isLargeScreen ? styles.coverSidebar : styles.coverSmall} 
                resizeMode="cover" 
              />
              <View style={styles.coverEditOverlay}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Metadata & Description Section */}
          <View style={[styles.metaBlock, isLargeScreen && styles.metaBlockLarge]}>
            <Text style={styles.seriesTitle}>{displayName}</Text>
            <Text style={styles.authorText}>{authors || 'No author'}</Text>

            {/* Primary Action Buttons - Moved to top of description column */}
            <View style={styles.readButtonContainer}>
              <TouchableOpacity style={styles.readButton} onPress={handleRead} activeOpacity={0.85}>
                <Ionicons name="book" size={20} color={colors.textOnAccent} style={{ marginRight: 8 }} />
                <Text style={styles.readButtonText}>
                  {overallProgress > 0 && overallProgress < 100 ? 'Continue Reading' : 'Read'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.editBtn} onPress={() => setMetaSearchVisible(true)} activeOpacity={0.85}>
                <Ionicons name="globe-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Audiobook Available Banner */}
            {matchingAudiobook && (
              <TouchableOpacity 
                style={[styles.audiobookBanner, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]} 
                onPress={handlePlayAudiobook}
                activeOpacity={0.85}
              >
                <View style={styles.audiobookBannerContent}>
                  <Ionicons name="play-circle" size={28} color={colors.accent} />
                  <View style={styles.audiobookBannerText}>
                    <Text style={[styles.audiobookBannerTitle, { color: colors.accent }]}>
                      Audiobook Available
                    </Text>
                    <Text style={[styles.audiobookBannerSubtitle, { color: colors.textSecondary }]}>
                      Click to play in mini player
                    </Text>
                  </View>
                  <Ionicons name="headset" size={20} color={colors.accent} />
                </View>
              </TouchableOpacity>
            )}

            {/* Genres & Tags */}
            {((detail.genres?.length || 0) > 0 || (detail.tags?.length || 0) > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {detail.genres?.map((g: any) => (
                  <View key={`g-${g.id}`} style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{g.title}</Text>
                  </View>
                ))}
                {detail.tags?.map((t: any) => (
                  <View key={`t-${t.id}`} style={[styles.metaChip, styles.metaChipTag]}>
                    <Text style={[styles.metaChipText, styles.metaChipTagText]}>{t.title}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Description */}
            <TouchableOpacity onPress={() => setSummaryExpanded(v => !v)} activeOpacity={0.8}>
              <DescriptionText 
                html={detail.summary || detail.description || ''} 
                expanded={summaryExpanded} 
                style={styles.summary} 
              />
              {(detail.summary || detail.description)?.length > 200 && (
                <Text style={styles.summaryToggle}>{summaryExpanded ? 'Show less' : 'Read more'}</Text>
              )}
            </TouchableOpacity>

            {/* Progress */}
            {overallProgress > 0 && (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${overallProgress}%` }]} />
                </View>
                <Text style={styles.progressPct}>{overallProgress}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chapters Section */}
        <View style={styles.chaptersSection}>
          <Text style={styles.chaptersHeader}>Chapters</Text>
          {tocLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : tocEntries && tocEntries.length > 0 ? (
            // Show TOC entries for single-chapter EPUBs
            tocEntries.map((entry, index) => (
              <TouchableOpacity
                key={`toc-${index}`}
                style={styles.chapterRow}
                onPress={() => {
                  // Open reader at specific TOC page
                  if (chapters.length === 1) {
                    const { chapter, volume } = chapters[0];
                    router.push({
                      pathname: '/reader/epub',
                      params: {
                        chapterId: chapter.id,
                        volumeId: volume.id,
                        seriesId: id,
                        title: displayName,
                        page: entry.page,
                      }
                    });
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={styles.chapterLeft}>
                  <Text style={styles.chapterNum}>{entry.title}</Text>
                  <View style={styles.chapterMeta}>
                    <Text style={styles.chapterPages}>Page {entry.page}</Text>
                  </View>
                </View>
                <View style={styles.chapterRight}>
                  <Ionicons name="play-circle-outline" size={20} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))
          ) : chapters.length === 0 ? (
            <Text style={styles.noChapters}>No chapters found.</Text>
          ) : (
            chapters.map(({ chapter, volume }) => {
              const chProgress = chapter.pages > 0 ? (chapter.pagesRead / chapter.pages) * 100 : 0;
              const chLabel = chapter.title || `Chapter ${chapter.number}`;
              
              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.chapterRow}
                  onPress={() => openChapter(chapter, volume)}
                  activeOpacity={0.75}
                >
                  <View style={styles.chapterLeft}>
                    <Text style={styles.chapterNum}>{chLabel}</Text>
                    <View style={styles.chapterMeta}>
                      <Text style={styles.chapterPages}>{chapter.pages} pages</Text>
                    </View>
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
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    ) : (
                      <Ionicons name="play-circle-outline" size={20} color={colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <EditMetadataModal
        visible={editVisible}
        seriesId={id}
        seriesName={displayName}
        providerType={type}
        onClose={() => setEditVisible(false)}
        onSaved={refresh}
      />
      <CoverPickerModal
        visible={coverPickerVisible}
        seriesId={id}
        seriesName={displayName}
        authorName={authors}
        providerType={type}
        onClose={() => setCoverPickerVisible(false)}
        onSaved={() => { setCoverKey(k => k + 1); refresh(); }}
      />
      <MetadataSearchModal
        visible={metaSearchVisible}
        seriesId={id}
        seriesName={displayName}
        providerType={type}
        onClose={() => setMetaSearchVisible(false)}
        onApplied={() => { setCoverKey(k => k + 1); refresh(); }}
      />
    </View>
  );
}

function makeStyles(c: ColorScheme) {
  return {
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, backgroundColor: c.background, justifyContent: 'center' as const, alignItems: 'center' as const, gap: Spacing.md },
    scroll: { paddingBottom: 60 },
    backButton: { position: 'absolute' as const, top: 44, left: Spacing.base, zIndex: 10, width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' as const, alignItems: 'center' as const },
    heroSmall: { alignItems: 'center' as const },
    heroRow: { flexDirection: 'row' as const, paddingTop: 60, paddingHorizontal: Spacing.xl, gap: Spacing.xl, alignItems: 'flex-start' as const },
    coverSidebarWrap: { width: 200, borderRadius: Radius.md, overflow: 'hidden' as const, flexShrink: 0, position: 'relative' as const },
    coverSidebar: { width: 200, height: 280, borderRadius: Radius.md },
    coverSmallWrap: { width: '100%', alignItems: 'center' as const, paddingTop: 52, paddingBottom: Spacing.lg, backgroundColor: c.surface, position: 'relative' as const },
    coverSmall: { width: 140, height: 200, borderRadius: Radius.md },
    coverEditOverlay: { position: 'absolute' as const, bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.full, width: 28, height: 28, justifyContent: 'center' as const, alignItems: 'center' as const },
    metaBlock: { padding: Spacing.base, paddingTop: Spacing.md, gap: Spacing.md },
    metaBlockLarge: { flex: 1, paddingTop: 0 },
    seriesTitle: { fontSize: Typography.xxl, fontWeight: Typography.bold as any, color: c.textPrimary, fontFamily: Typography.serif, lineHeight: 34 },
    authorText: { fontSize: Typography.md, color: c.accent, fontWeight: Typography.semibold as any, marginTop: -Spacing.xs },
    chipScroll: { flexGrow: 0 },
    metaChip: { backgroundColor: c.accentSoft, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginRight: Spacing.xs, borderWidth: 1, borderColor: c.accent + '44' },
    metaChipText: { fontSize: Typography.xs, color: c.accent, fontWeight: Typography.medium as any },
    metaChipTag: { backgroundColor: c.surfaceElevated, borderColor: c.border },
    metaChipTagText: { color: c.textSecondary },
    summary: { fontSize: Typography.base, color: c.textSecondary, lineHeight: 23 },
    summaryToggle: { fontSize: Typography.sm, color: c.accent, marginTop: 4 },
    progressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.sm },
    progressTrack: { flex: 1, height: 4, backgroundColor: c.progressTrack, borderRadius: Radius.full, overflow: 'hidden' as const },
    progressFill: { height: '100%' as any, backgroundColor: c.accent },
    progressPct: { fontSize: Typography.sm, color: c.textSecondary },
    readButtonContainer: { flexDirection: 'row' as const, gap: Spacing.sm, marginTop: Spacing.sm },
    readButton: { flex: 1, flexDirection: 'row' as const, backgroundColor: c.accent, borderRadius: Radius.md, paddingVertical: Spacing.base + 2, alignItems: 'center' as const, justifyContent: 'center' as const },
    readButtonText: { fontSize: Typography.md, fontWeight: Typography.bold as any, color: c.textOnAccent },
    editBtn: { width: 52, backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center' as const, justifyContent: 'center' as const },
    chaptersSection: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, gap: 2 },
    chaptersHeader: { fontSize: Typography.lg, fontWeight: Typography.bold as any, color: c.textPrimary, marginBottom: Spacing.md },
    noChapters: { fontSize: Typography.base, color: c.textMuted },
    chapterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
    chapterLeft: { flex: 1, gap: 3 },
    chapterNum: { fontSize: Typography.base, color: c.textPrimary, fontWeight: Typography.medium as any },
    chapterMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.sm },
    chapterPages: { fontSize: Typography.sm, color: c.textMuted },
    chapterRight: { alignItems: 'flex-end' as const, paddingLeft: Spacing.md },
    chapterProgressContainer: { alignItems: 'flex-end' as const, gap: 3 },
    chapterProgressTrack: { width: 60, height: 4, backgroundColor: c.progressTrack, borderRadius: Radius.full, overflow: 'hidden' as const },
    chapterProgressFill: { height: '100%' as any, backgroundColor: c.accent },
    chapterProgressText: { fontSize: 10, color: c.textSecondary },
    errorText: { fontSize: Typography.lg, color: c.textSecondary },
    backLink: { fontSize: Typography.base, color: c.accent, marginTop: Spacing.md },
    audiobookBanner: { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.base },
    audiobookBannerContent: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.md },
    audiobookBannerText: { flex: 1 },
    audiobookBannerTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold as any },
    audiobookBannerSubtitle: { fontSize: Typography.xs, marginTop: 2 },
  };
}
