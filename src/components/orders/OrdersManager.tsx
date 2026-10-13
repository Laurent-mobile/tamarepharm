// src/components/orders/OrdersManager.tsx - VERSION COMPLÈTE FONCTIONNELLE
import { useState, useCallback, useEffect } from 'react';
import { Plus, Search, Eye, CheckCircle, Truck, ChevronDown, ChevronUp, Package, Calendar, RefreshCw, FileText, History, ClipboardList, Printer, Archive, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ProformaForm } from './ProformaForm';
import { OrderForm } from './OrderForm';
import { ReceptionForm } from './ReceptionForm';
import { HistoryModal } from './HistoryModal';
import { ProformaPrint } from '../printing/ProformaPrint';
import { CommandePrint } from '../printing/CommandePrint';
import { ReceptionPrint } from '../printing/ReceptionPrint';
import { repository } from '../../lib/repository';

export function OrdersManager() {
  const { utilisateur, dataVersion } = useAuth();
  const [activeTab, setActiveTab] = useState<'proformas' | 'commandes' | 'receptions'>('proformas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showProformaForm, setShowProformaForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showReception, setShowReception] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProformaPrint, setShowProformaPrint] = useState(false);
  const [showCommandePrint, setShowCommandePrint] = useState(false);
  const [showReceptionPrint, setShowReceptionPrint] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedProforma, setSelectedProforma] = useState<any>(null);
  const [selectedProformaForPrint, setSelectedProformaForPrint] = useState<any>(null);
  const [selectedCommandeForPrint, setSelectedCommandeForPrint] = useState<any>(null);
  const [selectedReceptionForPrint, setSelectedReceptionForPrint] = useState<any>(null);
  const [selectedCommandeForReception, setSelectedCommandeForReception] = useState<any>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [expandedProforma, setExpandedProforma] = useState<string | null>(null);
  const [forceReload, setForceReload] = useState(0);

  console.log('🔄 OrdersManager - dataVersion:', dataVersion);
  
  // ============================================================================
  // CHARGEMENT DIRECT DES DONNÉES - SOLUTION FONCTIONNELLE
  // ============================================================================

  const [proformas, setProformas] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [receptions, setReceptions] = useState<any[]>([]);
  const [loadingProformas, setLoadingProformas] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingReceptions, setLoadingReceptions] = useState(false);

  // Chargement des proformas
  
  const loadProformas = useCallback(async () => {
    if (!utilisateur) return;
    try {
      setLoadingProformas(true);
      // ✅ LECTURE LOCALE (Fonctionne hors-ligne)
      const data = await repository.getProformasFournisseur(utilisateur!.pharmacy_id);
      setProformas(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement proformas:', error);
      setProformas([]);
    } finally {
      setLoadingProformas(false);
    }
  }, [utilisateur]);

  const loadOrders = useCallback(async () => {
    if (!utilisateur) return;
    try {
      setLoadingOrders(true);
      // ✅ LECTURE LOCALE (Fonctionne hors-ligne)
      const data = await repository.getCommandes(utilisateur.pharmacy_id);
      setOrders(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement commandes:', error);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [utilisateur]);

  const loadReceptions = useCallback(async () => {
    if (!utilisateur) return;
    try {
      setLoadingReceptions(true);
      // ✅ LECTURE LOCALE (Fonctionne hors-ligne)
      const data = await repository.getReceptions(utilisateur.pharmacy_id);
      setReceptions(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement réceptions:', error);
      setReceptions([]);
    } finally {
      setLoadingReceptions(false);
    }
  }, [utilisateur]);

  // ============================================================================
  // EFFETS DE CHARGEMENT
  // ============================================================================

  // Chargement automatique quand l'onglet change
  useEffect(() => {
    console.log(`🔄 Onglet changé: ${activeTab}, chargement direct...`);
    
    if (activeTab === 'proformas') {
      loadProformas();
    } else if (activeTab === 'commandes') {
      loadOrders();
    } else if (activeTab === 'receptions') {
      loadReceptions();
    }
  }, [activeTab, loadProformas, loadOrders, loadReceptions]);

  // Chargement initial
  useEffect(() => {
    if (utilisateur) {
      console.log('👤 Utilisateur connecté, chargement initial...');
      loadProformas();
      loadOrders();
      loadReceptions();
    }
  }, [utilisateur, loadProformas, loadOrders, loadReceptions]);

  // Rechargement quand dataVersion change
  useEffect(() => {
    if (utilisateur && dataVersion > 0) {
      console.log('🔄 dataVersion changée, rechargement...');
      loadProformas();
      loadOrders();
      loadReceptions();
    }
  }, [dataVersion, utilisateur, loadProformas, loadOrders, loadReceptions]);

  // ============================================================================
  // FONCTIONS DE RAFRAÎCHISSEMENT
  // ============================================================================

  const loadData = useCallback(() => {
    console.log('🔄 Chargement manuel des données...');
    loadProformas();
    loadOrders();
    loadReceptions();
  }, [loadProformas, loadOrders, loadReceptions]);

  const refreshAll = useCallback(() => {
    console.log('🔄 Rafraîchissement global...');
    setForceReload(prev => prev + 1);
    loadProformas();
    loadOrders();
    loadReceptions();
  }, [loadProformas, loadOrders, loadReceptions]);

  // État de chargement pour l'onglet actif
  const getActiveTabLoading = () => {
    switch (activeTab) {
      case 'proformas':
        return loadingProformas;
      case 'commandes':
        return loadingOrders;
      case 'receptions':
        return loadingReceptions;
      default:
        return false;
    }
  };

  const loading = getActiveTabLoading();

  // ============================================================================
  // FONCTIONS DE GESTION DES DOCUMENTS
  // ============================================================================

  // Archivage des documents
  const archiverDocument = async (type: 'proforma' | 'commande' | 'reception', id: string, data: any) => {
    try {
      const reference = data.numero_demande || data.numero_commande || `REC-${id.slice(-8).toUpperCase()}`;
      
      const { error } = await supabase
        .from('documents_archives')
        .insert({
          type_document: type,
          reference: reference,
          data: data,
          archive_par: utilisateur!.id,
          date_archivage: new Date().toISOString()
        });

      if (error) throw error;
      
      alert('Document archivé avec succès !');
      refreshAll();
      
    } catch (error) {
      console.error('Erreur archivage:', error);
      alert('Erreur lors de l\'archivage');
    }
  };

  // Utilitaires pour les statuts
  const getStatusColor = (statut: string, type: 'proforma' | 'commande' | 'reception' = 'commande') => {
    const colors: any = {
      proforma: {
        brouillon: 'bg-gray-100 text-gray-700',
        envoyee: 'bg-blue-100 text-blue-700',
        recu: 'bg-amber-100 text-amber-700',
        validee: 'bg-green-100 text-green-700',
        refusee: 'bg-red-100 text-red-700',
        transformee: 'bg-purple-100 text-purple-700'
      },
      commande: {
        en_attente: 'bg-blue-100 text-blue-700',
        partielle: 'bg-amber-100 text-amber-700',
        complete: 'bg-green-100 text-green-700',
        annulee: 'bg-red-100 text-red-700'
      }
    };

    return colors[type]?.[statut] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (statut: string, type: 'proforma' | 'commande' = 'commande') => {
    const labels: any = {
      proforma: {
        brouillon: 'Brouillon',
        envoyee: 'Envoyée',
        recu: 'Reçue',
        validee: 'Validée',
        refusee: 'Refusée',
        transformee: 'Transformée'
      },
      commande: {
        en_attente: 'En attente',
        partielle: 'Partielle',
        complete: 'Complète',
        annulee: 'Annulée'
      }
    };

    return labels[type]?.[statut] || statut;
  };

  // ============================================================================
  // RENDU DES FORMULAIRES MODAUX
  // ============================================================================

  if (showProformaForm) {
    return (
      <ProformaForm
        proforma={selectedProforma}
        onClose={() => {
          setShowProformaForm(false);
          setSelectedProforma(null);
          refreshAll();
        }}
      />
    );
  }

  if (showOrderForm) {
    return (
      <OrderForm
        proforma={selectedProforma}
        onClose={() => {
          setShowOrderForm(false);
          setSelectedProforma(null);
          refreshAll();
        }}
      />
    );
  }

  if (showReception && selectedOrder) {
    console.log('🎯 Rendu de ReceptionForm avec commande:', selectedOrder.id);
    return (
      <ReceptionForm
        commande={selectedOrder}
        onClose={() => {
          console.log('🔒 Fermeture ReceptionForm');
          setShowReception(false);
          setSelectedOrder(null);
          setTimeout(() => refreshAll(), 1000);
        }}
        onReceptionSuccess={(commandeId) => {
          console.log('✅ Réception réussie pour commande:', commandeId);
          setTimeout(() => refreshAll(), 500);
        }}
      />
    );
  }

  if (showHistory && (selectedOrder || selectedProforma)) {
    return (
      <HistoryModal
        commande={selectedOrder}
        proforma={selectedProforma}
        onClose={() => {
          setShowHistory(false);
          setSelectedOrder(null);
          setSelectedProforma(null);
        }}
      />
    );
  }


  // ============================================================================
  // RENDU PRINCIPAL
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Composants d'impression */}
      {showProformaPrint && selectedProformaForPrint && (
        <ProformaPrint
          proforma={selectedProformaForPrint}
          isVisible={showProformaPrint}
          onClose={() => {
            setShowProformaPrint(false);
            setSelectedProformaForPrint(null);
          }}
          onArchive={() => archiverDocument('proforma', selectedProformaForPrint.id, selectedProformaForPrint)}
        />
      )}

      {showCommandePrint && selectedCommandeForPrint && (
        <CommandePrint
          commande={selectedCommandeForPrint}
          isVisible={showCommandePrint}
          onClose={() => {
            setShowCommandePrint(false);
            setSelectedCommandeForPrint(null);
          }}
          onArchive={() => archiverDocument('commande', selectedCommandeForPrint.id, selectedCommandeForPrint)}
        />
      )}

      {showReceptionPrint && selectedReceptionForPrint && selectedCommandeForReception && (
        <ReceptionPrint
          reception={selectedReceptionForPrint}
          commande={selectedCommandeForReception}
          isVisible={showReceptionPrint}
          onClose={() => {
            setShowReceptionPrint(false);
            setSelectedReceptionForPrint(null);
            setSelectedCommandeForReception(null);
          }}
          onArchive={() => archiverDocument('reception', selectedReceptionForPrint.id, {
            ...selectedReceptionForPrint,
            commande: selectedCommandeForReception
          })}
        />
      )}

     
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Achats</h2>
          <p className="text-gray-600 mt-1">Workflow complet : Pro-forma → Commande → Réception</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraîchir Tout
          </button>

          <button
            onClick={() => {
              console.log('🔄 Rechargement manuel forcé');
              setForceReload(prev => prev + 1);
              loadData();
            }}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Recharger Données
          </button>

          {activeTab === 'proformas' && (
            <button
              onClick={() => {
                setSelectedProforma(null);
                setShowProformaForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <FileText className="w-5 h-5" />
              Nouveau Pro-forma
            </button>
          )}
          {activeTab === 'commandes' && (
            <button
              onClick={() => setShowOrderForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Commande
            </button>
          )}
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('proformas')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'proformas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            Demandes Pro-forma
            <span className={`text-xs px-2 py-1 rounded-full ${
              proformas.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {proformas.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('commandes')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'commandes'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            Commandes
            <span className={`text-xs px-2 py-1 rounded-full ${
              orders.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('receptions')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'receptions'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="w-5 h-5" />
            Réceptions
            <span className={`text-xs px-2 py-1 rounded-full ${
              receptions.length > 0 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {receptions.length}
            </span>
          </button>
        </div>

        <div className="p-6">
          {/* Barre de recherche */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeTab === 'proformas' ? 'Rechercher un pro-forma...' :
                  activeTab === 'commandes' ? 'Rechercher une commande...' :
                  'Rechercher une réception...'
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Contenu des onglets */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'proformas' && (
                <ProformasList 
                  proformas={proformas}
                  searchTerm={searchTerm}
                  expandedProforma={expandedProforma}
                  onToggleProforma={setExpandedProforma}
                  onEditProforma={(proforma) => {
                    setSelectedProforma(proforma);
                    setShowProformaForm(true);
                  }}
                  onCreateOrder={(proforma) => {
                    setSelectedProforma(proforma);
                    setShowOrderForm(true);
                  }}
                  onViewHistory={(proforma) => {
                    setSelectedProforma(proforma);
                    setShowHistory(true);
                  }}
                  onPrintProforma={(proforma) => {
                    setSelectedProformaForPrint(proforma);
                    setShowProformaPrint(true);
                  }}
                  onArchiveProforma={(proforma) => {
                    archiverDocument('proforma', proforma.id, proforma);
                  }}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                />
              )}

              {activeTab === 'commandes' && (
                <OrdersList 
                  orders={orders}
                  searchTerm={searchTerm}
                  expandedOrder={expandedOrder}
                  onToggleOrder={setExpandedOrder}
                  onReception={(order) => {
                    console.log('🎯 Clic sur réception pour commande:', order.id);
                    setSelectedOrder(order);
                    setShowReception(true);
                  }}
                  onViewHistory={(order) => {
                    setSelectedOrder(order);
                    setShowHistory(true);
                  }}
                  onPrintCommande={(order) => {
                    setSelectedCommandeForPrint(order);
                    setShowCommandePrint(true);
                  }}
                  onArchiveCommande={(order) => {
                    archiverDocument('commande', order.id, order);
                  }}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                />
              )}

              {activeTab === 'receptions' && (
                <ReceptionsList 
                  receptions={receptions}
                  searchTerm={searchTerm}
                  onPrintReception={(reception: any, commande: any) => {
                    setSelectedReceptionForPrint(reception);
                    setSelectedCommandeForReception(commande);
                    setShowReceptionPrint(true);
                  }}
                  onArchiveReception={(reception: any, commande: any) => {
                    archiverDocument('reception', reception.id, {
                      ...reception,
                      commande: commande
                    });
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANTS D'AFFICHAGE
// ============================================================================

function ProformasList({ 
  proformas, 
  searchTerm, 
  expandedProforma, 
  onToggleProforma, 
  onEditProforma, 
  onCreateOrder, 
  onViewHistory, 
  onPrintProforma,
  onArchiveProforma,
  getStatusColor, 
  getStatusLabel 
}: any) {
  const filteredProformas = proformas.filter((p: any) =>
    p.numero_demande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.fournisseurs?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredProformas.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune demande de pro-forma trouvée</p>
        <p className="text-sm text-gray-400 mt-1">Créez votre première demande de pro-forma</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredProformas.map((proforma: any) => (
        <div key={proforma.id} className="border border-gray-200 rounded-lg hover:shadow-md transition">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onToggleProforma(proforma.id === expandedProforma ? null : proforma.id)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition"
                >
                  {expandedProforma === proforma.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                <div>
                  <p className="font-mono font-bold text-lg">{proforma.numero_demande}</p>
                  <p className="text-gray-600">
                    {proforma.fournisseurs?.nom} • 
                    {new Date(proforma.date_demande).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {Number(proforma.montant_estime).toLocaleString('fr-FR')} F
                  </p>
                  <p className="text-sm text-gray-600">
                    {proforma.demandes_proforma_lignes?.length || 0} produit(s)
                  </p>
                </div>
                
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proforma.statut, 'proforma')}`}>
                  {getStatusLabel(proforma.statut, 'proforma')}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewHistory(proforma)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
                  >
                    <History className="w-4 h-4" />
                    Historique
                  </button>

                  <button
                    onClick={() => onPrintProforma(proforma)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer
                  </button>

                  <button
                    onClick={() => onArchiveProforma(proforma)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                  >
                    <Archive className="w-4 h-4" />
                    Archiver
                  </button>
                  
                  {proforma.statut === 'brouillon' && (
                    <button
                      onClick={() => onEditProforma(proforma)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Modifier
                    </button>
                  )}
                  
                  {['validee', 'recu', 'envoyee', 'brouillon'].includes(proforma.statut) && (
                    <button
                      onClick={() => onCreateOrder(proforma)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Créer Commande
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {expandedProforma === proforma.id && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              {(!proforma.demandes_proforma_lignes || proforma.demandes_proforma_lignes.length === 0) ? (
                <p className="text-gray-500 text-center py-4">Chargement des détails...</p>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Produits demandés:</h4>
                  {proforma.demandes_proforma_lignes.map((ligne: any, index: number) => (
                    <div key={ligne.id || index} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{ligne.produits?.nom}</p>
                        <p className="text-sm text-gray-600">
                          Code: {ligne.produits?.code_produit} | 
                          Quantité: {ligne.quantite_demandee}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-sm text-gray-600">Prix estimé</p>
                          <p className="font-bold">{ligne.prix_unitaire_estime || 'N/A'} F</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Prix proposé</p>
                          <p className="font-bold">{ligne.prix_unitaire_propose || 'N/A'} F</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {proforma.remarques && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Remarques:</p>
                      <p className="text-sm text-blue-700 mt-1">{proforma.remarques}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OrdersList({ 
  orders, 
  searchTerm, 
  expandedOrder, 
  onToggleOrder, 
  onReception, 
  onViewHistory, 
  onPrintCommande,
  onArchiveCommande,
  getStatusColor, 
  getStatusLabel 
}: any) {
  const filteredOrders = orders.filter((o: any) =>
    o.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.fournisseurs?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.bon_commande_numero?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getReceptionPercentage = (order: any) => {
    if (!order.commande_fournisseur_lignes || order.commande_fournisseur_lignes.length === 0) return 0;
    
    const totalCommandee = order.commande_fournisseur_lignes.reduce((sum: number, ligne: any) => 
      sum + (ligne.quantite_commandee || 0), 0
    );
    const totalRecue = order.commande_fournisseur_lignes.reduce((sum: number, ligne: any) => 
      sum + (ligne.quantite_recue || 0), 0
    );
    
    return totalCommandee > 0 ? Math.round((totalRecue / totalCommandee) * 100) : 0;
  };

  if (filteredOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune commande trouvée</p>
        <p className="text-sm text-gray-400 mt-1">
          {orders.length === 0 ? 'Créez votre première commande' : 'Aucun résultat pour votre recherche'}
        </p>
        {orders.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {orders.length} commande(s) dans la base de données mais filtrées
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredOrders.map((order: any) => {
        const receptionPercentage = getReceptionPercentage(order);
        
        return (
          <div key={order.id} className="border border-gray-200 rounded-lg hover:shadow-md transition">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onToggleOrder(order.id === expandedOrder ? null : order.id)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition"
                  >
                    {expandedOrder === order.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-lg">{order.numero_commande}</p>
                      {order.demandes_proforma && (
                        <span className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded-full">
                          Depuis proforma
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">
                      {order.fournisseurs?.nom || 'Fournisseur inconnu'} • 
                      {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                      {order.bon_commande_numero && ` • BC: ${order.bon_commande_numero}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {Number(order.montant_total).toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-sm text-gray-600">
                      {receptionPercentage}% réceptionné
                    </p>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.statut, 'commande')}`}>
                    {getStatusLabel(order.statut, 'commande')}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewHistory(order)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
                    >
                      <History className="w-4 h-4" />
                      Historique
                    </button>

                    <button
                      onClick={() => onPrintCommande(order)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimer
                    </button>

                    <button
                      onClick={() => onArchiveCommande(order)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                    >
                      <Archive className="w-4 h-4" />
                      Archiver
                    </button>
                    
                    {order.statut !== 'complete' && order.statut !== 'annulee' && (
                      <button
                        onClick={() => {
                          console.log('🎯 Bouton réception cliqué pour:', order.numero_commande);
                          onReception(order);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-green-600 hover:bg-green-50 rounded-lg transition text-sm"
                      >
                        <Truck className="w-4 h-4" />
                        Réception
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {expandedOrder === order.id && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {(!order.commande_fournisseur_lignes || order.commande_fournisseur_lignes.length === 0) ? (
                  <div>
                    <p className="text-gray-500 text-center py-4">Aucun détail de produit disponible</p>
                    <div className="text-xs text-gray-400 text-center">
                      <p>ID: {order.id}</p>
                      <p>Créée le: {new Date(order.created_at).toLocaleString('fr-FR')}</p>
                      {order.demandes_proforma && (
                        <p>Proforma source: {order.demandes_proforma.numero_demande}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Produits commandés:</h4>
                    {order.commande_fournisseur_lignes.map((ligne: any, index: number) => (
                      <div key={ligne.id || index} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                        <div className="flex-1">
                          <p className="font-medium">{ligne.produits?.nom || 'Produit inconnu'}</p>
                          <p className="text-sm text-gray-600">
                            Code: {ligne.produits?.code_produit || 'N/A'} | 
                            Prix: {ligne.prix_unitaire} F
                          </p>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-sm text-gray-600">Commandé</p>
                            <p className="font-bold">{ligne.quantite_commandee}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Reçu</p>
                            <p className={`font-bold ${
                              ligne.quantite_recue === ligne.quantite_commandee ? 'text-green-600' :
                              ligne.quantite_recue > 0 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {ligne.quantite_recue || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Restant</p>
                            <p className="font-bold">
                              {ligne.quantite_commandee - (ligne.quantite_recue || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {order.demandes_proforma && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">
                          Pro-forma source: {order.demandes_proforma.numero_demande}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReceptionsList({ 
  receptions = [],
  searchTerm, 
  onPrintReception,
  onArchiveReception 
}: any) {
  const safeReceptions = Array.isArray(receptions) ? receptions : [];
  
  const filteredReceptions = safeReceptions.filter((r: any) =>
    r.commandes_fournisseurs?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.commandes_fournisseurs?.fournisseurs?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredReceptions.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune réception trouvée</p>
        <p className="text-sm text-gray-400 mt-1">
          {safeReceptions.length === 0 
            ? 'Les réceptions apparaîtront ici après validation' 
            : 'Aucun résultat pour votre recherche'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredReceptions.map((reception: any) => (
        <div key={reception.id} className="border border-gray-200 rounded-lg hover:shadow-md transition">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Truck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-mono font-bold text-lg">
                    {reception.commandes_fournisseurs?.numero_commande || 'N/A'}
                  </p>
                  <p className="text-gray-600">
                    {reception.commandes_fournisseurs?.fournisseurs?.nom || 'Fournisseur inconnu'} • 
                    {new Date(reception.date_reception).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm text-gray-500">
                    Type: {reception.type_reception === 'totale' ? 'Complète' : 'Partielle'} • 
                    {reception.reception_lignes?.length || 0} article(s) • 
                    {reception.quantite_totale_recue || reception.reception_lignes?.reduce((sum: number, l: any) => sum + (l.quantite_recue || 0), 0) || 0} unité(s)
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-green-600 text-lg">
                    {reception.quantite_totale_recue || reception.reception_lignes?.reduce((sum: number, l: any) => sum + (l.quantite_recue || 0), 0) || 0} unités
                  </p>
                  <p className="text-sm text-gray-600">
                    Réceptionné par: {reception.recu_par_details?.nom_complet || 'Non spécifié'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPrintReception(reception, reception.commandes_fournisseurs)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer
                  </button>

                  <button
                    onClick={() => onArchiveReception(reception, reception.commandes_fournisseurs)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                  >
                    <Archive className="w-4 h-4" />
                    Archiver
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-3">Articles reçus:</h4>
            <div className="space-y-2">
              {(reception.reception_lignes || []).map((ligne: any, index: number) => (
                <div key={ligne.id || index} className="flex justify-between items-center p-2 bg-white rounded border">
                  <div className="flex-1">
                    <p className="font-medium">{ligne.produits?.nom || 'Produit inconnu'}</p>
                    <p className="text-sm text-gray-600">
                      Lot: {ligne.lot || 'N/A'} | 
                      Expiration: {ligne.date_expiration ? new Date(ligne.date_expiration).toLocaleDateString('fr-FR') : 'N/A'} |
                      État: 
                      <span className={`
                        ml-1 px-2 py-1 rounded-full text-xs
                        ${ligne.etat_produit === 'conforme' ? 'bg-green-100 text-green-700' : ''}
                        ${ligne.etat_produit === 'non_conforme' ? 'bg-red-100 text-red-700' : ''}
                        ${ligne.etat_produit === 'endommage' ? 'bg-amber-100 text-amber-700' : ''}
                      `}>
                        {ligne.etat_produit === 'conforme' ? 'Conforme' : 
                         ligne.etat_produit === 'non_conforme' ? 'Non conforme' : 
                         ligne.etat_produit === 'endommage' ? 'Endommagé' : 'N/A'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{ligne.quantite_recue || 0} unités</p>
                    <p className="text-sm text-gray-600">sur {ligne.quantite_commandee || 0} commandées</p>
                  </div>
                </div>
              ))}
            </div>
            
            {reception.remarques && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Remarques:</p>
                <p className="text-sm text-blue-700 mt-1">{reception.remarques}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
