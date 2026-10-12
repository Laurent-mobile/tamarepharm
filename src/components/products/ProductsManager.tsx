import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalProduit } from '../../lib/localDb';

export function ProductsManager() {
  const { utilisateur } = useAuth();
  const [products, setProducts] = useState<LocalProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LocalProduit | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (utilisateur?.pharmacy_id) loadProducts();
  }, [utilisateur]);

  const loadProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true); else setRefreshing(true);
      setError(null);
      const productsData = await repository.getProduits(utilisateur.pharmacy_id);
      setProducts(productsData);
    } catch (error: any) {
      setError('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const handleDelete = async (product: LocalProduit) => {
    if (!confirm(`Supprimer "${product.nom}" ?`)) return;
    try {
      await repository.deleteProduit(product.id);
      await loadProducts(false);
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const filteredProducts = products.filter((p) => {
    const searchLower = searchTerm.toLowerCase();
    return (p.nom || '').toLowerCase().includes(searchLower) || 
           (p.dci || '').toLowerCase().includes(searchLower) || 
           (p.code_produit || '').toLowerCase().includes(searchLower);
  });

  if (showForm) {
    return (
      <ProductForm
        product={selectedProduct}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => { setShowForm(false); setSelectedProduct(null); loadProducts(false); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Produits</h2>
          <p className="text-gray-600 mt-1">{products.length} produit(s) • {filteredProducts.length} filtré(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadProducts(false)} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
            <Plus className="w-5 h-5" /> Nouveau Produit
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher par nom, DCI ou code..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12"><Package className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun produit trouvé</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Classement</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Prix Vente</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Stockable</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={`border-b border-gray-100 hover:bg-gray-50 ${product.statut_produit === 'declasse' ? 'bg-gray-100 opacity-70' : ''}`}>
                    <td className="py-3 px-4 font-mono text-sm">{product.code_produit || '-'}</td>
                    <td className="py-3 px-4 font-medium">{product.nom}</td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{product.classement || 'Général'}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{Number(product.prix_vente).toLocaleString('fr-FR')} F</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stockable !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {product.stockable !== false ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.statut_produit === 'declasse' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {product.statut_produit === 'declasse' ? 'Déclassé' : 'Actif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setSelectedProduct(product); setShowForm(true); }} className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product)} className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANT FORMULAIRE ENRICHI
// ==========================================
interface ProductFormProps {
  product: LocalProduit | null;
  pharmacyId: string;
  onClose: () => void;
}

function ProductForm({ product, pharmacyId, onClose }: ProductFormProps) {
  const [formData, setFormData] = useState({
    nom: product?.nom || '',
    dci: product?.dci || '',
    forme: product?.forme || '',
    dosage: product?.dosage || '',
    code_produit: product?.code_produit || '',
    numero_lot: product?.numero_lot || '',
    prix_achat: product?.prix_achat ? product.prix_achat.toString() : '',
    prix_vente: product?.prix_vente ? product.prix_vente.toString() : '',
    prix_public: product?.prix_public ? product.prix_public.toString() : '',
    stock_minimum: product?.stock_minimum ? product.stock_minimum.toString() : '0',
    prescription_requise: product?.prescription_requise || false,
    stockable: product?.stockable !== undefined ? product.stockable : true,
    classement: product?.classement || 'general',
  });
  
  const [loading, setLoading] = useState(false);
  const [showDeclassement, setShowDeclassement] = useState(false);
  const [motifDeclassement, setMotifDeclassement] = useState('');

  const classements = [
    { id: 'general', nom: 'Général', couleur: '#3B82F6' },
    { id: 'psychotrope', nom: 'Psychotrope', couleur: '#8B5CF6' },
    { id: 'stupéfiant', nom: 'Stupéfiant', couleur: '#EF4444' },
    { id: 'antibiotique', nom: 'Antibiotique', couleur: '#F59E0B' },
    { id: 'vaccin', nom: 'Vaccin', couleur: '#10B981' },
    { id: 'dispositif_medical', nom: 'Dispositif médical', couleur: '#6B7280' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        pharmacy_id: pharmacyId,
        nom: formData.nom.trim(),
        dci: formData.dci.trim() || null,
        forme: formData.forme.trim() || null,
        dosage: formData.dosage.trim() || null,
        code_produit: formData.code_produit.trim(),
        numero_lot: formData.numero_lot.trim() || null,
        prix_achat: parseFloat(formData.prix_achat) || 0,
        prix_vente: parseFloat(formData.prix_vente) || 0,
        prix_public: parseFloat(formData.prix_public) || 0,
        stock_minimum: parseInt(formData.stock_minimum) || 0,
        prescription_requise: formData.prescription_requise,
        stockable: formData.stockable,
        classement: formData.classement,
        actif: true,
      };

      if (product) await repository.updateProduit(product.id, data);
      else await repository.createProduit(data);
      
      onClose();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclassement = async () => {
    if (!motifDeclassement.trim()) {
      alert('Veuillez saisir un motif de déclassement');
      return;
    }
    try {
      await repository.updateProduit(product!.id, {
        statut_produit: 'declasse',
        motif_declassement: motifDeclassement,
        date_declassement: new Date().toISOString(),
        actif: false,
      });
      alert('✅ Produit déclassé avec succès');
      onClose();
    } catch (error: any) {
      alert('❌ Erreur: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">{product ? 'Modifier le Produit' : 'Nouveau Produit'}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-6 h-6 text-gray-600" /></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom commercial *</label>
              <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code produit *</label>
              <input type="text" value={formData.code_produit} onChange={(e) => setFormData({ ...formData, code_produit: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de lot</label>
              <input type="text" value={formData.numero_lot} onChange={(e) => setFormData({ ...formData, numero_lot: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Ex: LOT-2024-001" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">DCI</label>
              <input type="text" value={formData.dci} onChange={(e) => setFormData({ ...formData, dci: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forme / Dosage</label>
              <div className="flex gap-2">
                <input type="text" value={formData.forme} onChange={(e) => setFormData({ ...formData, forme: e.target.value })} placeholder="Comprimé" className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                <input type="text" value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} placeholder="500mg" className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix d'achat (FCFA) *</label>
              <input type="number" step="0.01" min="0" value={formData.prix_achat} onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix de vente (FCFA) *</label>
              <input type="number" step="0.01" min="0" value={formData.prix_vente} onChange={(e) => setFormData({ ...formData, prix_vente: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix public (FCFA)</label>
              <input type="number" step="0.01" min="0" value={formData.prix_public} onChange={(e) => setFormData({ ...formData, prix_public: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock minimum</label>
              <input type="number" min="0" value={formData.stock_minimum} onChange={(e) => setFormData({ ...formData, stock_minimum: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Classement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Classement *</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {classements.map((classement) => (
                <button key={classement.id} type="button" onClick={() => setFormData({ ...formData, classement: classement.id })} className={`p-3 rounded-lg border-2 transition ${formData.classement === classement.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: classement.couleur }} />
                    <span className="text-sm font-medium">{classement.nom}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={formData.prescription_requise} onChange={(e) => setFormData({ ...formData, prescription_requise: e.target.checked })} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
              <div>
                <p className="font-medium text-gray-900">Sous ordonnance</p>
                <p className="text-xs text-gray-500">Nécessite une ordonnance médicale</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={formData.stockable} onChange={(e) => setFormData({ ...formData, stockable: e.target.checked })} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
              <div>
                <p className="font-medium text-gray-900">Produit stockable</p>
                <p className="text-xs text-gray-500">Géré dans l'inventaire et le stock</p>
              </div>
            </label>
          </div>

          {/* Section Déclassement (Uniquement pour les produits existants et actifs) */}
          {product && product.statut_produit !== 'declasse' && (
            <div className="border-t border-gray-200 pt-6">
              <button type="button" onClick={() => setShowDeclassement(!showDeclassement)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                <AlertTriangle className="w-4 h-4" /> Déclasser ce produit
              </button>

              {showDeclassement && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Motif du déclassement *</h4>
                  <textarea value={motifDeclassement} onChange={(e) => setMotifDeclassement(e.target.value)} rows={3} placeholder="Ex: Produit retiré du marché, rupture définitive, etc." className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500" required />
                  <div className="mt-3 flex gap-3">
                    <button type="button" onClick={handleDeclassement} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Confirmer le déclassement</button>
                    <button type="button" onClick={() => setShowDeclassement(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Enregistrement...</> : (product ? 'Mettre à jour' : 'Créer le produit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
