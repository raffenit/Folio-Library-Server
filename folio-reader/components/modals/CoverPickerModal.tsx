import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LibraryFactory } from '@/services/LibraryFactory';
import { SearchFactory } from '@/services/SearchFactory';
import { SearchMetadataResult } from '@/services/SearchProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from './modalStyles';

interface CoverPickerProps {
  visible: boolean;
  seriesId: string | number;
  seriesName: string;
  authorName: string;
  providerType: 'kavita' | 'abs';
  onClose: () => void;
  onSaved: () => void;
}

/** Strip ASCII and curly quote characters from a string. */
function stripQuotes(s: string): string {
  return s.replace(/["“”'‘’`]/g, '').trim();
}

export function CoverPickerModal({ 
  visible, 
  seriesId, 
  seriesName, 
  authorName, 
  providerType,
  onClose, 
  onSaved 
}: CoverPickerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Colors = colors;
  const [mode, setMode] = useState<'choose' | 'search'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMetadataResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const provider = LibraryFactory.getProvider(providerType);
  // Use audiobook-specific providers for ABS, all providers for Kavita
  const searchProviders = providerType === 'abs'
    ? SearchFactory.getAudiobookProviders()  // Audible + Google Books
    : SearchFactory.getAllProviders();        // Google Books + Open Library + Audible

  useEffect(() => {
    if (visible) {
      setMode('choose');
      setSearchQuery(stripQuotes(seriesName));
      setSearchResults([]);
      setError('');
    }
  }, [visible]);

  useEffect(() => {
    if (mode === 'search' && searchResults.length === 0 && !searching) {
      searchCovers();
    }
  }, [mode]);

  async function pickFromDevice() {
    try {
      // Request permission on mobile (may fail on web, which is fine)
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access media library is required.');
          return;
        }
      } catch (permError) {
        // Permission request may fail on web - continue anyway
      }

      // Launch image picker with different aspect ratios for ebooks vs audiobooks
      // Note: allowsEditing and aspect are only supported on native platforms
      const aspect: [number, number] = providerType === 'abs' ? [1, 1] : [2, 3];
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: Platform.OS !== 'web',
        aspect: Platform.OS !== 'web' ? aspect : undefined,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (asset.base64) {
        // Construct data URL from base64
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${asset.base64}`;
        await upload(dataUrl);
      } else if (asset.uri) {
        // Fall back to URI if base64 not available
        await upload(asset.uri);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to pick image');
    }
  }

  async function upload(urlOrBase64: string) {
    setUploading(true);
    setError('');
    try {
      await provider.updateSeriesCover(seriesId, urlOrBase64);
      // Wait longer for Kavita to process and save the cover file
      console.log('[CoverPicker] Upload complete, waiting for server processing...');
      await new Promise(r => setTimeout(r, 3000));
      console.log('[CoverPicker] Delay complete, notifying parent to refresh');
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function searchCovers(customQuery?: string) {
    const q = stripQuotes(customQuery ?? searchQuery);
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    setError('');
    try {
      // Search all providers in parallel with individual error handling
      const providerResults = await Promise.all(
        searchProviders.map(async (p) => {
          try {
            return await p.search(q, 6);
          } catch (e) {
            console.warn(`[CoverPicker] Provider ${p.getSourceId()} failed:`, e);
            return { results: [], warning: `${p.getSourceName()} unavailable` };
          }
        })
      );
      
      // Merge all results, filtering for items with covers
      const allResults = providerResults.flatMap(pr => pr.results).filter(r => r.coverUploadUrl);
      
      // Deduplicate by cover URL (same image from different sources)
      const seenUrls = new Set<string>();
      const uniqueResults = allResults.filter(r => {
        if (!r.coverUploadUrl) return false;
        const normalized = r.coverUploadUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (seenUrls.has(normalized)) return false;
        seenUrls.add(normalized);
        return true;
      });
      
      setSearchResults(uniqueResults);
      
      // Collect warnings but don't let them block results
      const warnings = providerResults.map(pr => pr.warning).filter(Boolean);
      if (uniqueResults.length === 0) {
        // No results at all - show error
        setError(warnings.length > 0 
          ? `No covers found. ${warnings.join('; ')}.` 
          : 'No covers found. Try a different search.'
        );
      } else if (warnings.length > 0) {
        // Got some results but some providers failed - show warning quietly
        console.log('[CoverPicker] Got results with warnings:', warnings);
      }
    } catch (e: any) {
      setError(`Search failed: ${e?.message ?? 'unknown error'}`);
    } finally {
      setSearching(false);
    }
  }

  // Note: pickFromDevice now uses expo-image-picker for cross-platform support

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Change Cover</Text>
          <View style={{ width: 40 }} />
        </View>

        {mode === 'choose' ? (
          <View style={styles.coverChooseContainer}>
            <TouchableOpacity style={styles.coverOptionBtn} onPress={pickFromDevice} disabled={uploading} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={28} color={Colors.accent} />
              <Text style={styles.coverOptionText}>Upload from device</Text>
              <Text style={styles.coverOptionSub}>Pick a local image file</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.coverOptionBtn} onPress={() => { setMode('search'); }} activeOpacity={0.8}>
              <Ionicons name="search-outline" size={28} color={Colors.accent} />
              <Text style={styles.coverOptionText}>Search online</Text>
              <Text style={styles.coverOptionSub}>Find covers from Google Books{providerType === 'abs' ? ', Audible' : ', Open Library, Audible'}</Text>
            </TouchableOpacity>
            {uploading && <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.lg }} />}
            {error ? <Text style={styles.coverError}>{error}</Text> : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInputFlex}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Book title / author…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={() => searchCovers()}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => searchCovers()} disabled={searching} activeOpacity={0.8}>
                {searching
                  ? <ActivityIndicator size="small" color={Colors.textOnAccent} />
                  : <Ionicons name="search" size={18} color={Colors.textOnAccent} />
                }
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.coverError}>{error}</Text> : null}
            <ScrollView contentContainerStyle={styles.coverGrid}>
              {searchResults.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.coverThumbWrap}
                  onPress={() => r.coverUploadUrl && upload(r.coverUploadUrl)}
                  disabled={uploading}
                  activeOpacity={0.75}
                >
                  {r.coverUrl ? (
                    <Image source={{ uri: r.coverUrl }} style={styles.coverThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.coverThumb, { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="book-outline" size={32} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.coverThumbTitle} numberOfLines={2}>{r.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.uploadingText}>Uploading cover…</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
