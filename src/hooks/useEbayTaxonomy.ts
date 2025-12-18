
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AspectValue {
  value: string;
  meaning?: string;
}

interface EbayAspect {
  aspect_name: string;
  values_json: AspectValue[];
  refreshed_at: string;
}

interface CacheEntry {
  aspects: EbayAspect[];
  timestamp: number;
  loading: boolean;
  error: string | null;
  subscribers: Set<(aspects: EbayAspect[]) => void>;
}

// Module-level cache to share data across all components
const taxonomyCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory cache

// Pending requests to prevent duplicate fetches
const pendingRequests = new Map<string, Promise<EbayAspect[]>>();

async function fetchTaxonomyForCategory(categoryId: string): Promise<EbayAspect[]> {
  // Check if there's already a pending request for this category
  const pending = pendingRequests.get(categoryId);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    try {
      // First check if we have cached data less than 24 hours old in database
      const { data: cachedData, error: cacheError } = await supabase
        .from('ebay_aspects')
        .select('*')
        .eq('category_id', categoryId)
        .gte('refreshed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('aspect_name');

      if (!cacheError && cachedData?.length > 0) {
        console.log(`Using cached taxonomy data for category ${categoryId} (${cachedData.length} aspects)`);
        return cachedData.map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ?
            (item.values_json as unknown as AspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));
      }

      // Cache is stale or missing, fetch fresh data from edge function
      console.log(`Fetching fresh taxonomy data for category ${categoryId}`);
      const { data, error } = await supabase.functions.invoke('ebay-taxonomy', {
        body: { categoryId }
      });

      if (error) {
        console.error('Taxonomy refresh error:', error);
        throw error;
      }

      if (data?.aspects) {
        console.log(`Refreshed taxonomy data: ${data.aspects.length} aspects`);
        return data.aspects;
      }

      return [];
    } finally {
      // Clean up pending request
      pendingRequests.delete(categoryId);
    }
  })();

  pendingRequests.set(categoryId, fetchPromise);
  return fetchPromise;
}

export const useEbayTaxonomy = (categoryId?: string) => {
  const [aspects, setAspects] = useState<EbayAspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;

    // Check in-memory cache first
    const cached = taxonomyCache.get(categoryId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      setAspects(cached.aspects);
      setLoading(false);
      setError(cached.error);
      return;
    }

    // Subscribe to updates for this category
    const updateAspects = (newAspects: EbayAspect[]) => {
      setAspects(newAspects);
      setLoading(false);
    };

    // Initialize or get existing cache entry
    if (!taxonomyCache.has(categoryId)) {
      taxonomyCache.set(categoryId, {
        aspects: [],
        timestamp: 0,
        loading: true,
        error: null,
        subscribers: new Set()
      });
    }

    const cacheEntry = taxonomyCache.get(categoryId)!;
    cacheEntry.subscribers.add(updateAspects);

    // If already loading, just wait for the result
    if (cacheEntry.loading && cacheEntry.timestamp > 0) {
      setLoading(true);
      return () => {
        cacheEntry.subscribers.delete(updateAspects);
      };
    }

    // Start loading
    setLoading(true);
    cacheEntry.loading = true;
    cacheEntry.timestamp = Date.now();

    fetchTaxonomyForCategory(categoryId)
      .then(fetchedAspects => {
        cacheEntry.aspects = fetchedAspects;
        cacheEntry.loading = false;
        cacheEntry.error = null;
        cacheEntry.timestamp = Date.now();

        // Notify all subscribers
        cacheEntry.subscribers.forEach(callback => callback(fetchedAspects));
      })
      .catch(err => {
        cacheEntry.loading = false;
        cacheEntry.error = err.message || 'Failed to fetch taxonomy data';
        setError(cacheEntry.error);
        setLoading(false);
      });

    return () => {
      cacheEntry.subscribers.delete(updateAspects);
    };
  }, [categoryId]);

  const getAspectValues = useCallback((aspectName: string): AspectValue[] => {
    const aspect = aspects.find(a => a.aspect_name === aspectName);
    return aspect?.values_json || [];
  }, [aspects]);

  const refreshTaxonomyData = useCallback(async () => {
    if (!categoryId) return;

    setLoading(true);
    setError(null);

    try {
      // Get existing subscribers before clearing cache
      const existingEntry = taxonomyCache.get(categoryId);
      const existingSubscribers = existingEntry?.subscribers || new Set();

      const { data, error } = await supabase.functions.invoke('ebay-taxonomy', {
        body: { categoryId }
      });

      if (error) {
        console.error('Taxonomy refresh error:', error);
        throw error;
      }

      if (data?.aspects) {
        // Update cache, preserving subscribers
        taxonomyCache.set(categoryId, {
          aspects: data.aspects,
          timestamp: Date.now(),
          loading: false,
          error: null,
          subscribers: existingSubscribers
        });

        // Update local state
        setAspects(data.aspects);

        // Notify ALL subscribers so other components update too
        existingSubscribers.forEach(callback => callback(data.aspects));

        console.log(`Refreshed taxonomy data: ${data.aspects.length} aspects, notified ${existingSubscribers.size} subscribers`);
      }
    } catch (err: any) {
      console.error('Error refreshing taxonomy data:', err);
      setError(err.message || 'Failed to refresh taxonomy data');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  return {
    aspects,
    loading,
    error,
    getAspectValues,
    refreshTaxonomyData
  };
};
