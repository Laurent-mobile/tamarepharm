// src/components/sales/CashierManager.tsx
import { useState, useEffect } from 'react';
import { Play, Check, Clock, Users, DollarSign, Calculator, RefreshCw } from 'lucide-react';
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
}

export function CashierManager({ sessionCaisse, onVenteFinalisee }: CashierManagerProps) {
  const { utilisateur } = useAuth();
  const [fileAttente, setFileAttente] = useState<FileAttenteItem[]>([]);
  const [venteEnCours, setVenteEnCours] = useState<FileAttenteItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [montantPerçu, setMontantPerçu] = useState('');
  const [monnaieRendue, setMonnaieRendue] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
        const lignesEnrichies = lignes.map(ligne => ({
          ...ligne,
          produit: produits.find(p => p.id === ligne.produit_id)
        }));

        items.push({ vente, lignes: lignesEnrichies, client, assurance });
      }
      
      setFileAttente(items);
    } catch (error) {
      console.error('❌ Erreur chargement file attente:', error);
    }
  };

  const commencerPaiement = async (item: FileAttenteItem) => {
    setLoading(true);
    try {
      setVenteEnCours(item);
      setMontantPerçu('');
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const finaliserPaiement = async () => {
    if (!venteEnCours || !montantPerçu) {
      alert('Veuillez saisir le montant perçu');
      return;
    }

    const perçu = parseFloat(montantPerçu);
    if (perçu < venteEnCours.vente.montant_patient) {
      alert(`Le montant perçu (${perçu.toLocaleString('fr-FR')} F) est inférieur au total (${venteEnCours.vente.montant_patient.toLocaleString('fr-FR')} F)`);
      return;
    }

    const monnaie = perçu - venteEnCours.vente.montant_patient;
    
    setLoading(true);
    try {
      // ✅ MISE À JOUR LOCALE + SYNC AUTOMATIQUE
      await repository.updateVente(venteEnCours.vente.id, {
        statut: 'payee',
        caissier_id: utilisateur!.id,
        montant_percu: perçu,
        monnaie_rendue: monnaie > 0 ? monnaie : 0,
        session_caisse_id: sessionCaisse?.id || null,
      });

      // Générer le ticket
      await generateTicket(venteEnCours, perçu, monnaie > 0 ? monnaie : 0);

      onVenteFinalisee();
      alert('✅ Paiement finalisé avec succès!');
      setVenteEnCours(null);
      setMontantPerçu('');
      await loadFileAttente();
    } catch (error: any) {
      console.error('❌ Erreur finalisation:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (item: FileAttenteItem, montantPerçu: number, monnaieRendue: number) => {
    try {
      const ticketWindow = window.open('', '_blank', 'width=350,height=600');
      if (!ticketWindow) {
        alert('Veuillez autoriser les pop-ups pour générer le ticket');
        return;
      }

      const isClientAssure = item.vente.montant_assurance > 0;
      const { vente, lignes, client, assurance } = item;

      const ticketContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket de Caisse - ${vente.numero_vente}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 10px; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .pharmacy-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
                .ticket-info { margin: 10px 0; padding: 10px 0; border-bottom: 1px dashed #000; }
                .info-line { display: flex; justify-content: space-between; margin: 2px 0; }
                .items { margin: 10px 0; }
                .item-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px; }
                .item { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
                .payment-section { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
                .payment-line { display: flex; justify-content: space-between; margin: 2px 0; }
                .total-section { border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
                .total { font-weight: bold; font-size: 14px; }
                .footer { text-align: center; margin-top: 15px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
                @media print { body { margin: 0; padding: 5px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="pharmacy-name">PHARMACIE</div>
                <div>Ouagadougou, Burkina Faso</div>
                <div>Tél: +226 25 30 00 00</div>
            </div>
            <div class="ticket-info">
                <div class="info-line"><span>Ticket N°:</span><span>${vente.numero_vente}</span></div>
                <div class="info-line"><span>Date:</span><span>${new Date().toLocaleString('fr-FR')}</span></div>
                <div class="info-line"><span>Client:</span><span>${client?.nom_complet || 'Non enregistré'}</span></div>
                <div class="info-line"><span>Caissier:</span><span>${utilisateur?.nom_complet || 'Non spécifié'}</span></div>
                ${isClientAssure && assurance ? `<div class="info-line" style="background:#f0f8ff; padding:5px; margin-top:5px;"><span>Assurance: ${assurance.nom} (${assurance.taux_couverture}%)</span></div>` : ''}
            </div>
            <div class="items">
                <div class="item-header"><span>Produit</span><span>Total</span></div>
                ${lignes.map((ligne: any) => `
                    <div class="item">
                        <span>${ligne.produit?.nom || 'Produit'} x${ligne.quantite}</span>
                        <span>${(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F</span>
                    </div>
                `).join('')}
            </div>
            <div class="payment-section">
                <div class="payment-line"><span>Total produits:</span><span>${Number(vente.montant_total).toLocaleString('fr-FR')} F</span></div>
                ${isClientAssure ? `<div class="payment-line" style="color: #0066cc;"><span>Prise en charge assurance:</span><span>- ${Number(vente.montant_assurance).toLocaleString('fr-FR')} F</span></div>` : ''}
                <div class="payment-line" style="font-weight: bold; border-top: 1px solid #000; padding-top: 5px;"><span>Total à payer:</span><span>${Number(vente.montant_patient).toLocaleString('fr-FR')} F</span></div>
                <div class="payment-line"><span>Montant perçu:</span><span>${montantPerçu.toLocaleString('fr-FR')} F</span></div>
                <div class="payment-line"><span>Monnaie rendue:</span><span>${monnaieRendue.toLocaleString('fr-FR')} F</span></div>
            </div>
            <div class="total-section">
                <div class="payment-line total"><span>TOTAL VENTE:</span><span>${Number(vente.montant_total).toLocaleString('fr-FR')} F</span></div>
            </div>
            <div class="footer">
                <div>Merci de votre confiance !</div>
                <div>*** ${new Date().toLocaleDateString('fr-FR')} ***</div>
            </div>
            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 500); };
                window.onafterprint = function() { setTimeout(function() { window.close(); }, 1000); };
            </script>
        </body>
        </html>
      `;

      ticketWindow.document.write(ticketContent);
      ticketWindow.document.close();
    } catch (error: any) {
      console.error('❌ Erreur génération ticket:', error);
    }
  };

  const annulerPaiement = async () => {
    if (!venteEnCours) return;
    setLoading(true);
    try {
      setVenteEnCours(null);
      setMontantPerçu('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Caisse - Session Active</h2>
          <p className="text-gray-600 mt-1">Session ouverte à {sessionCaisse ? new Date(sessionCaisse.date_ouverture).toLocaleTimeString('fr-FR') : '--:--'}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>En attente: {fileAttente.length}</span>
          </div>
          <button onClick={loadFileAttente} className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File d'attente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Clock className="w-5 h-5" /> File d'attente</h3>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Auto-actualisation
            </label>
          </div>

          {fileAttente.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune commande en attente</p>
          ) : (
            <div className="space-y-3">
              {fileAttente.map((item, index) => (
                <div key={item.vente.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold">{item.vente.numero_vente}</p>
                      <p className="text-sm text-gray-600">Client: {item.client?.nom_complet || 'Non enregistré'}</p>
                      <div className="mt-2 space-y-1 max-h-16 overflow-y-auto">
                        {item.lignes.slice(0, 3).map((ligne: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600">
                            <span className="truncate flex-1 mr-2">{ligne.produit?.nom || 'Produit'}</span>
                            <span className="whitespace-nowrap">x{ligne.quantite}</span>
                          </div>
                        ))}
                        {item.lignes.length > 3 && <div className="text-xs text-gray-500 text-center">+{item.lignes.length - 3} autre(s)</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{item.vente.montant_patient.toLocaleString('fr-FR')} F</p>
                      <p className="text-sm text-gray-600">Position: {index + 1}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => commencerPaiement(item)}
                    disabled={loading || venteEnCours !== null}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> Commencer le paiement
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paiement en cours */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" /> Paiement en cours</h3>

          {!venteEnCours ? (
            <p className="text-gray-500 text-center py-8">Aucun paiement en cours</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-bold text-lg text-emerald-800">{venteEnCours.vente.numero_vente}</h4>
                <p className="text-emerald-700">Client: {venteEnCours.client?.nom_complet || 'Non enregistré'}</p>
                {venteEnCours.vente.ordonnance_presente && <p className="text-sm text-emerald-600 font-medium mt-1">✓ Ordonnance vérifiée</p>}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium text-gray-900">Détails de la commande:</h5>
                {venteEnCours.lignes.map((ligne: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 border-b">
                    <div>
                      <p className="font-medium">{ligne.produit?.nom}</p>
                      <p className="text-sm text-gray-600">{ligne.quantite} x {ligne.prix_unitaire} F</p>
                    </div>
                    <p className="font-bold">{(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F</p>
                  </div>
                ))}
              </div>


<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h5 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
    <Calculator className="w-4 h-4" /> Encaissement
  </h5>
  <div className="space-y-3">
    {/* ✅ AFFICHAGE DÉTAILLÉ DES MONTANTS */}
    <div className="space-y-2 text-sm">
      <div className="flex justify-between items-center p-2 bg-white rounded">
        <span className="text-gray-600">Total produits:</span>
        <span className="font-medium">{venteEnCours.vente.montant_total.toLocaleString('fr-FR')} F</span>
      </div>
      
      {venteEnCours.vente.montant_assurance > 0 && (
        <div className="flex justify-between items-center p-2 bg-blue-100 rounded">
          <span className="text-blue-700">Part assurance:</span>
          <span className="font-medium text-blue-700">- {venteEnCours.vente.montant_assurance.toLocaleString('fr-FR')} F</span>
        </div>
      )}
      
      {venteEnCours.vente.montant_paye_comptant > 0 && (
        <div className="flex justify-between items-center p-2 bg-green-100 rounded">
          <span className="text-green-700">Déjà payé (reliquat):</span>
          <span className="font-medium text-green-700">- {venteEnCours.vente.montant_paye_comptant.toLocaleString('fr-FR')} F</span>
        </div>
      )}
      
      {venteEnCours.vente.montant_credit > 0 && (
        <div className="flex justify-between items-center p-2 bg-amber-100 rounded">
          <span className="text-amber-700">En crédit:</span>
          <span className="font-medium text-amber-700">{venteEnCours.vente.montant_credit.toLocaleString('fr-FR')} F</span>
        </div>
      )}
      
      <div className="border-t-2 border-blue-300 pt-2 mt-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg text-blue-900">Reste à payer:</span>
          <span className="font-bold text-2xl text-blue-700">
            {venteEnCours.vente.montant_patient.toLocaleString('fr-FR')} F
          </span>
        </div>
      </div>
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Montant perçu (FCFA):
      </label>
      <input
        type="number"
        value={montantPerçu}
        onChange={(e) => setMontantPerçu(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
        placeholder="Saisir le montant perçu"
        autoFocus
      />
    </div>
    
    {monnaieRendue > 0 && (
      <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border border-green-300">
        <span className="font-bold text-green-800">💵 Monnaie à rendre:</span>
        <span className="font-bold text-xl text-green-800">{monnaieRendue.toLocaleString('fr-FR')} F</span>
      </div>
    )}
    
    {montantPerçu && parseFloat(montantPerçu) < venteEnCours.vente.montant_patient && (
      <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg border border-red-300">
        <span className="font-bold text-red-800">⚠️ Montant insuffisant:</span>
        <span className="font-bold text-red-800">
          {-(venteEnCours.vente.montant_patient - parseFloat(montantPerçu)).toLocaleString('fr-FR')} F
        </span>
      </div>
    )}
  </div>
</div>

              <div className="flex gap-3">
                <button onClick={annulerPaiement} disabled={loading} className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50">Annuler</button>
                <button
                  onClick={finaliserPaiement}
                  disabled={loading || !montantPerçu || parseFloat(montantPerçu) < venteEnCours.vente.montant_patient}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" /> {loading ? 'Traitement...' : 'Finaliser paiement'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
