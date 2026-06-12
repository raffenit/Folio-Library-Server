import { useWindowDimensions, Platform } from 'react-native';
import { Spacing } from '../constants/theme';

const GAP = Spacing.sm;
const SIDE_MARGIN = Spacing.base;

export function useGridColumns() {
  const { width } = useWindowDimensions();
  // Account for scrollbar width on web to prevent grid from being cut off
  const SCROLLBAR_WIDTH = Platform.OS === 'web' ? 16 : 0;
  const availableWidth = width - SCROLLBAR_WIDTH;
  const numColumns =
    availableWidth >= 1600 ? 8 :
    availableWidth >= 1280 ? 7 :
    availableWidth >= 960  ? 6 :
    availableWidth >= 700  ? 5 :
    availableWidth >= 500  ? 4 : 3;
  const cardWidth = (availableWidth - SIDE_MARGIN * 2 - GAP * (numColumns - 1)) / numColumns;
  return { numColumns, cardWidth };
}
