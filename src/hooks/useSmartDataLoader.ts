// src/hooks/useSmartDataLoader.ts - VERSION FONCTIONNELLE
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UseSmartDataLoaderOptions {
  key: string;
  fetchFn: () => Promise<any>;
  enabled?: boolean;
}

export function useSmartDataLoader({ 
  key, 
  fetchFn, 
  enabled = true 
}: UseSmartDataLoaderOptions) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { dataVersion } = useAuth();
  const mountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!enabled || !mountedRef.current || fetchInProgressRef.current) {
      console.log(`⏸️ ${key} - Chargement annulé (enabled: ${enabled}, mounted: ${mountedRef.current}, inProgress: ${fetchInProgressRef.current})`);
      return;
    }

    try {
      console.log(`🚀 [${key}] Début du chargement...`);
      fetchInProgressRef.current = true;
      setLoading(true);
      setError(null);
      
      const result = await fetchFn();
      
      console.log(`✅ [${key}] Résultat reçu:`, result);
      
      if (!mountedRef.current) {
        console.log(`⏹️ [${key}] Composant démonté, annulation`);
        return;
      }

      // ✅ FORCE la mise à jour avec un nouvel objet
      console.log(`🎯 [${key}] Avant setData - data actuel:`, data);
      setData(result);
      console.log(`🎯 [${key}] Après setData - nouvel état défini`);
      
    } catch (err: any) {
      console.error(`❌ [${key}] Erreur:`, err);
      
      if (!mountedRef.current) return;
      setError(err.message);
      setData(null);
      
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        fetchInProgressRef.current = false;
        console.log(`🏁 [${key}] Chargement terminé - loading: false`);
      }
    }
  }, [key, fetchFn, enabled, data]); // Ajout de data pour le debug

  useEffect(() => {
    console.log(`🔧 [${key}] Effet déclenché - enabled: ${enabled}, dataVersion: ${dataVersion}`);
    
    if (enabled) {
      loadData();
    } else {
      console.log(`⏸️ [${key}] Désactivé - reset état`);
      setLoading(false);
      setData(null);
    }
  }, [dataVersion, enabled, loadData, key]);

  useEffect(() => {
    return () => {
      console.log(`🧹 [${key}] Nettoyage`);
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    console.log(`🔄 [${key}] Actualisation forcée`);
    setData(null); // Reset avant rechargement
    loadData();
  }, [loadData, key]);

  // DEBUG en temps réel
  console.log(`📤 [${key}] État actuel:`, { 
    data: data ? `[${Array.isArray(data) ? data.length : 'object'}]` : 'null',
    dataRaw: data,
    loading,
    error
  });

  return {
    data,
    loading,
    error,
    refresh
  };
}
