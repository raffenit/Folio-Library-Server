import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, LayoutChangeEvent,
  Modal, TextInput, Alert, Platform, useWindowDimensions,
  DeviceEventEmitter
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { absAPI, ABSAudioTrack } from '@/services/audiobookshelfAPI';
import { LibraryFactory } from '@/services/LibraryFactory';
import { LibrarySeriesDetail } from '@/services/LibraryProvider';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { EditMetadataModal } from '@/components/modals/EditMetadataModal';
import { CoverPickerModal } from '@/components/modals/CoverPickerModal';
import { MetadataSearchModal } from '@/components/modals/MetadataSearchModal';
import { startReadingSession, endReadingSession } from '@/services/stats';

import Slider from '@react-native-community/slider';

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function SeekBar({ current, duration, onSeek, tracks }: {
  current: number; duration: number; onSeek: (seconds: number) => void;
  tracks?: ABSAudioTrack[];
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(0);

  const displayTime = isSliding ? slidingValue : current;

  // The slider thumb is ~14px wide; track runs from thumbRadius to (width - thumbRadius)
  const THUMB_INSET = 7;
  const trackSpan = Math.max(0, sliderWidth - THUMB_INSET * 2);

  // File boundary markers — skip index 0 (startOffset = 0, i.e. the beginning)
  const markers = (tracks && duration > 0 && trackSpan > 0)
    ? tracks.filter(t => t.startOffset > 0).map(t => ({
        x: THUMB_INSET + (t.startOffset / duration) * trackSpan,
        title: t.title,
        startOffset: t.startOffset,
      }))
    : [];

  return (
    <View style={styles.seekerBlock}>
      <View
        onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}
        style={{ position: 'relative' }}
      >
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={current}
          onValueChange={(value) => {
            setIsSliding(true);
            setSlidingValue(value);
          }}
          onSlidingComplete={(value) => {
            setIsSliding(false);
            if (Number.isFinite(value)) {
              onSeek(value);
            }
          }}
          minimumTrackTintColor={colors.textPrimary}
          maximumTrackTintColor={colors.borderLight}
          thumbTintColor={colors.textPrimary}
        />
        {/* File boundary markers */}
        {markers.map((marker) => (
          <View
            key={marker.startOffset}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: marker.x - 1,
              top: 15,
              width: 2,
              height: 10,
              backgroundColor: colors.accent,
              opacity: 0.55,
              borderRadius: 1,
            }}
          />
        ))}
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(displayTime)}</Text>
        <Text style={styles.timeText}>
          -{formatTime(Math.max(0, duration - displayTime))}
        </Text>
      </View>
    </View>
  );
}

export default function AudiobookPlayerScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 500;
  const styles = makeStyles(colors, isWide);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    nowPlaying, isPlaying, sessionTime, togglePlayPause,
    skipBack, skipForward, seekSession, play, playbackRate, setRate,
  } = useAudioPlayer();

  const [item, setItem] = useState<LibrarySeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(false);
  const [coverKey, setCoverKey] = useState(0);
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const [kavitaMatch, setKavitaMatch] = useState<{ id: number; name: string } | null | undefined>(undefined);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorDraft, setAuthorDraft] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [metaSearchVisible, setMetaSearchVisible] = useState(false);
  // Optimistic overrides — applied locally after save so 404 on re-fetch doesn't block the UI
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [authorOverride, setAuthorOverride] = useState<string | null>(null);
  
  const provider = LibraryFactory.getProvider('abs');

  const isCurrentItem = nowPlaying?.item.id === id;
  const duration = isCurrentItem ? nowPlaying!.session.duration : (item?.totalDuration ?? 0);
  const displayTime = sessionTime;

  useEffect(() => {
    setTitleOverride(null);
    setAuthorOverride(null);
    if (isCurrentItem) {
      setItem(nowPlaying!.item);
      setLoading(false);
    } else {
      loadItem();
    }
  }, [id, isCurrentItem]);

  // Search Kavita for a matching ebook series once the title is known
  useEffect(() => {
    const title = item?.name;
    const kavita = LibraryFactory.getProvider('kavita');
    if (!title) { setKavitaMatch(null); return; }
    
    setKavitaMatch(undefined); // searching
    kavita.search(title).then((results) => {
      const match = results.find((s) => {
        const t = s.title.toLowerCase();
        const q = title.toLowerCase();
        return t.includes(q.split(':')[0].toLowerCase()) || q.includes(t.split(':')[0].toLowerCase());
      });
      setKavitaMatch(match ? { id: Number(match.id), name: match.title } : null);
    }).catch(() => setKavitaMatch(null));
  }, [item?.name]);

  // Refresh when playback is stopped (to sync final progress/metadata)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('FOLIO_PLAYBACK_STOPPED', (data) => {
      if (data.itemId === id) {
        console.log('[AudiobookPlayer] Stop detected, auto-refreshing item:', id);
        refreshItem();
      }
    });
    return () => sub.remove();
  }, [id]);

  // Track audiobook listening session for stats
  useEffect(() => {
    let sessionId: string | null = null;
    let startTime: number = 0;
    const bookTitle = item?.name || 'Unknown Audiobook';

    const initSession = async () => {
      if (!isCurrentItem || !isPlaying) return;
      sessionId = await startReadingSession(String(id), bookTitle, 'audiobook');
      startTime = Date.now();
    };

    initSession();

    return () => {
      if (sessionId && startTime > 0) {
        const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
        endReadingSession(
          sessionId,
          String(id),
          bookTitle,
          startTime,
          'audiobook',
          undefined,
          progressPercent
        );
      }
    };
  }, [id, isCurrentItem, isPlaying, item?.name]);

  async function loadItem() {
    console.log('[AudiobookPlayer] loading id:', id);
    setLoadError(null);
    try {
      const data = await provider.getSeriesDetail(id);
      setItem(data);
      // Play the first item in the series (for ABS detail, this is the item itself mapped as a series)
      const absItem = await absAPI.getLibraryItem(String(id));
      await play(absItem);
    } catch (e: any) {
      console.error('[AudiobookPlayer] failed:', e);
      setLoadError(e?.message || 'Failed to load audiobook');
    } finally {
      setLoading(false);
    }
  }

  /** Refresh item metadata without restarting playback. */
  async function refreshItem() {
    try {
      const data = await provider.getSeriesDetail(id);
      setItem(data);
      // Clear overrides — server data is now fresh
      setTitleOverride(null);
      setAuthorOverride(null);
    } catch {
      // Silent — overrides remain as fallback display
    }
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || !item) { setEditingTitle(false); return; }
    setInlineSaving(true);
    // Apply override immediately so UI responds before the re-fetch
    setTitleOverride(trimmed);
    try {
      await provider.updateSeriesMetadata({ ...item, name: trimmed });
      await refreshItem(); // Try to confirm from server; clears override on success
    } catch (e: any) {
      setTitleOverride(null); // Revert override if save actually failed
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setInlineSaving(false);
      setEditingTitle(false);
    }
  }

  async function saveAuthor() {
    const trimmed = authorDraft.trim();
    if (!item) { setEditingAuthor(false); return; }
    setInlineSaving(true);
    setAuthorOverride(trimmed);
    try {
      await provider.updateSeriesMetadata({ ...item, authorName: trimmed });
      await refreshItem();
    } catch (e: any) {
      setAuthorOverride(null);
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setInlineSaving(false);
      setEditingAuthor(false);
    }
  }

  const handleNavigateToEbook = useCallback(() => {
    if (!kavitaMatch) return;
    // 1. Minimize the player (slide down)
    router.back();
    // 2. Small delay for animation, then push to the ebook
    setTimeout(() => {
      router.push({ pathname: '/(tabs)/series/[id]', params: { id: (kavitaMatch as any).id } });
    }, 100);
  }, [kavitaMatch, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>Couldn't load audiobook</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>{loadError}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); loadItem(); }}
          style={{ marginTop: 20, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
        >
          <Text style={{ color: colors.textOnAccent, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayItem = isCurrentItem ? nowPlaying!.item : item;
  if (!displayItem) return null;

  // If it's a LibrarySeriesDetail, fields are flattened.
  // If it's an ABS item (from nowPlaying), we might need to be careful, 
  // but LibraryProvider.getSeriesDetail returns a LibrarySeriesDetail.
  const displayTitle = titleOverride ?? (displayItem as any).name ?? (displayItem as any).media?.metadata?.title;
  const displayAuthor = authorOverride ?? (displayItem as any).authorName ?? (displayItem as any).media?.metadata?.authorName;
  const displaySummary = (displayItem as any).summary ?? (displayItem as any).media?.metadata?.description;
  const displayGenres = (displayItem as any).genres || [];
  const displayTags = (displayItem as any).tags || [];
  const displayNarrator = (displayItem as any).narrator ?? (displayItem as any).media?.metadata?.narrator;
  
  const coverUri = absAPI.getCoverUrl(String(displayItem.id), coverKey);

  return (
    <>
      <View style={styles.screen}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── Full-width seeker (always at screen level) ── */}
        <SeekBar
          current={displayTime}
          duration={duration}
          onSeek={async (v) => { await seekSession(v); }}
          tracks={isCurrentItem ? nowPlaying!.tracks : undefined}
        />

        {/* ── Body (scrollable on narrow) ── */}
        <ScrollView
          scrollEnabled={!isWide}
          style={{ flex: 1 }}
          contentContainerStyle={isWide
            ? { flex: 1 }
            : { gap: Spacing.lg, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Two-column on wide, stacked on narrow */}
          <View style={styles.body}>

            {/* ── Left col: cover + playback controls ── */}
            <View style={styles.leftCol}>
              <TouchableOpacity onPress={() => setCoverPickerVisible(true)} activeOpacity={0.85}>
                <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
                <View style={styles.coverEditOverlay}>
                  <Ionicons name="camera-outline" size={14} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Play controls */}
              <View style={styles.controls}>
                <TouchableOpacity onPress={() => skipBack(15)} style={styles.controlBtn}>
                  <Ionicons name="play-back" size={24} color={colors.textPrimary} />
                  <Text style={styles.skipLabel}>15</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
                  <Ionicons
                    name={isPlaying && isCurrentItem ? 'pause' : 'play'}
                    size={30}
                    color={colors.textOnAccent}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => skipForward(30)} style={styles.controlBtn}>
                  <Ionicons name="play-forward" size={24} color={colors.textPrimary} />
                  <Text style={styles.skipLabel}>30</Text>
                </TouchableOpacity>
              </View>

              {/* Speed + chapter toggle */}
              <View style={styles.bottomRow}>
                <View style={styles.speedRow}>
                  <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
                  {[1.0, 1.25, 1.5, 2.0].map(speed => (
                    <TouchableOpacity key={speed} onPress={() => setRate?.(speed)} style={{ padding: 2 }}>
                      <Text style={{
                        color: playbackRate === speed ? colors.textOnAccent : colors.textSecondary,
                        backgroundColor: playbackRate === speed ? colors.accent : 'transparent',
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
                        fontWeight: playbackRate === speed ? 'bold' : 'normal',
                        fontSize: 11,
                      }}>{speed}x</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isCurrentItem && nowPlaying!.tracks.length > 0 && (
                  <TouchableOpacity
                    style={[styles.chip, chaptersVisible && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                    onPress={() => setChaptersVisible(v => !v)}
                  >
                    <Ionicons name="list" size={12} color={chaptersVisible ? colors.accent : colors.textSecondary} />
                    <Text style={[styles.chipText, chaptersVisible && { color: colors.accent }]}>
                      {nowPlaying!.trackIndex + 1}/{nowPlaying!.tracks.length}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Chapter tray (narrow: right below controls) */}
              {!isWide && chaptersVisible && isCurrentItem && (
                <View style={[styles.chapterTray, { maxHeight: 250, marginBottom: Spacing.md }]}>
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {nowPlaying!.tracks.map((track: any, i: number) => {
                      const isActive = i === nowPlaying!.trackIndex;
                      return (
                        <TouchableOpacity
                          key={track.index}
                          style={[styles.chapterRow, isActive && styles.chapterRowActive]}
                          onPress={() => { seekSession(track.startOffset); setChaptersVisible(false); }}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginRight: Spacing.md }}>
                            {isActive
                              ? <Ionicons name="volume-high" size={12} color={colors.accent} />
                              : <Text style={{ fontSize: Typography.xs, color: colors.textMuted, minWidth: 20, textAlign: 'right' }}>{i + 1}</Text>
                            }
                            <Text style={[styles.chapterTitle, isActive && styles.chapterTitleActive]} numberOfLines={1}>
                              {track.title || `File ${i + 1}`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 1 }}>
                            <Text style={styles.chapterDuration}>{formatTime(track.duration)}</Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                              @{formatTime(track.startOffset)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Chapter tray (inside left col on wide) */}
              {isWide && chaptersVisible && isCurrentItem && (
                <View style={styles.chapterTray}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {nowPlaying!.tracks.map((track: any, i: number) => {
                      const isActive = i === nowPlaying!.trackIndex;
                      return (
                        <TouchableOpacity
                          key={track.index}
                          style={[styles.chapterRow, isActive && styles.chapterRowActive]}
                          onPress={() => { seekSession(track.startOffset); setChaptersVisible(false); }}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginRight: Spacing.md }}>
                            {isActive
                              ? <Ionicons name="volume-high" size={12} color={colors.accent} />
                              : <Text style={{ fontSize: Typography.xs, color: colors.textMuted, minWidth: 20, textAlign: 'right' }}>{i + 1}</Text>
                            }
                            <Text style={[styles.chapterTitle, isActive && styles.chapterTitleActive]} numberOfLines={1}>
                              {track.title || `File ${i + 1}`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 1 }}>
                            <Text style={styles.chapterDuration}>{formatTime(track.duration)}</Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                              @{formatTime(track.startOffset)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ── Right col / below-cover (info + inline editing) ── */}
            <View style={styles.rightCol}>
              {/* Inline-editable title */}
              {editingTitle ? (
                <View style={styles.inlineEditRow}>
                  <TextInput
                    style={styles.inlineEditInput}
                    value={titleDraft}
                    onChangeText={setTitleDraft}
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={saveTitle}
                  />
                  <TouchableOpacity onPress={saveTitle} disabled={inlineSaving} style={styles.inlineEditBtn}>
                    {inlineSaving
                      ? <ActivityIndicator size="small" color={colors.accent} />
                      : <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingTitle(false)} style={styles.inlineEditBtn}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { setTitleDraft(displayTitle || ''); setEditingTitle(true); }}
                  activeOpacity={0.85}
                  style={styles.inlineTouchable}
                >
                  <Text style={styles.title} numberOfLines={3}>{displayTitle}</Text>
                  <Ionicons name="pencil" size={13} color={colors.textMuted} style={{ marginTop: 4 }} />
                </TouchableOpacity>
              )}

              {/* Inline-editable author */}
              {editingAuthor ? (
                <View style={styles.inlineEditRow}>
                  <TextInput
                    style={[styles.inlineEditInput, { fontSize: Typography.md }]}
                    value={authorDraft}
                    onChangeText={setAuthorDraft}
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={saveAuthor}
                    placeholder="Author name…"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={saveAuthor} disabled={inlineSaving} style={styles.inlineEditBtn}>
                    {inlineSaving
                      ? <ActivityIndicator size="small" color={colors.accent} />
                      : <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingAuthor(false)} style={styles.inlineEditBtn}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { setAuthorDraft(displayAuthor || ''); setEditingAuthor(true); }}
                  activeOpacity={0.85}
                  style={styles.inlineTouchable}
                >
                  <Text style={styles.author}>{displayAuthor || 'Add author…'}</Text>
                  <Ionicons name="pencil" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
                </TouchableOpacity>
              )}

              {displayNarrator ? (
                <Text style={styles.narrator} numberOfLines={1}>Narrated by {displayNarrator}</Text>
              ) : null}

              {/* Genres + tags chips */}
              {(displayGenres.length > 0 || displayTags.length > 0) && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {displayGenres.map((g: any) => (
                    <View key={g.id || g.title} style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{g.title || g}</Text>
                    </View>
                  ))}
                  {displayTags.map((t: any) => (
                    <View key={t.id || t.title} style={[styles.metaChip, styles.metaChipTag]}>
                      <Text style={[styles.metaChipText, styles.metaChipTagText]}>{t.title || t}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Description */}
              {displaySummary ? (
                <TouchableOpacity onPress={() => setDescExpanded(v => !v)} activeOpacity={0.8}>
                  <Text style={styles.desc} numberOfLines={descExpanded ? undefined : 4}>{displaySummary}</Text>
                  <Text style={styles.descToggle}>{descExpanded ? 'Show less' : 'Read more'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setEditVisible(true)} activeOpacity={0.8}>
                  <Text style={styles.noDesc}>No description — tap ✏ to add one.</Text>
                </TouchableOpacity>
              )}

              {kavitaMatch && (
                <TouchableOpacity
                  style={[styles.ebookBanner, { marginBottom: Spacing.md, alignSelf: 'flex-start', paddingHorizontal: Spacing.md }]}
                  activeOpacity={0.85}
                  onPress={handleNavigateToEbook}
                >
                  <Ionicons name="book" size={14} color={colors.accent} />
                  <Text style={styles.ebookBannerTitle} numberOfLines={1}>Ebook: {kavitaMatch.name}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </TouchableOpacity>
              )}

              {/* Action buttons row */}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                <TouchableOpacity style={styles.editMetaBtn} onPress={() => setEditVisible(true)} activeOpacity={0.85}>
                  <Ionicons name="create-outline" size={16} color={colors.accent} />
                  <Text style={styles.editMetaBtnText}>Edit tags</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editMetaBtn} onPress={() => setMetaSearchVisible(true)} activeOpacity={0.85}>
                  <Ionicons name="globe-outline" size={16} color={colors.accent} />
                  <Text style={styles.editMetaBtnText}>Search metadata</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editMetaBtn} onPress={() => setCoverPickerVisible(true)} activeOpacity={0.85}>
                  <Ionicons name="image-outline" size={16} color={colors.accent} />
                  <Text style={styles.editMetaBtnText}>Cover</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <EditMetadataModal
        visible={editVisible}
        seriesId={String(displayItem.id)}
        seriesName={displayTitle || ''}
        providerType="abs"
        onClose={() => setEditVisible(false)}
        onSaved={refreshItem}
      />

      <CoverPickerModal
        visible={coverPickerVisible}
        seriesId={String(displayItem.id)}
        seriesName={displayTitle || ''}
        authorName={displayAuthor || ''}
        providerType="abs"
        onClose={() => setCoverPickerVisible(false)}
        onSaved={() => { setCoverKey(k => k + 1); refreshItem(); }}
      />

      <MetadataSearchModal
        visible={metaSearchVisible}
        seriesId={String(displayItem.id)}
        seriesName={displayTitle || ''}
        providerType="abs"
        onClose={() => setMetaSearchVisible(false)}
        onApplied={() => {
          refreshItem();
        }}
      />
    </>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function ABSMetadataModal({ visible, itemId, title, authorName, description, tags, genres, onClose, onSaved }: any) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [titleInput, setTitleInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [genresInput, setGenresInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitleInput(title || '');
      setAuthorInput(authorName || '');
      setDescInput(description || '');
      setTagsInput(Array.isArray(tags) ? tags.join(', ') : '');
      setGenresInput(Array.isArray(genres) ? genres.join(', ') : '');
    }
  }, [visible]);

  async function handleSave() {
    setSaving(true);
    try {
      await absAPI.updateMetadata(itemId, {
        title: titleInput.trim() || undefined,
        authorName: authorInput.trim() || undefined,
        description: descInput.trim() || undefined,
        tags: tagsInput.split(',').map(s => s.trim()).filter(Boolean),
        genres: genresInput.split(',').map(s => s.trim()).filter(Boolean),
      });
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = { backgroundColor: colors.surface, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base } as any;
  const labelStyle = { fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase' as const, fontWeight: Typography.bold as any };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={{ fontSize: Typography.base, fontWeight: Typography.semibold as any, color: colors.textPrimary }}>Edit Metadata</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={{ fontSize: Typography.base, fontWeight: Typography.bold as any, color: colors.accent }}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.lg, padding: Spacing.xl, paddingBottom: 60 }}>
          <View>
            <Text style={labelStyle}>Title</Text>
            <TextInput style={fieldStyle} value={titleInput} onChangeText={setTitleInput} placeholder="Title…" placeholderTextColor={colors.textMuted} />
          </View>
          <View>
            <Text style={labelStyle}>Author</Text>
            <TextInput style={fieldStyle} value={authorInput} onChangeText={setAuthorInput} placeholder="Author name…" placeholderTextColor={colors.textMuted} />
          </View>
          <View>
            <Text style={labelStyle}>Description</Text>
            <TextInput style={[fieldStyle, { minHeight: 100, textAlignVertical: 'top' }]} value={descInput} onChangeText={setDescInput} multiline placeholder="Description…" placeholderTextColor={colors.textMuted} />
          </View>
          <View>
            <Text style={labelStyle}>Genres</Text>
            <TextInput style={fieldStyle} value={genresInput} onChangeText={setGenresInput} placeholder="Fantasy, Sci-Fi…" placeholderTextColor={colors.textMuted} />
            <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Comma separated</Text>
          </View>
          <View>
            <Text style={labelStyle}>Tags</Text>
            <TextInput style={fieldStyle} value={tagsInput} onChangeText={setTagsInput} placeholder="magic, dragons…" placeholderTextColor={colors.textMuted} />
            <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Comma separated</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ABSCoverPickerModal({ visible, itemId, title, onClose, onSaved }: any) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;
  const [mode, setMode] = useState<'choose' | 'search'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ coverId: number; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('choose');
      setSearchQuery(title || '');
      setSearchResults([]);
      setError('');
    }
  }, [visible, title]);

  useEffect(() => {
    if (mode === 'search' && searchResults.length === 0 && !searching) {
      searchCovers();
    }
  }, [mode]);

  async function pickFromDevice() {
    if (Platform.OS !== 'web') {
      setError('File upload requires the web version.');
      return;
    }
    // For ABS we'll implement URL-based updates for now but warn about local files
    setError('Upload from device is currently only supported via the ABS web app directly. Use Search Online instead.');
  }

  async function upload(url: string) {
    setUploading(true);
    setError('');
    try {
      await absAPI.updateCoverUrl(itemId, url);
      // Give ABS a moment
      await new Promise(r => setTimeout(r, 1000));
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Update failed');
    } finally {
      setUploading(false);
    }
  }

  async function searchCovers(customQuery?: string) {
    const q = (customQuery ?? searchQuery).trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    setError('');
    try {
      const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=12&fields=title,cover_i`;
      const res = await fetch(`/proxy?url=${encodeURIComponent(olUrl)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const json = await res.json();
      const results = (json.docs ?? [])
        .filter((d: any) => d.cover_i)
        .map((d: any) => ({ coverId: d.cover_i, title: d.title ?? '' }));
      setSearchResults(results);
      if (results.length === 0) setError('No covers found.');
    } catch (e: any) {
      setError(`Search failed: ${e?.message ?? 'error'}`);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl }}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold as any, color: colors.textPrimary }}>Change Cover</Text>
          <View style={{ width: 28 }} />
        </View>

        {mode === 'choose' ? (
          <View style={{ flex: 1, padding: Spacing.xl, gap: Spacing.lg }}>
            <TouchableOpacity 
              style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border }} 
              onPress={() => setMode('search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={32} color={colors.accent} />
              <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold as any, color: colors.textPrimary, marginTop: Spacing.md }}>Search Online</Text>
              <Text style={{ fontSize: Typography.sm, color: colors.textMuted, textAlign: 'center' }}>Find covers from Open Library</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ backgroundColor: colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, opacity: 0.6 }} 
              onPress={pickFromDevice}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
              <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold as any, color: colors.textMuted, marginTop: Spacing.md }}>Upload from Device</Text>
              <Text style={{ fontSize: Typography.sm, color: colors.textMuted, textAlign: 'center' }}>Available via ABS web app</Text>
            </TouchableOpacity>

            {error ? <Text style={{ color: '#ff4444', textAlign: 'center', fontSize: Typography.sm }}>{error}</Text> : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.md }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: colors.border }}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search covers..."
                onSubmitEditing={() => searchCovers()}
              />
              <TouchableOpacity 
                style={{ backgroundColor: colors.accent, borderRadius: Radius.md, width: 48, justifyContent: 'center', alignItems: 'center' }} 
                onPress={() => searchCovers()}
              >
                {searching ? <ActivityIndicator color={colors.textOnAccent} /> : <Ionicons name="search" size={20} color={colors.textOnAccent} />}
              </TouchableOpacity>
            </View>

            {error ? <Text style={{ color: '#ff4444', textAlign: 'center', marginBottom: 12 }}>{error}</Text> : null}

            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.base, gap: Spacing.base }}>
              {searchResults.map(r => {
                const thumbUrl = `/proxy?url=${encodeURIComponent(`https://covers.openlibrary.org/b/id/${r.coverId}-M.jpg`)}`;
                const fullUrl = `https://covers.openlibrary.org/b/id/${r.coverId}-M.jpg`;
                return (
                  <TouchableOpacity 
                    key={r.coverId} 
                    style={{ width: '30.5%', aspectRatio: 0.7 }} 
                    onPress={() => upload(fullUrl)}
                    disabled={uploading}
                  >
                    <Image source={{ uri: thumbUrl }} style={{ width: '100%', aspectRatio: 0.7, borderRadius: Radius.sm, backgroundColor: colors.surface }} />
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }} numberOfLines={2}>{r.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {uploading && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={{ color: 'white', marginTop: 12, fontWeight: 'bold' }}>Updating Cover...</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Metadata Search Modal (Google Books + Open Library → ABS) ─────────────────

interface ABSMetaResult {
  source: 'google' | 'openlibrary';
  id: string;
  title: string;
  authors: string[];
  year?: number;
  description?: string;
  genres: string[];
  publisher?: string;
  coverUrl?: string;
}

interface ABSAppliedFields {
  title?: string;
  authorName?: string;
  description?: string;
  genres?: string[];
}

function ABSMetadataSearchModal({ visible, itemId, initialTitle, onClose, onApplied }: {
  visible: boolean;
  itemId: string;
  initialTitle: string;
  onClose: () => void;
  onApplied: (fields: ABSAppliedFields) => void;
}) {
  const { colors } = useTheme();
  const C = colors;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ABSMetaResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gbWarning, setGbWarning] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ABSMetaResult | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyFields, setApplyFields] = useState({ description: true, genres: true, authors: true });

  useEffect(() => {
    if (!visible) return;
    const q = initialTitle.replace(/["""''`]/g, '').trim();
    setQuery(q);
    setResults([]);
    setSelected(null);
    setGbWarning('');
    setError('');
    setApplyFields({ description: true, genres: true, authors: true });
    doSearch(q);
  }, [visible]);

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title);
      setEditAuthor(selected.authors.join(', '));
    }
  }, [selected]);

  async function doSearch(customQuery?: string) {
    const q = (customQuery ?? query).trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    setSelected(null);
    setGbWarning('');
    setError('');
    const [gbRes, olRes] = await Promise.allSettled([searchGoogle(q), searchOpenLibrary(q)]);
    const combined: ABSMetaResult[] = [];
    const warnings: string[] = [];

    if (gbRes.status === 'fulfilled') {
      combined.push(...gbRes.value.results);
      if (gbRes.value.warning) warnings.push(gbRes.value.warning);
    }
    if (olRes.status === 'fulfilled') {
      combined.push(...olRes.value.results);
      if (olRes.value.warning) warnings.push(olRes.value.warning);
    }

    setResults(combined);
    setGbWarning(warnings.join(' ')); // Reuse gbWarning state for all search warnings
    if (combined.length === 0 && warnings.length === 0) setError('No results found. Try a different title.');
    setSearching(false);
  }

  async function searchGoogle(q: string): Promise<{ results: ABSMetaResult[]; warning?: string }> {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books`;
    try {
      const res = await fetch(`/proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const msg = res.status === 429 ? 'rate-limited' : `returned error ${res.status}`;
        return { results: [], warning: `Google Books ${msg}.` };
      }
      const json = await res.json();
      return {
      results: (json.items ?? []).map((item: any): ABSMetaResult => {
        const v = item.volumeInfo ?? {};
        const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
        const thumbHttps = thumb ? thumb.replace('http://', 'https://') : undefined;
        return {
          source: 'google', id: `gb-${item.id}`,
          title: v.title ?? '', authors: v.authors ?? [],
          year: v.publishedDate ? parseInt(v.publishedDate) : undefined,
          description: v.description,
          genres: (v.categories ?? []).flatMap((c: string) => c.split('/')).map((s: string) => s.trim()).filter(Boolean),
          publisher: v.publisher,
          coverUrl: thumbHttps ? `/proxy?url=${encodeURIComponent(thumbHttps)}` : undefined,
        };
      }),
    };
  } catch (e: any) {
    return { results: [], warning: `Google Books error: ${e.message}` };
  }
}

  async function searchOpenLibrary(q: string): Promise<{ results: ABSMetaResult[]; warning?: string }> {
    const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=8&fields=key,title,cover_i,author_name,first_publish_year,subject,publisher`;
    try {
      const res = await fetch(`/openlibrary-proxy?url=${encodeURIComponent(olUrl)}`);
      if (!res.ok) return { results: [], warning: `Open Library returned error ${res.status}.` };
      const json = await res.json();
      return {
        results: (json.docs ?? []).filter((d: any) => d.title).map((d: any): ABSMetaResult => ({
          source: 'openlibrary', id: `ol-${d.key ?? String(Math.random())}`,
          title: d.title ?? '', authors: d.author_name ?? [],
          year: d.first_publish_year,
          genres: (d.subject ?? []).map((s: string) => s.split('--')[0].trim()).filter((s: string) => s.length > 1 && s.length < 50).slice(0, 12),
          publisher: d.publisher?.[0],
          coverUrl: d.cover_i ? `/openlibrary-proxy?url=${encodeURIComponent(`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`)}` : undefined,
        })),
      };
    } catch (e: any) {
      return { results: [], warning: `Open Library error: ${e.message}` };
    }
  }

  async function apply() {
    if (!selected) return;
    setApplying(true);
    setError('');
    try {
      const patch: Parameters<typeof absAPI.updateMetadata>[1] = {};
      patch.title = editTitle.trim() || undefined;
      if (applyFields.authors && editAuthor.trim()) patch.authorName = editAuthor.trim();
      if (applyFields.description && selected.description) patch.description = selected.description.replace(/<[^>]+>/g, '');
      if (applyFields.genres && selected.genres.length > 0) patch.genres = selected.genres;
      await absAPI.updateMetadata(itemId, patch);
      onApplied({ title: patch.title, authorName: patch.authorName, description: patch.description, genres: patch.genres });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to apply');
    } finally {
      setApplying(false);
    }
  }

  const fieldStyle = { backgroundColor: C.surface, color: C.textPrimary, borderWidth: 1, borderColor: C.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base } as const;
  const labelStyle = { fontSize: Typography.xs, color: C.textSecondary, marginBottom: 4, textTransform: 'uppercase' as const, fontWeight: '600' as const };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
          <TouchableOpacity onPress={selected ? () => setSelected(null) : onClose}>
            <Ionicons name={selected ? 'arrow-back' : 'close'} size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: Typography.base, fontWeight: '600', color: C.textPrimary }}>{selected ? 'Apply Metadata' : 'Search Metadata'}</Text>
          {selected ? (
            <TouchableOpacity onPress={apply} disabled={applying} style={{ opacity: applying ? 0.5 : 1 }}>
              {applying ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={{ fontSize: Typography.base, fontWeight: '700', color: C.accent }}>Apply</Text>}
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        {selected ? (
          /* ── Confirm step ── */
          <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md, paddingBottom: 48 }}>
            {/* Cover + meta */}
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm }}>
              {selected.coverUrl
                ? <Image source={{ uri: selected.coverUrl }} style={{ width: 72, aspectRatio: 0.67, borderRadius: Radius.sm }} resizeMode="cover" />
                : <View style={{ width: 72, aspectRatio: 0.67, borderRadius: Radius.sm, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="book" size={24} color={C.textMuted} /></View>
              }
              <View style={{ flex: 1, gap: 4 }}>
                {selected.year ? <Text style={{ fontSize: Typography.xs, color: C.textMuted }}>{selected.year}</Text> : null}
                {selected.publisher ? <Text style={{ fontSize: Typography.xs, color: C.textMuted }}>{selected.publisher}</Text> : null}
                <View style={{ alignSelf: 'flex-start', backgroundColor: C.accentSoft, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: C.accent }}>{selected.source === 'google' ? 'Google Books' : 'Open Library'}</Text>
                </View>
              </View>
            </View>

            {/* Editable title */}
            <Text style={labelStyle}>Title</Text>
            <TextInput style={fieldStyle} value={editTitle} onChangeText={setEditTitle} placeholder="Title…" placeholderTextColor={C.textMuted} />

            {/* Editable author */}
            <Text style={[labelStyle, { marginTop: Spacing.sm }]}>Author</Text>
            <TextInput style={fieldStyle} value={editAuthor} onChangeText={setEditAuthor} placeholder="Author name…" placeholderTextColor={C.textMuted} />

            {/* Field toggles */}
            <Text style={[labelStyle, { marginTop: Spacing.md }]}>Fields to apply</Text>
            {([
              ['authors', 'Author above'] as const,
              ['description', `Description${selected.description ? '' : ' (none)'}`] as const,
              ['genres', `Genres (${selected.genres.length})`] as const,
            ]).map(([field, label]) => (
              <TouchableOpacity key={field} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 }}
                onPress={() => setApplyFields(f => ({ ...f, [field]: !f[field] }))}>
                <Ionicons name={applyFields[field] ? 'checkbox' : 'square-outline'} size={22} color={applyFields[field] ? C.accent : C.textMuted} />
                <Text style={{ fontSize: Typography.sm, color: C.textPrimary }}>{label}</Text>
              </TouchableOpacity>
            ))}

            {applyFields.genres && selected.genres.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {selected.genres.map(g => (
                  <View key={g} style={{ backgroundColor: C.surface, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: Typography.xs, color: C.textSecondary }}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {applyFields.description && selected.description ? (
              <>
                <Text style={[labelStyle, { marginTop: Spacing.md }]}>Description preview</Text>
                <Text style={{ fontSize: Typography.sm, color: C.textSecondary, lineHeight: 20 }} numberOfLines={6}>
                  {selected.description.replace(/<[^>]+>/g, '')}
                </Text>
              </>
            ) : null}

            {error ? <Text style={{ color: '#ff4444', marginTop: Spacing.sm }}>{error}</Text> : null}
          </ScrollView>
        ) : (
          /* ── Search results ── */
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', padding: Spacing.xl, gap: Spacing.md }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.surface, color: C.textPrimary, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: C.border, fontSize: Typography.sm }}
                value={query} onChangeText={setQuery} placeholder="Title / author…" placeholderTextColor={C.textMuted}
                onSubmitEditing={() => doSearch()} returnKeyType="search"
              />
              <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: Radius.md, width: 48, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => doSearch()} disabled={searching}>
                {searching ? <ActivityIndicator size="small" color={C.textOnAccent} /> : <Ionicons name="search" size={18} color={C.textOnAccent} />}
              </TouchableOpacity>
            </View>
            {gbWarning ? <Text style={{ fontSize: Typography.xs, color: C.textMuted, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>{gbWarning}</Text> : null}
            {error ? <Text style={{ color: '#ff4444', paddingHorizontal: Spacing.xl }}>{error}</Text> : null}
            {searching ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={C.accent} />
                <Text style={{ color: C.textMuted, fontSize: Typography.sm }}>Searching Google Books &amp; Open Library…</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md, paddingBottom: 40 }}>
                {results.map(r => (
                  <TouchableOpacity key={r.id} style={{ flexDirection: 'row', gap: Spacing.md, backgroundColor: C.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.border }}
                    onPress={() => setSelected(r)} activeOpacity={0.75}>
                    {r.coverUrl
                      ? <Image source={{ uri: r.coverUrl }} style={{ width: 56, aspectRatio: 0.67, borderRadius: Radius.sm }} resizeMode="cover" />
                      : <View style={{ width: 56, aspectRatio: 0.67, borderRadius: Radius.sm, backgroundColor: C.surfaceElevated, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="book" size={18} color={C.textMuted} /></View>
                    }
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: Typography.sm, fontWeight: '600', color: C.textPrimary }} numberOfLines={2}>{r.title}</Text>
                      {r.authors.length > 0 && <Text style={{ fontSize: Typography.xs, color: C.textSecondary }} numberOfLines={1}>{r.authors.join(', ')}</Text>}
                      {r.year ? <Text style={{ fontSize: Typography.xs, color: C.textMuted }}>{r.year}</Text> : null}
                      {r.description ? <Text style={{ fontSize: Typography.xs, color: C.textMuted }} numberOfLines={2}>{r.description.replace(/<[^>]+>/g, '')}</Text> : null}
                      <View style={{ alignSelf: 'flex-start', backgroundColor: C.accentSoft, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 }}>
                        <Text style={{ fontSize: 10, color: C.accent }}>{r.source === 'google' ? 'Google Books' : 'Open Library'}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textMuted} style={{ alignSelf: 'center' }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme, isWide = false) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 52,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Two-column on wide, stacked on narrow
  body: {
    flex: isWide ? 1 : 0,
    flexDirection: isWide ? 'row' : 'column',
    gap: Spacing.xl,
    alignItems: isWide ? 'flex-start' : 'stretch',
  },
  leftCol: {
    width: isWide ? 220 : undefined,
    flexShrink: 0,
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  rightCol: {
    flex: isWide ? 1 : 0,
    gap: Spacing.md,
  },
  cover: {
    width: isWide ? 220 : '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    alignSelf: isWide ? 'stretch' : 'center',
    maxWidth: isWide ? undefined : 280,
  },
  coverEditOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: colors.textPrimary,
    fontFamily: 'Georgia',
    lineHeight: 28,
  },
  author: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
  },
  narrator: {
    fontSize: Typography.xs,
    color: colors.textMuted,
  },
  inlineTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inlineEditInput: {
    flex: 1,
    fontSize: Typography.xl,
    fontWeight: Typography.bold as any,
    color: colors.textPrimary,
    fontFamily: 'Georgia',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  inlineEditBtn: {
    padding: 4,
  },
  metaChip: {
    backgroundColor: colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipTag: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent + '44',
  },
  metaChipText: {
    fontSize: Typography.xs,
    color: colors.textSecondary,
  },
  metaChipTagText: {
    color: colors.accent,
  },
  desc: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  descToggle: {
    fontSize: Typography.xs,
    color: colors.accent,
    marginTop: 4,
  },
  noDesc: {
    fontSize: Typography.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  editMetaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    backgroundColor: colors.accentSoft,
  },
  editMetaBtnText: {
    fontSize: Typography.xs,
    color: colors.accent,
    fontWeight: Typography.medium as any,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chapterTray: {
    maxHeight: 200,
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: Typography.medium as any,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    padding: 4,
  },
  seekerBlock: {
    width: '100%',
    gap: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 2,
  },
  skipLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  chapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chapterRowActive: {},
  chapterTitle: {
    flex: 1,
    fontSize: Typography.base,
    color: colors.textSecondary,
    marginRight: Spacing.md,
  },
  chapterTitleActive: {
    color: colors.accent,
    fontWeight: Typography.semibold,
  },
  chapterDuration: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  ebookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    gap: 6,
  },
  ebookBannerTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: Typography.medium as any,
    color: colors.accent,
  },
});
