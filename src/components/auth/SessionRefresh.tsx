// src/components/auth/SessionRefresh.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function SessionRefresh() {
  const { user, utilisateur, loading, retryLoadUser } = useAuth();
  const [showHelper, setShowHelper] = useState(false);

  useEffect(() => {
    // Afficher l'aide si le chargement du profil échoue après un délai
    if (user && !utilisateur && !loading) {
      const timer = setTimeout(() => {
        setShowHelper(true);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setShowHelper(false);
    }
  }, [user, utilisateur, loading]);

  if (showHelper) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-lg border">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chargement du profil</h3>
          <p className="text-gray-600 mb-4">
            Le chargement du profil utilisateur prend plus de temps que prévu.
          </p>
          <div className="space-y-2">
            <button
              onClick={retryLoadUser}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Réessayer le chargement
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
