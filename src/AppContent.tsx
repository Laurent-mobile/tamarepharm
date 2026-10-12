// src/AppContent.tsx - VERSION PLEIN ÉCRAN
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProductsManager } from './components/products/ProductsManager';
import { SalesManager } from './components/sales/SalesManager';
import { SalesHistory } from './components/sales/SalesHistory';
import { ClientsManager } from './components/clients/ClientsManager';
import { SuppliersManager } from './components/suppliers/SuppliersManager';
import { OrdersManager } from './components/orders/OrdersManager';
import { TransfersManager } from './components/transfers/TransfersManager';
import { InventoryManager } from './components/inventory/InventoryManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { AssurancePaymentsManager } from './components/assurances/AssurancePaymentsManager';
import { CashierMenu } from './components/cashier/CashierMenu';
import { StockTabs } from './components/stock/StockTabs';
import { ComptesClientsManager } from './components/clients/ComptesClientsManager';

export function AppContent() {
  const { user, utilisateur, loading, error, signOut, retryLoadUser, refreshSession, dataVersion, refreshData } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [appError, setAppError] = useState<string | null>(null);

  const handleSectionChange = useCallback((section: string) => {
    console.log('🎯 Changement de section:', section);
    setActiveSection(section);
  }, []);

  useEffect(() => {
    console.log('🔄 AppContent - dataVersion changée:', dataVersion);
  }, [dataVersion]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 AppContent State:', {
        user: user ? { email: user.email, id: user.id } : null,
        utilisateur: utilisateur ? { 
          nom_complet: utilisateur.nom_complet, 
          role: utilisateur.role,
          pharmacy_id: utilisateur.pharmacy_id 
        } : null,
        loading,
        activeSection,
        authError: error,
        dataVersion 
      });
    }
  }, [user, utilisateur, loading, activeSection, error, dataVersion]);

  useEffect(() => {
    if (user && !utilisateur && !loading) {
      console.warn('⚠️ État problématique: user mais pas utilisateur, et loading=false');
    }
  }, [user, utilisateur, loading, error]);

  if (utilisateur?.role === 'caissier') {
    return <CashierMenu />;
  }

  const canAccessSection = useCallback((section: string): boolean => {
    if (!utilisateur) return false;

    const permissions = {
      admin: {
        dashboard: true, produits: true, stock: true, ventes: true, caissier: true,
        'historique-ventes': true, 'paiements-assurances': true, clients: true,'comptes-clients': true,
        fournisseurs: true, commandes: true, transferts: true, inventaires: true, parametres: true
      },
      pharmacien: {
        dashboard: true, produits: true, stock: true, ventes: true, caissier: true,
        'historique-ventes': true, 'paiements-assurances': true, clients: true,
        fournisseurs: true, commandes: true, transferts: true, inventaires: true, parametres: false
      },
      vendeur: {
        dashboard: true, produits: true, stock: true, ventes: true, caissier: false,
        'historique-ventes': true, 'paiements-assurances': false, clients: true,'comptes-clients': false,
        fournisseurs: false, commandes: false, transferts: false, inventaires: false, parametres: false
      },
      caissier: {
        dashboard: true, produits: false, stock: false, ventes: false, caissier: true,
        'historique-ventes': true, 'paiements-assurances': false, clients: false,'comptes-clients': true,
        fournisseurs: false, commandes: false, transferts: false, inventaires: false, parametres: false
      },
    };

    return permissions[utilisateur.role]?.[section] || false;
  }, [utilisateur]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'application...</p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={refreshSession} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs">
                Rafraîchir
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (user && !utilisateur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="font-bold text-lg text-yellow-800 mb-2">
              {error ? 'Erreur de chargement' : 'Chargement du profil'}
            </h2>
            <p className="text-yellow-700 mb-4">
              {error || 'Votre compte est connecté mais le profil n\'est pas encore chargé.'}
            </p>
            <div className="space-y-2">
              <button onClick={retryLoadUser} className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                {error ? 'Réessayer le chargement' : 'Actualiser le profil'}
              </button>
              <button onClick={() => window.location.reload()} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Recharger la page
              </button>
              <button onClick={signOut} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    try {
      console.log('🎯 Rendering section:', activeSection);
      
      if (!canAccessSection(activeSection)) {
        return (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès non autorisé</h3>
              <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette section.</p>
              <button onClick={() => setActiveSection('dashboard')} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                Retour au tableau de bord
              </button>
            </div>
          </div>
        );
      }
      
      switch (activeSection) {
        case 'dashboard': return <Dashboard />;
        case 'produits': return <ProductsManager />;
        case 'stock': return <StockTabs />;
        case 'ventes': return <SalesManager />;
        case 'caissier': return <CashierMenu />;
        case 'historique-ventes': return <SalesHistory />;
        case 'paiements-assurances': return <AssurancePaymentsManager />;
        case 'clients': return <ClientsManager />;
        case 'comptes-clients':return <ComptesClientsManager />;
        case 'fournisseurs': return <SuppliersManager />;
        case 'commandes': return <OrdersManager />;
        case 'transferts': return <TransfersManager />;
        case 'inventaires': return <InventoryManager />;
        case 'parametres': return <SettingsManager />;
        default: return <Dashboard />;
      }
    } catch (err: any) {
      console.error('❌ Erreur rendu section:', err);
      setAppError(err.message);
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg w-full">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-red-800 font-bold">Erreur d'application</h3>
              <p className="text-red-600 mt-1">{err.message}</p>
              <div className="mt-4 flex space-x-3">
                <button onClick={() => setAppError(null)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Fermer</button>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">Recharger</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    // ✅ AJOUT DE w-full ET overflow-hidden POUR ÉVITER LES DÉBORDEMENTS
    <div className="flex h-screen bg-gray-50 w-full overflow-hidden">
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={handleSectionChange}
        user={utilisateur!}
      />
      
      {/* ✅ MODIFICATION ICI : w-full au lieu de max-w-7xl mx-auto */}
      <main className="flex-1 overflow-y-auto w-full bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getSectionTitle(activeSection)}
              </h1>
              <p className="text-gray-600 mt-1">
                {getSectionDescription(activeSection)}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500 w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={refreshData}
                  className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors flex items-center w-full sm:w-auto justify-center"
                  title="Rafraîchir toutes les données"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Rafraîchir
                </button>
                <div>
                  <p className="font-medium">{utilisateur.nom_complet}</p>
                  <p className="capitalize">{utilisateur.role}</p>
                </div>
              </div>
            </div>
          </div>

          {(error || appError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg w-full">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-red-800 font-bold">
                    {error ? 'Erreur d\'authentification' : 'Erreur d\'application'}
                  </h3>
                  <p className="text-red-600 mt-1">{error || appError}</p>
                  {error && (
                    <div className="mt-3 flex space-x-2">
                      <button onClick={retryLoadUser} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors">Réessayer</button>
                      <button onClick={refreshSession} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">Rafraîchir</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setAppError(null)} className="ml-4 flex-shrink-0 text-red-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {renderSection()}
        </div>
      </main>
    </div>
  );
}

function getSectionTitle(section: string): string {
  const titles: { [key: string]: string } = {
    dashboard: 'Tableau de Bord',
    produits: 'Gestion des Produits',
    stock: 'Gestion des Stocks',
    ventes: 'Gestion des Ventes',
    caissier: 'Gestion de Caisse',
    'historique-ventes': 'Historique des Ventes',
    'paiements-assurances': 'Paiements Assurances',
    clients: 'Gestion des Clients',
    fournisseurs: 'Gestion des Fournisseurs',
    commandes: 'Gestion des Commandes',
    transferts: 'Gestion des Transferts',
    inventaires: 'Gestion des Inventaires',
    parametres: 'Paramètres du Système'
  };
  return titles[section] || 'Application Pharmacie';
}

function getSectionDescription(section: string): string {
  const descriptions: { [key: string]: string } = {
    dashboard: 'Vue d\'ensemble de la pharmacie',
    produits: 'Liste et gestion des produits pharmaceutiques',
    stock: 'Gestion complète du stock et sorties manuelles',
    ventes: 'Processus de vente en deux étapes',
    caissier: 'Interface dédiée pour les opérations de caisse',
    'historique-ventes': 'Historique complet des ventes',
    'paiements-assurances': 'Gestion des réclamations assurances',
    clients: 'Gestion de la clientèle et assurances',
    fournisseurs: 'Fournisseurs agréés',
    commandes: 'Workflow complet : Pro-forma → Commande → Réception',
    transferts: 'Transferts entre pharmacies et sous-dépôts',
    inventaires: 'Inventaires physiques du stock',
    parametres: 'Configuration du système et permissions'
  };
  return descriptions[section] || 'Gestion complète de la pharmacie';
}
