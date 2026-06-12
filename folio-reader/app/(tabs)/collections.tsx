import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LibraryFactory } from '../../services/LibraryFactory';
import { LibraryCollection, LibraryItem } from '../../services/LibraryProvider';
import { SeriesCard } from '../../components/SeriesCard';
import { useGridColumns } from '../../hooks/useGridColumns';
import SeriesContextMenu from '../../components/SeriesContextMenu';
import { useSeriesContextMenu } from '../../hooks/useSeriesContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CollectionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { serverType } = useAuth();
  const { numColumns, cardWidth } = useGridColumns();
  const { ctx: ctxMenu, openMenu, closeMenu, openDetail } = useSeriesContextMenu();
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [selected, setSelected] = useState<LibraryCollection | null>(null);
  const [series, setSeries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const data = await provider.getCollections();
      setCollections(data);
      if (data.length > 0) {
        await loadSeriesForCollection(data[0], 0);
        setSelected(data[0]);
      }
    } catch (e) {
      console.error('Failed to fetch collections', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverType]);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function loadSeriesForCollection(col: LibraryCollection, pageNum: number) {
    setSeriesLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      const items = await provider.getSeriesInCollection(col.id);
      
      const fullItems = await Promise.all(items.map(item => provider.getSeriesDetail(item.id)));
      
      const mappedItems: LibraryItem[] = fullItems.map(d => ({
        id: d.id,
        title: d.name,
        coverImage: d.coverImage,
        mediaType: d.mediaType,
        author: d.authorName,
        provider: serverType === 'abs' ? 'abs' : 'kavita'
      }));

      if (pageNum === 0) {
        setSeries(mappedItems);
      } else {
        setSeries(prev => [...prev, ...mappedItems]);
      }
      setHasMore(false);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load collection series', e);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function selectCollection(col: LibraryCollection) {
    setSelected(col);
    setSeries([]);
    setPage(0);
    setHasMore(true);
    await loadSeriesForCollection(col, 0);
  }

  function loadMore() {
    if (hasMore && !seriesLoading && selected) {
      loadSeriesForCollection(selected, page + 1);
    }
  }

  const handleOpenMenu = (id: string | number, name: string, x: number, y: number) => {
    openMenu(id, name, x, y);
  };

  // Multi-select handlers
  const toggleSelection = (id: string | number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(series.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    clearSelection();
  };

  const handleRemoveFromCollection = async () => {
    if (!selected || selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      // Remove all selected series from current collection
      await Promise.all(
        Array.from(selectedIds).map(id => 
          provider.removeSeriesFromCollection(selected.id, id)
        )
      );
      // Refresh the series list
      await loadSeriesForCollection(selected, 0);
      clearSelection();
    } catch (e) {
      console.error('Failed to remove from collection:', e);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleMoveToCollection = async (targetCollectionId: number | string) => {
    if (!selected || selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
      // Add to new collection
      await Promise.all(
        Array.from(selectedIds).map(id => 
          provider.addSeriesToCollection(targetCollectionId, id)
        )
      );
      // Remove from current collection
      await Promise.all(
        Array.from(selectedIds).map(id => 
          provider.removeSeriesFromCollection(selected.id, id)
        )
      );
      // Refresh
      await loadSeriesForCollection(selected, 0);
      clearSelection();
      setShowMoveModal(false);
    } catch (e) {
      console.error('Failed to move to collection:', e);
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (collections.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Collections</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="albums-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Collections</Text>
          <Text style={styles.emptyText}>
            Create collections in Kavita to group your series here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.screenHeader}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Collections</Text>
          {series.length > 0 && (
            <TouchableOpacity
              style={[styles.selectButton, isSelectionMode && styles.selectButtonActive]}
              onPress={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
            >
              <Ionicons 
                name={isSelectionMode ? "close-outline" : "checkmark-circle-outline"} 
                size={20} 
                color={isSelectionMode ? Colors.textPrimary : Colors.accent} 
              />
              <Text style={[styles.selectButtonText, isSelectionMode && styles.selectButtonTextActive]}>
                {isSelectionMode ? 'Done' : 'Select'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {isSelectionMode && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionCount}>
              {selectedIds.size} selected
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity onPress={selectAll} style={styles.selectionAction}>
                <Text style={styles.selectionActionText}>Select All</Text>
              </TouchableOpacity>
              {selectedIds.size > 0 && (
                <TouchableOpacity onPress={clearSelection} style={styles.selectionAction}>
                  <Text style={styles.selectionActionText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Collection pills */}
      <FlatList
        horizontal
        data={collections}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillList}
        renderItem={({ item }) => {
          const active = selected?.id === item.id;
          const provider = LibraryFactory.getProvider(serverType === 'abs' ? 'abs' : 'kavita');
          const coverUrl = provider.getCoverUrl(item.id);
          return (
            <TouchableOpacity
              style={[styles.collectionPill, active && styles.collectionPillActive]}
              onPress={() => selectCollection(item)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: coverUrl }}
                style={styles.pillCover}
                resizeMode="cover"
              />
              <View style={[styles.pillOverlay, active && styles.pillOverlayActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Series grid for selected collection */}
      <FlatList
        key={numColumns}
        data={series}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCollections();
            }}
            tintColor={Colors.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          selected ? (
            <Text style={styles.collectionLabel}>{selected.title}</Text>
          ) : null
        }
        ListFooterComponent={
          seriesLoading ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !seriesLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No series in this collection.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <SeriesCard
              series={{
                ...item,
                id: item.id,
                title: item.title,
              }}
              onPress={() => {
                if (isSelectionMode) {
                  toggleSelection(item.id);
                } else {
                  router.push(serverType === 'abs' ? `/audiobook/${item.id}` : `/series/${item.id}`);
                }
              }}
              onContextMenu={!isSelectionMode ? handleOpenMenu : undefined}
              cardWidth={cardWidth}
              style={isSelectionMode && selectedIds.has(item.id) ? styles.cardSelected : undefined}
            />
            {isSelectionMode && (
              <TouchableOpacity
                style={styles.checkboxOverlay}
                onPress={() => toggleSelection(item.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                  {selectedIds.has(item.id) && (
                    <Ionicons name="checkmark" size={14} color={Colors.textOnAccent} />
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <SeriesContextMenu
        visible={ctxMenu.visible}
        seriesId={ctxMenu.seriesId}
        seriesName={ctxMenu.seriesName}
        position={ctxMenu.position}
        onClose={closeMenu}
        onOpenDetail={openDetail}
      />

      {/* Bulk Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkActionContent}>
            <Text style={styles.bulkActionCount}>{selectedIds.size} selected</Text>
            <View style={styles.bulkActionButtons}>
              <TouchableOpacity
                style={[styles.bulkButton, styles.bulkButtonSecondary]}
                onPress={() => setShowMoveModal(true)}
                disabled={bulkActionLoading}
              >
                <Ionicons name="arrow-forward-outline" size={18} color={Colors.accent} />
                <Text style={styles.bulkButtonTextSecondary}>Move</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkButton, styles.bulkButtonDanger]}
                onPress={handleRemoveFromCollection}
                disabled={bulkActionLoading}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.error || '#ff4444'} />
                <Text style={styles.bulkButtonTextDanger}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Move to Collection Modal */}
      <Modal
        visible={showMoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.surface || '#1a1a2e' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move to Collection</Text>
              <TouchableOpacity onPress={() => setShowMoveModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={collections.filter(c => c.id !== selected?.id)}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.collectionList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.collectionOption}
                  onPress={() => handleMoveToCollection(item.id)}
                  disabled={bulkActionLoading}
                >
                  <Text style={styles.collectionOptionText}>{item.title}</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.accent} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyCollections}>No other collections available</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  screenHeader: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.serif,
  },
  pillList: {
    flexGrow: 0,
  },
  pillsContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  collectionPill: {
    width: 100,
    height: 140,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  collectionPillActive: {
    borderColor: Colors.accent,
  },
  pillCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  pillOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,13,18,0.75)',
    padding: 6,
  },
  pillOverlayActive: {
    backgroundColor: 'rgba(232,168,56,0.25)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pillTextActive: {
    color: Colors.accent,
  },
  collectionLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  grid: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 40,
  },
  row: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footerLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Multi-select styles
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  selectButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  selectButtonText: {
    fontSize: Typography.sm,
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  selectButtonTextActive: {
    color: Colors.textOnAccent || Colors.textPrimary,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectionCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  selectionAction: {
    paddingHorizontal: Spacing.sm,
  },
  selectionActionText: {
    fontSize: Typography.sm,
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  cardWrapper: {
    position: 'relative',
  },
  cardSelected: {
    opacity: 0.7,
  },
  checkboxOverlay: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  // Bulk action bar
  bulkActionBar: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface || '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
  },
  bulkActionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkActionCount: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.semibold,
  },
  bulkActionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  bulkButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  bulkButtonTextSecondary: {
    fontSize: Typography.sm,
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  bulkButtonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.error || '#ff4444',
  },
  bulkButtonTextDanger: {
    fontSize: Typography.sm,
    color: Colors.error || '#ff4444',
    fontWeight: Typography.semibold,
  },
  // Move modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  collectionList: {
    padding: Spacing.sm,
  },
  collectionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  collectionOptionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  emptyCollections: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: Spacing.xl,
  },
});
