import { useState, useEffect } from 'react';
import { AlertTriangle, Package, Trash2, FileText, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalStock, LocalProduit } from '../../lib/localDb';

export function PertesPerimesManager() {
  const { utilisateur } = useAuth();
  const [stocks, setStocks] = useState<(LocalStock & { produit?: LocalProduit })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeclassementForm, setShowDeclassementForm] = useState(false);
  
  const [formData, setFormData] = useState({
    stock_id: '',
    quantite: 1,
    motif: 'perime' as 'perime' | 'casse' | 'vol' | 'erreur_inventaire',
    remarques: ''
  });

  useEffect(() => {
    if (utilisateur) loadData();
  }, [utilisateur]);

  const loadData = async () => {
    try {
      setLoading(true);
      const stocksData = await repository.getStock(utilisateur!.pharmacy_id);
      const produitsData = await repository.getProduits(utilisateur!.pharmacy_id);
      
      // Filtrer : soit périmé, soit expirant dans moins de 90 jours, soit déjà déclaré périmé
      const today = new Date();
      const in90Days = new Date();
      in90Days.setDate(today.getDate() + 90);

      const filtered = stocksData
        .filter(s => {
          if (s.statut === 'perime' || s.statut === 'declasse') return true;
          if (s.date_expiration) {
            const expDate = new Date(s.date_expiration);
            return expDate <= in90Days && s.quantite > 0;
          }
          return false;
        })
        .map(s => ({
          ...s,
          produit: produitsData.find(p => p.id === s.produit_id)
        }))
        .sort((a, b) => new Date(a.date_expiration || '9999').getTime() - new Date(b.date_expiration || '9999').getTime());

      setStocks(filtered);
    } catch (error) {
      console.error('Erreur chargement pertes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclassement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.stock_id || formData.quantite <= 0) {
      alert('Veuillez sélectionner un lot et une quantité valide.');
      return;
    }

    try {
      await repository.declarerPerteOuPerime(
        utilisateur!.pharmacy_id,
        formData.stock_id,
        formData.quantite,
        formData.motif,
        formData.remarques,
        utilisateur!.id
      );
      
      alert('✅ Déclaration enregistrée avec succès !');
      setShowDeclassementForm(false);
      setFormData({ stock_id: '', quantite: 1, motif: 'perime', remarques: '' });
      loadData();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const valeurTotalPertes = stocks.reduce((sum, s) => {
    if (s.statut === 'perime' || s.statut === 'declasse') {
      return sum + (s.quantite * (s.produit?.prix_achat || 0));
    }
    return sum;
  }, 0);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Pertes et Périmés</h2>
          <p className="text-gray-600 mt-1">Suivi des produits expirés, cassés ou déclarés en perte</p>
        </div>
        <button 
          onClick={() => setShowDeclassementForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <Trash2 className="w-5 h-5" /> Déclarer une perte
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <div>
              <p className="text-sm font-medium text-red-700">Lignes à risque / Périmées</p>
              <p className="text-2xl font-bold text-red-900">{stocks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg"><Package className="w-8 h-8 text-amber-600" /></div>
            <div>
              <p className="text-sm font-medium text-amber-700">Valeur des pertes (Prix d'achat)</p>
              <p className="text-2xl font-bold text-amber-900">{valeurTotalPertes.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Liste des lots concernés</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Produit</th>
                <th className="px-4 py-3 text-left">Lot</th>
                <th className="px-4 py-3 text-center">Expiration</th>
                <th className="px-4 py-3 text-center">Quantité</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stocks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun produit périmé ou à risque détecté. 🎉</td></tr>
              ) : (
                stocks.map((s) => {
                  const isExpired = s.date_expiration && new Date(s.date_expiration) < new Date();
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.produit?.nom}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.lot_numero || '-'}</td>
                      <td className={`px-4 py-3 text-center text-sm font-bold ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                        {s.date_expiration ? new Date(s.date_expiration).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{s.quantite}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          s.statut === 'perime' ? 'bg-red-100 text-red-800' : 
                          s.statut === 'declasse' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.statut === 'perime' ? 'Périmé' : s.statut === 'declasse' ? 'Déclassé' : 'Expiring Bientôt'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de déclaration */}
      {showDeclassementForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-600" /> Déclarer une perte / périmé
            </h3>
            <form onSubmit={handleDeclassement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot concerné *</label>
                <select 
                  value={formData.stock_id} 
                  onChange={(e) => setFormData({...formData, stock_id: e.target.value})} 
                  required 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Choisir un lot --</option>
                  {stocks.filter(s => s.quantite > 0 && s.statut !== 'perime').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.produit?.nom} - Lot: {s.lot_numero} (Qty: {s.quantite})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                  <input 
                    type="number" min="1" 
                    value={formData.quantite} 
                    onChange={(e) => setFormData({...formData, quantite: parseInt(e.target.value) || 0})} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
                  <select 
                    value={formData.motif} 
                    onChange={(e) => setFormData({...formData, motif: e.target.value as any})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="perime">Périmé</option>
                    <option value="casse">Cassé / Détérioré</option>
                    <option value="vol">Vol / Perte</option>
                    <option value="erreur_inventaire">Erreur d'inventaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarques</label>
                <textarea 
                  value={formData.remarques} 
                  onChange={(e) => setFormData({...formData, remarques: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                  placeholder="Détails sur les circonstances..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowDeclassementForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Confirmer la déclaration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
