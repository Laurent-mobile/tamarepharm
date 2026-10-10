//src/components/suppliers/SuppliersManager.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Fournisseur } from '../../types/database';

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Fournisseur | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    telephone: '',
    email: '',
    adresse: '',
    agrement: '',
    actif: true
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .order('nom');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      contact: '',
      telephone: '',
      email: '',
      adresse: '',
      agrement: '',
      actif: true
    });
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom.trim()) {
      alert('Le nom du fournisseur est obligatoire');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .insert([{
          nom: formData.nom.trim(),
          contact: formData.contact.trim() || null,
          telephone: formData.telephone.trim() || null,
          email: formData.email.trim() || null,
          adresse: formData.adresse.trim() || null,
          agrement: formData.agrement.trim() || null,
          actif: formData.actif
        }])
        .select()
        .single();

      if (error) throw error;

      setSuppliers(prev => [data, ...prev]);
      setShowAddForm(false);
      resetForm();
      alert('Fournisseur ajouté avec succès!');
    } catch (error: any) {
      console.error('Erreur ajout fournisseur:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingSupplier || !formData.nom.trim()) {
      alert('Le nom du fournisseur est obligatoire');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .update({
          nom: formData.nom.trim(),
          contact: formData.contact.trim() || null,
          telephone: formData.telephone.trim() || null,
          email: formData.email.trim() || null,
          adresse: formData.adresse.trim() || null,
          agrement: formData.agrement.trim() || null,
          actif: formData.actif,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSupplier.id)
        .select()
        .single();

      if (error) throw error;

      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? data : s));
      setEditingSupplier(null);
      resetForm();
      alert('Fournisseur modifié avec succès!');
    } catch (error: any) {
      console.error('Erreur modification fournisseur:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const handleDeleteSupplier = async (supplier: Fournisseur) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.nom}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fournisseurs')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;

      setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      alert('Fournisseur supprimé avec succès!');
    } catch (error: any) {
      console.error('Erreur suppression fournisseur:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const startEdit = (supplier: Fournisseur) => {
    setEditingSupplier(supplier);
    setFormData({
      nom: supplier.nom || '',
      contact: supplier.contact || '',
      telephone: supplier.telephone || '',
      email: supplier.email || '',
      adresse: supplier.adresse || '',
      agrement: supplier.agrement || '',
      actif: supplier.actif ?? true
    });
  };

  const cancelEdit = () => {
    setEditingSupplier(null);
    resetForm();
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    resetForm();
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.telephone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestion des Fournisseurs</h2>
          <p className="text-gray-600 mt-1">Fournisseurs agréés</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nouveau Fournisseur
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Nouveau Fournisseur</h3>
          <SupplierForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddSupplier}
            onCancel={cancelAdd}
            submitLabel="Ajouter"
          />
        </div>
      )}

      {/* Formulaire d'édition */}
      {editingSupplier && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Modifier le fournisseur
          </h3>
          <SupplierForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditSupplier}
            onCancel={cancelEdit}
            submitLabel="Modifier"
          />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un fournisseur..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900">{supplier.nom}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => startEdit(supplier)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {supplier.contact && <p>Contact: {supplier.contact}</p>}
                  {supplier.telephone && <p>Tél: {supplier.telephone}</p>}
                  {supplier.email && <p>Email: {supplier.email}</p>}
                  {supplier.adresse && <p>Adresse: {supplier.adresse}</p>}
                  {supplier.agrement && (
                    <p className="text-xs text-emerald-600 font-medium mt-2">
                      Agrément: {supplier.agrement}
                    </p>
                  )}
                </div>
                
                <div className="mt-3 flex justify-between items-center">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    supplier.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {supplier.actif ? 'Actif' : 'Inactif'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(supplier.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Composant formulaire réutilisable
interface SupplierFormProps {
  formData: {
    nom: string;
    contact: string;
    telephone: string;
    email: string;
    adresse: string;
    agrement: string;
    actif: boolean;
  };
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}

function SupplierForm({ formData, setFormData, onSubmit, onCancel, submitLabel }: SupplierFormProps) {
  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom du fournisseur *
          </label>
          <input
            type="text"
            value={formData.nom}
            onChange={(e) => updateField('nom', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Nom de l'entreprise"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personne à contacter
          </label>
          <input
            type="text"
            value={formData.contact}
            onChange={(e) => updateField('contact', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Nom du contact"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléphone
          </label>
          <input
            type="tel"
            value={formData.telephone}
            onChange={(e) => updateField('telephone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="+226 XX XX XX XX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="contact@entreprise.bf"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adresse
          </label>
          <textarea
            value={formData.adresse}
            onChange={(e) => updateField('adresse', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Adresse complète"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numéro d'agrément
          </label>
          <input
            type="text"
            value={formData.agrement}
            onChange={(e) => updateField('agrement', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="N° d'agrément"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statut
          </label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="actif"
              checked={formData.actif}
              onChange={(e) => updateField('actif', e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="actif" className="text-sm text-gray-700">
              Fournisseur actif
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          <X className="w-4 h-4" />
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          <Save className="w-4 h-4" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
