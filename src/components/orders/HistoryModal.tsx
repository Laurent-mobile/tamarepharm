// src/components/orders/HistoryModal.tsx
import { useState, useEffect } from 'react';
import { X, History, User, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HistoryModalProps {
  commande?: any;
  proforma?: any;
  onClose: () => void;
}

export function HistoryModal({ commande, proforma, onClose }: HistoryModalProps) {
  const [historique, setHistorique] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerHistorique();
  }, [commande, proforma]);

  const chargerHistorique = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('historique_commandes')
        .select(`
          *,
          utilisateurs (id, nom_complet, role)
        `)
        // ✅ CORRECTION : Utilisation de 'created_at' qui est la colonne par défaut de Supabase
        .order('created_at', { ascending: false });

      if (commande && commande.id) {
        query = query.eq('commande_id', commande.id);
      } else if (proforma && proforma.id) {
        query = query.eq('proforma_id', proforma.id);
      } else {
        console.warn('Aucune commande ou proforma sélectionné pour l\'historique');
        setHistorique([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erreur Supabase historique:', error);
        throw error;
      }
      
      setHistorique(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
      setHistorique([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (typeEvenement: string) => {
    const colors: Record<string, string> = {
      proforma_cree: 'bg-blue-100 text-blue-700',
      proforma_envoye: 'bg-blue-100 text-blue-700',
      proforma_recu: 'bg-amber-100 text-amber-700',
      proforma_valide: 'bg-green-100 text-green-700',
      proforma_refuse: 'bg-red-100 text-red-700',
      commande_creee: 'bg-emerald-100 text-emerald-700',
      commande_validee: 'bg-green-100 text-green-700',
      commande_envoyee: 'bg-blue-100 text-blue-700',
      reception_partielle: 'bg-amber-100 text-amber-700',
      reception_complete: 'bg-green-100 text-green-700',
      commande_annulee: 'bg-red-100 text-red-700'
    };
    return colors[typeEvenement] || 'bg-gray-100 text-gray-700';
  };

  const getEventLabel = (typeEvenement: string) => {
    const labels: Record<string, string> = {
      proforma_cree: 'Pro-forma créé',
      proforma_envoye: 'Pro-forma envoyé',
      proforma_recu: 'Pro-forma reçu',
      proforma_valide: 'Pro-forma validé',
      proforma_refuse: 'Pro-forma refusé',
      commande_creee: 'Commande créée',
      commande_validee: 'Commande validée',
      commande_envoyee: 'Commande envoyée',
      reception_partielle: 'Réception partielle',
      reception_complete: 'Réception complète',
      commande_annulee: 'Commande annulée'
    };
    return labels[typeEvenement] || typeEvenement.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDetails = (details: any) => {
    if (!details) return null;
    
    // Si details est une chaîne de caractères (parfois le cas avec JSONB), on essaie de la parser
    let parsedDetails = details;
    if (typeof details === 'string') {
      try {
        parsedDetails = JSON.parse(details);
      } catch (e) {
        return <p className="text-sm text-gray-600 mt-1">{details}</p>;
      }
    }

    return (
      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
        {Object.entries(parsedDetails).map(([key, value]) => (
          <div key={key} className="flex text-sm mb-1 last:mb-0">
            <span className="font-medium text-gray-700 min-w-[120px] capitalize">
              {key.replace(/_/g, ' ')}:
            </span>
            <span className="text-gray-600">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* En-tête fixe */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600" />
            Historique
            {commande && <span className="text-emerald-600">- {commande.numero_commande}</span>}
            {proforma && <span className="text-blue-600">- {proforma.numero_demande}</span>}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : historique.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aucun historique trouvé pour ce document</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historique.map((evenement) => (
                <div key={evenement.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ${getEventColor(evenement.type_evenement)}`}>
                    {getEventLabel(evenement.type_evenement)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-base">
                      {evenement.description || 'Action effectuée'}
                    </p>
                    {evenement.details && formatDetails(evenement.details)}
                  </div>

                  <div className="text-right text-sm text-gray-500 whitespace-nowrap flex flex-col items-end">
                    <div className="flex items-center gap-1.5 mb-1 font-medium text-gray-700">
                      <User className="w-4 h-4" />
                      {evenement.utilisateurs?.nom_complet || 'Système'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(evenement.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
