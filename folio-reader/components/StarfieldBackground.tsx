import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  color: string;
}

interface NebulaCloud {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  borderRadius: string;
}

function generateStars(count: number, colors: { accent: string; surface: string; textMuted: string; textPrimary: string }): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1.5,
    opacity: Math.random() * 0.4 + 0.6,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 8,
    color: Math.random() > 0.5 ? colors.accent : Math.random() > 0.3 ? colors.textPrimary : colors.textMuted,
  }));
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = h % 360;
  const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateHarmoniousColors(accent: string, secondary: string): string[] {
  const [h1, s1, l1] = hexToHsl(accent);
  const [h2, s2, l2] = hexToHsl(secondary);
  
  // Generate color harmony
  const colors = [
    accent,                    // Primary accent
    secondary,                 // Secondary
    hslToHex(h1 + 30, s1, l1), // Analogous +30°
    hslToHex(h1 - 30, s1, l1), // Analogous -30°
    hslToHex(h1 + 180, s1 * 0.8, l1), // Complementary (split)
    hslToHex((h1 + h2) / 2, (s1 + s2) / 2, (l1 + l2) / 2), // Mid blend
    hslToHex(h2 + 60, s2 * 0.7, Math.min(l2 + 15, 85)), // Light tertiary
  ];
  
  // Add semi-transparent variants
  return [
    ...colors,
    ...colors.map(c => c + '70'), // 44% opacity
    ...colors.map(c => c + '40'), // 25% opacity
  ];
}

function generateNebula(count: number, accent: string, secondary: string, background: string): NebulaCloud[] {
  const colors = generateHarmoniousColors(accent, secondary);
  const randomRadius = () => {
    const r1 = 50 + Math.random() * 30;
    const r2 = 50 + Math.random() * 30;
    const r3 = 50 + Math.random() * 30;
    const r4 = 50 + Math.random() * 30;
    return `${r1}% ${100-r1}% ${r2}% ${100-r2}% / ${r3}% ${r4}% ${100-r4}% ${100-r3}%`;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 25 + Math.random() * 50,
    y: 25 + Math.random() * 50,
    size: Math.random() * 60 + 30,
    color: colors[i % colors.length],
    duration: Math.random() * 25 + 20,
    delay: Math.random() * 15,
    borderRadius: randomRadius(),
  }));
}

// Pre-generate static initial stars to avoid calculation delay
const STATIC_STARS = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  opacity: Math.random() * 0.4 + 0.4,
  color: Math.random() > 0.5 ? '#00d4c8' : '#c8a8f8',
}));

// Inline styles for immediate render - no CSS injection delay
const STARFIELD_STYLES = {
  container: {
    position: 'fixed' as const,
    top: '-50vh',
    left: '-50vw',
    width: '200vw',
    height: '200vh',
    zIndex: 0,
    pointerEvents: 'none' as const,
    transform: 'translateZ(0)',
    willChange: 'transform',
  },
  nebula: {
    position: 'absolute' as const,
    borderRadius: '60% 40% 70% 30% / 40% 50% 60% 50%',
    filter: 'blur(30px)',
    pointerEvents: 'none' as const,
    transform: 'translateZ(0)',
  },
  star: {
    position: 'absolute' as const,
    borderRadius: '50%',
    pointerEvents: 'none' as const,
    transform: 'translateZ(0)',
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(5, 6, 15, 0.12)',
    pointerEvents: 'none' as const,
    zIndex: 0,
    transform: 'translateZ(0)',
  },
};

export function StarfieldBackground() {
  const { colors, uiAnimationsEnabled, starfieldEnabled } = useTheme();
  const styleInjected = useRef(false);

  // Use static stars initially, then generate dynamic ones
  const [starsReady, setStarsReady] = useState(false);
  // Delay animations until content loads
  const [animationsReady, setAnimationsReady] = useState(false);
  
  const stars = useMemo(() => {
    if (!starsReady) return STATIC_STARS;
    return generateStars(240, {
      accent: colors.accent,
      surface: colors.surface,
      textMuted: colors.textMuted,
      textPrimary: colors.textPrimary,
    });
  }, [colors.accent, colors.surface, colors.textMuted, colors.textPrimary, starsReady]);

  const nebulaClouds = useMemo(() => generateNebula(6, colors.accent, colors.secondary || colors.accent, colors.background), 
    [colors.accent, colors.secondary, colors.background]);

  // Mark stars as ready after initial render
  useEffect(() => {
    const timer = setTimeout(() => setStarsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Start animations after content likely loaded (1.5s delay)
  useEffect(() => {
    const timer = setTimeout(() => setAnimationsReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Set body background immediately
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.body.style.backgroundColor = colors.background;
    document.documentElement.style.backgroundColor = colors.background;
    document.documentElement.style.setProperty('--theme-secondary', colors.secondary || '#00d4c8');
    document.documentElement.style.setProperty('--theme-secondary-soft', colors.secondarySoft || 'rgba(0, 212, 200, 0.3)');
  }, [colors.background, colors.secondary, colors.secondarySoft]);

  // Inject non-critical CSS after mount
  useEffect(() => {
    if (Platform.OS !== 'web' || styleInjected.current) return;
    
    const css = `
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: ${colors.background}; }
      ::-webkit-scrollbar-thumb { background: ${colors.surface}; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: ${colors.border}; }
      * { scrollbar-width: thin; scrollbar-color: ${colors.surface} ${colors.background}; }
      #root, #root > div { background-color: transparent !important; }
      [class*="r-13awgt0"] { background-color: transparent !important; }
      a[role="tab"] { transition: all 0.25s ease; position: relative; }
      a[role="tab"]:hover { filter: brightness(1.4); transform: scale(1.08) translateY(-2px); }
      @keyframes nebula-drift { 
        0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.12; }
        50% { transform: translate(20px, -20px) rotate(3deg); opacity: 0.2; }
      }
      @keyframes starfield-twinkle { 
        0%, 100% { opacity: 0.4; } 
        50% { opacity: 0.9; } 
      }
      @keyframes starfield-rotate { 
        0% { transform: rotate(0deg) scale(1.5); }
        50% { transform: rotate(180deg) scale(1.5); }
        100% { transform: rotate(360deg) scale(1.5); }
      }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'starfield-animations';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    styleInjected.current = true;

    return () => {
      document.getElementById('starfield-animations')?.remove();
      styleInjected.current = false;
    };
  }, [colors.background, colors.surface, colors.border]);

  if (Platform.OS !== 'web' || !starfieldEnabled) {
    return null;
  }

  return (
    <div style={{
      ...STARFIELD_STYLES.container,
      animation: (uiAnimationsEnabled && animationsReady)
        ? 'starfield-rotate 720s linear infinite'
        : undefined,
      transformOrigin: 'center center',
    }}>
      {/* Reduced nebula count for faster render */}
      {nebulaClouds.slice(0, 5).map((cloud) => (
        <div
          key={`nebula-${cloud.id}`}
          style={{
            ...STARFIELD_STYLES.nebula,
            left: `${cloud.x}%`,
            top: `${cloud.y}%`,
            width: cloud.size * 8,
            height: cloud.size * 8,
            backgroundColor: cloud.color,
            opacity: 0.12,
            animation: (uiAnimationsEnabled && animationsReady)
              ? `nebula-drift ${cloud.duration}s ease-in-out infinite alternate`
              : undefined,
            animationDelay: `${cloud.delay}s`,
          }}
        />
      ))}

      {/* Static stars render immediately, dynamic ones after */}
      {stars.map((star: any) => (
        <div
          key={`star-${star.id}`}
          style={{
            ...STARFIELD_STYLES.star,
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: star.color,
            opacity: star.opacity,
            boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
            animation: (uiAnimationsEnabled && animationsReady && star.duration)
              ? `starfield-twinkle ${star.duration}s ease-in-out infinite`
              : undefined,
            animationDelay: star.delay ? `${star.delay}s` : undefined,
          }}
        />
      ))}

      {/* Static dark overlay */}
      <div style={STARFIELD_STYLES.overlay} />
    </div>
  );
}
