import React, { useState, useRef } from 'react';
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
import { kavitaAPI } from '../../services/kavitaAPI';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PDFReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    chapterId: string;
    title: string;
    seriesId: string;
    volumeId: string;
  }>();

  const [showHeader, setShowHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const chapterId = Number(params.chapterId);
  const pdfUrl = kavitaAPI.getPdfReaderUrl(chapterId);
  const token = kavitaAPI.getToken();

  // HTML that embeds the PDF using PDF.js via CDN
  const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; height: 100vh; overflow: hidden; }
    #pdf-container {
      width: 100%;
      height: 100vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    canvas {
      display: block;
      margin: 8px auto;
      max-width: 100%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #loading {
      color: #e8a838;
      font-family: sans-serif;
      font-size: 16px;
      text-align: center;
      padding-top: 40vh;
    }
    #error {
      color: #e05c5c;
      font-family: sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div id="pdf-container">
    <div id="loading">Loading PDF…</div>
    <div id="error"></div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    async function loadPDF() {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: '${pdfUrl}',
          httpHeaders: { 'Authorization': 'Bearer ${token}' },
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;
        document.getElementById('loading').style.display = 'none';
        const container = document.getElementById('pdf-container');

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: window.devicePixelRatio || 2 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = Math.floor(viewport.width / (window.devicePixelRatio || 2)) + 'px';
          canvas.style.height = Math.floor(viewport.height / (window.devicePixelRatio || 2)) + 'px';
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'page', current: pageNum, total: pdf.numPages })
          );
        }
      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        const errEl = document.getElementById('error');
        errEl.style.display = 'block';
        errEl.textContent = 'Failed to load PDF: ' + err.message;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'error', message: err.message })
        );
      }
    }
    loadPDF();
  </script>
</body>
</html>`;

  function toggleHeader() {
    setShowHeader(v => !v);
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Header overlay */}
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title || 'PDF Reader'}
          </Text>
          <View style={styles.backBtn} />
        </View>
      )}

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading PDF…</Text>
        </View>
      )}

      <WebView
        style={styles.webview}
        source={{ html: pdfHtml }}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        scrollEnabled
        onTouchEnd={toggleHeader}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'page') {
              // Could track page progress here
              kavitaAPI.saveReadingProgress(
                chapterId,
                data.current,
                Number(params.seriesId),
                Number(params.volumeId)
              );
            }
          } catch {}
        }}
        mixedContentMode="always"
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    backgroundColor: 'rgba(13,13,18,0.9)',
  },
  backBtn: {
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
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
