// components/orders/SimpleProformaForm.tsx
import { useState, useEffect } from 'react';
import { Plus, X, Save, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function SimpleProformaForm({ onClose }: any) {
  const { utilisateur } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('🔄 Chargement des données...', { utilisateur });

      const [fournisseursRes, produitsRes] = await Promise.all([
        supabase.from('fournisseurs').select('*').eq('actif', true),
        supabase.from('produits').select('*')
      ]);

      console.log('📦 Résultats:', {
        fournisseurs: fournisseursRes.data?.length,
        produits: produitsRes.data?.length,
        fournisseursError: fournisseursRes.error,
        produitsError: produitsRes.error
      });

      if (fournisseursRes.data) setFournisseurs(fournisseursRes.data);
      if (produitsRes.data) setProduits(produitsRes.data);

    } catch (error) {
      console.error('❌ Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const ajouterLigne = () => {
    setLignes([...lignes, { produit_id: '', quantite: 1, prix: 0 }]);
  };

  const supprimerLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const mettreAJourLigne = (index: number, champ: string, valeur: any) => {
    const nouvellesLignes = [...lignes];
    nouvellesLignes[index][champ] = valeur;
    
    if (champ === 'produit_id' && valeur) {
      const produit = produits.find(p => p.id === valeur);
      nouvellesLignes[index].prix = produit?.prix_achat || 0;
    }
    
    setLignes(nouvellesLignes);
  };

  const creerProforma = async () => {
    if (!selectedFournisseur) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    if (lignes.length === 0) {
      alert('Veuillez ajouter au moins un produit');
      return;
    }

    setSaving(true);

    try {
      console.log('💾 Création du proforma...');

      // 1. Créer le proforma
      const { data: proforma, error: proformaError } = await supabase
        .from('demandes_proforma')
        .insert({
          pharmacy_id: utilisateur!.pharmacy_id,
          fournisseur_id: selectedFournisseur,
          numero_demande: `PRO${Date.now()}`,
          date_demande: new Date().toISOString().split('T')[0],
          statut: 'brouillon',
          montant_estime: lignes.reduce((sum, l) => sum + (l.quantite * l.prix), 0),
          created_by: utilisateur!.id,
        })
        .select()
        .single();

      if (proformaError) {
        console.error('❌ Erreur création proforma:', proformaError);
        throw proformaError;
      }

      console.log('✅ Proforma créé:', proforma.id);

      // 2. Créer les lignes
      const lignesData = lignes.map(ligne => ({
        demande_id: proforma.id,
        produit_id: ligne.produit_id,
        quantite_demandee: ligne.quantite,
        prix_unitaire_estime: ligne.prix,
      }));

      const { error: lignesError } = await supabase
        .from('demandes_proforma_lignes')
        .insert(lignesData);

      if (lignesError) {
        console.error('❌ Erreur création lignes:', lignesError);
        throw lignesError;
      }

      console.log('✅ Lignes créées');

      alert('Pro-forma créé avec succès!');
      onClose();

    } catch (error: any) {
      console.error('❌ Erreur finale:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Nouveau Pro-forma</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Fournisseur */}
          <div className="mb-6">
            <label className="block font-medium mb-2">Fournisseur *</label>
            <select
              value={selectedFournisseur}
              onChange={(e) => setSelectedFournisseur(e.target.value)}
              className="w-full p-2 border rounded"
              disabled={saving}
            >
              <option value="">Sélectionner un fournisseur</option>
              {fournisseurs.map(f => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
            <p className="text-sm text-gray-600 mt-1">
              {fournisseurs.length} fournisseur(s) disponible(s)
            </p>
          </div>

          {/* Produits */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Produits</h3>
              <button
                onClick={ajouterLigne}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            {lignes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucun produit ajouté</p>
            ) : (
              <div className="space-y-3">
                {lignes.map((ligne, index) => (
                  <div key={index} className="flex gap-3 p-3 border rounded">
                    <select
                      value={ligne.produit_id}
                      onChange={(e) => mettreAJourLigne(index, 'produit_id', e.target.value)}
                      className="flex-1 p-2 border rounded"
                      disabled={saving}
                    >
                      <option value="">Sélectionner un produit</option>
                      {produits.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nom} - {p.code_produit}
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      min="1"
                      value={ligne.quantite}
                      onChange={(e) => mettreAJourLigne(index, 'quantite', parseInt(e.target.value))}
                      className="w-20 p-2 border rounded"
                      disabled={saving}
                    />
                    
                    <input
                      type="number"
                      step="0.01"
                      value={ligne.prix}
                      onChange={(e) => mettreAJourLigne(index, 'prix', parseFloat(e.target.value))}
                      className="w-32 p-2 border rounded"
                      disabled={saving}
                    />
                    
                    <button
                      onClick={() => supprimerLigne(index)}
                      disabled={saving}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 p-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={creerProforma}
              disabled={saving || !selectedFournisseur || lignes.length === 0}
              className="flex-1 p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Création...' : 'Créer le Pro-forma'}
            </button>
          </div>

          {/* Debug info */}
          <div className="mt-6 p-4 bg-gray-100 rounded text-xs">
            <p><strong>Debug:</strong></p>
            <p>Utilisateur: {utilisateur?.nom_complet}</p>
            <p>Pharmacy: {utilisateur?.pharmacy_id}</p>
            <p>Fournisseurs: {fournisseurs.length}</p>
            <p>Produits: {produits.length}</p>
            <p>Lignes: {lignes.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
