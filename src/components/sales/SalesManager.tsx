// src/components/sales/SalesManager.tsx
import { useState, useEffect } from 'react';
import { ShoppingCart, User, CreditCard } from 'lucide-react';
import { AuxiliaryManager } from './AuxiliaryManager';
import { useAuth } from '../../contexts/AuthContext';

export function SalesManager() {
  const [activeTab, setActiveTab] = useState<'auxiliary' | 'cashier'>('auxiliary');
  const { dataVersion } = useAuth(); 

  useEffect(() => {
    console.log('🔄 SalesManager - dataVersion changée:', dataVersion);
    // Ici vous pouvez déclencher un rechargement des données de vente si nécessaire
  }, [dataVersion]);
  
  const CashierTabContent = () => {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Interface Caisse Dédiée
          </h3>
          <p className="text-gray-600 mb-4">
            Pour accéder à l'interface complète de caisse avec gestion des sessions, 
            veuillez utiliser le menu "Gestion Caisse" dans la sidebar.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p><strong>Fonctionnalités disponibles :</strong></p>
            <ul className="mt-2 space-y-1 text-left">
              <li>• Ouverture/fermeture de session caisse</li>
              <li>• Gestion complète de la file d'attente</li>
              <li>• Encaissement et tickets</li>
              <li>• Rapports de caisse détaillés</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Ventes</h2>
          <p className="text-gray-600 mt-1">Processus de vente en deux étapes</p>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('auxiliary')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'auxiliary'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-5 h-5" />
            Accueil Client
          </button>
          <button
            onClick={() => setActiveTab('cashier')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'cashier'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            Caisse (FIFO)
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'auxiliary' && <AuxiliaryManager />}
          {activeTab === 'cashier' && <CashierTabContent />}
        </div>
      </div>
    </div>
  );
}
