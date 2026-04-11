import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI, ChapterInfo } from '../../services/kavitaAPI';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography, Spacing, Radius, ColorScheme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ImageReaderScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    chapterId: string;
    title: string;
    seriesId: string;
    volumeId: string;
    libraryId: string; // Add this
  }>();

  const [showHeader, setShowHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const webViewRef = useRef<WebView>(null);

  // Convert to numbers for the API calls
  const chapterId = Number(params.chapterId);
  const seriesId = Number(params.seriesId);
  const volumeId = Number(params.volumeId);
  const libraryId = Number(params.libraryId);
  
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo | null>(null);

  // Fetch info once to populate the "suitcase"
  useEffect(() => {
    (async () => {
      const info = await kavitaAPI.getChapterInfo(chapterId);
      setChapterInfo(info);
      if (info) setTotalPages(info.pages);
    })();
  }, [chapterId]);

  const token = kavitaAPI.getToken();
  // In proxy mode serverUrl is '' so these become relative URLs, proxied to Kavita
  const serverUrl = kavitaAPI.getServerUrl();

  const imageHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: ${colors.background};
      height: 100%;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    #viewer {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    #page-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: none;
    }
    #spinner {
      color: ${colors.accent};
      font-family: sans-serif;
      font-size: 15px;
      text-align: center;
    }
    #error-msg {
      color: ${colors.error};
      font-family: sans-serif;
      font-size: 13px;
      text-align: center;
      padding: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div id="viewer">
    <span id="spinner">Loading…</span>
    <div id="error-msg"></div>
    <img id="page-img" />
  </div>
  <script>
    // These are now hardcoded into the string that the WebView loads
    const TOKEN = '${token}';
    const SERVER = '${serverUrl}';
    const CHAPTER_ID = ${chapterId};
    const API_KEY = '${kavitaAPI.getApiKey()}'; 

    async function fetchPage(n) {
      if (cache[n]) return cache[n];
      
      // Now these constants will be recognized because they were 
      // 'baked in' to the string by the backticks above.
      const url = SERVER + '/api/Reader/image?bookId=' + CHAPTER_ID + '&pageNum=' + n + '&apiKey=' + API_KEY;
      
      const resp = await fetch(url, { 
        headers: { 'Authorization': 'Bearer ' + TOKEN } 
      });
      
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    }
    
    let currentPage = 0;
    let totalPages = 0;
    const cache = {};

    function notify(data) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    async function showPage(n) {
      if (n < 0 || n >= totalPages) return;
      document.getElementById('spinner').style.display = 'block';
      document.getElementById('page-img').style.display = 'none';
      try {
        const src = await fetchPage(n);
        const img = document.getElementById('page-img');
        img.src = src;
        img.style.display = 'block';
        document.getElementById('spinner').style.display = 'none';
        currentPage = n;
        notify({ type: 'page', page: n, total: totalPages });
        // Preload neighbours
        if (n + 1 < totalPages) fetchPage(n + 1).catch(() => {});
        if (n - 1 >= 0) fetchPage(n - 1).catch(() => {});
      } catch(e) {
        document.getElementById('spinner').style.display = 'none';
        const errEl = document.getElementById('error-msg');
        errEl.textContent = 'Failed to load page: ' + e.message;
        errEl.style.display = 'block';
        notify({ type: 'error', message: e.message });
      }
    }

    async function init() {
      try {
        const infoUrl = SERVER + '/api/Reader/chapter-info?chapterId=' + CHAPTER_ID;
        const resp = await fetch(infoUrl, { headers: { 'Authorization': 'Bearer ' + TOKEN } });
        const info = await resp.json();
        totalPages = info.pages || info.pagesCount || 0;
        notify({ type: 'total', total: totalPages });
        await showPage(0);
        notify({ type: 'loaded' });
      } catch(e) {
        document.getElementById('spinner').textContent = 'Error: ' + e.message;
        notify({ type: 'error', message: e.message });
      }
    }

    // Touch swipe navigation
    let touchStartX = 0, touchStartY = 0;
    document.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        // horizontal swipe — manga reads right-to-left by default
        if (dx < 0) showPage(currentPage + 1);
        else showPage(currentPage - 1);
      } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        // tap — toggle header
        notify({ type: 'tap' });
      }
    }, { passive: true });

    // Click left/right zone navigation
    document.getElementById('viewer').addEventListener('click', e => {
      // Don't handle clicks that originated from a swipe
      const x = e.clientX / window.innerWidth;
      if (x < 0.25) showPage(currentPage - 1);
      else if (x > 0.75) showPage(currentPage + 1);
      else notify({ type: 'tap' });
    });

    // Exposed to React Native
    window.goNext = () => showPage(currentPage + 1);
    window.goPrev = () => showPage(currentPage - 1);
    window.goToPage = (n) => showPage(n);

    init();
  </script>
</body>
</html>`;

  function sendCmd(cmd: string) {
    webViewRef.current?.injectJavaScript(`${cmd}(); true;`);
  }

  function handleMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'loaded':
          setLoading(false);
          break;
        case 'total':
          setTotalPages(data.total);
          break;
        case 'page':
          setCurrentPage(data.page);
          kavitaAPI.saveReadingProgress(
            data.chapterID,
            data.page,
          );
          break;
        case 'tap':
          setShowHeader(v => !v);
          break;
        case 'error':
          setLoading(false);
          break;
      }
    } catch {}
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title || 'Reader'}
          </Text>
          {totalPages > 0 && (
            <Text style={styles.pageCount}>
              {currentPage + 1} / {totalPages}
            </Text>
          )}
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ html: imageHtml }}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={handleMessage}
        mixedContentMode="always"
        originWhitelist={['*']}
        allowFileAccess
      />

      {showHeader && totalPages > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.navBtn} onPress={() => sendCmd('goPrev')}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: totalPages > 1 ? `${(currentPage / (totalPages - 1)) * 100}%` : '100%' },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => sendCmd('goNext')}>
            <Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: colors.textPrimary,
  },
  pageCount: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: Spacing.sm,
  },
  navBtn: {
    width: 44, height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
  },
  progressContainer: { flex: 1, alignItems: 'center' },
  progressTrack: {
    width: '100%', height: 3,
    backgroundColor: colors.progressTrack,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  loadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    zIndex: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: Typography.base, color: colors.textSecondary },
});
