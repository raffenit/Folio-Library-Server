import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useRouter } from 'expo-router';
import { Typography, Spacing, Radius, ColorScheme } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { ProfileSelector } from '../../components/ProfileSelector';

const proxyUrl =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (window as any).__KAVITA_URL__ ?? null
    : null;

export default function LoginScreen() {
  const { colors, uiGlowEnabled, uiAnimationsEnabled } = useTheme();
  const styles = makeStyles(colors, uiGlowEnabled);
  const { login } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const [profileSelected, setProfileSelected] = useState(!!activeProfile);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [keyFocused, setKeyFocused] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!serverUrl.trim()) {
      setError('Please enter your server URL.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter your API key.');
      return;
    }
    setLoading(true);
    console.log('[Login] Attempting login to:', serverUrl.trim());
    const result = await login(serverUrl.trim(), apiKey.trim());
    console.log('[Login] Result:', result);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not connect to Kavita.');
    } else {
      router.replace('/(tabs)');
    }
  }

  // Show profile selector first if no profile selected
  if (!profileSelected && !profileLoading) {
    return (
      <ProfileSelector 
        onSelectProfile={(profile) => {
          console.log('[Login] Profile selected:', profile.name);
          setProfileSelected(true);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          
          {/* Show active profile */}
          {activeProfile && (
            <View style={styles.profileBadge}>
              <View style={[styles.profileDot, { backgroundColor: activeProfile.color }]} />
              <Text style={styles.profileName}>{activeProfile.name}</Text>
              <TouchableOpacity onPress={() => setProfileSelected(false)}>
                <Text style={styles.switchProfile}>Switch</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Form */}
        <Animated.View 
          style={styles.form}
          entering={uiAnimationsEnabled ? FadeInDown.delay(200).springify() : undefined}
        >
          {/* Use web form for proper password manager support */}
          {Platform.OS === 'web' ? (
            <form 
              onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
              style={{ width: '100%' }}
              autoComplete="on"
            >
              {/* Hidden fields for password manager compatibility */}
              <input 
                type="text" 
                name="username" 
                autoComplete="username"
                value={serverUrl} 
                onChange={(e) => setServerUrl(e.target.value)}
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
              />
              <input 
                type="password" 
                name="password"
                autoComplete="current-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
              />
              
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Server URL</Text>
                <TextInput
                  style={[styles.input, urlFocused && styles.inputFocused]}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="192.168.1.100:8050 or http://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="url"
                  editable={true}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  textContentType="username"
                />
                <Text style={styles.hint}>
                  {proxyUrl ? 'Routed via local proxy' : 'The URL of your self-hosted instance'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>API Key</Text>
                
                <View style={[styles.inputContainer, keyFocused && styles.inputFocused]}>
                  <TextInput
                    style={styles.inputInner}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="API Key / Access Token"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoCorrect={false}
                    spellCheck={false}
                    secureTextEntry={isPasswordHidden}
                    onFocus={() => setKeyFocused(true)}
                    onBlur={() => setKeyFocused(false)}
                    textContentType="password"
                  />
                  <TouchableOpacity 
                    style={styles.iconButton} 
                    onPress={() => setIsPasswordHidden(!isPasswordHidden)}
                  >
                    <Ionicons 
                      name={isPasswordHidden ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.hint}>Found in Kavita (Settings &gt; Security) or ABS (Users &gt; Config)</Text>
              </View>

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled, uiGlowEnabled && styles.glow]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.loginButtonText}>Connect to Server</Text>
                )}
              </TouchableOpacity>
            </form>
          ) : (
            /* Mobile: No form wrapper needed */
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Server URL</Text>
                <TextInput
                  style={[styles.input, urlFocused && styles.inputFocused]}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="192.168.1.100:8050 or http://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="url"
                  editable={true}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  textContentType="username"
                />
                <Text style={styles.hint}>
                  {proxyUrl ? 'Routed via local proxy' : 'The URL of your self-hosted instance'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>API Key</Text>
                
                <View style={[styles.inputContainer, keyFocused && styles.inputFocused]}>
                  <TextInput
                    style={styles.inputInner}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="API Key / Access Token"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoComplete="password"
                    autoCorrect={false}
                    spellCheck={false}
                    secureTextEntry={isPasswordHidden}
                    onFocus={() => setKeyFocused(true)}
                    onBlur={() => setKeyFocused(false)}
                    textContentType="password"
                  />
                  <TouchableOpacity 
                    style={styles.iconButton} 
                    onPress={() => setIsPasswordHidden(!isPasswordHidden)}
                  >
                    <Ionicons 
                      name={isPasswordHidden ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.hint}>Found in Kavita (Settings &gt; Security) or ABS (Users &gt; Config)</Text>
              </View>

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled, uiGlowEnabled && styles.glow]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.loginButtonText}>Connect to Server</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Footer */}
        <Animated.Text 
          style={styles.footer}
          entering={uiAnimationsEnabled ? FadeInUp.delay(300).springify() : undefined}
        >
          Folio connects directly to your self-hosted server.{'\n'}No data is stored externally.
        </Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorScheme, glowEnabled?: boolean) { return StyleSheet.create({
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

  logoMark: {
    fontSize: 36,
    fontWeight: Typography.bold,
    color: colors.textOnAccent,
    fontFamily: Typography.serif,
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
  form: {
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.base,
    fontSize: Typography.base,
    color: colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  inputInner: {
    flex: 1,
    padding: Spacing.base,
    fontSize: Typography.base,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  iconButton: {
    paddingRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(224, 92, 92, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sm,
    color: colors.error,
    lineHeight: 18,
  },
  inputReadonly: {
    opacity: 0.5,
  },
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowColor: colors.cardShadow || colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: colors.textOnAccent,
    letterSpacing: 0.4,
  },
  footer: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  profileDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  profileName: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchProfile: {
    fontSize: Typography.xs,
    color: colors.accent,
    marginLeft: Spacing.sm,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
});
}
