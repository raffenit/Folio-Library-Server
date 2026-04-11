import { storage } from './storage';
import type { Profile } from '../contexts/ProfileContext';

const BACKUP_KEY = 'folio_profile_backup';
const BACKUP_TIMESTAMP_KEY = 'folio_profile_backup_timestamp';
const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface BackupData {
  profiles: Profile[];
  activeProfileId: string | null;
  version: string;
  exportedAt: number;
}

export async function exportProfiles(): Promise<string | null> {
  try {
    const profilesJson = await storage.getItem('folio_profiles_v1');
    const activeId = await storage.getItem('folio_active_profile_id');

    if (!profilesJson) return null;

    const backup: BackupData = {
      profiles: JSON.parse(profilesJson),
      activeProfileId: activeId,
      version: '1.0',
      exportedAt: Date.now(),
    };

    return JSON.stringify(backup, null, 2);
  } catch (err) {
    console.error('[Backup] Export failed:', err);
    return null;
  }
}

export async function importProfiles(backupJson: string): Promise<boolean> {
  try {
    const backup: BackupData = JSON.parse(backupJson);

    if (!backup.profiles || !Array.isArray(backup.profiles)) {
      throw new Error('Invalid backup format');
    }

    await storage.setItem('folio_profiles_v1', JSON.stringify(backup.profiles));
    if (backup.activeProfileId) {
      await storage.setItem('folio_active_profile_id', backup.activeProfileId);
    }

    return true;
  } catch (err) {
    console.error('[Backup] Import failed:', err);
    return false;
  }
}

export async function autoBackup(): Promise<void> {
  try {
    const lastBackup = await storage.getItem(BACKUP_TIMESTAMP_KEY);
    const now = Date.now();

    if (lastBackup && (now - parseInt(lastBackup)) < AUTO_BACKUP_INTERVAL) {
      return; // Not time yet
    }

    const profilesJson = await storage.getItem('folio_profiles_v1');
    const activeId = await storage.getItem('folio_active_profile_id');

    if (!profilesJson) return;

    const backup: BackupData = {
      profiles: JSON.parse(profilesJson),
      activeProfileId: activeId,
      version: '1.0',
      exportedAt: now,
    };

    await storage.setItem(BACKUP_KEY, JSON.stringify(backup));
    await storage.setItem(BACKUP_TIMESTAMP_KEY, now.toString());

    console.log('[Backup] Auto-backup saved at', new Date(now).toISOString());
  } catch (err) {
    console.error('[Backup] Auto-backup failed:', err);
  }
}

export async function getLastBackup(): Promise<BackupData | null> {
  try {
    const backupJson = await storage.getItem(BACKUP_KEY);
    if (!backupJson) return null;
    return JSON.parse(backupJson);
  } catch {
    return null;
  }
}

export async function restoreFromBackup(): Promise<boolean> {
  try {
    const backup = await getLastBackup();
    if (!backup) return false;

    await storage.setItem('folio_profiles_v1', JSON.stringify(backup.profiles));
    if (backup.activeProfileId) {
      await storage.setItem('folio_active_profile_id', backup.activeProfileId);
    }

    return true;
  } catch (err) {
    console.error('[Backup] Restore failed:', err);
    return false;
  }
}

export function downloadBackupFile(content: string, filename?: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `folio-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function loadBackupFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
