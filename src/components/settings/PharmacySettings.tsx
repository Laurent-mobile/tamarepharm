// components/settings/PharmacySettings.tsx
import { useState, useEffect } from 'react';
import { Save, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function PharmacySettings() {
  const { utilisateur } = useAuth();
  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    ville: '',
    pays: 'Burkina Faso',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (utilisateur) {
      loadPharmacyInfo();
    }
  }, [utilisateur]);

  const loadPharmacyInfo = async () => {
    if (!utilisateur) return;

    try {
      setDbError(null);
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('id', utilisateur.pharmacy_id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          nom: data.nom || '',
          telephone: data.telephone || '',
          email: data.email || '',
          adresse: data.adresse || '',
          ville: data.ville || '',
          pays: data.pays || 'Burkina Faso',
        });
      }
    } catch (error: any) {
      console.error('Erreur chargement info pharmacie:', error);
      setDbError(`Erreur lors du chargement: ${error.message}`);
    } finally {
      setInitialLoad(false);
    }
  };

  const handleSave = async () => {
    if (!utilisateur || utilisateur.role !== 'admin') {
      alert('Seul un administrateur peut modifier ces paramètres');
      return;
    }

    setLoading(true);
    setDbError(null);

    try {
      const { error } = await supabase
        .from('pharmacies')
        .update({
          nom: formData.nom,
          telephone: formData.telephone,
          email: formData.email,
          adresse: formData.adresse,
          ville: formData.ville,
          pays: formData.pays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', utilisateur.pharmacy_id);

      if (error) {
        console.error('Erreur Supabase:', error);
        
        // Vérifier si c'est une erreur de politique RLS
        if (error.message.includes('policy') || error.code === '42501') {
          setDbError('Permissions insuffisantes. La politique de sécurité bloque la mise à jour.');
          return;
        }
        throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
      // Recharger pour confirmer la mise à jour
      setTimeout(() => loadPharmacyInfo(), 1000);
      
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      setDbError(`Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (utilisateur?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600">
          Seuls les administrateurs peuvent modifier les informations de la pharmacie.
        </p>
      </div>
    );
  }

  if (initialLoad) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <span className="ml-2 text-gray-600">Chargement des informations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Informations de la pharmacie</h3>
        <p className="text-blue-700 text-sm">
          Ces informations seront utilisées pour les documents officiels et les communications.
        </p>
      </div>

      {dbError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Erreur de configuration</h4>
          <p className="text-red-700 text-sm">{dbError}</p>
          <p className="text-red-700 text-sm mt-2">
            <strong>Solution :</strong> La politique de sécurité (RLS) doit être configurée pour autoriser les mises à jour.
            Exécutez le script SQL suivant dans votre base de données :
          </p>
          <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs mt-2 overflow-x-auto">
{`CREATE POLICY "Users can update own pharmacy" 
ON public.pharmacies 
FOR UPDATE 
USING (auth.uid() IN (
  SELECT id FROM public.utilisateurs WHERE pharmacy_id = pharmacies.id
));`}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="w-4 h-4 inline mr-1" />
            Nom de la pharmacie *
          </label>
          <input
            type="text"
            value={formData.nom}
            onChange={(e) => updateField('nom', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            required
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
            onChange={(e) => updateField('telephone', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            placeholder="+226 XX XX XX XX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-1" />
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            placeholder="contact@pharmacie.bf"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ville *
          </label>
          <input
            type="text"
            value={formData.ville}
            onChange={(e) => updateField('ville', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            placeholder="Ouagadougou"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pays
          </label>
          <select
            value={formData.pays}
            onChange={(e) => updateField('pays', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
          >
            <option value="Burkina Faso">Burkina Faso</option>
            <option value="Côte d'Ivoire">Côte d'Ivoire</option>
            <option value="Mali">Mali</option>
            <option value="Sénégal">Sénégal</option>
            <option value="Autre">Autre</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            Adresse complète
          </label>
          <textarea
            value={formData.adresse}
            onChange={(e) => updateField('adresse', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            placeholder="Adresse complète de la pharmacie..."
          />
        </div>
      </div>

      {/* État actuel des données */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">État actuel dans la base</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Ville:</strong> {formData.ville || <span className="text-red-500">Non définie</span>}</p>
          <p><strong>Dernière mise à jour:</strong> {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {saved && (
            <div className="flex items-center gap-2 text-emerald-600">
              <Save className="w-4 h-4" />
              Informations sauvegardées avec succès
            </div>
          )}
          {dbError && !saved && (
            <div className="text-red-600 text-sm max-w-md">
              {dbError}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading || !formData.nom.trim() || !formData.ville.trim()}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
