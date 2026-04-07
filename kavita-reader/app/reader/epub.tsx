import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { kavitaAPI, BookTocEntry, ChapterInfo } from '../../services/kavitaAPI';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface BuildOptions {
  serverUrl: string;
  chapterId: number;
  apiKey: string;
  fontFamily?: string;
  customFontFace?: string;
}

function buildPageHtml(rawHtml: string, { serverUrl, chapterId, apiKey, fontFamily = 'Georgia, "Times New Roman", serif', customFontFace = '' }: BuildOptions): string {
  // Kavita returns a full HTML document — extract just the body content
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawContent = bodyMatch
    ? bodyMatch[1]
    : rawHtml
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?(html|body)[^>]*>/gi, '')
        .trim();

  const base = `${serverUrl}/api/Book/${chapterId}`;

  // Rewrite resource URLs to absolute Kavita URLs with apiKey.
  // Kavita emits two URL formats depending on version:
  //   1. Relative:       src="book-resources?file=cover.jpeg"
  //   2. Absolute-path:  src="/api/Book/184/book-resources?file=cover.jpeg"
  // Both need the server host prepended and apiKey appended so the browser
  // can authenticate the request.
  const rewriteUrl = (path: string): string => {
    let absolute: string;
    if (path.startsWith('http')) {
      // Already fully absolute — keep as-is
      absolute = path;
    } else if (path.startsWith('//')) {
      // Protocol-relative (//host/path) — strip the embedded host and use
      // our serverUrl so the correct port is included.
      const afterSlashes = path.slice(2);
      const slashIdx = afterSlashes.indexOf('/');
      const pathname = slashIdx >= 0 ? afterSlashes.slice(slashIdx) : '';
      absolute = `${serverUrl}${pathname}`;
    } else if (path.startsWith('/')) {
      // Absolute-path (/api/...) — prepend host only
      absolute = `${serverUrl}${path}`;
    } else {
      // Relative (book-resources?... or ./book-resources?...) — prepend base
      absolute = `${base}/${path.replace(/^\.\//, '')}`;
    }
    const sep = absolute.includes('?') ? '&' : '?';
    return `${absolute}${sep}apiKey=${apiKey}`;
  };

  const cleanContent = rawContent
    // Pass 1: relative/absolute-path src and href attributes
    .replace(
      /((?:src|href)\s*=\s*)(["'])([^"']*book-resources[^"']*)\2/gi,
      (_m, attr, quote, path) => `${attr}${quote}${rewriteUrl(path)}${quote}`
    )
    // Pass 2: absolute-path /api/ URLs in src/href (catches other API assets)
    .replace(
      /((?:src|href)\s*=\s*)(["'])(\/api\/[^"']+)\2/gi,
      (_m, attr, quote, path) => {
        const absolute = `${serverUrl}${path}`;
        const sep = absolute.includes('?') ? '&' : '?';
        return `${attr}${quote}${absolute}${sep}apiKey=${apiKey}${quote}`;
      }
    );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${base}/">
<style>
  ${customFontFace}
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    margin: 0; padding: 0;
    height: 100%; width: 100%;
    background-color: #0d0d12;
    overflow: hidden;
  }

  /* ── PHONE: single column, vertical scroll ── */
  @media (max-width: 767px) {
    body { overflow-y: auto; overflow-x: hidden; }
    #clip { position: static; }
    #book-content {
      height: auto;
      padding: 24px 20px;
      column-count: 1;
      overflow: visible;
    }
  }

  /* ── TABLET / DESKTOP: two-column horizontal page-flip ── */
  @media (min-width: 768px) {
    /*
     * #clip is an absolutely-positioned window that sits 60px inset from each
     * side. This gives every "page" consistent margins without relying on
     * multicol container padding (which only applies to the first page).
     */
    #clip {
      position: absolute;
      top: 0; bottom: 0;
      left: 60px; right: 60px;
      overflow: hidden;
    }
    #book-content {
      height: 100%;
      padding: 40px 0;      /* vertical breathing room only */
      column-count: 2;
      column-gap: 60px;
      column-fill: auto;
      will-change: transform;
      transition: transform 0.25s ease;
    }
  }

  #book-content {
    color: #e2e2e2;
    font-family: ${fontFamily};
    font-size: 18px;
    line-height: 1.7;
    text-align: justify;
  }
  p { margin: 0 0 1em 0; }
  img {
    max-width: 100%;
    height: auto;
    break-inside: avoid;
    display: block;
    margin: 10px auto;
    filter: brightness(0.85);
  }
  a { color: #c8c8c8; }
  body::-webkit-scrollbar { display: none; }
</style>
<script>
  window.__isPhone = function() { return window.innerWidth < 768; };

  function __getStride() {
    var c = document.getElementById('book-content');
    var gap = parseFloat(getComputedStyle(c).columnGap) || 0;
    return Math.round(c.offsetWidth + gap);
  }

  window.__goToPage = function(n) {
    var c = document.getElementById('book-content');
    c.style.transform = 'translateX(-' + (n * __getStride()) + 'px)';
  };

  window.__getPageCount = function() {
    var c = document.getElementById('book-content');
    var stride = __getStride();
    return Math.max(1, Math.ceil(c.scrollWidth / stride));
  };

  /*
   * Wait for all resources (images etc.) to finish loading, then measure.
   * Using the 'load' event is far more reliable than rAF polling:
   *   - rAF is throttled to ≤1fps in unfocused/background iframes, so
   *     a "120 frame cap" could mean 2 minutes, not 2 seconds.
   *   - 'load' fires after every img/font/css settles (including errors),
   *     so scrollWidth is stable and accurate when we read it.
   * A 3s setTimeout acts as a safety net if 'load' somehow never fires.
   */
  window.__measurePages = function(callback) {
    var fired = false;
    function doMeasure() {
      if (fired) return;
      fired = true;
      // Two rAFs after load to let multicol reflow finish painting
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          callback(window.__getPageCount());
        });
      });
    }
    if (document.readyState === 'complete') {
      doMeasure();
    } else {
      window.addEventListener('load', doMeasure, { once: true });
      setTimeout(doMeasure, 3000);
    }
  };
</script>
</head>
<body>
  <div id="clip">
    <div id="book-content">${cleanContent}</div>
  </div>
</body>
</html>`;
}

export default function EpubReaderScreen() {
  const params = useLocalSearchParams<{ chapterId: string; title: string }>();
  const chapterId = Number(params.chapterId);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rawHtml, setRawHtml] = useState('');
  const [visualPage, setVisualPage] = useState(0);
  const [totalVisualPages, setTotalVisualPages] = useState(1);
  const measuringRef = useRef(false);
  const measuringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageRef = useRef(0);
  const initialLoadRef = useRef(true);
  const [iframeFocused, setIframeFocused] = useState(false);
  const [toc, setToc] = useState<BookTocEntry[]>([]);
  const chapterInfoRef = useRef<ChapterInfo | null>(null);

  currentPageRef.current = currentPage;

  const { fontFamily, activeCustomFontId, customFonts } = useTheme();
  const activeCustomFont = activeCustomFontId
    ? customFonts.find(f => f.id === activeCustomFontId)
    : null;
  const pageHtml = rawHtml ? buildPageHtml(rawHtml, {
    serverUrl: kavitaAPI.getServerUrl(),
    chapterId,
    apiKey: kavitaAPI.getApiKey(),
    fontFamily,
    customFontFace: activeCustomFont
      ? `@font-face { font-family: '${activeCustomFont.name}'; src: url('${activeCustomFont.dataUrl}'); }`
      : undefined,
  }) : '';

  const loadPage = useCallback(async (page: number) => {
    if (page < 0 || (totalPages > 0 && page >= totalPages)) return;
    // Save progress for the page we're leaving — skip the very first load
    // so we don't overwrite Kavita's stored position with page 0.
    if (chapterInfoRef.current && !initialLoadRef.current) {
      kavitaAPI.saveReadingProgress(chapterInfoRef.current, currentPageRef.current);
    }
    initialLoadRef.current = false;
    setLoading(true);
    measuringRef.current = true;
    if (measuringTimerRef.current) clearTimeout(measuringTimerRef.current);
    measuringTimerRef.current = setTimeout(() => { measuringRef.current = false; }, 5000);
    setVisualPage(0);
    setTotalVisualPages(1);
    try {
      const html = await kavitaAPI.getBookPage(chapterId, page);
      setRawHtml(html);
      setCurrentPage(page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [chapterId, totalPages]);

  useEffect(() => {
    (async () => {
      try {
        const [info, tocData, lastPage] = await Promise.all([
          kavitaAPI.getChapterInfo(chapterId),
          kavitaAPI.getBookToc(chapterId),
          kavitaAPI.getReadingProgress(chapterId),
        ]);
        chapterInfoRef.current = info;
        setTotalPages(info.pages || 0);
        setToc(tocData);
        await loadPage(lastPage);
      } catch (e) { console.error(e); }
    })();
  }, [chapterId]);

  // Flatten nested TOC entries and find the title for the current page
  const currentSectionTitle = (() => {
    if (!toc.length) return null;
    const flat: BookTocEntry[] = [];
    const walk = (entries: BookTocEntry[]) => {
      for (const e of entries) {
        flat.push(e);
        if (e.children?.length) walk(e.children);
      }
    };
    walk(toc);
    const sorted = flat.slice().sort((a, b) => a.page - b.page);
    let match = sorted[0];
    for (const entry of sorted) {
      if (entry.page <= currentPage) match = entry;
      else break;
    }
    return match?.title ?? null;
  })();

  const getIframeWin = (): any => {
    if (Platform.OS !== 'web') return null;
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    return iframe?.contentWindow ?? null;
  };

  const focusIframe = () => {
    if (Platform.OS !== 'web') return;
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.focus();
  };

  const handleNext = () => {
    const win = getIframeWin();
    if (!win) return;
    if (win.__isPhone?.()) {
      if (!measuringRef.current) loadPage(currentPage + 1);
      return;
    }
    const liveCount: number = win.__getPageCount?.() ?? 1;
    setTotalVisualPages(liveCount);
    if (visualPage < liveCount - 1) {
      const next = visualPage + 1;
      win.__goToPage(next);
      setVisualPage(next);
    } else if (!measuringRef.current) {
      loadPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    const win = getIframeWin();
    if (!win) return;
    if (win.__isPhone?.()) {
      if (!measuringRef.current) loadPage(currentPage - 1);
      return;
    }
    const liveCount: number = win.__getPageCount?.() ?? 1;
    setTotalVisualPages(liveCount);
    if (visualPage > 0) {
      const prev = visualPage - 1;
      win.__goToPage(prev);
      setVisualPage(prev);
    } else if (!measuringRef.current) {
      loadPage(currentPage - 1);
    }
  };

  // Arrow key navigation — deps include visual page state so handlers stay fresh
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, totalPages, visualPage, totalVisualPages, loading]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (chapterInfoRef.current) {
            kavitaAPI.saveReadingProgress(chapterInfoRef.current, currentPage);
          }
          router.back();
        }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{params.title}</Text>
          {currentSectionTitle && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{currentSectionTitle}</Text>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.contentArea, iframeFocused && styles.contentAreaFocused]}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={pageHtml}
            key={`reader-${currentPage}`}
            onLoad={(e) => {
              const win = e.currentTarget.contentWindow as any;
              if (!win) return;
              win.addEventListener('focus', () => setIframeFocused(true));
              win.addEventListener('blur', () => setIframeFocused(false));
              // Forward arrow keys from inside the iframe to parent handlers
              win.addEventListener('keydown', (ke: KeyboardEvent) => {
                if (ke.key === 'ArrowRight' || ke.key === 'ArrowLeft') {
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: ke.key }));
                }
              });
              // Poll until scrollWidth stabilises, then unlock navigation
              win.__measurePages?.((count: number) => {
                setTotalVisualPages(count);
                measuringRef.current = false;
                if (measuringTimerRef.current) {
                  clearTimeout(measuringTimerRef.current);
                  measuringTimerRef.current = null;
                }
                win.focus();
                setIframeFocused(true);
              });
            }}
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              backgroundColor: '#0d0d12',
            }}
          />
        ) : <Text style={{ color: '#fff' }}>Web Only Reader</Text>}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.accent} size="large" />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => { loadPage(currentPage - 1); }}
          style={styles.navBtn}
        >
          <Ionicons name="play-skip-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Tap the center to re-focus arrow key navigation into the reader */}
        <TouchableOpacity onPress={focusIframe} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>
            Page {visualPage + 1} of {totalVisualPages}
          </Text>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
            Chapter {currentPage + 1} of {totalPages}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { loadPage(currentPage + 1); }}
          style={styles.navBtn}
        >
          <Ionicons name="play-skip-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d12' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1a1a22',
  },
  headerTitle: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  headerSubtitle: { color: '#aaa', textAlign: 'center', fontSize: 12, marginTop: 2 },
  contentArea: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0d0d12',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contentAreaFocused: {
    borderColor: '#5b8dd9',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a22',
  },
  navBtn: { padding: 10, backgroundColor: '#333', borderRadius: 8 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 18, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});
