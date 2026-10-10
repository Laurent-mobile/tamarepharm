// src/components/clients/ClientsManager.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Shield, User, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalClient, LocalAssurance } from '../../lib/localDb';

export function ClientsManager() {
  const { utilisateur } = useAuth();
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [assurances, setAssurances] = useState<LocalAssurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LocalClient | null>(null);
  const [showAssuranceManager, setShowAssuranceManager] = useState(false);

  useEffect(() => {
    if (utilisateur) {
      loadData();
    }
  }, [utilisateur]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!utilisateur?.pharmacy_id) return;

      // ✅ LECTURE LOCALE INSTANTANÉE (Fonctionne hors-ligne)
      const [clientsData, assurancesData] = await Promise.all([
        repository.getClients(utilisateur.pharmacy_id),
        repository.getAssurances(utilisateur.pharmacy_id)
      ]);

      setClients(clientsData || []);
      setAssurances(assurancesData || []);
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    
    try {
      // ✅ SUPPRESSION LOCALE + MISE EN FILE D'ATTENTE DE SYNC
      await repository.deleteClient(clientId);
      await loadData(); // Rechargement instantané
    } catch (error: any) {
      console.error('❌ Erreur suppression client:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.nom_complet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telephone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.numero_assure?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showAssuranceManager) {
    return (
      <AssurancesManager
        assurances={assurances}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => {
          setShowAssuranceManager(false);
          loadData();
        }}
      />
    );
  }

  if (showForm) {
    return (
      <ClientForm
        client={selectedClient}
        assurances={assurances}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => {
          setShowForm(false);
          setSelectedClient(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Clients</h2>
          <p className="text-gray-600 mt-1">Liste des clients et leurs assurances</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAssuranceManager(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Shield className="w-5 h-5" />
            Gérer les Assurances
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nouveau Client
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
              placeholder="Rechercher par nom, téléphone ou numéro d'assuré..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">
              {searchTerm ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                Ajouter un client
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom Complet</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Téléphone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Assurance</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Taux</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Assuré</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const assurance = assurances.find(a => a.id === client.assurance_id);
                  return (
                    <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{client.nom_complet}</td>
                      <td className="py-3 px-4 text-gray-600">{client.telephone || '-'}</td>
                      <td className="py-3 px-4">
                        {assurance ? (
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            <span className="text-blue-700 font-medium">{assurance.nom}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Aucune</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {assurance ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            {assurance.taux_couverture}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                        {client.numero_assure || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedClient(client);
                              setShowForm(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteClient(client.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANTS SECONDAIRES (Formulaires)
// ==========================================

interface ClientFormProps {
  client: LocalClient | null;
  assurances: LocalAssurance[];
  pharmacyId: string;
  onClose: () => void;
}

function ClientForm({ client, assurances, pharmacyId, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    nom_complet: '',
    telephone: '',
    adresse: '',
    assurance_id: '',
    numero_assure: '',
  });
  const [loading, setLoading] = useState(false);
  const [showAssuranceForm, setShowAssuranceForm] = useState(false);
  
  // ✅ AMÉLIORATION UX : État pour la vérification en temps réel
  const [numeroAssureExiste, setNumeroAssureExiste] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setFormData({
        nom_complet: client.nom_complet,
        telephone: client.telephone || '',
        adresse: client.adresse || '',
        assurance_id: client.assurance_id || '',
        numero_assure: client.numero_assure || '',
      });
    }
  }, [client]);

  // ✅ Vérification asynchrone du numéro d'assuré en temps réel
  const verifierNumeroAssure = async (numero: string) => {
    const numeroTrimmed = numero.trim();
    if (!numeroTrimmed) {
      setNumeroAssureExiste(null);
      return;
    }
    
    const tousLesClients = await repository.getClients(pharmacyId);
    const doublon = tousLesClients.find(c => 
      c.numero_assure === numeroTrimmed && 
      c.id !== client?.id // Exclure le client en cours de modification
    );
    
    setNumeroAssureExiste(doublon ? doublon.nom_complet : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom_complet.trim()) {
      alert('Le nom complet est obligatoire');
      return;
    }

    const numeroAssureTrimmed = formData.numero_assure.trim();

    // ✅ BLOCAGE FINAL avant envoi si un doublon est détecté
    if (numeroAssureTrimmed && numeroAssureExiste) {
      alert(`⚠️ Ce numéro d'assuré est déjà utilisé par ${numeroAssureExiste}.\n\nChaque client doit avoir un numéro d'assuré unique.`);
      return;
    }

    setLoading(true);
    try {
      const data = {
        pharmacy_id: pharmacyId,
        nom_complet: formData.nom_complet.trim(),
        telephone: formData.telephone.trim() || null,
        adresse: formData.adresse.trim() || null,
        assurance_id: formData.assurance_id || null,
        numero_assure: numeroAssureTrimmed || null,
        actif: true,
      };

      if (client) {
        await repository.updateClient(client.id, data);
      } else {
        await repository.createClient(data);
      }
      onClose();
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde client:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showAssuranceForm) {
    return (
      <AssuranceForm
        pharmacyId={pharmacyId}
        onClose={() => {
          setShowAssuranceForm(false);
          onClose(); // Le parent rechargera les données
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          {client ? 'Modifier le Client' : 'Nouveau Client'}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <Plus className="w-6 h-6 text-gray-600 rotate-45" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
              <input
                type="text"
                value={formData.nom_complet}
                onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assurance</label>
                <select
                  value={formData.assurance_id}
                  onChange={(e) => setFormData({ ...formData, assurance_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Aucune assurance</option>
                  {assurances.map((assurance) => (
                    <option key={assurance.id} value={assurance.id}>
                      {assurance.nom} ({assurance.taux_couverture}%)
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowAssuranceForm(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                title="Ajouter une nouvelle assurance"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro d'assuré</label>
              <input
                type="text"
                value={formData.numero_assure}
                onChange={(e) => {
                  setFormData({ ...formData, numero_assure: e.target.value });
                  verifierNumeroAssure(e.target.value); // ✅ Déclenche la vérification en temps réel
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 transition-colors ${
                  numeroAssureExiste 
                    ? 'border-red-500 bg-red-50 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
                placeholder="Ex: ASS-123456"
              />
              
              {/* ✅ ALERTE UX EN TEMPS RÉEL */}
              {numeroAssureExiste && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800 text-sm">
                    Ce numéro est déjà utilisé par <strong>{numeroAssureExiste}</strong>. Veuillez en saisir un autre.
                  </p>
                </div>
              )}
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
              disabled={loading || !!numeroAssureExiste}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                client ? 'Modifier' : 'Créer le client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANTS D'ASSURANCE (Intégrés pour simplicité)
// ==========================================

interface AssuranceFormProps {
  pharmacyId: string;
  onClose: () => void;
}

function AssuranceForm({ pharmacyId, onClose }: AssuranceFormProps) {
  const [formData, setFormData] = useState({ nom: '', taux_couverture: '', telephone: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.taux_couverture) {
      alert('Le nom et le taux de couverture sont obligatoires');
      return;
    }

    const taux = parseFloat(formData.taux_couverture);
    if (taux < 0 || taux > 100) {
      alert('Le taux de couverture doit être compris entre 0 et 100%');
      return;
    }

    setLoading(true);
    try {
      await repository.createAssurance({
        pharmacy_id: pharmacyId,
        nom: formData.nom.trim(),
        taux_couverture: taux,
        telephone: formData.telephone.trim() || null,
        email: formData.email.trim() || null,
        actif: true,
      });
      onClose();
    } catch (error: any) {
      console.error('❌ Erreur création assurance:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Nouvelle Assurance</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <Plus className="w-6 h-6 text-gray-600 rotate-45" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'assurance *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Taux de couverture (%) *</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.taux_couverture}
                onChange={(e) => setFormData({ ...formData, taux_couverture: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Création...' : 'Créer l\'assurance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AssurancesManagerProps {
  assurances: LocalAssurance[];
  pharmacyId: string;
  onClose: () => void;
}

function AssurancesManager({ assurances, pharmacyId, onClose }: AssurancesManagerProps) {
  const [showForm, setShowForm] = useState(false);

  const toggleAssuranceStatus = async (assurance: LocalAssurance) => {
    try {
      await repository.updateAssurance(assurance.id, { actif: !assurance.actif });
      onClose(); 
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const deleteAssurance = async (assurance: LocalAssurance) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'assurance "${assurance.nom}" ?`)) return;
    try {
      await repository.deleteAssurance(assurance.id);
      onClose();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  if (showForm) {
    return <AssuranceForm pharmacyId={pharmacyId} onClose={() => { setShowForm(false); onClose(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Assurances</h2>
          <p className="text-gray-600 mt-1">Configuration des assurances et taux de couverture</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            Retour aux clients
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-5 h-5" />
            Nouvelle Assurance
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Taux</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assurances.map((assurance) => (
                <tr key={assurance.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{assurance.nom}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      {assurance.taux_couverture}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm">
                    <div>{assurance.telephone || '-'}</div>
                    <div>{assurance.email || '-'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${assurance.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {assurance.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleAssuranceStatus(assurance)}
                        className={`px-3 py-1 text-xs rounded-lg transition ${assurance.actif ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                      >
                        {assurance.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={() => deleteAssurance(assurance)} className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-lg hover:bg-red-200 transition">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assurances.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucune assurance configurée</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Ajouter une assurance
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
