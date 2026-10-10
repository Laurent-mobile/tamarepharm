// src/hooks/useDataLoader.ts
import { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';
import { useAuth } from '../contexts/AuthContext';

interface UseDataLoaderOptions {
  key: string;
  fetchFn: () => Promise<any>;
  enabled?: boolean;
  ttl?: number; // Time to live en ms
}

export function useDataLoader({ key, fetchFn, enabled = true, ttl = 30000 }: UseDataLoaderOptions) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  const cache = useDataCache();
  const { dataVersion } = useAuth();

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // Vérifier le cache d'abord
    const cachedData = cache.get(key);
    const isCacheValid = cachedData && (Date.now() - lastFetch < ttl) && !forceRefresh;

    if (isCacheValid && !forceRefresh) {
      console.log(`💾 Utilisation du cache pour: ${key}`);
      setData(cachedData);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`📡 Chargement des données: ${key}`, forceRefresh ? '(force refresh)' : '');
      
      const result = await fetchFn();
      
      // Mettre en cache
      cache.set(key, result);
      setData(result);
      setLastFetch(Date.now());
      
      console.log(`✅ Données chargées: ${key}`, result?.length || '0 items');
      
    } catch (err: any) {
      console.error(`❌ Erreur chargement ${key}:`, err);
      setError(err.message);
      
      // En cas d'erreur, utiliser le cache si disponible
      if (cachedData) {
        console.log(`🔄 Utilisation du cache en fallback pour: ${key}`);
        setData(cachedData);
      }
    } finally {
      setLoading(false);
    }
  }, [key, fetchFn, enabled, ttl, lastFetch, cache]);

  // Recharger quand dataVersion change
  useEffect(() => {
    if (enabled) {
      loadData();
    }
  }, [dataVersion, enabled, loadData]);

  // Recharger quand les dépendances changent
  useEffect(() => {
    if (enabled) {
      loadData();
    }
  }, [loadData, enabled]);

  const refresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh,
    lastFetch
  };
}
