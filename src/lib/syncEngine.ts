// src/lib/syncEngine.ts
import { localDb, type LocalSyncLog } from './localDb';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// CONFIGURATION
// ============================================
const SYNC_INTERVAL_MS = 30_000; // Sync toutes les 30 secondes
const MAX_RETRIES = 5;

// Mapping tables locales <-> Supabase
const TABLE_MAPPING: Record<string, string> = {
  produits: 'produits',
  clients: 'clients',
  assurances: 'assurances',
  ventes: 'ventes',
  vente_lignes: 'vente_lignes',
  stock: 'stock',
  fournisseurs: 'fournisseurs',
  commandes: 'commandes_fournisseurs',
  magasins: 'magasins',
  transferts: 'transferts',
  transfert_lignes: 'transfert_lignes',
  demandes_proforma: 'demandes_proforma',
  demandes_proforma_lignes: 'demandes_proforma_lignes',
  comptes_clients: 'comptes_clients',
  historique_consommation_compte: 'historique_consommation_compte',
  avoirs_clients: 'avoirs_clients',
  credits_clients: 'credits_clients',
};

// ============================================
// TYPES
// ============================================
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

// ============================================
// MOTEUR DE SYNCHRONISATION
// ============================================
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

  // ─── GESTION CONNECTIVITÉ ───
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

  // ─── AUTO SYNC ───
  startAutoSync() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      if (this.status.isOnline) {
        this.syncAll();
      }
    }, SYNC_INTERVAL_MS);
    console.log('🔄 Synchronisation automatique démarrée (toutes les 30s)');
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ─── SYNCHRONISATION COMPLÈTE ───
  async syncAll(): Promise<SyncResult> {
    if (!navigator.onLine) {
      console.log('📴 Synchronisation ignorée : Mode hors-ligne actif');
      return { success: false, message: 'Hors-ligne', synced: 0, failed: 0, pulled: 0, errors: [] };
    }
    if (this.isSyncing) {
      return { success: false, message: 'Synchronisation déjà en cours', synced: 0, failed: 0, pulled: 0, errors: [] };
    }

    this.isSyncing = true;
    this.status.isSyncing = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      pulled: 0,
      errors: [],
    };

    try {
      // 1. POUSSER les modifications locales vers Supabase (PUSH)
      const pushResult = await this.pushToSupabase();
      result.synced += pushResult.synced;
      result.failed += pushResult.failed;
      result.errors.push(...pushResult.errors);

      // 2. TIRER les modifications de Supabase vers le local (PULL)
      const pullResult = await this.pullFromSupabase();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      this.status.lastSyncTime = new Date().toISOString();
      this.status.pendingCount = await this.getPendingCount();

      if (result.errors.length > 0) {
        result.success = false;
      }

      console.log(`✅ Sync terminée: ${result.synced} poussés, ${result.pulled} tirés, ${result.failed} échecs`);
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Erreur synchronisation:', error);
    } finally {
      this.isSyncing = false;
      this.status.isSyncing = false;
      this.status.errors = result.errors;
      this.notifyListeners();
    }

    return result;
  }

  // ─── PUSH : Local → Supabase ───
  private async pushToSupabase(): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    const pendingLogs = await localDb.sync_log
      .where('status')
      .equals('pending')
      .and((log) => log.retry_count < MAX_RETRIES)
      .sortBy('created_at');

    console.log(`📤 ${pendingLogs.length} opérations en attente à pousser`);

    for (const log of pendingLogs) {
      try {
        const supabaseTable = TABLE_MAPPING[log.table_name];
        if (!supabaseTable) {
          console.warn(`⚠️ Table ${log.table_name} non mappée`);
          continue;
        }

        const cleanData = { ...log.data };
        delete cleanData._sync_status;
        delete cleanData._local_id;

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
          if (syncError.code === '23503' && cleanData.assurance_id) {
            console.warn(`⚠️ L'assurance assignée n'existe pas encore. Suppression de la référence pour permettre la sync.`);
            cleanData.assurance_id = null;
            
            let retryError: any = null;
            if (log.operation === 'create') {
              ({ error: retryError } = await supabase.from(supabaseTable).insert(cleanData));
            } else if (log.operation === 'update') {
              ({ error: retryError } = await supabase.from(supabaseTable).update(cleanData).eq('id', log.record_id));
            }
            
            if (retryError) throw retryError;
            console.log(`✅ Synchronisé avec succès (sans référence assurance)`);
          } else if (syncError.code === '23505') {
            const match = syncError.message.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
            const colonne = match ? match[1] : 'inconnue';
            const valeur = match ? match[2] : 'inconnue';

            if (colonne === 'numero_assure' && log.table_name === 'clients') {
              console.warn(`⚠️ Doublon détecté : le numéro d'assuré "${valeur}" existe déjà`);
              
              await localDb.sync_log.update(log.id, {
                status: 'failed',
                error_message: `Numéro d'assuré "${valeur}" déjà utilisé`,
                retry_count: MAX_RETRIES,
              });

              alert(
                `⚠️ Synchronisation bloquée pour un client\n\n` +
                `Le numéro d'assuré "${valeur}" est déjà utilisé par un autre client.\n` +
                `Veuillez modifier ce numéro dans la liste des clients pour débloquer la synchronisation.`
              );

              failed++;
              errors.push(`${log.table_name}/${log.record_id}: Doublon numero_assure "${valeur}"`);
              continue;
            } else {
              throw syncError;
            }
          } else {
            throw syncError;
          }
        }

        await localDb.sync_log.update(log.id, {
          status: 'synced',
          synced_at: new Date().toISOString(),
        });

        await this.updateLocalSyncStatus(log.table_name, log.record_id, 'synced');
        synced++;

      } catch (error: any) {
        console.error(`❌ Échec sync ${log.table_name}/${log.record_id}:`, error.message);

        await localDb.sync_log.update(log.id, {
          retry_count: log.retry_count + 1,
          error_message: error.message,
          status: log.retry_count + 1 >= MAX_RETRIES ? 'failed' : 'pending',
        });

        failed++;
        errors.push(`${log.table_name}/${log.record_id}: ${error.message}`);
      }
    }

    return { synced, failed, errors };
  }

  // ─── PULL : Supabase → Local ───
  private async pullFromSupabase(): Promise<{ pulled: number; errors: string[] }> {
    let pulled = 0;
    const errors: string[] = [];

    const pharmacyId = localStorage.getItem('pharmacy_id');
    if (!pharmacyId) {
      console.warn('⚠️ Pas de pharmacy_id, skip pull');
      return { pulled: 0, errors: [] };
    }

    const tablesToPull = [
  { local: 'produits', remote: 'produits', pharmacyColumn: 'pharmacy_id' },
  { local: 'clients', remote: 'clients', pharmacyColumn: 'pharmacy_id' },
  { local: 'assurances', remote: 'assurances', pharmacyColumn: 'pharmacy_id' },
  { local: 'fournisseurs', remote: 'fournisseurs', pharmacyColumn: 'pharmacy_id' },
  { local: 'stock', remote: 'stock', pharmacyColumn: 'pharmacy_id' },
  { local: 'ventes', remote: 'ventes', pharmacyColumn: 'pharmacy_id' },
  { local: 'magasins', remote: 'magasins', pharmacyColumn: 'pharmacie_principale_id' },
  { local: 'commandes', remote: 'commandes_fournisseurs', pharmacyColumn: 'pharmacy_id' },
  // ✅ AJOUTEZ CES LIGNES ICI :
  { local: 'demandes_proforma', remote: 'demandes_proforma', pharmacyColumn: 'pharmacy_id' },
  { local: 'demandes_proforma_lignes', remote: 'demandes_proforma_lignes', pharmacyColumn: null }, // Pas de pharmacy_id direct sur les lignes
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
            console.warn(`⚠️ La colonne n'existe pas encore dans Supabase pour la table '${table.local}'.`);
            continue;
          }
          throw error;
        }

        if (data && data.length > 0) {
          for (const record of data) {
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

  // ─── UTILITAIRES ───
  async logOperation(
    tableName: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    data: any
  ) {
    const logEntry: LocalSyncLog = {
      id: uuidv4(),
      table_name: tableName,
      record_id: recordId,
      operation,
      data,
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
    };

    await localDb.sync_log.add(logEntry);

    if (this.status.isOnline) {
      this.syncAll();
    }
  }

  private async updateLocalSyncStatus(tableName: string, recordId: string, status: string) {
    try {
      await (localDb[tableName as keyof typeof localDb] as any).update(recordId, { _sync_status: status });
    } catch (e) {
      // Ignorer si la table n'existe pas ou si le record a été supprimé
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

// Singleton
export const syncEngine = new SyncEngine();
