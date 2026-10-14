import { useState, useEffect, useMemo } from 'react';
import { Package, RefreshCw, Search, Warehouse, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';

interface Magasin {
  id: string;
  nom: string;
  code: string;
  type: string;
  actif: boolean;
}

interface StockItem {
  id: string;
  produit_id: string;
  magasin_id: string | null;
  quantite: number;
  lot_numero: string;
  date_expiration: string | null;
  produits?: { nom: string; code_produit: string; prix_vente?: number };
}

export function StockParMagasin() {
  const { utilisateur } = useAuth();
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [depotPrincipal, setDepotPrincipal] = useState<Magasin | null>(null);
  const [selectedMagasinId, setSelectedMagasinId] = useState<string | null>(null);
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ État pour distinguer "Tous", "Pharmacie (null)" et "Magasin spécifique"
  const [filterType, setFilterType] = useState<'all' | 'null' | 'specific'>('all');

  useEffect(() => {
    if (utilisateur && utilisateur.pharmacy_id) {
      loadInitialData();
    }
  }, [utilisateur]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Charger les magasins
      const magasinsData = await repository.getMagasins(utilisateur!.pharmacy_id);
      setMagasins(magasinsData || []);
      
      // 2. ✅ FORCER la détection du dépôt principal
      let depot = await repository.getDepotPrincipal(utilisateur!.pharmacy_id);
      
      if (!depot && magasinsData && magasinsData.length > 0) {
        depot = magasinsData.find(m => 
          m.type === 'entrepot' || 
          m.nom.toLowerCase().includes('dépôt') || 
          m.nom.toLowerCase().includes('depot') ||
          m.nom.toLowerCase().includes('principal')
        ) || null;
      }
      
      if (!depot && magasinsData && magasinsData.length > 0) {
        depot = magasinsData[0];
      }
      
      setDepotPrincipal(depot);

      // 3. Charger TOUT le stock et les produits
      const stockData = await repository.getStock(utilisateur!.pharmacy_id);
      const produitsData = await repository.getProduits(utilisateur!.pharmacy_id);
      
      const stockEnrichi = stockData.map(item => ({
        ...item,
        produits: produitsData.find(p => p.id === item.produit_id)
      }));
      
      setAllStock(stockEnrichi);

      // 4. ✅ SÉLECTIONNER AUTOMATIQUEMENT LE DÉPÔT PRINCIPAL
      if (depot) {
        console.log('✅ Dépôt principal sélectionné par défaut:', depot.nom, depot.id);
        setSelectedMagasinId(depot.id);
        setFilterType('specific');
      } else if (stockData && stockData.length > 0) {
        const premierMagasinId = stockData.find(s => s.magasin_id)?.magasin_id;
        console.log('⚠️ Pas de dépôt trouvé, utilisation du premier magasin du stock:', premierMagasinId);
        setSelectedMagasinId(premierMagasinId || null);
        setFilterType(premierMagasinId ? 'specific' : 'all');
      }
    } catch (error) {
      console.error('❌ Erreur chargement données stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const magasinsIdsDansStock = useMemo(() => {
    const ids = new Set<string | null>();
    allStock.forEach(item => ids.add(item.magasin_id));
    return Array.from(ids);
  }, [allStock]);

  const emplacementsDisponibles = useMemo(() => {
    const emplacements: Array<{ id: string | null; nom: string; type: string; icon: string }> = [];
    
    // 1. Pharmacie Principale (magasin_id = null)
    emplacements.push({
      id: null,
      nom: 'Pharmacie Principale',
      type: 'pharmacie',
      icon: '🏥'
    });

    // 2. Dépôt Principal
    if (depotPrincipal) {
      emplacements.push({
        id: depotPrincipal.id,
        nom: `${depotPrincipal.nom} (Dépôt Principal)`,
        type: 'entrepot',
        icon: '🏭'
      });
    }

    // 3. Autres magasins
    magasins
      .filter(m => m.id !== depotPrincipal?.id)
      .forEach(m => {
        emplacements.push({
          id: m.id,
          nom: m.nom,
          type: m.type || 'magasin',
          icon: '🏪'
        });
      });

    // 4. Magasins inconnus présents dans le stock
    magasinsIdsDansStock.forEach(magasinId => {
      if (magasinId === null) return;
      if (depotPrincipal && magasinId === depotPrincipal.id) return;
      if (magasins.some(m => m.id === magasinId)) return;
      
      emplacements.push({
        id: magasinId,
        nom: `Magasin inconnu (${magasinId.slice(0, 8)}...)`,
        type: 'inconnu',
        icon: '⚠️'
      });
    });

    return emplacements;
  }, [magasins, depotPrincipal, allStock, magasinsIdsDansStock]);

  // ✅ CORRECTION : Filtrage robuste SANS duplication de variable
  const filteredStock = useMemo(() => {
    return allStock.filter(item => {
      let matchMagasin = true;
      
      if (filterType === 'null') {
        // Uniquement Pharmacie Principale (magasin_id = null)
        matchMagasin = item.magasin_id === null;
      } else if (filterType === 'specific' && selectedMagasinId) {
        // Uniquement un magasin spécifique
        matchMagasin = item.magasin_id === selectedMagasinId;
      }
      // Si filterType === 'all', matchMagasin reste true (Tous les emplacements)
      
      const matchSearch = !searchTerm || 
        item.produits?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.produits?.code_produit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lot_numero?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchMagasin && matchSearch && item.quantite > 0;
    });
  }, [allStock, selectedMagasinId, filterType, searchTerm]);

  const getStockStatusColor = (quantite: number) => {
    if (quantite === 0) return 'bg-red-100 text-red-700';
    if (quantite < 10) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const totalUnites = filteredStock.reduce((sum, s) => sum + (s.quantite || 0), 0);
  const totalValeur = filteredStock.reduce((sum, s) => sum + ((s.quantite || 0) * (s.produits?.prix_vente || 0)), 0);

  const emplacementActuel = emplacementsDisponibles.find(e => e.id === selectedMagasinId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Stock par Magasin</h2>
          <p className="text-gray-600 mt-1">Consultez l'inventaire détaillé de chaque point de vente</p>
        </div>
        <button onClick={loadInitialData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner un emplacement ({emplacementsDisponibles.length} disponible(s))
          </label>
          <select
            value={selectedMagasinId ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              // ✅ CORRECTION : Mise à jour conjointe de filterType et selectedMagasinId
              if (value === '') {
                setFilterType('all');
                setSelectedMagasinId(null); 
              } else if (value === 'pharmacie-principale') {
                setFilterType('null');
                setSelectedMagasinId(null); 
              } else {
                setFilterType('specific');
                setSelectedMagasinId(value);
              }
            }}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Tous les emplacements --</option>
            
            {depotPrincipal && (
              <option key={depotPrincipal.id} value={depotPrincipal.id}>
                🏭 {depotPrincipal.nom} (Dépôt Principal) - {allStock.filter(s => s.magasin_id === depotPrincipal.id && s.quantite > 0).length} produits
              </option>
            )}
            
            <option value="pharmacie-principale">
               🏥 Pharmacie Principale - {allStock.filter(s => s.magasin_id === null && s.quantite > 0).length} produits
            </option>
            
            {magasins
              .filter(m => m.id !== depotPrincipal?.id)
              .map((magasin) => (
                <option key={magasin.id} value={magasin.id}>
                  🏪 {magasin.nom} ({magasin.code}) - {allStock.filter(s => s.magasin_id === magasin.id && s.quantite > 0).length} produits
                </option>
              ))}
          </select>
          
          {depotPrincipal && (
            <p className="text-xs text-gray-500 mt-1">
               ID Dépôt Principal : <code className="bg-gray-100 px-1 rounded">{depotPrincipal.id}</code>
            </p>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Recherche rapide</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom, code ou lot..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Emplacement actuel</p>
              <p className="text-lg font-bold text-gray-900">
                {emplacementActuel ? `${emplacementActuel.icon} ${emplacementActuel.nom}` : 'Tous'}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total unités</p>
              <p className="text-2xl font-bold text-emerald-600">{totalUnites}</p>
            </div>
            <Package className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valeur totale (PV)</p>
              <p className="text-2xl font-bold text-amber-600">{totalValeur.toLocaleString('fr-FR')} F</p>
            </div>
            <span className="text-2xl">💰</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="text-center py-12">
            <Warehouse className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun stock trouvé</p>
            <p className="text-gray-400 text-sm">
              {filterType === 'all' 
                ? 'Aucun stock dans aucun emplacement.' 
                : searchTerm 
                  ? 'Aucun résultat pour votre recherche.' 
                  : 'Cet emplacement ne contient pas de stock.'}
            </p>
            
            {/* ✅ DEBUG : Afficher les IDs des magasins dans le stock */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left text-xs">
              <p className="font-bold mb-2"> Debug - Magasins présents dans le stock :</p>
              <ul className="space-y-1">
                {magasinsIdsDansStock.map((id, idx) => (
                  <li key={idx} className="font-mono">
                    {id === null ? '🏥 Pharmacie Principale (null)' : ` ${id}`}
                    {depotPrincipal && id === depotPrincipal.id && ' ✅ = Dépôt Principal'}
                    {magasins.some(m => m.id === id) && ` (${magasins.find(m => m.id === id)?.nom})`}
                  </li>
                ))}
              </ul>
              {depotPrincipal && (
                <p className="mt-2 text-blue-600">
                   ID Dépôt Principal attendu : <code>{depotPrincipal.id}</code>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Produit</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Quantité</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Expiration</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((item) => {
                  const isExpired = item.date_expiration && new Date(item.date_expiration) < new Date();
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-3 px-4 font-medium">{item.produits?.nom || 'Produit inconnu'}</td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-600">{item.produits?.code_produit || '-'}</td>
                      <td className="py-3 px-4 font-mono text-sm text-blue-600">{item.lot_numero || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStockStatusColor(item.quantite)}`}>
                          {item.quantite}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.date_expiration ? new Date(item.date_expiration).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isExpired ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Périmé</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Valide</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
