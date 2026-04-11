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
  Switch,
  Image,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfile, Profile } from '../../contexts/ProfileContext';
import { kavitaAPI } from '../../services/kavitaAPI';
import { absAPI } from '../../services/audiobookshelfAPI';
import { Typography, Spacing, Radius, themes, themeLabels, fontLabels, fontPreviewFamily, selfHostedFonts, type ThemeName, type FontName, type ColorScheme } from '../../constants/theme';
import { STORAGE_KEYS } from '../../constants/config';
import { storage } from '../../services/storage';
import { exportProfiles, importProfiles, downloadBackupFile, loadBackupFile } from '../../services/backup';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import TabHeader from '../../components/TabHeader';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  loading?: boolean;
  statusText?: string;
  statusOk?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
}

function SettingRow({ icon, label, value, onPress, destructive, loading, statusText, statusOk, isSwitch, switchValue, onSwitchChange }: SettingRowProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md, minHeight: 56 }}
      onPress={isSwitch ? () => onSwitchChange && onSwitchChange(!switchValue) : onPress}
      activeOpacity={(!isSwitch && onPress && !loading) ? 0.7 : 1}
      disabled={(!isSwitch && !onPress) || loading}
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
      ) : isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
          thumbColor={Platform.OS === 'ios' ? '#ffffff' : switchValue ? '#ffffff' : colors.textMuted}
        />
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
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrl(kavitaAPI.getServerUrl());
      setKey(kavitaAPI.getApiKey() || '');
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
      await kavitaAPI.saveCredentials(url.trim(), key.trim());
      // Test the connection by fetching libraries (like ABS does)
      const libraries = await kavitaAPI.getLibraries();
      setStatusOk(true);
      setStatus(`Connected! Found ${libraries.length} librar${libraries.length === 1 ? 'y' : 'ies'}.`);
      setTimeout(onClose, 800);
    } catch (e: any) {
      setStatusOk(false);
      setStatus(`Could not reach server — check URL and API key.`);
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert(
      'Disconnect',
      'This will remove your server connection. You can reconnect at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => { await kavitaAPI.logout(); onClose(); } },
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
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={url}
            onChangeText={setUrl}
            placeholder="192.168.1.100:8050 or http://..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>API Key</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={key}
            onChangeText={setKey}
            placeholder="Your Kavita API key"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Found in Kavita → User Settings → Security</Text>
        </View>
        {status ? <Text style={{ fontSize: Typography.sm, marginBottom: Spacing.md, color: statusOk ? colors.success : colors.error }}>{status}</Text> : null}
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.md, opacity: testing ? 0.6 : 1 }}
          onPress={handleSave}
          disabled={testing}
        >
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
      // Use getLibraries() instead of ping() — ping() bypasses the proxy and hits
      // the server directly, causing CORS failures on web. getLibraries() goes
      // through /proxy?url= and also verifies the server is actually ABS.
      const libraries = await absAPI.getLibraries();
      setStatusOk(true);
      setStatus(`Connected! Found ${libraries.length} librar${libraries.length === 1 ? 'y' : 'ies'}.`);
      setTimeout(onClose, 800);
    } catch (e: any) {
      setStatusOk(false);
      setStatus(`Could not reach server — check URL and API key.`);
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
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary, fontFamily: 'Georgia' }}>AudioBookShelf</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>Server URL</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.x:13378"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>API Key</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={key}
            onChangeText={setKey}
            placeholder="Your AudioBookShelf API token"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 4 }}>Found in AudioBookShelf → Settings → Users → your user → API Token</Text>
        </View>
        {status ? <Text style={{ fontSize: Typography.sm, marginBottom: Spacing.md, color: statusOk ? colors.success : colors.error }}>{status}</Text> : null}
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.md, opacity: testing ? 0.6 : 1 }}
          onPress={handleSave}
          disabled={testing}
        >
          {testing ? <ActivityIndicator color={colors.textOnAccent} /> : <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textOnAccent }}>Save &amp; Test</Text>}
        </TouchableOpacity>
        {absAPI.hasCredentials() && (
          <TouchableOpacity style={{ alignItems: 'center', padding: Spacing.md }} onPress={handleClear}>
            <Text style={{ fontSize: Typography.base, color: colors.error }}>Disconnect AudioBookShelf</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Google Books Configuration Modal ─────────────────────────────────────────

function GoogleBooksConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [key, setKey] = useState('');

  useEffect(() => {
    if (visible) {
      storage.getItem(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY).then(val => setKey(val || ''));
    }
  }, [visible]);

  async function handleSave() {
    await storage.setItem(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY, key.trim());
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.xl, paddingTop: Spacing.xxxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.bold, color: colors.textPrimary }}>Google Books API</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs }}>API Key</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: colors.textPrimary }}
            value={key}
            onChangeText={setKey}
            placeholder="Your Google Books API key"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted, marginTop: 8, lineHeight: 16 }}>
            Optional, but recommended to avoid "Too Many Requests" errors. Obtain a free key from the Google Cloud Console.
          </Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center' }}
          onPress={handleSave}
        >
          <Text style={{ fontSize: Typography.md, fontWeight: Typography.bold, color: colors.textOnAccent }}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Cloud Sync Section Component ────────────────────────────────────────────

function CloudSyncSection() {
  const { colors } = useTheme();
  const { syncServerUrl, syncApiKey, setSyncCredentials, syncProfiles, lastSyncTime } = useProfile();
  const [modalVisible, setModalVisible] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const styles = makeStyles(colors);

  const isConfigured = !!syncServerUrl && !!syncApiKey;

  const handleSave = async () => {
    if (!serverUrl.trim() || !apiKey.trim()) return;
    await setSyncCredentials(serverUrl.trim(), apiKey.trim());
    setModalVisible(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncProfiles();
    setSyncing(false);
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const minutes = Math.floor((Date.now() - lastSyncTime) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Cloud Sync</Text>
      <Text style={styles.sectionNote}>
        Sync profiles across devices using your deploy server.
      </Text>
      <View style={styles.card}>
        <SettingRow
          icon="cloud-outline"
          label="Profile Sync"
          value={isConfigured ? 'Configured' : 'Not Set'}
          statusText={isConfigured ? `Last sync: ${formatLastSync()}` : undefined}
          statusOk={isConfigured}
          onPress={() => {
            if (!isConfigured) {
              setServerUrl('');
              setApiKey('');
            } else {
              setServerUrl(syncServerUrl || '');
              setApiKey(syncApiKey || '');
            }
            setModalVisible(true);
          }}
        />
        {isConfigured && (
          <>
            <View style={styles.divider} />
            <SettingRow
              icon="sync-outline"
              label="Sync Now"
              value={syncing ? 'Syncing...' : 'Upload profiles'}
              onPress={handleSync}
              loading={syncing}
            />
          </>
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.xl,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: Radius.lg,
            padding: Spacing.xl,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{ fontSize: Typography.lg, fontWeight: Typography.bold, color: colors.textPrimary, marginBottom: Spacing.md }}>
              Cloud Sync Settings
            </Text>
            
            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.sm }}>
              Server URL
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: Radius.md,
                padding: Spacing.base,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.md,
              }}
              placeholder="http://your-server:9000"
              placeholderTextColor={colors.textMuted}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{ fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.sm }}>
              API Key
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: Radius.md,
                padding: Spacing.base,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.lg,
              }}
              placeholder="Your secret key"
              placeholderTextColor={colors.textMuted}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: Radius.md,
                  padding: Spacing.base,
                  alignItems: 'center',
                }}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: colors.textPrimary, fontSize: Typography.base }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: Radius.md,
                  padding: Spacing.base,
                  alignItems: 'center',
                }}
                onPress={handleSave}
              >
                <Text style={{ color: colors.textOnAccent, fontSize: Typography.base, fontWeight: Typography.bold }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Server Card Component ───────────────────────────────────────────────────

function ServerCard({
  name,
  icon,
  url,
  isActive,
  isConnected,
  onEdit,
  onSync,
  onDisconnect
}: {
  name: string;
  icon: any;
  url?: string;
  isActive: boolean;
  isConnected: boolean;
  onEdit: () => void;
  onSync?: () => void;
  onDisconnect: () => void;
}) {
  const { colors } = useTheme();
  
  return (
    <View style={[
      { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
      isActive && { borderColor: colors.accent, backgroundColor: colors.surfaceElevated }
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isActive ? colors.accent + '20' : colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={icon} size={20} color={isActive ? colors.accent : colors.textPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isConnected ? colors.success : colors.textMuted }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{name}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {isConnected ? (url || 'Connected') : 'Not Connected'}
          </Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, justifyContent: 'flex-end', gap: 16 }}>
        {isConnected && onSync && (
          <TouchableOpacity onPress={onSync} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="sync" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Sync</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="pencil" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Edit</Text>
        </TouchableOpacity>
        {isConnected && (
          <TouchableOpacity onPress={onDisconnect} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={{ fontSize: 13, color: colors.error }}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ProfileSection() {
  const { colors } = useTheme();
  const { activeProfile, profiles, selectProfile, hasLegacyData, migrateLegacyData, loading } = useProfile();
  const { logout } = useAuth();
  const router = useRouter();
  const styles = makeStyles(colors);

  const handleSwitchProfile = async () => {
    await logout();
    await selectProfile(null);
    router.replace('/(auth)/login');
  };

  const handleMigrate = async () => {
    const profile = await migrateLegacyData();
    await selectProfile(profile.id);
  };

  // Show current profile with switch button only
  return (
    <View style={[styles.section, { marginBottom: Spacing.md }]}>
      <Text style={styles.sectionTitle}>Profile</Text>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: Radius.md,
          backgroundColor: activeProfile ? activeProfile.color : colors.surfaceElevated,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {activeProfile && activeProfile.avatar ? (
            <Image source={{ uri: activeProfile.avatar }} style={{ width: 40, height: 40 }} />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
              {activeProfile ? activeProfile.name.charAt(0).toUpperCase() : '?'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={{ fontSize: Typography.md, fontWeight: '600', color: colors.textPrimary }}>
            {activeProfile ? activeProfile.name : 'No Profile Selected'}
          </Text>
          <Text style={{ fontSize: Typography.xs, color: colors.textMuted }}>
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''} available
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSwitchProfile}
          style={{
            backgroundColor: colors.accentSoft,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: Radius.md,
          }}
        >
          <Text style={{ fontSize: Typography.sm, color: colors.accent, fontWeight: '600' }}>
            Switch
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Settings Screen ──────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { serverUrl, serverType, logout } = useAuth();
  const { themeName, fontName, setTheme, setFont, colors, customFonts, setCustomFont, addCustomFont, removeCustomFont, activeCustomFontId, customThemeColors, setCustomTheme, uiGlowEnabled, uiAnimationsEnabled, setUiEffects } = useTheme();
  const [customBg, setCustomBg] = useState(customThemeColors.bg);
  const [customAccent, setCustomAccent] = useState(customThemeColors.accent);
  const [customBgFocused, setCustomBgFocused] = useState(false);
  const [customAccentFocused, setCustomAccentFocused] = useState(false);
  const styles = makeStyles(colors);
  const [kavitaModalVisible, setKavitaModalVisible] = useState(false);
  const [kavitaUrl, setKavitaUrl] = useState(kavitaAPI.getServerUrl());
  const [scanLoading, setScanLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanOk, setScanOk] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [analyzeOk, setAnalyzeOk] = useState(false);
  const [absModalVisible, setAbsModalVisible] = useState(false);
  const [absConnected, setAbsConnected] = useState(false);
  const [absScanLoading, setAbsScanLoading] = useState(false);
  const [absScanStatus, setAbsScanStatus] = useState('');
  const [absScanOk, setAbsScanOk] = useState(false);
  const [gbModalVisible, setGbModalVisible] = useState(false);
  const [gbHasKey, setGbHasKey] = useState(false);

  useEffect(() => {
    absAPI.initialize().then(() => setAbsConnected(absAPI.hasCredentials()));
    storage.getItem(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY).then(val => setGbHasKey(!!val));
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

  async function handleAbsScanAll() {
    setAbsScanLoading(true);
    setAbsScanStatus('');
    try {
      await absAPI.scanAllLibraries();
      setAbsScanOk(true);
      setAbsScanStatus('Scan queued — ABS is scanning libraries.');
    } catch (e: any) {
      setAbsScanOk(false);
      setAbsScanStatus(`Scan failed: ${e?.response?.status ?? e?.message ?? 'unknown error'}`);
    } finally {
      setAbsScanLoading(false);
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title="Settings" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Section - Near Top */}
        <ProfileSection />

        {/* Servers section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servers</Text>

          <ServerCard
            name="Kavita"
            icon="book"
            url={kavitaUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            isActive={serverType === 'kavita'}
            isConnected={kavitaAPI.hasCredentials()}
            onEdit={() => setKavitaModalVisible(true)}
            onSync={serverType === 'kavita' ? handleScanAll : undefined}
            onDisconnect={logout}
          />
          
          <ServerCard
            name="AudioBookShelf"
            icon="headset"
            url={absConnected ? absAPI.getServerUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined}
            isActive={serverType === 'abs'}
            isConnected={absConnected}
            onEdit={() => setAbsModalVisible(true)}
            onDisconnect={async () => {
              await absAPI.clearCredentials();
              setAbsConnected(false);
              if (serverType === 'abs') {
                logout();
              }
            }}
          />
        </View>

        {/* External Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>External Services</Text>
          <View style={styles.card}>
            <SettingRow
              icon="search-outline"
              label="Google Books Search"
              value={gbHasKey ? 'Key Configured' : 'No Key'}
              onPress={() => setGbModalVisible(true)}
            />
          </View>
        </View>

        {/* Cloud Sync */}
        <CloudSyncSection />

        {/* File Health */}
        {serverType === 'kavita' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kavita File Health</Text>
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
        )}

        {serverType === 'abs' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AudioBookShelf File Health</Text>
            <Text style={styles.sectionNote}>
              Queue a background task to rebuild directory structures and update audio file metadata directly on the ABS server.
            </Text>
            <View style={styles.card}>
              <SettingRow
                icon="refresh-outline"
                label="Scan All Libraries"
                onPress={handleAbsScanAll}
                loading={absScanLoading}
                statusText={absScanStatus}
                statusOk={absScanOk}
              />
            </View>
          </View>
        )}

        {/* Visual Effects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visual Effects</Text>
          <Text style={styles.sectionNote}>
            Enhance the interface with glowing shadows and fluid animations.
          </Text>
          <View style={styles.card}>
            <SettingRow
              icon="color-wand-outline"
              label="Glow Effects"
              isSwitch
              switchValue={uiGlowEnabled}
              onSwitchChange={(val) => setUiEffects(val, uiAnimationsEnabled)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="sparkles-outline"
              label="Smooth Animations"
              isSwitch
              switchValue={uiAnimationsEnabled}
              onSwitchChange={(val) => setUiEffects(uiGlowEnabled, val)}
            />
          </View>
        </View>

        {/* Appearance Settings */}
        <View style={styles.section}>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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

        {/* Backup section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup</Text>
          <View style={styles.card}>
            <SettingRow
              icon="download-outline"
              label="Export Profiles"
              value="Download backup file"
              onPress={async () => {
                const backup = await exportProfiles();
                if (backup) {
                  downloadBackupFile(backup);
                  Alert.alert('Success', 'Backup file downloaded');
                } else {
                  Alert.alert('Error', 'No profiles to export');
                }
              }}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="upload-outline"
              label="Import Profiles"
              value="Restore from backup"
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Alert.alert('Not supported', 'Import is only available on web');
                  return;
                }
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const content = await loadBackupFile(file);
                  if (!content) {
                    Alert.alert('Error', 'Failed to read file');
                    return;
                  }
                  Alert.alert(
                    'Confirm Import',
                    'This will replace all existing profiles. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Import',
                        style: 'destructive',
                        onPress: async () => {
                          const success = await importProfiles(content);
                          if (success) {
                            Alert.alert('Success', 'Profiles imported. Please restart the app.');
                          } else {
                            Alert.alert('Error', 'Invalid backup file');
                          }
                        }
                      }
                    ]
                  );
                };
                input.click();
              }}
            />
          </View>
          <Text style={[styles.sectionNote, { marginTop: Spacing.sm }]}>
            Auto-backup runs every 24 hours. Export to save a portable backup file.
          </Text>
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
          </View>
        </View>

        <Text style={styles.footer}>
          Folio is an unofficial client for self-hosted Kavita and Audiobookshelf servers.
        </Text>
      </ScrollView>

      <KavitaConfigModal
        visible={kavitaModalVisible}
        onClose={() => {
          setKavitaModalVisible(false);
          setKavitaUrl(kavitaAPI.getServerUrl());
        }}
      />

      <ABSConfigModal
        visible={absModalVisible}
        onClose={() => {
          setAbsModalVisible(false);
          setAbsConnected(absAPI.hasCredentials());
        }}
      />

      <GoogleBooksConfigModal
        visible={gbModalVisible}
        onClose={() => {
          setGbModalVisible(false);
          storage.getItem(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY).then(val => setGbHasKey(!!val));
        }}
      />
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return {
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 60 },
    section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
    sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold as any, color: colors.textSecondary, textTransform: 'uppercase' as any, letterSpacing: 0.8, marginBottom: Spacing.sm },
    sectionNote: { fontSize: Typography.xs, color: colors.textMuted, lineHeight: 17, marginBottom: Spacing.sm },
    card: { backgroundColor: colors.surface, borderRadius: Radius.md, overflow: 'hidden' as any, borderWidth: 1, borderColor: colors.border },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: Spacing.base + 34 + Spacing.md },
    footer: { fontSize: Typography.xs, color: colors.textMuted, textAlign: 'center' as any, paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, lineHeight: 18 },
  };
}
