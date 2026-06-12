import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfile } from '../../contexts/ProfileContext';
import { ProfileSelector } from '../../components/ProfileSelector';
import { Typography, Spacing, Radius, type ColorScheme } from '../../constants/theme';

export default function LoginScreen() {
  const { colors, uiGlowEnabled, uiAnimationsEnabled } = useTheme();
  const styles = makeStyles(colors);
  const { activeProfile, loading: profileLoading } = useProfile();
  const router = useRouter();

  // Show profile selector with logo header
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <Animated.View 
        style={styles.header}
        entering={uiAnimationsEnabled ? FadeInDown.delay(100).springify() : undefined}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/folio-logo-custom.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
        </View>
        <Text style={styles.appName}>Folio</Text>
        <Text style={styles.tagline}>Your Library. Open Source, Self Hosted.</Text>
      </Animated.View>

      {/* Profile Selector */}
      <Animated.View 
        style={styles.selectorContainer}
        entering={uiAnimationsEnabled ? FadeInDown.delay(200).springify() : undefined}
      >
        {!profileLoading && (
          <ProfileSelector 
            onSelectProfile={(profile) => {
              console.log('[Login] Profile selected:', profile?.id, profile?.name);
              console.log('[Login] Navigating to /(tabs)');
              try {
                router.replace('/(tabs)');
                console.log('[Login] Navigation called successfully');
              } catch (err) {
                console.error('[Login] Navigation failed:', err);
              }
            }}
          />
        )}
      </Animated.View>

      {/* Footer */}
      <Animated.View 
        style={styles.footerContainer}
        entering={uiAnimationsEnabled ? FadeInUp.delay(300).springify() : undefined}
      >
        <Text style={styles.footerText}>
          Configure your servers in Settings after login.{'\n'}No data is stored externally.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function makeStyles(colors: ColorScheme) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'web' ? '"Bookerly", Georgia, serif' : 'Georgia',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: Typography.base,
    color: colors.textSecondary,
    marginTop: Spacing.xs,
    letterSpacing: 0.3,
  },
  selectorContainer: {
    marginVertical: Spacing.lg,
  },
  footerContainer: {
    marginTop: Spacing.lg,
    backgroundColor: Platform.OS === 'web' ? 'rgba(20, 23, 40, 0.4)' : colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px) saturate(120%)',
      WebkitBackdropFilter: 'blur(8px) saturate(120%)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
    } : {}),
  } as any,
  footerText: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
}
