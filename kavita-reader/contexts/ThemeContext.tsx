import React, { createContext, useContext, useEffect, useState, ReactNode, Platform } from 'react';
import { storage } from '../services/storage';
import {
  themes, fontFamilies, defaultCustomTheme,
  type ThemeName, type FontName, type ColorScheme, type CustomFont,
} from '../constants/theme';

const STORAGE_KEY_THEME = 'app_theme';
const STORAGE_KEY_FONT = 'app_font';
const STORAGE_KEY_CUSTOM_FONTS = 'app_custom_fonts_v1';
const STORAGE_KEY_CUSTOM_COLORS = 'app_custom_theme_colors';

interface ThemeContextType {
  themeName: ThemeName;
  fontName: FontName;
  colors: ColorScheme;
  fontFamily: string;
  customFonts: CustomFont[];
  customThemeColors: { bg: string; accent: string };
  setTheme: (t: ThemeName) => void;
  setFont: (f: FontName) => void;
  setCustomFont: (id: string) => void;
  addCustomFont: (name: string, dataUrl: string) => Promise<CustomFont>;
  removeCustomFont: (id: string) => Promise<void>;
  setCustomTheme: (bg: string, accent: string) => Promise<void>;
  /** The active custom font ID if fontName === 'custom', else null */
  activeCustomFontId: string | null;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'midnight',
  fontName: 'georgia',
  colors: themes.midnight,
  fontFamily: fontFamilies.georgia,
  customFonts: [],
  customThemeColors: { bg: '#0d0d12', accent: '#e8a838' },
  setTheme: () => {},
  setFont: () => {},
  setCustomFont: () => {},
  addCustomFont: async () => ({ id: '', name: '', dataUrl: '' }),
  removeCustomFont: async () => {},
  setCustomTheme: async () => {},
  activeCustomFontId: null,
});

function injectFontFace(font: CustomFont) {
  if (Platform.OS !== 'web') return;
  const existing = document.getElementById(`custom-font-${font.id}`);
  if (existing) return;
  const style = document.createElement('style');
  style.id = `custom-font-${font.id}`;
  style.textContent = `@font-face {
    font-family: '${CSS.escape ? CSS.escape(font.name) : font.name}';
    src: url('${font.dataUrl}');
    font-weight: normal;
    font-style: normal;
  }`;
  document.head.appendChild(style);
}

function removeFontFace(id: string) {
  if (Platform.OS !== 'web') return;
  document.getElementById(`custom-font-${id}`)?.remove();
}

/** Build a full ColorScheme from just a background hex and accent hex */
function buildCustomScheme(bg: string, accent: string): ColorScheme {
  // Lighten bg slightly for surface/elevated layers
  return {
    background: bg,
    surface: blendHex(bg, '#ffffff', 0.07),
    surfaceElevated: blendHex(bg, '#ffffff', 0.12),
    border: blendHex(bg, '#ffffff', 0.14),
    borderLight: blendHex(bg, '#ffffff', 0.20),
    accent,
    accentDim: blendHex(accent, '#000000', 0.2),
    accentSoft: hexWithAlpha(accent, 0.15),
    textPrimary: '#f0eaf0',
    textSecondary: blendHex(bg, '#ffffff', 0.55),
    textMuted: blendHex(bg, '#ffffff', 0.32),
    textOnAccent: isLight(accent) ? '#000000' : '#ffffff',
    success: '#4caf7d',
    error: '#e05c5c',
    warning: '#f0c040',
    progressBar: accent,
    progressTrack: blendHex(bg, '#ffffff', 0.14),
    overlay: hexWithAlpha(bg, 0.88),
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function blendHex(base: string, overlay: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(overlay);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 128;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('midnight');
  const [fontName, setFontName] = useState<FontName>('georgia');
  const [activeCustomFontId, setActiveCustomFontId] = useState<string | null>(null);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [customThemeColors, setCustomThemeColors] = useState<{ bg: string; accent: string }>({ bg: '#0d0d12', accent: '#e8a838' });

  useEffect(() => {
    (async () => {
      const t = await storage.getItem(STORAGE_KEY_THEME) as ThemeName | null;
      const f = await storage.getItem(STORAGE_KEY_FONT);
      const cf = await storage.getItem(STORAGE_KEY_CUSTOM_FONTS);
      const customId = await storage.getItem('app_active_custom_font_id');
      const cc = await storage.getItem(STORAGE_KEY_CUSTOM_COLORS);

      if (t && themes[t]) setThemeName(t);

      if (cc) {
        try {
          const parsed = JSON.parse(cc);
          if (parsed.bg && parsed.accent) setCustomThemeColors(parsed);
        } catch { /* ignore */ }
      }

      // Restore saved custom fonts and inject @font-face for each
      let loaded: CustomFont[] = [];
      if (cf) {
        try {
          loaded = JSON.parse(cf) as CustomFont[];
          setCustomFonts(loaded);
          loaded.forEach(injectFontFace);
        } catch { /* ignore corrupt data */ }
      }

      // Restore active font selection
      if (f && fontFamilies[f as FontName]) {
        setFontName(f as FontName);
      } else if (f === 'custom' && customId) {
        setFontName('georgia'); // fallback base
        setActiveCustomFontId(customId);
      }
    })();
  }, []);

  async function setTheme(t: ThemeName) {
    setThemeName(t);
    await storage.setItem(STORAGE_KEY_THEME, t);
  }

  async function setFont(f: FontName) {
    setFontName(f);
    setActiveCustomFontId(null);
    await storage.setItem(STORAGE_KEY_FONT, f);
    await storage.deleteItem('app_active_custom_font_id');
  }

  async function setCustomFont(id: string) {
    const font = customFonts.find(f => f.id === id);
    if (!font) return;
    setFontName('georgia'); // base (overridden by activeCustomFontId)
    setActiveCustomFontId(id);
    await storage.setItem(STORAGE_KEY_FONT, 'custom');
    await storage.setItem('app_active_custom_font_id', id);
  }

  async function addCustomFont(name: string, dataUrl: string): Promise<CustomFont> {
    const id = `cf_${Date.now()}`;
    const font: CustomFont = { id, name, dataUrl };
    const updated = [...customFonts, font];
    setCustomFonts(updated);
    injectFontFace(font);
    await storage.setItem(STORAGE_KEY_CUSTOM_FONTS, JSON.stringify(updated));
    return font;
  }

  async function removeCustomFont(id: string) {
    const updated = customFonts.filter(f => f.id !== id);
    setCustomFonts(updated);
    removeFontFace(id);
    if (activeCustomFontId === id) {
      setActiveCustomFontId(null);
      await setFont('georgia');
    }
    await storage.setItem(STORAGE_KEY_CUSTOM_FONTS, JSON.stringify(updated));
  }

  async function setCustomTheme(bg: string, accent: string) {
    const colors = { bg, accent };
    setCustomThemeColors(colors);
    await storage.setItem(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(colors));
    await setTheme('custom');
  }

  // Resolve the CSS font-family string for the active selection
  const activeCustomFont = activeCustomFontId
    ? customFonts.find(f => f.id === activeCustomFontId)
    : null;

  const fontFamily = activeCustomFont
    ? `'${activeCustomFont.name}', Georgia, serif`
    : fontFamilies[fontName];

  const colors: ColorScheme = themeName === 'custom'
    ? buildCustomScheme(customThemeColors.bg, customThemeColors.accent)
    : themes[themeName];

  return (
    <ThemeContext.Provider value={{
      themeName,
      fontName,
      colors,
      fontFamily,
      customFonts,
      customThemeColors,
      setTheme,
      setFont,
      setCustomFont,
      addCustomFont,
      removeCustomFont,
      setCustomTheme,
      activeCustomFontId,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
