/**
 * FolioLogo
 * Book spines arranged as a shelf — uses SVG via react-native-svg on native,
 * or an inline <svg> string on web.
 */
import React from 'react';
import { View, Text, Platform } from 'react-native';

interface Props {
  size?: number;
  accentColor?: string;
  textColor?: string;
  showLabel?: boolean;
}

// Shelf of 5 book spines: varied heights, widths, and colors derived from accent
function BookshelfSvg({ size, accent, bg }: { size: number; accent: string; bg: string }) {
  const w = size;
  const h = size;

  // Book spine definitions — x, width, height, color
  const books = [
    { x: 2,  w: 9,  h: 0.62, color: accent },
    { x: 12, w: 7,  h: 0.75, color: blend(accent, bg, 0.25) },
    { x: 20, w: 11, h: 0.85, color: blend(accent, bg, 0.45) },
    { x: 32, w: 8,  h: 0.68, color: blend(accent, bg, 0.20) },
    { x: 41, w: 9,  h: 0.78, color: blend(accent, bg, 0.60) },
  ];

  const shelfY = h * 0.88;
  const shelfH = h * 0.05;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 ${h}" width="${w}" height="${h}">
      ${books.map(b => {
        const bh = b.h * shelfY;
        const by = shelfY - bh;
        return `<rect x="${b.x}" y="${by.toFixed(1)}" width="${b.w}" height="${bh.toFixed(1)}" rx="1.5" fill="${b.color}" />`;
      }).join('\n      ')}
      <!-- shelf shadow line -->
      <rect x="0" y="${shelfY}" width="52" height="${shelfH}" rx="${shelfH / 2}" fill="${blend(accent, bg, 0.5)}" />
    </svg>`;

  if (Platform.OS === 'web') {
    return (
      <div
        style={{ width: w, height: h }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  // Native fallback: colored rectangles
  return (
    <View style={{ width: w, height: h, position: 'relative' }}>
      {books.map((b, i) => {
        const bh = b.h * shelfY;
        const by = shelfY - bh;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: (b.x / 52) * w,
            top: (by / h) * h,
            width: (b.w / 52) * w,
            height: bh,
            borderRadius: 2,
            backgroundColor: b.color,
          }} />
        );
      })}
      <View style={{
        position: 'absolute',
        left: 0, right: 0,
        top: shelfY,
        height: shelfH,
        borderRadius: shelfH / 2,
        backgroundColor: blend(accent, bg, 0.5),
      }} />
    </View>
  );
}

function blend(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function FolioLogo({
  size = 48,
  accentColor = '#e8a838',
  textColor = '#f0ead8',
  showLabel = false,
}: Props) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <BookshelfSvg size={size} accent={accentColor} bg="#0d0d12" />
      {showLabel && (
        <Text style={{
          fontSize: size * 0.28,
          fontWeight: '700',
          color: textColor,
          fontFamily: 'Georgia',
          letterSpacing: size * 0.04,
          textTransform: 'uppercase',
        }}>
          Folio
        </Text>
      )}
    </View>
  );
}
