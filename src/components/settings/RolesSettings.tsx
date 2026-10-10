// src/components/settings/RolesSettings.tsx - Version mise à jour
import { useState, useEffect } from 'react';
import { Save, CheckCircle, XCircle, Shield, Warehouse, ArrowLeftRight, ClipboardList, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface RolePermissions {
  [key: string]: {
    dashboard: boolean;
    products: boolean;
    stock: boolean;
    stock_magasin: boolean;      // Nouveau: Stock par magasin
    sales: boolean;
    sales_history: boolean;
    paiements_assurances: boolean;
    clients: boolean;
    suppliers: boolean;
    orders: boolean;
    transfers: boolean;           // Transferts entre magasins
    inventory: boolean;
    inventory_magasin: boolean;   // Nouveau: Inventaires par magasin
    magasins: boolean;            // Nouveau: Gestion des magasins
    settings: boolean;
  };
}

const defaultPermissions: RolePermissions = {
  admin: {
    dashboard: true,
    products: true,
    stock: true,
    stock_magasin: true,
    sales: true,
    sales_history: true,
    paiements_assurances: true,
    clients: true,
    suppliers: true,
    orders: true,
    transfers: true,
    inventory: true,
    inventory_magasin: true,
    magasins: true,
    settings: true,
  },
  pharmacien: {
    dashboard: true,
    products: true,
    stock: true,
    stock_magasin: true,
    sales: true,
    sales_history: true,
    paiements_assurances: true,
    clients: true,
    suppliers: true,
    orders: true,
    transfers: true,
    inventory: true,
    inventory_magasin: true,
    magasins: false,
    settings: false,
  },
  vendeur: {
    dashboard: true,
    products: true,
    stock: true,
    stock_magasin: false,
    sales: true,
    sales_history: true,
    paiements_assurances: false,
    clients: true,
    suppliers: false,
    orders: false,
    transfers: false,
    inventory: false,
    inventory_magasin: false,
    magasins: false,
    settings: false,
  },
  caissier: {
    dashboard: true,
    products: false,
    stock: false,
    stock_magasin: false,
    sales: true,
    sales_history: true,
    paiements_assurances: false,
    clients: false,
    suppliers: false,
    orders: false,
    transfers: false,
    inventory: false,
    inventory_magasin: false,
    magasins: false,
    settings: false,
  },
};

export function RolesSettings() {
  const { utilisateur } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, [utilisateur]);

  const loadPermissions = async () => {
    if (!utilisateur) return;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('pharmacy_id', utilisateur.pharmacy_id);

      if (error) throw error;

      if (data && data.length > 0) {
        const permissionsFromDB: RolePermissions = { ...defaultPermissions };
        
        data.forEach(item => {
          permissionsFromDB[item.role] = {
            dashboard: item.dashboard,
            products: item.products,
            stock: item.stock,
            stock_magasin: item.stock_magasin ?? false,
            sales: item.sales,
            sales_history: item.sales_history,
            paiements_assurances: item.paiements_assurances ?? false,
            clients: item.clients,
            suppliers: item.suppliers,
            orders: item.orders,
            transfers: item.transfers ?? false,
            inventory: item.inventory,
            inventory_magasin: item.inventory_magasin ?? false,
            magasins: item.magasins ?? false,
            settings: item.settings,
          };
        });
        
        setPermissions(permissionsFromDB);
      }
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
      setPermissions(defaultPermissions);
    }
  };

  const updatePermission = (role: string, module: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: value
      }
    }));
  };

  const savePermissions = async () => {
    if (!utilisateur || utilisateur.role !== 'admin') {
      alert('Seul un administrateur peut modifier les permissions');
      return;
    }

    setLoading(true);
    try {
      // Supprimer les anciennes permissions
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('pharmacy_id', utilisateur.pharmacy_id);

      if (deleteError) throw deleteError;

      // Insérer les nouvelles permissions
      const permissionsToInsert = Object.entries(permissions).map(([role, perms]) => ({
        pharmacy_id: utilisateur.pharmacy_id,
        role,
        dashboard: perms.dashboard,
        products: perms.products,
        stock: perms.stock,
        stock_magasin: perms.stock_magasin,
        sales: perms.sales,
        sales_history: perms.sales_history,
        paiements_assurances: perms.paiements_assurances,
        clients: perms.clients,
        suppliers: perms.suppliers,
        orders: perms.orders,
        transfers: perms.transfers,
        inventory: perms.inventory,
        inventory_magasin: perms.inventory_magasin,
        magasins: perms.magasins,
        settings: perms.settings,
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(permissionsToInsert);

      if (insertError) throw insertError;
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      alert('✅ Permissions sauvegardées avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde permissions:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const getModuleLabel = (module: string) => {
    const labels: { [key: string]: string } = {
      dashboard: 'Tableau de bord',
      products: 'Gestion des produits',
      stock: 'Gestion du stock',
      stock_magasin: 'Stock par magasin',
      sales: 'Ventes (Accueil Client)',
      sales_history: 'Historique des ventes',
      paiements_assurances: 'Paiements Assurances',
      clients: 'Gestion des clients',
      suppliers: 'Gestion des fournisseurs',
      orders: 'Commandes fournisseurs',
      transfers: 'Transferts',
      inventory: 'Inventaires',
      inventory_magasin: 'Inventaires par magasin',
      magasins: 'Gestion des magasins',
      settings: 'Paramètres',
    };
    return labels[module] || module;
  };

  const getModuleIcon = (module: string) => {
    const icons: { [key: string]: any } = {
      dashboard: Shield,
      products: Package,
      stock: Package,
      stock_magasin: Warehouse,
      sales: Package,
      sales_history: Package,
      paiements_assurances: Shield,
      clients: Shield,
      suppliers: Shield,
      orders: Package,
      transfers: ArrowLeftRight,
      inventory: ClipboardList,
      inventory_magasin: ClipboardList,
      magasins: Warehouse,
      settings: Shield,
    };
    return icons[module] || Shield;
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
          Seuls les administrateurs peuvent modifier les permissions.
        </p>
      </div>
    );
  }

  // Regrouper les modules par catégorie
  const moduleCategories = {
    'Tableau de bord': ['dashboard'],
    'Gestion des produits': ['products', 'stock', 'stock_magasin'],
    'Ventes': ['sales', 'sales_history', 'paiements_assurances'],
    'Clients & Fournisseurs': ['clients', 'suppliers'],
    'Achats & Transferts': ['orders', 'transfers'],
    'Inventaires': ['inventory', 'inventory_magasin'],
    'Administration': ['magasins', 'settings'],
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Configuration des rôles et permissions</h3>
        <p className="text-blue-700 text-sm">
          Définissez les permissions d'accès pour chaque rôle dans le système.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-4 px-4 font-semibold text-gray-700 bg-gray-50 w-64">
                Modules
              </th>
              {Object.keys(permissions).map(role => (
                <th key={role} className="text-center py-4 px-4 font-semibold text-gray-700 bg-gray-50 min-w-[120px]">
                  {getRoleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(moduleCategories).map(([category, modules]) => (
              <>
                <tr className="bg-gray-100">
                  <td colSpan={Object.keys(permissions).length + 1} className="py-2 px-4 font-bold text-gray-700">
                    {category}
                  </td>
                </tr>
                {modules.map(module => {
                  const Icon = getModuleIcon(module);
                  return (
                    <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-500" />
                          {getModuleLabel(module)}
                        </div>
                      </td>
                      {Object.keys(permissions).map(role => (
                        <td key={role} className="py-3 px-4 text-center">
                          <button
                            onClick={() => updatePermission(role, module, !permissions[role][module as keyof typeof permissions.admin])}
                            className={`p-2 rounded-lg transition ${
                              permissions[role][module as keyof typeof permissions.admin]
                                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={permissions[role][module as keyof typeof permissions.admin] ? 'Autorisé' : 'Non autorisé'}
                          >
                            {permissions[role][module as keyof typeof permissions.admin] ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {saved && (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              Permissions sauvegardées avec succès
            </div>
          )}
        </div>
        <button
          onClick={savePermissions}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Sauvegarde...' : 'Sauvegarder les permissions'}
        </button>
      </div>

      {/* Légende des rôles */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Description des rôles</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-900">Administrateur</p>
            <p className="text-gray-600">Accès complet à tous les modules et paramètres</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Pharmacien</p>
            <p className="text-gray-600">Gestion complète des produits, stocks, ventes et inventaires</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Vendeur/Auxiliaire</p>
            <p className="text-gray-600">Accueil client, préparation commandes, consultation stock</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Caissier</p>
            <p className="text-gray-600">Encaissement uniquement, historique des ventes</p>
          </div>
        </div>
      </div>

      {/* Note sur les nouveaux modules */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-800 mb-2">📦 Nouveaux modules disponibles</h4>
        <ul className="text-amber-700 text-sm space-y-1">
          <li>• <strong>Stock par magasin</strong> : Consultation des stocks par entrepôt</li>
          <li>• <strong>Transferts</strong> : Gestion des transferts entre magasins</li>
          <li>• <strong>Inventaires par magasin</strong> : Inventaires physiques par entrepôt</li>
          <li>• <strong>Gestion des magasins</strong> : Création et configuration des entrepôts</li>
        </ul>
      </div>
    </div>
  );
}
