// src/App.tsx
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { GlobalCacheProvider } from './contexts/GlobalCacheContext';
import { AppContent } from './AppContent';
import { LoadingScreen } from './components/LoadingScreen';
import { SyncIndicator } from './components/SyncIndicator';
import { syncEngine } from './lib/syncEngine';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Démarrer le moteur de synchronisation au montage de l'app
    syncEngine.startAutoSync();

    // 2. Petit délai pour l'écran de chargement (le temps que Dexie s'initialise)
    const timer = setTimeout(() => setIsLoading(false), 500);

    // 3. Nettoyage au démontage
    return () => {
      clearTimeout(timer);
      syncEngine.stopAutoSync();
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <GlobalCacheProvider>
      <AuthProvider>
        <AppContent />
        
        {/* L'indicateur de sync est global, visible sur toutes les pages en bas à droite */}
        <SyncIndicator />
        
      </AuthProvider>
    </GlobalCacheProvider>
  );
}

export default App;
