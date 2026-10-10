import { useState, useEffect } from 'react';
import { Package, MinusCircle, AlertTriangle, Save, X, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';

interface Produit {
  id: string;
  nom: string;
  code_produit: string;
  stock_minimum: number;
}

interface StockItem {
  id: string;
  produit_id: string;
  quantite: number;
  lot_numero: string;
  date_expiration: string | null;
  emplacement: string | null;
  produits?: Produit;
}

interface AjustementStock {
  produit_id: string;
  stock_id: string;
  quantite: number;
  type_ajustement: 'perte' | 'casse' | 'endommagement' | 'vol' | 'autre';
  motif: string;
  date_ajustement: string;
  lot_numero?: string;
  emplacement?: string;
}

export function StockAdjustments() {
  const { utilisateur } = useAuth();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  
  const [ajustement, setAjustement] = useState<AjustementStock>({
    produit_id: '', stock_id: '', quantite: 0, type_ajustement: 'perte',
    motif: '', date_ajustement: new Date().toISOString().split('T')[0],
    lot_numero: '', emplacement: ''
  });

  useEffect(() => {
    if (utilisateur) loadStock();
  }, [utilisateur]);

  const loadStock = async () => {
    try {
      setLoading(true);
      // ✅ LECTURE LOCALE VIA REPOSITORY (Fonctionne hors-ligne)
      const stockData = await repository.getStock(utilisateur!.pharmacy_id);
      const produitsData = await repository.getProduits(utilisateur!.pharmacy_id);
      
      const stockEnrichi = stockData.map(item => ({
        ...item,
        produits: produitsData.find(p => p.id === item.produit_id)
      }));
      
      setStock(stockEnrichi);
    } catch (error) {
      console.error('❌ Erreur chargement stock local:', error);
    } finally {
      setLoading(false);
    }
  };

  const stockFiltre = stock.filter(item =>
    item.produits?.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    item.produits?.code_produit.toLowerCase().includes(recherche.toLowerCase()) ||
    item.lot_numero?.toLowerCase().includes(recherche.toLowerCase())
  );

  const initierAjustement = (item: StockItem) => {
    setSelectedStock(item);
    setAjustement({
      produit_id: item.produit_id, stock_id: item.id, quantite: 0, type_ajustement: 'perte',
      motif: '', date_ajustement: new Date().toISOString().split('T')[0],
      lot_numero: item.lot_numero, emplacement: item.emplacement || ''
    });
    setShowForm(true);
  };

  const validerAjustement = async () => {
    if (!utilisateur || utilisateur.role !== 'admin') {
      alert('Seul un administrateur peut effectuer des ajustements de stock');
      return;
    }
    if (!ajustement.quantite || ajustement.quantite <= 0) return alert('Veuillez saisir une quantité valide');
    if (!ajustement.motif.trim()) return alert('Veuillez saisir un motif');
    if (!selectedStock || ajustement.quantite > selectedStock.quantite) return alert('La quantité à retirer ne peut pas dépasser le stock disponible');

    setSaving(true);
    try {
      // ✅ ENREGISTREMENT LOCAL + SYNC AUTOMATIQUE
      await repository.enregistrerSortieAjustement(
        utilisateur!.pharmacy_id, selectedStock.id, selectedStock.produit_id,
        ajustement.quantite, ajustement.motif, ajustement.type_ajustement,
        utilisateur!.id, ajustement.lot_numero || ''
      );

      alert('✅ Ajustement de stock enregistré avec succès!');
      setShowForm(false);
      setSelectedStock(null);
      setAjustement({ produit_id: '', stock_id: '', quantite: 0, type_ajustement: 'perte', motif: '', date_ajustement: new Date().toISOString().split('T')[0], lot_numero: '', emplacement: '' });
      await loadStock();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getTypeAjustementLabel = (type: string) => {
    const labels: Record<string, string> = { perte: 'Perte', casse: 'Casse', endommagement: 'Endommagement', vol: 'Vol', autre: 'Autre' };
    return labels[type] || type;
  };

  const getTypeAjustementColor = (type: string) => {
    const colors: Record<string, string> = { perte: 'bg-gray-100 text-gray-800', casse: 'bg-red-100 text-red-800', endommagement: 'bg-orange-100 text-orange-800', vol: 'bg-purple-100 text-purple-800', autre: 'bg-blue-100 text-blue-800' };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (utilisateur?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600">Seuls les administrateurs peuvent effectuer des ajustements de stock.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Ajustements de Stock</h2>
          <p className="text-gray-600 mt-1">Sorties manuelles pour pertes, casse, endommagement...</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input type="text" placeholder="Rechercher par produit, code ou numéro de lot..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
        ) : stockFiltre.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun produit en stock trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">Produit</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Lot</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Expiration</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Emplacement</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Stock actuel</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockFiltre.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium">{item.produits?.nom}</td>
                    <td className="py-4 px-4 font-mono text-sm">{item.produits?.code_produit}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{item.lot_numero || '-'}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{item.date_expiration ? new Date(item.date_expiration).toLocaleDateString('fr-FR') : '-'}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{item.emplacement || '-'}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${item.quantite <= (item.produits?.stock_minimum || 0) ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {item.quantite}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button onClick={() => initierAjustement(item)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition mx-auto">
                        <MinusCircle className="w-4 h-4" /> Sortie de stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && selectedStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Sortie de Stock</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-6 h-6" /></button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">Produit sélectionné</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Produit:</span><p className="text-blue-800">{selectedStock.produits?.nom}</p></div>
                <div><span className="font-medium">Code:</span><p className="font-mono text-blue-800">{selectedStock.produits?.code_produit}</p></div>
                <div><span className="font-medium">Numéro de Lot:</span><p className="text-blue-800">{selectedStock.lot_numero || 'Non spécifié'}</p></div>
                <div><span className="font-medium">Stock actuel:</span><p className="text-blue-800 font-bold">{selectedStock.quantite}</p></div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); validerAjustement(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type d'ajustement *</label>
                  <select value={ajustement.type_ajustement} onChange={(e) => setAjustement(prev => ({ ...prev, type_ajustement: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="perte">Perte</option><option value="casse">Casse</option><option value="endommagement">Endommagement</option><option value="vol">Vol</option><option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de l'ajustement *</label>
                  <input type="date" value={ajustement.date_ajustement} onChange={(e) => setAjustement(prev => ({ ...prev, date_ajustement: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité à retirer *</label>
                <input type="number" min="1" max={selectedStock.quantite} value={ajustement.quantite} onChange={(e) => setAjustement(prev => ({ ...prev, quantite: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder={`Max: ${selectedStock.quantite}`} required />
                <p className="text-sm text-gray-500 mt-1">Stock après ajustement: {selectedStock.quantite - ajustement.quantite}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motif détaillé *</label>
                <textarea value={ajustement.motif} onChange={(e) => setAjustement(prev => ({ ...prev, motif: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Décrivez la raison de cette sortie de stock..." required />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Confirmer la sortie'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
