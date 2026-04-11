export interface ColorScheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
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
  textPrimary: '#f0ead8',
  textSecondary: '#9a9098',
  textMuted: '#5a5568',
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
    textPrimary: '#f0ead8',
    textSecondary: '#9a9098',
    textMuted: '#5a5568',
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
    textPrimary: '#f0eeff',
    textSecondary: '#9090a8',
    textMuted: '#505060',
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
    textPrimary: '#ede0c8',
    textSecondary: '#9a8c78',
    textMuted: '#5e5244',
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
    textPrimary: '#e8f0f8',
    textSecondary: '#8898ac',
    textMuted: '#4a5a6c',
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
    textPrimary: '#e8f0e8',
    textSecondary: '#88a088',
    textMuted: '#4a5e4a',
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
    textPrimary: '#eeeaf8',
    textSecondary: '#8890c0',
    textMuted: '#484e78',
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
