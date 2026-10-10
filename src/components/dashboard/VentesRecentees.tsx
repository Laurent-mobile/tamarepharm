// components/dashboard/VentesRecentees.tsx
import { useState, useEffect } from 'react';
import { ShoppingCart, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function VentesRecentees() {
  const { utilisateur } = useAuth();
  const [ventesRecentes, setVentesRecentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (utilisateur) {
      loadRecentSales();
    }
  }, [utilisateur]);

  const loadRecentSales = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          *,
          clients(nom_complet),
          vente_lignes(*, produits(nom))
        `)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .eq('statut', 'payee')
        .order('date_vente', { ascending: false })
        .limit(5);

      if (error) throw error;
      setVentesRecentes(data || []);
    } catch (error) {
      console.error('Erreur chargement ventes récentes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Ventes Récentes</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Ventes Récentes</h3>
        <span className="text-sm text-gray-500">5 dernières ventes</span>
      </div>

      <div className="space-y-4">
        {ventesRecentes.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Aucune vente récente</p>
            <p className="text-sm text-gray-400 mt-1">Les ventes apparaîtront ici</p>
          </div>
        ) : (
          ventesRecentes.map((vente) => (
            <div key={vente.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold">{vente.numero_vente}</p>
                  <p className="text-sm text-gray-600">
                    {vente.clients?.nom_complet || 'Client non enregistré'} • 
                    {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-lg">{Number(vente.montant_total).toLocaleString('fr-FR')} F</p>
                <p className="text-sm text-gray-600">
                  {vente.vente_lignes?.length || 0} produit(s)
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
