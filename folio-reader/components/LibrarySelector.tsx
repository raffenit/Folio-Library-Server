import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../constants/theme';

interface Library {
  id: string | number;
  name: string;
}

interface LibrarySelectorProps {
  libraries: Library[];
  selectedLibraryId: string | number | null;
  onSelectLibrary: (id: string | number | null) => void;
  defaultTitle?: string;
}

export function LibrarySelector({
  libraries,
  selectedLibraryId,
  onSelectLibrary,
  defaultTitle = 'Library'
}: LibrarySelectorProps) {
  const { colors } = useTheme();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<View>(null);

  const selectedLibrary = libraries.find(l => l.id === selectedLibraryId);
  const displayTitle = selectedLibrary?.name || defaultTitle;

  const handleSelect = (id: string | number | null) => {
    onSelectLibrary(id);
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside (web only)
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current) {
        const dropdown = dropdownRef.current as any;
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  if (libraries.length === 0) {
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <Text style={{
          fontSize: Typography.sm,
          fontWeight: Typography.medium,
          color: colors.textPrimary,
        }}>
          {displayTitle}
        </Text>
      </View>
    );
  }

  return (
    <View ref={dropdownRef} style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setShowDropdown(!showDropdown)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: showDropdown ? colors.accent : colors.border,
        }}
        activeOpacity={0.7}
      >
        <Ionicons
          name="library-outline"
          size={16}
          color={colors.accent}
        />
        <Text style={{
          fontSize: Typography.sm,
          fontWeight: Typography.medium,
          color: colors.textPrimary,
        }}>
          {displayTitle}
        </Text>
        <Ionicons
          name={showDropdown ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {showDropdown && (
        <View style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
          zIndex: 1000,
          minWidth: 180,
        }}>
          {/* All Libraries option */}
          <TouchableOpacity
            onPress={() => handleSelect(null)}
            style={{
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: selectedLibraryId === null ? `${colors.accent}20` : 'transparent',
            }}
          >
            <Text style={{
              fontSize: Typography.sm,
              fontWeight: selectedLibraryId === null ? Typography.semibold : Typography.regular,
              color: selectedLibraryId === null ? colors.accent : colors.textPrimary,
            }}>
              All Libraries
            </Text>
          </TouchableOpacity>

          {/* Individual libraries */}
          {libraries.map((library) => (
            <TouchableOpacity
              key={library.id}
              onPress={() => handleSelect(library.id)}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: selectedLibraryId === library.id ? `${colors.accent}20` : 'transparent',
              }}
            >
              <Text style={{
                fontSize: Typography.sm,
                fontWeight: selectedLibraryId === library.id ? Typography.semibold : Typography.regular,
                color: selectedLibraryId === library.id ? colors.accent : colors.textPrimary,
              }}>
                {library.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
