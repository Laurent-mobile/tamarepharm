// src/components/settings/MagasinsManager.tsx
import { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Warehouse, MapPin, Phone, User, 
  Save, X, RefreshCw, ChevronDown, ChevronUp, Package, ArrowRightLeft,
  TrendingUp, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Magasin {
  id: string;
  pharmacie_principale_id: string;
  nom: string;
  code: string;
  type: string;
  adresse: string;
  telephone: string;
  responsable: string;
  capacite_stock: number;
  actif: boolean;
  created_at: string;
}

interface StockMagasin {
  magasin_id: string;
  total_quantite: number;
  nombre_produits: number;
}

export function MagasinsManager() {
  const { utilisateur } = useAuth();
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [stockMagasins, setStockMagasins] = useState<Record<string, StockMagasin>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMagasin, setEditingMagasin] = useState<Magasin | null>(null);
  const [expandedMagasin, setExpandedMagasin] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedMagasin, setSelectedMagasin] = useState<Magasin | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    code: '',
    type: 'entrepot',
    adresse: '',
    telephone: '',
    responsable: '',
    capacite_stock: 0,
    actif: true
  });

  const [transferData, setTransferData] = useState({
    magasin_destination_id: '',
    produit_id: '',
    quantite: 1,
    lot: '',
    remarques: ''
  });

  const [produits, setProduits] = useState<any[]>([]);
  const [stockDisponible, setStockDisponible] = useState<Record<string, number>>({});

  useEffect(() => {
    if (utilisateur && utilisateur.pharmacy_id) {
      loadMagasins();
      loadProduits();
    }
  }, [utilisateur]);

  const loadMagasins = async () => {
    if (!utilisateur?.pharmacy_id) return;

    try {
      setLoading(true);
      console.log('🔄 Chargement des magasins...');

      const { data, error } = await supabase
        .from('magasins')
        .select('*')
        .eq('pharmacie_principale_id', utilisateur.pharmacy_id)
        .order('nom');

      if (error) throw error;

      console.log('✅ Magasins chargés:', data?.length || 0);
      setMagasins(data || []);
      
      // Charger les stocks pour chaque magasin
      if (data && data.length > 0) {
        await loadStockForMagasins(data.map(m => m.id));
      }
    } catch (error) {
      console.error('Erreur chargement magasins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockForMagasins = async (magasinIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('magasin_id, quantite, produit_id')
        .in('magasin_id', magasinIds)
        .eq('statut', 'actif');

      if (error) throw error;

      const stockMap: Record<string, StockMagasin> = {};
      magasinIds.forEach(id => {
        const stockMagasin = data?.filter(s => s.magasin_id === id) || [];
        stockMap[id] = {
          magasin_id: id,
          total_quantite: stockMagasin.reduce((sum, s) => sum + (s.quantite || 0), 0),
          nombre_produits: new Set(stockMagasin.map(s => s.produit_id)).size
        };
      });

      setStockMagasins(stockMap);
    } catch (error) {
      console.error('Erreur chargement stocks magasins:', error);
    }
  };

  const loadProduits = async () => {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('id, nom, code_produit')
        .order('nom');

      if (error) throw error;
      setProduits(data || []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  };

  const loadStockDisponibleMagasin = async (magasinId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('produit_id, quantite')
        .eq('magasin_id', magasinId)
        .eq('statut', 'actif');

      if (error) throw error;

      const stockMap: Record<string, number> = {};
      data?.forEach(item => {
        stockMap[item.produit_id] = (stockMap[item.produit_id] || 0) + (item.quantite || 0);
      });

      setStockDisponible(stockMap);
    } catch (error) {
      console.error('Erreur chargement stock magasin:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom.trim()) {
      alert('Le nom du magasin est obligatoire');
      return;
    }

    if (!formData.code.trim()) {
      alert('Le code du magasin est obligatoire');
      return;
    }

    setFormLoading(true);

    try {
      const magasinData = {
        pharmacie_principale_id: utilisateur!.pharmacy_id,
        nom: formData.nom.trim(),
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        adresse: formData.adresse.trim() || null,
        telephone: formData.telephone.trim() || null,
        responsable: formData.responsable.trim() || null,
        capacite_stock: formData.capacite_stock || 0,
        actif: formData.actif
      };

      if (editingMagasin) {
        const { error } = await supabase
          .from('magasins')
          .update(magasinData)
          .eq('id', editingMagasin.id);

        if (error) throw error;
        alert('✅ Magasin modifié avec succès !');
      } else {
        const { error } = await supabase
          .from('magasins')
          .insert(magasinData);

        if (error) throw error;
        alert('✅ Magasin créé avec succès !');
      }

      resetForm();
      await loadMagasins();

    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      
      if (error.code === '23505') {
        alert('❌ Ce code de magasin existe déjà');
      } else {
        alert('❌ Erreur: ' + error.message);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      code: '',
      type: 'entrepot',
      adresse: '',
      telephone: '',
      responsable: '',
      capacite_stock: 0,
      actif: true
    });
    setShowForm(false);
    setEditingMagasin(null);
  };

  const handleTransfert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMagasin) return;
    
    if (!transferData.magasin_destination_id) {
      alert('Veuillez sélectionner le magasin de destination');
      return;
    }

    if (!transferData.produit_id) {
      alert('Veuillez sélectionner un produit');
      return;
    }

    const stockDispo = stockDisponible[transferData.produit_id] || 0;
    if (transferData.quantite > stockDispo) {
      alert(`Stock insuffisant dans le magasin source. Disponible: ${stockDispo}`);
      return;
    }

    setTransferLoading(true);

    try {
      const numeroTransfert = `TRF${Date.now()}`;
      
      // Créer le transfert
      const { data: transfert, error: transfertError } = await supabase
        .from('transferts')
        .insert({
          magasin_source_id: selectedMagasin.id,
          magasin_destination_id: transferData.magasin_destination_id,
          pharmacie_source_id: utilisateur!.pharmacy_id,
          pharmacie_destination_id: utilisateur!.pharmacy_id,
          numero_transfert: numeroTransfert,
          date_transfert: new Date().toISOString().split('T')[0],
          statut: 'en_attente',
          remarques: transferData.remarques || `Transfert depuis ${selectedMagasin.nom}`,
          expedie_par: utilisateur!.id,
        })
        .select()
        .single();

      if (transfertError) throw transfertError;

      // Créer la ligne de transfert
      const { error: ligneError } = await supabase
        .from('transfert_lignes')
        .insert({
          transfert_id: transfert.id,
          produit_id: transferData.produit_id,
          quantite: transferData.quantite,
          lot: transferData.lot || null
        });

      if (ligneError) throw ligneError;

      // Mettre à jour le stock (réserver)
      await reserverStockMagasin(selectedMagasin.id, transferData.produit_id, transferData.quantite);

      alert(`✅ Transfert ${numeroTransfert} créé avec succès !\n\nLe stock sera déduit du magasin source et ajouté au magasin de destination après confirmation.`);
      
      setShowTransferForm(false);
      setSelectedMagasin(null);
      setTransferData({
        magasin_destination_id: '',
        produit_id: '',
        quantite: 1,
        lot: '',
        remarques: ''
      });
      
      await loadMagasins();

    } catch (error: any) {
      console.error('Erreur transfert:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const reserverStockMagasin = async (magasinId: string, produitId: string, quantite: number) => {
    try {
      const { data: stock, error } = await supabase
        .from('stock')
        .select('id, quantite, quantite_reservee')
        .eq('magasin_id', magasinId)
        .eq('produit_id', produitId)
        .eq('statut', 'actif')
        .limit(1);

      if (error) throw error;

      if (stock && stock.length > 0) {
        const item = stock[0];
        const nouvelleReservee = (item.quantite_reservee || 0) + quantite;
        
        await supabase
          .from('stock')
          .update({ quantite_reservee: nouvelleReservee })
          .eq('id', item.id);
      }
    } catch (error) {
      console.error('Erreur réservation stock:', error);
    }
  };

  const startTransfert = async (magasin: Magasin) => {
    setSelectedMagasin(magasin);
    await loadStockDisponibleMagasin(magasin.id);
    setShowTransferForm(true);
  };

  const toggleActif = async (magasin: Magasin) => {
    try {
      const { error } = await supabase
        .from('magasins')
        .update({ actif: !magasin.actif })
        .eq('id', magasin.id);

      if (error) throw error;
      
      await loadMagasins();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const deleteMagasin = async (magasin: Magasin) => {
    const stockInfo = stockMagasins[magasin.id];
    if (stockInfo && stockInfo.total_quantite > 0) {
      alert(`❌ Impossible de supprimer ce magasin car il contient encore ${stockInfo.total_quantite} produits en stock.`);
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le magasin "${magasin.nom}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('magasins')
        .delete()
        .eq('id', magasin.id);

      if (error) throw error;
      
      await loadMagasins();
      alert('✅ Magasin supprimé avec succès');
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const startEdit = (magasin: Magasin) => {
    setEditingMagasin(magasin);
    setFormData({
      nom: magasin.nom,
      code: magasin.code,
      type: magasin.type,
      adresse: magasin.adresse || '',
      telephone: magasin.telephone || '',
      responsable: magasin.responsable || '',
      capacite_stock: magasin.capacite_stock || 0,
      actif: magasin.actif
    });
    setShowForm(true);
  };

  const filteredMagasins = magasins.filter((m) =>
    m.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.responsable?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formulaire de transfert
  if (showTransferForm && selectedMagasin) {
    const produitsDisponibles = produits.filter(p => (stockDisponible[p.id] || 0) > 0);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Transfert depuis {selectedMagasin.nom}
              </h2>
              <button
                onClick={() => {
                  setShowTransferForm(false);
                  setSelectedMagasin(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleTransfert} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magasin de destination *
                </label>
                <select
                  value={transferData.magasin_destination_id}
                  onChange={(e) => setTransferData(prev => ({ ...prev, magasin_destination_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Sélectionner un magasin</option>
                  {magasins
                    .filter(m => m.id !== selectedMagasin.id && m.actif)
                    .map((magasin) => (
                      <option key={magasin.id} value={magasin.id}>
                        {magasin.nom} ({magasin.code})
                      </option>
                    ))}
                  <option value="principale">Pharmacie Principale (Magasin de vente)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Produit *
                </label>
                <select
                  value={transferData.produit_id}
                  onChange={(e) => {
                    const produitId = e.target.value;
                    const stock = stockDisponible[produitId] || 0;
                    setTransferData(prev => ({ 
                      ...prev, 
                      produit_id: produitId,
                      quantite: Math.min(prev.quantite, stock)
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {produitsDisponibles.map((produit) => (
                    <option key={produit.id} value={produit.id}>
                      {produit.nom} - Stock: {stockDisponible[produit.id] || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={stockDisponible[transferData.produit_id] || 0}
                    value={transferData.quantite}
                    onChange={(e) => setTransferData(prev => ({ ...prev, quantite: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Stock disponible: {stockDisponible[transferData.produit_id] || 0}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de lot
                  </label>
                  <input
                    type="text"
                    value={transferData.lot}
                    onChange={(e) => setTransferData(prev => ({ ...prev, lot: e.target.value }))}
                    placeholder="Optionnel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarques
                </label>
                <textarea
                  value={transferData.remarques}
                  onChange={(e) => setTransferData(prev => ({ ...prev, remarques: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Motif du transfert..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferForm(false);
                    setSelectedMagasin(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {transferLoading ? 'Transfert...' : 'Transférer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Formulaire de création/modification
  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {editingMagasin ? 'Modifier le Magasin' : 'Nouveau Magasin'}
            </h2>
            <p className="text-gray-600 mt-1">
              {editingMagasin 
                ? 'Modifier les informations du magasin' 
                : 'Ajouter un nouvel entrepôt ou magasin de stockage'}
            </p>
          </div>
          <button
            onClick={resetForm}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <X className="w-5 h-5" />
            Annuler
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du magasin *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  required
                  placeholder="Ex: Entrepôt Nord"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  required
                  placeholder="Ex: ENT-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">Code unique pour identifier ce magasin</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de magasin
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="entrepot">Entrepôt</option>
                  <option value="depot">Dépôt</option>
                  <option value="stockage">Zone de stockage</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacité de stock (unités)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.capacite_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacite_stock: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Responsable
                </label>
                <input
                  type="text"
                  value={formData.responsable}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
                  placeholder="Nom du responsable"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  placeholder="+226 XX XX XX XX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Adresse
                </label>
                <textarea
                  value={formData.adresse}
                  onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))}
                  rows={2}
                  placeholder="Adresse complète du magasin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.actif}
                    onChange={(e) => setFormData(prev => ({ ...prev, actif: e.target.checked }))}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Magasin actif</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {formLoading ? 'Enregistrement...' : (editingMagasin ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Vue principale
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Magasins</h2>
          <p className="text-gray-600 mt-1">
            Entrepôts et magasins de stockage pour l'approvisionnement de la pharmacie principale
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => loadMagasins()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => {
              setEditingMagasin(null);
              setFormData({
                nom: '',
                code: '',
                type: 'entrepot',
                adresse: '',
                telephone: '',
                responsable: '',
                capacite_stock: 0,
                actif: true
              });
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nouveau Magasin
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, code ou responsable..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredMagasins.length === 0 ? (
          <div className="text-center py-12">
            <Warehouse className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun magasin trouvé</p>
            <p className="text-gray-400 text-sm mb-4">
              {searchTerm ? 'Aucun résultat pour votre recherche' : 'Commencez par créer votre premier magasin'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                Créer un magasin
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMagasins.map((magasin) => {
              const stock = stockMagasins[magasin.id] || { total_quantite: 0, nombre_produits: 0 };
              const utilisation = magasin.capacite_stock > 0 
                ? (stock.total_quantite / magasin.capacite_stock) * 100 
                : 0;
              
              return (
                <div key={magasin.id} className="border border-gray-200 rounded-lg hover:shadow-md transition">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setExpandedMagasin(expandedMagasin === magasin.id ? null : magasin.id)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition"
                        >
                          {expandedMagasin === magasin.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-5 h-5 text-emerald-600" />
                            <p className="font-bold text-lg">{magasin.nom}</p>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-mono">
                              {magasin.code}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              magasin.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {magasin.actif ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <div className="flex gap-4 mt-1 text-sm text-gray-600">
                            <span>📦 {stock.total_quantite} unités</span>
                            <span>📋 {stock.nombre_produits} produits</span>
                            {magasin.responsable && <span>👤 {magasin.responsable}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startTransfert(magasin)}
                          disabled={!magasin.actif || stock.total_quantite === 0}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Transférer du stock vers la pharmacie principale ou un autre magasin"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Transférer
                        </button>
                        <button
                          onClick={() => startEdit(magasin)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                        >
                          <Edit2 className="w-4 h-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => toggleActif(magasin)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg transition text-sm ${
                            magasin.actif
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {magasin.actif ? 'Désactiver' : 'Activer'}
                        </button>
                        <button
                          onClick={() => deleteMagasin(magasin)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Barre d'utilisation du stock */}
                    {magasin.capacite_stock > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Utilisation du stock</span>
                          <span>{utilisation.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              utilisation > 90 ? 'bg-red-500' : utilisation > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(utilisation, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {expandedMagasin === magasin.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {magasin.adresse && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Adresse</p>
                            <p className="text-sm text-gray-600">{magasin.adresse}</p>
                          </div>
                        )}
                        {magasin.telephone && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Téléphone</p>
                            <p className="text-sm text-gray-600">{magasin.telephone}</p>
                          </div>
                        )}
                        {magasin.capacite_stock > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Capacité maximale</p>
                            <p className="text-sm text-gray-600">{magasin.capacite_stock} unités</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-700">Date création</p>
                          <p className="text-sm text-gray-600">
                            {new Date(magasin.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      
                      {/* Alertes de stock */}
                      {utilisation > 90 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <p className="text-sm text-red-700">
                            ⚠️ Capacité de stock presque atteinte ! {stock.total_quantite}/{magasin.capacite_stock} unités
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📦 À propos des magasins</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Les magasins sont des entrepôts de stockage qui alimentent la pharmacie principale</li>
          <li>• Utilisez les transferts pour déplacer du stock d'un magasin vers la pharmacie principale</li>
          <li>• Les ventes se font uniquement depuis la pharmacie principale (magasin de vente)</li>
          <li>• Un magasin ne peut pas être supprimé s'il contient encore du stock</li>
        </ul>
      </div>
    </div>
  );
}
