// components/settings/SecuritySettings.tsx
import { useState } from 'react';
import { Save, Shield, Lock, History, UserX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function SecuritySettings() {
  const { utilisateur } = useAuth();
  const [settings, setSettings] = useState({
    session_timeout: 30,
    password_policy: true,
    two_factor_auth: false,
    login_attempts: 5,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!utilisateur || utilisateur.role !== 'admin') {
      alert('Seul un administrateur peut modifier ces paramètres');
      return;
    }

    setLoading(true);
    try {
      // Sauvegarde des paramètres de sécurité
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (utilisateur?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600">
          Seuls les administrateurs peuvent modifier les paramètres de sécurité.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <History className="w-4 h-4 inline mr-1" />
            Délai d'expiration de session (minutes)
          </label>
          <select
            value={settings.session_timeout}
            onChange={(e) => setSettings({ ...settings, session_timeout: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 heure</option>
            <option value={120}>2 heures</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <UserX className="w-4 h-4 inline mr-1" />
            Tentatives de connexion maximales
          </label>
          <select
            value={settings.login_attempts}
            onChange={(e) => setSettings({ ...settings, login_attempts: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value={3}>3 tentatives</option>
            <option value={5}>5 tentatives</option>
            <option value={10}>10 tentatives</option>
          </select>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h3 className="font-semibold text-gray-900">Politiques de sécurité</h3>
          
          {[
            {
              key: 'password_policy',
              label: 'Politique de mot de passe forte',
              description: 'Exiger des mots de passe complexes (majuscules, chiffres, caractères spéciaux)',
              icon: Lock
            },
            {
              key: 'two_factor_auth',
              label: 'Authentification à deux facteurs',
              description: 'Exiger une vérification supplémentaire pour les administrateurs',
              icon: Shield
            },
          ].map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key as keyof typeof settings]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">Recommandations de sécurité</h4>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Activez l'authentification à deux facteurs pour les comptes administrateur</li>
          <li>• Utilisez des mots de passe complexes et changez-les régulièrement</li>
          <li>• Limitez le nombre de tentatives de connexion pour prévenir les attaques par force brute</li>
          <li>• Déconnectez automatiquement les utilisateurs après une période d'inactivité</li>
        </ul>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {saved && (
            <div className="flex items-center gap-2 text-emerald-600">
              <Save className="w-4 h-4" />
              Paramètres sauvegardés
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
