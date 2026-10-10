// src/components/SyncIndicator.tsx
import { useState, useEffect } from 'react';
import { syncEngine, type SyncStatus } from '../lib/syncEngine';

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    await syncEngine.syncAll();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium
        transition-all duration-300
        ${status.isOnline
          ? status.isSyncing
            ? 'bg-blue-500 text-white animate-pulse'
            : status.pendingCount > 0
              ? 'bg-yellow-500 text-white'
              : 'bg-green-500 text-white'
          : 'bg-red-500 text-white'
        }
      `}>
        {/* Icône */}
        {status.isOnline ? (
          status.isSyncing ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 13l4 4L19 7" />
            </svg>
          )
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728
                 M12 12h.01M8.464 8.464a5 5 0 017.072 0" />
          </svg>
        )}

        {/* Texte */}
        <span>
          {!status.isOnline
            ? 'Hors-ligne'
            : status.isSyncing
              ? 'Synchronisation...'
              : status.pendingCount > 0
                ? `${status.pendingCount} en attente`
                : 'Synchronisé'
          }
        </span>

        {/* Bouton sync manuelle */}
        {status.isOnline && !status.isSyncing && status.pendingCount > 0 && (
          <button
            onClick={handleManualSync}
            className="ml-1 p-1 rounded-full hover:bg-white/20 transition"
            title="Synchroniser maintenant"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
                   11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Dernière sync */}
        {status.lastSyncTime && status.isOnline && (
          <span className="text-xs opacity-75">
            {new Date(status.lastSyncTime).toLocaleTimeString('fr-FR')}
          </span>
        )}
      </div>
    </div>
  );
}
