import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { kavitaAPI } from '../../services/kavitaAPI';
import { absAPI } from '../../services/audiobookshelfAPI';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
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
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress && !loading ? 0.7 : 1}
      disabled={!onPress || loading}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons name={icon as any} size={18} color={destructive ? Colors.error : Colors.accent} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {statusText ? (
          <Text style={[styles.statusText, statusOk ? styles.statusOk : styles.statusError]}>
            {statusText}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.accent} />
      ) : value ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : onPress && !destructive ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Kavita Configuration Modal ────────────────────────────────────────────────

function KavitaConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
      <View style={absStyles.sheet}>
        <View style={absStyles.sheetHeader}>
          <Text style={absStyles.sheetTitle}>Kavita Server</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={absStyles.field}>
          <Text style={absStyles.label}>Server URL</Text>
          <TextInput
            style={absStyles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="192.168.1.100:5000 or http://..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={absStyles.field}>
          <Text style={absStyles.label}>API Key</Text>
          <TextInput
            style={absStyles.input}
            value={key}
            onChangeText={setKey}
            placeholder="Your Kavita API key"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={absStyles.hint}>Found in Kavita → User Settings → Security</Text>
        </View>

        {status ? (
          <Text style={[absStyles.status, statusOk ? absStyles.statusOk : absStyles.statusErr]}>
            {status}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[absStyles.saveBtn, testing && absStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color={Colors.textOnAccent} />
          ) : (
            <Text style={absStyles.saveBtnText}>Save &amp; Test</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={absStyles.clearBtn} onPress={handleDisconnect}>
          <Text style={[absStyles.clearBtnText, { color: Colors.error }]}>Disconnect Server</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── ABS Configuration Modal ───────────────────────────────────────────────────

function ABSConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrl(absAPI.getServerUrl());
      setKey('');
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
      <View style={absStyles.sheet}>
        <View style={absStyles.sheetHeader}>
          <Text style={absStyles.sheetTitle}>Audiobookshelf</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={absStyles.field}>
          <Text style={absStyles.label}>Server URL</Text>
          <TextInput
            style={absStyles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.x:13378"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={absStyles.field}>
          <Text style={absStyles.label}>API Key</Text>
          <TextInput
            style={absStyles.input}
            value={key}
            onChangeText={setKey}
            placeholder="Your ABS API token"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={absStyles.hint}>Found in ABS → Settings → Users → your user → API Token</Text>
        </View>

        {status ? (
          <Text style={[absStyles.status, statusOk ? absStyles.statusOk : absStyles.statusErr]}>
            {status}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[absStyles.saveBtn, testing && absStyles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color={Colors.textOnAccent} />
          ) : (
            <Text style={absStyles.saveBtnText}>Save &amp; Test</Text>
          )}
        </TouchableOpacity>

        {absAPI.hasCredentials() && (
          <TouchableOpacity style={absStyles.clearBtn} onPress={handleClear}>
            <Text style={absStyles.clearBtnText}>Disconnect Audiobookshelf</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const absStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  sheetTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
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
  hint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  status: {
    fontSize: Typography.sm,
    marginBottom: Spacing.md,
  },
  statusOk: { color: Colors.success },
  statusErr: { color: Colors.error },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textOnAccent,
  },
  clearBtn: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  clearBtnText: {
    fontSize: Typography.base,
    color: Colors.error,
  },
});

// ── Main Settings Screen ──────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { serverUrl } = useAuth();
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
              label="Kavita Reader"
              value="v1.0.0"
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
          Kavita Reader is an unofficial client for self-hosted Kavita servers.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 60,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
  },
  section: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  sectionNote: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
    minHeight: 56,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowIconDestructive: {
    backgroundColor: 'rgba(224,92,92,0.12)',
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  rowLabelDestructive: {
    color: Colors.error,
  },
  rowValue: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    maxWidth: 160,
    textAlign: 'right',
  },
  statusText: {
    fontSize: Typography.xs,
    lineHeight: 16,
  },
  statusOk: {
    color: Colors.success,
  },
  statusError: {
    color: Colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 34 + Spacing.md,
  },
  footer: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
});
