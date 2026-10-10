// components/DebugAuth.tsx
import { useAuth } from '../contexts/AuthContext';

export function DebugAuth() {
  const { user, utilisateur, loading } = useAuth();
  
  console.log('🔍 Debug Auth:', {
    user: user?.email,
    utilisateur: utilisateur?.nom_complet,
    loading,
    hasUser: !!user,
    hasUtilisateur: !!utilisateur
  });

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400">
      <h3 className="font-bold">Debug Information:</h3>
      <p>User: {user?.email || 'None'}</p>
      <p>Utilisateur: {utilisateur?.nom_complet || 'None'}</p>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
    </div>
  );
}
