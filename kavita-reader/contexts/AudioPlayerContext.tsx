import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef
} from 'react';
import {
  useAudioPlayer as useNativeAudioPlayer,
  setAudioModeAsync,
  type AudioSource,
} from 'expo-audio';
import { absAPI, ABSLibraryItem, ABSAudioTrack, ABSPlaybackSession } from '../services/audiobookshelfAPI';

// 1. Ensure this is at the TOP of the file (above the Provider)
export interface NowPlaying {
  item: ABSLibraryItem;
  session: ABSPlaybackSession;
  tracks: ABSAudioTrack[];
  trackIndex: number;
}

// 1. Define the Context Object at the top level
const AudioPlayerContext = createContext<any>(null);

const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);


// This hook connects your components to the Provider's "Value"
export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  
  return context;
};

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  // 1. The Hook (Simple)
  const player = useNativeAudioPlayer(audioSource);

  // The Listener (Reliable)
  useEffect(() => {
    // Listen for the status change
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      // Check for the finished state
      if (status.playbackState === 'finished') {
        advanceTrack();
      }
    });

    return () => subscription.remove(); // Cleanup is vital!
  }, [player, audioSource]);

  console.log("Player Keys:", Object.keys(player));

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });
  }, []);

  // Sync Progress to Server
  useEffect(() => {
    if (player.playing && nowPlaying) {
      syncInterval.current = setInterval(() => {
        absAPI.saveAudioProgress(
          nowPlaying.session.id, 
          player.currentTime, 
          nowPlaying.session.duration
        );
      }, 30000);
    } else {
      if (syncInterval.current) clearInterval(syncInterval.current);
    }
    return () => { if (syncInterval.current) clearInterval(syncInterval.current); };
  }, [player.playing, nowPlaying]);

  const loadTrack = useCallback((np: NowPlaying, trackIndex: number, startPositionSec: number) => {
    const track = np.tracks[trackIndex];
    if (!track) return;

    const uri = absAPI.resolveTrackUrl(track.contentUrl);
    
    // Changing this state triggers the useAudioPlayer to reload
    setAudioSource(uri);
    
    // We can set the start time once the player is ready or via the hook properties
    player.currentTime = startPositionSec;
    player.play();
  }, [player]);

  async function advanceTrack() {
    setNowPlaying((prev) => {
      // 1. THE GUARD: If it's null, we can't advance, so just return null
      if (!prev) return null;

      const nextIndex = prev.trackIndex + 1;
      
      // 2. BOUNDARY CHECK: If we're at the end, stay on the last track
      if (nextIndex >= prev.tracks.length) return prev; 

      // 3. TRIGGER LOAD: Load the actual audio file
      loadTrack(prev, nextIndex, 0);
      
      // 4. RETURN NEW STATE: Update the index
      return { ...prev, trackIndex: nextIndex };
    });
  }

  const play = useCallback(async (item: ABSLibraryItem, startTime?: number) => {
    if (nowPlaying?.item.id === item.id) {
      player.play();
      return;
    }

    const resumeAt = startTime ?? item.userMediaProgress?.currentTime ?? 0;
    const session = await absAPI.startPlaybackSession(item.id, resumeAt);
    const tracks = session.audioTracks;
    if (!tracks?.length) return;

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

    const np = { item, session, tracks, trackIndex };
    setNowPlaying(np);
    loadTrack(np, trackIndex, offsetWithinTrack);
  }, [nowPlaying, player, loadTrack]);

  const togglePlayPause = useCallback(async () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player]);

  const stop = useCallback(async () => {
    if (nowPlaying?.session) {
      await absAPI.closeSession(nowPlaying.session.id, player.currentTime, nowPlaying.session.duration);
    }
    setAudioSource(null);
    setNowPlaying(null);
  }, [nowPlaying, player.currentTime]);

  return (
    <AudioPlayerContext.Provider value={{
      nowPlaying,
      isPlaying: player.playing,
      currentTime: player.currentTime,
      totalTime: player.duration,
      sessionTime: (nowPlaying?.tracks[nowPlaying.trackIndex]?.startOffset ?? 0) + player.currentTime,
      play,
      togglePlayPause,
      seek: async (s: number) => { player.currentTime = s; },
      seekSession: async (abs: number) => {
        // FIND TRACK AND SEEK
      },
      skipForward: async (s = 30) => { player.currentTime += s; },
      skipBack: async (s = 15) => { player.currentTime -= s; },
      stop,
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
