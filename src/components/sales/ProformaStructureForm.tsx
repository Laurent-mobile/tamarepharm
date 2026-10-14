import { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Trash2, Building2, Percent, Save, FileText, ShoppingCart, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { v4 as uuidv4 } from 'uuid';

interface ProformaStructureFormProps {
  onClose: () => void;
  proformaToEdit?: any | null;
}

export function ProformaStructureForm({ onClose, proformaToEdit }: ProformaStructureFormProps) {
  const { utilisateur } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [dateBesoin, setDateBesoin] = useState('');
  const [tauxReduction, setTauxReduction] = useState(0);
  const [remarques, setRemarques] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lignes, setLignes] = useState<Array<{ id: string; produit: any; quantite: number; prix_unitaire: number; lot_numero?: string; date_expiration?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
  if (proformaToEdit && products.length > 0) {
    setSelectedClientId(proformaToEdit.client_structure_id || proformaToEdit.client_id || '');
    setDateBesoin(proformaToEdit.date_besoin || '');
    setTauxReduction(proformaToEdit.taux_reduction || 0);
    setRemarques(proformaToEdit.remarques || '');
    
    if (proformaToEdit.demandes_proforma_lignes && proformaToEdit.demandes_proforma_lignes.length > 0) {
      // Filtrer uniquement les lignes valides (avec un produit_id valide)
      const panier = proformaToEdit.demandes_proforma_lignes
        .filter((ligne: any) => ligne.produit_id && ligne.produit_id.trim() !== '')
        .map((ligne: any) => {
          const produitTrouve = products.find((p: any) => p.id === ligne.produit_id);
          return {
            id: ligne.id || uuidv4(),
            produit: produitTrouve || { 
              id: ligne.produit_id, 
              nom: ligne.produits?.nom || 'Produit inconnu', 
              code_produit: ligne.produits?.code_produit || '', 
              prix_vente: ligne.prix_unitaire_estime || 0 
            },
            quantite: ligne.quantite_demandee || 1,
            prix_unitaire: ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || 0,
            lot_numero: ligne.lot_numero || 'N/A',
            date_expiration: ligne.date_expiration || null
          };
        });
      setLignes(panier);
    } else {
      setLignes([]);
    }
  }
}, [proformaToEdit, products]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, productsData] = await Promise.all([
        repository.getClients(utilisateur!.pharmacy_id),
        repository.getProduits(utilisateur!.pharmacy_id)
      ]);
      const structures = clientsData.filter(c => c.type_relation === 'structure_acheteuse');
      setClients(structures);
      setProducts(productsData.filter(p => p.actif !== false));
    } catch (error) {
      console.error('Erreur chargement données proforma:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const search = searchTerm.toLowerCase();
    return products.filter(p => 
      p.nom.toLowerCase().includes(search) || 
      p.code_produit?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [searchTerm, products]);

const ajouterAuPanier = async (produit: any) => {
  try {
    const stockInfo = await repository.getFirstAvailableStock(utilisateur!.pharmacy_id, produit.id);
    
    // ✅ Vérifier si le stock existe avant d'ajouter
    if (!stockInfo) {
      alert(`️ Le produit "${produit.nom}" n'a pas de stock disponible !`);
      return;
    }
    
    // ✅ Vérifier que le produit est valide
    if (!produit || !produit.id || !produit.nom) {
      console.error('❌ Produit invalide:', produit);
      alert('⚠️ Produit invalide !');
      return;
    }
    
    const existing = lignes.find(l => l.produit.id === produit.id);
    if (existing) {
      setLignes(lignes.map(l => l.produit.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l));
    } else {
      setLignes([...lignes, { 
        id: uuidv4(),
        produit, 
        quantite: 1, 
        prix_unitaire: produit.prix_vente,
        lot_numero: stockInfo.lot_numero || stockInfo.lot || 'N/A',
        date_expiration: stockInfo.date_expiration || null
      }]);
    }
    setSearchTerm('');
  } catch (error) {
    console.error('❌ Erreur ajout au panier:', error);
    alert('Erreur lors de l\'ajout du produit');
  }
};

  const modifierQuantite = (ligneId: string, quantite: number) => {
    if (quantite <= 0) {
      setLignes(lignes.filter(l => l.id !== ligneId));
    } else {
      setLignes(lignes.map(l => l.id === ligneId ? { ...l, quantite } : l));
    }
  };

  const modifierLot = (ligneId: string, lot: string) => {
    setLignes(lignes.map(l => l.id === ligneId ? { ...l, lot_numero: lot } : l));
  };

  const supprimerLigne = (ligneId: string) => {
    setLignes(lignes.filter(l => l.id !== ligneId));
  };

  const sousTotal = lignes.reduce((sum, ligne) => sum + (ligne.quantite * ligne.prix_unitaire), 0);
  const montantReduction = (sousTotal * tauxReduction) / 100;
  const totalFinal = sousTotal - montantReduction;

   const handleSave = async () => {
    if (!selectedClientId) {
      alert('⚠️ Veuillez sélectionner une structure cliente.');
      return;
    }
    if (lignes.length === 0) {
      alert('⚠️ Veuillez ajouter au moins un produit au proforma.');
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!proformaToEdit;
      const numeroProforma = isEdit ? proformaToEdit.numero_demande : `PRO-${Date.now().toString().slice(-6)}`;
      
      const proformaData = {
        id: isEdit ? proformaToEdit.id : undefined,
        pharmacy_id: utilisateur!.pharmacy_id,
        client_structure_id: selectedClientId,
        client_id: selectedClientId,
        numero_demande: numeroProforma,
        date_demande: isEdit ? proformaToEdit.date_demande : new Date().toISOString().split('T')[0],
        date_besoin: dateBesoin || null,
        statut: 'brouillon',
        montant_estime: totalFinal,
        taux_reduction: tauxReduction,
        remarques: remarques || null,
        created_by: utilisateur!.id,
        updated_at: new Date().toISOString(),
      };

      const lignesData = lignes
        .filter(ligne => ligne.quantite > 0 && ligne.produit?.id)
        .map(ligne => ({
          id: isEdit ? ligne.id : uuidv4(),
          produit_id: ligne.produit.id,
          quantite_demandee: Math.max(1, Math.floor(ligne.quantite)),
          prix_unitaire_estime: ligne.produit.prix_vente,
          prix_unitaire_propose: ligne.prix_unitaire,
          lot_numero: ligne.lot_numero === 'N/A' ? null : ligne.lot_numero,
          date_expiration: ligne.date_expiration || null, // ✅ Sauvegarde de la date de péremption
          demande_id: isEdit ? proformaToEdit.id : undefined,
        }));

      if (lignesData.length === 0) {
        alert('⚠️ Aucune ligne valide à enregistrer.');
        setSaving(false);
        return;
      }

      if (isEdit) {
        // ✅ repository.updateProforma gère DÉJÀ la suppression des anciennes lignes et l'ajout des nouvelles !
        // Pas besoin de toucher à localDb ici.
        await repository.updateProforma(proformaToEdit.id, proformaData, lignesData);
        alert(`✅ Proforma ${numeroProforma} modifié avec succès !`);
      } else {
        await repository.createProforma(proformaData, lignesData);
        alert(`✅ Proforma ${numeroProforma} créé avec succès !`);
      }
      
      onClose();
    } catch (error: any) {
      console.error('Erreur sauvegarde proforma:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {proformaToEdit ? <Edit2 className="w-6 h-6 text-blue-600" /> : <FileText className="w-6 h-6 text-blue-600" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {proformaToEdit ? 'Modifier le Proforma' : 'Nouveau Proforma (Vente Structure)'}
              </h2>
              <p className="text-sm text-gray-500">
                {proformaToEdit ? `Édition du proforma ${proformaToEdit.numero_demande}` : 'Devis pour client structure (ne déstocke pas)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition"><X className="w-6 h-6 text-gray-600" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-blue-900 flex items-center gap-2"><Building2 className="w-5 h-5"/> Structure Acheteuse (B2B) *</h3>
              <select 
                value={selectedClientId} 
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Sélectionner une structure acheteuse --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.structure_acheteuse || client.nom_complet}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-gray-900">Conditions</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de besoin (Optionnel)</label>
                <input type="date" value={dateBesoin} onChange={(e) => setDateBesoin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-600" /> Remise de fidélité (%)
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={tauxReduction} 
                  onChange={(e) => setTauxReduction(parseFloat(e.target.value) || 0)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarques</label>
                <textarea 
                  value={remarques} 
                  onChange={(e) => setRemarques(e.target.value)} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: Livraison prévue à l'infirmerie centrale..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un produit par nom ou code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                {searchTerm && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => ajouterAuPanier(p)}
                        className="w-full text-left px-4 py-2 hover:bg-emerald-50 border-b border-gray-100 last:border-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{p.nom}</p>
                          <p className="text-xs text-gray-500">{p.code_produit} • Stock: {p.stock_minimum > 0 ? 'Disponible' : 'Faible'}</p>
                        </div>
                        <span className="font-bold text-emerald-600">{p.prix_vente} F</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
              {lignes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                  <ShoppingCart className="w-16 h-16 mb-4" />
                  <p>Aucun produit ajouté. Recherchez et ajoutez des produits.</p>
                </div>
              ) : (
                lignes.map((ligne) => (
                  // ✅ CORRECTION : Utiliser ligne.id comme clé unique au lieu de ligne.produit.id
                  <div key={ligne.id} className="flex flex-col p-3 border border-gray-200 rounded-lg hover:shadow-sm transition space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{ligne.produit.nom}</p>
                        <p className="text-xs text-gray-500">{ligne.produit.code_produit} • {ligne.prix_unitaire} F / unité</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-gray-300 rounded-lg">
                          <button onClick={() => modifierQuantite(ligne.id, ligne.quantite - 1)} className="px-3 py-1 hover:bg-gray-100 rounded-l-lg">-</button>
                          <span className="px-3 py-1 font-medium min-w-[40px] text-center">{ligne.quantite}</span>
                          <button onClick={() => modifierQuantite(ligne.id, ligne.quantite + 1)} className="px-3 py-1 hover:bg-gray-100 rounded-r-lg">+</button>
                        </div>
                        <p className="font-bold text-gray-900 w-24 text-right">{(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F</p>
                        <button onClick={() => supprimerLigne(ligne.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-600">Lot :</span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono">
                          {ligne.lot_numero || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-600">Péremption :</span>
                        <span className={`px-2 py-0.5 rounded font-mono ${
                          ligne.date_expiration && new Date(ligne.date_expiration) < new Date(Date.now() + 30*24*60*60*1000) 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {ligne.date_expiration ? new Date(ligne.date_expiration).toLocaleDateString('fr-FR') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Sous-total:</span>
                <span>{sousTotal.toLocaleString('fr-FR')} F</span>
              </div>
              {tauxReduction > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Remise fidélité ({tauxReduction}%):</span>
                  <span>- {montantReduction.toLocaleString('fr-FR')} F</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-900 border-t pt-2 mt-2">
                <span>Total Estimé:</span>
                <span>{totalFinal.toLocaleString('fr-FR')} F</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-4">
          <button onClick={onClose} disabled={saving} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition">
            Annuler
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || !selectedClientId || lignes.length === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" /> {saving ? 'Enregistrement...' : (proformaToEdit ? 'Modifier le Proforma' : 'Enregistrer le Proforma')}
          </button>
        </div>
      </div>
    </div>
  );
}
