// src/components/inventory/InventoryParMagasin.tsx
import { useState, useEffect } from 'react';
import { 
  Plus, Search, ClipboardList, Play, CheckCircle, AlertCircle, 
  TrendingDown, TrendingUp, Trash2, Eye, Package, RefreshCw, Warehouse
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Magasin {
  id: string;
  nom: string;
  code: string;
  type: string;
  actif: boolean;
}

interface Inventaire {
  id: string;
  magasin_id: string;
  date_inventaire: string;
  statut: 'en_cours' | 'termine' | 'valide';
  remarques?: string;
  realise_par: string;
  created_at: string;
  utilisateurs?: {
    nom_complet: string;
  };
}

export function InventoryParMagasin() {
  const { utilisateur } = useAuth();
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState<Magasin | null>(null);
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInventory, setShowNewInventory] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventaire | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (utilisateur && utilisateur.pharmacy_id) {
      loadMagasins();
    }
  }, [utilisateur]);

  const loadMagasins = async () => {
    try {
      const { data, error } = await supabase
        .from('magasins')
        .select('*')
        .eq('pharmacie_principale_id', utilisateur!.pharmacy_id)
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setMagasins(data || []);
      
      if (data && data.length > 0 && !selectedMagasin) {
        setSelectedMagasin(data[0]);
        loadInventaires(data[0].id);
      }
    } catch (error) {
      console.error('Erreur chargement magasins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventaires = async (magasinId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventaires')
        .select(`
          *,
          utilisateurs!realise_par (
            nom_complet
          )
        `)
        .eq('magasin_id', magasinId)
        .order('date_inventaire', { ascending: false });

      if (error) throw error;
      setInventaires(data || []);
    } catch (error) {
      console.error('Erreur chargement inventaires:', error);
    }
  };

  const handleMagasinChange = async (magasinId: string) => {
    const magasin = magasins.find(m => m.id === magasinId);
    setSelectedMagasin(magasin || null);
    if (magasinId) {
      await loadInventaires(magasinId);
    }
  };

  const demarrerInventaire = async () => {
    if (!selectedMagasin) return;

    try {
      setCreateLoading(true);
      console.log('🔄 Démarrage inventaire pour magasin:', selectedMagasin.nom);

      const { data: inventory, error: inventoryError } = await supabase
        .from('inventaires')
        .insert({
          magasin_id: selectedMagasin.id,
          date_inventaire: new Date().toISOString().split('T')[0],
          statut: 'en_cours',
          realise_par: utilisateur!.id,
        })
        .select()
        .single();

      if (inventoryError) throw inventoryError;

      // Récupérer le stock du magasin
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select(`
          *,
          produits (*)
        `)
        .eq('magasin_id', selectedMagasin.id)
        .gt('quantite', 0);

      if (stockError) throw stockError;

      // Créer les lignes d'inventaire
      if (stock && stock.length > 0) {
        const lignesInventaire = stock.map(item => ({
          inventaire_id: inventory.id,
          produit_id: item.produit_id,
          quantite_theorique: item.quantite,
          quantite_physique: item.quantite,
          lot: item.lot_numero || null,
          date_expiration: item.date_expiration || null
        }));

        const { error: lignesError } = await supabase
          .from('inventaire_lignes')
          .insert(lignesInventaire);

        if (lignesError) throw lignesError;
      }

      setSelectedInventory(inventory);
      setShowNewInventory(true);
      await loadInventaires(selectedMagasin.id);
      
    } catch (error: any) {
      console.error('Erreur création inventaire:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setCreateLoading(false);
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
        magasin={selectedMagasin!}
        onClose={() => {
          setShowNewInventory(false);
          setSelectedInventory(null);
          if (selectedMagasin) {
            loadInventaires(selectedMagasin.id);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inventaires par Magasin</h2>
          <p className="text-gray-600 mt-1">Gestion des inventaires physiques par magasin</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => selectedMagasin && loadInventaires(selectedMagasin.id)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          {selectedMagasin && (
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
          )}
        </div>
      </div>

      {/* Sélecteur de magasin */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sélectionner un magasin
        </label>
        <select
          value={selectedMagasin?.id || ''}
          onChange={(e) => handleMagasinChange(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Choisir un magasin</option>
          {magasins.map((magasin) => (
            <option key={magasin.id} value={magasin.id}>
              {magasin.nom} ({magasin.code})
            </option>
          ))}
        </select>
      </div>

      {selectedMagasin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : inventaires.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun inventaire trouvé pour ce magasin</p>
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
                  {inventaires.map((inventory) => (
                    <tr key={inventory.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {inventory.utilisateurs?.nom_complet || 'Inconnu'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{inventory.remarques || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inventory.statut)}`}>
                          {getStatusLabel(inventory.statut)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
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
  );
}

// Formulaire d'inventaire (simplifié - même structure que l'existant mais avec magasin)
function InventoryForm({ inventory, magasin, onClose }: { inventory: any; magasin: Magasin; onClose: () => void }) {
  // ... Réutiliser la logique du formulaire d'inventaire existant
  // en s'assurant que les requêtes utilisent magasin_id
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Inventaire - {magasin.nom}
          </h2>
          <p className="text-gray-600 mt-1">
            du {new Date(inventory.date_inventaire).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          ✕
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-center text-gray-500 py-8">
          Formulaire d'inventaire à implémenter (même structure que l'existant)
        </p>
      </div>
    </div>
  );
}
