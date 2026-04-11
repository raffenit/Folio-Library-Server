import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ContextMenuPosition } from '../components/SeriesContextMenu';

interface ContextMenuState {
  visible: boolean;
  seriesId: string | number | null;
  seriesName: string;
  provider: 'kavita' | 'abs' | null;
  position: ContextMenuPosition;
}

const CLOSED: ContextMenuState = {
  visible: false,
  seriesId: null,
  seriesName: '',
  provider: null,
  position: { x: 0, y: 0 },
};

export function useSeriesContextMenu() {
  const router = useRouter();
  const [ctx, setCtx] = useState<ContextMenuState>(CLOSED);

  const openMenu = useCallback(
    (seriesId: string | number, seriesName: string, x: number, y: number, provider: 'kavita' | 'abs' = 'kavita') => {
      setCtx({ visible: true, seriesId, seriesName, position: { x, y }, provider });
    },
    []
  );

  const closeMenu = useCallback(() => setCtx(CLOSED), []);

  const openDetail = useCallback(() => {
    if (ctx.seriesId) {
      const path = ctx.provider === 'abs' ? `/audiobook/${ctx.seriesId}` : `/series/${ctx.seriesId}`;
      router.push(path as any);
    }
    closeMenu();
  }, [ctx.seriesId, ctx.provider]);

  return { ctx, openMenu, closeMenu, openDetail };
}
