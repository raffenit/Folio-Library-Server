import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

export function PWAInstallBanner() {
  const { installState, visible, install, dismiss } = usePWAInstall();

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Add to Home Screen</Text>
          {installState === 'ios' ? (
            <Text style={styles.subtitle}>
              Tap the Share button then "Add to Home Screen"
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Install Folio for offline access
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {installState === 'promptable' && (
            <TouchableOpacity style={styles.installBtn} onPress={install} activeOpacity={0.8}>
              <Text style={styles.installText}>Install</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} activeOpacity={0.7}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as any,
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    // Sit above any tab bar (tab bar is ~49px + safe area)
    paddingBottom: Spacing.xxl,
    pointerEvents: 'box-none' as any,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    // Web shadow
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      } as any,
    }),
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  installBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  installText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textOnAccent,
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
});
