import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ContinueItem {
  id: string | number;
  title: string;
  subtitle?: string;
  coverUrl: string;
  progress: number; // 0-100
  total?: number;
  current?: number;
}

interface ContinueSectionProps {
  title: string;
  items: ContinueItem[];
  onPressItem: (item: ContinueItem) => void;
  onContextMenu?: (item: ContinueItem, x: number, y: number) => void;
  onPlay?: (item: ContinueItem) => void;
  isPlaying?: (item: ContinueItem) => boolean;
  minimized?: boolean;
}

// ── Circular Progress Indicator ───────────────────────────────────────────────

function CircularProgress({ progress, size = 24, strokeWidth = 3 }: { progress: number; size?: number; strokeWidth?: number }) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (Platform.OS === 'web') {
    // Use CSS conic-gradient for web (no SVG needed)
    return (
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `conic-gradient(${colors.accent} ${progress}%, ${colors.border} ${progress}%)`,
        position: 'relative',
      }}>
        <View style={{
          position: 'absolute',
          top: strokeWidth,
          left: strokeWidth,
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          backgroundColor: colors.background,
        }} />
      </View>
    );
  }

  // For native, use a simple border-based approach
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: strokeWidth,
      borderColor: colors.border,
      position: 'relative',
    }}>
      <View style={{
        position: 'absolute',
        top: -strokeWidth,
        left: -strokeWidth,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: 'transparent',
        borderTopColor: colors.accent,
        transform: [{ rotate: `${(progress / 100) * 360}deg` }],
      }} />
    </View>
  );
}

// ── Individual Card ───────────────────────────────────────────────────────────

function ContinueCard({
  item,
  onPress,
  onContextMenu,
  onPlay,
  isPlaying,
}: {
  item: ContinueItem;
  onPress: () => void;
  onContextMenu?: (x: number, y: number) => void;
  onPlay?: () => void;
  isPlaying?: boolean;
}) {
  const { colors } = useTheme();
  const ref = React.useRef<View>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  // Web context menu support
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onContextMenu) return;
    const el = ref.current as any as HTMLElement;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [onContextMenu]);

  const showProgressBar = item.progress > 0 && item.progress < 100;
  const showPlayButton = onPlay;

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      onLongPress={onContextMenu ? (e) => onContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
      style={{
        width: 220,
        height: 90,
        marginRight: Spacing.sm,
        borderRadius: Radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isHovered ? colors.accent : colors.border,
        flexDirection: 'row',
        ...(Platform.OS === 'web' ? {
          boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.2s ease',
        } : {}),
      }}
      {...(Platform.OS === 'web' && {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      })}
    >
      {/* Cover image on left */}
      <View style={{ width: 70, height: '100%', position: 'relative' }}>
        <Image source={{ uri: item.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        
        {/* Circular progress indicator */}
        {showProgressBar && (
          <View style={{ position: 'absolute', bottom: 6, right: 6 }}>
            <CircularProgress progress={item.progress} size={28} strokeWidth={3} />
          </View>
        )}

        {/* Play button overlay on hover */}
        {showPlayButton && (isHovered || Platform.OS !== 'web') && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onPlay(); }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: [{ translateX: -16 }, { translateY: -16 }],
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: `${colors.accent}CC`,
              alignItems: 'center',
              justifyContent: 'center',
              ...(Platform.OS === 'web' ? {
                backdropFilter: 'blur(4px)',
              } : {}),
            }}
          >
            <View style={{
              width: 0,
              height: 0,
              borderLeftWidth: 10,
              borderRightWidth: 0,
              borderTopWidth: 6,
              borderBottomWidth: 6,
              borderLeftColor: colors.textOnAccent,
              borderRightColor: 'transparent',
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              marginLeft: 2,
            }} />
          </TouchableOpacity>
        )}
      </View>

      {/* Text info on right */}
      <View style={{ flex: 1, padding: Spacing.sm, paddingLeft: Spacing.sm, justifyContent: 'flex-start' }}>
        <Text numberOfLines={2} style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 18, fontWeight: Typography.semibold }}>
          {item.title}
        </Text>
        {item.subtitle && (
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            {item.subtitle}
          </Text>
        )}
        {showProgressBar && (
          <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1, height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
              <View style={{ width: `${item.progress}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 2 }} />
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>{Math.round(item.progress)}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Section Component ─────────────────────────────────────────────────────────

export function ContinueSection({
  title,
  items,
  onPressItem,
  onContextMenu,
  onPlay,
  isPlaying,
  minimized = false,
}: ContinueSectionProps) {
  const { colors } = useTheme();

  if (!items.length) return null;

  return (
    <View style={{ marginBottom: minimized ? 0 : Spacing.md }}>
      {/* Top gradient divider - full width */}
      {Platform.OS === 'web' ? (
        <div style={{
          height: 1,
          background: `radial-gradient(ellipse at center, ${colors.accent}50 0%, ${colors.secondary}55 25%, #8B6DB8 50%, #A85A95 75%, ${colors.secondary}65 100%)`,
          marginBottom: minimized ? 0 : Spacing.md,
          width: '100%',
        }} />
      ) : (
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: minimized ? 0 : Spacing.md, width: '100%' }} />
      )}

      {/* Header */}
      {!minimized && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.sm }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: colors.textPrimary }}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }} />
            <Text style={{ fontSize: 10, color: colors.textMuted }}>{items.length}</Text>
          </View>
        </View>
      )}

      {/* Horizontal scroll */}
      {!minimized && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 2 }}
        >
          {items.map((item) => (
            <ContinueCard
              key={String(item.id)}
              item={item}
              onPress={() => onPressItem(item)}
              onContextMenu={onContextMenu ? (x, y) => onContextMenu(item, x, y) : undefined}
              onPlay={onPlay ? () => onPlay(item) : undefined}
              isPlaying={isPlaying ? isPlaying(item) : false}
            />
          ))}
        </ScrollView>
      )}

      {/* Bottom gradient divider - full width */}
      {Platform.OS === 'web' ? (
        <div style={{
          height: 1,
          background: `radial-gradient(ellipse at center, ${colors.accent}50 0%, ${colors.secondary}55 25%, #8B6DB8 50%, #A85A95 75%, ${colors.secondary}65 100%)`,
          marginTop: minimized ? 0 : Spacing.md,
          width: '100%',
        }} />
      ) : (
        <View style={{ height: 1, backgroundColor: colors.border, marginTop: minimized ? 0 : Spacing.md, width: '100%' }} />
      )}
    </View>
  );
}
