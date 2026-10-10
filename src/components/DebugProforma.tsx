// components/DebugProforma.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function DebugProforma() {
  const { utilisateur } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const loadDebugData = async () => {
      const info: any = {};

      // Test de l'utilisateur
      info.utilisateur = utilisateur;
      
      // Test des fournisseurs
      try {
        const { data: fournisseurs, error } = await supabase
          .from('fournisseurs')
          .select('*')
          .eq('actif', true);
        info.fournisseurs = {
          data: fournisseurs,
          error: error?.message,
          count: fournisseurs?.length
        };
      } catch (e: any) {
        info.fournisseurs = { error: e.message };
      }

      // Test des produits
      try {
        const { data: produits, error } = await supabase
          .from('produits')
          .select('*');
        info.produits = {
          data: produits?.slice(0, 3), // Premier 3 seulement
          error: error?.message,
          count: produits?.length
        };
      } catch (e: any) {
        info.produits = { error: e.message };
      }

      // Test de la table demandes_proforma
      try {
        const { data: proformas, error } = await supabase
          .from('demandes_proforma')
          .select('*')
          .limit(2);
        info.proformas = {
          data: proformas,
          error: error?.message,
          count: proformas?.length
        };
      } catch (e: any) {
        info.proformas = { error: e.message };
      }

      setDebugInfo(info);
    };

    loadDebugData();
  }, [utilisateur]);

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-bold text-lg mb-4">🔍 Debug Proforma</h3>
      <pre className="text-xs bg-white p-4 rounded border overflow-auto max-h-96">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
}
