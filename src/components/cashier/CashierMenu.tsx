import { useState, useEffect } from 'react';
import { Play, Check, Clock, Users, DollarSign, Calculator, RefreshCw, Lock, Unlock, LogOut, Power, Smartphone, CreditCard, Banknote, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalVente, LocalVenteLigne, LocalClient, LocalAssurance, LocalProduit } from '../../lib/localDb';

interface FileAttenteItem {
  vente: LocalVente;
  lignes: (LocalVenteLigne & { produit?: LocalProduit })[];
  client?: LocalClient | null;
  assurance?: LocalAssurance | null;
}

export function CashierMenu() {
  const { utilisateur, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<'caisse' | 'file-attente'>('caisse');
  const [fileAttente, setFileAttente] = useState<FileAttenteItem[]>([]);
  const [venteEnCours, setVenteEnCours] = useState<FileAttenteItem | null>(null);
  const [loading, setLoading] = useState(false);
  
  // États de paiement
  const [montantPerçu, setMontantPerçu] = useState('');
  const [monnaieRendue, setMonnaieRendue] = useState(0);
  const [typePaiement, setTypePaiement] = useState<'especes' | 'mobile_money' | 'carte' | 'cheque'>('especes');
  const [operateurMobile, setOperateurMobile] = useState('Orange Money');
  const [numTransaction, setNumTransaction] = useState('');
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sessionOuverte, setSessionOuverte] = useState(true); // Mode démo simplifié
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [fondCaisseFinal, setFondCaisseFinal] = useState('');

  useEffect(() => {
    if (utilisateur) {
      loadFileAttente();
      if (autoRefresh) {
        const interval = setInterval(loadFileAttente, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [utilisateur, autoRefresh]);

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
      console.error('❌ Erreur chargement file attente (local):', error);
    }
  };

  const commencerPaiement = (item: FileAttenteItem) => {
    setVenteEnCours(item);
    setActiveSection('caisse');
    setMontantPerçu('');
    setMonnaieRendue(0);
    setTypePaiement('especes');
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
      alert(`Le montant perçu (${perçu.toLocaleString('fr-FR')} F) est inférieur au total (${venteEnCours.vente.montant_patient.toLocaleString('fr-FR')} F)`);
      return;
    }

    const monnaie = perçu - venteEnCours.vente.montant_patient;
    setLoading(true);

    try {
      await repository.updateVente(venteEnCours.vente.id, {
        statut: 'payee',
        caissier_id: utilisateur!.id,
        montant_percu: perçu,
        monnaie_rendue: monnaie > 0 ? monnaie : 0,
        type_paiement: typePaiement,
        operateur_mobile: typePaiement === 'mobile_money' ? operateurMobile : null,
        numero_transaction_mobile: typePaiement === 'mobile_money' ? numTransaction : null,
      });

      await generateTicket(venteEnCours, perçu, monnaie > 0 ? monnaie : 0, typePaiement);

      alert('✅ Paiement finalisé avec succès!');
      setVenteEnCours(null);
      setMontantPerçu('');
      setNumTransaction('');
      await loadFileAttente();
    } catch (error: any) {
      console.error('❌ Erreur finalisation:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (item: FileAttenteItem, montantPerçu: number, monnaieRendue: number, modePaiement: string) => {
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
            <title>Ticket - ${vente.numero_vente}</title>
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
                <div class="payment-line"><span>Mode de paiement:</span><span>${modePaiement.toUpperCase()}</span></div>
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

  if (!sessionOuverte) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Caisse Fermée</h1>
          <p className="text-gray-600 mb-6">{utilisateur?.nom_complet}, veuillez ouvrir la caisse pour commencer.</p>
          <button
            onClick={() => setSessionOuverte(true)}
            className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg"
          >
            <Unlock className="w-6 h-6" />
            <span className="font-semibold text-lg">Ouvrir la Caisse (Mode Démo)</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Caissier */}
      <div className="w-80 bg-gradient-to-b from-blue-800 to-indigo-900 text-white flex flex-col">
        <div className="p-6 border-b border-blue-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-8 h-8 text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Caisse</h1>
              <p className="text-blue-200 text-sm">Mode Hors-ligne Actif</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-300">Caissier:</span>
              <span className="font-medium">{utilisateur?.nom_complet}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection('caisse')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition ${activeSection === 'caisse' ? 'bg-white/20 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'}`}
          >
            <Play className="w-6 h-6" />
            <span className="font-medium text-lg">Encaissement</span>
          </button>
          <button
            onClick={() => setActiveSection('file-attente')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition ${activeSection === 'file-attente' ? 'bg-white/20 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'}`}
          >
            <Clock className="w-6 h-6" />
            <span className="font-medium text-lg">File d'Attente</span>
          </button>
        </nav>

        <div className="p-4 space-y-3 border-t border-blue-700">
          <button
            onClick={() => setShowCloseModal(true)}
            className="w-full flex items-center justify-center gap-3 py-3 bg-red-600/80 text-white rounded-xl hover:bg-red-600 transition font-medium"
          >
            <Power className="w-5 h-5" /> Arrêter la caisse
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-3 py-3 border border-blue-600 text-blue-100 rounded-xl hover:bg-blue-700 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {activeSection === 'caisse' ? 'Encaissement' : 'File d\'Attente'}
              </h1>
              <p className="text-gray-600 mt-1">
                {activeSection === 'caisse' ? 'Finalisez les paiements des commandes' : 'Commandes en attente de paiement'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                <Users className="w-5 h-5" />
                <span>En attente: {fileAttente.length}</span>
              </div>
              <button
                onClick={loadFileAttente}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          </div>

          {activeSection === 'file-attente' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {fileAttente.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Aucune commande en attente</p>
              ) : (
                <div className="space-y-3">
                  {fileAttente.map((item, index) => (
                    <div key={item.vente.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-lg">{item.vente.numero_vente}</p>
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
                          <p className="font-bold text-2xl text-blue-600">{item.vente.montant_patient.toLocaleString('fr-FR')} F</p>
                          <p className="text-sm text-gray-600">Position: {index + 1}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => commencerPaiement(item)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 mt-3"
                      >
                        <Play className="w-4 h-4" />
                        Encaisser cette commande
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File d'attente réduite (Gauche) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  File d'attente ({fileAttente.length})
                </h3>
                {fileAttente.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune commande en attente</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {fileAttente.map((item) => (
                      <div 
                        key={item.vente.id} 
                        onClick={() => commencerPaiement(item)}
                        className={`p-4 border rounded-lg cursor-pointer transition ${venteEnCours?.vente.id === item.vente.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:shadow-md'}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold">{item.vente.numero_vente}</p>
                            <p className="text-sm text-gray-600">{item.client?.nom_complet || 'Client'}</p>
                          </div>
                          <p className="font-bold text-lg">{item.vente.montant_patient.toLocaleString('fr-FR')} F</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Paiement en cours (Droite) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Paiement en cours
                </h3>

                {!venteEnCours ? (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Sélectionnez une commande dans la file d'attente pour commencer l'encaissement.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h4 className="font-bold text-lg text-emerald-800">{venteEnCours.vente.numero_vente}</h4>
                      <p className="text-emerald-700">Client: {venteEnCours.client?.nom_complet || 'Non enregistré'}</p>
                      {venteEnCours.vente.ordonnance_presente && (
                        <p className="text-sm text-emerald-600 font-medium mt-1">✓ Ordonnance vérifiée</p>
                      )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <h5 className="font-medium text-gray-900 sticky top-0 bg-white py-2">Détails de la commande:</h5>
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

                    {/* Sélecteur de mode de paiement */}
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

                    {/* Champs dynamiques pour Mobile Money */}
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
                      <h5 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        Encaissement
                      </h5>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total à payer:</span>
                          <span className="font-bold text-2xl text-blue-700">{venteEnCours.vente.montant_patient.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Montant perçu (FCFA):</label>
                          <input
                            type="number"
                            value={montantPerçu}
                            onChange={(e) => setMontantPerçu(e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xl font-semibold"
                            placeholder="Saisir le montant perçu"
                            autoFocus
                          />
                        </div>
                        {monnaieRendue > 0 && (
                          <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
                            <span className="font-medium text-green-800 text-lg">Monnaie à rendre:</span>
                            <span className="font-bold text-green-800 text-2xl">{monnaieRendue.toLocaleString('fr-FR')} F</span>
                          </div>
                        )}
                        {montantPerçu && parseFloat(montantPerçu) < venteEnCours.vente.montant_patient && (
                          <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg">
                            <span className="font-medium text-red-800">Montant insuffisant:</span>
                            <span className="font-bold text-red-800">{(venteEnCours.vente.montant_patient - parseFloat(montantPerçu)).toLocaleString('fr-FR')} F</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setVenteEnCours(null);
                          setMontantPerçu('');
                          setNumTransaction('');
                        }}
                        disabled={loading}
                        className="flex-1 py-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50 font-medium"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={finaliserPaiement}
                        disabled={loading || !montantPerçu || parseFloat(montantPerçu) < venteEnCours.vente.montant_patient || (typePaiement === 'mobile_money' && !numTransaction)}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium text-lg"
                      >
                        <Check className="w-6 h-6" />
                        {loading ? 'Traitement...' : 'Finaliser paiement'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de fermeture de caisse */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <Power className="w-8 h-8" />
              <h3 className="text-xl font-bold">Arrêter la session de caisse</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Veuillez compter le fond de caisse physique (espèces) et saisir le montant final pour clôturer la session.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fond de caisse final déclaré (FCFA) *</label>
              <input 
                type="number" 
                value={fondCaisseFinal} 
                onChange={(e) => setFondCaisseFinal(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-xl font-bold"
                placeholder="Ex: 150000"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setShowCloseModal(false); setFondCaisseFinal(''); }} 
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  alert(`✅ Caisse fermée avec succès !\nFond final déclaré: ${parseFloat(fondCaisseFinal || '0').toLocaleString('fr-FR')} F`);
                  setSessionOuverte(false);
                  setShowCloseModal(false);
                  setFondCaisseFinal('');
                }} 
                disabled={!fondCaisseFinal} 
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold disabled:opacity-50"
              >
                Confirmer la fermeture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
