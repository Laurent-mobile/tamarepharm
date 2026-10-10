// components/orders/ProformaForm.tsx
import { useState, useEffect } from 'react';
import { Plus, X, Save, Send, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DemandeProforma, Fournisseur, Produit } from '../../types/database';



interface ProformaFormProps {
  proforma?: DemandeProforma | null;
  onClose: () => void;
}

interface LigneProforma {
  produit_id: string;
  quantite_demandee: number;
  prix_unitaire_estime?: number;
  produit?: Produit;
}

export function ProformaForm({ proforma, onClose }: ProformaFormProps) {
  const { utilisateur } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneProforma[]>([]);
  const [formData, setFormData] = useState({
    fournisseur_id: '',
    date_besoin: '',
    remarques: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
// Au début de votre ProformaForm, ajoutez :
useEffect(() => {
  console.log('🔍 ProformaForm State:', {
    utilisateur,
    fournisseursCount: fournisseurs.length,
    produitsCount: produits.length,
    lignesCount: lignes.length,
    formData,
    proforma
  });
}, [utilisateur, fournisseurs, produits, lignes, formData, proforma]);
  
  useEffect(() => {
    loadInitialData();
    if (proforma) {
      loadProformaData();
    }
  }, [proforma]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [fournisseursData, produitsData] = await Promise.all([
        supabase.from('fournisseurs').select('*').eq('actif', true),
        supabase.from('produits').select('*'),
      ]);

      if (fournisseursData.error) throw fournisseursData.error;
      if (produitsData.error) throw produitsData.error;

      setFournisseurs(fournisseursData.data || []);
      setProduits(produitsData.data || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadProformaData = async () => {
    if (!proforma) return;

    setFormData({
      fournisseur_id: proforma.fournisseur_id,
      date_besoin: proforma.date_besoin || '',
      remarques: proforma.remarques || ''
    });

    // Charger les lignes existantes
    if (proforma.demandes_proforma_lignes) {
      setLignes(proforma.demandes_proforma_lignes.map(ligne => ({
        produit_id: ligne.produit_id,
        quantite_demandee: ligne.quantite_demandee,
        prix_unitaire_estime: ligne.prix_unitaire_estime || undefined,
        produit: ligne.produits
      })));
    } else {
      // Si les lignes ne sont pas chargées, les récupérer
      try {
        const { data: lignesData, error } = await supabase
          .from('demandes_proforma_lignes')
          .select('*, produits(*)')
          .eq('demande_id', proforma.id);

        if (error) throw error;

        if (lignesData) {
          setLignes(lignesData.map(ligne => ({
            produit_id: ligne.produit_id,
            quantite_demandee: ligne.quantite_demandee,
            prix_unitaire_estime: ligne.prix_unitaire_estime || undefined,
            produit: ligne.produits
          })));
        }
      } catch (error) {
        console.error('Erreur chargement lignes:', error);
      }
    }
  };

  const ajouterLigne = () => {
    setLignes([...lignes, { 
      produit_id: '', 
      quantite_demandee: 1, 
      prix_unitaire_estime: 0 
    }]);
  };

  const supprimerLigne = (index: number) => {
    const nouvellesLignes = [...lignes];
    nouvellesLignes.splice(index, 1);
    setLignes(nouvellesLignes);
  };

  const mettreAJourLigne = (index: number, champ: string, valeur: any) => {
    const nouvellesLignes = [...lignes];
    
    if (champ === 'produit_id' && valeur) {
      const produit = produits.find(p => p.id === valeur);
      nouvellesLignes[index] = {
        ...nouvellesLignes[index],
        produit_id: valeur,
        produit: produit,
        prix_unitaire_estime: produit?.prix_achat || 0
      };
    } else {
      nouvellesLignes[index] = { 
        ...nouvellesLignes[index], 
        [champ]: valeur 
      };
    }
    
    setLignes(nouvellesLignes);
  };

  const calculerMontantEstime = () => {
    return lignes.reduce((total, ligne) => {
      const prix = ligne.prix_unitaire_estime || 0;
      const quantite = ligne.quantite_demandee || 0;
      return total + (prix * quantite);
    }, 0);
  };

  const validerProforma = async (statut: 'brouillon' | 'envoyee' = 'brouillon') => {
    // Validation
    if (!formData.fournisseur_id) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    if (lignes.length === 0) {
      alert('Veuillez ajouter au moins un produit');
      return;
    }

    // Validation des lignes
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      if (!ligne.produit_id) {
        alert(`Veuillez sélectionner un produit pour la ligne ${i + 1}`);
        return;
      }
      if (!ligne.quantite_demandee || ligne.quantite_demandee <= 0) {
        alert(`Veuillez saisir une quantité valide pour la ligne ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    try {
      const numeroDemande = `PRO${Date.now()}`;
      const montantEstime = calculerMontantEstime();

      let proformaId = proforma?.id;

      if (proforma) {
        // Mise à jour du proforma existant
        const { error } = await supabase
          .from('demandes_proforma')
          .update({
            fournisseur_id: formData.fournisseur_id,
            date_besoin: formData.date_besoin || null,
            remarques: formData.remarques || null,
            statut: statut,
            montant_estime: montantEstime,
            updated_at: new Date().toISOString()
          })
          .eq('id', proforma.id);

        if (error) {
          console.error('Erreur mise à jour proforma:', error);
          throw error;
        }
      } else {
        // Création d'un nouveau proforma
        const { data, error } = await supabase
          .from('demandes_proforma')
          .insert({
            pharmacy_id: utilisateur!.pharmacy_id,
            fournisseur_id: formData.fournisseur_id,
            numero_demande: numeroDemande,
            date_demande: new Date().toISOString().split('T')[0],
            date_besoin: formData.date_besoin || null,
            statut: statut,
            montant_estime: montantEstime,
            remarques: formData.remarques || null,
            created_by: utilisateur!.id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erreur création proforma:', error);
          throw error;
        }
        proformaId = data.id;
      }

      // Gestion des lignes
      if (proformaId) {
        // Supprimer les anciennes lignes si modification
        if (proforma) {
          const { error: deleteError } = await supabase
            .from('demandes_proforma_lignes')
            .delete()
            .eq('demande_id', proformaId);

          if (deleteError) {
            console.error('Erreur suppression anciennes lignes:', deleteError);
            throw deleteError;
          }
        }

        // Préparer les nouvelles lignes
        const lignesProforma = lignes.map(ligne => ({
          demande_id: proformaId,
          produit_id: ligne.produit_id,
          quantite_demandee: ligne.quantite_demandee,
          prix_unitaire_estime: ligne.prix_unitaire_estime || null,
          remarques: ''
        }));

        // Insérer les nouvelles lignes
        const { error: lignesError } = await supabase
          .from('demandes_proforma_lignes')
          .insert(lignesProforma);

        if (lignesError) {
          console.error('Erreur insertion lignes:', lignesError);
          throw lignesError;
        }
      }

      // Historisation
      const { error: histError } = await supabase
        .from('historique_commandes')
        .insert({
          proforma_id: proformaId,
          type_evenement: statut === 'envoyee' ? 'proforma_envoye' : 'proforma_cree',
          description: statut === 'envoyee' ? 'Demande de pro-forma envoyée au fournisseur' : 'Demande de pro-forma créée',
          details: {
            numero_demande: proforma?.numero_demande || numeroDemande,
            fournisseur_id: formData.fournisseur_id,
            nombre_produits: lignes.length,
            montant_estime: montantEstime
          },
          utilisateur_id: utilisateur!.id
        });

      if (histError) {
        console.error('Erreur historisation:', histError);
        // Ne pas bloquer pour cette erreur
      }

      alert(`Pro-forma ${statut === 'envoyee' ? 'envoyé' : 'sauvegardé'} avec succès!`);
      
      // Déclencher le rechargement des données
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      
      onClose();
    } catch (error: any) {
      console.error('Erreur complète:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          {proforma ? 'Modifier le Pro-forma' : 'Nouvelle Demande de Pro-forma'}
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          disabled={saving}
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fournisseur *
            </label>
            <select
              value={formData.fournisseur_id}
              onChange={(e) => setFormData({ ...formData, fournisseur_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={saving}
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
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Date de besoin
            </label>
            <input
              type="date"
              value={formData.date_besoin}
              onChange={(e) => setFormData({ ...formData, date_besoin: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Remarques
          </label>
          <textarea
            value={formData.remarques}
            onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Informations supplémentaires pour le fournisseur..."
            disabled={saving}
          />
        </div>

        {/* Lignes de produit */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Produits demandés</h3>
            <button
              type="button"
              onClick={ajouterLigne}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              disabled={saving}
            >
              <Plus className="w-4 h-4" />
              Ajouter un produit
            </button>
          </div>

          {lignes.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Aucun produit ajouté</p>
              <p className="text-sm text-gray-400 mt-1">
                Cliquez sur "Ajouter un produit" pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {lignes.map((ligne, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-white">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Produit *
                      </label>
                      <select
                        value={ligne.produit_id}
                        onChange={(e) => mettreAJourLigne(index, 'produit_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        disabled={saving}
                      >
                        <option value="">Sélectionner un produit</option>
                        {produits.map((produit) => (
                          <option key={produit.id} value={produit.id}>
                            {produit.nom} - {produit.code_produit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantité *
                      </label>
                      <input
                        type="number"
                        value={ligne.quantite_demandee}
                        onChange={(e) => mettreAJourLigne(index, 'quantite_demandee', parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prix estimé (F)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ligne.prix_unitaire_estime || ''}
                        onChange={(e) => mettreAJourLigne(index, 'prix_unitaire_estime', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => supprimerLigne(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    disabled={saving}
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        {lignes.length > 0 && (
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg mb-6">
            <span className="text-lg font-bold">Montant estimé:</span>
            <span className="text-2xl font-bold text-blue-600">
              {calculerMontantEstime().toLocaleString('fr-FR')} F
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            disabled={saving}
            type="button"
          >
            Annuler
          </button>
          <button
            onClick={() => validerProforma('brouillon')}
            disabled={saving || lignes.length === 0}
            className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            type="button"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder Brouillon'}
          </button>
          <button
            onClick={() => validerProforma('envoyee')}
            disabled={saving || lignes.length === 0}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            type="button"
          >
            <Send className="w-5 h-5" />
            {saving ? 'Envoi...' : 'Envoyer au Fournisseur'}
          </button>
        </div>
      </div>
    </div>
  );
}
