// src/components/stock/StockTabs.tsx
import { useState, useEffect } from 'react';
import { Package, MinusCircle, History, Bell, Warehouse } from 'lucide-react';
import { StockManager } from './StockManager';
import { StockAdjustments } from './StockAdjustments';
import { StockAdjustmentHistory } from './StockAdjustmentHistory';
import { StockParMagasin } from './StockParMagasin';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export function StockTabs() {
  const [activeTab, setActiveTab] = useState<'gestion' | 'stock_magasin' | 'ajustements' | 'historique'>('gestion');
  const [ajustementsNonImprimes, setAjustementsNonImprimes] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const { utilisateur, dataVersion } = useAuth();

  useEffect(() => {
    const loadCounts = async () => {
      // ✅ GARDE HORS-LIGNE : Ne pas essayer de compter si pas de réseau
      if (!navigator.onLine) {
        setAjustementsNonImprimes(0);
        setLoadingCounts(false);
        return;
      }

      if (!utilisateur) return;
      
      try {
        setLoadingCounts(true);
        const { count, error } = await supabase
          .from('historique_ajustements_stock')
          .select('*', { count: 'exact', head: true })
          .eq('pharmacy_id', utilisateur.pharmacy_id)
          .eq('statut_impression', 'non_imprime');
        
        if (error) throw error;
        setAjustementsNonImprimes(count || 0);
      } catch (error) {
        console.error('Erreur chargement compteurs:', error);
        setAjustementsNonImprimes(0);
      } finally {
        setLoadingCounts(false);
      }
    };
    loadCounts();
  }, [utilisateur, dataVersion, activeTab]);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button onClick={() => setActiveTab('gestion')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'gestion' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Package className="w-4 h-4" /> Gestion du Stock
          </button>
          <button onClick={() => setActiveTab('stock_magasin')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'stock_magasin' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Warehouse className="w-4 h-4" /> Stock par Magasin
          </button>
          <button onClick={() => setActiveTab('ajustements')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'ajustements' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <MinusCircle className="w-4 h-4" /> Sorties de Stock
          </button>
          <button onClick={() => setActiveTab('historique')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm relative whitespace-nowrap ${activeTab === 'historique' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <History className="w-4 h-4" /> Historique
            {!loadingCounts && ajustementsNonImprimes > 0 && (
              <span className="absolute -top-1 -right-2 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full">
                {ajustementsNonImprimes}
              </span>
            )}
          </button>
        </nav>
      </div>

      {!loadingCounts && ajustementsNonImprimes > 0 && activeTab !== 'historique' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <Bell className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium">{ajustementsNonImprimes} mouvement(s) de stock en attente d'impression</p>
          </div>
          <button onClick={() => setActiveTab('historique')} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">
            Voir l'historique
          </button>
        </div>
      )}

      <div>
        {activeTab === 'gestion' && <StockManager />}
        {activeTab === 'stock_magasin' && <StockParMagasin />}
        {activeTab === 'ajustements' && <StockAdjustments />}
        {activeTab === 'historique' && <StockAdjustmentHistory />}
      </div>
    </div>
  );
}
