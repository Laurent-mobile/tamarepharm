// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Utilisateur {
  id: string;
  email?: string;
  nom_complet: string;
  role: 'admin' | 'pharmacien' | 'vendeur' | 'caissier';
  pharmacy_id: string;
  created_at: string;
  updated_at: string;
  telephone?: string;
  actif?: boolean;
}

interface AuthContextType {
  user: User | null;
  utilisateur: Utilisateur | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  refreshSession: () => Promise<void>;
  retryLoadUser: () => Promise<void>;
  dataVersion: number;
  refreshData: () => void;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let initPromise: Promise<void> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const mountedRef = useRef(true);
  const authListenerRef = useRef<{ subscription: { unsubscribe: () => void } } | null>(null);

  const refreshData = useCallback(() => {
    setDataVersion(prev => prev + 1);
  }, []);

    const loadUtilisateur = useCallback(async (userId: string): Promise<Utilisateur | null> => {
    try {
      console.log('👤 Chargement utilisateur pour ID:', userId);
      
      // 1. Vérifier si nous avons un cache local (pour le mode hors-ligne)
      const cachedUser = localStorage.getItem('cached_utilisateur');
      
      // 2. Si nous sommes hors-ligne et qu'un cache existe, l'utiliser immédiatement
      if (!navigator.onLine && cachedUser) {
        console.log('📴 Hors-ligne : Utilisation de l\'utilisateur en cache local');
        return JSON.parse(cachedUser);
      }

      // 3. Sinon, essayer de récupérer depuis Supabase
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erreur chargement utilisateur:', error);
        // Fallback sur le cache en cas d'erreur réseau imprévue
        if (cachedUser) {
          console.log('⚠️ Erreur réseau, fallback sur l\'utilisateur en cache');
          return JSON.parse(cachedUser);
        }
        return null;
      }

      if (!data) {
        console.warn('⚠️ Aucun utilisateur trouvé pour ID:', userId);
        return null;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || '';

      const utilisateurData: Utilisateur = {
        id: data.id,
        email: userEmail,
        nom_complet: data.nom_complet || 'Utilisateur sans nom',
        role: (data.role as 'admin' | 'pharmacien' | 'vendeur' | 'caissier') || 'vendeur',
        pharmacy_id: data.pharmacy_id,
        telephone: data.telephone,
        actif: data.actif !== undefined ? data.actif : true,
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at
      };

      // ✅ SAUVEGARDER DANS LE CACHE LOCAL pour les futures sessions hors-ligne
      localStorage.setItem('cached_utilisateur', JSON.stringify(utilisateurData));
      if (data.pharmacy_id) {
        localStorage.setItem('pharmacy_id', data.pharmacy_id);
      }

      console.log('✅ Utilisateur chargé et mis en cache:', utilisateurData.nom_complet);
      return utilisateurData;
    } catch (error: any) {
      console.error('💥 Erreur critique chargement utilisateur:', error);
      // Fallback ultime
      const cachedUser = localStorage.getItem('cached_utilisateur');
      if (cachedUser) return JSON.parse(cachedUser);
      return null;
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!mountedRef.current) return;
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);
          const userData = await loadUtilisateur(session.user.id);
          if (mountedRef.current && userData) setUtilisateur(userData);
        } else {
          setUser(null);
          setUtilisateur(null);
          localStorage.removeItem('pharmacy_id');
        }
      } catch (error: any) {
        if (mountedRef.current) setError(error.message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setIsInitialized(true);
        }
        initPromise = null;
      }
    })();

    return initPromise;
  }, [loadUtilisateur]);

  // ✅ OPTIMISATION : Tableau de dépendances vide pour exécution unique et stable
  useEffect(() => {
    mountedRef.current = true;
    initializeAuth();

    if (!authListenerRef.current) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mountedRef.current) return;
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const userData = await loadUtilisateur(session.user.id);
          if (mountedRef.current && userData) setUtilisateur(userData);
          refreshData();
        } 
        else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUtilisateur(null);
          setError(null);
          localStorage.removeItem('pharmacy_id');
          refreshData();
        }
        else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const userData = await loadUtilisateur(session.user.id);
          if (mountedRef.current && userData) setUtilisateur(userData);
        }
      });

      authListenerRef.current = { subscription };
    }

    return () => {
      mountedRef.current = false;
      if (authListenerRef.current) {
        authListenerRef.current.subscription.unsubscribe();
        authListenerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const cleanEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) throw new Error('Email ou mot de passe incorrect');
        if (error.message.includes('Email not confirmed')) throw new Error('Email non confirmé');
        throw error;
      }
      if (!data.user) throw new Error('Aucun utilisateur retourné après connexion');
      
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setTimeout(() => {
        if (mountedRef.current) setLoading(false);
      }, 500);
    }
  };

    const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setUtilisateur(null);
      setError(null);
      
      // ✅ NETTOYER LE CACHE LOCAL
      localStorage.removeItem('pharmacy_id');
      localStorage.removeItem('cached_utilisateur');
      
      refreshData();
      console.log('👋 Déconnexion réussie et cache nettoyé');
    } catch (error: any) {
      console.error('❌ Erreur déconnexion:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const retryLoadUser = async () => {
    if (user?.id) {
      const userData = await loadUtilisateur(user.id);
      if (mountedRef.current && userData) {
        setUtilisateur(userData);
        refreshData();
      }
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        setUser(session.user);
        const userData = await loadUtilisateur(session.user.id);
        if (userData) setUtilisateur(userData);
        refreshData();
      } else {
        setUser(null);
        setUtilisateur(null);
        localStorage.removeItem('pharmacy_id');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    utilisateur,
    loading,
    signIn,
    signOut,
    error,
    clearError,
    refreshSession,
    retryLoadUser,
    dataVersion,
    refreshData,
    isInitialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
