// components/orders/OrderForm.tsx
import { useState, useEffect } from 'react';
import { Plus, X, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function OrderForm({ proforma, onClose }: any) {
  const { utilisateur } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [proformas, setProformas] = useState<any[]>([]);
  const [lignes, setLignes] = useState<Array<{
    produit_id: string;
    quantite_commandee: number;
    prix_unitaire: number;
    produit?: any;
  }>>([]);
  const [formData, setFormData] = useState({
    fournisseur_id: '',
    proforma_id: '',
    bon_commande_numero: '',
    date_livraison_prevue: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Debug
  useEffect(() => {
    console.log('🎯 OrderForm monté:', {
      proforma,
      utilisateur: utilisateur?.nom_complet,
      hasProforma: !!proforma
    });
  }, []);

  useEffect(() => {
    loadInitialData();
    if (proforma) {
      console.log('📝 Proforma reçu:', {
        id: proforma.id,
        numero: proforma.numero_demande,
        fournisseur: proforma.fournisseurs?.nom,
        statut: proforma.statut
      });
      setFormData({
        fournisseur_id: proforma.fournisseur_id,
        proforma_id: proforma.id,
        bon_commande_numero: `BC${Date.now()}`,
        date_livraison_prevue: ''
      });
      chargerLignesProforma();
    }
  }, [proforma]);

  const loadInitialData = async () => {
    try {
      console.log('📥 Chargement des données pour OrderForm...');
      
      const [fournisseursData, produitsData, proformasData] = await Promise.all([
        supabase.from('fournisseurs').select('*').eq('actif', true),
        supabase.from('produits').select('*'),
        supabase.from('demandes_proforma')
          .select(`
            *,
            fournisseurs(*),
            demandes_proforma_lignes(
              *,
              produits(*)
            )
          `)
          .eq('pharmacy_id', utilisateur!.pharmacy_id)
          .in('statut', ['validee', 'recu', 'envoyee', 'brouillon'])
          .order('date_demande', { ascending: false })
      ]);

      console.log('📦 Résultats chargement:', {
        fournisseurs: fournisseursData.data?.length,
        produits: produitsData.data?.length,
        proformas: proformasData.data?.length,
        fournisseursError: fournisseursData.error,
        produitsError: produitsData.error,
        proformasError: proformasData.error
      });

      if (fournisseursData.data) setFournisseurs(fournisseursData.data);
      if (produitsData.data) setProduits(produitsData.data);
      if (proformasData.data) setProformas(proformasData.data);

    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const chargerLignesProforma = async () => {
    if (!proforma) return;

    console.log('🔄 Chargement des lignes du proforma:', proforma.id);

    try {
      // Toujours recharger les lignes pour être sûr d'avoir les données fraîches
      const { data: lignesData, error } = await supabase
        .from('demandes_proforma_lignes')
        .select('*, produits(*)')
        .eq('demande_id', proforma.id);

      if (error) {
        console.error('❌ Erreur chargement lignes:', error);
        return;
      }

      console.log('✅ Lignes chargées:', lignesData?.length);

      if (lignesData && lignesData.length > 0) {
        const nouvellesLignes = lignesData.map((ligne: any) => ({
          produit_id: ligne.produit_id,
          quantite_commandee: ligne.quantite_demandee,
          prix_unitaire: ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || ligne.produits?.prix_achat || 0,
          produit: ligne.produits
        }));
        
        setLignes(nouvellesLignes);
        console.log('📝 Lignes définies:', nouvellesLignes.length);
      } else {
        console.log('⚠️ Aucune ligne trouvée pour ce proforma');
      }

    } catch (error) {
      console.error('❌ Erreur chargement lignes proforma:', error);
    }
  };

  const chargerProformaSelectionne = async (proformaId: string) => {
    if (!proformaId) {
      setLignes([]);
      setFormData(prev => ({ ...prev, fournisseur_id: '' }));
      return;
    }

    try {
      console.log('🔄 Chargement du proforma sélectionné:', proformaId);

      const { data, error } = await supabase
        .from('demandes_proforma')
        .select(`
          *,
          fournisseurs(*),
          demandes_proforma_lignes(
            *,
            produits(*)
          )
        `)
        .eq('id', proformaId)
        .single();

      if (error) throw error;

      console.log('✅ Proforma chargé:', data.numero_demande);

      if (data.demandes_proforma_lignes) {
        setLignes(data.demandes_proforma_lignes.map((ligne: any) => ({
          produit_id: ligne.produit_id,
          quantite_commandee: ligne.quantite_demandee,
          prix_unitaire: ligne.prix_unitaire_propose || ligne.prix_unitaire_estime || ligne.produits?.prix_achat || 0,
          produit: ligne.produits
        })));
      }

      setFormData(prev => ({
        ...prev,
        fournisseur_id: data.fournisseur_id
      }));

    } catch (error) {
      console.error('❌ Erreur chargement proforma:', error);
    }
  };

  const ajouterLigne = () => {
    setLignes([...lignes, { produit_id: '', quantite_commandee: 1, prix_unitaire: 0 }]);
  };

  const supprimerLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const mettreAJourLigne = (index: number, champ: string, valeur: any) => {
    const nouvellesLignes = [...lignes];
    nouvellesLignes[index] = { ...nouvellesLignes[index], [champ]: valeur };
    
    if (champ === 'produit_id' && valeur) {
      const produit = produits.find(p => p.id === valeur);
      if (produit) {
        nouvellesLignes[index].prix_unitaire = produit.prix_achat;
        nouvellesLignes[index].produit = produit;
      }
    }
    
    setLignes(nouvellesLignes);
  };

  const calculerTotal = () => {
    return lignes.reduce((total, ligne) => total + (ligne.quantite_commandee * ligne.prix_unitaire), 0);
  };

  const validerCommande = async () => {
    if (!formData.fournisseur_id || lignes.length === 0) {
      alert('Veuillez sélectionner un fournisseur et ajouter des produits');
      return;
    }

    setLoading(true);
    try {
      console.log('💾 Création de la commande...');

      const numeroCommande = `CMD${Date.now()}`;
      const montantTotal = calculerTotal();

      // Créer la commande
      const { data: commande, error } = await supabase
        .from('commandes_fournisseurs')
        .insert({
          pharmacy_id: utilisateur!.pharmacy_id,
          fournisseur_id: formData.fournisseur_id,
          numero_commande: numeroCommande,
          date_commande: new Date().toISOString().split('T')[0],
          statut: 'en_attente',
          montant_total: montantTotal,
          created_by: utilisateur!.id,
          proforma_id: formData.proforma_id || null,
          bon_commande_numero: formData.bon_commande_numero || null,
          date_livraison_prevue: formData.date_livraison_prevue || null
        })
        .select()
        .single();

      if (error) throw error;

      // Créer les lignes de commande
      const lignesCommande = lignes.map(ligne => ({
        commande_id: commande.id,
        produit_id: ligne.produit_id,
        quantite_commandee: ligne.quantite_commandee,
        quantite_recue: 0,
        prix_unitaire: ligne.prix_unitaire,
      }));

      const { error: lignesError } = await supabase
        .from('commande_fournisseur_lignes')
        .insert(lignesCommande);

      if (lignesError) throw lignesError;

      // Marquer le pro-forma comme transformé si applicable
      if (formData.proforma_id) {
        await supabase
          .from('demandes_proforma')
          .update({ statut: 'transformee' })
          .eq('id', formData.proforma_id);
      }

      // Historisation
      await supabase
        .from('historique_commandes')
        .insert({
          commande_id: commande.id,
          proforma_id: formData.proforma_id || null,
          type_evenement: 'commande_creee',
          description: 'Commande créée',
          details: {
            numero_commande: numeroCommande,
            bon_commande_numero: formData.bon_commande_numero,
            nombre_produits: lignes.length,
            montant_total: montantTotal
          },
          utilisateur_id: utilisateur!.id
        });

      alert('Commande créée avec succès!');
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      onClose();
      
    } catch (error: any) {
      console.error('❌ Erreur création commande:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Afficher un loading pendant le chargement initial
  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <span className="ml-2">Chargement du formulaire...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          {proforma ? `Créer Commande depuis ${proforma.numero_demande}` : 'Nouvelle Commande'}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <X className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Debug info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold text-yellow-800">Debug Info:</h3>
        <p className="text-sm text-yellow-700">
          Proforma: {proforma?.numero_demande || 'Aucun'} | 
          Fournisseurs: {fournisseurs.length} | 
          Produits: {produits.length} | 
          Lignes: {lignes.length}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {!proforma && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pro-forma source
              </label>
              <select
                value={formData.proforma_id}
                onChange={(e) => {
                  setFormData({ ...formData, proforma_id: e.target.value });
                  chargerProformaSelectionne(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sélectionner un pro-forma (optionnel)</option>
                {proformas.map((proforma) => (
                  <option key={proforma.id} value={proforma.id}>
                    {proforma.numero_demande} - {proforma.fournisseurs?.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fournisseur *
            </label>
            <select
              value={formData.fournisseur_id}
              onChange={(e) => setFormData({ ...formData, fournisseur_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
              disabled={!!proforma || !!formData.proforma_id}
            >
              <option value="">Sélectionner un fournisseur</option>
              {fournisseurs.map((fournisseur) => (
                <option key={fournisseur.id} value={fournisseur.id}>
                  {fournisseur.nom}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              N° Bon de Commande
            </label>
            <input
              type="text"
              value={formData.bon_commande_numero}
              onChange={(e) => setFormData({ ...formData, bon_commande_numero: e.target.value })}
              placeholder="BC20240001"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date livraison prévue
            </label>
            <input
              type="date"
              value={formData.date_livraison_prevue}
              onChange={(e) => setFormData({ ...formData, date_livraison_prevue: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lignes de commande */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Produits commandés</h3>
            <button
              type="button"
              onClick={ajouterLigne}
              className="flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Ajouter un produit
            </button>
          </div>

          {lignes.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Aucun produit ajouté</p>
              <p className="text-sm text-gray-400 mt-1">
                {proforma ? 'Les produits du pro-forma seront automatiquement chargés' : 'Ajoutez des produits manuellement'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {lignes.map((ligne, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                      <select
                        value={ligne.produit_id}
                        onChange={(e) => mettreAJourLigne(index, 'produit_id', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="">Sélectionner</option>
                        {produits.map((produit) => (
                          <option key={produit.id} value={produit.id}>
                            {produit.nom} - {produit.code_produit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                      <input
                        type="number"
                        value={ligne.quantite_commandee}
                        onChange={(e) => mettreAJourLigne(index, 'quantite_commandee', parseInt(e.target.value))}
                        min="1"
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire</label>
                      <input
                        type="number"
                        step="0.01"
                        value={ligne.prix_unitaire}
                        onChange={(e) => mettreAJourLigne(index, 'prix_unitaire', parseFloat(e.target.value))}
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sous-total</label>
                      <p className="font-bold">
                        {(ligne.quantite_commandee * ligne.prix_unitaire).toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => supprimerLigne(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg mb-6">
          <span className="text-lg font-bold">Total de la commande:</span>
          <span className="text-2xl font-bold text-emerald-600">
            {calculerTotal().toLocaleString('fr-FR')} F
          </span>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={validerCommande}
            disabled={loading || lignes.length === 0 || !formData.fournisseur_id}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {loading ? 'Création...' : 'Créer la Commande'}
          </button>
        </div>
      </div>
    </div>
  );
}
