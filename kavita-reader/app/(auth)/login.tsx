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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

const proxyUrl =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (window as any).__KAVITA_URL__ ?? null
    : null;

export default function LoginScreen() {
  const { login } = useAuth();
  const [serverUrl, setServerUrl] = useState(proxyUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [keyFocused, setKeyFocused] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!proxyUrl && !serverUrl.trim()) {
      setError('Please enter your server URL.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter your API key.');
      return;
    }
    setLoading(true);
    const result = await login(serverUrl.trim(), apiKey.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not connect to Kavita.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoMark}>K</Text>
          </View>
          <Text style={styles.appName}>Kavita Reader</Text>
          <Text style={styles.tagline}>Your library, everywhere.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={[styles.input, urlFocused && styles.inputFocused, proxyUrl && styles.inputReadonly]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="192.168.1.100:5000 or http://..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!proxyUrl}
              onFocus={() => setUrlFocused(true)}
              onBlur={() => setUrlFocused(false)}
            />
            <Text style={styles.hint}>
              {proxyUrl ? 'Routed via local proxy' : 'The URL of your self-hosted Kavita instance'}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>API Key</Text>
            <TextInput
              style={[styles.input, keyFocused && styles.inputFocused]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Your Kavita API key"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              onFocus={() => setKeyFocused(true)}
              onBlur={() => setKeyFocused(false)}
            />
            <Text style={styles.hint}>Found in Kavita → User Settings → Security</Text>
          </View>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textOnAccent} />
            ) : (
              <Text style={styles.loginButtonText}>Connect to Kavita</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Kavita Reader connects directly to your self-hosted server.{'\n'}No data is stored externally.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logoMark: {
    fontSize: 36,
    fontWeight: Typography.bold,
    color: Colors.textOnAccent,
    fontFamily: Typography.serif,
  },
  appName: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    letterSpacing: 0.3,
  },
  form: {
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.base,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(224, 92, 92, 0.12)',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sm,
    color: Colors.error,
    lineHeight: 18,
  },
  inputReadonly: {
    opacity: 0.5,
  },
  loginButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowColor: Colors.accent,
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
    color: Colors.textOnAccent,
    letterSpacing: 0.4,
  },
  footer: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxxl,
    lineHeight: 18,
  },
});
