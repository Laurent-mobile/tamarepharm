import { useState, useEffect } from 'react';
import { CheckCircle, X, Package, AlertTriangle, Warehouse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { repository } from '../../lib/repository';
import { useAuth } from '../../contexts/AuthContext';

export function ReceptionForm({ commande, onClose, onReceptionSuccess }: any) {
  const { utilisateur } = useAuth();
  const [lignesReception, setLignesReception] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commandeActuelle, setCommandeActuelle] = useState<any>(null);
  const [depotPrincipal, setDepotPrincipal] = useState<any>(null);

  // Calcul de la date minimale (Aujourd'hui + 3 mois)
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() + 3);
  const minDateString = minDate.toISOString().split('T')[0];

  useEffect(() => {
    chargerDonneesInitiales();
  }, [commande?.id]);

  const chargerDonneesInitiales = async () => {
    setLoading(true);
    try {
      // ✅ Détection automatique du dépôt principal
      const depot = await repository.getDepotPrincipal(utilisateur!.pharmacy_id);
      
      if (!depot) {
        alert('⚠️ Aucun dépôt configuré. Veuillez créer au moins un magasin de type "Entrepôt" dans le module Transferts avant de réceptionner.');
        onClose();
        return;
      }
      
      setDepotPrincipal(depot);

      // Charger la commande
      const { data, error } = await supabase
        .from('commandes_fournisseurs')
        .select(`*, commande_fournisseur_lignes(*, produits(*))`)
        .eq('id', commande.id)
        .single();

      if (error) throw error;
      setCommandeActuelle(data);
      
      const lignesInitiales = data.commande_fournisseur_lignes.map((ligne: any) => {
        const resteARecevoir = ligne.quantite_commandee - (ligne.quantite_recue || 0);
        return {
          ligne_commande_id: ligne.id,
          produit_id: ligne.produit_id,
          produit_nom: ligne.produits?.nom || 'Produit inconnu',
          produit_code: ligne.produits?.code_produit || '-',
          quantite_commandee: ligne.quantite_commandee,
          quantite_recue_precedemment: ligne.quantite_recue || 0,
          reste_a_recevoir: resteARecevoir,
          quantite_a_receptionner: resteARecevoir,
          lot: '',
          date_expiration: '',
          etat_produit: 'conforme',
          remarques: ''
        };
      });
      setLignesReception(lignesInitiales);
    } catch (error: any) {
      alert('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const mettreAJourLigne = (index: number, champ: string, valeur: any) => {
    const nouvellesLignes = [...lignesReception];
    if (champ === 'quantite_a_receptionner') {
      const max = nouvellesLignes[index].reste_a_recevoir;
      const val = parseInt(valeur) || 0;
      nouvellesLignes[index][champ] = Math.max(0, Math.min(val, max));
    } else {
      nouvellesLignes[index][champ] = valeur;
    }
    setLignesReception(nouvellesLignes);
  };

  const validerReception = async () => {
    // Validation des dates d'expiration (Règle des 3 mois)
    const aujourdHui = new Date();
    for (const ligne of lignesReception) {
      if (ligne.quantite_a_receptionner > 0 && ligne.date_expiration) {
        const dateExp = new Date(ligne.date_expiration);
        const diffMois = (dateExp.getFullYear() - aujourdHui.getFullYear()) * 12 + (dateExp.getMonth() - aujourdHui.getMonth());
        if (diffMois < 3) {
          alert(`⚠️ Attention : La date d'expiration pour "${ligne.produit_nom}" est inférieure à 3 mois.`);
          return;
        }
      }
    }

    if (!depotPrincipal) {
      alert('❌ Aucun dépôt principal configuré. Veuillez créer un magasin de type "entrepôt" dans le module Transferts.');
      return;
    }

    setLoading(true);
    try {
      const lignesAReceptionner = lignesReception.filter(l => l.quantite_a_receptionner > 0);
      if (lignesAReceptionner.length === 0) {
        alert('Veuillez saisir au moins une quantité à réceptionner.');
        setLoading(false);
        return;
      }

      const quantiteTotaleRecue = lignesAReceptionner.reduce((sum, l) => sum + l.quantite_a_receptionner, 0);
      const estTotale = lignesReception.every(l => l.quantite_a_receptionner >= l.reste_a_recevoir);

      // 1. Créer la réception
      const { data: reception, error: receptionError } = await supabase
        .from('receptions')
        .insert({
          commande_id: commande.id,
          pharmacy_id: utilisateur!.pharmacy_id,
          date_reception: new Date().toISOString().split('T')[0],
          type_reception: estTotale ? 'totale' : 'partielle',
          quantite_totale_recue: quantiteTotaleRecue,
          recu_par: utilisateur!.id
        })
        .select()
        .single();

      if (receptionError) throw receptionError;

      // 2. Créer les lignes de réception
      const lignesReceptionData = lignesAReceptionner.map(ligne => ({
        reception_id: reception.id,
        produit_id: ligne.produit_id,
        quantite_recue: ligne.quantite_a_receptionner,
        quantite_commandee: ligne.quantite_commandee,
        lot: ligne.lot || null,
        date_expiration: ligne.date_expiration || null,
        prix_unitaire: 0,
        etat_produit: ligne.etat_produit,
        remarques: ligne.remarques || null,
        pharmacy_id: utilisateur!.pharmacy_id
      }));

      const { error: lignesError } = await supabase.from('reception_lignes').insert(lignesReceptionData);
      if (lignesError) throw lignesError;

      // 3. Mettre à jour la commande
      for (const ligne of lignesAReceptionner) {
        const nouvelleQuantiteRecue = ligne.quantite_recue_precedemment + ligne.quantite_a_receptionner;
        await supabase.from('commande_fournisseur_lignes')
          .update({ quantite_recue: nouvelleQuantiteRecue, dernier_reception_date: new Date().toISOString() })
          .eq('id', ligne.ligne_commande_id);
      }

      if (estTotale) {
        await supabase.from('commandes_fournisseurs').update({ statut: 'complete' }).eq('id', commande.id);
      } else {
        await supabase.from('commandes_fournisseurs').update({ statut: 'partielle' }).eq('id', commande.id);
      }

      // 4. ✅ AJOUTER AU STOCK DU DÉPÔT PRINCIPAL (FORCÉ) via le repository
      // Cela garantit la mise à jour de la base locale (IndexedDB) et la synchronisation Supabase
      for (const ligne of lignesAReceptionner) {
        await repository.ajouterEntreeStock({
          pharmacy_id: utilisateur!.pharmacy_id,
          produit_id: ligne.produit_id,
          quantite: ligne.quantite_a_receptionner,
          lot_numero: ligne.lot || 'SANS-LOT',
          date_expiration: ligne.date_expiration,
          date_reception: new Date().toISOString().split('T')[0],
          magasin_id: depotPrincipal.id, // ✅ TOUJOURS le dépôt principal
          prix_achat_lot: ligne.prix_unitaire || 0,
          emplacement: null
        });
      }

      alert(`✅ Réception enregistrée avec succès !\n\n📦 Stock ajouté au dépôt : ${depotPrincipal.nom}\n\nUtilisez le module "Transferts" pour redistribuer vers les autres magasins.`);
      onReceptionSuccess(commande.id);
      onClose();
    } catch (error: any) {
      console.error('❌ Erreur réception:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !commandeActuelle) {
    return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-5xl w-full my-8 shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" /> Réception de la commande {commandeActuelle?.numero_commande}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Fournisseur : <span className="font-semibold">{commandeActuelle?.fournisseurs?.nom}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition"><X className="w-6 h-6 text-gray-600" /></button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Bandeau Dépôt Principal - FORCÉ */}
          <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg flex items-start gap-3">
            <Warehouse className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-emerald-800 flex-1">
              <p className="font-bold text-base">📍 Destination : {depotPrincipal?.nom || 'Dépôt Principal'}</p>
              <p className="text-emerald-700 mt-1">
                Tout le stock reçu sera automatiquement stocké dans ce dépôt. 
                Utilisez ensuite le module <strong>Transferts</strong> pour redistribuer vers les autres magasins.
              </p>
              {depotPrincipal && (
                <p className="text-xs text-emerald-600 mt-2 font-mono">ID Dépôt : {depotPrincipal.id}</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Règle de qualité :</p>
              <p>Les dates d'expiration doivent être d'<strong>au moins 3 mois</strong> à partir d'aujourd'hui.</p>
            </div>
          </div>

          <div className="space-y-6">
            {lignesReception.map((ligne, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-md transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{ligne.produit_nom}</h3>
                    <p className="text-sm text-gray-500">Code : {ligne.produit_code}</p>
                  </div>
                  <div className="flex gap-4 mt-3 md:mt-0 text-sm">
                    <div className="text-center px-3 py-1 bg-gray-100 rounded-lg">
                      <span className="block text-gray-500 text-xs">Commandé</span>
                      <span className="font-bold text-gray-900">{ligne.quantite_commandee}</span>
                    </div>
                    <div className="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="block text-amber-600 text-xs">Reste à recevoir</span>
                      <span className="font-bold text-amber-700">{ligne.reste_a_recevoir}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantité à réceptionner *</label>
                    <input type="number" min="0" max={ligne.reste_a_recevoir} value={ligne.quantite_a_receptionner} onChange={(e) => mettreAJourLigne(index, 'quantite_a_receptionner', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Lot *</label>
                    <input type="text" value={ligne.lot} onChange={(e) => mettreAJourLigne(index, 'lot', e.target.value)} placeholder="Ex: LOT-2024-001" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" disabled={ligne.quantite_a_receptionner === 0} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration * <span className="text-xs text-red-500 font-normal">(Min: {new Date(minDateString).toLocaleDateString('fr-FR')})</span></label>
                    <input type="date" value={ligne.date_expiration} min={minDateString} onChange={(e) => mettreAJourLigne(index, 'date_expiration', e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${ligne.date_expiration && new Date(ligne.date_expiration) < minDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} disabled={ligne.quantite_a_receptionner === 0} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">État du produit</label>
                    <select value={ligne.etat_produit} onChange={(e) => mettreAJourLigne(index, 'etat_produit', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" disabled={ligne.quantite_a_receptionner === 0}>
                      <option value="conforme">✅ Conforme</option>
                      <option value="non_conforme">❌ Non conforme</option>
                      <option value="endommage">⚠️ Endommagé</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium disabled:opacity-50">Annuler</button>
          <button onClick={validerReception} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm disabled:opacity-50">
            {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Enregistrement...</> : <><CheckCircle className="w-5 h-5" /> Valider la réception</>}
          </button>
        </div>
      </div>
    </div>
  );
}
