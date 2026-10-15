// components/settings/SettingsManager.tsx
import { useState } from 'react';
import { Settings, Users, Shield, Building2, Bell, Key, UserPlus, Warehouse, ClipboardList } from 'lucide-react';
import { RolesSettings } from './RolesSettings';
import { PharmacySettings } from './PharmacySettings';
import { NotificationsSettings } from './NotificationsSettings';
import { SecuritySettings } from './SecuritySettings';
import { UsersManager } from './UsersManager';
import { MagasinsManager } from './MagasinsManager';
   import { InventoryManager } from "../inventory/InventoryManager";

export function SettingsManager() {
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'pharmacy' | 'notifications' | 'security'>('roles');

  const tabs = [
    { id: 'roles' as const, label: 'Rôles et Permissions', icon: Shield },
    { id: 'users' as const, label: 'Gestion des Utilisateurs', icon: UserPlus },
    { id: 'pharmacy' as const, label: 'Paramètres Pharmacie', icon: Building2 },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Sécurité', icon: Key },
	{ id: 'magasins' as const, label: 'Magasins', icon: Warehouse },
	{ id: 'inventaires_magasin' as const, label: 'Inventaires Magasins', icon: ClipboardList },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'roles':
        return <RolesSettings />;
      case 'users':
        return <UsersManager />;
      case 'pharmacy':
        return <PharmacySettings />;
      case 'notifications':
        return <NotificationsSettings />;
      case 'security':
        return <SecuritySettings />;
      default:
        return <RolesSettings />;
		case 'magasins':
  return <MagasinsManager />;
		case 'inventaires_magasin':
  return <InventoryManager />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Paramètres</h2>
          <p className="text-gray-600 mt-1">Configuration du système</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
