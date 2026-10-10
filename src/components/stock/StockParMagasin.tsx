import { useState, useEffect } from 'react';
import { Package, RefreshCw, Search, Warehouse } from 'lucide-react';
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
  const [selectedMagasin, setSelectedMagasin] = useState<Magasin | null>(null);
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (utilisateur && utilisateur.pharmacy_id) {
      loadInitialData();
    }
  }, [utilisateur]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Charger les magasins et identifier dynamiquement le dépôt principal
      const magasinsData = await repository.getMagasins(utilisateur!.pharmacy_id);
      setMagasins(magasinsData);
      
      const depot = await repository.getDepotPrincipal(utilisateur!.pharmacy_id);
      setDepotPrincipal(depot);

      // 2. Charger TOUT le stock en une seule fois (très rapide en local)
      const stockData = await repository.getStock(utilisateur!.pharmacy_id);
      const produitsData = await repository.getProduits(utilisateur!.pharmacy_id);
      
      // Enrichir le stock avec les noms des produits
      const stockEnrichi = stockData.map(item => ({
        ...item,
        produits: produitsData.find(p => p.id === item.produit_id)
      }));
      
      setAllStock(stockEnrichi);

      // 3. Sélectionner le dépôt principal par défaut, sinon le premier magasin
      if (depot) {
        setSelectedMagasin(depot);
      } else if (magasinsData.length > 0) {
        setSelectedMagasin(magasinsData[0]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement données stock:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage dynamique du stock en fonction du magasin sélectionné et de la recherche
  const filteredStock = allStock.filter(item => {
    // Filtrer par l'ID du magasin sélectionné (le dépôt principal a maintenant son propre ID grâce à la migration)
    const matchMagasin = selectedMagasin ? item.magasin_id === selectedMagasin.id : item.magasin_id === null;
    
    const matchSearch = !searchTerm || 
      item.produits?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.produits?.code_produit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lot_numero?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchMagasin && matchSearch && item.quantite > 0;
  });

  const getStockStatusColor = (quantite: number) => {
    if (quantite === 0) return 'bg-red-100 text-red-700';
    if (quantite < 10) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const totalUnites = filteredStock.reduce((sum, s) => sum + (s.quantite || 0), 0);
  const totalValeur = filteredStock.reduce((sum, s) => sum + ((s.quantite || 0) * (s.produits?.prix_vente || 0)), 0);

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

      {/* Sélecteur de magasin et recherche */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un emplacement</label>
          <select
            value={selectedMagasin?.id || ''}
            onChange={(e) => {
              if (!e.target.value) {
                setSelectedMagasin(null);
              } else {
                const magasin = magasins.find(m => m.id === e.target.value);
                setSelectedMagasin(magasin || depotPrincipal);
              }
            }}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Choisir un emplacement --</option>
            {depotPrincipal && (
              <option value={depotPrincipal.id}>🏭 {depotPrincipal.nom} (Dépôt Principal)</option>
            )}
            {magasins
              .filter(m => m.id !== depotPrincipal?.id) // Exclure le dépôt de la liste pour éviter les doublons
              .map((magasin) => (
                <option key={magasin.id} value={magasin.id}>🏪 {magasin.nom} ({magasin.code})</option>
              ))}
          </select>
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

      {/* Statistiques du magasin sélectionné */}
      {selectedMagasin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Références en stock</p>
                <p className="text-2xl font-bold text-gray-900">{filteredStock.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total unités</p>
                <p className="text-2xl font-bold text-emerald-600">{totalUnites}</p>
              </div>
              <span className="text-2xl">📦</span>
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
      )}

      {/* Tableau des stocks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : !selectedMagasin ? (
          <div className="text-center py-12">
            <Warehouse className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Veuillez sélectionner un magasin</p>
            <p className="text-gray-400 text-sm">Choisissez un emplacement dans le menu déroulant ci-dessus pour voir son inventaire.</p>
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun stock trouvé</p>
            <p className="text-gray-400 text-sm">{searchTerm ? 'Aucun résultat pour votre recherche' : 'Ce magasin ne contient pas encore de stock.'}</p>
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
                      <td className="py-3 px-4 font-medium">{item.produits?.nom}</td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-600">{item.produits?.code_produit}</td>
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
