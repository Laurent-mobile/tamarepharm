import { useState, useEffect } from 'react';
import { Play, Check, Clock, Users, DollarSign, Calculator, RefreshCw, Smartphone, CreditCard, Banknote, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalVente, LocalVenteLigne, LocalClient, LocalAssurance, LocalProduit } from '../../lib/localDb';

interface FileAttenteItem {
  vente: LocalVente;
  lignes: (LocalVenteLigne & { produit?: LocalProduit })[];
  client?: LocalClient | null;
  assurance?: LocalAssurance | null;
}

interface CashierManagerProps {
  sessionCaisse: any;
  onVenteFinalisee: () => void;
  onFermerCaisse: () => void; // ✅ Nouveau prop pour fermer la caisse
}

export function CashierManager({ sessionCaisse, onVenteFinalisee, onFermerCaisse }: CashierManagerProps) {
  const { utilisateur } = useAuth();
  const [fileAttente, setFileAttente] = useState<FileAttenteItem[]>([]);
  const [venteEnCours, setVenteEnCours] = useState<FileAttenteItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [montantPerçu, setMontantPerçu] = useState('');
  const [monnaieRendue, setMonnaieRendue] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ✅ NOUVEAU : États pour les modes de paiement
  const [typePaiement, setTypePaiement] = useState<'especes' | 'mobile_money' | 'carte' | 'cheque'>('especes');
  const [operateurMobile, setOperateurMobile] = useState('Orange Money');
  const [numTransaction, setNumTransaction] = useState('');

  useEffect(() => {
    if (utilisateur && sessionCaisse) {
      loadFileAttente();
      if (autoRefresh) {
        const interval = setInterval(loadFileAttente, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [utilisateur, sessionCaisse, autoRefresh]);

  useEffect(() => {
    if (montantPerçu && venteEnCours) {
      const perçu = parseFloat(montantPerçu) || 0;
      const total = venteEnCours.vente.montant_patient;
      const monnaie = perçu - total;
      setMonnaieRendue(monnaie > 0 ? monnaie : 0);
    } else {
      setMonnaieRendue(0);
    }
  }, [montantPerçu, venteEnCours]);

  const loadFileAttente = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      const ventesEnAttente = await repository.getVentesEnAttente(utilisateur.pharmacy_id);
      const items: FileAttenteItem[] = [];
      for (const vente of ventesEnAttente) {
        const lignes = await repository.getVenteLignes(vente.id);
        let client = null;
        let assurance = null;
        if (vente.client_id) {
          const clients = await repository.getClients(utilisateur.pharmacy_id);
          client = clients.find(c => c.id === vente.client_id) || null;
          if (client?.assurance_id) {
            const assurances = await repository.getAssurances(utilisateur.pharmacy_id);
            assurance = assurances.find(a => a.id === client.assurance_id) || null;
          }
        }
        const produits = await repository.getProduits(utilisateur.pharmacy_id);
        const lignesEnrichies = lignes.map(ligne => ({ ...ligne, produit: produits.find(p => p.id === ligne.produit_id) }));
        items.push({ vente, lignes: lignesEnrichies, client, assurance });
      }
      setFileAttente(items);
    } catch (error) {
      console.error('❌ Erreur chargement file attente:', error);
    }
  };

  const commencerPaiement = async (item: FileAttenteItem) => {
    setVenteEnCours(item);
    setMontantPerçu('');
    setTypePaiement('especes'); // Reset du mode de paiement
    setNumTransaction('');
  };

  const finaliserPaiement = async () => {
    if (!venteEnCours || !montantPerçu) {
      alert('Veuillez saisir le montant perçu');
      return;
    }
    if (typePaiement === 'mobile_money' && !numTransaction.trim()) {
      alert('Veuillez saisir le numéro de transaction Mobile Money');
      return;
    }

    const perçu = parseFloat(montantPerçu);
    if (perçu < venteEnCours.vente.montant_patient) {
      alert(`Le montant perçu est inférieur au total.`);
      return;
    }

    const monnaie = perçu - venteEnCours.vente.montant_patient;
    setLoading(true);

    try {
      // ✅ MISE À JOUR AVEC LES NOUVEAUX CHAMPS DE PAIEMENT
      await repository.updateVente(venteEnCours.vente.id, {
        statut: 'payee',
        caissier_id: utilisateur!.id,
        montant_percu: perçu,
        monnaie_rendue: monnaie > 0 ? monnaie : 0,
        session_caisse_id: sessionCaisse?.id || null,
        type_paiement: typePaiement,
        operateur_mobile: typePaiement === 'mobile_money' ? operateurMobile : null,
        numero_transaction_mobile: typePaiement === 'mobile_money' ? numTransaction : null,
      });

      await generateTicket(venteEnCours, perçu, monnaie > 0 ? monnaie : 0, typePaiement);

      alert('✅ Paiement finalisé avec succès!');
      setVenteEnCours(null);
      setMontantPerçu('');
      setNumTransaction('');
      onVenteFinalisee();
      await loadFileAttente();
    } catch (error: any) {
      console.error('❌ Erreur finalisation:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (item: FileAttenteItem, montantPerçu: number, monnaieRendue: number, modePaiement: string) => {
    // ... (Gardez votre fonction generateTicket existante, elle est très bien)
    // Vous pouvez juste ajouter une ligne dans le HTML du ticket :
    // <div class="info-line"><span>Mode de paiement:</span><span>${modePaiement.toUpperCase()}</span></div>
    try {
      const ticketWindow = window.open('', '_blank', 'width=350,height=600');
      if (!ticketWindow) return alert('Veuillez autoriser les pop-ups');
      
      const { vente, lignes, client, assurance } = item;
      const ticketContent = `
        <!DOCTYPE html><html><head><title>Ticket</title>
        <style>body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 10px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .item { display: flex; justify-content: space-between; margin: 3px 0; }
        .total { font-weight: bold; border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; }
        </style></head><body>
        <div class="header"><strong>PHARMACIE</strong><br>Ouagadougou, Burkina Faso</div>
        <div>Ticket: ${vente.numero_vente}<br>Date: ${new Date().toLocaleString('fr-FR')}<br>Caissier: ${utilisateur?.nom_complet}</div>
        <div style="margin: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0;">
          ${lignes.map((l: any) => `<div class="item"><span>${l.produit?.nom} x${l.quantite}</span><span>${(l.quantite * l.prix_unitaire).toLocaleString('fr-FR')} F</span></div>`).join('')}
        </div>
        <div class="total">TOTAL: ${vente.montant_patient.toLocaleString('fr-FR')} F</div>
        <div class="item"><span>Payé par:</span><span>${modePaiement.toUpperCase()}</span></div>
        <div class="item"><span>Montant perçu:</span><span>${montantPerçu.toLocaleString('fr-FR')} F</span></div>
        <div class="item"><span>Monnaie:</span><span>${monnaieRendue.toLocaleString('fr-FR')} F</span></div>
        <div style="text-align: center; margin-top: 20px;">Merci de votre confiance !</div>
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
        </body></html>`;
      ticketWindow.document.write(ticketContent);
      ticketWindow.document.close();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Caisse - Session Active</h2>
          <p className="text-gray-600 mt-1">Ouverte à {sessionCaisse ? new Date(sessionCaisse.date_ouverture).toLocaleTimeString('fr-FR') : '--:--'}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg text-blue-700">
            <Users className="w-5 h-5" />
            <span>En attente: {fileAttente.length}</span>
          </div>
          {/* ✅ BOUTON ARRÊTER LA CAISSE */}
          <button onClick={onFermerCaisse} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
            <Clock className="w-4 h-4" /> Arrêter la caisse
          </button>
          <button onClick={loadFileAttente} className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File d'attente (Gauche) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5" /> File d'attente</h3>
          {fileAttente.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune commande en attente</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {fileAttente.map((item) => (
                <div key={item.vente.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition cursor-pointer"
                     onClick={() => commencerPaiement(item)}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">{item.vente.numero_vente}</p>
                      <p className="text-sm text-gray-600">{item.client?.nom_complet || 'Client'}</p>
                    </div>
                    <p className="font-bold text-lg text-blue-600">{item.vente.montant_patient.toLocaleString('fr-FR')} F</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paiement en cours (Droite) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" /> Paiement en cours</h3>

          {!venteEnCours ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Sélectionnez une commande pour commencer l'encaissement.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-bold text-lg text-emerald-800">{venteEnCours.vente.numero_vente}</h4>
                <p className="text-emerald-700">Total à payer: <span className="font-bold text-2xl">{venteEnCours.vente.montant_patient.toLocaleString('fr-FR')} F</span></p>
              </div>

              {/* ✅ SÉLECTION DU MODE DE PAIEMENT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTypePaiement('especes')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${typePaiement === 'especes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Banknote className="w-5 h-5" /> Espèces
                  </button>
                  <button onClick={() => setTypePaiement('mobile_money')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${typePaiement === 'mobile_money' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Smartphone className="w-5 h-5" /> Mobile Money
                  </button>
                  <button onClick={() => setTypePaiement('carte')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${typePaiement === 'carte' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <CreditCard className="w-5 h-5" /> Carte
                  </button>
                  <button onClick={() => setTypePaiement('cheque')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${typePaiement === 'cheque' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <FileText className="w-5 h-5" /> Chèque
                  </button>
                </div>
              </div>

              {/* ✅ CHAMPS DYNAMIQUES POUR MOBILE MONEY */}
              {typePaiement === 'mobile_money' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Opérateur</label>
                    <select value={operateurMobile} onChange={(e) => setOperateurMobile(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option>Orange Money</option>
                      <option>Moov Money</option>
                      <option>Wave</option>
                      <option>Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">N° Transaction *</label>
                    <input type="text" value={numTransaction} onChange={(e) => setNumTransaction(e.target.value)} placeholder="Ex: 84739201" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant perçu (FCFA) *</label>
                <input type="number" value={montantPerçu} onChange={(e) => setMontantPerçu(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xl font-semibold" placeholder="0" autoFocus />
                
                {monnaieRendue > 0 && (
                  <div className="mt-3 flex justify-between items-center p-3 bg-green-100 rounded-lg border border-green-300">
                    <span className="font-bold text-green-800">Monnaie à rendre:</span>
                    <span className="font-bold text-xl text-green-800">{monnaieRendue.toLocaleString('fr-FR')} F</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setVenteEnCours(null); setMontantPerçu(''); }} className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">Annuler</button>
                <button onClick={finaliserPaiement} disabled={loading || !montantPerçu || parseFloat(montantPerçu) < venteEnCours.vente.montant_patient || (typePaiement === 'mobile_money' && !numTransaction)} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-bold">
                  <Check className="w-5 h-5" /> {loading ? 'Traitement...' : 'Valider le paiement'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
