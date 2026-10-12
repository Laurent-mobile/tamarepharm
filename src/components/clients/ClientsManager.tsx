import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Shield, User, AlertTriangle, CreditCard, FileText, Gift, Building2, Filter, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';
import { LocalClient, LocalAssurance } from '../../lib/localDb';

export function ClientsManager() {
  const { utilisateur } = useAuth();
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [assurances, setAssurances] = useState<LocalAssurance[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États des filtres avancés
  const [filterText, setFilterText] = useState('');
  const [filterEntreprise, setFilterEntreprise] = useState('');
  const [filterAssuranceId, setFilterAssuranceId] = useState('');
  const [filterBon, setFilterBon] = useState(false);
  const [filterCredit, setFilterCredit] = useState(false);
  const [filterAvoir, setFilterAvoir] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LocalClient | null>(null);
  const [showAssuranceManager, setShowAssuranceManager] = useState(false);

  useEffect(() => {
    if (utilisateur) loadData();
  }, [utilisateur]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!utilisateur?.pharmacy_id) return;
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
      await repository.deleteClient(clientId);
      await loadData();
    } catch (error: any) {
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  const resetFilters = () => {
    setFilterText('');
    setFilterEntreprise('');
    setFilterAssuranceId('');
    setFilterBon(false);
    setFilterCredit(false);
    setFilterAvoir(false);
  };

  // Liste dynamique des entreprises présentes dans la base pour le filtre
  const uniqueEnterprises = useMemo(() => {
    return Array.from(new Set(clients.map(c => c.entreprise).filter(Boolean))) as string[];
  }, [clients]);

  // Logique de filtrage combinée
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const searchLower = filterText.toLowerCase();
      const matchText = !filterText || 
        c.nom_complet.toLowerCase().includes(searchLower) ||
        c.matricule?.toLowerCase().includes(searchLower) ||
        c.telephone?.toLowerCase().includes(searchLower) ||
        c.numero_assure?.toLowerCase().includes(searchLower);

      const matchEntreprise = !filterEntreprise || c.entreprise === filterEntreprise;
      const matchAssurance = !filterAssuranceId || c.assurance_id === filterAssuranceId;
      
      const matchBon = !filterBon || c.autorise_bon === true;
      const matchCredit = !filterCredit || c.autorise_credit === true;
      const matchAvoir = !filterAvoir || c.autorise_avoir === true;

      return matchText && matchEntreprise && matchAssurance && matchBon && matchCredit && matchAvoir;
    });
  }, [clients, filterText, filterEntreprise, filterAssuranceId, filterBon, filterCredit, filterAvoir]);

  const isFilterActive = filterText || filterEntreprise || filterAssuranceId || filterBon || filterCredit || filterAvoir;

  if (showAssuranceManager) {
    return (
      <AssurancesManager
        assurances={assurances}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => { setShowAssuranceManager(false); loadData(); }}
      />
    );
  }

  if (showForm) {
    return (
      <ClientForm
        client={selectedClient}
        assurances={assurances}
        pharmacyId={utilisateur!.pharmacy_id}
        onClose={() => { setShowForm(false); setSelectedClient(null); loadData(); }}
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Clients</h2>
          <p className="text-gray-600 mt-1">Liste des clients, structures et autorisations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAssuranceManager(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Shield className="w-5 h-5" /> Assurances
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
            <Plus className="w-5 h-5" /> Nouveau Client
          </button>
        </div>
      </div>

      {/* PANNEAU DE FILTRES AVANCÉS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres avancés
          </h3>
          {isFilterActive && (
            <button onClick={resetFilters} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium">
              <X className="w-3 h-3" /> Réinitialiser les filtres
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Recherche textuelle */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Nom, matricule, téléphone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* 2. Filtre Entreprise */}
          <div>
            <select
              value={filterEntreprise}
              onChange={(e) => setFilterEntreprise(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">Toutes les entreprises</option>
              {uniqueEnterprises.map(entreprise => (
                <option key={entreprise} value={entreprise}>{entreprise}</option>
              ))}
            </select>
          </div>

          {/* 3. Filtre Assurance */}
          <div>
            <select
              value={filterAssuranceId}
              onChange={(e) => setFilterAssuranceId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">Toutes les assurances</option>
              {assurances.map(assurance => (
                <option key={assurance.id} value={assurance.id}>{assurance.nom}</option>
              ))}
            </select>
          </div>

          {/* 4. Filtre Types d'opérations (Checkboxes) */}
          <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
            <label className="flex items-center gap-1.5 cursor-pointer" title="Autorise le Bon">
              <input type="checkbox" checked={filterBon} onChange={(e) => setFilterBon(e.target.checked)} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4" />
              <FileText className="w-4 h-4 text-purple-600" />
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Autorise le Crédit">
              <input type="checkbox" checked={filterCredit} onChange={(e) => setFilterCredit(e.target.checked)} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-4 h-4" />
              <CreditCard className="w-4 h-4 text-amber-600" />
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Autorise l'Avoir">
              <input type="checkbox" checked={filterAvoir} onChange={(e) => setFilterAvoir(e.target.checked)} className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4" />
              <Gift className="w-4 h-4 text-green-600" />
            </label>
          </div>
        </div>
      </div>

      {/* TABLEAU DES RÉSULTATS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredClients.length}</span> client(s) trouvé(s)
            {isFilterActive && <span className="text-emerald-600 font-medium"> (filtré(s))</span>}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun client ne correspond à ces critères</p>
            {isFilterActive && (
              <button onClick={resetFilters} className="mt-2 text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                Effacer les filtres pour tout voir
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Matricule</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Nom Complet</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Entreprise / Structure</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Téléphone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Type de Client</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Assurance / Taux</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const assurance = assurances.find(a => a.id === client.assurance_id);
                  return (
                    <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-sm text-gray-600">{client.matricule || <span className="text-gray-300">-</span>}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{client.nom_complet}</td>
                      <td className="py-3 px-4">
                        {client.entreprise ? (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate" title={client.entreprise}>{client.entreprise}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm italic">Particulier</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{client.telephone || <span className="text-gray-300">-</span>}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {client.autorise_bon && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1"><FileText className="w-3 h-3"/> Bon</span>}
                          {client.autorise_credit && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1"><CreditCard className="w-3 h-3"/> Crédit</span>}
                          {client.autorise_avoir && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1"><Gift className="w-3 h-3"/> Avoir</span>}
                          {!client.autorise_bon && !client.autorise_credit && !client.autorise_avoir && <span className="text-gray-400 text-xs">Aucune</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {assurance ? (
                          <div className="flex flex-col">
                            <span className="text-blue-700 font-medium text-sm">{assurance.nom}</span>
                            <span className="text-xs text-gray-500">Taux: {client.taux_couverture || assurance.taux_couverture}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Aucune</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setSelectedClient(client); setShowForm(true); }} className="inline-flex items-center gap-1 p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteClient(client.id)} className="inline-flex items-center gap-1 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer">
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
// COMPOSANT FORMULAIRE CLIENT
// ==========================================
interface ClientFormProps {
  client: LocalClient | null;
  assurances: LocalAssurance[];
  pharmacyId: string;
  onClose: () => void;
}

function ClientForm({ client, assurances, pharmacyId, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    matricule: '',
    entreprise: '', // ✅ NOUVEAU
    nom_complet: '',
    telephone: '',
    adresse: '',
    assurance_id: '',
    taux_couverture: '',
    numero_assure: '',
    autorise_bon: false,
    autorise_credit: false,
    autorise_avoir: false,
    plafond_credit: 0,
  });
  
  const [loading, setLoading] = useState(false);
  const [showAssuranceForm, setShowAssuranceForm] = useState(false);
  const [matriculeExiste, setMatriculeExiste] = useState<string | null>(null);
  const [numeroAssureExiste, setNumeroAssureExiste] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setFormData({
        matricule: client.matricule || '',
        entreprise: client.entreprise || '', // ✅ NOUVEAU
        nom_complet: client.nom_complet,
        telephone: client.telephone || '',
        adresse: client.adresse || '',
        assurance_id: client.assurance_id || '',
        taux_couverture: client.taux_couverture ? client.taux_couverture.toString() : '',
        numero_assure: client.numero_assure || '',
        autorise_bon: client.autorise_bon || false,
        autorise_credit: client.autorise_credit || false,
        autorise_avoir: client.autorise_avoir || false,
        plafond_credit: client.plafond_credit || 0,
      });
    }
  }, [client]);

  const verifierDoublon = async (champ: 'matricule' | 'numero_assure', valeur: string) => {
    const valeurTrimmed = valeur.trim();
    if (!valeurTrimmed) {
      champ === 'matricule' ? setMatriculeExiste(null) : setNumeroAssureExiste(null);
      return;
    }
    const tousLesClients = await repository.getClients(pharmacyId);
    const doublon = tousLesClients.find(c => c[champ] === valeurTrimmed && c.id !== client?.id);
    if (champ === 'matricule') setMatriculeExiste(doublon ? doublon.nom_complet : null);
    else setNumeroAssureExiste(doublon ? doublon.nom_complet : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom_complet.trim()) {
      alert('Le nom complet est obligatoire');
      return;
    }
    if (matriculeExiste) {
      alert(`⚠️ Ce matricule est déjà utilisé par ${matriculeExiste}.`);
      return;
    }
    if (formData.numero_assure.trim() && numeroAssureExiste) {
      alert(`⚠️ Ce numéro d'assuré est déjà utilisé par ${numeroAssureExiste}.`);
      return;
    }

    setLoading(true);
    try {
      const data = {
        pharmacy_id: pharmacyId,
        matricule: formData.matricule.trim() || null,
        entreprise: formData.entreprise.trim() || null, // ✅ NOUVEAU
        nom_complet: formData.nom_complet.trim(),
        telephone: formData.telephone.trim() || null,
        adresse: formData.adresse.trim() || null,
        assurance_id: formData.assurance_id || null,
        taux_couverture: formData.taux_couverture ? parseFloat(formData.taux_couverture) : null,
        numero_assure: formData.numero_assure.trim() || null,
        autorise_bon: formData.autorise_bon,
        autorise_credit: formData.autorise_credit,
        autorise_avoir: formData.autorise_avoir,
        plafond_credit: formData.autorise_credit ? (parseFloat(formData.plafond_credit.toString()) || 0) : 0,
        actif: true,
      };

      if (client) await repository.updateClient(client.id, data);
      else await repository.createClient(data);
      
      onClose();
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde client:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showAssuranceForm) {
    return <AssuranceForm pharmacyId={pharmacyId} onClose={() => { setShowAssuranceForm(false); onClose(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">{client ? 'Modifier le Client' : 'Nouveau Client'}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition"><Plus className="w-6 h-6 text-gray-600 rotate-45" /></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Identité et Structure */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">1. Informations d'identité</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matricule Client *</label>
                <input
                  type="text"
                  value={formData.matricule}
                  onChange={(e) => { setFormData({ ...formData, matricule: e.target.value }); verifierDoublon('matricule', e.target.value); }}
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${matriculeExiste ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Ex: MAT-2024-001"
                />
                {matriculeExiste && <p className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Déjà utilisé par {matriculeExiste}</p>}
              </div>
              
              {/* ✅ NOUVEAU CHAMP ENTREPRISE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Entreprise / Structure d'appartenance</label>
                <input
                  type="text"
                  value={formData.entreprise}
                  onChange={(e) => setFormData({ ...formData, entreprise: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: SONABEL, Ministère de la Santé, Particulier..."
                />
                <p className="text-xs text-gray-500 mt-1">La société où le client travaille (distincte de son assurance).</p>
              </div>

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
                <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                <input type="text" value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>

          {/* Section 2: Assurance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">2. Informations d'assurance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Société d'assurance</label>
                  <select
                    value={formData.assurance_id}
                    onChange={(e) => setFormData({ ...formData, assurance_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Aucune assurance</option>
                    {assurances.map((assurance) => (
                      <option key={assurance.id} value={assurance.id}>
                        {assurance.nom} {assurance.sous_societe ? `(${assurance.sous_societe})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => setShowAssuranceForm(true)} className="px-3 py-2 mb-0.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" title="Ajouter une nouvelle assurance">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Taux de couverture personnel (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.taux_couverture}
                  onChange={(e) => setFormData({ ...formData, taux_couverture: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Laisser vide pour utiliser le taux par défaut"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro d'assuré</label>
                <input
                  type="text"
                  value={formData.numero_assure}
                  onChange={(e) => { setFormData({ ...formData, numero_assure: e.target.value }); verifierDoublon('numero_assure', e.target.value); }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${numeroAssureExiste ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Ex: ASS-123456"
                />
                {numeroAssureExiste && <p className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Déjà utilisé par {numeroAssureExiste}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Autorisations */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">3. Autorisations d'opérations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-purple-50 transition">
                <input type="checkbox" checked={formData.autorise_bon} onChange={(e) => setFormData({ ...formData, autorise_bon: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-600"/> Autoriser "Bon"</p>
                  <p className="text-xs text-gray-500">Le client peut payer via des bons émis par sa société.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-amber-50 transition">
                <input type="checkbox" checked={formData.autorise_credit} onChange={(e) => setFormData({ ...formData, autorise_credit: e.target.checked, plafond_credit: e.target.checked ? formData.plafond_credit : 0 })} className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-600"/> Autoriser "Crédit"</p>
                  <p className="text-xs text-gray-500">Le client peut acheter à crédit (30 jours).</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 transition">
                <input type="checkbox" checked={formData.autorise_avoir} onChange={(e) => setFormData({ ...formData, autorise_avoir: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2"><Gift className="w-4 h-4 text-green-600"/> Autoriser "Avoir"</p>
                  <p className="text-xs text-gray-500">Le client peut utiliser un solde d'avoir en espèces.</p>
                </div>
              </label>
            </div>

            {formData.autorise_credit && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-medium text-amber-900 mb-2">Plafond de crédit autorisé (FCFA) *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.plafond_credit}
                  onChange={(e) => setFormData({ ...formData, plafond_credit: parseFloat(e.target.value) || 0 })}
                  required={formData.autorise_credit}
                  className="w-full md:w-1/2 px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="Ex: 500000"
                />
                <p className="text-xs text-amber-700 mt-2">Le système bloquera les nouvelles ventes à crédit si le total des dettes atteint ce montant.</p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Annuler</button>
            <button
              type="submit"
              disabled={loading || !!matriculeExiste || !!numeroAssureExiste}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {loading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Enregistrement...</>) : (client ? 'Modifier le client' : 'Créer le client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANTS D'ASSURANCE
// ==========================================

interface AssuranceFormProps {
  pharmacyId: string;
  onClose: () => void;
}

function AssuranceForm({ pharmacyId, onClose }: AssuranceFormProps) {
  const [formData, setFormData] = useState({ nom: '', sous_societe: '', taux_couverture: '', telephone: '', email: '' });
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
        sous_societe: formData.sous_societe.trim() || null,
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la société d'assurance *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: UAB, CNSS, MUGEFA"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sous-société / Employeur (Optionnel)</label>
              <input
                type="text"
                value={formData.sous_societe}
                onChange={(e) => setFormData({ ...formData, sous_societe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: SONABEL, Ministère de la Santé..."
              />
              <p className="text-xs text-gray-500 mt-1">Utile pour regrouper les employés d'une même grande structure ayant des assurances différentes.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Taux de couverture par défaut (%) *</label>
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
              <p className="text-xs text-gray-500 mt-1">Ce taux peut être écrasé individuellement pour chaque client.</p>
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
          <p className="text-gray-600 mt-1">Configuration des sociétés, sous-sociétés et taux de couverture</p>
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
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Société</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sous-société</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Taux par défaut</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assurances.map((assurance) => (
                <tr key={assurance.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{assurance.nom}</td>
                  <td className="py-3 px-4 text-gray-600">{assurance.sous_societe || '-'}</td>
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
