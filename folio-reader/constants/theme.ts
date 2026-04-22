export interface ColorScheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  secondary: string;
  secondarySoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  success: string;
  error: string;
  warning: string;
  progressBar: string;
  progressTrack: string;
  overlay: string;
  cardShadow: string;
}

export type ThemeName = 'midnight' | 'amoled' | 'sepia' | 'ocean' | 'forest' | 'starry' | 'custom';
export type FontName =
  | 'georgia'
  | 'baskerville'
  | 'bookerly'
  | 'caroni'
  | 'roboto'
  | 'poppins'
  | 'mulish'
  | 'system'
  | 'opendyslexic';

export interface CustomFont {
  id: string;       // uuid-ish key
  name: string;     // display name (filename without extension)
  dataUrl: string;  // base64 data URL
}

// Placeholder custom theme — replaced at runtime by ThemeContext
export const defaultCustomTheme: ColorScheme = {
  background: '#0d0d12',
  surface: '#16161f',
  surfaceElevated: '#1e1e2a',
  border: '#2a2a3a',
  borderLight: '#353548',
  accent: '#e8a838',
  accentDim: '#b8832a',
  accentSoft: 'rgba(232, 168, 56, 0.15)',
  secondary: '#ffea4a',
  secondarySoft: 'rgba(255, 234, 74, 0.15)',
  textPrimary: '#f0ead8',
  textSecondary: '#b8b0b0',
  textMuted: '#7a7588',
  textOnAccent: '#0d0d12',
  success: '#4caf7d',
  error: '#e05c5c',
  warning: '#e8a838',
  progressBar: '#e8a838',
  progressTrack: '#2a2a3a',
  overlay: 'rgba(13, 13, 18, 0.85)',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
};

export const themes: Record<ThemeName, ColorScheme> = {
  midnight: {
    background: '#0d0d12',
    surface: '#16161f',
    surfaceElevated: '#1e1e2a',
    border: '#2a2a3a',
    borderLight: '#353548',
    accent: '#e8a838',
    accentDim: '#b8832a',
    accentSoft: 'rgba(232, 168, 56, 0.15)',
    secondary: '#ffea4a',
    secondarySoft: 'rgba(255, 234, 74, 0.15)',
    textPrimary: '#f0ead8',
    textSecondary: '#b8b0b0',
    textMuted: '#7a7588',
    textOnAccent: '#0d0d12',
    success: '#4caf7d',
    error: '#e05c5c',
    warning: '#e8a838',
    progressBar: '#e8a838',
    progressTrack: '#2a2a3a',
    overlay: 'rgba(13, 13, 18, 0.85)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  },
  amoled: {
    background: '#000000',
    surface: '#0c0c0c',
    surfaceElevated: '#141414',
    border: '#222222',
    borderLight: '#2e2e2e',
    accent: '#9b7cf5',
    accentDim: '#7a5ed4',
    accentSoft: 'rgba(155, 124, 245, 0.15)',
    secondary: '#00f0e0',
    secondarySoft: 'rgba(0, 240, 224, 0.15)',
    textPrimary: '#f0eeff',
    textSecondary: '#a8a8c0',
    textMuted: '#707080',
    textOnAccent: '#ffffff',
    success: '#4caf7d',
    error: '#e05c5c',
    warning: '#f0c040',
    progressBar: '#9b7cf5',
    progressTrack: '#222222',
    overlay: 'rgba(0, 0, 0, 0.88)',
    cardShadow: 'rgba(0, 0, 0, 0.7)',
  },
  sepia: {
    background: '#13100a',
    surface: '#1c1710',
    surfaceElevated: '#251e14',
    border: '#302818',
    borderLight: '#3d3322',
    accent: '#d4854a',
    accentDim: '#aa6838',
    accentSoft: 'rgba(212, 133, 74, 0.15)',
    secondary: '#ffc947',
    secondarySoft: 'rgba(255, 201, 71, 0.15)',
    textPrimary: '#ede0c8',
    textSecondary: '#b8a890',
    textMuted: '#7a6a58',
    textOnAccent: '#13100a',
    success: '#5aad6a',
    error: '#e05c5c',
    warning: '#d4854a',
    progressBar: '#d4854a',
    progressTrack: '#302818',
    overlay: 'rgba(19, 16, 10, 0.88)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  },
  ocean: {
    background: '#060c14',
    surface: '#0d1520',
    surfaceElevated: '#14202e',
    border: '#1a2a3a',
    borderLight: '#243348',
    accent: '#4d9bd6',
    accentDim: '#3a7ab0',
    accentSoft: 'rgba(77, 155, 214, 0.15)',
    secondary: '#00e0c0',
    secondarySoft: 'rgba(0, 224, 192, 0.15)',
    textPrimary: '#e8f0f8',
    textSecondary: '#a0b0c8',
    textMuted: '#687898',
    textOnAccent: '#060c14',
    success: '#4caf7d',
    error: '#e05c5c',
    warning: '#f0c040',
    progressBar: '#4d9bd6',
    progressTrack: '#1a2a3a',
    overlay: 'rgba(6, 12, 20, 0.88)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  },
  forest: {
    background: '#080e08',
    surface: '#101810',
    surfaceElevated: '#172017',
    border: '#1e2e1e',
    borderLight: '#283a28',
    accent: '#52b56b',
    accentDim: '#3d8f52',
    accentSoft: 'rgba(82, 181, 107, 0.15)',
    secondary: '#c8ff4a',
    secondarySoft: 'rgba(200, 255, 74, 0.15)',
    textPrimary: '#e8f0e8',
    textSecondary: '#a0b8a0',
    textMuted: '#687868',
    textOnAccent: '#080e08',
    success: '#52b56b',
    error: '#e05c5c',
    warning: '#d4a840',
    progressBar: '#52b56b',
    progressTrack: '#1e2e1e',
    overlay: 'rgba(8, 14, 8, 0.88)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  },
  starry: {
    background: '#05060f',
    surface: '#0c0e1c',
    surfaceElevated: '#131628',
    border: '#1c2040',
    borderLight: '#252a52',
    accent: '#c8a8f8',
    accentDim: '#9a78d0',
    accentSoft: 'rgba(200, 168, 248, 0.12)',
    secondary: '#7de8e0',
    secondarySoft: 'rgba(125, 232, 224, 0.15)',
    textPrimary: '#eeeaf8',
    textSecondary: '#a0a8d8',
    textMuted: '#686ea0',
    textOnAccent: '#05060f',
    success: '#5ab88a',
    error: '#e05c6c',
    warning: '#f0c060',
    progressBar: '#c8a8f8',
    progressTrack: '#1c2040',
    overlay: 'rgba(5, 6, 15, 0.88)',
    cardShadow: 'rgba(0, 0, 30, 0.7)',
  },
  custom: defaultCustomTheme,
};

export const themeLabels: Record<ThemeName, string> = {
  midnight: 'Midnight',
  amoled: 'AMOLED',
  sepia: 'Sepia',
  ocean: 'Ocean',
  forest: 'Forest',
  starry: 'Starry',
  custom: 'Custom',
};

export const fontLabels: Record<FontName, string> = {
  georgia: 'Georgia',
  baskerville: 'Baskerville',
  bookerly: 'Bookerly',
  caroni: 'Caroni',
  roboto: 'Roboto',
  poppins: 'Poppins',
  mulish: 'Mulish',
  system: 'System',
  opendyslexic: 'OpenDyslexic',
};

// CSS font-family stacks used inside the epub iframe
export const fontFamilies: Record<FontName, string> = {
  georgia: "Georgia, 'Times New Roman', serif",
  baskerville: "'Libre Baskerville', Baskerville, Georgia, serif",
  bookerly: "Bookerly, Georgia, 'Times New Roman', serif",
  caroni: "Caroni, Georgia, 'Times New Roman', serif",
  roboto: "Roboto, system-ui, sans-serif",
  poppins: "Poppins, system-ui, sans-serif",
  mulish: "Mulish, system-ui, sans-serif",
  system: "system-ui, -apple-system, sans-serif",
  opendyslexic: "OpenDyslexic, Georgia, serif",
};

// For the font picker preview ("Aa" swatch) — single family name, no fallbacks
export const fontPreviewFamily: Record<FontName, string> = {
  georgia: 'Georgia',
  baskerville: 'Libre Baskerville',
  bookerly: 'Bookerly',
  caroni: 'Caroni',
  roboto: 'Roboto',
  poppins: 'Poppins',
  mulish: 'Mulish',
  system: 'system-ui',
  opendyslexic: 'OpenDyslexic',
};

// Fonts that need a file dropped in public/fonts/ (not loaded from Google Fonts or system)
export const selfHostedFonts: Partial<Record<FontName, { file: string; format: string }>> = {
  opendyslexic: { file: '/fonts/OpenDyslexic-Regular.otf', format: 'opentype' },
  bookerly:     { file: '/fonts/Bookerly.ttf',              format: 'truetype' },
  caroni:       { file: '/fonts/Caroni-Regular.otf',        format: 'opentype' },
};

// Fonts loaded via Google Fonts CDN
export const googleFontFamilies: string[] = [
  'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  'Roboto:wght@400;500;700',
  'Poppins:wght@400;500;600;700',
  'Mulish:wght@400;500;700',
];

// Default export for backward compat — components that haven't migrated to
// useTheme() yet will get the Midnight theme colors.
export const Colors: ColorScheme = themes.midnight;

export const Typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '500' as const,
  serif: 'Georgia',
  sans: 'System',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Palette of soft, harmonious hues for genre/tag chips (in degrees)
const GENRE_HUES = [25, 45, 170, 200, 270, 310, 340];

/**
 * Generate a soft gradient color set for genre/tag chips with consistent brightness.
 * Uses HSL color space for perceptually uniform lightness.
 */
export function getGenreChipColors(name: string): {
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
  borderColor: string;
} {
  // Hash the name to pick a consistent hue
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }

  // Pick from curated palette for harmonious colors
  const hueIndex = Math.abs(hash) % GENRE_HUES.length;
  const baseHue = GENRE_HUES[hueIndex];

  // Add slight variation for gradient (10-20 degrees spread)
  const hueSpread = 15;
  const hue1 = baseHue;
  const hue2 = (baseHue + hueSpread) % 360;

  // Soft, consistent saturation and lightness for all chips
  const saturation = 55; // Lower saturation = softer colors
  const lightness1 = 22; // Dark background for contrast
  const lightness2 = 18; // Slightly darker for gradient end

  // Text color: light enough to read on dark background
  const textLightness = 88;

  return {
    gradientStart: `hsl(${hue1}, ${saturation}%, ${lightness1}%)`,
    gradientEnd: `hsl(${hue2}, ${saturation}%, ${lightness2}%)`,
    textColor: `hsl(${hue1}, ${saturation - 10}%, ${textLightness}%)`,
    borderColor: `hsla(${hue1}, ${saturation}%, 40%, 0.3)`,
  };
}
