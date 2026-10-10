import { useState, useEffect } from 'react';
import { History, Search, Filter, Download, FileText, Calendar, Plus, Minus, AlertTriangle, CheckCircle, X, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface HistoriqueAjustement {
  id: string;
  produit_id: string;
  stock_id: string | null;
  type_operation: 'entree' | 'sortie' | 'ajustement';
  quantite_avant: number;
  quantite_apres: number;
  quantite_ajustee: number;
  type_ajustement: string | null;
  motif: string;
  lot_numero: string | null;
  date_operation: string;
  utilisateur_id: string | null;
  statut_impression: 'non_imprime' | 'imprime';
  date_impression: string | null;
  reference_document: string | null;
  created_at: string;
  produits: { id: string; nom: string; code_produit: string } | null;
  utilisateurs: { id: string; nom_complet: string; role: string } | null;
}

interface Filtres {
  date_debut: string;
  date_fin: string;
  type_operation: string;
  type_ajustement: string;
  statut_impression: string;
  search_term: string;
}

export function StockAdjustmentHistory() {
  const { utilisateur } = useAuth();
  const [historique, setHistorique] = useState<HistoriqueAjustement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFiltres, setShowFiltres] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [filtres, setFiltres] = useState<Filtres>({
    date_debut: thirtyDaysAgo,
    date_fin: today,
    type_operation: 'tous',
    type_ajustement: 'tous',
    statut_impression: 'tous',
    search_term: ''
  });

  useEffect(() => {
    if (utilisateur) loadHistorique();
  }, [utilisateur, filtres.date_debut, filtres.date_fin, filtres.type_operation, filtres.type_ajustement, filtres.statut_impression]);

   const loadHistorique = async () => {
    // ✅ GARDE HORS-LIGNE NIVEAU 1 : Vérification navigateur
    if (!navigator.onLine) {
      console.log('📴 Mode hors-ligne : Historique des ajustements indisponible pour le moment.');
      setHistorique([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('historique_ajustements_stock')
        .select(`*, produits (id, nom, code_produit), utilisateurs (id, nom_complet, role)`)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .order('created_at', { ascending: false });

      if (filtres.date_debut) query = query.gte('date_operation', filtres.date_debut);
      if (filtres.date_fin) query = query.lte('date_operation', filtres.date_fin);
      if (filtres.type_operation !== 'tous') query = query.eq('type_operation', filtres.type_operation);
      if (filtres.statut_impression !== 'tous') query = query.eq('statut_impression', filtres.statut_impression);

      const { data, error } = await query;

      // ✅ GARDE HORS-LIGNE NIVEAU 2 : Interception des erreurs réseau silencieuses
      if (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_')) {
          console.log('📴 Erreur réseau détectée par Supabase, activation du mode hors-ligne pour l\'historique.');
          setHistorique([]);
          setLoading(false);
          return;
        }
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      let filteredData = data || [];
      if (filtres.search_term) {
        const searchTerm = filtres.search_term.toLowerCase();
        filteredData = filteredData.filter(item =>
          item.produits?.nom?.toLowerCase().includes(searchTerm) ||
          item.produits?.code_produit?.toLowerCase().includes(searchTerm) ||
          item.motif?.toLowerCase().includes(searchTerm)
        );
      }
      setHistorique(filteredData);
    } catch (error: any) {
      console.error('❌ Erreur chargement historique:', error);
      setHistorique([]);
    } finally {
      setLoading(false);
    }
  };

  const marquerCommeImprime = async (id: string) => {
    if (!navigator.onLine) {
      alert('⚠️ Vous devez être connecté à internet pour marquer un document comme imprimé.');
      return;
    }
    try {
      const { error } = await supabase
        .from('historique_ajustements_stock')
        .update({ statut_impression: 'imprime', date_impression: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await loadHistorique();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const reinitialiserFiltres = () => {
    setFiltres({ date_debut: thirtyDaysAgo, date_fin: today, type_operation: 'tous', type_ajustement: 'tous', statut_impression: 'tous', search_term: '' });
  };

  const getTypeOperationLabel = (type: string) => {
    const labels: Record<string, string> = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement' };
    return labels[type] || type;
  };

  const getTypeOperationColor = (type: string) => {
    const colors: Record<string, string> = { entree: 'text-green-600 bg-green-100', sortie: 'text-red-600 bg-red-100', ajustement: 'text-blue-600 bg-blue-100' };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Historique des Ajustements</h2>
          <p className="text-gray-600 mt-1">Suivi complet des entrées, sorties et ajustements de stock</p>
        </div>
        <button onClick={() => setShowFiltres(!showFiltres)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
          <Filter className="w-4 h-4" /> Filtres
        </button>
      </div>

      {showFiltres && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
            <button onClick={reinitialiserFiltres} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Réinitialiser</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date début</label><input type="date" value={filtres.date_debut} onChange={(e) => setFiltres(prev => ({ ...prev, date_debut: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label><input type="date" value={filtres.date_fin} onChange={(e) => setFiltres(prev => ({ ...prev, date_fin: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type opération</label>
              <select value={filtres.type_operation} onChange={(e) => setFiltres(prev => ({ ...prev, type_operation: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="tous">Tous</option><option value="entree">Entrées</option><option value="sortie">Sorties</option><option value="ajustement">Ajustements</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Statut impression</label>
              <select value={filtres.statut_impression} onChange={(e) => setFiltres(prev => ({ ...prev, statut_impression: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="tous">Tous</option><option value="non_imprime">Non imprimé</option><option value="imprime">Imprimé</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input type="text" placeholder="Rechercher par produit, code, lot ou motif..." value={filtres.search_term} onChange={(e) => setFiltres(prev => ({ ...prev, search_term: e.target.value }))} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
        ) : historique.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun historique trouvé</h3>
            <p className="text-gray-600 mb-4">{!navigator.onLine ? 'Mode hors-ligne : connectez-vous pour voir l\'historique.' : 'Aucun ajustement ne correspond aux critères.'}</p>
            {navigator.onLine && <button onClick={reinitialiserFiltres} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Réinitialiser les filtres</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">Produit</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Quantités</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">Motif</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm font-medium text-gray-900">{new Date(item.date_operation).toLocaleDateString('fr-FR')}</td>
                    <td className="py-4 px-4">
                      <div className="font-medium">{item.produits?.nom || 'Produit inconnu'}</div>
                      <div className="text-sm text-gray-500 font-mono">{item.produits?.code_produit || '-'}</div>
                      {item.lot_numero && <div className="text-xs text-blue-600 mt-1">Lot: {item.lot_numero}</div>}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeOperationColor(item.type_operation)}`}>
                        {item.type_operation === 'entree' ? <Plus className="w-3 h-3" /> : item.type_operation === 'sortie' ? <Minus className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {getTypeOperationLabel(item.type_operation)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Avant: <span className="font-medium">{item.quantite_avant}</span></div>
                        <div className={`text-sm font-bold ${item.type_operation === 'entree' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.type_operation === 'entree' ? '+' : '-'}{Math.abs(item.quantite_ajustee)}
                        </div>
                        <div className="text-xs text-gray-500">Après: <span className="font-medium">{item.quantite_apres}</span></div>
                      </div>
                    </td>
                    <td className="py-4 px-4"><p className="text-sm text-gray-700 line-clamp-2">{item.motif}</p></td>
                    <td className="py-4 px-4 text-center">
                      {item.statut_impression === 'non_imprime' && navigator.onLine && (
                        <button onClick={() => marquerCommeImprime(item.id)} className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm">
                          <Printer className="w-4 h-4" /> Marquer imprimé
                        </button>
                      )}
                      {item.statut_impression === 'imprime' && (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm"><CheckCircle className="w-4 h-4" /> Imprimé</span>
                      )}
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
