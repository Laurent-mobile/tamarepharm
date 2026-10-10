// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('🔧 Configuration Supabase:', {
  url: supabaseUrl ? '✓' : '✗',
  key: supabaseAnonKey ? '✓' : '✗'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          // Utiliser localStorage avec une clé spécifique
          return localStorage.getItem(`sb-${key}`);
        } catch (error) {
          console.error('❌ Erreur lecture storage:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(`sb-${key}`, value);
        } catch (error) {
          console.error('❌ Erreur écriture storage:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(`sb-${key}`);
        } catch (error) {
          console.error('❌ Erreur suppression storage:', error);
        }
      }
    },
    storageKey: 'auth-token', // Clé spécifique pour éviter les conflits
    debug: false // Désactiver le debug en production
  }
});
