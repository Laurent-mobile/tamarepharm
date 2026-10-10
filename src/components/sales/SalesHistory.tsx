// components/sales/SalesHistory.tsx
import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Filter, Printer, Eye, Shield, User, DollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository'; // ✅ Utilisation du repository
import { LocalVente, LocalClient, LocalAssurance, LocalProduit } from '../../lib/localDb';

interface VenteComplete {
  id: string;
  numero_vente: string;
  date_vente: string;
  montant_total: number;
  montant_assurance: number;
  montant_patient: number;
  montant_percu?: number;
  monnaie_rendue?: number;
  client_id?: string;
  clients: {
    nom_complet: string;
    telephone?: string;
    assurance_id?: string;
    numero_assure?: string;
    assurances?: {
      id: string;
      nom: string;
      taux_couverture: number;
    };
  } | null;
  vente_lignes: Array<{
    id: string;
    quantite: number;
    prix_unitaire: number;
    produit_id: string;
    produits: {
      nom: string;
      code_produit: string;
    };
  }>;
  caissier?: {
    nom_complet: string;
  };
  vendeur?: {
    nom_complet: string;
  };
}

export function SalesHistory() {
  const { utilisateur } = useAuth();
  const [ventes, setVentes] = useState<any[]>([]); // On utilise any temporairement pour la flexibilité des jointures locales
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [selectedVente, setSelectedVente] = useState<any | null>(null);

  const loadVentes = useCallback(async () => {
    if (!utilisateur?.pharmacy_id) return;
    
    try {
      console.log('🔄 Chargement des ventes depuis la base locale...');
      setLoading(true);

      // ✅ LECTURE LOCALE (Fonctionne hors-ligne)
      const ventesLocales = await repository.getVentes(utilisateur.pharmacy_id, dateDebut, dateFin);
      
      // Pour l'affichage, on enrichit les données avec les clients et produits locaux
      const clients = await repository.getClients(utilisateur.pharmacy_id);
      const assurances = await repository.getAssurances(utilisateur.pharmacy_id);
      const produits = await repository.getProduits(utilisateur.pharmacy_id);

      const ventesEnrichies = await Promise.all(ventesLocales.map(async (vente) => {
        const lignes = await repository.getVenteLignes(vente.id);
        const client = clients.find(c => c.id === vente.client_id);
        const assurance = client?.assurance_id ? assurances.find(a => a.id === client.assurance_id) : null;

        return {
          ...vente,
          clients: client ? { ...client, assurances: assurance } : null,
          vente_lignes: lignes.map(ligne => ({
            ...ligne,
            produits: produits.find(p => p.id === ligne.produit_id)
          }))
        };
      }));

      // Filtrer uniquement les ventes payées pour l'historique
      const ventesPayees = ventesEnrichies.filter(v => v.statut === 'payee')
                                           .sort((a, b) => new Date(b.date_vente).getTime() - new Date(a.date_vente).getTime());

      console.log(`✅ ${ventesPayees.length} ventes chargées localement`);
      setVentes(ventesPayees);
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
      setVentes([]);
    } finally {
      setLoading(false);
    }
  }, [utilisateur, dateDebut, dateFin]);

  useEffect(() => {
    if (utilisateur) {
      loadVentes();
    }
  }, [utilisateur, loadVentes]);

  const filteredVentes = ventes.filter((v) =>
    v.numero_vente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.clients?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.clients?.telephone?.includes(searchTerm) ||
    v.clients?.assurances?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.clients?.numero_assure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.caissier?.nom_complet?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateTicket = async (vente: VenteComplete) => {
    try {
      console.log('🎫 Génération ticket pour:', vente.numero_vente);
      
      const ticketWindow = window.open('', '_blank');
      if (!ticketWindow) {
        alert('Veuillez autoriser les pop-ups pour générer le ticket');
        return;
      }

      const isClientAssure = vente.clients?.assurance_id && vente.montant_assurance > 0;
      const montantPerçu = vente.montant_percu || vente.montant_patient;
      const monnaieRendue = vente.monnaie_rendue || 0;

      const ticketContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket de Caisse - ${vente.numero_vente}</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    font-size: 12px; 
                    max-width: 300px; 
                    margin: 0 auto; 
                    padding: 10px;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 15px; 
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                .pharmacy-name { 
                    font-weight: bold; 
                    font-size: 16px; 
                    margin-bottom: 5px;
                }
                .ticket-info { 
                    margin: 10px 0; 
                    padding: 10px 0;
                    border-bottom: 1px dashed #000;
                }
                .info-line { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 2px 0;
                }
                .assurance-info {
                    background: #f0f8ff;
                    border: 1px solid #b8daff;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 8px 0;
                }
                .assurance-line {
                    display: flex;
                    justify-content: space-between;
                    margin: 1px 0;
                    font-size: 11px;
                }
                .items { 
                    margin: 10px 0; 
                }
                .item-header {
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    margin-bottom: 5px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 3px;
                }
                .item { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 3px 0;
                    font-size: 11px;
                }
                .item-name { flex: 2; }
                .item-qty { flex: 1; text-align: center; }
                .item-price { flex: 1; text-align: right; }
                .item-total { flex: 1; text-align: right; }
                .payment-section {
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                    margin-top: 10px;
                }
                .payment-line {
                    display: flex;
                    justify-content: space-between;
                    margin: 2px 0;
                }
                .assurance-breakdown {
                    background: #f8f9fa;
                    border-radius: 4px;
                    padding: 6px;
                    margin: 4px 0;
                    font-size: 11px;
                }
                .total-section {
                    border-top: 2px solid #000;
                    padding-top: 5px;
                    margin-top: 5px;
                }
                .total { 
                    font-weight: bold; 
                    font-size: 14px;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 15px; 
                    font-size: 10px;
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                }
                @media print {
                    body { margin: 0; padding: 5px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="pharmacy-name">PHARMACIE BURKINA</div>
                <div>Ouagadougou, Burkina Faso</div>
                <div>Tél: +226 25 30 00 00</div>
            </div>
            
            <div class="ticket-info">
                <div class="info-line">
                    <span>Ticket N°:</span>
                    <span>${vente.numero_vente}</span>
                </div>
                <div class="info-line">
                    <span>Date:</span>
                    <span>${new Date(vente.date_vente).toLocaleString('fr-FR')}</span>
                </div>
                <div class="info-line">
                    <span>Client:</span>
                    <span>${vente.clients?.nom_complet || 'Non enregistré'}</span>
                </div>
                <div class="info-line">
                    <span>Caissier:</span>
                    <span>${vente.caissier?.nom_complet || 'Non spécifié'}</span>
                </div>
                ${isClientAssure ? `
                <div class="assurance-info">
                    <div class="assurance-line" style="font-weight: bold;">
                        <span>CLIENT ASSURÉ</span>
                    </div>
                    <div class="assurance-line">
                        <span>Assurance:</span>
                        <span>${vente.clients?.assurances?.nom || 'N/A'}</span>
                    </div>
                    <div class="assurance-line">
                        <span>N° Assuré:</span>
                        <span>${vente.clients?.numero_assure || 'N/A'}</span>
                    </div>
                    <div class="assurance-line">
                        <span>Taux couverture:</span>
                        <span>${vente.clients?.assurances?.taux_couverture || 0}%</span>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="items">
                <div class="item-header">
                    <div class="item-name">Produit</div>
                    <div class="item-qty">Qty</div>
                    <div class="item-price">Prix</div>
                    <div class="item-total">Total</div>
                </div>
                ${vente.vente_lignes.map((ligne) => `
                    <div class="item">
                        <div class="item-name">${ligne.produits.nom}</div>
                        <div class="item-qty">${ligne.quantite}</div>
                        <div class="item-price">${ligne.prix_unitaire}F</div>
                        <div class="item-total">${(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="payment-section">
                <div class="payment-line">
                    <span>Total produits:</span>
                    <span>${Number(vente.montant_total).toLocaleString('fr-FR')} F</span>
                </div>
                
                ${isClientAssure ? `
                <div class="assurance-breakdown">
                    <div class="payment-line" style="color: #0066cc;">
                        <span>Prise en charge assurance:</span>
                        <span>- ${Number(vente.montant_assurance).toLocaleString('fr-FR')} F</span>
                    </div>
                    <div class="payment-line" style="font-size: 10px; color: #666;">
                        <span>(Taux: ${vente.clients?.assurances?.taux_couverture || 0}%)</span>
                        <span>${Number(vente.montant_total).toLocaleString('fr-FR')} F × ${vente.clients?.assurances?.taux_couverture || 0}%</span>
                    </div>
                </div>
                ` : ''}
                
                <div class="payment-line" style="font-weight: bold; border-top: 1px solid #000; padding-top: 5px;">
                    <span>Total à payer:</span>
                    <span>${Number(vente.montant_patient).toLocaleString('fr-FR')} F</span>
                </div>
                
                <div class="payment-line">
                    <span>Montant perçu:</span>
                    <span>${montantPerçu.toLocaleString('fr-FR')} F</span>
                </div>
                
                <div class="payment-line">
                    <span>Monnaie rendue:</span>
                    <span>${monnaieRendue.toLocaleString('fr-FR')} F</span>
                </div>
            </div>
            
            <div class="total-section">
                <div class="payment-line total">
                    <span>TOTAL VENTE:</span>
                    <span>${Number(vente.montant_total).toLocaleString('fr-FR')} F</span>
                </div>
            </div>
            
            ${isClientAssure ? `
            <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; font-size: 10px;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 3px;">INFORMATION ASSURANCE</div>
                <div>Montant à réclamer: <strong>${Number(vente.montant_assurance).toLocaleString('fr-FR')} F</strong></div>
                <div>Date limite réclamation: ${new Date(new Date(vente.date_vente).setDate(new Date(vente.date_vente).getDate() + 30)).toLocaleDateString('fr-FR')}</div>
            </div>
            ` : ''}
            
            <div class="footer">
                <div>Merci de votre confiance !</div>
                <div>À bientôt dans notre pharmacie</div>
                <div>*** ${new Date().toLocaleDateString('fr-FR')} ***</div>
            </div>

            <script>
                setTimeout(() => window.print(), 500);
                window.onafterprint = () => setTimeout(() => window.close(), 1000);
            </script>
        </body>
        </html>
      `;

      ticketWindow.document.write(ticketContent);
      ticketWindow.document.close();
      
      setTimeout(() => {
        ticketWindow.print();
        setTimeout(() => {
          ticketWindow.close();
        }, 500);
      }, 500);
    } catch (error) {
      console.error('Erreur génération ticket:', error);
      alert('Erreur lors de la génération du ticket');
    }
  };

  const VenteDetailsModal = ({ vente, onClose }: { vente: VenteComplete, onClose: () => void }) => {
    const isClientAssure = vente.clients?.assurance_id && vente.montant_assurance > 0;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Détails de la vente</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="font-medium text-gray-700">Numéro vente:</label>
                  <p className="font-mono">{vente.numero_vente}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Date:</label>
                  <p>{new Date(vente.date_vente).toLocaleString('fr-FR')}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Client:</label>
                  <p>{vente.clients?.nom_complet || 'Non enregistré'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Vendeur:</label>
                  <p>{vente.vendeur?.nom_complet || 'Non spécifié'}</p>
                </div>
              </div>

              {/* Informations de caisse */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Informations de Caisse
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Caissier:</span>
                    <p className="text-blue-700">{vente.caissier?.nom_complet || 'Non spécifié'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Montant perçu:</span>
                    <p className="text-blue-700 font-bold">
                      {Number(vente.montant_percu || vente.montant_patient).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Monnaie rendue:</span>
                    <p className="text-blue-700 font-bold">
                      {Number(vente.monnaie_rendue || 0).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Total à payer:</span>
                    <p className="text-blue-700 font-bold">
                      {Number(vente.montant_patient).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                </div>
              </div>

              {/* Informations assurance */}
              {isClientAssure && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Informations Assurance
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Assurance:</span>
                      <p className="text-green-700">{vente.clients?.assurances?.nom}</p>
                    </div>
                    <div>
                      <span className="font-medium">Taux couverture:</span>
                      <p className="text-green-700">{vente.clients?.assurances?.taux_couverture}%</p>
                    </div>
                    <div>
                      <span className="font-medium">N° Assuré:</span>
                      <p className="text-green-700">{vente.clients?.numero_assure || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Montant assurance:</span>
                      <p className="text-green-700 font-bold">{Number(vente.montant_assurance).toLocaleString('fr-FR')} F</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Répartition des montants pour clients assurés */}
              {isClientAssure && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-bold text-purple-900 mb-3">Répartition du paiement</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total des produits:</span>
                      <span className="font-medium">{Number(vente.montant_total).toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Prise en charge assurance:</span>
                      <span className="font-medium">- {Number(vente.montant_assurance).toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Total payé par le patient:</span>
                      <span className="text-green-700">{Number(vente.montant_patient).toLocaleString('fr-FR')} F</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Produits vendus */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Produits vendus:</h4>
                {vente.vente_lignes?.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucun produit trouvé</p>
                ) : (
                  <div className="space-y-2">
                    {vente.vente_lignes?.map((ligne, index) => (
                      <div key={ligne.id || index} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{ligne.produits.nom}</p>
                          <p className="text-sm text-gray-600">
                            Code: {ligne.produits.code_produit} | 
                            Prix unitaire: {ligne.prix_unitaire} F
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{ligne.quantite} unités</p>
                          <p className="text-sm text-gray-600">
                            Sous-total: {(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const exportCSV = () => {
    const headers = [
      'Numéro', 
      'Date', 
      'Client', 
      'Caissier',
      'Montant Total', 
      'Montant Assurance', 
      'Montant Patient',
      'Montant Perçu',
      'Monnaie Rendue',
      'Nombre de produits'
    ];
    
    const csvData = ventes.map(vente => [
      vente.numero_vente,
      new Date(vente.date_vente).toLocaleDateString('fr-FR'),
      vente.clients?.nom_complet || 'Non enregistré',
      vente.caissier?.nom_complet || 'Non spécifié',
      Number(vente.montant_total).toLocaleString('fr-FR'),
      Number(vente.montant_assurance).toLocaleString('fr-FR'),
      Number(vente.montant_patient).toLocaleString('fr-FR'),
      Number(vente.montant_percu || vente.montant_patient).toLocaleString('fr-FR'),
      Number(vente.monnaie_rendue || 0).toLocaleString('fr-FR'),
      vente.vente_lignes?.length || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Statistiques
  const stats = {
    totalVentes: filteredVentes.length,
    totalMontant: filteredVentes.reduce((sum, v) => sum + v.montant_total, 0),
    totalAssurance: filteredVentes.reduce((sum, v) => sum + v.montant_assurance, 0),
    clientsAssures: filteredVentes.filter(v => v.clients?.assurance_id).length
  };

  return (
    <div className="space-y-6">
      {selectedVente && (
        <VenteDetailsModal 
          vente={selectedVente} 
          onClose={() => setSelectedVente(null)} 
        />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Historique des Ventes</h2>
          <p className="text-gray-600 mt-1">Toutes les ventes finalisées avec gestion des assurances</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ventes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalVentes}</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Download className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Chiffre d'affaires</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalMontant.toLocaleString('fr-FR')} F
              </p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Assurance</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.totalAssurance.toLocaleString('fr-FR')} F
              </p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clients Assurés</p>
              <p className="text-2xl font-bold text-purple-600">{stats.clientsAssures}</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par vente, client, assurance, caissier..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              placeholder="Date début"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              placeholder="Date fin"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredVentes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune vente trouvée</p>
            <button 
              onClick={loadVentes}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Recharger
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Vente</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Caissier</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Assurance</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Patient</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant Perçu</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Monnaie</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentes.map((vente) => {
                  const isClientAssure = vente.clients?.assurance_id && vente.montant_assurance > 0;
                  
                  return (
                    <tr key={vente.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{vente.numero_vente}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {vente.clients?.nom_complet || 'Non enregistré'}
                      </td>
                      <td className="py-3 px-4">
                        {vente.caissier?.nom_complet || 'Non spécifié'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {Number(vente.montant_total).toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isClientAssure ? (
                          <span className="text-blue-600 font-medium">
                            {Number(vente.montant_assurance).toLocaleString('fr-FR')} F
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isClientAssure ? (
                          <span className="text-green-600 font-medium">
                            {Number(vente.montant_patient).toLocaleString('fr-FR')} F
                          </span>
                        ) : (
                          <span className="font-medium">
                            {Number(vente.montant_total).toLocaleString('fr-FR')} F
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {Number(vente.montant_percu || vente.montant_patient).toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 px-4 text-right">
                        {Number(vente.monnaie_rendue || 0).toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedVente(vente)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            Détails
                          </button>
                          <button
                            onClick={() => generateTicket(vente)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                          >
                            <Printer className="w-4 h-4" />
                            Ticket
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
