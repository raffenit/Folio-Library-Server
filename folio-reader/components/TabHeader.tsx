import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';

interface TabHeaderProps {
  title?: string;
  count?: number;
  countLabel?: string;
  hasMore?: boolean;
  serverName?: string;
  libraries?: { id: string | number; name: string }[];
  selectedLibraryId?: string | number | null;
  onSelectLibrary?: (id: string | number) => void;
}

export default function TabHeader({ title, count, countLabel, hasMore, serverName, libraries, selectedLibraryId, onSelectLibrary }: TabHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={{
      backgroundColor: Platform.OS === 'web' ? 'rgba(5, 6, 15, 0.35)' : colors.background,
      paddingTop: 36,
      paddingBottom: Spacing.sm,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Platform.OS === 'web' ? 'transparent' : colors.border,
      backdropFilter: Platform.OS === 'web' ? 'blur(4px)' : undefined,
      WebkitBackdropFilter: Platform.OS === 'web' ? 'blur(4px)' : undefined,
    } as any}>
      {/* Subtle gradient underline */}
      {Platform.OS === 'web' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${colors.secondary}30 30%, ${colors.accent}40 50%, ${colors.secondary}30 70%, transparent 100%)`,
        }} />
      )}
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Logo + title + count inline */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image 
            source={require('../assets/folio-logo-custom.png')} 
            style={{ width: 24, height: 24 }} 
            resizeMode="contain" 
          />
          <Text style={{ 
            fontFamily: Platform.OS === 'web' ? '"Libre Baskerville", Baskerville, Georgia, serif' : (Platform.OS === 'ios' ? 'Baskerville' : 'Georgia'),
            fontSize: Typography.xl, 
            fontWeight: Typography.bold, 
            color: colors.textPrimary, 
            letterSpacing: 0.3,
          }}>
            Folio
          </Text>
          {title && (
            <>
              <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>/</Text>
              <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {title}
              </Text>
            </>
          )}
          {count !== undefined && count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginLeft: Spacing.sm }}>
              <Text style={{ fontSize: Typography.base, fontWeight: Typography.bold, color: colors.accent }}>
                {count}{hasMore ? '+' : ''}
              </Text>
              {countLabel && <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' }}>{countLabel}</Text>}
            </View>
          )}
        </View>

        {/* Right: Server indicator + settings */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          {serverName && (
            <Text style={{ fontSize: Typography.xs, color: colors.textMuted }}>{serverName}</Text>
          )}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={{ width: 28, height: 28, borderRadius: Radius.full, backgroundColor: Platform.OS === 'web' ? 'rgba(12, 14, 28, 0.4)' : colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' } as any}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Library picker - more compact */}
      {libraries && libraries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm, marginHorizontal: -Spacing.base }} contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.xs }}>
          {libraries.map(lib => {
            const isActive = selectedLibraryId === lib.id;
            return (
              <TouchableOpacity key={lib.id} onPress={() => onSelectLibrary?.(lib.id)} style={{ backgroundColor: isActive ? colors.accentSoft : 'transparent', borderWidth: 1, borderColor: isActive ? colors.accent : colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 } as any}>
                <Text style={{ color: isActive ? colors.accent : colors.textSecondary, fontWeight: isActive ? Typography.semibold : Typography.medium, fontSize: Typography.xs }}>{lib.name}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  );
}
