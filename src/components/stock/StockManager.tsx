import { useState, useEffect } from 'react';
import { Package, RefreshCw, Search, Plus, Layers, X, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';

interface StockItem {
  id: string;
  produit_id: string;
  quantite: number;
  lot_numero: string;
  date_reception: string;
  date_expiration: string | null;
  emplacement: string | null;
  prix_achat_lot: number;
  remarques?: string;
  produits?: { id: string; nom: string; code_produit: string; stock_minimum: number };
}

interface Produit {
  id: string;
  nom: string;
  code_produit: string;
  stock_minimum: number;
}

export function StockManager() {
  const { utilisateur } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grouped' | 'detailed'>('grouped');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    produit_id: '', quantite: 1, lot_numero: '', date_reception: new Date().toISOString().split('T')[0],
    date_expiration: '', emplacement: '', prix_achat_lot: 0, remarques: ''
  });

  useEffect(() => {
    if (utilisateur) loadAllData();
  }, [utilisateur]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [stockData, produitsData] = await Promise.all([
        repository.getStock(utilisateur!.pharmacy_id),
        repository.getProduits(utilisateur!.pharmacy_id)
      ]);
      
      const stockEnrichi = stockData.map(item => ({
        ...item,
        produits: produitsData.find(p => p.id === item.produit_id)
      }));
      
      setStock(stockEnrichi);
      setProduits(produitsData);
    } catch (error) {
      console.error('❌ Erreur chargement stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedStock = produits.map(produit => {
    const lotsProduit = stock.filter(item => item.produit_id === produit.id);
    const quantite_totale = lotsProduit.reduce((total, item) => total + (item.quantite || 0), 0);
    return {
      produit,
      quantite_totale,
      lots: lotsProduit.sort((a, b) => new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime())
    };
  }).filter(group => group.lots.length > 0);

  const filteredGroups = groupedStock.filter(group =>
    group.produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.produit.code_produit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.lots.some(lot => lot.lot_numero?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

const handleAddStock = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.produit_id) return alert('Veuillez sélectionner un produit');

  setFormLoading(true);
  try {
    // ✅ Détection automatique du dépôt principal
    const depot = await repository.getDepotPrincipal(utilisateur!.pharmacy_id);
    
    if (!depot) {
      alert('⚠️ Aucun dépôt configuré. Veuillez créer au moins un magasin.');
      setFormLoading(false);
      return;
    }

    await repository.ajouterEntreeStock({
      ...formData,
      pharmacy_id: utilisateur!.pharmacy_id,
      magasin_id: depot.id, // ✅ Dynamique
      utilisateur_id: utilisateur!.id
    });

    setFormData({ 
      produit_id: '', quantite: 1, lot_numero: '', 
      date_reception: new Date().toISOString().split('T')[0],
      date_expiration: '', emplacement: '', prix_achat_lot: 0, remarques: '' 
    });
    setShowAddForm(false);
    await loadAllData();
    alert(`✅ Stock ajouté avec succès dans le dépôt : ${depot.nom}`);
  } catch (error: any) {
    alert('❌ Erreur: ' + error.message);
  } finally {
    setFormLoading(false);
  }
};

  const getLotDisplay = (item: StockItem) => item.lot_numero || 'Non spécifié';
  const getStockStatusColor = (quantite: number, min: number = 0) => {
    if (quantite === 0) return 'bg-red-100 text-red-700';
    if (quantite <= min) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-6">
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold">Ajouter du Stock</h3>
              <button onClick={() => setShowAddForm(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Produit *</label>
                <select value={formData.produit_id} onChange={(e) => setFormData({...formData, produit_id: e.target.value})} className="w-full p-3 border rounded-lg" required>
                  <option value="">Sélectionner un produit</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom} - {p.code_produit}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium mb-2">Quantité *</label><input type="number" min="1" value={formData.quantite} onChange={(e) => setFormData({...formData, quantite: parseInt(e.target.value) || 1})} className="w-full p-3 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-2">Numéro de lot *</label><input type="text" value={formData.lot_numero} onChange={(e) => setFormData({...formData, lot_numero: e.target.value})} className="w-full p-3 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-2">Date de réception *</label><input type="date" value={formData.date_reception} onChange={(e) => setFormData({...formData, date_reception: e.target.value})} className="w-full p-3 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium mb-2">Date d'expiration</label><input type="date" value={formData.date_expiration} onChange={(e) => setFormData({...formData, date_expiration: e.target.value})} className="w-full p-3 border rounded-lg" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-3 border rounded-lg">Annuler</button>
                <button type="submit" disabled={formLoading} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                  <Save className="w-4 h-4" /> {formLoading ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion du Stock</h2>
          <p className="text-gray-600 mt-1">Inventaire et gestion des stocks par produit et lot</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('grouped')} className={`px-3 py-2 rounded-md transition ${viewMode === 'grouped' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600'}`}>
              <Layers className="w-4 h-4 inline mr-2" />Groupé
            </button>
            <button onClick={() => setViewMode('detailed')} className={`px-3 py-2 rounded-md transition ${viewMode === 'detailed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600'}`}>
              <Package className="w-4 h-4 inline mr-2" />Détail Lots
            </button>
          </div>
          <button onClick={loadAllData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            <Plus className="w-5 h-5" /> Ajouter au Stock
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher par produit, code ou numéro de lot..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" />
        </div>

        {viewMode === 'grouped' ? (
          filteredGroups.length === 0 ? (
            <div className="text-center py-12"><Package className="w-16 h-16 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">Aucun stock trouvé</p></div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.produit.id} className="border rounded-lg hover:shadow-md transition">
                  <div className="p-4 bg-gray-50 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setExpandedProduct(expandedProduct === group.produit.id ? null : group.produit.id)} className="p-1 hover:bg-gray-200 rounded-lg">
                        {expandedProduct === group.produit.id ? <Layers className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                      </button>
                      <div>
                        <h3 className="font-bold text-lg">{group.produit.nom}</h3>
                        <p className="text-gray-600 text-sm">Code: {group.produit.code_produit} • {group.lots.length} lot(s)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{group.quantite_totale} unités</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(group.quantite_totale, group.produit.stock_minimum)}`}>
                        {group.quantite_totale === 0 ? 'Rupture' : group.quantite_totale <= group.produit.stock_minimum ? 'Stock bas' : 'Disponible'}
                      </span>
                    </div>
                  </div>
                  {expandedProduct === group.produit.id && (
                    <div className="border-t p-4 space-y-3">
                      {group.lots.map((lot) => (
                        <div key={lot.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                          <div>
                            <p className="font-medium">Lot: <span className="font-mono bg-blue-50 px-2 py-1 rounded">{getLotDisplay(lot)}</span></p>
                            <p className="text-sm text-gray-600 mt-1">
                              Réception: {new Date(lot.date_reception).toLocaleDateString('fr-FR')} • 
                              Expiration: {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString('fr-FR') : 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div><p className="text-sm text-gray-600">Quantité</p><p className="font-bold text-lg">{lot.quantite}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Produit</th>
                  <th className="text-left py-3 px-4 font-semibold">Code</th>
                  <th className="text-left py-3 px-4 font-semibold">Lot</th>
                  <th className="text-center py-3 px-4 font-semibold">Quantité</th>
                  <th className="text-left py-3 px-4 font-semibold">Réception</th>
                  <th className="text-left py-3 px-4 font-semibold">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {stock.filter(s => s.produits?.nom.toLowerCase().includes(searchTerm.toLowerCase()) || s.lot_numero?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{item.produits?.nom}</td>
                    <td className="py-3 px-4 font-mono text-sm">{item.produits?.code_produit}</td>
                    <td className="py-3 px-4 font-mono text-sm">{getLotDisplay(item)}</td>
                    <td className="py-3 px-4 text-center font-bold">{item.quantite}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(item.date_reception).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-4 text-gray-600">{item.date_expiration ? new Date(item.date_expiration).toLocaleDateString('fr-FR') : '-'}</td>
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
