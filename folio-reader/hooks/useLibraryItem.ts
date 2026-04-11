import { useState, useEffect, useCallback, useRef } from 'react';
import { LibraryFactory } from '../services/LibraryFactory';
import { LibrarySeriesDetail, LibraryProvider } from '../services/LibraryProvider';

export function useLibraryItem(id: string | number, type: 'kavita' | 'abs') {
  const [data, setData] = useState<LibrarySeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<LibraryProvider>(LibraryFactory.getProvider(type));
  const abortControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      setData(null); // Clear previous data to prevent showing old book
      const currentProvider = LibraryFactory.getProvider(type);
      setProvider(currentProvider);
      
      const detail = await currentProvider.getSeriesDetail(id);
      
      // Only update state if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setData(detail);
      }
    } catch (err: any) {
      // Don't log aborted requests as errors
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('[useLibraryItem] Error fetching detail:', err);
      // Don't clear existing data on error - prevents UI flicker/loss
      setError(err.message || 'Failed to load library item');
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [id, type]);

  useEffect(() => {
    refresh();
    
    // Cleanup: abort pending request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refresh]);

  return { data, loading, error, provider, refresh };
}
