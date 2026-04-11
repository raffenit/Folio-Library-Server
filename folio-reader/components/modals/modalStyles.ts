import { Platform } from 'react-native';
import { Typography, Spacing, Radius, type ColorScheme } from '@/constants/theme';

export function makeStyles(c: ColorScheme) {
  return {
    modalContainer: { flex: 1, backgroundColor: c.background },
    modalHeader: { 
      flexDirection: 'row' as const, 
      alignItems: 'center' as const, 
      paddingTop: Platform.OS === 'ios' ? 56 : 20, 
      paddingHorizontal: Spacing.base, 
      paddingBottom: Spacing.md, 
      borderBottomWidth: 1, 
      borderBottomColor: c.border, 
      backgroundColor: c.surface 
    },
    modalClose: { width: 40, height: 40, justifyContent: 'center' as const, alignItems: 'center' as const },
    modalTitle: { flex: 1, textAlign: 'center' as const, fontSize: Typography.base, fontWeight: Typography.semibold as any, color: c.textPrimary, paddingHorizontal: 10 },
    modalSave: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    modalSaveText: { fontSize: Typography.base, fontWeight: Typography.bold as any, color: c.accent },
    
    // Cover Picker specific
    coverChooseContainer: { flex: 1, padding: Spacing.xl, gap: Spacing.lg, justifyContent: 'center' as const },
    coverOptionBtn: { backgroundColor: c.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.xl, alignItems: 'center' as const, gap: Spacing.sm },
    coverOptionText: { fontSize: Typography.md, fontWeight: Typography.bold as any, color: c.textPrimary },
    coverOptionSub: { fontSize: Typography.sm, color: c.textSecondary },
    coverError: { fontSize: Typography.sm, color: c.error, textAlign: 'center' as const, paddingHorizontal: Spacing.lg },
    
    // Search / Results
    searchRow: { flexDirection: 'row' as const, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm },
    searchInputFlex: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary },
    searchBtn: { backgroundColor: c.accent, borderRadius: Radius.md, width: 44, height: 44, justifyContent: 'center' as const, alignItems: 'center' as const },
    coverGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: Spacing.base, gap: Spacing.md, paddingBottom: 40 },
    coverThumbWrap: { width: 100, alignItems: 'center' as const, gap: 4 },
    coverThumb: { width: 100, height: 140, borderRadius: Radius.sm, backgroundColor: c.surface },
    coverThumbTitle: { fontSize: 10, color: c.textSecondary, textAlign: 'center' as const, lineHeight: 14 },
    uploadingOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,13,18,0.7)', justifyContent: 'center' as const, alignItems: 'center' as const, gap: Spacing.md },
    uploadingText: { fontSize: Typography.base, color: c.textPrimary },

    // Metadata Search Result Card
    metaResultCard: { flexDirection: 'row' as const, backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, padding: Spacing.md, gap: Spacing.md, alignItems: 'flex-start' as const },
    metaResultThumb: { width: 56, height: 80, borderRadius: Radius.sm },
    metaResultInfo: { flex: 1, gap: 3 },
    metaResultTitle: { fontSize: Typography.base, fontWeight: Typography.semibold as any, color: c.textPrimary },
    metaResultAuthor: { fontSize: Typography.sm, color: c.accent },
    metaResultSub: { fontSize: Typography.xs, color: c.textMuted },
    metaResultDesc: { fontSize: Typography.sm, color: c.textSecondary, lineHeight: 18 },
    sourceBadge: { alignSelf: 'flex-start' as const, backgroundColor: c.accentSoft, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
    sourceBadgeText: { fontSize: 10, color: c.accent, fontWeight: Typography.medium as any },
    
    // Preview
    modalScroll: { flex: 1 },
    modalScrollContent: { padding: Spacing.base, paddingBottom: 40 },
    metaPreviewHero: { flexDirection: 'row' as const, gap: Spacing.md, marginBottom: Spacing.lg },
    metaPreviewCover: { width: 90, height: 130, borderRadius: Radius.sm },
    metaPreviewTitle: { fontSize: Typography.lg, fontWeight: Typography.bold as any, color: c.textPrimary, lineHeight: 24 },
    metaPreviewAuthor: { fontSize: Typography.base, color: c.accent },
    metaPreviewSub: { fontSize: Typography.sm, color: c.textMuted },
    fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold as any, color: c.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: Spacing.xs },
    summaryInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary, minHeight: 44, textAlignVertical: 'top' as const },
    applyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
    applyLabel: { fontSize: Typography.base, color: c.textPrimary, flex: 1 },
    summary: { fontSize: Typography.base, color: c.textSecondary, lineHeight: 23 },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: Spacing.sm },
    chip: { backgroundColor: c.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderWidth: 1, borderColor: c.border },
    
    // Edit Metadata Tabs
    tabBar: { flexDirection: 'row' as const, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' as const, borderBottomWidth: 2, borderBottomColor: 'transparent' as any },
    tabBtnActive: { borderBottomColor: c.accent },
    tabLabel: { fontSize: Typography.sm, color: c.textSecondary, fontWeight: Typography.medium as any },
    tabLabelActive: { color: c.accent, fontWeight: Typography.bold as any },
    infoTab: { gap: Spacing.lg },
    noneText: { fontSize: Typography.sm, color: c.textMuted, fontStyle: 'italic' as const },
    searchInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.base, color: c.textPrimary, marginBottom: Spacing.md },
    createChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5 },
    createChipText: { fontSize: Typography.sm, color: c.accent, fontWeight: Typography.medium as any },
    chipSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontSize: Typography.sm, color: c.textSecondary, fontWeight: Typography.medium as any },
    chipTextSelected: { color: c.accent },
    centered: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
  };
}
