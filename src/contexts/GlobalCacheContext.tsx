// src/contexts/GlobalCacheContext.tsx
import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface CacheData {
  produits: any[];
  stock: any[];
  fournisseurs: any[];
  proformas: any[];
  commandes: any[];
  receptions: any[];
  ventes: any[];
  clients: any[];
  // Ajoutez d'autres données selon vos besoins
}

interface GlobalCacheContextType {
  get: <T>(key: keyof CacheData) => T | null;
  set: <T>(key: keyof CacheData, data: T) => void;
  clear: (key?: keyof CacheData) => void;
  has: (key: keyof CacheData) => boolean;
  getVersion: (key: keyof CacheData) => number;
}

const GlobalCacheContext = createContext<GlobalCacheContextType | undefined>(undefined);

// Singleton global hors React
const globalCache = {
  data: {} as Partial<CacheData>,
  versions: {} as { [key in keyof CacheData]: number },
  timestamps: {} as { [key in keyof CacheData]: number }
};

export function GlobalCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef(globalCache);

  const cache = {
    get: <T,>(key: keyof CacheData): T | null => {
      const data = cacheRef.current.data[key];
      
      // S'assurer que les données retournées sont cohérentes
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.warn(`⚠️ Cache ${key} est un objet, conversion en tableau`);
        return Object.values(data) as T;
      }
      
      return (data as T) || null;
    },
    
    set: <T,>(key: keyof CacheData, data: T) => {
      // FORCER le stockage en tant que tableau
      let dataToStore = data;
      
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.warn(`⚠️ Données ${key} sont un objet, conversion en tableau avant stockage`);
        dataToStore = Object.values(data) as T;
      }
      
      cacheRef.current.data[key] = dataToStore;
      cacheRef.current.versions[key] = (cacheRef.current.versions[key] || 0) + 1;
      cacheRef.current.timestamps[key] = Date.now();
      console.log(`💾 Cache global mis à jour - ${key}:`, 
        Array.isArray(dataToStore) ? `${dataToStore.length} items` : '0 items', 
        'type:', typeof dataToStore
      );
    },
    
    clear: (key?: keyof CacheData) => {
      if (key) {
        delete cacheRef.current.data[key];
        delete cacheRef.current.versions[key];
        delete cacheRef.current.timestamps[key];
        console.log(`🗑️ Cache global vidé pour: ${key}`);
      } else {
        cacheRef.current.data = {};
        cacheRef.current.versions = {};
        cacheRef.current.timestamps = {};
        console.log('🗑️ Cache global complètement vidé');
      }
    },
    
    has: (key: keyof CacheData) => {
      return key in cacheRef.current.data;
    },
    
    getVersion: (key: keyof CacheData) => {
      return cacheRef.current.versions[key] || 0;
    }
  };

  return (
    <GlobalCacheContext.Provider value={cache}>
      {children}
    </GlobalCacheContext.Provider>
  );
}

export function useGlobalCache() {
  const context = useContext(GlobalCacheContext);
  if (context === undefined) {
    throw new Error('useGlobalCache must be used within a GlobalCacheProvider');
  }
  return context;
}
