import { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, Trash2, Eye, Package, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { repository } from '../../lib/repository';
import { useAuth } from '../../contexts/AuthContext';

interface Magasin {
  id: string;
  nom: string;
  code: string;
  type: string;
}

interface Inventaire {
  id: string;
  pharmacy_id: string;
  magasin_id: string | null;
  date_inventaire: string;
  statut: 'en_cours' | 'termine' | 'valide';
  remarques?: string;
  realise_par: string;
  created_at: string;
  utilisateurs?: { nom_complet: string };
}

export function InventoryManager() {
  const { utilisateur } = useAuth();
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [depotPrincipal, setDepotPrincipal] = useState<Magasin | null>(null);
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('PHARMACIE');
  const [inventories, setInventories] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInventory, setShowNewInventory] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventaire | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (utilisateur) {
      loadMagasinsAndInventories();
    }
  }, [utilisateur, selectedMagasinId]);

  const loadMagasinsAndInventories = async () => {
    try {
      setLoading(true);
      
      const magasinsData = await repository.getMagasins(utilisateur!.pharmacy_id);
      const magasinsList = magasinsData || [];
      setMagasins(magasinsList);
      
      let depot = await repository.getDepotPrincipal(utilisateur!.pharmacy_id);
      if (!depot && magasinsList.length > 0) {
        depot = magasinsList.find(m => m.type === 'entrepot') || null;
      }
      setDepotPrincipal(depot);

      let query = supabase
        .from('inventaires')
        .select(`*, utilisateurs!inventaires_realise_par_fkey(nom_complet)`)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .order('date_inventaire', { ascending: false });

      if (selectedMagasinId === 'PHARMACIE') {
        query = query.is('magasin_id', null);
      } else if (selectedMagasinId === 'DEPOT') {
        if (depot) {
          query = query.eq('magasin_id', depot.id);
        } else {
          query = query.is('magasin_id', null);
        }
      } else if (selectedMagasinId !== 'ALL') {
        query = query.eq('magasin_id', selectedMagasinId);
      }

      const { data: invData, error: invError } = await query;
      if (invError) throw invError;
      setInventories(invData || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const demarrerInventaire = async () => {
    if (selectedMagasinId === 'ALL') {
      alert('Veuillez sélectionner un emplacement spécifique pour démarrer un inventaire.');
      return;
    }

    try {
      setCreateLoading(true);

      let magasinIdForDb: string | null = null;
      if (selectedMagasinId === 'PHARMACIE') {
        magasinIdForDb = null;
      } else if (selectedMagasinId === 'DEPOT') {
        magasinIdForDb = depotPrincipal?.id || null;
      } else {
        magasinIdForDb = selectedMagasinId;
      }

      const { data: inventory, error: inventoryError } = await supabase
        .from('inventaires')
        .insert({
          pharmacy_id: utilisateur!.pharmacy_id,
          magasin_id: magasinIdForDb,
          date_inventaire: new Date().toISOString().split('T')[0],
          statut: 'en_cours',
          realise_par: utilisateur!.id,
        })
        .select()
        .single();

      if (inventoryError) throw inventoryError;

      const stockData = await repository.getStock(utilisateur!.pharmacy_id);
      
      let filteredStock = stockData;
      if (selectedMagasinId === 'PHARMACIE') {
        filteredStock = stockData.filter(item => item.magasin_id === null);
      } else if (selectedMagasinId === 'DEPOT') {
        if (depotPrincipal) {
          filteredStock = stockData.filter(item => item.magasin_id === depotPrincipal.id);
        } else {
          filteredStock = stockData.filter(item => item.magasin_id === null);
        }
      } else {
        filteredStock = stockData.filter(item => item.magasin_id === selectedMagasinId);
      }

      console.log('📦 Stock trouvé pour inventaire:', filteredStock.length, 'produits');

      if (filteredStock && filteredStock.length > 0) {
        const lignesInventaire = filteredStock.map(item => ({
          inventaire_id: inventory.id,
          produit_id: item.produit_id,
          // ✅ CORRECTION : On retire stock_id pour éviter les erreurs de clé étrangère (409)
          // On le retrouvera dynamiquement lors de la validation
          magasin_id: magasinIdForDb,
          quantite_theorique: item.quantite,
          quantite_physique: item.quantite,
          lot: item.lot_numero || null,
          date_expiration: item.date_expiration || null
        }));

        const { error: lignesError } = await supabase.from('inventaire_lignes').insert(lignesInventaire);
        if (lignesError) throw lignesError;
        
        alert(`✅ Inventaire créé avec ${filteredStock.length} produits !`);
      } else {
        alert('⚠️ Aucun produit trouvé dans cet emplacement.\n\nVérifiez dans "Stock par Magasin" que des produits existent bien ici.');
        setCreateLoading(false);
        return;
      }

      setSelectedInventory(inventory);
      setShowNewInventory(true);
      await loadMagasinsAndInventories();
    } catch (error: any) {
      console.error('❌ Erreur:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const supprimerInventaire = async (inventory: Inventaire) => {
    if (inventory.statut === 'valide') {
      alert('Impossible de supprimer un inventaire déjà validé et ajusté.');
      return;
    }
    if (!confirm('Supprimer cet inventaire en cours ?')) return;

    try {
      await supabase.from('inventaire_lignes').delete().eq('inventaire_id', inventory.id);
      await supabase.from('inventaires').delete().eq('id', inventory.id);
      await loadMagasinsAndInventories();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const getMagasinNom = (id: string | null) => {
    if (id === null) return 'Pharmacie Principale';
    if (depotPrincipal && id === depotPrincipal.id) return depotPrincipal.nom;
    return magasins.find(m => m.id === id)?.nom || 'Inconnu';
  };

  if (showNewInventory && selectedInventory) {
    return (
      <InventoryForm
        inventory={selectedInventory}
        magasinNom={getMagasinNom(selectedInventory.magasin_id)}
        onClose={() => {
          setShowNewInventory(false);
          setSelectedInventory(null);
          loadMagasinsAndInventories();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Inventaires</h2>
          <p className="text-gray-600 mt-1">Inventaires physiques du stock par emplacement</p>
        </div>
        <button 
          onClick={demarrerInventaire} 
          disabled={createLoading || selectedMagasinId === 'ALL'} 
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Play className="w-5 h-5" />}
          {createLoading ? 'Création...' : 'Nouvel Inventaire'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Emplacement de l'inventaire</label>
          <select
            value={selectedMagasinId}
            onChange={(e) => setSelectedMagasinId(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">📍 Tous les emplacements (Historique)</option>
            <option value="PHARMACIE">🏥 Pharmacie Principale</option>
            {depotPrincipal && (
              <option value="DEPOT">🏭 {depotPrincipal.nom} (Dépôt Principal)</option>
            )}
            {magasins
              .filter(m => m.id !== depotPrincipal?.id)
              .map(m => (
                <option key={m.id} value={m.id}>🏪 {m.nom} ({m.code})</option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            💡 <strong>Pharmacie</strong> = où se font les ventes | <strong>Dépôt</strong> = où arrivent les réceptions
          </p>
        </div>
        <button onClick={loadMagasinsAndInventories} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition self-end">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
        ) : inventories.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun inventaire trouvé pour cet emplacement</p>
            {selectedMagasinId !== 'ALL' && (
              <button onClick={demarrerInventaire} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
                Démarrer le premier inventaire
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Emplacement</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Réalisé par</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inventory) => (
                  <tr key={inventory.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">{new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-4 text-gray-600">{getMagasinNom(inventory.magasin_id)}</td>
                    <td className="py-3 px-4 text-gray-600">{(inventory.utilisateurs as any)?.nom_complet || 'Inconnu'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inventory.statut === 'valide' ? 'bg-green-100 text-green-700' : 
                        inventory.statut === 'termine' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inventory.statut === 'valide' ? 'Validé' : inventory.statut === 'termine' ? 'Terminé' : 'En cours'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setSelectedInventory(inventory); setShowNewInventory(true); }} className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm">
                          <Eye className="w-4 h-4" /> {inventory.statut === 'en_cours' ? 'Continuer' : 'Voir'}
                        </button>
                        {inventory.statut !== 'valide' && (
                          <button onClick={() => supprimerInventaire(inventory)} className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition text-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- FORMULAIRE D'INVENTAIRE ---
function InventoryForm({ inventory, magasinNom, onClose }: { inventory: any; magasinNom: string; onClose: () => void }) {
  const { utilisateur } = useAuth();
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarques, setRemarques] = useState(inventory.remarques || '');

  useEffect(() => {
    loadLignes();
  }, [inventory]);

  const loadLignes = async () => {
    try {
      const { data, error } = await supabase
        .from('inventaire_lignes')
        .select(`*, produits(id, nom, code_produit)`)
        .eq('inventaire_id', inventory.id)
        .order('produits(nom)');
      if (error) throw error;
      setLignes(data?.map(l => ({ ...l, ecart: l.quantite_physique - l.quantite_theorique })) || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantite = (id: string, qte: number) => {
    setLignes(prev => prev.map(l => l.id === id ? { ...l, quantite_physique: qte, ecart: qte - l.quantite_theorique } : l));
  };

  const sauvegarder = async (statut: 'termine' | 'valide') => {
    setSaving(true);
    try {
      for (const ligne of lignes) {
        await supabase.from('inventaire_lignes').update({
          quantite_physique: ligne.quantite_physique,
          etat_produit: ligne.etat_produit || 'conforme',
          remarques_ligne: ligne.remarques_ligne || null
        }).eq('id', ligne.id);
      }

      await supabase.from('inventaires').update({ statut, remarques }).eq('id', inventory.id);

      if (statut === 'valide') {
        for (const ligne of lignes) {
          if (ligne.ecart !== 0) {
            // ✅ CORRECTION : On retrouve le stock dynamiquement par produit, magasin et lot
            const { data: stockData, error: stockError } = await supabase
              .from('stock')
              .select('id')
              .eq('pharmacy_id', utilisateur!.pharmacy_id)
              .eq('produit_id', ligne.produit_id)
              .eq('magasin_id', ligne.magasin_id)
              .eq('lot_numero', ligne.lot || null)
              .maybeSingle(); // Utilise maybeSingle au cas où il y aurait des doublons

            if (stockError || !stockData) {
              console.error('Erreur recherche stock pour ajustement:', stockError);
              continue;
            }

            // Mise à jour du stock
            await supabase.from('stock').update({
              quantite: ligne.quantite_physique,
              updated_at: new Date().toISOString()
            }).eq('id', stockData.id);

            // Historique
            await supabase.from('historique_ajustements_stock').insert({
              pharmacy_id: utilisateur!.pharmacy_id,
              produit_id: ligne.produit_id,
              stock_id: stockData.id,
              type_operation: 'ajustement',
              quantite_avant: ligne.quantite_theorique,
              quantite_apres: ligne.quantite_physique,
              quantite_ajustee: ligne.ecart,
              type_ajustement: ligne.ecart > 0 ? 'inventaire' : (ligne.etat_produit === 'perime' ? 'perime' : 'manque'),
              motif: ligne.remarques_ligne || 'Ajustement inventaire',
              lot_numero: ligne.lot,
              utilisateur_id: utilisateur!.id,
              reference_document: inventory.id
            });
          }
        }
      }

      alert(`Inventaire ${statut === 'termine' ? 'terminé' : 'validé et stocks ajustés'} !`);
      onClose();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventaire : {magasinNom}</h2>
          <p className="text-gray-600">Date: {new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><AlertCircle className="w-6 h-6" /></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarques générales</label>
          <textarea value={remarques} onChange={(e) => setRemarques(e.target.value)} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Observations..." />
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {lignes.map((ligne) => (
            <div key={ligne.id} className={`border-2 rounded-lg p-4 ${ligne.ecart === 0 ? 'border-green-200 bg-green-50' : ligne.ecart > 0 ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-lg">{ligne.produits?.nom}</p>
                  <p className="text-sm text-gray-600">Lot: {ligne.lot || 'N/A'} | Code: {ligne.produits?.code_produit}</p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${ligne.ecart === 0 ? 'text-green-600' : ligne.ecart > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                  </span>
                  <p className="text-xs text-gray-600">{ligne.quantite_theorique} → {ligne.quantite_physique}</p>
                </div>
              </div>

              {inventory.statut !== 'valide' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Stock théorique</label>
                    <input type="number" value={ligne.quantite_theorique} readOnly className="w-full px-3 py-2 border bg-gray-100 rounded-lg text-center" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Stock physique *</label>
                    <input type="number" min="0" value={ligne.quantite_physique} onChange={(e) => updateQuantite(ligne.id, parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">État</label>
                    <select value={ligne.etat_produit || 'conforme'} onChange={(e) => setLignes(prev => prev.map(l => l.id === ligne.id ? { ...l, etat_produit: e.target.value } : l))} className="w-full px-3 py-2 border rounded-lg">
                      <option value="conforme">Conforme</option>
                      <option value="endommage">Endommagé</option>
                      <option value="perime">Périmé</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Remarques</label>
                    <input type="text" value={ligne.remarques_ligne || ''} onChange={(e) => setLignes(prev => prev.map(l => l.id === ligne.id ? { ...l, remarques_ligne: e.target.value } : l))} className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Cassé..." />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-6 pt-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{inventory.statut === 'valide' ? 'Fermer' : 'Annuler'}</button>
          {inventory.statut === 'en_cours' && (
            <button onClick={() => sauvegarder('termine')} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Terminer l'inventaire</button>
          )}
          {inventory.statut === 'termine' && (
            <button onClick={() => sauvegarder('valide')} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" /> {saving ? 'Validation...' : 'Valider et ajuster les stocks'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
