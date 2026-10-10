// components/settings/NotificationsSettings.tsx
import { useState, useEffect } from 'react';
import { Save, Bell, Mail, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export function NotificationsSettings() {
  const { utilisateur } = useAuth();
  const [notifications, setNotifications] = useState({
    stock_bas: true,
    produits_perimes: true,
    commandes_attente: true,
    inventaires_termines: true,
    email_notifications: false,
    sms_notifications: false,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    if (utilisateur) {
      loadNotificationSettings();
    }
  }, [utilisateur]);

  const loadNotificationSettings = async () => {
    if (!utilisateur) return;

    try {
      setDbError(null);
      const { data, error } = await supabase
        .from('parametres_notifications')
        .select('*')
        .eq('pharmacy_id', utilisateur.pharmacy_id);

      if (error) {
        // Si la table n'existe pas encore
        if (error.code === '42P01') {
          setDbError('Table des paramètres non configurée');
          console.log('Table parametres_notifications non trouvée');
          return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        const settings = data[0];
        setNotifications({
          stock_bas: settings.stock_bas ?? true,
          produits_perimes: settings.produits_perimes ?? true,
          commandes_attente: settings.commandes_attente ?? true,
          inventaires_termines: settings.inventaires_termines ?? true,
          email_notifications: settings.email_notifications ?? false,
          sms_notifications: settings.sms_notifications ?? false,
        });
      } else {
        // Aucun paramètre trouvé, on garde les valeurs par défaut
        setDbError('Aucun paramètre trouvé, utilisation des valeurs par défaut');
      }
    } catch (error) {
      console.error('Erreur chargement paramètres notifications:', error);
      setDbError('Erreur lors du chargement des paramètres');
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
      // Vérifier d'abord si un enregistrement existe
      const { data: existingData } = await supabase
        .from('parametres_notifications')
        .select('id')
        .eq('pharmacy_id', utilisateur.pharmacy_id)
        .maybeSingle();

      let error;
      
      if (existingData) {
        // Mettre à jour l'enregistrement existant
        const { error: updateError } = await supabase
          .from('parametres_notifications')
          .update({
            ...notifications,
            updated_at: new Date().toISOString(),
          })
          .eq('pharmacy_id', utilisateur.pharmacy_id);
        
        error = updateError;
      } else {
        // Créer un nouvel enregistrement
        const { error: insertError } = await supabase
          .from('parametres_notifications')
          .insert({
            pharmacy_id: utilisateur.pharmacy_id,
            ...notifications,
          });
        
        error = insertError;
      }

      if (error) {
        if (error.code === '42P01') {
          setDbError('Table des paramètres non configurée dans la base de données');
          return;
        }
        throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setDbError('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const updateNotification = (key: string, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (utilisateur?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600">
          Seuls les administrateurs peuvent modifier les paramètres de notifications.
        </p>
      </div>
    );
  }

  if (initialLoad) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Paramètres de notifications</h3>
        <p className="text-blue-700 text-sm">
          Configurez les alertes et canaux de notification pour votre pharmacie.
        </p>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">Information</h4>
          <p className="text-yellow-700 text-sm">{dbError}</p>
          <p className="text-yellow-700 text-sm mt-1">
            Les modifications seront sauvegardées une fois la base de données configurée.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertes système
          </h3>
          
          {[
            { key: 'stock_bas', label: 'Stock bas', description: 'Alertes lorsque le stock est critique' },
            { key: 'produits_perimes', label: 'Produits périmés', description: 'Alertes pour produits proches de la date d\'expiration' },
            { key: 'commandes_attente', label: 'Commandes en attente', description: 'Notifications pour nouvelles commandes' },
            { key: 'inventaires_termines', label: 'Inventaires terminés', description: 'Alertes de fin d\'inventaire' },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={notifications[key as keyof typeof notifications]}
                  onChange={(e) => updateNotification(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Canaux de notification
          </h3>

          {[
            { key: 'email_notifications', label: 'Notifications email', icon: Mail },
            { key: 'sms_notifications', label: 'Notifications SMS', icon: MessageCircle },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <div className="flex items-center gap-3 flex-1">
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-600">
                    {key === 'email_notifications' 
                      ? 'Recevoir les alertes par email' 
                      : 'Recevoir les alertes par SMS'
                    }
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={notifications[key as keyof typeof notifications]}
                  onChange={(e) => updateNotification(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {saved && (
            <div className="flex items-center gap-2 text-emerald-600">
              <Save className="w-4 h-4" />
              Paramètres sauvegardés avec succès
            </div>
          )}
          {dbError && !saved && (
            <div className="text-amber-600">
              Les paramètres ne sont pas persistés: {dbError}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
