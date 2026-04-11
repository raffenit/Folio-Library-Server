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
      backgroundColor: colors.background,
      paddingTop: 48,
      paddingBottom: Spacing.md,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: Spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 2 }}>
            <Image 
              source={require('../assets/folio-logo-custom.png')} 
              style={{ width: 34, height: 34 }} 
              resizeMode="contain" 
            />
            <Text style={{ 
              fontFamily: Platform.OS === 'web' ? '"Libre Baskerville", Baskerville, Georgia, serif' : (Platform.OS === 'ios' ? 'Baskerville' : 'Georgia'),
              fontSize: Typography.xxxl, 
              fontWeight: Typography.bold, 
              color: colors.textPrimary, 
              letterSpacing: 0.5, 
              lineHeight: 32, // adjusted to tighten text at bottom 
              marginBottom: -2 // push text slightly down to match bottom edge of logo 
            }}>
              Folio Library
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {title ? (
              <Text style={{ fontSize: Typography.md, fontWeight: Typography.semibold, color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {title}
              </Text>
            ) : null}
            {serverName && (
              <>
                {title && <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>•</Text>}
                <Text style={{ fontSize: Typography.sm, color: colors.textMuted }}>Connected to {serverName}</Text>
              </>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          {count !== undefined && count > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.accent, lineHeight: 28 }}>
                {count}{hasMore ? '+' : ''}
              </Text>
              {countLabel && <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: -2, textTransform: 'uppercase' }}>{countLabel}</Text>}
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={{ width: 34, height: 34, borderRadius: Radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      {/* Dynamic libraries picker */}
      {libraries && libraries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.md, marginHorizontal: -Spacing.base }} contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}>
          {libraries.map(lib => {
            const isActive = selectedLibraryId === lib.id;
            return (
              <TouchableOpacity key={lib.id} onPress={() => onSelectLibrary?.(lib.id)} style={{ backgroundColor: isActive ? colors.accentSoft : colors.surface, borderWidth: 1, borderColor: isActive ? colors.accent : colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 }}>
                <Text style={{ color: isActive ? colors.accent : colors.textSecondary, fontWeight: isActive ? Typography.bold : Typography.medium, fontSize: Typography.sm }}>{lib.name}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  );
}
