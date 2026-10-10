// src/contexts/DataCacheContext.tsx
import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface CacheData {
  produits: any[];
  stock: any[];
  ventes: any[];
  clients: any[];
  fournisseurs: any[];
  commandes: any[];
  // Ajoutez d'autres données que vous voulez cacher
}

interface DataCacheContextType {
  get: <T>(key: keyof CacheData) => T | null;
  set: <T>(key: keyof CacheData, data: T) => void;
  clear: () => void;
  has: (key: keyof CacheData) => boolean;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Partial<CacheData>>({});
  const cacheVersionRef = useRef<number>(0);

  const cache = {
    get: <T,>(key: keyof CacheData): T | null => {
      return (cacheRef.current[key] as T) || null;
    },
    
    set: <T,>(key: keyof CacheData, data: T) => {
      cacheRef.current[key] = data;
      cacheVersionRef.current++;
      console.log(`💾 Cache mis à jour - ${key}:`, data?.length || '0 items');
    },
    
    clear: () => {
      cacheRef.current = {};
      cacheVersionRef.current = 0;
      console.log('🗑️ Cache vidé');
    },
    
    has: (key: keyof CacheData) => {
      return key in cacheRef.current;
    }
  };

  return (
    <DataCacheContext.Provider value={cache}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}
