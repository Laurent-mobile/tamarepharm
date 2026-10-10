// src/components/transfers/TransfersManager.tsx
import { useState, useEffect } from 'react';
import { 
  Search, Plus, X, ArrowLeftRight, Package, RefreshCw, Truck,
  CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Send,
  List, ClipboardList, Warehouse, Building2, Calendar, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';

interface Transfert {
  id: string;
  magasin_source_id: string | null;
  magasin_destination_id: string | null;
  pharmacy_source_id: string;
  pharmacy_destination_id: string;
  numero_transfert: string;
  date_transfert: string;
  statut: 'en_attente' | 'en_transit' | 'recu' | 'annule';
  remarques?: string;
  expedie_par: string;
  recu_par?: string;
  created_at: string;
}

interface TransfertLigne {
  id: string;
  transfert_id: string;
  produit_id: string;
  quantite: number;
  lot?: string;
  created_at: string;
  produits?: {
    id: string;
    nom: string;
    code_produit: string;
    prix_vente: number;
  };
}

interface Magasin {
  id: string;
  nom: string;
  code: string;
  type: string;
  actif: boolean;
}

interface Produit {
  id: string;
  nom: string;
  code_produit: string;
  prix_vente: number;
}

export function TransfersManager() {
  const { utilisateur } = useAuth();
  const [activeTab, setActiveTab] = useState<'transferts' | 'receptions' | 'nouveau'>('transferts');
  const [transfers, setTransfers] = useState<Transfert[]>([]);
  const [transfertLignes, setTransfertLignes] = useState<Record<string, TransfertLigne[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // États pour le formulaire de création
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stockDisponible, setStockDisponible] = useState<Record<string, { disponible: number; stockId: string; lot: string }>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [typeTransfert, setTypeTransfert] = useState<'magasin_to_pharmacie' | 'pharmacie_to_magasin' | 'magasin_to_magasin'>('magasin_to_pharmacie');
  const [expandedTransfert, setExpandedTransfert] = useState<string | null>(null);
  const [selectedTransfert, setSelectedTransfert] = useState<Transfert | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [formData, setFormData] = useState({
    magasin_source_id: '',
    magasin_destination_id: '',
    remarques: '',
    lignes: [] as Array<{ produit_id: string; quantite: number; lot: string }>
  });

  useEffect(() => {
    if (utilisateur) {
      loadInitialData();
    }
  }, [utilisateur]);

  const loadInitialData = async () => {
    await Promise.all([
      loadTransfers(),
      loadMagasins(),
      loadProduits(),
      loadStockDisponible()
    ]);
  };

  const loadTransfers = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      setLoading(true);
      const transfersData = await repository.getTransferts(utilisateur.pharmacy_id);
      setTransfers(transfersData || []);

      if (transfersData && transfersData.length > 0) {
        const lignesParTransfert: Record<string, TransfertLigne[]> = {};
        for (const transfert of transfersData) {
          const lignes = await repository.getTransfertLignes(transfert.id);
          const produitsList = await repository.getProduits(utilisateur.pharmacy_id);
          
          lignesParTransfert[transfert.id] = lignes.map(ligne => ({
            ...ligne,
            produits: produitsList.find(p => p.id === ligne.produit_id)
          }));
        }
        setTransfertLignes(lignesParTransfert);
      }
    } catch (error) {
      console.error('❌ Erreur chargement transferts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMagasins = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      const magasinsData = await repository.getMagasins(utilisateur.pharmacy_id);
      setMagasins(magasinsData || []);
    } catch (error) {
      console.error('❌ Erreur chargement magasins:', error);
    }
  };

  const loadProduits = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      const produitsData = await repository.getProduits(utilisateur.pharmacy_id);
      setProduits(produitsData || []);
    } catch (error) {
      console.error('❌ Erreur chargement produits:', error);
    }
  };

  const loadStockDisponible = async () => {
    if (!utilisateur?.pharmacy_id) return;
    try {
      const stockData = await repository.getStock(utilisateur.pharmacy_id);
      const stockMap: Record<string, { disponible: number; stockId: string; lot: string }> = {};
      
      stockData?.forEach(item => {
        const key = item.magasin_id ? `${item.magasin_id}_${item.produit_id}` : `pharmacie_${item.produit_id}`;
        const disponible = item.quantite || 0;
        
        if (!stockMap[key] || stockMap[key].disponible < disponible) {
          stockMap[key] = { 
            disponible, 
            stockId: item.id, 
            lot: item.lot_numero || '' 
          };
        }
      });
      setStockDisponible(stockMap);
    } catch (error) {
      console.error('❌ Erreur chargement stock:', error);
    }
  };

  const getMagasinNom = (id: string | null) => {
    if (!id) return 'Pharmacie Principale';
    const magasin = magasins.find(m => m.id === id);
    return magasin?.nom || 'Magasin inconnu';
  };

  const getStockDisponibleProduit = (magasinId: string | null, produitId: string) => {
    const key = magasinId ? `${magasinId}_${produitId}` : `pharmacie_${produitId}`;
    return stockDisponible[key]?.disponible || 0;
  };

  const ajouterLigne = () => {
    setFormData(prev => ({
      ...prev,
      lignes: [...prev.lignes, { produit_id: '', quantite: 1, lot: '' }]
    }));
  };

  const supprimerLigne = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index)
    }));
  };

  const mettreAJourLigne = (index: number, champ: string, valeur: any) => {
    const nouvellesLignes = [...formData.lignes];
    nouvellesLignes[index] = { ...nouvellesLignes[index], [champ]: valeur };
    
    if (champ === 'produit_id' || champ === 'quantite') {
      const produitId = nouvellesLignes[index].produit_id;
      const quantite = nouvellesLignes[index].quantite;
      const sourceId = typeTransfert === 'pharmacie_to_magasin' ? null : formData.magasin_source_id;
      const stock = getStockDisponibleProduit(sourceId, produitId);
      
      if (produitId && stock === 0) {
        alert(`⚠️ Stock insuffisant ! Ce produit n'est pas disponible dans la source sélectionnée.`);
        nouvellesLignes[index].quantite = 0;
      } else if (quantite > stock) {
        alert(`⚠️ Stock insuffisant ! Disponible: ${stock}`);
        nouvellesLignes[index].quantite = stock;
      } else if (quantite < 1) {
        nouvellesLignes[index].quantite = 1;
      }
    }
    setFormData(prev => ({ ...prev, lignes: nouvellesLignes }));
  };

  const creerTransfert = async () => {
    if (!utilisateur) return;

    if (typeTransfert === 'magasin_to_pharmacie' && !formData.magasin_source_id) {
      alert('Veuillez sélectionner un magasin source');
      return;
    }
    if (typeTransfert === 'pharmacie_to_magasin' && !formData.magasin_destination_id) {
      alert('Veuillez sélectionner un magasin de destination');
      return;
    }
    if (typeTransfert === 'magasin_to_magasin') {
      if (!formData.magasin_source_id || !formData.magasin_destination_id) {
        alert('Veuillez sélectionner les magasins source et destination');
        return;
      }
      if (formData.magasin_source_id === formData.magasin_destination_id) {
        alert('Les magasins source et destination doivent être différents');
        return;
      }
    }

    if (formData.lignes.length === 0) {
      alert('Veuillez ajouter au moins un produit');
      return;
    }

    for (const ligne of formData.lignes) {
      const sourceId = typeTransfert === 'pharmacie_to_magasin' ? null : formData.magasin_source_id;
      const stock = getStockDisponibleProduit(sourceId, ligne.produit_id);
      if (ligne.quantite > stock || ligne.quantite <= 0) {
        const produit = produits.find(p => p.id === ligne.produit_id);
        alert(`Stock invalide pour ${produit?.nom}. Disponible: ${stock}`);
        return;
      }
    }

    setFormLoading(true);
    try {
      const numeroTransfert = `TRF${Date.now().toString().slice(-6)}`;
      let sourceId = null, destId = null;
      
      if (typeTransfert === 'magasin_to_pharmacie') {
        sourceId = formData.magasin_source_id;
      } else if (typeTransfert === 'pharmacie_to_magasin') {
        destId = formData.magasin_destination_id;
      } else {
        sourceId = formData.magasin_source_id;
        destId = formData.magasin_destination_id;
      }
      
      const transfertData = {
        pharmacy_id: utilisateur.pharmacy_id,
        magasin_source_id: sourceId,
        magasin_destination_id: destId,
        pharmacy_source_id: utilisateur.pharmacy_id,
        pharmacy_destination_id: utilisateur.pharmacy_id,
        numero_transfert: numeroTransfert,
        date_transfert: new Date().toISOString().split('T')[0],
        statut: 'en_attente',
        remarques: formData.remarques || null,
        expedie_par: utilisateur.id,
      };

      const transfert = await repository.createTransfert(transfertData);
      const lignesTransfert = formData.lignes.map(ligne => ({
        transfert_id: transfert.id,
        produit_id: ligne.produit_id,
        quantite: ligne.quantite,
        lot: ligne.lot || null,
      }));

      await repository.createTransfertLignes(lignesTransfert);

      alert(`✅ Transfert ${numeroTransfert} créé avec succès !`);
      
      setFormData({ magasin_source_id: '', magasin_destination_id: '', remarques: '', lignes: [] });
      setActiveTab('transferts');
      await loadTransfers();
      await loadStockDisponible();

    } catch (error: any) {
      console.error('❌ Erreur création transfert:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const confirmerExpedition = async (transfert: Transfert) => {
    if (!confirm(`Confirmez-vous l'expédition du transfert ${transfert.numero_transfert} ?\n\nLes produits seront déduits du stock source.`)) {
      return;
    }

    setFormLoading(true);
    try {
      const lignes = await repository.getTransfertLignes(transfert.id);
      
      // Déduire le stock de la source
      for (const ligne of lignes) {
        await repository.decrementerStock(
          utilisateur!.pharmacy_id,
          ligne.produit_id,
          ligne.quantite,
          ligne.lot || ''
        );
      }
      
      await repository.updateTransfert(transfert.id, { statut: 'en_transit' });
      
      alert(`✅ Transfert ${transfert.numero_transfert} expédié avec succès !\n\n${lignes.length} produit(s) déduits du stock.`);
      await loadTransfers();
      await loadStockDisponible();
    } catch (error: any) {
      console.error('❌ Erreur expédition:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const recevoirTransfert = async (transfert: Transfert) => {
    if (!confirm(`Confirmez-vous la réception du transfert ${transfert.numero_transfert} ?\n\nLes produits seront ajoutés au stock destination.`)) {
      return;
    }

    setFormLoading(true);
    try {
      const lignes = await repository.getTransfertLignes(transfert.id);
      
      // Ajouter le stock à la destination
      for (const ligne of lignes) {
        await repository.ajouterStock(
          utilisateur!.pharmacy_id,
          ligne.produit_id,
          ligne.quantite,
          ligne.lot || '',
          transfert.magasin_destination_id
        );
      }
      
      await repository.updateTransfert(transfert.id, { 
        statut: 'recu', 
        recu_par: utilisateur.id 
      });
      
      alert(`✅ Transfert ${transfert.numero_transfert} réceptionné avec succès !\n\n${lignes.length} produit(s) ajoutés au stock.`);
      await loadTransfers();
      await loadStockDisponible();
    } catch (error: any) {
      console.error('❌ Erreur réception:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const annulerTransfert = async (transfert: Transfert) => {
    if (!confirm(`Annuler le transfert ${transfert.numero_transfert} ?\n\nCette action est irréversible.`)) {
      return;
    }

    setFormLoading(true);
    try {
      await repository.updateTransfert(transfert.id, { statut: 'annule' });
      alert(`✅ Transfert annulé.`);
      await loadTransfers();
    } catch (error: any) {
      console.error('❌ Erreur annulation:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'recu': return 'bg-green-100 text-green-700';
      case 'en_transit': return 'bg-blue-100 text-blue-700';
      case 'en_attente': return 'bg-amber-100 text-amber-700';
      case 'annule': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'recu': return 'Reçu';
      case 'en_transit': return 'En transit';
      case 'en_attente': return 'En attente';
      case 'annule': return 'Annulé';
      default: return statut;
    }
  };

  const filteredTransfers = transfers.filter((t) =>
    t.numero_transfert.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getMagasinNom(t.magasin_source_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getMagasinNom(t.magasin_destination_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const transfersEnAttenteDeReception = transfers.filter(t => 
    t.statut === 'en_transit' && 
    ((t.magasin_destination_id && t.pharmacy_destination_id === utilisateur?.pharmacy_id) ||
     (!t.magasin_destination_id && t.pharmacy_destination_id === utilisateur?.pharmacy_id))
  );

  // Vue des détails
  if (showDetails && selectedTransfert) {
    const lignes = transfertLignes[selectedTransfert.id] || [];
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Détails du transfert</h2>
            <p className="text-gray-600 mt-1 font-mono">{selectedTransfert.numero_transfert}</p>
          </div>
          <button onClick={() => { setShowDetails(false); setSelectedTransfert(null); }} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
            Retour
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Date:</span>
                <span className="font-medium">{new Date(selectedTransfert.date_transfert).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedTransfert.statut)}`}>
                {getStatusLabel(selectedTransfert.statut)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {selectedTransfert.magasin_source_id ? <Warehouse className="w-8 h-8 text-blue-600" /> : <Building2 className="w-8 h-8 text-emerald-600" />}
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-bold">{getMagasinNom(selectedTransfert.magasin_source_id)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedTransfert.magasin_destination_id ? <Warehouse className="w-8 h-8 text-blue-600" /> : <Building2 className="w-8 h-8 text-emerald-600" />}
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-bold">{getMagasinNom(selectedTransfert.magasin_destination_id)}</p>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-4">Produits transférés</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Produit</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Lot</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Quantité</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">Aucun produit trouvé</td>
                  </tr>
                ) : (
                  lignes.map((ligne) => (
                    <tr key={ligne.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium">{ligne.produits?.nom || 'Produit inconnu'}</td>
                      <td className="py-3 px-4 font-mono text-sm">{ligne.produits?.code_produit || 'N/A'}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{ligne.lot || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold">{ligne.quantite}</td>
                      <td className="py-3 px-4 text-right font-bold">{(ligne.quantite * (ligne.produits?.prix_vente || 0)).toLocaleString('fr-FR')} F</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedTransfert.remarques && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Remarques</h4>
              <p className="text-blue-700">{selectedTransfert.remarques}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue du formulaire de création
  if (activeTab === 'nouveau') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Nouveau Transfert</h2>
            <p className="text-gray-600 mt-1">Transférer des stocks entre magasins et pharmacie principale</p>
          </div>
          <button onClick={() => setActiveTab('transferts')} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
            <X className="w-5 h-5" /> Annuler
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de transfert *</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button onClick={() => { setTypeTransfert('magasin_to_pharmacie'); setFormData(prev => ({ ...prev, magasin_source_id: '', magasin_destination_id: '', lignes: [] })); }} className={`px-4 py-2 rounded-lg font-medium transition ${typeTransfert === 'magasin_to_pharmacie' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Package className="w-4 h-4 inline mr-2" /> Magasin → Pharmacie
              </button>
              <button onClick={() => { setTypeTransfert('pharmacie_to_magasin'); setFormData(prev => ({ ...prev, magasin_source_id: '', magasin_destination_id: '', lignes: [] })); }} className={`px-4 py-2 rounded-lg font-medium transition ${typeTransfert === 'pharmacie_to_magasin' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <ArrowLeftRight className="w-4 h-4 inline mr-2" /> Pharmacie → Magasin
              </button>
              <button onClick={() => { setTypeTransfert('magasin_to_magasin'); setFormData(prev => ({ ...prev, magasin_source_id: '', magasin_destination_id: '', lignes: [] })); }} className={`px-4 py-2 rounded-lg font-medium transition ${typeTransfert === 'magasin_to_magasin' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Truck className="w-4 h-4 inline mr-2" /> Magasin → Magasin
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {(typeTransfert === 'magasin_to_pharmacie' || typeTransfert === 'magasin_to_magasin') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Magasin source *</label>
                <select value={formData.magasin_source_id} onChange={(e) => setFormData(prev => ({ ...prev, magasin_source_id: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="">Sélectionner un magasin</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>)}
                </select>
              </div>
            )}
            {(typeTransfert === 'pharmacie_to_magasin' || typeTransfert === 'magasin_to_magasin') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Magasin destination *</label>
                <select value={formData.magasin_destination_id} onChange={(e) => setFormData(prev => ({ ...prev, magasin_destination_id: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="">Sélectionner un magasin</option>
                  {magasins.filter(m => m.id !== formData.magasin_source_id).map(m => <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>)}
                </select>
              </div>
            )}
            {typeTransfert === 'magasin_to_pharmacie' && (
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Destination</label><input type="text" value="Pharmacie Principale" disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" /></div>
            )}
            {typeTransfert === 'pharmacie_to_magasin' && (
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Source</label><input type="text" value="Pharmacie Principale" disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" /></div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarques</label>
            <textarea value={formData.remarques} onChange={(e) => setFormData(prev => ({ ...prev, remarques: e.target.value }))} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Informations supplémentaires..." />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Produits à transférer</h3>
              <button onClick={ajouterLigne} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"><Plus className="w-4 h-4" /> Ajouter un produit</button>
            </div>
            
            {formData.lignes.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg"><Package className="w-12 h-12 text-gray-400 mx-auto mb-2" /><p className="text-gray-500">Aucun produit ajouté</p></div>
            ) : (
              <div className="space-y-4">
                {formData.lignes.map((ligne, index) => {
                  const produit = produits.find(p => p.id === ligne.produit_id);
                  const sourceId = typeTransfert === 'pharmacie_to_magasin' ? null : formData.magasin_source_id;
                  const stock = getStockDisponibleProduit(sourceId, ligne.produit_id);
                  
                  return (
                    <div key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Produit *</label>
                          <select value={ligne.produit_id} onChange={(e) => mettreAJourLigne(index, 'produit_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                            <option value="">Sélectionner</option>
                            {produits.map(p => <option key={p.id} value={p.id}>{p.nom} - {p.code_produit}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantité *
                            {produit && <span className={`ml-2 text-xs ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>(Stock: {stock})</span>}
                          </label>
                          <input 
                            type="number" 
                            min="1" 
                            max={stock} 
                            value={ligne.quantite} 
                            onChange={(e) => mettreAJourLigne(index, 'quantite', parseInt(e.target.value) || 0)} 
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${stock === 0 ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-300'}`}
                            disabled={stock === 0}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot</label>
                          <input type="text" value={ligne.lot || ''} onChange={(e) => mettreAJourLigne(index, 'lot', e.target.value)} placeholder="Optionnel" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Valeur</label>
                          <p className="text-lg font-bold text-emerald-600 mt-2">{produit ? (ligne.quantite * produit.prix_vente).toLocaleString('fr-FR') : 0} F</p>
                        </div>
                      </div>
                      <button onClick={() => supprimerLigne(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><X className="w-5 h-5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {formData.lignes.length > 0 && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg mb-6">
              <span className="text-lg font-bold">Valeur totale du transfert:</span>
              <span className="text-2xl font-bold text-emerald-600">{formData.lignes.reduce((total, ligne) => { const p = produits.find(p => p.id === ligne.produit_id); return total + (p ? ligne.quantite * p.prix_vente : 0); }, 0).toLocaleString('fr-FR')} F</span>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => setActiveTab('transferts')} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
            <button onClick={creerTransfert} disabled={formLoading || formData.lignes.length === 0 || (typeTransfert !== 'pharmacie_to_magasin' && !formData.magasin_source_id) || (typeTransfert !== 'magasin_to_pharmacie' && !formData.magasin_destination_id)} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              {formLoading ? 'Création...' : 'Créer le transfert'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vue principale avec onglets
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Transferts</h2>
          <p className="text-gray-600 mt-1">Transferts de stocks entre magasins et pharmacie principale</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadInitialData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button onClick={() => setActiveTab('nouveau')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
            <Plus className="w-5 h-5" /> Nouveau Transfert
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transferts')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transferts'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List className="w-4 h-4" />
            Tous les transferts
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {transfers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('receptions')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm relative ${
              activeTab === 'receptions'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            À réceptionner
            {transfersEnAttenteDeReception.length > 0 && (
              <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                {transfersEnAttenteDeReception.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeTab === 'transferts' ? (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Rechercher par numéro, magasin..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">Aucun transfert trouvé</p>
                {!searchTerm && (
                  <button onClick={() => setActiveTab('nouveau')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
                    Créer votre premier transfert
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransfers.map((transfert) => {
                  const lignes = transfertLignes[transfert.id] || [];
                  const totalQuantite = lignes.reduce((sum, l) => sum + l.quantite, 0);
                  
                  return (
                    <div key={transfert.id} className="border border-gray-200 rounded-lg hover:shadow-md transition">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => setExpandedTransfert(expandedTransfert === transfert.id ? null : transfert.id)} 
                              className="p-1 hover:bg-gray-100 rounded-lg transition"
                            >
                              {expandedTransfert === transfert.id ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-lg">{transfert.numero_transfert}</p>
                              <p className="text-sm text-gray-600">{new Date(transfert.date_transfert).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {getMagasinNom(transfert.magasin_source_id)} → {getMagasinNom(transfert.magasin_destination_id)}
                              </p>
                              <p className="text-xs text-gray-500">{totalQuantite} unités</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transfert.statut)}`}>
                              {getStatusLabel(transfert.statut)}
                            </span>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => { setSelectedTransfert(transfert); setShowDetails(true); }} 
                                className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                              >
                                <Eye className="w-4 h-4" /> Détails
                              </button>
                              {transfert.statut === 'en_attente' && (
                                <button 
                                  onClick={() => confirmerExpedition(transfert)} 
                                  disabled={formLoading}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                                >
                                  <Truck className="w-4 h-4" /> Expédier
                                </button>
                              )}
                              {transfert.statut === 'en_transit' && (
                                <button 
                                  onClick={() => recevoirTransfert(transfert)} 
                                  disabled={formLoading}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-green-600 hover:bg-green-50 rounded-lg transition text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" /> Réceptionner
                                </button>
                              )}
                              {(transfert.statut === 'en_attente' || transfert.statut === 'en_transit') && (
                                <button 
                                  onClick={() => annulerTransfert(transfert)} 
                                  disabled={formLoading}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition text-sm"
                                >
                                  <XCircle className="w-4 h-4" /> Annuler
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {expandedTransfert === transfert.id && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                          <h4 className="font-semibold text-gray-900 mb-3">Produits transférés:</h4>
                          <div className="space-y-2">
                            {lignes.length === 0 ? (
                              <p className="text-gray-500 text-center py-4">Chargement des produits...</p>
                            ) : (
                              lignes.map((ligne) => (
                                <div key={ligne.id} className="flex justify-between items-center p-2 bg-white rounded border">
                                  <div className="flex-1">
                                    <p className="font-medium">{ligne.produits?.nom || 'Produit inconnu'}</p>
                                    <p className="text-sm text-gray-600">Code: {ligne.produits?.code_produit || 'N/A'} | Lot: {ligne.lot || 'Non spécifié'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold">{ligne.quantite} unités</p>
                                    <p className="text-sm text-gray-600">{(ligne.quantite * (ligne.produits?.prix_vente || 0)).toLocaleString('fr-FR')} F</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          {transfert.remarques && (
                            <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                              <strong>Remarques:</strong> {transfert.remarques}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Transferts en attente de réception</p>
                  <p className="text-sm text-green-700">Ces transferts ont été expédiés et sont prêts à être réceptionnés.</p>
                </div>
              </div>
            </div>

            {transfersEnAttenteDeReception.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">Aucun transfert à réceptionner</p>
                <p className="text-gray-400 text-sm">Les transferts expédiés apparaîtront ici.</p>
              </div>
            ) : (
              transfersEnAttenteDeReception.map((transfert) => {
                const lignes = transfertLignes[transfert.id] || [];
                const totalQuantite = lignes.reduce((sum, l) => sum + l.quantite, 0);
                
                return (
                  <div key={transfert.id} className="border-2 border-blue-200 rounded-lg hover:shadow-md transition bg-blue-50">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Truck className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-mono font-bold text-lg">{transfert.numero_transfert}</p>
                            <p className="text-sm text-gray-600">
                              Expédié le: {new Date(transfert.date_transfert).toLocaleDateString('fr-FR')}
                            </p>
                            <p className="text-sm text-gray-600">
                              De: {getMagasinNom(transfert.magasin_source_id)} → Vers: {getMagasinNom(transfert.magasin_destination_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg">{totalQuantite} unités</p>
                            <p className="text-sm text-gray-600">{lignes.length} produit(s)</p>
                          </div>
                          <button
                            onClick={() => recevoirTransfert(transfert)}
                            disabled={formLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {formLoading ? 'Traitement...' : 'Réceptionner'}
                          </button>
                          <button
                            onClick={() => { setSelectedTransfert(transfert); setShowDetails(true); }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                          >
                            <Eye className="w-4 h-4" /> Détails
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
