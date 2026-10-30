import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, Building2, FileText, Gift, CreditCard, TrendingUp, Printer, X, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { LocalCompteClient, LocalHistoriqueConsommationCompte, LocalClient } from '../../lib/localDb';

export function ComptesClientsManager() {
  const { utilisateur } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'depot' | 'recouvrement'>('dashboard');
  const [comptes, setComptes] = useState<LocalCompteClient[]>([]);
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCompte, setSelectedCompte] = useState<LocalCompteClient | null>(null);
  const [historique, setHistorique] = useState<LocalHistoriqueConsommationCompte[]>([]);

  const [depotData, setDepotData] = useState({
    client_id: '',
    type_compte: 'avoir' as 'avoir' | 'credit_bon',
    montant: 0,
    societe_reference: '',
    description: ''
  });

  useEffect(() => {
    if (utilisateur) loadData();
  }, [utilisateur]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [comptesData, clientsData] = await Promise.all([
        repository.getAllComptesClients(utilisateur!.pharmacy_id),
        repository.getAllClientsForAccounts(utilisateur!.pharmacy_id)
      ]);
      setComptes(comptesData);
      setClients(clientsData);
    } catch (error) {
      console.error('Erreur chargement comptes:', error);
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (compte: LocalCompteClient) => {
    setSelectedCompte(compte);
    const hist = await repository.getHistoriqueCompte(compte.id);
    setHistorique(hist);
    setShowHistoryModal(true);
  };

  const handleDepot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depotData.client_id || depotData.montant <= 0) {
      alert('Veuillez sélectionner un client et saisir un montant valide.');
      return;
    }

    try {
      await repository.enregistrerDepotClient(
        utilisateur!.pharmacy_id,
        depotData.client_id,
        depotData.type_compte,
        depotData.montant,
        depotData.societe_reference || undefined,
        depotData.description || undefined
      );
      alert('✅ Dépôt enregistré avec succès !');
      setDepotData({ client_id: '', type_compte: 'avoir', montant: 0, societe_reference: '', description: '' });
      setActiveTab('dashboard');
      loadData();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const clientsFiltresPourDepot = useMemo(() => {
    if (depotData.type_compte === 'avoir') {
      return clients.filter(c => c.autorise_avoir === true);
    } else if (depotData.type_compte === 'credit_bon') {
      return clients.filter(c => c.autorise_credit === true);
    }
    return clients;
  }, [clients, depotData.type_compte]);

  const stats = useMemo(() => {
    const totalAvoir = comptes.filter(c => c.type_compte === 'avoir').reduce((sum, c) => sum + c.solde_actuel, 0);
    const totalCreditBon = comptes.filter(c => c.type_compte === 'credit_bon').reduce((sum, c) => sum + c.solde_actuel, 0);
    return { totalAvoir, totalCreditBon, totalComptes: comptes.length };
  }, [comptes]);

  const etatRecouvrement = useMemo(() => {
    const recouvrement: Record<string, { societe: string, total_consomme: number, nb_employes: number, employes: string[] }> = {};
    const comptesCreditBon = comptes.filter(c => c.type_compte === 'credit_bon');
    
    comptesCreditBon.forEach(compte => {
      const client = clients.find(c => c.id === compte.client_id);
      const societe = compte.societe_reference || client?.entreprise || 'Société Inconnue';
      
      if (!recouvrement[societe]) {
        recouvrement[societe] = { societe, total_consomme: 0, nb_employes: 0, employes: [] };
      }
      recouvrement[societe].total_consomme += compte.solde_actuel; 
      if (client && !recouvrement[societe].employes.includes(client.nom_complet)) {
        recouvrement[societe].nb_employes++;
        recouvrement[societe].employes.push(client.nom_complet);
      }
    });
    return Object.values(recouvrement).sort((a, b) => b.total_consomme - a.total_consomme);
  }, [comptes, clients]);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;
  const exporterRecouvrementPDF = () => {
    const doc = new jsPDF();
    const pharmacyName = "PHARMACIE TAMAR"; // Vous pouvez rendre ceci dynamique plus tard

    // En-tête
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text(`ÉTAT DE RECOUVREMENT`, 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Émetteur : ${pharmacyName}`, 14, 35);
    doc.text(`Date d'édition : ${new Date().toLocaleDateString('fr-FR')}`, 14, 42);

    // Préparation des données pour le tableau
    const totalGeneral = etatRecouvrement.reduce((sum, item) => sum + item.total_consomme, 0);
    const tableData = etatRecouvrement.map(item => [
      item.societe,
      item.nb_employes.toString(),
      `${item.total_consomme.toLocaleString('fr-FR')} F`,
      item.employes.join(', ')
    ]);

    // Génération du tableau
    (doc as any).autoTable({
      startY: 50,
      head: [['Société Émettrice', 'Nb. Employés', 'Montant à Recouvrer', 'Employés concernés']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      foot: [['TOTAL GÉNÉRAL', '', `${totalGeneral.toLocaleString('fr-FR')} F`, '']],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 'auto' }
      }
    });

    // Pied de page
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text("Signature et cachet de la pharmacie :", 14, finalY);
    doc.line(14, finalY + 20, 80, finalY + 20);

    // Sauvegarde
    doc.save(`Recouvrement_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Comptes Clients</h2>
          <p className="text-gray-600 mt-1">Avoirs, Crédits Bons et Recouvrement Sociétés</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-4 font-medium border-b-2 transition ${activeTab === 'dashboard' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <TrendingUp className="w-5 h-5 inline mr-2" />Tableau de bord
          </button>
          <button onClick={() => setActiveTab('depot')} className={`px-6 py-4 font-medium border-b-2 transition ${activeTab === 'depot' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Plus className="w-5 h-5 inline mr-2" />Nouveau Dépôt
          </button>
          <button onClick={() => setActiveTab('recouvrement')} className={`px-6 py-4 font-medium border-b-2 transition ${activeTab === 'recouvrement' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Building2 className="w-5 h-5 inline mr-2" />États de Recouvrement
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg"><Gift className="w-8 h-8 text-green-600" /></div>
                    <div>
                      <p className="text-sm font-medium text-green-700">Total Avoirs (Espèces)</p>
                      <p className="text-2xl font-bold text-green-900">{stats.totalAvoir.toLocaleString('fr-FR')} F</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg"><CreditCard className="w-8 h-8 text-blue-600" /></div>
                    <div>
                      <p className="text-sm font-medium text-blue-700">Total Crédits Bons (Sociétés)</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.totalCreditBon.toLocaleString('fr-FR')} F</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg"><FileText className="w-8 h-8 text-purple-600" /></div>
                    <div>
                      <p className="text-sm font-medium text-purple-700">Comptes Actifs</p>
                      <p className="text-2xl font-bold text-purple-900">{stats.totalComptes}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Liste des comptes clients</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Client</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Société / Référence</th>
                        <th className="px-4 py-3 text-right">Solde Actuel</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {comptes.map((compte) => {
                        const client = clients.find(c => c.id === compte.client_id);
                        return (
                          <tr key={compte.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{client?.nom_complet || 'Client inconnu'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-bold rounded-full ${compte.type_compte === 'avoir' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {compte.type_compte === 'avoir' ? 'Avoir' : 'Crédit Bon'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{compte.societe_reference || client?.entreprise || '-'}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{compte.solde_actuel.toLocaleString('fr-FR')} F</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => openHistory(compte)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                                <Eye className="w-4 h-4" /> Historique
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {comptes.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun compte client actif.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'depot' && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ArrowDownCircle className="w-6 h-6 text-emerald-600" /> Enregistrer un dépôt
              </h3>
              <form onSubmit={handleDepot} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type de dépôt *</label>
                    <div className="flex gap-4">
                      <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition ${depotData.type_compte === 'avoir' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>
                        <input type="radio" name="type" value="avoir" checked={depotData.type_compte === 'avoir'} onChange={() => setDepotData({...depotData, type_compte: 'avoir', client_id: ''})} className="hidden" />
                        <Gift className="w-5 h-5" /> Avoir (Espèces)
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition ${depotData.type_compte === 'credit_bon' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>
                        <input type="radio" name="type" value="credit_bon" checked={depotData.type_compte === 'credit_bon'} onChange={() => setDepotData({...depotData, type_compte: 'credit_bon', client_id: ''})} className="hidden" />
                        <CreditCard className="w-5 h-5" /> Crédit Bon (Société)
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
                    <select 
                      value={depotData.client_id} 
                      onChange={(e) => setDepotData({...depotData, client_id: e.target.value})} 
                      required 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Sélectionner un client autorisé --</option>
                      {clientsFiltresPourDepot.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nom_complet} {c.entreprise ? `(${c.entreprise})` : ''} {c.matricule ? `- Mat: ${c.matricule}` : ''}
                        </option>
                      ))}
                    </select>
                    
                    {clientsFiltresPourDepot.length === 0 && (
                      <p className="text-sm text-red-600 mt-2 flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-200">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" /> 
                        <span>Aucun client n'est autorisé pour ce type de dépôt (<strong>{depotData.type_compte === 'avoir' ? 'Avoir' : 'Crédit Bon'}</strong>). Veuillez d'abord modifier les autorisations de ce client dans la fiche client.</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Montant (FCFA) *</label>
                    <input type="number" min="1" value={depotData.montant || ''} onChange={(e) => setDepotData({...depotData, montant: parseFloat(e.target.value) || 0})} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg font-bold" />
                  </div>

                  {depotData.type_compte === 'credit_bon' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Société émettrice (pour recouvrement) *</label>
                      <input type="text" value={depotData.societe_reference} onChange={(e) => setDepotData({...depotData, societe_reference: e.target.value})} required placeholder="Ex: SONABEL, CNSS..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Référence / Description (Optionnel)</label>
                    <input type="text" value={depotData.description} onChange={(e) => setDepotData({...depotData, description: e.target.value})} placeholder="Ex: Bon physique N°12345, Dépôt espèces..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t">
                  <button type="button" onClick={() => setActiveTab('dashboard')} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button type="submit" disabled={clientsFiltresPourDepot.length === 0} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus className="w-5 h-5" /> Valider le dépôt
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'recouvrement' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Building2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-blue-900">États de recouvrement par Société</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Liste des sociétés (ex: SONABEL, CNSS) auxquelles vous devez facturer les "Crédits Bons" consommés par leurs employés. 
                    Imprimez cet état pour aller récupérer l'argent.
                  </p>
                </div>
                <div className="flex gap-3">
  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
    <Printer className="w-4 h-4" /> Imprimer
  </button>
  <button onClick={exporterRecouvrementPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
    <FileText className="w-4 h-4" /> Exporter en PDF
  </button>
</div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Société Émettrice</th>
                      <th className="px-4 py-3 text-center">Nb. Employés</th>
                      <th className="px-4 py-3 text-right">Solde Restant à Recouvrer (F)</th>
                      <th className="px-4 py-3 text-left">Employés concernés</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {etatRecouvrement.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-bold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-gray-400" /> {item.societe}
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600">{item.nb_employes}</td>
                        <td className="px-4 py-4 text-right font-bold text-blue-700 text-lg">{item.total_consomme.toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{item.employes.join(', ')}</td>
                      </tr>
                    ))}
                    {/* ✅ MESSAGE D'AIDE AMÉLIORÉ */}
                    {etatRecouvrement.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-3">
                            <Building2 className="w-12 h-12 text-gray-300" />
                            <p className="font-medium">Aucun crédit bon actif à recouvrer pour le moment.</p>
                            <p className="text-sm text-gray-400 max-w-md">
                              💡 <strong>Astuce :</strong> Cet onglet affiche uniquement les dépôts de type <span className="font-bold text-blue-600">"Crédit Bon (Société)"</span>. 
                              Les "Avoirs (Espèces)" n'apparaissent pas ici. Allez dans l'onglet <span className="font-bold text-emerald-600">"Nouveau Dépôt"</span> pour en créer un.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showHistoryModal && selectedCompte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Historique du compte</h3>
                <p className="text-sm text-gray-600">
                  Client: <span className="font-semibold">{clients.find(c => c.id === selectedCompte.client_id)?.nom_complet}</span>
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-200 rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 uppercase font-bold">Type de compte</p>
                  <p className="text-lg font-bold text-blue-900 capitalize">{selectedCompte.type_compte === 'avoir' ? 'Avoir (Espèces)' : 'Crédit Bon (Société)'}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <p className="text-xs text-emerald-600 uppercase font-bold">Solde Actuel</p>
                  <p className="text-lg font-bold text-emerald-900">{selectedCompte.solde_actuel.toLocaleString('fr-FR')} F</p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-3">Détail des opérations</h4>
              <div className="space-y-3">
                {historique.map((op) => (
                  <div key={op.id} className={`flex items-center justify-between p-4 rounded-lg border ${op.type_operation === 'depot' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${op.type_operation === 'depot' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {op.type_operation === 'depot' ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 capitalize">{op.type_operation === 'depot' ? 'Dépôt / Rechargement' : 'Consommation (Vente)'}</p>
                        <p className="text-xs text-gray-500">{new Date(op.date_operation).toLocaleString('fr-FR')} • {op.description || 'Opération standard'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${op.type_operation === 'depot' ? 'text-green-700' : 'text-red-700'}`}>
                        {op.type_operation === 'depot' ? '+' : '-'}{op.montant.toLocaleString('fr-FR')} F
                      </p>
                      <p className="text-xs text-gray-500">Solde après: {op.solde_apres_operation.toLocaleString('fr-FR')} F</p>
                    </div>
                  </div>
                ))}
                {historique.length === 0 && <p className="text-center text-gray-500 py-4">Aucune opération enregistrée.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
