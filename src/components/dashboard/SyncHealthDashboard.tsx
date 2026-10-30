import { useState, useEffect } from 'react';
import { repository } from '../lib/repository';

export function SyncHealthDashboard() {
  const [stats, setStats] = useState({
    pending: 0,
    failed: 0,
    synced: 0,
    abandoned: 0,
    lastSync: null
  });

  useEffect(() => {
    const loadStats = async () => {
      const allLogs = await repository.getAllSyncLogs();
      setStats({
        pending: allLogs.filter(l => l.status === 'pending').length,
        failed: allLogs.filter(l => l.status === 'failed' && !l.abandoned).length,
        abandoned: allLogs.filter(l => l.abandoned).length,
        synced: allLogs.filter(l => l.status === 'synced').length,
        lastSync: allLogs[allLogs.length - 1]?.created_at
      });
    };
    loadStats();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-bold mb-4"> Santé de la Synchronisation</h3>
      <div className="grid grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${stats.pending > 10 ? 'bg-amber-100' : 'bg-green-100'}`}>
          <p className="text-sm text-gray-600">En attente</p>
          <p className="text-2xl font-bold">{stats.pending}</p>
        </div>
        <div className={`p-4 rounded-lg ${stats.failed > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
          <p className="text-sm text-gray-600">Échecs</p>
          <p className="text-2xl font-bold">{stats.failed}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-100">
          <p className="text-sm text-gray-600">Abandonnés</p>
          <p className="text-2xl font-bold">{stats.abandoned}</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-100">
          <p className="text-sm text-gray-600">Synchronisés</p>
          <p className="text-2xl font-bold">{stats.synced}</p>
        </div>
      </div>
      
      {stats.failed > 0 && (
        <button 
          onClick={() => repository.retryFailedSyncs()}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg"
        >
          🔄 Retenter les échecs
        </button>
      )}
    </div>
  );
}
