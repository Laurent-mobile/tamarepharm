// src/components/layout/Sidebar.tsx
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  LogOut,
  Building2,
  UserCog,
  BarChart3,
  Settings,
  Activity,
  Shield,
  CreditCard,
  Wallet // ✅ Ajout de l'icône pour les comptes/dépôts
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { signOut, utilisateur } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'ventes', label: 'Ventes', icon: ShoppingCart },
    { id: 'ventes-structures', label: 'Ventes Structures', icon: Building2 },
    { id: 'caissier', label: 'Gestion Caisse', icon: CreditCard },
    { id: 'historique-ventes', label: 'Historique Ventes', icon: BarChart3 },
    { id: 'paiements-assurances', label: 'Paiements Assurances', icon: Shield },
    { id: 'produits', label: 'Produits', icon: Package },
    { id: 'stock', label: 'Stock', icon: Building2 },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'comptes-clients', label: 'Comptes & Dépôts', icon: Wallet }, // ✅ NOUVEAU MENU
    { id: 'fournisseurs', label: 'Fournisseurs', icon: UserCog },
    { id: 'commandes', label: 'Commandes', icon: Truck },
    { id: 'transferts', label: 'Transferts', icon: ArrowLeftRight },
    { id: 'inventaires', label: 'Inventaires', icon: ClipboardList },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="w-64 bg-gradient-to-b from-emerald-800 to-emerald-900 text-white flex flex-col h-screen">
      {/* En-tête avec icône pharmacie */}
      <div className="p-6 border-b border-emerald-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/10 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pharmacie</h1>
            <p className="text-emerald-200 text-sm">Burkina</p>
          </div>
        </div>
        <p className="text-emerald-200 text-sm mt-1">{utilisateur?.nom_complet}</p>
        <p className="text-emerald-300 text-xs mt-0.5 capitalize">{utilisateur?.role}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-lg'
                  : 'text-emerald-100 hover:bg-emerald-700/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-emerald-700">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-emerald-100 hover:bg-emerald-700/50 transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
