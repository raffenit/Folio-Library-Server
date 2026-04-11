import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';

export function PWAInstallBanner() {
  const { installState, visible, install, dismiss } = usePWAInstall();
  const { colors, uiGlowEnabled } = useTheme();

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <View style={styles.container}>
      <View style={[
        styles.banner, 
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        uiGlowEnabled && styles.glow
      ]}>
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Add to Home Screen</Text>
          {installState === 'ios' ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Tap the Share button then "Add to Home Screen"
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Install Folio for offline access
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {installState === 'promptable' && (
            <TouchableOpacity 
              style={[styles.installBtn, { backgroundColor: colors.accent }]} 
              onPress={install} 
              activeOpacity={0.8}
            >
              <Text style={[styles.installText, { color: colors.textOnAccent }]}>Install</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.dismissBtn, { backgroundColor: colors.surface }]} 
            onPress={dismiss} 
            activeOpacity={0.7}
          >
            <Text style={[styles.dismissText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  subtitle: {
    fontSize: Typography.sm,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  installBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  installText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: Typography.sm,
  },
  glow: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
});
