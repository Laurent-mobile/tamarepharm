import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, ShoppingCart, User, FileText, Shield, Package, CreditCard, Gift, AlertCircle, AlertTriangle, Banknote } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalProduit, LocalClient, LocalAssurance } from '../../lib/localDb';

export function AuxiliaryManager() {
  const { utilisateur, dataVersion } = useAuth();
  const [products, setProducts] = useState<LocalProduit[]>([]);
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [assurances, setAssurances] = useState<LocalAssurance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [ordonnancePresente, setOrdonnancePresente] = useState(false);
  const [cart, setCart] = useState<Array<{ produit: LocalProduit; quantite: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [showAssuranceForm, setShowAssuranceForm] = useState(false);
  const [stockVerification, setStockVerification] = useState<Record<string, { disponible: number; total: number }>>({});

  // États pour les types de vente
  const [typeDeVente, setTypeDeVente] = useState<'ordinaire' | 'bon' | 'credit' | 'avoir' | 'credit_bon'>('ordinaire');
  const [numeroBon, setNumeroBon] = useState('');
  const [dateLimiteCredit, setDateLimiteCredit] = useState('');
  
  // ✅ NOUVEAU : État pour gérer le reliquat (paiement comptant immédiat si plafond dépassé)
  const [montantPayeComptant, setMontantPayeComptant] = useState(0);

  useEffect(() => {
    if (utilisateur) loadInitialData();
  }, [utilisateur, dataVersion]);

  // Filtrage dynamique des clients
  const clientsFiltres = useMemo(() => {
    if (typeDeVente === 'ordinaire') return clients;
    if (typeDeVente === 'bon') return clients.filter(c => c.autorise_bon);
    if (typeDeVente === 'credit' || typeDeVente === 'credit_bon') return clients.filter(c => c.autorise_credit);
    if (typeDeVente === 'avoir') return clients.filter(c => c.autorise_avoir);
    return clients;
  }, [clients, typeDeVente]);

  // Calcul automatique de la date limite (J + 30 jours)
  useEffect(() => {
    if (typeDeVente === 'credit' && selectedClient) {
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      setDateLimiteCredit(today.toISOString().split('T')[0]);
    } else {
      setDateLimiteCredit('');
    }
    // Reset du reliquat quand on change de client ou de type
    setMontantPayeComptant(0);
  }, [typeDeVente, selectedClient]);

  const loadInitialData = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      const [productsData, clientsData, assurancesData, stockData] = await Promise.all([
        repository.getProduits(utilisateur.pharmacy_id),
        repository.getClients(utilisateur.pharmacy_id),
        repository.getAssurances(utilisateur.pharmacy_id),
        repository.getStock(utilisateur.pharmacy_id),
      ]);

      setProducts(productsData || []);
      setClients(clientsData || []);
      setAssurances(assurancesData || []);
      
      const stockMap: Record<string, { disponible: number; total: number }> = {};
      stockData?.forEach(item => {
        if (stockMap[item.produit_id]) {
          stockMap[item.produit_id].total += item.quantite || 0;
          stockMap[item.produit_id].disponible += item.quantite || 0;
        } else {
          stockMap[item.produit_id] = { total: item.quantite || 0, disponible: item.quantite || 0 };
        }
      });
      productsData.forEach(product => {
        if (!stockMap[product.id]) stockMap[product.id] = { total: 0, disponible: 0 };
      });
      setStockVerification(stockMap);
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    }
  };

  const addToCart = (produit: LocalProduit) => {
    const stockDisponible = stockVerification[produit.id]?.disponible || 0;
    if (stockDisponible <= 0) { alert(`❌ Stock insuffisant pour ${produit.nom}`); return; }

    setCart(prev => {
      const existing = prev.find(item => item.produit.id === produit.id);
      const nouvelleQuantite = existing ? existing.quantite + 1 : 1;
      if (nouvelleQuantite > stockDisponible) { alert(`️ Stock disponible: ${stockDisponible} unités`); return prev; }
      if (existing) return prev.map(item => item.produit.id === produit.id ? { ...item, quantite: nouvelleQuantite } : item);
      return [...prev, { produit, quantite: 1 }];
    });
  };

  const removeFromCart = (produitId: string) => setCart(prev => prev.filter(item => item.produit.id !== produitId));

  const updateQuantity = (produitId: string, quantite: number) => {
    if (quantite < 1) { removeFromCart(produitId); return; }
    const stockDisponible = stockVerification[produitId]?.disponible || 0;
    if (quantite > stockDisponible) { alert(`⚠️ Stock disponible: ${stockDisponible} unités`); return; }
    setCart(prev => prev.map(item => item.produit.id === produitId ? { ...item, quantite } : item));
  };

  const clientData = clients.find(c => c.id === selectedClient);
  const clientAssurance = assurances.find(a => a.id === clientData?.assurance_id);
  const tauxCouverture = clientData?.taux_couverture || clientAssurance?.taux_couverture || 0;
  
  const totalAmount = cart.reduce((sum, item) => sum + (item.produit.prix_vente * item.quantite), 0);
  const montantAssurance = tauxCouverture > 0 ? (totalAmount * tauxCouverture) / 100 : 0;
  const montantPatient = totalAmount - montantAssurance;

  // ✅ LOGIQUE DE VÉRIFICATION DU PLAFOND ET RELIQUAT
  const plafondCredit = clientData?.plafond_credit || 0;
  const depassementPlafond = montantPatient - plafondCredit;
  const estPlafondDepasse = typeDeVente === 'credit' && plafondCredit > 0 && depassementPlafond > 0;
  const montantCreditReel = estPlafondDepasse ? (montantPatient - montantPayeComptant) : montantPatient;

  const validerCommande = async () => {
  if (cart.length === 0) { alert('Veuillez ajouter des produits au panier'); return; }
  if (typeDeVente === 'bon' && !numeroBon.trim()) { alert('Veuillez saisir le numéro du bon'); return; }
  if (typeDeVente === 'credit' && (!clientData || !dateLimiteCredit)) { alert('Veuillez sélectionner un client autorisé au crédit'); return; }

  // ✅ BLOCAGE SI LE PLAFOND EST DÉPASSÉ SANS PAIEMENT DU RELIQUAT
  if (estPlafondDepasse) {
    if (montantPayeComptant < depassementPlafond) {
      alert(`⚠️ Le plafond de crédit est dépassé de ${depassementPlafond.toLocaleString('fr-FR')} F.\n\nVous devez soit :\n1. Retirer des produits du panier.\n2. Encaisser au moins ${depassementPlafond.toLocaleString('fr-FR')} F comptant immédiatement.`);
      return;
    }
    if (montantCreditReel > plafondCredit) {
      alert(`❌ Erreur : La partie crédit (${montantCreditReel.toLocaleString('fr-FR')} F) ne peut pas dépasser le plafond (${plafondCredit.toLocaleString('fr-FR')} F).`);
      return;
    }
  }

  setLoading(true);
  try {
    const numeroVente = `V-${Date.now().toString().slice(-6)}`;
    
    // ✅ SÉPARATION CLAIRE DES MONTANTS
    const venteData = {
      pharmacy_id: utilisateur!.pharmacy_id,
      client_id: selectedClient || null,
      numero_vente: numeroVente,
      date_vente: new Date().toISOString().split('T')[0],
      statut: 'en_attente_paiement',
      montant_total: totalAmount,
      montant_assurance: montantAssurance,
      montant_patient: montantPatient,
      vendeur_id: utilisateur!.id,
      ordonnance_presente: ordonnancePresente,
      type_de_vente: typeDeVente,
      numero_bon: typeDeVente === 'bon' ? numeroBon : null,
      
      // ✅ GESTION DU CRÉDIT PARTIEL
      montant_credit: typeDeVente === 'credit' ? montantCreditReel : 0,
      montant_paye_comptant: typeDeVente === 'credit' && estPlafondDepasse ? montantPayeComptant : 0,
      date_limite_credit: typeDeVente === 'credit' ? dateLimiteCredit : null,
    };

    const lignes = cart.map(item => ({
      produit_id: item.produit.id,
      quantite: item.quantite,
      prix_unitaire: item.produit.prix_vente,
      montant_total: item.produit.prix_vente * item.quantite,
    }));

    await repository.createVente(venteData, lignes);
    
    // ✅ MESSAGE CLAIR SELON LE CAS
    if (estPlafondDepasse && montantPayeComptant > 0) {
      alert(`✅ Commande ${numeroVente} validée !\n\n💰 Montant à encaisser à la caisse : ${montantPayeComptant.toLocaleString('fr-FR')} F\n📊 Montant en crédit : ${montantCreditReel.toLocaleString('fr-FR')} F\n\nLe crédit sera tracé dans le compte client.`);
    } else {
      alert(`✅ Commande ${numeroVente} validée et envoyée à la caisse!`);
    }
    
    // Reset
    setCart([]); 
    setSelectedClient(''); 
    setOrdonnancePresente(false);
    setTypeDeVente('ordinaire'); 
    setNumeroBon(''); 
    setMontantPayeComptant(0);
    await loadInitialData();
  } catch (error: any) {
    console.error('❌ Erreur validation commande:', error);
    alert('Erreur lors de la validation: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  const filteredProducts = products.filter((p) =>
    p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.dci?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code_produit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showAssuranceForm) {
    return <AssuranceForm pharmacyId={utilisateur!.pharmacy_id} onClose={() => { setShowAssuranceForm(false); loadInitialData(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Accueil Client</h2>
          <p className="text-gray-600 mt-1">Préparation des commandes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panier et Type de vente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Panier de commande
          </h3>
          
          <div className="mb-4 space-y-4">
            {/* Sélecteur de Type de Vente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de vente</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'ordinaire', label: 'Ordinaire', icon: ShoppingCart, color: 'bg-blue-500' },
                  { id: 'bon', label: 'Avec Bon', icon: FileText, color: 'bg-purple-500' },
                  { id: 'credit', label: 'À Crédit', icon: CreditCard, color: 'bg-amber-500' },
                  { id: 'avoir', label: 'Avec Avoir', icon: Gift, color: 'bg-green-500' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setTypeDeVente(type.id as any); setSelectedClient(''); setMontantPayeComptant(0); }}
                    className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                      typeDeVente === type.id ? `${type.color} text-white border-transparent` : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <type.icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {typeDeVente === 'bon' && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="block text-sm font-medium text-purple-900 mb-1">Numéro du bon *</label>
                <input type="text" value={numeroBon} onChange={(e) => setNumeroBon(e.target.value)} className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Ex: BON-2024-001" required />
              </div>
            )}

            {/* ✅ SECTION CRÉDIT AVEC GESTION DU RELIQUAT */}
            {typeDeVente === 'credit' && (
              <div className={`p-4 border rounded-lg space-y-3 ${estPlafondDepasse ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
                {clientData ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Plafond de crédit autorisé</label>
                        <input type="text" value={`${plafondCredit.toLocaleString('fr-FR')} F`} readOnly className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-bold cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Total à payer (Achat)</label>
                        <input type="text" value={`${montantPatient.toLocaleString('fr-FR')} F`} readOnly className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-bold cursor-not-allowed" />
                      </div>
                    </div>

                    {/* ✅ ALERTE ET GESTION DU RELIQUAT SI PLAFOND DÉPASSÉ */}
                    {estPlafondDepasse && (
                      <div className="bg-white p-3 rounded border border-red-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-2 text-red-800">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm">Plafond dépassé de {depassementPlafond.toLocaleString('fr-FR')} F</p>
                            <p className="text-xs text-red-600 mt-1">Le client doit payer la différence comptant immédiatement, ou retirer des produits.</p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-red-900 mb-1 flex items-center gap-1">
                            <Banknote className="w-3 h-3"/> Montant encaissé comptant (Reliquat) *
                          </label>
                          <input
                            type="number"
                            min={depassementPlafond}
                            value={montantPayeComptant}
                            onChange={(e) => setMontantPayeComptant(parseFloat(e.target.value) || 0)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-bold ${montantPayeComptant >= depassementPlafond ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}
                            placeholder={`Minimum: ${depassementPlafond}`}
                          />
                          {montantPayeComptant < depassementPlafond && montantPayeComptant > 0 && (
                            <p className="text-xs text-red-600 mt-1">Il manque encore {(depassementPlafond - montantPayeComptant).toLocaleString('fr-FR')} F à encaisser.</p>
                          )}
                        </div>

                        <div className="flex justify-between items-center p-2 bg-gray-100 rounded text-sm">
                          <span className="font-medium text-gray-700">Reste à mettre en crédit :</span>
                          <span className={`font-bold ${montantCreditReel > plafondCredit ? 'text-red-600' : 'text-green-700'}`}>
                            {montantCreditReel.toLocaleString('fr-FR')} F
                          </span>
                        </div>
                      </div>
                    )}

                    {!estPlafondDepasse && (
                      <div>
                        <label className="block text-xs font-medium text-amber-900 mb-1">Montant du crédit (Total achat)</label>
                        <input type="text" value={`${montantPatient.toLocaleString('fr-FR')} F`} readOnly className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-amber-900 font-bold cursor-not-allowed" />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date limite de paiement (1 mois)</label>
                      <input type="date" value={dateLimiteCredit} readOnly className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-bold cursor-not-allowed" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Veuillez sélectionner un client autorisé au crédit.</span>
                  </div>
                )}
              </div>
            )}

            {/* Sélecteur de Client (Filtré) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" /> Client 
                {typeDeVente !== 'ordinaire' && <span className="text-xs text-gray-500 ml-2">(Filtré par autorisation: {typeDeVente})</span>}
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choisir un client --</option>
                {clientsFiltres.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nom_complet} {client.entreprise ? `(${client.entreprise})` : ''}
                  </option>
                ))}
              </select>
              {typeDeVente !== 'ordinaire' && clientsFiltres.length === 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3"/> Aucun client autorisé pour ce type de vente.
                </p>
              )}
            </div>

            {clientAssurance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">{clientAssurance.nom}</span>
                </div>
                <div className="text-sm text-blue-700">Taux de couverture appliqué: {tauxCouverture}%</div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ordonnancePresente} onChange={(e) => setOrdonnancePresente(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Ordonnance présentée</span>
              </label>
              <button type="button" onClick={() => setShowAssuranceForm(true)} className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                <Plus className="w-4 h-4" /> Assurance
              </button>
            </div>
          </div>

          {/* Liste du panier */}
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun produit dans le panier</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.produit.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.produit.nom}</p>
                    <p className="text-sm text-gray-600">
                      {item.produit.prix_vente.toLocaleString('fr-FR')} F x {item.quantite} = {(item.produit.prix_vente * item.quantite).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.produit.id, item.quantite - 1)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">-</button>
                    <span className="w-8 text-center font-medium">{item.quantite}</span>
                    <button onClick={() => updateQuantity(item.produit.id, item.quantite + 1)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">+</button>
                    <button onClick={() => removeFromCart(item.produit.id)} className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center ml-2 hover:bg-red-200">×</button>
                  </div>
                </div>
              ))}
              

<div className="border-t pt-3 space-y-2">
  <div className="flex justify-between text-sm">
    <span>Total produits:</span>
    <span>{totalAmount.toLocaleString('fr-FR')} F</span>
  </div>
  
  {tauxCouverture > 0 && (
    <>
      <div className="flex justify-between text-sm text-blue-600">
        <span>Part assurance ({tauxCouverture}%):</span>
        <span>- {montantAssurance.toLocaleString('fr-FR')} F</span>
      </div>
      <div className="flex justify-between text-lg font-bold border-t pt-2">
        <span>Total à payer:</span>
        <span>{montantPatient.toLocaleString('fr-FR')} F</span>
      </div>
    </>
  )}
  
  {tauxCouverture === 0 && (
    <>
      {/* ✅ AFFICHAGE SPÉCIAL POUR CRÉDIT AVEC RELIQUAT */}
      {estPlafondDepasse && montantPayeComptant > 0 ? (
        <>
          <div className="flex justify-between text-sm text-amber-600 bg-amber-50 p-2 rounded">
            <span>Montant en crédit (plafond):</span>
            <span>{montantCreditReel.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2 text-emerald-600">
            <span>💰 À payer à la caisse (reliquat):</span>
            <span>{montantPayeComptant.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="text-xs text-gray-500 text-center">
            Le reste ({montantCreditReel.toLocaleString('fr-FR')} F) sera tracé dans le crédit client
          </div>
        </>
      ) : (
        <div className="flex justify-between text-lg font-bold">
          <span>Total à payer:</span>
          <span>{totalAmount.toLocaleString('fr-FR')} F</span>
        </div>
      )}
    </>
  )}
  
  <button 
    onClick={validerCommande} 
    disabled={loading} 
    className="w-full mt-3 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
  >
    {loading ? 'Validation...' : 'Valider et envoyer à la caisse'}
  </button>
</div>
            </div>
          )}
        </div>

        {/* Liste des produits (inchangée) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher un produit..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredProducts.map((produit) => {
              const stock = stockVerification[produit.id] || { disponible: 0, total: 0 };
              const isOutOfStock = stock.disponible <= 0;
              return (
                <div key={produit.id} className={`flex items-center justify-between p-3 border rounded-lg transition ${isOutOfStock ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{produit.nom}</p>
                      {produit.prescription_requise && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Rx</span>}
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span>Code: {produit.code_produit}</span>
                      <span>Prix: {produit.prix_vente.toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${stock.disponible === 0 ? 'text-red-600 bg-red-50' : stock.disponible <= (produit.stock_minimum || 0) ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}`}>
                      <Package className="w-3 h-3" />
                      <span>Stock: {stock.disponible}</span>
                    </div>
                  </div>
                  <button onClick={() => addToCart(produit)} disabled={isOutOfStock} className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant AssuranceForm (à garder tel quel en bas de votre fichier)
function AssuranceForm({ pharmacyId, onClose }: { pharmacyId: string; onClose: () => void }) {
  const [formData, setFormData] = useState({ nom: '', taux_couverture: '', telephone: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.taux_couverture) { alert('Le nom et le taux de couverture sont obligatoires'); return; }
    const taux = parseFloat(formData.taux_couverture);
    if (taux < 0 || taux > 100) { alert('Le taux de couverture doit être compris entre 0 et 100%'); return; }
    setLoading(true);
    try {
      await repository.createAssurance({ pharmacy_id: pharmacyId, nom: formData.nom.trim(), taux_couverture: taux, telephone: formData.telephone.trim() || null, email: formData.email.trim() || null, actif: true });
      onClose();
    } catch (error: any) { alert('Erreur: ' + error.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Nouvelle Assurance</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition"><Plus className="w-6 h-6 text-gray-600 rotate-45" /></button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'assurance *</label>
              <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Taux de couverture (%) *</label>
              <input type="number" min="0" max="100" step="0.01" value={formData.taux_couverture} onChange={(e) => setFormData({ ...formData, taux_couverture: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
              <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">{loading ? 'Création...' : 'Créer l\'assurance'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
