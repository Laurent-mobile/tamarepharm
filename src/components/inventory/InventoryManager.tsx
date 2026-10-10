// components/inventory/InventoryManager.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, ClipboardList, Play, CheckCircle, AlertCircle, TrendingDown, TrendingUp, Trash2, Eye, Package, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Inventaire, Stock, Produit } from '../../types/database';

export function InventoryManager() {
  const { utilisateur } = useAuth();
  const [inventories, setInventories] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInventory, setShowNewInventory] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventaire | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (utilisateur) {
      loadInventories();
    }
  }, [utilisateur]);

  const loadInventories = async () => {
    try {
      const { data, error } = await supabase
        .from('inventaires')
        .select(`
          *,
          utilisateurs!realise_par (
            nom_complet
          )
        `)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .order('date_inventaire', { ascending: false });

      if (error) throw error;
      setInventories(data || []);
    } catch (error) {
      console.error('Erreur chargement inventaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const demarrerInventaire = async () => {
    try {
      setCreateLoading(true);
      console.log('🔄 Démarrage nouvel inventaire...');

      // 1. Créer l'inventaire
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventaires')
        .insert({
          pharmacy_id: utilisateur!.pharmacy_id,
          date_inventaire: new Date().toISOString().split('T')[0],
          statut: 'en_cours',
          realise_par: utilisateur!.id,
        })
        .select()
        .single();

      if (inventoryError) {
        console.error('❌ Erreur création inventaire:', inventoryError);
        throw inventoryError;
      }

      console.log('✅ Inventaire créé:', inventory.id);

      // 2. Récupérer le stock avec les produits
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select(`
          *,
          produits (
            id,
            nom,
            code_produit,
            forme,
            dosage,
            prix_achat,
            prix_vente,
            stock_minimum
          )
        `)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .gt('quantite', 0); // Seulement les produits avec stock > 0

      if (stockError) {
        console.error('❌ Erreur chargement stock:', stockError);
        throw stockError;
      }

      console.log('📦 Stock chargé:', stock?.length, 'produits');

      // 3. Créer les lignes d'inventaire (sans inclure la colonne ecart et etat_produit)
      if (stock && stock.length > 0) {
        const lignesInventaire = stock.map(item => {
          // Vérifier que le produit existe
          if (!item.produits) {
            console.warn('⚠️ Produit manquant pour item:', item.id);
            return null;
          }

          return {
            inventaire_id: inventory.id,
            produit_id: item.produit_id,
            quantite_theorique: item.quantite,
            quantite_physique: item.quantite, // Par défaut, on met la même quantité
            // NE PAS inclure 'ecart' - la base de données le calculera automatiquement
            // NE PAS inclure 'etat_produit' - la base de données utilisera la valeur par défaut
            lot: item.lot || null,
            date_expiration: item.date_expiration || null
          };
        }).filter(Boolean); // Filtrer les lignes nulles

        console.log('📝 Lignes à créer:', lignesInventaire.length);

        if (lignesInventaire.length > 0) {
          const { error: lignesError } = await supabase
            .from('inventaire_lignes')
            .insert(lignesInventaire);

          if (lignesError) {
            console.error('❌ Erreur création lignes:', lignesError);
            throw lignesError;
          }

          console.log('✅ Lignes d\'inventaire créées');
        } else {
          console.warn('⚠️ Aucune ligne d\'inventaire créée - vérifiez les données de stock');
        }
      } else {
        console.warn('⚠️ Aucun stock trouvé pour cette pharmacie');
      }

      setSelectedInventory(inventory);
      setShowNewInventory(true);
      await loadInventories();
      
    } catch (error: any) {
      console.error('❌ Erreur complète création inventaire:', error);
      alert('Erreur lors de la création de l\'inventaire: ' + error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const supprimerInventaire = async (inventory: Inventaire) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'inventaire du ${new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')} ? Cette action est irréversible.`)) {
      return;
    }

    try {
      setDeleteLoading(inventory.id);
      
      // Supprimer d'abord les lignes d'inventaire
      const { error: lignesError } = await supabase
        .from('inventaire_lignes')
        .delete()
        .eq('inventaire_id', inventory.id);

      if (lignesError) throw lignesError;

      // Supprimer l'historique associé
      const { error: histError } = await supabase
        .from('historique_inventaires')
        .delete()
        .eq('inventaire_id', inventory.id);

      if (histError) console.warn('Aucun historique à supprimer:', histError);

      // Supprimer l'inventaire
      const { error } = await supabase
        .from('inventaires')
        .delete()
        .eq('id', inventory.id);

      if (error) throw error;

      alert('Inventaire supprimé avec succès!');
      await loadInventories();
    } catch (error: any) {
      console.error('Erreur suppression inventaire:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'valide':
        return 'bg-green-100 text-green-700';
      case 'termine':
        return 'bg-blue-100 text-blue-700';
      case 'en_cours':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'valide':
        return 'Validé';
      case 'termine':
        return 'Terminé';
      case 'en_cours':
        return 'En cours';
      default:
        return statut;
    }
  };

  if (showNewInventory && selectedInventory) {
    return (
      <InventoryForm
        inventory={selectedInventory}
        onClose={() => {
          setShowNewInventory(false);
          setSelectedInventory(null);
          loadInventories();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Inventaires</h2>
          <p className="text-gray-600 mt-1">Inventaires physiques du stock</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadInventories}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={demarrerInventaire}
            disabled={createLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {createLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Play className="w-5 h-5" />
            )}
            {createLoading ? 'Création...' : 'Nouvel Inventaire'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : inventories.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun inventaire trouvé</p>
            <p className="text-sm text-gray-400 mt-1">Commencez par créer votre premier inventaire</p>
            <button
              onClick={demarrerInventaire}
              disabled={createLoading}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {createLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Play className="w-4 h-4" />
              )}
              {createLoading ? 'Création...' : 'Démarrer le premier inventaire'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Réalisé par</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Remarques</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inventory) => (
                  <tr key={inventory.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {(inventory.utilisateurs as any)?.nom_complet || 'Utilisateur inconnu'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{inventory.remarques || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inventory.statut)}`}>
                        {getStatusLabel(inventory.statut)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedInventory(inventory);
                            setShowNewInventory(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          {inventory.statut === 'en_cours' ? 'Continuer' : 'Voir'}
                        </button>
                        
                        {/* Bouton de suppression - seulement pour les inventaires non validés */}
                        {inventory.statut !== 'valide' && (
                          <button
                            onClick={() => supprimerInventaire(inventory)}
                            disabled={deleteLoading === inventory.id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition text-sm disabled:opacity-50"
                          >
                            {deleteLoading === inventory.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Supprimer
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

// Formulaire d'inventaire
function InventoryForm({ inventory, onClose }: { inventory: Inventaire, onClose: () => void }) {
  const { utilisateur } = useAuth();
  const [lignesInventaire, setLignesInventaire] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarques, setRemarques] = useState(inventory.remarques || '');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    loadLignesInventaire();
  }, [inventory, reloadCount]);

  const loadLignesInventaire = async () => {
    try {
      console.log('🔄 Chargement des lignes pour inventaire:', inventory.id);
      
      const { data, error } = await supabase
        .from('inventaire_lignes')
        .select(`
          *,
          produits (
            id,
            nom,
            code_produit,
            forme,
            dosage,
            prix_achat,
            prix_vente,
            stock_minimum
          )
        `)
        .eq('inventaire_id', inventory.id)
        .order('produits(nom)');

      if (error) {
        console.error('❌ Erreur chargement lignes:', error);
        throw error;
      }

      console.log('✅ Lignes chargées:', data?.length);
      
      // Calculer l'écart pour chaque ligne au chargement
      const lignesAvecEcartCalcule = data?.map(ligne => ({
        ...ligne,
        ecart: ligne.ecart || (ligne.quantite_physique - ligne.quantite_theorique)
      })) || [];

      setLignesInventaire(lignesAvecEcartCalcule);
    } catch (error) {
      console.error('Erreur chargement lignes inventaire:', error);
      setLignesInventaire([]);
    } finally {
      setLoading(false);
    }
  };

  const mettreAJourQuantitePhysique = (ligneId: string, quantite: number) => {
    setLignesInventaire(prev =>
      prev.map(ligne => {
        if (ligne.id === ligneId) {
          const ecart = quantite - ligne.quantite_theorique;
          return { ...ligne, quantite_physique: quantite, ecart };
        }
        return ligne;
      })
    );
  };

  const mettreAJourEtatProduit = (ligneId: string, etat: string) => {
    setLignesInventaire(prev =>
      prev.map(ligne => {
        if (ligne.id === ligneId) {
          return { ...ligne, etat_produit: etat };
        }
        return ligne;
      })
    );
  };

  const mettreAJourRemarques = (ligneId: string, remarques: string) => {
    setLignesInventaire(prev =>
      prev.map(ligne => {
        if (ligne.id === ligneId) {
          return { ...ligne, remarques_ligne: remarques };
        }
        return ligne;
      })
    );
  };

  const calculerStats = () => {
    const totalLignes = lignesInventaire.length;
    const lignesAvecEcart = lignesInventaire.filter(l => l.ecart !== 0).length;
    const totalEcart = lignesInventaire.reduce((sum, l) => sum + Math.abs(l.ecart), 0);
    
    return { totalLignes, lignesAvecEcart, totalEcart };
  };

  const sauvegarderInventaire = async (statut: 'termine' | 'valide') => {
    setSaving(true);
    try {
      // Mettre à jour les quantités physiques (sans inclure ecart dans la mise à jour)
      for (const ligne of lignesInventaire) {
        const { error } = await supabase
          .from('inventaire_lignes')
          .update({
            quantite_physique: ligne.quantite_physique,
            // Ne pas inclure 'ecart' - la base de données le calculera automatiquement
            etat_produit: ligne.etat_produit || 'conforme',
            remarques_ligne: ligne.remarques_ligne || null
          })
          .eq('id', ligne.id);

        if (error) throw error;
      }

      // Mettre à jour le statut de l'inventaire
      const { error: inventoryError } = await supabase
        .from('inventaires')
        .update({
          statut: statut,
          remarques: remarques,
        })
        .eq('id', inventory.id);

      if (inventoryError) throw inventoryError;

      // Si l'inventaire est validé, mettre à jour les stocks
      if (statut === 'valide') {
        await ajusterStocks();
      }

      alert(`Inventaire ${statut === 'termine' ? 'terminé' : 'validé'} avec succès!`);
      onClose();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const ajusterStocks = async () => {
    for (const ligne of lignesInventaire) {
      if (ligne.ecart !== 0) {
        // Mettre à jour le stock
        const { error: stockError } = await supabase
          .from('stock')
          .update({
            quantite: ligne.quantite_physique,
            updated_at: new Date().toISOString()
          })
          .eq('pharmacy_id', utilisateur!.pharmacy_id)
          .eq('produit_id', ligne.produit_id)
          .eq('lot', ligne.lot || null);

        if (stockError) {
          console.error('Erreur mise à jour stock:', stockError);
          // Continuer avec les autres produits même en cas d'erreur
          continue;
        }

        // Enregistrer dans l'historique
        const typeAjustement = ligne.ecart > 0 ? 'surplus' :
                               ligne.etat_produit === 'perime' ? 'perime' :
                               'manque'; // Simplifié pour éviter les erreurs

        const { error: histError } = await supabase
          .from('historique_inventaires')
          .insert({
            inventaire_id: inventory.id,
            produit_id: ligne.produit_id,
            lot: ligne.lot || null,
            quantite_avant: ligne.quantite_theorique,
            quantite_apres: ligne.quantite_physique,
            ecart: ligne.ecart,
            type_ajustement: typeAjustement,
            remarques: ligne.remarques_ligne
          });

        if (histError) {
          console.error('Erreur historique:', histError);
          // Continuer même en cas d'erreur d'historique
        }
      }
    }
  };

  const stats = calculerStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <span className="ml-2">Chargement des produits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Inventaire du {new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}
          </h2>
          <p className="text-gray-600 mt-1">
            Statut: <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              inventory.statut === 'en_cours' ? 'bg-amber-100 text-amber-700' : 
              inventory.statut === 'termine' ? 'bg-blue-100 text-blue-700' : 
              'bg-green-100 text-green-700'
            }`}>
              {inventory.statut === 'en_cours' ? 'En cours' : 
               inventory.statut === 'termine' ? 'Terminé' : 'Validé'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadCount(prev => prev + 1)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            ✕
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalLignes}</p>
          <p className="text-sm text-gray-600">Produits inventoriés</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.lignesAvecEcart}</p>
          <p className="text-sm text-gray-600">Écarts détectés</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.totalEcart}</p>
          <p className="text-sm text-gray-600">Total écarts (unités)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Remarques */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Remarques générales
          </label>
          <textarea
            value={remarques}
            onChange={(e) => setRemarques(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            placeholder="Observations sur l'inventaire..."
          />
        </div>

        {/* Liste des produits */}
        <div className="space-y-4">
          {lignesInventaire.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun produit trouvé pour cet inventaire</p>
              <p className="text-sm text-gray-400 mt-1">
                {inventory.statut === 'en_cours' 
                  ? 'Les produits devraient apparaître automatiquement' 
                  : 'Cet inventaire ne contient aucun produit'
                }
              </p>
              {inventory.statut === 'en_cours' && (
                <button
                  onClick={() => setReloadCount(prev => prev + 1)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Recharger les produits
                </button>
              )}
            </div>
          ) : (
            lignesInventaire.map((ligne) => (
              <div key={ligne.id} className={`border-2 rounded-lg p-4 ${
                (ligne.ecart || 0) === 0 ? 'border-green-200 bg-green-50' :
                (ligne.ecart || 0) > 0 ? 'border-blue-200 bg-blue-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Informations produit */}
                  <div>
                    <p className="font-bold text-lg">{ligne.produits?.nom || 'Produit inconnu'}</p>
                    <p className="text-sm text-gray-600">Code: {ligne.produits?.code_produit || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Lot: {ligne.lot || 'N/A'}</p>
                    {ligne.date_expiration && (
                      <p className="text-sm text-gray-600">
                        Expiration: {new Date(ligne.date_expiration).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>

                  {/* Résumé écart */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-2">
                      {(ligne.ecart || 0) > 0 && <TrendingUp className="w-5 h-5 text-blue-600" />}
                      {(ligne.ecart || 0) < 0 && <TrendingDown className="w-5 h-5 text-red-600" />}
                      {(ligne.ecart || 0) === 0 && <CheckCircle className="w-5 h-5 text-green-600" />}
                      <span className={`text-2xl font-bold ${
                        (ligne.ecart || 0) === 0 ? 'text-green-600' :
                        (ligne.ecart || 0) > 0 ? 'text-blue-600' :
                        'text-red-600'
                      }`}>
                        {(ligne.ecart || 0) > 0 ? '+' : ''}{ligne.ecart || 0}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {ligne.quantite_theorique} → {ligne.quantite_physique}
                    </p>
                  </div>
                </div>

                {/* Formulaire de saisie */}
                {inventory.statut !== 'valide' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Quantité théorique (lecture seule) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Stock théorique
                      </label>
                      <input
                        type="number"
                        value={ligne.quantite_theorique}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-center"
                        readOnly
                      />
                    </div>

                    {/* Quantité physique (à saisir) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stock physique *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ligne.quantite_physique}
                        onChange={(e) => mettreAJourQuantitePhysique(ligne.id, parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-bold"
                      />
                    </div>

                    {/* État du produit */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        État
                      </label>
                      <select
                        value={ligne.etat_produit || 'conforme'}
                        onChange={(e) => mettreAJourEtatProduit(ligne.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="conforme">Conforme</option>
                        <option value="endommage">Endommagé</option>
                        <option value="perime">Périmé</option>
                      </select>
                    </div>

                    {/* Remarques */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Remarques
                      </label>
                      <input
                        type="text"
                        value={ligne.remarques_ligne || ''}
                        onChange={(e) => mettreAJourRemarques(ligne.id, e.target.value)}
                        placeholder="ex: Cassé, Fuite..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* Affichage en mode lecture seule */}
                {inventory.statut === 'valide' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Stock théorique</p>
                      <p className="font-bold">{ligne.quantite_theorique}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Stock physique</p>
                      <p className="font-bold">{ligne.quantite_physique}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">État</p>
                      <p className="font-bold capitalize">
                        {ligne.etat_produit === 'endommage' ? 'Endommagé' :
                         ligne.etat_produit === 'perime' ? 'Périmé' : 'Conforme'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Remarques</p>
                      <p className="font-bold">{ligne.remarques_ligne || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            {inventory.statut === 'valide' ? 'Fermer' : 'Annuler'}
          </button>
          
          {inventory.statut === 'en_cours' && (
            <button
              onClick={() => sauvegarderInventaire('termine')}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Terminer l\'inventaire'}
            </button>
          )}
          
          {inventory.statut === 'termine' && (
            <button
              onClick={() => sauvegarderInventaire('valide')}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {saving ? 'Validation...' : 'Valider et ajuster les stocks'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
