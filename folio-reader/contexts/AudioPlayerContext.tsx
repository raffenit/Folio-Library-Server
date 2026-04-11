import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef
} from 'react';
import {
  useAudioPlayer as useNativeAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  type AudioSource,
} from 'expo-audio';
import { DeviceEventEmitter } from 'react-native';
import { absAPI, ABSLibraryItem, ABSAudioTrack, ABSPlaybackSession } from '../services/audiobookshelfAPI';
import { storage } from '../services/storage';

const STORAGE_KEY_RATE = 'folio_playback_rate';

export interface NowPlaying {
  item: ABSLibraryItem;
  session: ABSPlaybackSession;
  tracks: ABSAudioTrack[];
  trackIndex: number;
}

const AudioPlayerContext = createContext<any>(null);

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(1.0);
  const savedRateRef = useRef(1.0); // Ref so the audioSource effect always sees the latest value

  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const pendingPlay = useRef<boolean>(false);
  const advanceLock = useRef(false);

  useEffect(() => { nowPlayingRef.current = nowPlaying; }, [nowPlaying]);

  const player = useNativeAudioPlayer(audioSource);
  // useAudioPlayerStatus is the proper reactive API — replaces manual addListener
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing || status.isBuffering;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  }, []);

  // Load persisted playback rate on mount
  useEffect(() => {
    storage.getItem(STORAGE_KEY_RATE).then(v => {
      if (!v) return;
      const r = parseFloat(v);
      if (Number.isFinite(r) && r > 0) {
        savedRateRef.current = r;
        setCurrentPlaybackRate(r);
        player.playbackRate = r;
      }
    });
  }, []);

  // Keep loadTrack accessible in advanceTrack without stale closure issues
  const loadTrackRef = useRef<(np: NowPlaying, idx: number, pos: number, autoPlay: boolean) => void>(
    () => {}
  );

  // Reset track-end lock whenever a new source loads
  useEffect(() => {
    advanceLock.current = false;
  }, [audioSource]);

  // UI progress loop — only updates display time, no end-detection here
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const t = player.currentTime;
      if (Number.isFinite(t) && t >= 0) {
        setDisplayTime(t);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, player]);

  // Track-end detection — decoupled from isPlaying so the interval clearing
  // when playback stops doesn't race against detecting the natural end.
  // status.didJustFinish comes from expo-audio's reactive status and fires
  // reliably when the HTMLAudioElement's 'ended' event fires on web.
  useEffect(() => {
    if (!status.didJustFinish || advanceLock.current) return;
    advanceLock.current = true;
    advanceTrack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Server sync every 30s
  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const interval = setInterval(() => {
      absAPI.saveAudioProgress(
        nowPlaying.session.id,
        player.currentTime,
        nowPlaying.session.duration,
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [isPlaying, nowPlaying]);

  const safePlay = useCallback(() => {
    try {
      const p = (player as any).play();
      if (p instanceof Promise) {
        p.catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('[AudioPlayer] play() failed:', err);
          }
        });
      }
    } catch (err) {
      console.warn('[AudioPlayer] play() sync error:', err);
    }
  }, [player]);

  // When audioSource changes, execute queued seek + autoplay after a brief load delay,
  // and reapply the saved playback rate (player resets to 1x on each new source).
  useEffect(() => {
    if (audioSource === null) return;
    const timer = setTimeout(() => {
      // Always reapply rate — player resets to 1.0 on new source
      if (savedRateRef.current !== 1.0) {
        player.playbackRate = savedRateRef.current;
      }
      if (pendingSeek.current !== null) {
        player.seekTo(pendingSeek.current);
        pendingSeek.current = null;
      }
      if (pendingPlay.current) {
        pendingPlay.current = false;
        safePlay();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [audioSource, safePlay, player]);

  const loadTrack = useCallback((
    np: NowPlaying,
    trackIndex: number,
    startPositionSec: number,
    autoPlay: boolean = true
  ) => {
    const track = np.tracks[trackIndex];
    if (!track) return;

    const uri = absAPI.resolveTrackUrl(track.contentUrl);
    const currentUri = typeof audioSource === 'string' ? audioSource : (audioSource as any)?.uri;

    if (currentUri !== uri) {
      pendingSeek.current = startPositionSec;
      pendingPlay.current = autoPlay;
      setAudioSource(uri as AudioSource);
    } else {
      player.seekTo(startPositionSec);
      setDisplayTime(startPositionSec);
      if (autoPlay) {
        safePlay();
      }
    }
  }, [player, audioSource, safePlay]);

  // Keep the ref current so advanceTrack never has a stale loadTrack
  useEffect(() => { loadTrackRef.current = loadTrack; }, [loadTrack]);

  function advanceTrack() {
    const np = nowPlayingRef.current;
    if (!np) return;
    const nextIndex = np.trackIndex + 1;
    if (nextIndex >= np.tracks.length) return;
    const updated = { ...np, trackIndex: nextIndex };
    setNowPlaying(updated);
    nowPlayingRef.current = updated;
    // Reset display time immediately so sessionTime = nextTrack.startOffset + 0,
    // which is the correct absolute position before the new file finishes loading.
    setDisplayTime(0);
    loadTrackRef.current(updated, nextIndex, 0, true);
  }

  const play = useCallback(async (item: ABSLibraryItem, startTime?: number) => {
    if (nowPlayingRef.current?.item.id === item.id) {
      const liveStatus = player.currentStatus as any;
      // If the track naturally ended, fall through to restart a new session.
      // Otherwise just resume (no-op if already playing, resumes if paused).
      if (!liveStatus?.didJustFinish) {
        // Refresh item data in case metadata (tags, genres, cover) was updated
        const updated = { ...nowPlayingRef.current, item };
        setNowPlaying(updated);
        nowPlayingRef.current = updated;
        safePlay();
        return;
      }
    }
    // Don't pass startTime to ABS unless explicitly provided — when omitted, ABS
    // returns the server-tracked progress in session.currentTime, which is the
    // correct resume point. Passing 0 would override that and lose progress.
    const session = await absAPI.startPlaybackSession(item.id, startTime);
    const tracks = session.audioTracks;
    if (!tracks?.length) {
      throw new Error('No playable audio tracks found. The file may be unsupported or missing.');
    }

    // Prefer caller-supplied position; fall back to ABS server-tracked currentTime
    const resumeAt = startTime ?? session.currentTime ?? 0;
    let trackIndex = 0;
    let offsetWithinTrack = resumeAt;
    for (let i = 0; i < tracks.length; i++) {
      const trackEnd = tracks[i].startOffset + tracks[i].duration;
      if (resumeAt < trackEnd) {
        trackIndex = i;
        offsetWithinTrack = resumeAt - tracks[i].startOffset;
        break;
      }
    }

    setDisplayTime(offsetWithinTrack);
    const np = { item, session, tracks, trackIndex };
    setNowPlaying(np);
    nowPlayingRef.current = np;
    loadTrack(np, trackIndex, offsetWithinTrack, true);
  }, [player, loadTrack, safePlay]);

  const seekSession = useCallback(async (absoluteSec: number) => {
    const np = nowPlayingRef.current;
    if (!np) return;

    let targetIndex = np.tracks.length - 1;
    for (let i = 0; i < np.tracks.length; i++) {
      if (absoluteSec < np.tracks[i].startOffset + np.tracks[i].duration) {
        targetIndex = i;
        break;
      }
    }
    const offsetInTrack = Math.max(0, absoluteSec - np.tracks[targetIndex].startOffset);
    setDisplayTime(offsetInTrack);

    if (targetIndex !== np.trackIndex) {
      const updated = { ...np, trackIndex: targetIndex };
      setNowPlaying(updated);
      nowPlayingRef.current = updated;
      // Pass live playing state so seek-while-paused stays paused
      loadTrack(updated, targetIndex, offsetInTrack, (player.currentStatus as any)?.playing ?? false);
    } else {
      player.seekTo(offsetInTrack);
    }
  }, [player, loadTrack]);

  const togglePlayPause = useCallback(() => {
    // Use live currentStatus.playing (reads HTMLAudioElement directly) rather than
    // a stale ref so the toggle is always accurate.
    const live = (player.currentStatus as any)?.playing;
    if (live) {
      player.pause();
    } else {
      safePlay();
    }
  }, [player, safePlay]);

  const stop = useCallback(async () => {
    const np = nowPlayingRef.current;
    const itemId = np?.item.id;
    if (np?.session) {
      // Broadcast stop early so UI can react immediately, or wait for close?
      // Waiting ensures server has processed the final sync.
      await absAPI.closeSession(np.session.id, player.currentTime, np.session.duration);
    }
    setAudioSource(null);
    setNowPlaying(null);
    nowPlayingRef.current = null;
    setDisplayTime(0);

    if (itemId) {
      DeviceEventEmitter.emit('FOLIO_PLAYBACK_STOPPED', { itemId });
    }
  }, [player]);

  const np = nowPlaying;
  const trackOffset = np?.tracks[np.trackIndex]?.startOffset ?? 0;
  const sessionTime = trackOffset + displayTime;

  return (
    <AudioPlayerContext.Provider value={{
      nowPlaying,
      isPlaying,
      currentTime: displayTime,
      totalTime: player.duration,
      sessionTime,
      playbackRate: currentPlaybackRate,
      setRate: (rate: number) => {
        player.playbackRate = rate;
        savedRateRef.current = rate;
        setCurrentPlaybackRate(rate);
        storage.setItem(STORAGE_KEY_RATE, String(rate));
      },
      play,
      togglePlayPause,
      seek: async (s: number) => { player.seekTo(s); },
      seekSession,
      skipForward: async (s = 30) => {
        const t = player.currentTime + s;
        player.seekTo(t);
        setDisplayTime(t);
      },
      skipBack: async (s = 15) => {
        const t = Math.max(0, player.currentTime - s);
        player.seekTo(t);
        setDisplayTime(t);
      },
      stop,
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
