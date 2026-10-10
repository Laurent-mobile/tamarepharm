// components/settings/UsersManager.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Mail, Phone, User, Shield, Save, X, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Utilisateur {
  id: string;
  pharmacy_id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  role: 'admin' | 'pharmacien' | 'vendeur' | 'caissier';
  actif: boolean;
  created_at: string;
}

interface NouvelUtilisateur {
  email: string;
  nom_complet: string;
  telephone: string;
  role: 'admin' | 'pharmacien' | 'vendeur' | 'caissier';
  actif: boolean;
  password: string;
}

export function UsersManager() {
  const { utilisateur } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Utilisateur | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [nouvelUtilisateur, setNouvelUtilisateur] = useState<NouvelUtilisateur>({
    email: '',
    nom_complet: '',
    telephone: '',
    role: 'vendeur',
    actif: true,
    password: 'Pharmacie2024!'
  });

  useEffect(() => {
    if (utilisateur?.role === 'admin') {
      loadUtilisateurs();
    }
  }, [utilisateur]);

  const loadUtilisateurs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('pharmacy_id', utilisateur?.pharmacy_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUtilisateurs(data || []);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      setMessage({type: 'error', text: 'Erreur lors du chargement des utilisateurs'});
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!utilisateur || utilisateur.role !== 'admin') {
      setMessage({type: 'error', text: 'Seul un administrateur peut ajouter des utilisateurs'});
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Vérifier si l'utilisateur existe déjà dans notre table
      const { data: existingUser } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('email', nouvelUtilisateur.email)
        .eq('pharmacy_id', utilisateur.pharmacy_id)
        .single();

      if (existingUser) {
        setMessage({type: 'error', text: 'Un utilisateur avec cet email existe déjà dans cette pharmacie'});
        return;
      }

      // Créer l'utilisateur avec email confirmé automatiquement
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: nouvelUtilisateur.email,
        password: nouvelUtilisateur.password,
        options: {
          data: {
            nom_complet: nouvelUtilisateur.nom_complet,
            role: nouvelUtilisateur.role,
            pharmacy_id: utilisateur.pharmacy_id
          }
        }
      });

      if (signUpError) {
        // Si l'utilisateur existe déjà dans auth, essayer de se connecter
        if (signUpError.message.includes('already registered')) {
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: nouvelUtilisateur.email,
              password: nouvelUtilisateur.password
            });

            if (signInError) {
              // Si la connexion échoue, envoyer un reset password
              const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                nouvelUtilisateur.email,
                { redirectTo: `${window.location.origin}/reset-password` }
              );

              if (resetError) throw resetError;

              // Ajouter avec email seulement (l'ID sera mis à jour plus tard)
              const { error: insertError } = await supabase
                .from('utilisateurs')
                .insert({
                  email: nouvelUtilisateur.email,
                  pharmacy_id: utilisateur.pharmacy_id,
                  nom_complet: nouvelUtilisateur.nom_complet,
                  role: nouvelUtilisateur.role,
                  telephone: nouvelUtilisateur.telephone,
                  actif: nouvelUtilisateur.actif
                });

              if (insertError) throw insertError;

              setMessage({type: 'success', text: 'Utilisateur ajouté! Un email de réinitialisation a été envoyé.'});
            } else if (signInData.user) {
              // Ajouter l'utilisateur existant
              const { error: insertError } = await supabase
                .from('utilisateurs')
                .insert({
                  id: signInData.user.id,
                  pharmacy_id: utilisateur.pharmacy_id,
                  nom_complet: nouvelUtilisateur.nom_complet,
                  role: nouvelUtilisateur.role,
                  telephone: nouvelUtilisateur.telephone,
                  actif: nouvelUtilisateur.actif
                });

              if (insertError) throw insertError;

              setMessage({type: 'success', text: 'Utilisateur existant ajouté avec succès!'});
            }
          } catch (nestedError: any) {
            throw new Error('Erreur avec utilisateur existant: ' + nestedError.message);
          }
        } else {
          throw signUpError;
        }
      } else if (authData?.user) {
        // Nouvel utilisateur créé avec succès
        const { error: insertError } = await supabase
          .from('utilisateurs')
          .insert({
            id: authData.user.id,
            pharmacy_id: utilisateur.pharmacy_id,
            nom_complet: nouvelUtilisateur.nom_complet,
            role: nouvelUtilisateur.role,
            telephone: nouvelUtilisateur.telephone,
            actif: nouvelUtilisateur.actif
          });

        if (insertError) throw insertError;

        setMessage({type: 'success', text: 'Utilisateur créé avec succès! Le compte est activé et prêt à être utilisé.'});
      }

      // RÉINITIALISER LE FORMULAIRE SANS FERMER
      setNouvelUtilisateur({
        email: '',
        nom_complet: '',
        telephone: '',
        role: 'vendeur',
        actif: true,
        password: 'Pharmacie2024!'
      });

      // Recharger la liste
      await loadUtilisateurs();

    } catch (error: any) {
      console.error('Erreur ajout utilisateur:', error);
      
      if (error.message.includes('already registered')) {
        setMessage({type: 'error', text: 'Cet email est déjà utilisé dans le système.'});
      } else if (error.message.includes('password')) {
        setMessage({type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères'});
      } else {
        setMessage({type: 'error', text: 'Erreur: ' + error.message});
      }
    } finally {
      setSaving(false);
    }
  };

  const fermerFormulaire = () => {
    setShowForm(false);
    setEditingUser(null);
    setNouvelUtilisateur({
      email: '',
      nom_complet: '',
      telephone: '',
      role: 'vendeur',
      actif: true,
      password: 'Pharmacie2024!'
    });
    setMessage(null);
  };

  const handleEdit = async (user: Utilisateur) => {
    setEditingUser(user);
    setNouvelUtilisateur({
      email: user.email,
      nom_complet: user.nom_complet,
      telephone: user.telephone,
      role: user.role,
      actif: user.actif,
      password: ''
    });
    setMessage(null);
    setShowForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({
          nom_complet: nouvelUtilisateur.nom_complet,
          telephone: nouvelUtilisateur.telephone,
          role: nouvelUtilisateur.role,
          actif: nouvelUtilisateur.actif
        })
        .eq('id', editingUser.id)
        .eq('pharmacy_id', utilisateur?.pharmacy_id);

      if (error) throw error;

      setMessage({type: 'success', text: 'Utilisateur modifié avec succès!'});
      await loadUtilisateurs();
      
      // Fermer le formulaire après modification
      fermerFormulaire();

    } catch (error: any) {
      console.error('Erreur modification utilisateur:', error);
      setMessage({type: 'error', text: 'Erreur: ' + error.message});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: Utilisateur) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver l'utilisateur "${user.nom_complet}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ actif: false })
        .eq('id', user.id)
        .eq('pharmacy_id', utilisateur?.pharmacy_id);

      if (error) throw error;

      setMessage({type: 'success', text: 'Utilisateur désactivé avec succès'});
      await loadUtilisateurs();

    } catch (error: any) {
      console.error('Erreur désactivation utilisateur:', error);
      setMessage({type: 'error', text: 'Erreur: ' + error.message});
    }
  };

  const reactiverUtilisateur = async (user: Utilisateur) => {
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ actif: true })
        .eq('id', user.id)
        .eq('pharmacy_id', utilisateur?.pharmacy_id);

      if (error) throw error;

      setMessage({type: 'success', text: 'Utilisateur réactivé avec succès'});
      await loadUtilisateurs();

    } catch (error: any) {
      console.error('Erreur réactivation utilisateur:', error);
      setMessage({type: 'error', text: 'Erreur: ' + error.message});
    }
  };

  const reinitialiserMotDePasse = async (user: Utilisateur) => {
    if (!confirm(`Envoyer un email de réinitialisation de mot de passe à ${user.nom_complet} ?`)) {
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage({type: 'success', text: 'Email de réinitialisation envoyé avec succès!'});
    } catch (error: any) {
      console.error('Erreur envoi email réinitialisation:', error);
      setMessage({type: 'error', text: 'Erreur: ' + error.message});
    }
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      pharmacien: 'bg-blue-100 text-blue-800',
      vendeur: 'bg-green-100 text-green-800',
      caissier: 'bg-orange-100 text-orange-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      admin: 'Administrateur',
      pharmacien: 'Pharmacien',
      vendeur: 'Vendeur/Auxiliaire',
      caissier: 'Caissier',
    };
    return labels[role] || role;
  };

  if (utilisateur?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600">
          Seuls les administrateurs peuvent gérer les utilisateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h2>
          <p className="text-gray-600">Ajoutez et gérez les utilisateurs de votre pharmacie</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setNouvelUtilisateur({
              email: '',
              nom_complet: '',
              telephone: '',
              role: 'vendeur',
              actif: true,
              password: 'Pharmacie2024!'
            });
            setMessage(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nouvel Utilisateur
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout/modification */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel Utilisateur'}
            </h3>
            <button
              onClick={fermerFormulaire}
              className="text-gray-400 hover:text-gray-600"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={editingUser ? handleUpdate : handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={nouvelUtilisateur.nom_complet}
                  onChange={(e) => setNouvelUtilisateur(prev => ({
                    ...prev,
                    nom_complet: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={nouvelUtilisateur.email}
                  onChange={(e) => setNouvelUtilisateur(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="john@example.com"
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">
                    L'email ne peut pas être modifié
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={nouvelUtilisateur.telephone}
                  onChange={(e) => setNouvelUtilisateur(prev => ({
                    ...prev,
                    telephone: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+226 XX XX XX XX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle *
                </label>
                <select
                  value={nouvelUtilisateur.role}
                  onChange={(e) => setNouvelUtilisateur(prev => ({
                    ...prev,
                    role: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="vendeur">Vendeur/Auxiliaire</option>
                  <option value="pharmacien">Pharmacien</option>
                  <option value="caissier">Caissier</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {!editingUser && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe temporaire *
                  </label>
                  <input
                    type="text"
                    required
                    value={nouvelUtilisateur.password}
                    onChange={(e) => setNouvelUtilisateur(prev => ({
                      ...prev,
                      password: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Mot de passe temporaire"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    L'utilisateur pourra utiliser ce mot de passe pour se connecter immédiatement
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="actif"
                checked={nouvelUtilisateur.actif}
                onChange={(e) => setNouvelUtilisateur(prev => ({
                  ...prev,
                  actif: e.target.checked
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="actif" className="text-sm text-gray-700">
                Compte actif
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : (editingUser ? 'Modifier' : 'Ajouter l\'utilisateur')}
              </button>
              
              <button
                type="button"
                onClick={fermerFormulaire}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Fermer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : utilisateurs.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
            <p className="text-gray-400 text-sm mt-2">
              Commencez par ajouter votre premier utilisateur
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Utilisateur</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rôle</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date création</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{user.nom_complet}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {user.email}
                      </div>
                      {user.telephone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Phone className="w-4 h-4" />
                          {user.telephone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.actif 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1 text-blue-600 hover:text-blue-800 transition"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => reinitialiserMotDePasse(user)}
                          className="p-1 text-orange-600 hover:text-orange-800 transition"
                          title="Réinitialiser mot de passe"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        
                        {user.actif ? (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1 text-red-600 hover:text-red-800 transition"
                            title="Désactiver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => reactiverUtilisateur(user)}
                            className="p-1 text-green-600 hover:text-green-800 transition"
                            title="Réactiver"
                          >
                            <User className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Informations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Informations importantes</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Les nouveaux utilisateurs peuvent se connecter immédiatement sans confirmation email</li>
          <li>• Le formulaire reste ouvert après création pour ajouter plusieurs utilisateurs</li>
          <li>• Utilisez "Réinitialiser mot de passe" pour envoyer un lien de récupération</li>
          <li>• La désactivation empêche la connexion sans supprimer les données</li>
        </ul>
      </div>
    </div>
  );
}
