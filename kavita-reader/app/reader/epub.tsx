import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI } from '../../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function EpubReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    chapterId: string;
    title: string;
    seriesId: string;
    volumeId: string;
  }>();

  const [showHeader, setShowHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'light'>('dark');
  const webViewRef = useRef<WebView>(null);

  const chapterId = Number(params.chapterId);
  const epubUrl = kavitaAPI.getEpubReaderUrl(chapterId);
  const token = kavitaAPI.getToken();

  const themes = {
    dark: { bg: '#1a1a22', text: '#e8e0d0', link: '#e8a838' },
    sepia: { bg: '#f4ecd8', text: '#3b2e1e', link: '#8b6340' },
    light: { bg: '#ffffff', text: '#1a1a1a', link: '#2563eb' },
  };

  const t = themes[readerTheme];

  const epubHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${t.bg};
    }
    #reader {
      width: 100vw;
      height: 100vh;
    }
    #reader iframe {
      border: none !important;
    }
  </style>
</head>
<body>
  <div id="reader"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js"></script>
  <script>
    let book, rendition, currentLocation;

    async function init() {
      try {
        // Fetch the EPUB with auth header
        const resp = await fetch('${epubUrl}', {
          headers: { 'Authorization': 'Bearer ${token}' }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const arrayBuffer = await resp.arrayBuffer();

        book = ePub(arrayBuffer);
        rendition = book.renderTo('reader', {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        });

        rendition.themes.register('custom', {
          body: {
            background: '${t.bg}',
            color: '${t.text}',
            'font-size': '18px',
            'line-height': '1.7',
            'font-family': 'Georgia, serif',
            padding: '20px 24px !important',
          },
          a: { color: '${t.link}' },
          'p': { 'margin-bottom': '1em' },
        });
        rendition.themes.select('custom');

        await rendition.display();
        notify({ type: 'loaded' });

        book.locations.generate(1024).then(() => {
          const total = book.locations.total;
          notify({ type: 'total', total });
        });

        rendition.on('relocated', (location) => {
          currentLocation = location;
          const page = book.locations.percentageFromCfi(location.start.cfi);
          notify({ type: 'progress', page: Math.round(page * 100), cfi: location.start.cfi });
        });

        // Swipe to turn pages
        rendition.on('touchstart', (event) => { window._touchX = event.changedTouches[0].clientX; });
        rendition.on('touchend', (event) => {
          const dx = event.changedTouches[0].clientX - window._touchX;
          if (Math.abs(dx) > 40) {
            if (dx < 0) rendition.next();
            else rendition.prev();
          } else {
            notify({ type: 'tap' });
          }
        });

      } catch (err) {
        notify({ type: 'error', message: err.message });
      }
    }

    function notify(data) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    window.goNext = () => rendition && rendition.next();
    window.goPrev = () => rendition && rendition.prev();

    init();
  </script>
</body>
</html>`;

  function sendCommand(cmd: string) {
    webViewRef.current?.injectJavaScript(`${cmd}(); true;`);
  }

  function cycleTheme() {
    const themes: Array<'dark' | 'sepia' | 'light'> = ['dark', 'sepia', 'light'];
    const idx = themes.indexOf(readerTheme);
    setReaderTheme(themes[(idx + 1) % themes.length]);
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
        case 'progress':
          setCurrentPage(data.page);
          kavitaAPI.saveReadingProgress(
            chapterId,
            data.page,
            Number(params.seriesId),
            Number(params.volumeId)
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

  const themeIcons: Record<string, string> = {
    dark: 'moon',
    sepia: 'cafe',
    light: 'sunny',
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Top header */}
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title || 'EPUB Reader'}
          </Text>
          <TouchableOpacity style={styles.headerBtn} onPress={cycleTheme}>
            <Ionicons name={themeIcons[readerTheme] as any} size={20} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading book…</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ html: epubHtml }}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={handleMessage}
        mixedContentMode="always"
        originWhitelist={['*']}
        allowFileAccess
      />

      {/* Bottom nav */}
      {showHeader && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.navBtn} onPress={() => sendCommand('goPrev')}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progressInfo}>
            {totalPages > 0 ? (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${currentPage}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{currentPage}%</Text>
              </>
            ) : (
              <Text style={styles.progressText}>Loading locations…</Text>
            )}
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => sendCommand('goNext')}>
            <Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a22',
  },
  webview: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(13,13,18,0.92)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
  progressInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.progressTrack,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },
  progressText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
});
