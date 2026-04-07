import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { kavitaAPI } from '../../services/kavitaAPI';
import { absAPI } from '../../services/audiobookshelfAPI';
import { Typography, Spacing, Radius, themes, themeLabels, fontLabels, fontPreviewFamily, selfHostedFonts, type ThemeName, type FontName, type ColorScheme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  loading?: boolean;
  statusText?: string;
  statusOk?: boolean;
}

function SettingRow({ icon, label, value, onPress, destructive, loading, statusText, statusOk }: SettingRowProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md, minHeight: 56 }}
      onPress={onPress}
      activeOpacity={onPress && !loading ? 0.7 : 1}
      disabled={!onPress || loading}
    >
      <View style={{
        width: 34, height: 34, borderRadius: Radius.sm,
        backgroundColor: destructive ? 'rgba(224,92,92,0.12)' : colors.accentSoft,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
      }}>
        <Ionicons name={icon as any} size={18} color={destructive ? colors.error : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: Typography.base, color: destructive ? colors.error : colors.textPrimary }}>{label}</Text>
        {statusText ? (
          <Text style={{ fontSize: Typography.xs, lineHeight: 16, color: statusOk ? colors.success : colors.error }}>
            {statusText}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : value ? (
        <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, maxWidth: 160, textAlign: 'right' }}>{value}</Text>
      ) : onPress && !destructive ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Kavita Configuration Modal ────────────────────────────────────────────────

function KavitaConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { login, logout, serverUrl } = useAuth();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrl(serverUrl);
      setKey('');
      setStatus('');
    }
  }, [visible, serverUrl]);

  async function handleSave() {
    if (!url.trim() || !key.trim()) {
      setStatus('Server URL and API key are required.');
      setStatusOk(false);
      return;
    }
    setTesting(true);
    setStatus('');
    const result = await login(url.trim(), key.trim());
    setTesting(false);
    if (result.success) {
      setStatusOk(true);
      setStatus('Connected successfully!');
      setTimeout(onClose, 800);
    } else {
      setStatusOk(false);
      setStatus(result.error ?? 'Connection failed.');
    }
  }

  function handleDisconnect() {
    Alert.alert(
      'Disconnect',
      'This will remove your server connection. You can reconnect at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => { logout(); onClose(); } },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.xl, paddingTop: Spacing.xxxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: 'Georgia' }}>Kavita Server</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>Server URL</Text>
          <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={url} onChangeText={setUrl} placeholder="192.168.1.100:8050 or http://..."
            placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>API Key</Text>
          <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={key} onChangeText={setKey} placeholder="Your Kavita API key"
            placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Found in Kavita → User Settings → Security</Text>
        </View>
        {status ? <Text style={{ fontSize: Typography.sm, marginBottom: Spacing.md, color: statusOk ? colors.success : colors.error }}>{status}</Text> : null}
        <TouchableOpacity style={{ backgroundColor: colors.accent, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.md, opacity: testing ? 0.6 : 1 }}
          onPress={handleSave} disabled={testing}>
          {testing ? <ActivityIndicator color={colors.textOnAccent} /> : <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textOnAccent }}>Save &amp; Test</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', padding: Spacing.md }} onPress={handleDisconnect}>
          <Text style={{ fontSize: Typography.base, color: colors.error }}>Disconnect Server</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── ABS Configuration Modal ───────────────────────────────────────────────────

function ABSConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrl(absAPI.getServerUrl());
      setKey(absAPI.getApiKey() || '');
      setStatus('');
    }
  }, [visible]);

  async function handleSave() {
    if (!url.trim() || !key.trim()) {
      setStatus('Server URL and API key are required.');
      setStatusOk(false);
      return;
    }
    setTesting(true);
    setStatus('');
    try {
      await absAPI.saveCredentials(url.trim(), key.trim());
      const ok = await absAPI.ping();
      if (ok) {
        setStatusOk(true);
        setStatus('Connected successfully!');
        setTimeout(onClose, 800);
      } else {
        setStatusOk(false);
        setStatus('Could not reach server — check URL and API key.');
      }
    } catch (e: any) {
      setStatusOk(false);
      setStatus(`Error: ${e?.message ?? 'unknown'}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleClear() {
    await absAPI.clearCredentials();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.xl, paddingTop: Spacing.xxxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: 'Georgia' }}>Audiobookshelf</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>Server URL</Text>
          <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={url} onChangeText={setUrl} placeholder="http://192.168.1.x:13378"
            placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>API Key</Text>
          <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={key} onChangeText={setKey} placeholder="Your ABS API token"
            placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Found in ABS → Settings → Users → your user → API Token</Text>
        </View>
        {status ? <Text style={{ fontSize: Typography.sm, marginBottom: Spacing.md, color: statusOk ? colors.success : colors.error }}>{status}</Text> : null}
        <TouchableOpacity style={{ backgroundColor: colors.accent, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.md, opacity: testing ? 0.6 : 1 }}
          onPress={handleSave} disabled={testing}>
          {testing ? <ActivityIndicator color={colors.textOnAccent} /> : <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textOnAccent }}>Save &amp; Test</Text>}
        </TouchableOpacity>
        {absAPI.hasCredentials() && (
          <TouchableOpacity style={{ alignItems: 'center', padding: Spacing.md }} onPress={handleClear}>
            <Text style={{ fontSize: Typography.base, color: colors.error }}>Disconnect Audiobookshelf</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Style factory (dynamic, responds to theme changes) ───────────────────────

// ── Main Settings Screen ──────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { serverUrl } = useAuth();
  const { themeName, fontName, setTheme, setFont, colors, customFonts, setCustomFont, addCustomFont, removeCustomFont, activeCustomFontId, customThemeColors, setCustomTheme } = useTheme();
  const [customBg, setCustomBg] = useState(customThemeColors.bg);
  const [customAccent, setCustomAccent] = useState(customThemeColors.accent);
  const [customBgFocused, setCustomBgFocused] = useState(false);
  const [customAccentFocused, setCustomAccentFocused] = useState(false);
  const styles = makeStyles(colors);
  const [kavitaModalVisible, setKavitaModalVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanOk, setScanOk] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [analyzeOk, setAnalyzeOk] = useState(false);
  const [absModalVisible, setAbsModalVisible] = useState(false);
  const [absConnected, setAbsConnected] = useState(false);

  useEffect(() => {
    absAPI.initialize().then(() => setAbsConnected(absAPI.hasCredentials()));
  }, []);

  async function handleScanAll() {
    setScanLoading(true);
    setScanStatus('');
    try {
      await kavitaAPI.scanAllLibraries();
      setScanOk(true);
      setScanStatus('Scan queued — Kavita is processing in the background.');
    } catch (e: any) {
      setScanOk(false);
      setScanStatus(`Scan failed: ${e?.response?.status ?? e?.message ?? 'unknown error'}`);
    } finally {
      setScanLoading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzeLoading(true);
    setAnalyzeStatus('');
    try {
      await kavitaAPI.analyzeFiles();
      setAnalyzeOk(true);
      setAnalyzeStatus('Analysis queued — Kavita will flag any issues it finds.');
    } catch (e: any) {
      setAnalyzeOk(false);
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        setAnalyzeStatus('Requires admin privileges on your Kavita account.');
      } else {
        setAnalyzeStatus(`Failed: ${status ?? e?.message ?? 'unknown error'}`);
      }
    } finally {
      setAnalyzeLoading(false);
    }
  }

  const displayUrl = serverUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Appearance section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>

          {/* Theme swatches */}
          <Text style={[styles.sectionNote, { marginBottom: Spacing.sm }]}>Color Theme</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg, flexWrap: 'wrap' }}>
            {(Object.keys(themes) as ThemeName[]).map(t => {
              const tc = themes[t];
              const selected = themeName === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTheme(t)}
                  activeOpacity={0.8}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{
                    width: 48, height: 48, borderRadius: Radius.md,
                    backgroundColor: tc.background,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? tc.accent : tc.border,
                    justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden',
                  }}>
                    {/* accent stripe */}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, backgroundColor: tc.accent, opacity: 0.85 }} />
                    <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: tc.surface, borderWidth: 1, borderColor: tc.borderLight }} />
                    {selected && (
                      <View style={{ position: 'absolute', top: 4, right: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: tc.accent, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="checkmark" size={8} color={tc.textOnAccent} />
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 10, color: selected ? colors.accent : colors.textMuted, fontWeight: selected ? Typography.semibold : Typography.regular }}>
                    {themeLabels[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom theme builder */}
          {themeName === 'custom' && (
            <View style={{ backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.base, marginBottom: Spacing.lg, gap: Spacing.md }}>
              <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary }}>Custom Colors</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginBottom: 4 }}>Background</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: customBg, borderWidth: 1, borderColor: colors.border }} />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: customBgFocused ? colors.accent : colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: Typography.sm, color: colors.textPrimary, fontFamily: 'monospace' }}
                      value={customBg}
                      onChangeText={setCustomBg}
                      placeholder="#0d0d12"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setCustomBgFocused(true)}
                      onBlur={() => setCustomBgFocused(false)}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginBottom: 4 }}>Accent</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: customAccent, borderWidth: 1, borderColor: colors.border }} />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: customAccentFocused ? colors.accent : colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: Typography.sm, color: colors.textPrimary, fontFamily: 'monospace' }}
                      value={customAccent}
                      onChangeText={setCustomAccent}
                      placeholder="#e8a838"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setCustomAccentFocused(true)}
                      onBlur={() => setCustomAccentFocused(false)}
                    />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' }}
                onPress={() => {
                  const bgValid = /^#[0-9a-fA-F]{6}$/.test(customBg);
                  const accentValid = /^#[0-9a-fA-F]{6}$/.test(customAccent);
                  if (!bgValid || !accentValid) {
                    Alert.alert('Invalid color', 'Colors must be 6-digit hex codes like #1a2b3c.');
                    return;
                  }
                  setCustomTheme(customBg, customAccent);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: colors.textOnAccent }}>Apply Custom Theme</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Font picker */}
          <Text style={[styles.sectionNote, { marginBottom: Spacing.sm }]}>Reading Font</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 4, paddingRight: 4 }}
            style={{ marginBottom: Spacing.sm }}
          >
            {(Object.keys(fontLabels) as FontName[]).map(f => {
              const isSelected = fontName === f && !activeCustomFontId;
              const needsFile = !!selfHostedFonts[f];
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFont(f)}
                  activeOpacity={0.8}
                  style={{
                    width: 80, alignItems: 'center', paddingVertical: Spacing.md,
                    paddingHorizontal: 4,
                    backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.accent : colors.border,
                    gap: 2,
                    opacity: needsFile ? 0.8 : 1,
                  }}
                >
                  <Text style={{ fontSize: 20, fontFamily: fontPreviewFamily[f], color: isSelected ? colors.accent : colors.textPrimary, lineHeight: 26 }}>
                    Aa
                  </Text>
                  <Text style={{ fontSize: 9, color: isSelected ? colors.accent : colors.textMuted, fontWeight: isSelected ? Typography.semibold : Typography.regular, textAlign: 'center' }}>
                    {fontLabels[f]}
                  </Text>
                  {needsFile && (
                    <Text style={{ fontSize: 8, color: colors.textMuted, textAlign: 'center' }}>needs file</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Custom uploaded fonts */}
            {customFonts.map(cf => {
              const isSelected = activeCustomFontId === cf.id;
              return (
                <TouchableOpacity
                  key={cf.id}
                  onPress={() => setCustomFont(cf.id)}
                  onLongPress={() => {
                    Alert.alert('Remove font', `Remove "${cf.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeCustomFont(cf.id) },
                    ]);
                  }}
                  delayLongPress={500}
                  activeOpacity={0.8}
                  style={{
                    width: 80, alignItems: 'center', paddingVertical: Spacing.md,
                    paddingHorizontal: 4,
                    backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.accent : colors.border,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 20, fontFamily: cf.name, color: isSelected ? colors.accent : colors.textPrimary, lineHeight: 26 }}>
                    Aa
                  </Text>
                  <Text style={{ fontSize: 9, color: isSelected ? colors.accent : colors.textMuted, fontWeight: isSelected ? Typography.semibold : Typography.regular, textAlign: 'center' }} numberOfLines={2}>
                    {cf.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Upload button */}
            <TouchableOpacity
              onPress={async () => {
                if (Platform.OS !== 'web') return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.otf,.ttf,.woff,.woff2';
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    Alert.alert('File too large', 'Font files must be under 5 MB.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const dataUrl = reader.result as string;
                    const name = file.name.replace(/\.[^.]+$/, '');
                    const font = await addCustomFont(name, dataUrl);
                    setCustomFont(font.id);
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
              activeOpacity={0.8}
              style={{
                width: 80, alignItems: 'center', justifyContent: 'center',
                paddingVertical: Spacing.md,
                backgroundColor: colors.surface,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
                gap: 4,
              }}
            >
              <Ionicons name="add" size={22} color={colors.textMuted} />
              <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center' }}>Upload{'\n'}.otf/.ttf</Text>
            </TouchableOpacity>
          </ScrollView>
          {activeCustomFontId && (
            <Text style={[styles.sectionNote, { color: colors.textMuted }]}>
              Long-press a custom font to remove it.
            </Text>
          )}
        </View>

        {/* Kavita section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kavita</Text>
          <View style={styles.card}>
            <SettingRow
              icon="server-outline"
              label="Kavita Server"
              value="Connected"
              onPress={() => setKavitaModalVisible(true)}
              statusText={displayUrl}
              statusOk
            />
          </View>
        </View>

        {/* File Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>File Health</Text>
          <Text style={styles.sectionNote}>
            Scanning re-reads all files and rebuilds metadata. Analysis checks for corrupted or
            unreadable content. Both run as background tasks on your Kavita server.
          </Text>
          <View style={styles.card}>
            <SettingRow
              icon="refresh-outline"
              label="Scan All Libraries"
              onPress={handleScanAll}
              loading={scanLoading}
              statusText={scanStatus}
              statusOk={scanOk}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="bug-outline"
              label="Analyze Files"
              onPress={handleAnalyze}
              loading={analyzeLoading}
              statusText={analyzeStatus}
              statusOk={analyzeOk}
            />
          </View>
        </View>

        {/* Audiobookshelf section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audiobookshelf</Text>
          <View style={styles.card}>
            <SettingRow
              icon="headset-outline"
              label="Audiobookshelf Server"
              value={absConnected ? 'Connected' : 'Not configured'}
              onPress={() => setAbsModalVisible(true)}
              statusText={absConnected ? absAPI.getServerUrl().replace(/^https?:\/\//, '') : undefined}
              statusOk={absConnected}
            />
          </View>
        </View>

        {/* About section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingRow
              icon="information-circle-outline"
              label="Folio"
              value="v1.1.2"
            />
            <View style={styles.divider} />
            <SettingRow
              icon="globe-outline"
              label="Kavita Project"
              value="kavitareader.com"
            />
          </View>
        </View>


        <Text style={styles.footer}>
          Folio is an unofficial client for self-hosted Kavita and Audiobookshelf servers.
        </Text>
      </ScrollView>

      <KavitaConfigModal
        visible={kavitaModalVisible}
        onClose={() => setKavitaModalVisible(false)}
      />

      <ABSConfigModal
        visible={absModalVisible}
        onClose={() => {
          setAbsModalVisible(false);
          setAbsConnected(absAPI.hasCredentials());
        }}
      />
    </>
  );
}

function makeStyles(colors: ColorScheme) {
  return {
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 60 },
    header: { paddingTop: 60, paddingHorizontal: Spacing.base, paddingBottom: Spacing.lg },
    title: { fontSize: Typography.xxl, fontWeight: Typography.bold as any, color: colors.textPrimary, fontFamily: Typography.serif },
    section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
    sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold as any, color: colors.textSecondary, textTransform: 'uppercase' as any, letterSpacing: 0.8, marginBottom: Spacing.sm },
    sectionNote: { fontSize: Typography.xs, color: colors.textMuted, lineHeight: 17, marginBottom: Spacing.sm },
    card: { backgroundColor: colors.surface, borderRadius: Radius.md, overflow: 'hidden' as any, borderWidth: 1, borderColor: colors.border },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: Spacing.base + 34 + Spacing.md },
    footer: { fontSize: Typography.xs, color: colors.textMuted, textAlign: 'center' as any, paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, lineHeight: 18 },
  };
}
