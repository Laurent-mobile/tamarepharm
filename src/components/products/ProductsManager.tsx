import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, X } from 'lucide-react';
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

  // Chargement des produits au montage ou quand l'utilisateur change
  useEffect(() => {
    if (utilisateur?.pharmacy_id) {
      loadProducts();
    } else {
      console.warn('⚠️ Chargement produits annulé : pharmacy_id manquant', utilisateur);
      setLoading(false);
    }
  }, [utilisateur]);

  const loadProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      
      setError(null);

      if (!utilisateur?.pharmacy_id) {
        console.error('❌ pharmacy_id manquant dans la session utilisateur');
        setError('Pharmacie non identifiée. Veuillez vous déconnecter et vous reconnecter.');
        return;
      }

      console.log('🔍 Chargement des produits pour pharmacy_id:', utilisateur.pharmacy_id);
      
      // ✅ LECTURE LOCALE INSTANTANÉE (Fonctionne hors-ligne)
      const productsData = await repository.getProduits(utilisateur.pharmacy_id);
      console.log(`✅ ${productsData.length} produit(s) trouvé(s) en local`, productsData);
      
      setProducts(productsData);

    } catch (error: any) {
      console.error('❌ Erreur chargement produits:', error);
      setError('Erreur lors du chargement des produits: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (product: LocalProduit) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${product.nom}" ?`)) return;
    
    try {
      // ✅ SUPPRESSION LOCALE + MISE EN FILE D'ATTENTE DE SYNC
      await repository.deleteProduit(product.id);
      await loadProducts(false); // Rechargement instantané
    } catch (error: any) {
      console.error('❌ Erreur suppression:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  // ✅ FILTRAGE SÉCURISÉ (évite les crashs si une propriété est undefined)
  const filteredProducts = products.filter((p) => {
    const searchLower = searchTerm.toLowerCase();
    const nom = (p.nom || '').toLowerCase();
    const dci = (p.dci || '').toLowerCase();
    const code = (p.code_produit || '').toLowerCase();
    
    return nom.includes(searchLower) || dci.includes(searchLower) || code.includes(searchLower);
  });

  if (showForm) {
    return (
      <ProductForm
        product={selectedProduct}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => {
          setShowForm(false);
          setSelectedProduct(null);
          loadProducts(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Produits</h2>
          <p className="text-gray-600 mt-1">
            {products.length} produit(s) au total • {filteredProducts.length} filtré(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadProducts(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nouveau Produit
          </button>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-600 font-bold">!</span>
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-xl">×</button>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, DCI ou code..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'Aucun produit ne correspond à votre recherche' : 'Aucun produit dans la base de données'}
            </p>
            {!searchTerm && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un premier produit
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  💡 Astuce : Si vous avez des produits dans Supabase, vérifiez que l'indicateur de synchronisation (en bas à droite) est vert 🟢.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">DCI</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Forme/Dosage</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Prix Achat</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Prix Vente</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Rx</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{product.code_produit || '-'}</td>
                    <td className="py-3 px-4 font-medium">{product.nom}</td>
                    <td className="py-3 px-4 text-gray-600">{product.dci || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {[product.forme, product.dosage].filter(Boolean).join(' - ') || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {Number(product.prix_achat).toLocaleString('fr-FR')} F
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {Number(product.prix_vente).toLocaleString('fr-FR')} F
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        product.prescription_requise ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {product.prescription_requise ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowForm(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
// COMPOSANT FORMULAIRE
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
    prix_achat: product?.prix_achat ? product.prix_achat.toString() : '',
    prix_vente: product?.prix_vente ? product.prix_vente.toString() : '',
    stock_minimum: product?.stock_minimum ? product.stock_minimum.toString() : '0',
    prescription_requise: product?.prescription_requise || false,
  });
  const [loading, setLoading] = useState(false);

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
        prix_achat: parseFloat(formData.prix_achat) || 0,
        prix_vente: parseFloat(formData.prix_vente) || 0,
        stock_minimum: parseInt(formData.stock_minimum) || 0,
        prescription_requise: formData.prescription_requise,
        actif: true,
      };

      console.log('💾 Sauvegarde du produit:', data);

      if (product) {
        await repository.updateProduit(product.id, data);
      } else {
        await repository.createProduit(data);
      }
      
      onClose();
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          {product ? 'Modifier le Produit' : 'Nouveau Produit'}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <X className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom commercial *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Ex: Paracétamol 500mg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">DCI</label>
              <input
                type="text"
                value={formData.dci}
                onChange={(e) => setFormData({ ...formData, dci: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Dénomination Commune Internationale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code produit *</label>
              <input
                type="text"
                value={formData.code_produit}
                onChange={(e) => setFormData({ ...formData, code_produit: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Ex: PARA500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forme</label>
              <input
                type="text"
                value={formData.forme}
                onChange={(e) => setFormData({ ...formData, forme: e.target.value })}
                placeholder="Comprimé, Sirop, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dosage</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="500mg, 100mg/ml, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix d'achat (FCFA) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.prix_achat}
                onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix de vente (FCFA) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.prix_vente}
                onChange={(e) => setFormData({ ...formData, prix_vente: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock minimum</label>
              <input
                type="number"
                min="0"
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="prescription"
                checked={formData.prescription_requise}
                onChange={(e) => setFormData({ ...formData, prescription_requise: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="prescription" className="text-sm font-medium text-gray-700">
                Prescription médicale requise
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                product ? 'Mettre à jour' : 'Créer le produit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
