// src/lib/syncEngine.ts
import { localDb, type LocalSyncLog } from './localDb';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeForSupabase } from './schemaValidator';

const SYNC_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3; // ✅ Circuit breaker : abandon après 3 échecs

const TABLE_MAPPING: Record<string, string> = {
  produits: 'produits',
  clients: 'clients',
  assurances: 'assurances',
  ventes: 'ventes',
  vente_lignes: 'vente_lignes',
  stock: 'stock',
  fournisseurs: 'fournisseurs',
  commandes: 'commandes', // Corrigé pour matcher le nom local
  magasins: 'magasins',
  transferts: 'transferts',
  transfert_lignes: 'transfert_lignes',
  demandes_proforma: 'demandes_proforma',
  demandes_proforma_lignes: 'demandes_proforma_lignes',
  receptions: 'receptions',
  reception_lignes: 'reception_lignes',
  comptes_clients: 'comptes_clients',
  historique_consommation_compte: 'historique_consommation_compte',
  avoirs_clients: 'avoirs_clients',
  credits_clients: 'credits_clients',
};

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  pulled: number;
  errors: string[];
  message?: string;
}

class SyncEngine {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private listeners: Array<(status: SyncStatus) => void> = [];

  private status: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    errors: [],
  };

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    this.startAutoSync();
  }

  private handleOnline() {
    console.log('🌐 Connexion rétablie - Lancement synchronisation...');
    this.status.isOnline = true;
    this.notifyListeners();
    this.syncAll();
  }

  private handleOffline() {
    console.log('📴 Mode hors-ligne activé');
    this.status.isOnline = false;
    this.notifyListeners();
  }

  startAutoSync() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      if (this.status.isOnline) this.syncAll();
    }, SYNC_INTERVAL_MS);
    console.log('🔄 Synchronisation automatique démarrée (toutes les 30s)');
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncAll(): Promise<SyncResult> {
    if (!navigator.onLine || this.isSyncing) {
      return { success: false, message: 'Hors-ligne ou déjà en cours', synced: 0, failed: 0, pulled: 0, errors: [] };
    }

    this.isSyncing = true;
    this.status.isSyncing = true;
    this.notifyListeners();

    const result: SyncResult = { success: true, synced: 0, failed: 0, pulled: 0, errors: [] };

    try {
      const pushResult = await this.pushToSupabase();
      result.synced += pushResult.synced;
      result.failed += pushResult.failed;
      result.errors.push(...pushResult.errors);

      const pullResult = await this.pullFromSupabase();
      result.pulled += pullResult.pulled;
      result.errors.push(...pullResult.errors);

      this.status.lastSyncTime = new Date().toISOString();
      this.status.pendingCount = await this.getPendingCount();

      if (result.errors.length > 0) result.success = false;

      console.log(`✅ Sync terminée: ${result.synced} poussés, ${result.pulled} tirés, ${result.failed} échecs`);
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Erreur synchronisation globale:', error);
    } finally {
      this.isSyncing = false;
      this.status.isSyncing = false;
      this.status.errors = result.errors;
      this.notifyListeners();
    }

    return result;
  }

  private async pushToSupabase(): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // ✅ FILTRE CIRCUIT BREAKER : Ignore les enregistrements abandonnés
    const pendingLogs = await localDb.sync_log
      .where('status')
      .equals('pending')
      .and((log) => (log.retry_count || 0) < MAX_RETRIES && !log.abandoned)
      .sortBy('created_at');

    console.log(`📤 ${pendingLogs.length} opérations en attente à pousser`);

    for (const log of pendingLogs) {
      try {
        const supabaseTable = TABLE_MAPPING[log.table_name];
        if (!supabaseTable) {
          console.warn(`⚠️ Table ${log.table_name} non mappée`);
          continue;
        }

        // ✅ VALIDATION DE SCHÉMA : Nettoie TOUTES les colonnes inconnues
        const cleanData = sanitizeForSupabase(log.table_name, log.data);

        let syncError: any = null;

        switch (log.operation) {
          case 'create':
            ({ error: syncError } = await supabase.from(supabaseTable).insert(cleanData));
            break;
          case 'update':
            ({ error: syncError } = await supabase.from(supabaseTable).update(cleanData).eq('id', log.record_id));
            break;
          case 'delete':
            ({ error: syncError } = await supabase.from(supabaseTable).delete().eq('id', log.record_id));
            break;
        }

        if (syncError) {
          // Gestion spécifique des doublons de numéro d'assuré (gardez votre logique existante si elle fonctionne)
          if (syncError.code === '23505' && syncError.message.includes('numero_assure')) {
             const match = syncError.message.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
             const valeur = match ? match[2] : 'inconnue';
             console.warn(`⚠️ Doublon numero_assure: ${valeur}`);
             throw new Error(`Doublon numero_assure "${valeur}"`);
          }
          throw syncError;
        }

        await localDb.sync_log.update(log.id, {
          status: 'synced',
          synced_at: new Date().toISOString(),
        });
        
        // Mise à jour du statut local
        try {
          await (localDb[log.table_name as keyof typeof localDb] as any).update(log.record_id, { _sync_status: 'synced' });
        } catch (e) { /* Ignorer si la table n'a pas ce champ */ }

        synced++;

      } catch (error: any) {
        console.error(`❌ Échec sync ${log.table_name}/${log.record_id}:`, error.message);

        const newRetryCount = (log.retry_count || 0) + 1;
        const isAbandoned = newRetryCount >= MAX_RETRIES;

        await localDb.sync_log.update(log.id, {
          retry_count: newRetryCount,
          error_message: error.message,
          status: isAbandoned ? 'failed' : 'pending',
          abandoned: isAbandoned // ✅ Marque comme abandonné pour ne plus jamais réessayer
        });

        failed++;
        errors.push(`${log.table_name}/${log.record_id}: ${error.message}`);
      }
    }

    return { synced, failed, errors };
  }

  private async pullFromSupabase(): Promise<{ pulled: number; errors: string[] }> {
    let pulled = 0;
    const errors: string[] = [];

    const pharmacyId = localStorage.getItem('pharmacy_id');
    if (!pharmacyId) return { pulled: 0, errors: ['Pas de pharmacy_id'] };

    const tablesToPull = [
      { local: 'produits', remote: 'produits', pharmacyColumn: 'pharmacy_id' },
      { local: 'clients', remote: 'clients', pharmacyColumn: 'pharmacy_id' },
      { local: 'assurances', remote: 'assurances', pharmacyColumn: 'pharmacy_id' },
      { local: 'fournisseurs', remote: 'fournisseurs', pharmacyColumn: 'pharmacy_id' },
      { local: 'stock', remote: 'stock', pharmacyColumn: 'pharmacy_id' },
      { local: 'ventes', remote: 'ventes', pharmacyColumn: 'pharmacy_id' },
      { local: 'magasins', remote: 'magasins', pharmacyColumn: 'pharmacie_principale_id' },
      { local: 'commandes', remote: 'commandes_fournisseurs', pharmacyColumn: 'pharmacy_id' },
      { local: 'demandes_proforma', remote: 'demandes_proforma', pharmacyColumn: 'pharmacy_id' },
      { local: 'demandes_proforma_lignes', remote: 'demandes_proforma_lignes', pharmacyColumn: null },
      { local: 'receptions', remote: 'receptions', pharmacyColumn: 'pharmacy_id' },
      { local: 'comptes_clients', remote: 'comptes_clients', pharmacyColumn: 'pharmacy_id' },
      { local: 'avoirs_clients', remote: 'avoirs_clients', pharmacyColumn: 'pharmacy_id' },
      { local: 'credits_clients', remote: 'credits_clients', pharmacyColumn: 'pharmacy_id' },
    ];

    for (const table of tablesToPull) {
      try {
        let query = supabase.from(table.remote).select('*');

        if (table.pharmacyColumn) {
          query = query.eq(table.pharmacyColumn, pharmacyId);
        }

        if (this.status.lastSyncTime) {
          query = query.gte('updated_at', this.status.lastSyncTime);
        }

        const { data, error } = await query;

        if (error) {
          if (error.message.includes('does not exist')) {
            console.warn(`⚠️ Colonne manquante pour '${table.local}', ignoré.`);
            continue;
          }
          throw error;
        }

        if (data && data.length > 0) {
          for (const record of data) {
            // ✅ Nettoyage avant insertion locale
            const { _sync_status, _local_id, ...cleanRecord } = record;
            const localRecord = { ...cleanRecord, _sync_status: 'synced' as const };
            
            await (localDb[table.local as keyof typeof localDb] as any).put(localRecord);
            pulled++;
          }
          console.log(`📥 ${data.length} enregistrements tirés pour ${table.local}`);
        }
      } catch (error: any) {
        console.error(`❌ Erreur pull ${table.local}:`, error.message);
        errors.push(`pull ${table.local}: ${error.message}`);
      }
    }

    return { pulled, errors };
  }

  async logOperation(tableName: string, recordId: string, operation: 'create' | 'update' | 'delete', data: any) {
    const logEntry: LocalSyncLog = {
      id: uuidv4(),
      table_name: tableName,
      record_id: recordId,
      operation,
      data,
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
      abandoned: false,
    };

    await localDb.sync_log.add(logEntry);

    if (this.status.isOnline) {
      this.syncAll();
    }
  }

  async getPendingCount(): Promise<number> {
    return await localDb.sync_log.where('status').equals('pending').count();
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.getStatus()));
  }
}

export const syncEngine = new SyncEngine();
