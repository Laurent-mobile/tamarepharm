import { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle, X, Plus, Building2, Phone, User, Package, Edit2, Printer, Search, Filter, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { ProformaStructureForm } from '../sales/ProformaStructureForm';
import { DocumentPrintModal } from '../printing/DocumentPrintModal';

export function PaiementComptantManager() {
  const { utilisateur } = useAuth();
  const [activeTab, setActiveTab] = useState<'en-attente' | 'historique'>('en-attente');
  
  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProforma, setSelectedProforma] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [venteValidee, setVenteValidee] = useState<any>(null);
  
  const [showProformaForm, setShowProformaForm] = useState(false);
  const [proformaToEdit, setProformaToEdit] = useState<any>(null);

  const [searchHistory, setSearchHistory] = useState('');
  const [filterStatutHistory, setFilterStatutHistory] = useState('tous');
  const [detailsSale, setDetailsSale] = useState<any>(null);

  useEffect(() => {
    if (utilisateur) loadProformas();
  }, [utilisateur]);

  const loadProformas = async () => {
    setLoading(true);
    try {
      // repository.getProformasVentes s'occupe déjà d'enrichir les lignes avec les produits
      const data = await repository.getProformasVentes(utilisateur!.pharmacy_id);
      setProformas(data || []);
    } catch (error) {
      console.error('Erreur chargement proformas:', error);
      setProformas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProforma = (proforma: any) => {
    setProformaToEdit(proforma);
  };

    const handleReprint = (proforma: any) => {
    // ✅ Normaliser les lignes du proforma pour qu'elles ressemblent à des lignes de vente
    const lignesNormalisees = (proforma.demandes_proforma_lignes || []).map((ligne: any) => ({
      produit_id: ligne.produit_id,
      quantite: ligne.quantite_demandee,
      prix_unitaire: ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0,
      montant_total: (ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0) * (ligne.quantite_demandee || 0),
      lot: ligne.lot_numero || null,
      lot_numero: ligne.lot_numero || null,
      date_expiration: ligne.date_expiration || ligne.produits?.date_expiration || null,
      produits: ligne.produits // Déjà enrichi avec le nom du produit par getProformasVentes
    }));

    const mockVente = {
      id: proforma.id,
      pharmacy_id: proforma.pharmacy_id, 
      numero_vente: proforma.numero_demande,
      date_vente: proforma.date_demande,
      montant_total: proforma.montant_estime,
      clients: proforma.clients,
      lignes: lignesNormalisees, // ✅ On passe les lignes directement
      isProformaReprint: true // ✅ Flag pour indiquer au modal de ne pas chercher en base
    };
    
    setVenteValidee(mockVente);
    setShowPrintModal(true);
  };

  const handleDeleteProforma = async (proforma: any) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le proforma ${proforma.numero_demande} ?`)) return;
    try {
      await repository.deleteProforma(proforma.id);
      await loadProformas();
    } catch (error: any) {
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  const validerEtEnvoyerALaCaisse = async () => {
    if (!selectedProforma) return;
    
    try {
      const numeroVente = `PC-${Date.now().toString().slice(-6)}`;
      const reduction = selectedProforma.taux_reduction || 0;
      const montantReduction = (selectedProforma.montant_estime * reduction) / 100;
      const montantFinal = selectedProforma.montant_estime - montantReduction;

      const venteData = {
        pharmacy_id: utilisateur!.pharmacy_id,
        client_id: selectedProforma.client_structure_id || selectedProforma.client_id || null,
        numero_vente: numeroVente,
        date_vente: new Date().toISOString().split('T')[0],
        statut: 'en_attente_paiement',
        montant_total: montantFinal,
        montant_assurance: 0,
        montant_patient: montantFinal,
        vendeur_id: utilisateur!.id,
        caissier_id: utilisateur!.id,
        type_de_vente: 'ordinaire',
        ordonnance_presente: false,
        proforma_origine_id: selectedProforma.id,
      };

      const lignesVente = selectedProforma.demandes_proforma_lignes.map((ligne: any) => ({
        produit_id: ligne.produit_id,
        quantite: ligne.quantite_demandee,
        prix_unitaire: ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0,
        montant_total: (ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0) * ligne.quantite_demandee,
        lot: ligne.lot_numero || null,
        date_expiration: ligne.date_expiration || null,
      }));

      const venteCreee = await repository.transformerProformaEnVente(selectedProforma.id, venteData, lignesVente);
      
      alert(`✅ Proforma validé et déstocké !\n\nLa commande N° ${numeroVente} a été envoyée à la caisse pour encaissement de ${montantFinal.toLocaleString('fr-FR')} F.`);
      
      setVenteValidee(venteCreee);
      setShowPrintModal(true);
      setSelectedProforma(null);
      await loadProformas();
    } catch (error: any) {
      console.error('❌ Erreur validation paiement comptant:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const getStructureName = (pf: any) => {
    return pf.clients?.structure_acheteuse || pf.clients?.entreprise_employeur || pf.clients?.nom_complet || 'Structure Non Spécifiée';
  };

  const getStatusBadge = (statut: string) => {
    const styles: Record<string, string> = {
      brouillon: 'bg-gray-100 text-gray-700',
      envoyee: 'bg-blue-100 text-blue-700',
      recu: 'bg-amber-100 text-amber-700',
      validee: 'bg-green-100 text-green-700',
      transformee: 'bg-purple-100 text-purple-700',
    };
    return styles[statut] || 'bg-gray-100 text-gray-700';
  };

  const proformasEnAttente = useMemo(() => {
    return proformas.filter(p => p.statut !== 'transformee');
  }, [proformas]);

  const proformasHistorique = useMemo(() => {
    return proformas.filter(p => {
      const matchStatut = filterStatutHistory === 'tous' || p.statut === filterStatutHistory;
      const searchLower = searchHistory.toLowerCase();
      const matchSearch = !searchHistory || 
        p.numero_demande.toLowerCase().includes(searchLower) ||
        getStructureName(p).toLowerCase().includes(searchLower) ||
        p.clients?.nom_complet?.toLowerCase().includes(searchLower);
      
      return matchStatut && matchSearch;
    }).sort((a, b) => new Date(b.date_demande).getTime() - new Date(a.date_demande).getTime());
  }, [proformas, searchHistory, filterStatutHistory]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Ventes Structures</h2>
          <p className="text-gray-600 mt-1">Gérez les proformas, devis et encaissements des gros clients</p>
        </div>
        <button 
          onClick={() => setShowProformaForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" /> Nouveau Proforma
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('en-attente')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'en-attente' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            À traiter ({proformasEnAttente.length})
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'historique' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-5 h-5" />
            Historique des ventes
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'en-attente' && (
            loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
            ) : proformasEnAttente.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Aucun proforma en attente de traitement</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Proforma</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Structure & Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Articles</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant Total</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {proformasEnAttente.map((pf) => {
                      const nbArticles = pf.demandes_proforma_lignes?.length || 0;
                      return (
                        <tr key={pf.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-blue-600">{pf.numero_demande}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{getStructureName(pf)}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" /> {pf.clients?.nom_complet || 'Contact non spécifié'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{new Date(pf.date_demande).toLocaleDateString('fr-FR')}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                              <Package className="w-3 h-3" /> {nbArticles}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {Number(pf.montant_estime).toLocaleString('fr-FR')} F
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadge(pf.statut)}`}>
                              {pf.statut}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {pf.statut === 'brouillon' ? (
                                <>
                                  <button 
                                    onClick={() => handleDeleteProforma(pf)} 
                                    className="inline-flex items-center gap-1 p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition" 
                                    title="Supprimer le brouillon"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleEditProforma(pf)} 
                                    className="inline-flex items-center gap-1 p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition" 
                                    title="Modifier"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setSelectedProforma(pf)} 
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium" 
                                    title="Valider"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Valider
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => setSelectedProforma(pf)} 
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                                >
                                  <CheckCircle className="w-4 h-4" /> Valider & Caisse
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'historique' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                    placeholder="Rechercher par N° Proforma, Structure ou Client..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={filterStatutHistory}
                    onChange={(e) => setFilterStatutHistory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="tous">Tous les statuts</option>
                    <option value="transformee">Ventes finalisées</option>
                    <option value="validee">Validées (en attente)</option>
                    <option value="brouillon">Brouillons</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
              ) : proformasHistorique.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Aucune vente trouvée avec ces critères</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Document</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Structure / Client</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant Total</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {proformasHistorique.map((pf) => (
                        <tr key={pf.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-gray-900">{pf.numero_demande}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{getStructureName(pf)}</div>
                            <div className="text-xs text-gray-500">{pf.clients?.nom_complet || ''}</div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{new Date(pf.date_demande).toLocaleDateString('fr-FR')}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {Number(pf.montant_estime).toLocaleString('fr-FR')} F
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadge(pf.statut)}`}>
                              {pf.statut}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {pf.statut === 'transformee' && (
                                <button 
                                  onClick={() => handleReprint(pf)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                                  title="Réimprimer Ticket, Facture ou BL"
                                >
                                  <Printer className="w-4 h-4" /> Réimprimer
                                </button>
                              )}
                              <button 
                                onClick={() => setDetailsSale(pf)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                                title="Voir le détail des produits"
                              >
                                <Eye className="w-4 h-4" /> Détails
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedProforma && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  Valider et Envoyer à la Caisse
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Cette action va <strong>déstocker</strong> les produits et créer une vente en attente d'encaissement.
                </p>
              </div>
              <button onClick={() => setSelectedProforma(null)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5" /> Structure Cliente
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-lg text-gray-900">{getStructureName(selectedProforma)}</p>
                    <p className="flex items-center gap-2 text-gray-700"><User className="w-4 h-4 text-gray-500"/> Contact: {selectedProforma.clients?.nom_complet || 'Non spécifié'}</p>
                    {selectedProforma.clients?.telephone && (
                      <p className="flex items-center gap-2 text-gray-700"><Phone className="w-4 h-4 text-gray-500"/> {selectedProforma.clients.telephone}</p>
                    )}
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Récapitulatif Financier
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Montant initial:</span>
                      <span>{Number(selectedProforma.montant_estime).toLocaleString('fr-FR')} F</span>
                    </div>
                    {selectedProforma.taux_reduction > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Réduction fidélité ({selectedProforma.taux_reduction}%):</span>
                        <span>- {Number((selectedProforma.montant_estime * selectedProforma.taux_reduction / 100)).toLocaleString('fr-FR')} F</span>
                      </div>
                    )}
                    <div className="border-t border-emerald-300 pt-3 flex justify-between items-center">
                      <span className="font-bold text-emerald-900 text-lg">Net à Encaisser :</span>
                      <span className="font-bold text-emerald-700 text-2xl">
                        {Number(selectedProforma.montant_estime - (selectedProforma.montant_estime * (selectedProforma.taux_reduction || 0) / 100)).toLocaleString('fr-FR')} F
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-600" /> Produits Commandés
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-4 font-semibold text-gray-700">Désignation</th>
                        <th className="text-center py-2 px-4 font-semibold text-gray-700">Qté</th>
                        <th className="text-right py-2 px-4 font-semibold text-gray-700">Prix Unitaire</th>
                        <th className="text-right py-2 px-4 font-semibold text-gray-700">Total Ligne</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedProforma.demandes_proforma_lignes && selectedProforma.demandes_proforma_lignes.length > 0 ? (
                        selectedProforma.demandes_proforma_lignes.map((ligne: any, idx: number) => {
                          const prixU = ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0;
                          const totalLigne = prixU * ligne.quantite_demandee;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-gray-900">
                                {ligne.produits?.nom || 'Produit inconnu'}
                                <div className="text-xs text-gray-500 font-normal">{ligne.produits?.code_produit || ''}</div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-gray-700">{ligne.quantite_demandee}</td>
                              <td className="py-3 px-4 text-right text-gray-600">{Number(prixU).toLocaleString('fr-FR')} F</td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">{Number(totalLigne).toLocaleString('fr-FR')} F</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500">
                            Aucune ligne de produit trouvée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-4">
              <button onClick={() => setSelectedProforma(null)} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition">
                Annuler
              </button>
              <button onClick={validerEtEnvoyerALaCaisse} className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 transition shadow-lg">
                <CheckCircle className="w-5 h-5" /> Confirmer, Déstocker & Envoyer à la Caisse
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && venteValidee && (
        <DocumentPrintModal 
          vente={venteValidee} 
          onClose={() => { setShowPrintModal(false); setVenteValidee(null); }} 
        />
      )}

      {(showProformaForm || proformaToEdit) && (
        <ProformaStructureForm 
          proformaToEdit={proformaToEdit} 
          onClose={() => { 
            setShowProformaForm(false); 
            setProformaToEdit(null); 
            loadProformas(); 
          }} 
        />
      )}

      {detailsSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-600" />
                  Détails de la vente : {detailsSale.numero_demande}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Client : {detailsSale.clients?.structure_acheteuse || detailsSale.clients?.nom_complet || 'Non spécifié'}
                </p>
              </div>
              <button onClick={() => setDetailsSale(null)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Produit</th>
                    <th className="text-center py-2 px-4 font-semibold text-gray-700">Lot</th>
                    <th className="text-center py-2 px-4 font-semibold text-gray-700">Péremption</th>
                    <th className="text-center py-2 px-4 font-semibold text-gray-700">Qté</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Prix Unit.</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {detailsSale.demandes_proforma_lignes && detailsSale.demandes_proforma_lignes.length > 0 ? (
                    detailsSale.demandes_proforma_lignes.map((ligne: any, idx: number) => {
                      const prixU = ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {ligne.produits?.nom || 'Produit inconnu'}
                            <div className="text-xs text-gray-500 font-normal">{ligne.produits?.code_produit || ''}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-gray-600">{ligne.lot_numero || 'N/A'}</td>
                          <td className="py-3 px-4 text-center font-mono text-gray-600">
                            {ligne.date_expiration ? new Date(ligne.date_expiration).toLocaleDateString('fr-FR') : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-gray-700">{ligne.quantite_demandee}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{Number(prixU).toLocaleString('fr-FR')} F</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">{Number(prixU * ligne.quantite_demandee).toLocaleString('fr-FR')} F</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Aucune ligne de produit trouvée pour cette vente
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-right text-gray-900">Total Général :</td>
                    <td className="py-3 px-4 text-right text-emerald-700 text-lg">
                      {Number(detailsSale.montant_estime).toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end">
              <button 
                onClick={() => setDetailsSale(null)} 
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
